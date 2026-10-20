"""Mirrors Clerk identities into the local ``users`` table (JIT provisioning, role + approval sync)."""

from __future__ import annotations

import re
import secrets

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.container import Container
from app.core.errors import Forbidden, NotFound, Unauthorized
from app.integrations.clerk import ClerkUser
from app.models import User, UserRole, UserStatus
from app.repositories.audit import AuditRepository
from app.repositories.users import UserRepository
from app.services.common import utcnow

_NON_USERNAME = re.compile(r"[^a-z0-9_]+")


def derive_username(cu: ClerkUser) -> str:
    base = _NON_USERNAME.sub("_", (cu.username or (cu.email or "user").split("@")[0]).lower()).strip("_")
    base = (base + "_user")[:24] if len(base) < 3 else base[:24]
    return base


class IdentityService:
    def __init__(self, session: AsyncSession, container: Container) -> None:
        self.session = session
        self.c = container
        self.users = UserRepository(session)

    async def resolve(self, clerk_user_id: str, *, max_age: int | None = None) -> User:
        """Return the (fresh enough) local user for a verified Clerk user id."""
        max_age = self.c.settings.clerk_sync_ttl_seconds if max_age is None else max_age
        user = await self.users.get_by_clerk_id(clerk_user_id)
        if user and user.synced_at and (utcnow() - user.synced_at).total_seconds() < max_age:
            return self._ensure_active(user)
        try:
            cu = await self.c.clerk.get_user(clerk_user_id)
        except NotFound as exc:  # deleted in Clerk but token still valid for <60 s
            raise Unauthorized("Account no longer exists") from exc
        return self._ensure_active(await self.apply(cu, user))

    @staticmethod
    def _ensure_active(user: User) -> User:
        if user.status == UserStatus.PENDING:
            raise Forbidden("Your account is awaiting admin approval", code="APPROVAL_PENDING")
        if not user.is_active:
            raise Forbidden("This account is disabled", code="ACCOUNT_DISABLED")
        return user

    async def apply(self, cu: ClerkUser, user: User | None) -> User:
        """Create/update the local mirror; unapproved self-signups remain pending."""
        now = utcnow()
        if user is None:
            role = UserRole(cu.role) if cu.role else UserRole.USER
            status = (
                UserStatus.DISABLED
                if cu.banned or cu.locked
                else UserStatus.PENDING
                if cu.role is None or (role == UserRole.USER and not cu.email_verified)
                else UserStatus.ACTIVE
            )
            return await self._create(cu, role, status)

        if cu.role is None:
            # Removing metadata from an active account revokes its access. A pending
            # account stays pending until an administrator explicitly approves it.
            role = UserRole.USER
            status = (
                UserStatus.DISABLED
                if cu.banned or cu.locked or user.status == UserStatus.ACTIVE
                else user.status
            )
        else:
            role = UserRole(cu.role)
            status = (
                UserStatus.DISABLED
                if cu.banned or cu.locked
                else UserStatus.PENDING
                if role == UserRole.USER and not cu.email_verified
                else UserStatus.ACTIVE
            )
        user.role, user.status = role, status
        user.display_name, user.email = cu.display_name, cu.email
        user.synced_at = user.last_login_at = now
        await self.session.commit()
        return user

    async def _create(self, cu: ClerkUser, role: UserRole, status: UserStatus) -> User:
        now = utcnow()
        base = derive_username(cu)
        for attempt in range(6):
            username = base if attempt == 0 else f"{base[:19]}_{secrets.token_hex(2)}"
            user = User(
                username=username,
                display_name=cu.display_name,
                email=cu.email,
                clerk_user_id=cu.id,
                role=role,
                status=status,
                synced_at=now,
                last_login_at=now,
            )
            self.users.add(user)
            AuditRepository(self.session).add(
                "user.provision", actor_id=None, meta={"role": role.value, "status": status.value}
            )
            try:
                await self.session.commit()
                return user
            except IntegrityError:
                await self.session.rollback()
                existing = await self.users.get_by_clerk_id(cu.id)  # lost a first-login race
                if existing is not None:
                    return existing
        raise RuntimeError("could not allocate a unique username")
