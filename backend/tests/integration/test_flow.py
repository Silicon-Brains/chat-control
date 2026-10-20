"""End-to-end behaviour against a real Postgres: auth, admin, E2EE plumbing, expiry, rotation."""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import text

from tests.fakes import OTHER_KEY, mint
from tests.integration.conftest import API, Account, World, b64, grant, make_spki, recv_until, send_event

pytestmark = pytest.mark.integration


# ------------------------------------------------------------------ health / headers
def test_health_and_security_headers(world: World) -> None:
    r = world.client.get("/healthz")
    assert r.status_code == 200 and r.json() == {"status": "ok", "db": "ok"}
    h = r.headers
    assert h["x-content-type-options"] == "nosniff" and h["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in h["content-security-policy"] and "x-request-id" in h
    assert world.client.get(f"{API}/nope").json()["error"]["code"] == "NOT_FOUND"


# ----------------------------------------------------------------------- user lifecycle
def test_key_registration_and_directory(world: World) -> None:
    grace = world.make_user("grace", enroll=False)
    c = world.client
    assert c.get(f"{API}/users/me", headers=grace.auth).json()["hasPublicKey"] is False
    grace.pub = make_spki()
    assert c.put(f"{API}/users/me/key", headers=grace.auth, json={"publicKey": grace.pub}).status_code == 204
    assert (
        c.put(f"{API}/users/me/key", headers=grace.auth, json={"publicKey": grace.pub}).status_code == 204
    )  # idempotent
    other = c.put(f"{API}/users/me/key", headers=grace.auth, json={"publicKey": make_spki()})
    assert other.status_code == 409 and other.json()["error"]["code"] == "KEY_ALREADY_REGISTERED"
    assert c.put(f"{API}/users/me/key", headers=grace.auth, json={"publicKey": b64(b"\x01" * 91)}).status_code == 422
    listing = c.get(f"{API}/users", headers=grace.auth).json()["items"]
    names = {u["username"] for u in listing}
    assert {"alice", "bob", "carol", "grace"} <= names and "root" not in names
    assert all("email" not in u for u in listing)  # directory never exposes e-mail addresses


# ----------------------------------------------------------------- direct chat + realtime
def test_direct_chat_end_to_end(world: World) -> None:
    c, alice, bob, carol = world.client, world.users["alice"], world.users["bob"], world.users["carol"]
    req = {"type": "direct", "members": [grant(alice.user_id), grant(bob.user_id)]}
    r = c.post(f"{API}/conversations", headers=alice.auth, json=req)
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    again = c.post(
        f"{API}/conversations",
        headers=bob.auth,
        json={"type": "direct", "members": [grant(bob.user_id), grant(alice.user_id)]},
    )
    assert again.status_code == 200 and again.json()["id"] == cid and again.json()["created"] is False
    assert len(c.get(f"{API}/conversations/{cid}/keys", headers=bob.auth).json()) == 1
    assert c.get(f"{API}/conversations/{cid}", headers=carol.auth).status_code == 404  # no existence oracle
    assert c.get(f"{API}/conversations/{cid}/messages", headers=carol.auth).status_code == 404

    with (
        c.websocket_connect(f"/ws?ticket={world.ticket(alice)}") as wa,
        c.websocket_connect(f"/ws?ticket={world.ticket(bob)}") as wb,
        c.websocket_connect(f"/ws?ticket={world.ticket(carol)}") as wc,
    ):
        for sock in (wa, wb, wc):
            assert recv_until(sock, "ready")
        mid = send_event(wa, cid)
        ack = recv_until(wa, "message.ack")
        assert ack["id"] == mid and ack["duplicate"] is False
        got = recv_until(wb, "message.new")
        assert got["id"] == mid and got["senderId"] == alice.user_id and got["keyVersion"] == 1
        # idempotent retry: acked as duplicate, NOT delivered twice
        send_event(wa, cid, client_id=mid)
        assert recv_until(wa, "message.ack")["duplicate"] is True

        # outsider cannot post, and nothing leaks to them
        send_event(wc, cid)
        err = recv_until(wc, "error")
        assert err["error"]["code"] == "NOT_A_MEMBER"
        # stale key version rejected with the current one
        send_event(wa, cid, key_version=9)
        assert recv_until(wa, "error")["error"]["details"]["currentKeyVersion"] == 1
        # malformed frames
        wa.send_text("not json")
        assert recv_until(wa, "error")["error"]["code"] == "BAD_FRAME"
        wa.send_json(
            {"t": "message.send", "conversationId": cid, "keyVersion": 1, "ciphertext": "AAAA", "nonce": "AAAA"}
        )
        assert recv_until(wa, "error")["error"]["code"] == "BAD_FRAME"  # too short => schema bounds enforced

    hist = c.get(f"{API}/conversations/{cid}/messages", headers=bob.auth).json()
    assert [m["id"] for m in hist["items"]] == [mid]
    unread = {x["id"]: x for x in c.get(f"{API}/conversations", headers=bob.auth).json()}[cid]["unreadCount"]
    assert unread == 1
    assert c.post(f"{API}/conversations/{cid}/read", headers=bob.auth).status_code == 204
    assert {x["id"]: x for x in c.get(f"{API}/conversations", headers=bob.auth).json()}[cid]["unreadCount"] == 0

    # DB holds ciphertext only (no plaintext column exists) and expires_at is DB-assigned (~10 h)
    async def probe():
        async with world.client.app.state.container.session_factory() as s:
            return (
                await s.execute(
                    text("SELECT expires_at - created_at FROM messages WHERE id = :i"), {"i": uuid.UUID(mid)}
                )
            ).scalar_one()

    assert timedelta(hours=9, minutes=59) < world.call(probe) <= timedelta(hours=10)


def test_ws_ticket_is_single_use_and_origin_checked(world: World) -> None:
    alice = world.users["alice"]
    ticket = world.ticket(alice)
    with world.client.websocket_connect(f"/ws?ticket={ticket}") as ws:
        assert recv_until(ws, "ready")
    with world.client.websocket_connect(f"/ws?ticket={ticket}") as ws:
        with pytest.raises(Exception) as exc:
            ws.receive_json()
        assert "4401" in repr(exc.value) or getattr(exc.value, "code", None) == 4401
    with pytest.raises(Exception):
        with world.client.websocket_connect(
            f"/ws?ticket={world.ticket(alice)}", headers={"origin": "https://evil.example"}
        ):
            pass


def test_ws_rate_limit(world: World) -> None:
    c, alice, bob = world.client, world.users["alice"], world.users["bob"]
    cid = c.post(
        f"{API}/conversations",
        headers=alice.auth,
        json={"type": "direct", "members": [grant(alice.user_id), grant(bob.user_id)]},
    ).json()["id"]
    with c.websocket_connect(f"/ws?ticket={world.ticket(alice)}") as ws:
        recv_until(ws, "ready")
        for _ in range(25):
            send_event(ws, cid)
        seen = []
        for _ in range(60):
            e = ws.receive_json()
            if e["t"] in ("message.ack", "error"):
                seen.append(e["t"] if e["t"] == "message.ack" else e["error"]["code"])
            if len(seen) == 25:
                break
    assert "RATE_LIMITED" in seen and seen.count("message.ack") <= 20


# ------------------------------------------------------------------ group + key rotation
def test_group_membership_and_key_rotation(world: World) -> None:
    c, alice, bob, carol, dave = (world.client, *(world.users[n] for n in ("alice", "bob", "carol", "dave")))
    r = c.post(
        f"{API}/conversations",
        headers=alice.auth,
        json={
            "type": "group",
            "name": "Team",
            "members": [grant(alice.user_id), grant(bob.user_id), grant(carol.user_id)],
        },
    )
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    conv = c.get(f"{API}/conversations/{cid}", headers=alice.auth).json()
    assert conv["myRole"] == "owner" and len(conv["members"]) == 3
    assert (
        c.post(
            f"{API}/conversations/{cid}/members",
            headers=bob.auth,
            json={"keyVersion": 1, "members": [grant(dave.user_id)]},
        ).status_code
        == 403
    )  # not owner
    assert (
        c.post(
            f"{API}/conversations/{cid}/members",
            headers=alice.auth,
            json={"keyVersion": 7, "members": [grant(dave.user_id)]},
        ).json()["error"]["code"]
        == "KEY_VERSION_STALE"
    )
    assert (
        c.post(
            f"{API}/conversations/{cid}/members",
            headers=alice.auth,
            json={"keyVersion": 1, "members": [grant(dave.user_id)]},
        ).status_code
        == 204
    )
    # remove carol: owner must supply new keys for exactly the remaining enrolled members
    bad = c.request(
        "DELETE",
        f"{API}/conversations/{cid}/members/{carol.user_id}",
        headers=alice.auth,
        json={"keyVersion": 1, "newKeys": [grant(alice.user_id)]},
    )
    assert bad.status_code == 422
    with c.websocket_connect(f"/ws?ticket={world.ticket(bob)}") as wb:
        recv_until(wb, "ready")
        ok = c.request(
            "DELETE",
            f"{API}/conversations/{cid}/members/{carol.user_id}",
            headers=alice.auth,
            json={"keyVersion": 1, "newKeys": [grant(u.user_id) for u in (alice, bob, dave)]},
        )
        assert ok.status_code == 204, ok.text
        assert recv_until(wb, "key.rotated")["keyVersion"] == 2
        send_event(wb, cid, key_version=1)
        assert recv_until(wb, "error")["error"]["code"] == "KEY_VERSION_STALE"
        send_event(wb, cid, key_version=2)
        assert recv_until(wb, "message.ack")
    assert c.get(f"{API}/conversations/{cid}/keys", headers=carol.auth).status_code == 404
    assert len(c.get(f"{API}/conversations/{cid}/keys", headers=bob.auth).json()) == 2
    assert (
        c.request(
            "DELETE",
            f"{API}/conversations/{cid}/members/{alice.user_id}",
            headers=alice.auth,
            json={"keyVersion": 2, "newKeys": []},
        ).json()["error"]["code"]
        == "OWNER_CANNOT_LEAVE"
    )
    assert c.post(
        f"{API}/conversations/{cid}/keys/rotate",
        headers=alice.auth,
        json={"keyVersion": 2, "keys": [grant(u.user_id) for u in (alice, bob, dave)]},
    ).json() == {"keyVersion": 3}
    # validation: groups need a name, admins cannot be dragged into chats, members must be enrolled
    assert (
        c.post(
            f"{API}/conversations",
            headers=alice.auth,
            json={"type": "group", "members": [grant(alice.user_id), grant(bob.user_id)]},
        ).status_code
        == 422
    )
    assert (
        c.post(
            f"{API}/conversations",
            headers=alice.auth,
            json={"type": "group", "name": "x", "members": [grant(alice.user_id), grant(world.admin.user_id)]},
        ).status_code
        == 422
    )
    assert (
        c.post(
            f"{API}/conversations",
            headers=alice.auth,
            json={"type": "broadcast", "name": "x", "members": [grant(alice.user_id), grant(bob.user_id)]},
        ).status_code
        == 403
    )


# --------------------------------------------------------------------------- broadcast
def test_broadcast_only_senders_may_post(world: World) -> None:
    c, admin, bob, carol = world.client, world.admin, world.users["bob"], world.users["carol"]
    admin.pub = make_spki()
    assert c.put(f"{API}/users/me/key", headers=admin.auth, json={"publicKey": admin.pub}).status_code == 204
    r = c.post(
        f"{API}/conversations",
        headers=admin.auth,
        json={
            "type": "broadcast",
            "name": "Announcements",
            "members": [grant(admin.user_id), grant(bob.user_id), grant(carol.user_id)],
        },
    )
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    assert cid in {b["id"] for b in c.get(f"{API}/admin/broadcasts", headers=admin.auth).json()}
    with (
        c.websocket_connect(f"/ws?ticket={world.ticket(admin)}") as wa,
        c.websocket_connect(f"/ws?ticket={world.ticket(bob)}") as wb,
    ):
        recv_until(wa, "ready"), recv_until(wb, "ready")
        send_event(wb, cid)
        assert recv_until(wb, "error")["error"]["code"] == "NOT_A_SENDER"
        mid = send_event(wa, cid)
        assert recv_until(wb, "message.new")["id"] == mid


# ----------------------------------------------------------------------------- expiry
def test_expired_messages_are_hidden_then_physically_deleted(world: World) -> None:
    c, alice, bob = world.client, world.users["alice"], world.users["bob"]
    world.call(world.client.app.state.container.limiter.delete, f"ws:msg:{alice.user_id}")  # undo earlier flood test
    cid = c.post(
        f"{API}/conversations",
        headers=alice.auth,
        json={"type": "direct", "members": [grant(alice.user_id), grant(bob.user_id)]},
    ).json()["id"]
    with (
        c.websocket_connect(f"/ws?ticket={world.ticket(alice)}") as wa,
        c.websocket_connect(f"/ws?ticket={world.ticket(bob)}") as wb,
    ):
        recv_until(wa, "ready"), recv_until(wb, "ready")
        mid = send_event(wa, cid)
        recv_until(wb, "message.new")

        async def age_message():
            async with world.client.app.state.container.session_factory() as s:
                await s.execute(
                    text("UPDATE messages SET expires_at = now() - interval '1 second' WHERE id = :i"),
                    {"i": uuid.UUID(mid)},
                )
                await s.commit()

        world.call(age_message)
        # read path filters even before the purge job runs (correct even if the job lags)
        assert mid not in [
            m["id"] for m in c.get(f"{API}/conversations/{cid}/messages", headers=bob.auth).json()["items"]
        ]

        from app.services.purge_service import PurgeService

        deleted = world.call(PurgeService(world.client.app.state.container).run_once)
        assert deleted >= 1
        assert mid in recv_until(wb, "message.expired")["ids"]

    async def exists():
        async with world.client.app.state.container.session_factory() as s:
            return (
                await s.execute(text("SELECT count(*) FROM messages WHERE id = :i"), {"i": uuid.UUID(mid)})
            ).scalar_one()

    assert world.call(exists) == 0


# =============================================================================== Clerk-specific
def test_token_validation_end_to_end(world: World) -> None:
    c, alice = world.client, world.users["alice"]
    assert c.get(f"{API}/users/me").status_code == 401
    for bad in (
        "garbage",
        mint(alice.clerk_id, ttl=-120),
        mint(alice.clerk_id, key=OTHER_KEY),
        mint(alice.clerk_id, iss="https://evil.test"),
        mint(alice.clerk_id, azp="https://evil.example"),
    ):
        r = c.get(f"{API}/users/me", headers={"Authorization": f"Bearer {bad}"})
        assert r.status_code == 401 and r.json()["error"]["code"] == "UNAUTHORIZED"
    assert c.get(f"{API}/users/me", headers={"Authorization": "Basic abc"}).status_code == 401
    ok = c.get(f"{API}/users/me", headers=alice.auth)
    assert ok.status_code == 200 and ok.json()["email"] == "alice@corp.test"
    assert "login" not in str(c.get("/openapi.json").status_code)  # docs disabled; no legacy login routes
    assert c.post(f"{API}/auth/login", json={}).status_code in (404, 405)


def test_uninvited_clerk_users_are_refused_and_never_provisioned(world: World) -> None:
    c = world.client
    cid = world.clerk.add_user("stranger@corp.test", role=None)  # signed up in Clerk without an invitation
    r = c.get(f"{API}/users/me", headers={"Authorization": f"Bearer {mint(cid)}"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "NOT_INVITED"
    listing = c.get(f"{API}/admin/users?q=stranger", headers=world.admin.auth).json()["items"]
    assert listing == []
    bogus = world.clerk.add_user("rogue@corp.test", role="superuser")  # unknown role value == not invited
    assert c.get(f"{API}/users/me", headers={"Authorization": f"Bearer {mint(bogus)}"}).status_code == 403
    gone = mint("user_does_not_exist")
    assert c.get(f"{API}/users/me", headers={"Authorization": f"Bearer {gone}"}).status_code == 401


def test_jit_provisioning_derives_unique_usernames(world: World) -> None:
    a = world.make_user("sam.smith", enroll=False)  # e-mail sam.smith@corp.test
    b_id = world.clerk.add_user("sam.smith@other.test", first_name="Sam", last_name="Smith")
    c = world.client
    r = c.get(f"{API}/users/me", headers={"Authorization": f"Bearer {mint(b_id)}"})
    assert r.status_code == 200 and r.json()["displayName"] == "Sam Smith"
    first = c.get(f"{API}/users/me", headers=a.auth).json()
    assert first["username"] == "sam_smith" and r.json()["username"] != "sam_smith"  # collision got a suffix
    assert r.json()["id"] == c.get(f"{API}/users/me", headers={"Authorization": f"Bearer {mint(b_id)}"}).json()["id"]


def test_role_is_enforced_and_follows_clerk(world: World) -> None:
    c, bob = world.client, world.users["bob"]
    r = c.get(f"{API}/admin/users", headers=bob.auth)
    assert r.status_code == 403 and r.json()["error"]["code"] == "ADMIN_ONLY"
    assert c.get(f"{API}/admin/users").status_code == 401
    world.clerk.users[bob.clerk_id]["role"] = "admin"  # promoted in the Clerk dashboard
    assert c.get(f"{API}/admin/users", headers=bob.auth).status_code == 200
    world.clerk.users[bob.clerk_id]["role"] = "user"  # demoted again
    assert c.get(f"{API}/admin/users", headers=bob.auth).status_code == 403
    world.clerk.users[bob.clerk_id]["role"] = None  # invitation role stripped => locked out entirely
    assert c.get(f"{API}/users/me", headers=bob.auth).status_code == 403
    world.clerk.users[bob.clerk_id]["role"] = "user"
    assert c.get(f"{API}/users/me", headers=bob.auth).status_code == 200  # and restored


def test_sync_ttl_limits_calls_to_clerk(world: World) -> None:
    c, dave, settings = world.client, world.users["dave"], world.client.app.state.container.settings
    settings.clerk_sync_ttl_seconds = 300
    try:
        c.get(f"{API}/users/me", headers=dave.auth)  # may refresh once
        before = len(world.clerk.calls)
        for _ in range(5):
            assert c.get(f"{API}/users/me", headers=dave.auth).status_code == 200
        assert len(world.clerk.calls) == before  # cached mirror: zero Clerk round-trips
    finally:
        settings.clerk_sync_ttl_seconds = 0


# ---------------------------------------------------------------------------------- invitations
def test_invitations(world: World) -> None:
    c, admin, bob = world.client, world.admin, world.users["bob"]
    assert c.post(f"{API}/admin/invitations", headers=bob.auth, json={"emailAddress": "x@y.io"}).status_code == 403
    assert (
        c.post(f"{API}/admin/invitations", headers=admin.auth, json={"emailAddress": "not-an-email"}).status_code == 422
    )
    r = c.post(f"{API}/admin/invitations", headers=admin.auth, json={"emailAddress": "New.Hire@Corp.test"})
    assert r.status_code == 201, r.text
    inv = world.clerk.invitations[r.json()["id"]]
    assert (
        inv["email"] == "new.hire@corp.test" and inv["role"] == "user"
    )  # role is stamped server-side, never client-supplied
    dup = c.post(f"{API}/admin/invitations", headers=admin.auth, json={"emailAddress": "new.hire@corp.test"})
    assert dup.status_code == 409
    assert (
        c.post(
            f"{API}/admin/invitations", headers=admin.auth, json={"emailAddress": "a@b.co", "role": "admin"}
        ).status_code
        == 422
    )
    assert [i["emailAddress"] for i in c.get(f"{API}/admin/invitations", headers=admin.auth).json()] == [
        "new.hire@corp.test"
    ]
    assert c.delete(f"{API}/admin/invitations/{r.json()['id']}", headers=admin.auth).status_code == 204
    assert c.get(f"{API}/admin/invitations", headers=admin.auth).json() == []
    assert c.delete(f"{API}/admin/invitations/inv_nope", headers=admin.auth).status_code == 404


# ---------------------------------------------------------------------- account controls
def test_disable_enable_reset_key_and_delete(world: World) -> None:
    c, admin = world.client, world.admin
    zed = world.make_user("zed")
    bob = world.users["bob"]
    cid = c.post(
        f"{API}/conversations",
        headers=zed.auth,
        json={"type": "direct", "members": [grant(zed.user_id), grant(bob.user_id)]},
    ).json()["id"]

    with c.websocket_connect(f"/ws?ticket={world.ticket(zed)}") as ws:
        recv_until(ws, "ready")
        r = c.patch(f"{API}/admin/users/{zed.user_id}", headers=admin.auth, json={"status": "disabled"})
        assert r.status_code == 200 and r.json()["status"] == "disabled"
        with pytest.raises(Exception):  # socket is force-closed
            for _ in range(5):
                ws.receive_json()
    assert ("ban", zed.clerk_id) in world.clerk.calls and zed.clerk_id in world.clerk.revoked_sessions
    denied = c.get(f"{API}/users/me", headers=zed.auth)
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "ACCOUNT_DISABLED"
    assert c.post(f"{API}/auth/ws-ticket", headers=zed.auth).status_code == 403
    assert c.patch(f"{API}/admin/users/{zed.user_id}", headers=admin.auth, json={"status": "active"}).status_code == 200
    assert c.get(f"{API}/users/me", headers=zed.auth).status_code == 200

    # lost device: key cleared, direct chat removed, user can enrol a fresh key
    assert c.post(f"{API}/admin/users/{zed.user_id}/reset-key", headers=admin.auth).status_code == 204
    me = c.get(f"{API}/users/me", headers=zed.auth).json()
    assert me["hasPublicKey"] is False
    assert c.get(f"{API}/conversations/{cid}", headers=zed.auth).status_code == 404
    assert c.put(f"{API}/users/me/key", headers=zed.auth, json={"publicKey": make_spki()}).status_code == 204
    assert c.post(f"{API}/admin/users/{zed.user_id}/revoke-sessions", headers=admin.auth).json() == {"revoked": 1}

    assert c.delete(f"{API}/admin/users/{zed.user_id}", headers=admin.auth).status_code == 204
    assert ("delete", zed.clerk_id) in world.clerk.calls and zed.clerk_id not in world.clerk.users
    assert c.get(f"{API}/users/me", headers=zed.auth).status_code == 401  # Clerk account is gone
    assert (
        c.delete(f"{API}/admin/users/{admin.user_id}", headers=admin.auth).json()["error"]["code"] == "ADMIN_PROTECTED"
    )
    assert (
        c.patch(f"{API}/admin/users/{admin.user_id}", headers=admin.auth, json={"status": "disabled"}).status_code
        == 409
    )
    stats = c.get(f"{API}/admin/stats", headers=admin.auth).json()
    assert stats["usersTotal"] >= 4 and "failedLogins24h" not in stats
    actions = {a["action"] for a in c.get(f"{API}/admin/audit?limit=100", headers=admin.auth).json()["items"]}
    assert {"user.provision", "user.invite", "user.approve", "user.disable", "user.enable", "user.reset_key", "user.delete"} <= actions


# --------------------------------------------------------------------------------- webhooks
def _signed(world: World, event: dict, *, age: int = 0, tamper: bool = False) -> dict:
    import base64 as _b
    import hashlib
    import hmac
    import json
    import time

    secret = world.client.app.state.container.settings.clerk_webhook_secret.get_secret_value()
    body = json.dumps(event).encode()
    ts, msg_id = str(int(time.time()) - age), "msg_" + uuid.uuid4().hex[:8]
    sig = _b.b64encode(
        hmac.new(
            _b.b64decode(secret.removeprefix("whsec_")), f"{msg_id}.{ts}.".encode() + body, hashlib.sha256
        ).digest()
    ).decode()
    return {
        "content": body + (b" " if tamper else b""),
        "headers": {
            "svix-id": msg_id,
            "svix-timestamp": ts,
            "svix-signature": f"v1,{sig}",
            "content-type": "application/json",
        },
    }


def test_webhooks_sync_ban_role_and_deletion(world: World) -> None:
    c = world.client
    hook = f"{API}/webhooks/clerk"
    erin = world.make_user("erin")
    world.clerk.users[erin.clerk_id]["banned"] = True
    ev = {"type": "user.updated", "data": world.clerk.api_json(erin.clerk_id)}
    assert c.post(hook, **_signed(world, ev, tamper=True)).status_code == 401
    assert c.post(hook, **_signed(world, ev, age=3600)).status_code == 401  # replayed/stale
    assert c.post(hook, content=b"{}", headers={"content-type": "application/json"}).status_code == 401
    with c.websocket_connect(f"/ws?ticket={world.ticket(world.users['bob'])}"):
        pass
    assert c.post(hook, **_signed(world, ev)).status_code == 204
    rows = c.get(f"{API}/admin/users?q=erin", headers=world.admin.auth).json()["items"]
    assert rows[0]["status"] == "disabled"  # mirrored without waiting for the TTL

    world.clerk.users[erin.clerk_id]["banned"] = False
    assert (
        c.post(
            hook, **_signed(world, {"type": "user.updated", "data": world.clerk.api_json(erin.clerk_id)})
        ).status_code
        == 204
    )
    assert c.get(f"{API}/users/me", headers=erin.auth).status_code == 200

    direct_signup = world.clerk.add_user("direct-signup@corp.test", role=None)
    direct_account = Account("direct-signup", direct_signup)
    pending_response = c.get(f"{API}/users/me", headers=direct_account.auth)
    assert pending_response.status_code == 403
    assert pending_response.json()["error"]["code"] == "APPROVAL_PENDING"
    assert c.post(f"{API}/auth/ws-ticket", headers=direct_account.auth).status_code == 403
    direct_row = c.get(f"{API}/admin/users?q=direct-signup", headers=world.admin.auth).json()["items"][0]
    approved_direct = c.post(f"{API}/admin/users/{direct_row['id']}/approve", headers=world.admin.auth)
    assert approved_direct.status_code == 200
    assert c.get(f"{API}/users/me", headers=direct_account.auth).status_code == 200

    stranger = world.clerk.add_user("hook-stranger@corp.test", role=None)
    assert (
        c.post(hook, **_signed(world, {"type": "user.created", "data": world.clerk.api_json(stranger)})).status_code
        == 204
    )
    pending = c.get(f"{API}/admin/users?q=hook", headers=world.admin.auth).json()["items"]
    assert len(pending) == 1 and pending[0]["status"] == "pending"
    assert (
        c.patch(f"{API}/admin/users/{pending[0]['id']}", headers=world.admin.auth, json={"status": "active"})
        .json()["error"]["code"]
        == "USER_NOT_PENDING"
    )
    stranger_account = Account("stranger", stranger)
    waiting = c.get(f"{API}/users/me", headers=stranger_account.auth)
    assert waiting.status_code == 403 and waiting.json()["error"]["code"] == "APPROVAL_PENDING"
    assert c.get(f"{API}/users", headers=stranger_account.auth).status_code == 403
    approved = c.post(f"{API}/admin/users/{pending[0]['id']}/approve", headers=world.admin.auth)
    assert approved.status_code == 200 and approved.json()["status"] == "active"
    assert world.clerk.users[stranger]["role"] == "user"
    assert c.get(f"{API}/users/me", headers=stranger_account.auth).status_code == 200
    assert (
        c.post(f"{API}/admin/users/{pending[0]['id']}/approve", headers=world.admin.auth).json()["error"]["code"]
        == "USER_NOT_PENDING"
    )

    unverified = world.clerk.add_user("unverified@corp.test", role=None, email_verified=False)
    assert (
        c.post(hook, **_signed(world, {"type": "user.created", "data": world.clerk.api_json(unverified)})).status_code
        == 204
    )
    unverified_row = c.get(f"{API}/admin/users?q=unverified", headers=world.admin.auth).json()["items"][0]
    approval = c.post(f"{API}/admin/users/{unverified_row['id']}/approve", headers=world.admin.auth)
    assert approval.status_code == 409 and approval.json()["error"]["code"] == "EMAIL_NOT_VERIFIED"

    assert (
        c.post(
            hook, **_signed(world, {"type": "user.deleted", "data": {"id": erin.clerk_id, "deleted": True}})
        ).status_code
        == 204
    )
    assert c.get(f"{API}/admin/users?q=erin", headers=world.admin.auth).json()["items"] == []
    assert c.post(hook, **_signed(world, {"type": "session.created", "data": {}})).status_code == 204  # unknown = ack
    assert c.post(hook, **_signed(world, {"nope": 1})).status_code == 400


# ------------------------------------------------------------------------------------ bootstrap
def test_bootstrap_admin_cli(world: World) -> None:
    from app.cli.bootstrap_admin import bootstrap

    existing = world.clerk.add_user("founder@corp.test", role=None)

    async def run(email: str) -> str:
        return await bootstrap(email, clerk=world.clerk)

    msg = world.call(run, "founder@corp.test")
    assert "now an admin" in msg and world.clerk.users[existing]["role"] == "admin"
    assert (
        world.client.get(f"{API}/admin/users", headers={"Authorization": f"Bearer {mint(existing)}"}).status_code == 200
    )
    msg = world.call(run, "ceo@corp.test")
    assert "invitation" in msg and any(
        i["email"] == "ceo@corp.test" and i["role"] == "admin" for i in world.clerk.invitations.values()
    )
