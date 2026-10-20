from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserRole, UserStatus


def _like_escape(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, user_id: uuid.UUID, *, for_update: bool = False) -> User | None:
        stmt = select(User).where(User.id == user_id)
        if for_update:
            stmt = stmt.with_for_update()
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_by_clerk_id(self, clerk_user_id: str, *, for_update: bool = False) -> User | None:
        stmt = select(User).where(User.clerk_user_id == clerk_user_id)
        if for_update:
            stmt = stmt.with_for_update()
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_by_username(self, username: str, *, for_update: bool = False) -> User | None:
        stmt = select(User).where(User.username == username)
        if for_update:
            stmt = stmt.with_for_update()
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_many(self, ids: Sequence[uuid.UUID]) -> list[User]:
        if not ids:
            return []
        return list((await self.session.execute(select(User).where(User.id.in_(ids)))).scalars())

    def add(self, user: User) -> None:
        self.session.add(user)

    async def delete(self, user_id: uuid.UUID) -> None:
        await self.session.execute(delete(User).where(User.id == user_id))

    async def list_page(
        self,
        *,
        q: str | None,
        status: UserStatus | None,
        role: UserRole | None,
        after_id: uuid.UUID | None,
        limit: int,
    ) -> list[User]:
        stmt = select(User).order_by(User.id).limit(limit + 1)
        if after_id:
            stmt = stmt.where(User.id > after_id)
        if status:
            stmt = stmt.where(User.status == status)
        if role:
            stmt = stmt.where(User.role == role)
        if q:
            pattern = f"%{_like_escape(q.lower())}%"
            stmt = stmt.where(User.username.like(pattern, escape="\\") | User.display_name.ilike(pattern, escape="\\"))
        return list((await self.session.execute(stmt)).scalars())

    async def directory_page(self, *, q: str | None, after_id: uuid.UUID | None, limit: int) -> list[User]:
        return await self.list_page(q=q, status=UserStatus.ACTIVE, role=UserRole.USER, after_id=after_id, limit=limit)

    async def counts(self) -> dict[str, int]:
        rows = (
            await self.session.execute(
                select(User.status, func.count()).where(User.role == UserRole.USER).group_by(User.status)
            )
        ).all()
        by_status = {str(status): count for status, count in rows}
        return {
            "active": by_status.get("active", 0),
            "disabled": by_status.get("disabled", 0),
            "total": sum(by_status.values()),
        }
