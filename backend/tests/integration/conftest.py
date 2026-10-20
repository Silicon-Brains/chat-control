from __future__ import annotations

import asyncio
import base64
import os
import subprocess
import sys
import uuid
from collections.abc import Iterator
from dataclasses import dataclass, field

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

if "TEST_DATABASE_URL" not in os.environ:
    pytest.skip("set TEST_DATABASE_URL to run integration tests", allow_module_level=True)

from app.core.config import get_settings
from app.main import create_app
from tests.fakes import FakeClerk, make_verifier, mint

API = "/api/v1"


def b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode()


def make_spki() -> str:
    key = ec.generate_private_key(ec.SECP256R1())
    return b64(
        key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    )


def grant(user_id: str) -> dict:
    return {"userId": user_id, "wrappedKey": b64(os.urandom(60)), "wrapperPub": make_spki()}


@dataclass
class Account:
    name: str
    clerk_id: str
    user_id: str = ""
    pub: str = ""

    @property
    def auth(self) -> dict[str, str]:  # Clerk session tokens are short-lived: mint a fresh one per call
        return {"Authorization": f"Bearer {mint(self.clerk_id)}"}


@dataclass
class World:
    client: TestClient
    clerk: FakeClerk
    admin: Account
    users: dict[str, Account] = field(default_factory=dict)

    def call(self, coro_fn, *args):  # run a coroutine on the app's event loop
        return self.client.portal.call(coro_fn, *args)

    def ticket(self, acct: Account) -> str:
        r = self.client.post(f"{API}/auth/ws-ticket", headers=acct.auth)
        assert r.status_code == 200, r.text
        return r.json()["ticket"]

    def make_user(self, name: str, *, enroll: bool = True, role: str | None = "user") -> Account:
        acct = Account(name, self.clerk.add_user(f"{name}@corp.test", role=role, first_name=name.title()))
        r = self.client.get(f"{API}/users/me", headers=acct.auth)  # first request provisions the local user
        assert r.status_code == 200, r.text
        acct.user_id = r.json()["id"]
        if enroll:
            acct.pub = make_spki()
            assert (
                self.client.put(f"{API}/users/me/key", headers=acct.auth, json={"publicKey": acct.pub}).status_code
                == 204
            )
        self.users[name] = acct
        return acct


@pytest.fixture(scope="session")
def world() -> Iterator[World]:
    env = {**os.environ}
    subprocess.run([sys.executable, "-m", "alembic", "downgrade", "base"], check=True, env=env, capture_output=True)
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True, env=env, capture_output=True)
    get_settings.cache_clear()
    clerk = FakeClerk()
    with TestClient(create_app(get_settings(), clerk=clerk, verifier=make_verifier())) as client:
        w = World(client, clerk, Account("root", clerk.add_user("root@corp.test", role="admin", first_name="Root")))
        r = client.get(f"{API}/users/me", headers=w.admin.auth)
        assert r.status_code == 200 and r.json()["role"] == "admin", r.text
        w.admin.user_id = r.json()["id"]
        for name in ("alice", "bob", "carol", "dave"):
            w.make_user(name)
        yield w


def recv_until(ws, kind: str, limit: int = 20) -> dict:
    for _ in range(limit):
        event = ws.receive_json()
        if event.get("t") == kind:
            return event
    raise AssertionError(f"never received {kind}")


def send_event(ws, conversation_id: str, key_version: int = 1, *, client_id: str | None = None, size: int = 40) -> str:
    cid = client_id or str(uuid.uuid4())
    ws.send_json(
        {
            "t": "message.send",
            "id": cid,
            "conversationId": conversation_id,
            "keyVersion": key_version,
            "ciphertext": b64(os.urandom(size)),
            "nonce": b64(os.urandom(12)),
        }
    )
    return cid


__all__ = ["API", "Account", "World", "asyncio", "b64", "grant", "make_spki", "recv_until", "send_event"]
