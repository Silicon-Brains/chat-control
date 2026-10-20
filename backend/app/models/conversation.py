from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    PrimaryKeyConstraint,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import uuid7
from app.db.base import Base
from app.models.enums import ConversationType, MemberRole, pg_enum


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        CheckConstraint(
            "(type = 'direct' AND direct_pair_key IS NOT NULL AND name IS NULL) OR "
            "(type <> 'direct' AND direct_pair_key IS NULL AND name IS NOT NULL)",
            name="shape",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    type: Mapped[ConversationType] = mapped_column(pg_enum(ConversationType, "conversation_type"), nullable=False)
    name: Mapped[str | None] = mapped_column(String(100))
    group_icon: Mapped[str | None] = mapped_column(String(16))
    direct_pair_key: Mapped[str | None] = mapped_column(String(73), unique=True)
    current_key_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    rotation_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ConversationMember(Base):
    __tablename__ = "conversation_members"
    __table_args__ = (
        PrimaryKeyConstraint("conversation_id", "user_id", name="pk_conversation_members"),
        Index("ix_conversation_members_user_id", "user_id"),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[MemberRole] = mapped_column(
        pg_enum(MemberRole, "member_role"), nullable=False, default=MemberRole.MEMBER, server_default="member"
    )
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ConversationKey(Base):
    __tablename__ = "conversation_keys"
    __table_args__ = (
        PrimaryKeyConstraint("conversation_id", "user_id", "key_version", name="pk_conversation_keys"),
        Index("ix_conversation_keys_user_id", "user_id"),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    key_version: Mapped[int] = mapped_column(Integer, nullable=False)
    wrapped_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    wrapper_pub: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
