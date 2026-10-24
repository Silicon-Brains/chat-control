from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.base import CamelModel, b64_bytes

Ciphertext = b64_bytes(16, 262_144)  # AES-GCM tag alone is 16 bytes; includes encrypted voice notes.
Nonce = b64_bytes(12, 12)


class MessageOut(CamelModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    ciphertext: Ciphertext | None
    nonce: Nonce | None
    key_version: int
    created_at: datetime
    expires_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class MessageCreate(CamelModel):
    id: uuid.UUID
    ciphertext: Ciphertext
    nonce: Nonce
    key_version: int = Field(ge=1)


class MessageUpdate(CamelModel):
    ciphertext: Ciphertext
    nonce: Nonce
    key_version: int = Field(ge=1)


class MessagePage(CamelModel):
    items: list[MessageOut]
    next_cursor: str | None = None


