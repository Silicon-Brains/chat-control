"""Opaque one-time tokens (WebSocket tickets). Credential handling lives in Clerk."""

from __future__ import annotations

import hashlib
import secrets


def hash_token(raw: str) -> bytes:
    """SHA-256 digest used to store one-time tickets (the raw value is never persisted)."""
    return hashlib.sha256(raw.encode()).digest()


def new_opaque_token(nbytes: int = 32) -> tuple[str, bytes]:
    raw = secrets.token_urlsafe(nbytes)
    return raw, hash_token(raw)
