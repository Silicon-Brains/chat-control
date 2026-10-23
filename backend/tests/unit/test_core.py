import base64
import hashlib
import hmac
import time

import pytest

from app.core.config import Settings, build_async_database_url
from app.core.errors import RateLimited
from app.core.ids import uuid7
from app.core.rate_limit import InMemoryRateLimiter, enforce, ensure_not_blocked
from app.core.request import client_ip

BASE = dict(database_url="postgresql://u:p@h/db", clerk_secret_key="sk_test_x", clerk_issuer="https://c.example.com")


def test_neon_url_is_translated_for_asyncpg() -> None:
    url, args = build_async_database_url(
        "postgresql://u:p@ep-x-pooler.neon.tech/db?sslmode=require&channel_binding=require"
    )
    assert url.drivername == "postgresql+asyncpg" and not url.query
    assert "ssl" in args and args["statement_cache_size"] == 0
    _, args = build_async_database_url("postgresql://u:p@localhost/db?sslmode=disable", force_ssl=True)
    assert "ssl" not in args


def test_settings_validation_and_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValueError):
        Settings(**{**BASE, "env": "production", "allowed_origins": "*"})
    with pytest.raises(ValueError):
        Settings(**{**BASE, "env": "production", "enable_docs": True})
    monkeypatch.delenv("CLERK_SECRET_KEY")  # Clerk credentials are mandatory
    with pytest.raises(ValueError):
        Settings(**{k: v for k, v in BASE.items() if k != "clerk_secret_key"})  # type: ignore[arg-type]
    s = Settings(**BASE, allowed_origins="https://a.com/, https://b.com")
    assert s.origins == ["https://a.com", "https://b.com"]
    assert s.authorized_parties == s.origins  # azp defaults to the allowed origins
    s = Settings(**BASE, admin_ip_allowlist="192.0.2.10, 2001:db8::/32")
    assert [str(network) for network in s.admin_networks] == ["192.0.2.10/32", "2001:db8::/32"]
    with pytest.raises(ValueError, match="ADMIN_IP_ALLOWLIST"):
        Settings(**BASE, admin_ip_allowlist="c916b7874530e4ed641a2211eb82cf6d")


def test_uuid7_is_time_ordered() -> None:
    ids = [uuid7() for _ in range(50)]
    assert all(i.version == 7 for i in ids)
    assert [i.int >> 80 for i in ids] == sorted(i.int >> 80 for i in ids)


async def test_rate_limiter() -> None:
    rl = InMemoryRateLimiter()
    for _ in range(3):
        await enforce(rl, "k", 3, 60)
    with pytest.raises(RateLimited) as exc:
        await enforce(rl, "k", 3, 60)
    assert exc.value.headers["Retry-After"]
    await rl.incr("blk", 60)
    await ensure_not_blocked(rl, "blk", 2)
    await rl.incr("blk", 60)
    with pytest.raises(RateLimited):
        await ensure_not_blocked(rl, "blk", 2)


class _Conn:
    def __init__(self, xff: str | None, host: str = "10.0.0.9") -> None:
        self.headers = {"x-forwarded-for": xff} if xff else {}
        self.client = type("C", (), {"host": host})()


def test_client_ip_is_spoof_resistant() -> None:
    assert client_ip(_Conn("1.1.1.1, 203.0.113.7"), trust_proxy=True, proxy_count=1) == "203.0.113.7"
    assert client_ip(_Conn("1.1.1.1, 203.0.113.7"), trust_proxy=False, proxy_count=1) == "10.0.0.9"
    assert client_ip(_Conn("garbage"), trust_proxy=True, proxy_count=1) == "0.0.0.0"


def _sign(secret: str, msg_id: str, ts: str, body: bytes) -> str:
    key = base64.b64decode(secret.removeprefix("whsec_"))
    return "v1," + base64.b64encode(hmac.new(key, f"{msg_id}.{ts}.".encode() + body, hashlib.sha256).digest()).decode()


def test_webhook_signature() -> None:
    from app.integrations.clerk import verify_webhook

    secret = "whsec_" + base64.b64encode(b"k" * 24).decode()
    body, ts = b'{"type":"user.updated"}', str(int(time.time()))
    good = _sign(secret, "msg_1", ts, body)
    kw = dict(body=body, msg_id="msg_1", timestamp=ts)
    assert verify_webhook(secret, signature=good, **kw)
    assert verify_webhook(secret, signature=f"v1,AAAA {good}", **kw)  # rotated secrets list several sigs
    assert not verify_webhook(secret, signature=good, body=body + b" ", msg_id="msg_1", timestamp=ts)
    assert not verify_webhook(secret, signature="v1,AAAA", **kw)
    assert not verify_webhook(secret, signature=None, **kw)
    old = str(int(time.time()) - 3600)
    assert not verify_webhook(
        secret, signature=_sign(secret, "msg_1", old, body), body=body, msg_id="msg_1", timestamp=old
    )
