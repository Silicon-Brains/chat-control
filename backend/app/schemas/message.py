from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import Field, TypeAdapter

from app.core.encoding import b64encode
from app.schemas.base import CamelModel, b64_bytes

Ciphertext = b64_bytes(16, 262_144)  # AES-GCM tag alone is 16 bytes; includes encrypted voice notes.
Nonce = b64_bytes(12, 12)


class MessageOut(CamelModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    ciphertext: Ciphertext
    nonce: Nonce
    key_version: int
    created_at: datetime
    expires_at: datetime


class MessagePage(CamelModel):
    items: list[MessageOut]
    next_cursor: str | None = None


# --- WebSocket inbound events -------------------------------------------------


class WsMessageSend(CamelModel):
    t: Literal["message.send"]
    conversation_id: uuid.UUID
    ciphertext: Ciphertext
    nonce: Nonce
    key_version: int = Field(ge=1)
    id: uuid.UUID | None = None  # client-generated id => idempotent retries


class WsConversationRead(CamelModel):
    t: Literal["conversation.read"]
    conversation_id: uuid.UUID


class WsPing(CamelModel):
    t: Literal["ping"]


WsInbound = Annotated[WsMessageSend | WsConversationRead | WsPing, Field(discriminator="t")]
ws_inbound_adapter: TypeAdapter[WsInbound] = TypeAdapter(WsInbound)


# --- WebSocket outbound events ------------------------------------------------


def message_new_event(msg: Any) -> dict[str, Any]:
    return {
        "t": "message.new",
        "id": str(msg.id),
        "conversationId": str(msg.conversation_id),
        "senderId": str(msg.sender_id),
        "ciphertext": b64encode(msg.ciphertext),
        "nonce": b64encode(msg.nonce),
        "keyVersion": msg.key_version,
        "createdAt": msg.created_at.isoformat(),
        "expiresAt": msg.expires_at.isoformat(),
    }
