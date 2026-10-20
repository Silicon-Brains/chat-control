from __future__ import annotations

import base64
import uuid
from datetime import UTC, datetime

from app.core.errors import ValidationFailed


def utcnow() -> datetime:
    return datetime.now(UTC)


def encode_cursor(created_at: datetime, item_id: uuid.UUID) -> str:
    raw = f"{created_at.isoformat()}|{item_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        ts, _, ident = base64.urlsafe_b64decode(padded.encode()).decode().partition("|")
        return datetime.fromisoformat(ts), uuid.UUID(ident)
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValidationFailed("Invalid cursor") from exc


def parse_uuid_cursor(cursor: str | None) -> uuid.UUID | None:
    if not cursor:
        return None
    try:
        return uuid.UUID(cursor)
    except ValueError as exc:
        raise ValidationFailed("Invalid cursor") from exc
