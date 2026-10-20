import httpx
import jwt
import pytest

from app.core.errors import AppError, NotFound, Unauthorized
from app.integrations.clerk import ClerkClient, ClerkTokenVerifier, ClerkUser
from app.services.identity_service import derive_username
from tests.fakes import ISSUER, ORIGIN, OTHER_KEY, make_verifier, mint


def test_clerk_user_mapping() -> None:
    cu = ClerkUser.from_api(
        {
            "id": "user_1",
            "username": None,
            "first_name": "Ada",
            "last_name": "Lovelace",
            "banned": True,
            "public_metadata": {"role": "admin"},
            "primary_email_address_id": "e2",
            "email_addresses": [{"id": "e1", "email_address": "old@x.io"}, {"id": "e2", "email_address": "ada@x.io"}],
        }
    )
    assert (cu.email, cu.role, cu.banned, cu.display_name) == ("ada@x.io", "admin", True, "Ada Lovelace")
    assert (
        ClerkUser.from_api({"id": "u", "public_metadata": {"role": "root"}}).role is None
    )  # unknown role = not invited
    assert ClerkUser.from_api({"id": "u"}).role is None


def test_username_derivation_satisfies_db_constraint() -> None:
    import re

    def make(username=None, email=None):
        return ClerkUser("u", username, None, None, email, "user", False, False)

    for cu in (
        make(email="Jane.Doe+tag@corp.io"),
        make("X"),
        make(email="a@b.co"),
        make(email="ñandú@x.io"),
        make(email="a" * 80 + "@x.io"),
    ):
        assert re.fullmatch(r"[a-z0-9_]{3,24}", derive_username(cu)), derive_username(cu)
    assert derive_username(make(email="Jane.Doe@corp.io")) == "jane_doe"


async def test_token_verifier_accepts_and_rejects() -> None:
    v = make_verifier()
    assert (await v.verify(mint("user_1"))).user_id == "user_1"
    for bad in (
        mint("u", ttl=-120),
        mint("u", iss="https://evil.test"),
        mint("u", key=OTHER_KEY),
        mint("u", azp="https://evil.example"),
        mint("u", sts="pending"),
        "garbage.token.here",
    ):
        with pytest.raises(Unauthorized):
            await v.verify(bad)
    unsigned = jwt.encode({"sub": "u", "iss": ISSUER, "exp": 9999999999, "iat": 1}, "", algorithm="none")
    with pytest.raises(Unauthorized):  # alg=none / HS256 confusion must never verify
        await v.verify(unsigned)
    assert (await v.verify(mint("u", azp=None))).authorized_party is None
    assert ORIGIN in ClerkTokenVerifier(ISSUER, authorized_parties=[ORIGIN], key_resolver=lambda _: None)._parties


def _client(handler) -> ClerkClient:
    c = ClerkClient("sk_test_x", "https://api.clerk.test/v1")
    c._http = httpx.AsyncClient(
        base_url="https://api.clerk.test/v1",
        transport=httpx.MockTransport(handler),
        headers={"Authorization": "Bearer sk_test_x"},
    )
    return c


async def test_client_requests_and_error_mapping() -> None:
    seen = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append((req.method, req.url.path, req.read()))
        p = req.url.path
        if p == "/v1/invitations" and req.method == "POST":
            body = req.read()
            if b"dup@" in body:
                return httpx.Response(422, json={"errors": [{"long_message": "Invitation already exists"}]})
            return httpx.Response(
                200, json={"id": "inv_1", "email_address": "a@b.co", "status": "pending", "created_at": 5}
            )
        if p == "/v1/invitations":
            return httpx.Response(
                200, json={"data": [{"id": "inv_1", "email_address": "a@b.co", "status": "pending", "created_at": 1}]}
            )
        if p == "/v1/sessions":
            return httpx.Response(200, json=[{"id": "sess_1"}, {"id": "sess_2"}])
        if p.startswith("/v1/sessions/"):
            return httpx.Response(200, json={})
        if p == "/v1/users/user_gone":
            return httpx.Response(404, json={})
        if p == "/v1/users/user_boom":
            return httpx.Response(500, text="secret internal stack")
        return httpx.Response(200, json={})

    c = _client(handler)
    inv = await c.create_invitation("a@b.co", role="user", redirect_url="https://app/join")
    assert inv.id == "inv_1" and b'"role":"user"' in seen[0][2].replace(b" ", b"")
    assert (await c.list_invitations())[0].email == "a@b.co"  # accepts {"data":[…]} and bare lists
    assert await c.revoke_user_sessions("user_1") == 2
    with pytest.raises(AppError) as dup:
        await c.create_invitation("dup@b.co", role="user", redirect_url=None)
    assert dup.value.status_code == 409 and "already exists" in dup.value.message
    with pytest.raises(NotFound):
        await c.get_user("user_gone")
    with pytest.raises(AppError) as boom:
        await c.get_user("user_boom")
    assert boom.value.status_code == 502 and "secret" not in boom.value.message  # upstream detail never leaks
