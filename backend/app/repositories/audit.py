from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


class AuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(
        self,
        action: str,
        *,
        actor_id: uuid.UUID | None = None,
        target_id: uuid.UUID | None = None,
        ip: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> None:
        self.session.add(AuditLog(action=action, actor_id=actor_id, target_id=target_id, ip=ip, meta=meta))

    async def list_page(self, *, before_id: int | None, action: str | None, limit: int) -> list[AuditLog]:
        stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit + 1)
        if before_id:
            stmt = stmt.where(AuditLog.id < before_id)
        if action:
            stmt = stmt.where(AuditLog.action == action)
        return list((await self.session.execute(stmt)).scalars())

    async def count_since(self, actions: list[str], since: datetime) -> int:
        stmt = (
            select(func.count()).select_from(AuditLog).where(AuditLog.action.in_(actions), AuditLog.created_at >= since)
        )
        return int((await self.session.execute(stmt)).scalar_one())

    async def delete_older_than(self, cutoff: datetime) -> int:
        result = await self.session.execute(delete(AuditLog).where(AuditLog.created_at < cutoff))
        return result.rowcount or 0
