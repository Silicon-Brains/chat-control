"""Clerk integration: session-token verification, Backend API client, webhook signatures.

* Authentication is delegated to Clerk. The API only ever sees Clerk *session tokens*
  (short-lived RS256 JWTs) and verifies them against Clerk's JWKS.
* Authorization data (role, ban state) comes from Clerk ``public_metadata`` / user state and is
  mirrored into our ``users`` table by ``IdentityService``.
"""

from __future__ import annotations

import asyncio
import base64
import contextlib
import hashlib
import hmac
import logging
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
import jwt
from jwt import PyJWKClient

from app.core.errors import AppError, NotFound, Unauthorized

log = logging.getLogger("app.clerk")
VALID_ROLES = ("user", "admin")


# --------------------------------------------------------------------------- tokens
@dataclass(frozen=True, slots=True)
class ClerkClaims:
    user_id: str
    session_id: str | None
    authorized_party: str | None


class ClerkTokenVerifier:
    """Verifies Clerk session JWTs (signature, issuer, expiry/nbf, authorized party)."""

    def __init__(
        self,
        issuer: str,
        *,
        jwks_url: str | None = None,
        authorized_parties: Sequence[str] = (),
        key_resolver: Callable[[str], Any] | None = None,
    ) -> None:
        self._issuer = issuer.rstrip("/")
        self._parties = {p.rstrip("/") for p in authorized_parties}
        if key_resolver is not None:  # tests / custom key sources
            self._resolve = key_resolver
        else:
            client = PyJWKClient(
                jwks_url or f"{self._issuer}/.well-known/jwks.json", cache_keys=True, lifespan=3600, timeout=5
            )
            self._resolve = lambda token: client.get_signing_key_from_jwt(token).key

    async def verify(self, token: str) -> ClerkClaims:
        try:
            key = await asyncio.to_thread(self._resolve, token)  # JWKS fetch is blocking I/O (cached)
            data = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=self._issuer,
                leeway=5,
                options={"verify_aud": False, "require": ["exp", "iat", "sub", "iss"]},
            )
        except jwt.exceptions.PyJWKClientConnectionError as exc:
            log.error("JWKS unreachable: %s", exc)
            raise AppError("Authentication provider unavailable", status_code=503, code="AUTH_UNAVAILABLE") from exc
        except (jwt.PyJWTError, ValueError) as exc:
            raise Unauthorized("Invalid or expired token") from exc
        if data.get("sts") == "pending":  # sign-in not fully completed (Clerk "session tasks")
            raise Unauthorized("Session is not active")
        azp = data.get("azp")
        if azp and self._parties and azp.rstrip("/") not in self._parties:
            raise Unauthorized("Token was issued for a different application")
        return ClerkClaims(str(data["sub"]), data.get("sid"), azp)


# ----------------------------------------------------------------------------- users
@dataclass(frozen=True, slots=True)
class ClerkUser:
    id: str
    username: str | None
    first_name: str | None
    last_name: str | None
    email: str | None
    role: str | None  # public_metadata.role, only "user"/"admin" are meaningful
    banned: bool
    locked: bool

    @property
    def display_name(self) -> str:
        full = " ".join(p for p in (self.first_name, self.last_name) if p).strip()
        return (full or self.username or (self.email or "user").split("@")[0])[:64]

    @classmethod
    def from_api(cls, d: dict[str, Any]) -> ClerkUser:
        primary = d.get("primary_email_address_id")
        emails = d.get("email_addresses") or []
        email = next((e.get("email_address") for e in emails if e.get("id") == primary), None) or (
            emails[0].get("email_address") if emails else None
        )
        role = (d.get("public_metadata") or {}).get("role")
        return cls(
            id=d["id"],
            username=d.get("username"),
            first_name=d.get("first_name"),
            last_name=d.get("last_name"),
            email=email,
            role=role if role in VALID_ROLES else None,
            banned=bool(d.get("banned")),
            locked=bool(d.get("locked")),
        )


@dataclass(frozen=True, slots=True)
class ClerkInvitation:
    id: str
    email: str
    status: str
    created_at: int  # epoch millis


class ClerkApi(Protocol):
    async def get_user(self, clerk_user_id: str) -> ClerkUser: ...
    async def find_user_by_email(self, email: str) -> ClerkUser | None: ...
    async def set_user_role(self, clerk_user_id: str, role: str) -> None: ...
    async def ban_user(self, clerk_user_id: str) -> None: ...
    async def unban_user(self, clerk_user_id: str) -> None: ...
    async def delete_user(self, clerk_user_id: str) -> None: ...
    async def revoke_user_sessions(self, clerk_user_id: str) -> int: ...
    async def create_invitation(self, email: str, *, role: str, redirect_url: str | None) -> ClerkInvitation: ...
    async def list_invitations(self, *, status: str = "pending", limit: int = 100) -> list[ClerkInvitation]: ...
    async def revoke_invitation(self, invitation_id: str) -> None: ...
    async def aclose(self) -> None: ...


class ClerkClient:
    """Thin httpx wrapper over the Clerk Backend API (https://clerk.com/docs/reference/backend-api)."""

    def __init__(self, secret_key: str, base_url: str = "https://api.clerk.com/v1", *, timeout: float = 8.0) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout,
            headers={"Authorization": f"Bearer {secret_key}", "User-Agent": "vaultchat-api"},
        )

    async def _request(self, method: str, path: str, **kw: Any) -> Any:
        try:
            resp = await self._http.request(method, path, **kw)
        except httpx.HTTPError as exc:
            log.error("clerk request failed: %s %s (%s)", method, path, type(exc).__name__)
            raise AppError("Authentication provider unavailable", status_code=502, code="UPSTREAM_UNAVAILABLE") from exc
        if resp.status_code == 404:
            raise NotFound("Not found at the authentication provider", code="UPSTREAM_NOT_FOUND")
        if resp.status_code >= 400:
            log.error("clerk error %s %s -> %s", method, path, resp.status_code)
            message = "Authentication provider rejected the request"
            if resp.status_code in (400, 409, 422):
                with contextlib.suppress(Exception):  # safe, human-readable validation text (e.g. duplicate invite)
                    message = resp.json()["errors"][0].get("long_message") or message
            raise AppError(
                message,
                status_code=409 if resp.status_code in (400, 409, 422) else 502,
                code="UPSTREAM_REJECTED" if resp.status_code < 500 else "UPSTREAM_ERROR",
            )
        return resp.json() if resp.content else None

    @staticmethod
    def _items(payload: Any) -> list[dict[str, Any]]:
        return payload if isinstance(payload, list) else (payload or {}).get("data", [])

    async def get_user(self, clerk_user_id: str) -> ClerkUser:
        return ClerkUser.from_api(await self._request("GET", f"/users/{clerk_user_id}"))

    async def find_user_by_email(self, email: str) -> ClerkUser | None:
        items = self._items(await self._request("GET", "/users", params={"email_address": email, "limit": 1}))
        return ClerkUser.from_api(items[0]) if items else None

    async def set_user_role(self, clerk_user_id: str, role: str) -> None:
        await self._request("PATCH", f"/users/{clerk_user_id}/metadata", json={"public_metadata": {"role": role}})

    async def ban_user(self, clerk_user_id: str) -> None:
        await self._request("POST", f"/users/{clerk_user_id}/ban")

    async def unban_user(self, clerk_user_id: str) -> None:
        await self._request("POST", f"/users/{clerk_user_id}/unban")

    async def delete_user(self, clerk_user_id: str) -> None:
        await self._request("DELETE", f"/users/{clerk_user_id}")

    async def revoke_user_sessions(self, clerk_user_id: str) -> int:
        sessions = self._items(
            await self._request("GET", "/sessions", params={"user_id": clerk_user_id, "status": "active"})
        )
        for s in sessions:
            await self._request("POST", f"/sessions/{s['id']}/revoke")
        return len(sessions)

    async def create_invitation(self, email: str, *, role: str, redirect_url: str | None) -> ClerkInvitation:
        body: dict[str, Any] = {
            "email_address": email,
            "public_metadata": {"role": role},
            "notify": True,
            "ignore_existing": False,
        }
        if redirect_url:
            body["redirect_url"] = redirect_url
        return self._invitation(await self._request("POST", "/invitations", json=body))

    async def list_invitations(self, *, status: str = "pending", limit: int = 100) -> list[ClerkInvitation]:
        data = await self._request("GET", "/invitations", params={"status": status, "limit": limit})
        return [self._invitation(i) for i in self._items(data)]

    async def revoke_invitation(self, invitation_id: str) -> None:
        await self._request("POST", f"/invitations/{invitation_id}/revoke")

    @staticmethod
    def _invitation(d: dict[str, Any]) -> ClerkInvitation:
        return ClerkInvitation(
            d["id"], d.get("email_address", ""), d.get("status", "pending"), int(d.get("created_at", 0))
        )

    async def aclose(self) -> None:
        await self._http.aclose()


# --------------------------------------------------------------------------- webhooks
WEBHOOK_TOLERANCE_SECONDS = 300


def verify_webhook(
    secret: str,
    *,
    body: bytes,
    msg_id: str | None,
    timestamp: str | None,
    signature: str | None,
    now: float | None = None,
) -> bool:
    """Svix signature check (Clerk webhooks): HMAC-SHA256 over ``id.timestamp.body``, 5 min tolerance."""
    if not (secret and msg_id and timestamp and signature):
        return False
    try:
        ts = int(timestamp)
        key = base64.b64decode(secret.removeprefix("whsec_"))
    except ValueError:
        return False
    if abs((now if now is not None else time.time()) - ts) > WEBHOOK_TOLERANCE_SECONDS:
        return False
    expected = base64.b64encode(
        hmac.new(key, f"{msg_id}.{timestamp}.".encode() + body, hashlib.sha256).digest()
    ).decode()
    return any(
        hmac.compare_digest(expected, part.split(",", 1)[1])
        for part in signature.split()
        if part.startswith("v1,") and "," in part
    )
