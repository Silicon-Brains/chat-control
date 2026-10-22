from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserStatus, WsTicket


class TokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- one-time WebSocket tickets -----------------------------------------
    def add_ticket(self, token_hash: bytes, user_id: uuid.UUID, expires_at: datetime) -> None:
        self.session.add(WsTicket(token_hash=token_hash, user_id=user_id, expires_at=expires_at))

    async def consume_ticket(self, token_hash: bytes) -> uuid.UUID | None:
        """Atomically consume a ticket and return its active owner in one query."""
        consumed = (
            delete(WsTicket)
            .where(WsTicket.token_hash == token_hash, WsTicket.expires_at > func.now())
            .returning(WsTicket.user_id)
            .cte("consumed_ticket")
        )
        stmt = select(User.id).join(consumed, consumed.c.user_id == User.id).where(User.status == UserStatus.ACTIVE)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def delete_expired_tickets(self) -> int:
        result = await self.session.execute(delete(WsTicket).where(WsTicket.expires_at <= func.now()))
        return result.rowcount or 0
