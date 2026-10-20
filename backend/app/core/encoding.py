"""Strict base64 helpers and fingerprints."""

from __future__ import annotations

import base64
import binascii
import hashlib


def b64decode_strict(value: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("invalid base64") from exc


def b64encode(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def fingerprint(public_key_der: bytes) -> str:
    """SHA-256 fingerprint, grouped for human comparison: ``AB12 CD34 ...``."""
    digest = hashlib.sha256(public_key_der).hexdigest().upper()
    return " ".join(digest[i : i + 4] for i in range(0, 32, 4))
