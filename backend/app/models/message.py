from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, LargeBinary, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import uuid7
from app.db.base import Base


class Message(Base):
    """Ciphertext-only message. ``expires_at`` is set by the DATABASE (10 h), never by clients."""

    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("octet_length(ciphertext) BETWEEN 16 AND 262144", name="ciphertext_size"),
        CheckConstraint("octet_length(nonce) = 12", name="nonce_size"),
        Index("ix_messages_conversation_history", "conversation_id", text("created_at DESC"), text("id DESC")),
        Index("ix_messages_conversation_updates", "conversation_id", "updated_at", "id"),
        Index("ix_messages_expires_at", "expires_at"),
        Index("ix_messages_conversation_key_version", "conversation_id", "key_version"),
        Index("ix_messages_sender_id", "sender_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    ciphertext: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    nonce: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    key_version: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now() + interval '10 hours'")
    )
