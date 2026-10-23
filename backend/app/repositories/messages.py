from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, func, select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Message


@dataclass(frozen=True, slots=True)
class StoredMessage:
    """Plain, session-independent view of a persisted message (safe to use after the session closes)."""

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    ciphertext: bytes
    nonce: bytes
    key_version: int
    created_at: datetime
    expires_at: datetime

    @classmethod
    def from_row(cls, m: Message) -> StoredMessage:
        return cls(
            m.id, m.conversation_id, m.sender_id, m.ciphertext, m.nonce, m.key_version, m.created_at, m.expires_at
        )


class MessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def insert(
        self,
        *,
        message_id: uuid.UUID,
        conversation_id: uuid.UUID,
        sender_id: uuid.UUID,
        ciphertext: bytes,
        nonce: bytes,
        key_version: int,
    ) -> StoredMessage | None:
        """Insert; ``expires_at``/``created_at`` come from DB defaults.

        Returns ``None`` when ``message_id`` already exists (idempotent retry).
        """
        stmt = (
            pg_insert(Message)
            .values(
                id=message_id,
                conversation_id=conversation_id,
                sender_id=sender_id,
                ciphertext=ciphertext,
                nonce=nonce,
                key_version=key_version,
            )
            .on_conflict_do_nothing(index_elements=[Message.id])
            .returning(Message.created_at, Message.expires_at)
        )
        row = (await self.session.execute(stmt)).one_or_none()
        if row is None:
            return None
        return StoredMessage(message_id, conversation_id, sender_id, ciphertext, nonce, key_version, row[0], row[1])

    async def get(self, message_id: uuid.UUID) -> StoredMessage | None:
        row = (await self.session.execute(select(Message).where(Message.id == message_id))).scalar_one_or_none()
        return StoredMessage.from_row(row) if row else None

    async def history(
        self,
        conversation_id: uuid.UUID,
        *,
        before: tuple[datetime, uuid.UUID] | None,
        limit: int,
    ) -> list[Message]:
        """Newest-first keyset page. Expired rows are NEVER returned (even if purge lags)."""
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id, Message.expires_at > func.now())
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(limit + 1)
        )
        if before:
            stmt = stmt.where(tuple_(Message.created_at, Message.id) < tuple_(before[0], before[1]))
        return list((await self.session.execute(stmt)).scalars())

    async def updates(
        self,
        conversation_id: uuid.UUID,
        *,
        after: tuple[datetime, uuid.UUID] | None,
        limit: int,
    ) -> list[Message]:
        """Return only newer, live messages in ascending order for efficient polling."""
        stmt = select(Message).where(Message.conversation_id == conversation_id, Message.expires_at > func.now())
        if after:
            stmt = stmt.where(tuple_(Message.created_at, Message.id) > tuple_(after[0], after[1]))
        stmt = stmt.order_by(Message.created_at, Message.id).limit(limit)
        return list((await self.session.execute(stmt)).scalars())

    async def delete_expired_batch(self, limit: int) -> list[tuple[uuid.UUID, uuid.UUID]]:
        victims = (
            select(Message.id)
            .where(Message.expires_at <= func.now())
            .order_by(Message.expires_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        stmt = delete(Message).where(Message.id.in_(victims)).returning(Message.id, Message.conversation_id)
        return [(mid, cid) for mid, cid in (await self.session.execute(stmt)).all()]

    async def count_live(self) -> int:
        stmt = select(func.count()).select_from(Message).where(Message.expires_at > func.now())
        return int((await self.session.execute(stmt)).scalar_one())
