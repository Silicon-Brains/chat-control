"""In-memory Clerk double + RSA-signed session-token minting (exercises the REAL verification path)."""

from __future__ import annotations

import time
import uuid
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.errors import AppError, NotFound
from app.integrations.clerk import ClerkClaims, ClerkInvitation, ClerkTokenVerifier, ClerkUser

ISSUER = "https://clerk.test"
ORIGIN = "http://localhost:3000"
PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def mint(sub: str, *, ttl: int = 60, iss: str = ISSUER, azp: str | None = ORIGIN, key=PRIVATE_KEY, **extra: Any) -> str:
    now = int(time.time())
    claims = {
        "sub": sub,
        "iss": iss,
        "iat": now,
        "nbf": now - 1,
        "exp": now + ttl,
        "sid": "sess_" + uuid.uuid4().hex[:8],
    }
    if azp:
        claims["azp"] = azp
    claims.update(extra)
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test-key"})


def make_verifier() -> ClerkTokenVerifier:
    return ClerkTokenVerifier(ISSUER, authorized_parties=[ORIGIN], key_resolver=lambda _t: PRIVATE_KEY.public_key())


class FakeClerk:
    def __init__(self) -> None:
        self.users: dict[str, dict[str, Any]] = {}
        self.invitations: dict[str, dict[str, Any]] = {}
        self.revoked_sessions: list[str] = []
        self.calls: list[tuple[str, str]] = []

    # ---- test helpers
    def add_user(
        self,
        email: str,
        *,
        role: str | None = "user",
        username: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
    ) -> str:
        cid = "user_" + uuid.uuid4().hex[:24]
        self.users[cid] = dict(
            id=cid,
            email=email,
            role=role,
            username=username,
            first_name=first_name,
            last_name=last_name,
            banned=False,
            locked=False,
        )
        return cid

    def api_json(self, cid: str) -> dict[str, Any]:
        u = self.users[cid]
        return {
            "id": cid,
            "username": u["username"],
            "first_name": u["first_name"],
            "last_name": u["last_name"],
            "banned": u["banned"],
            "locked": u["locked"],
            "public_metadata": {"role": u["role"]} if u["role"] else {},
            "primary_email_address_id": "idn_1",
            "email_addresses": [{"id": "idn_1", "email_address": u["email"]}],
        }

    # ---- ClerkApi
    async def get_user(self, clerk_user_id: str) -> ClerkUser:
        self.calls.append(("get_user", clerk_user_id))
        if clerk_user_id not in self.users:
            raise NotFound("gone", code="UPSTREAM_NOT_FOUND")
        return ClerkUser.from_api(self.api_json(clerk_user_id))

    async def find_user_by_email(self, email: str) -> ClerkUser | None:
        for cid, u in self.users.items():
            if u["email"] == email:
                return ClerkUser.from_api(self.api_json(cid))
        return None

    async def set_user_role(self, clerk_user_id: str, role: str) -> None:
        self.users[clerk_user_id]["role"] = role

    async def ban_user(self, clerk_user_id: str) -> None:
        self.calls.append(("ban", clerk_user_id))
        self.users[clerk_user_id]["banned"] = True

    async def unban_user(self, clerk_user_id: str) -> None:
        self.calls.append(("unban", clerk_user_id))
        self.users[clerk_user_id]["banned"] = False

    async def delete_user(self, clerk_user_id: str) -> None:
        self.calls.append(("delete", clerk_user_id))
        self.users.pop(clerk_user_id, None)

    async def revoke_user_sessions(self, clerk_user_id: str) -> int:
        self.revoked_sessions.append(clerk_user_id)
        return 1

    async def create_invitation(self, email: str, *, role: str, redirect_url: str | None) -> ClerkInvitation:
        if any(i["email"] == email and i["status"] == "pending" for i in self.invitations.values()):
            raise AppError("An invitation for this address already exists", status_code=409, code="UPSTREAM_REJECTED")
        iid = "inv_" + uuid.uuid4().hex[:12]
        self.invitations[iid] = {"id": iid, "email": email, "role": role, "status": "pending", "redirect": redirect_url}
        return ClerkInvitation(iid, email, "pending", int(time.time() * 1000))

    async def list_invitations(self, *, status: str = "pending", limit: int = 100) -> list[ClerkInvitation]:
        return [
            ClerkInvitation(i["id"], i["email"], i["status"], 0)
            for i in self.invitations.values()
            if i["status"] == status
        ]

    async def revoke_invitation(self, invitation_id: str) -> None:
        if invitation_id not in self.invitations:
            raise NotFound("nope", code="UPSTREAM_NOT_FOUND")
        self.invitations[invitation_id]["status"] = "revoked"

    async def aclose(self) -> None:
        return None


__all__ = ["ISSUER", "ORIGIN", "OTHER_KEY", "PRIVATE_KEY", "ClerkClaims", "FakeClerk", "make_verifier", "mint"]
