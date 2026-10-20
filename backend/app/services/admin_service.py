"""Admin-only operations. Accounts live in Clerk; admins invite, ban/unban, delete and reset E2EE keys.

Admins can manage accounts but never read message content (they only ever see ciphertext metadata counts).
"""

from __future__ import annotations

import contextlib
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.container import Container
from app.core.errors import Conflict, NotFound
from app.integrations.clerk import ClerkInvitation
from app.models import AuditLog, User, UserRole, UserStatus
from app.repositories.audit import AuditRepository
from app.repositories.messages import MessageRepository
from app.repositories.users import UserRepository
from app.schemas.user import AdminStats
from app.services.chat_service import ChatService
from app.services.common import parse_uuid_cursor, utcnow


class AdminService:
    def __init__(self, session: AsyncSession, container: Container) -> None:
        self.session = session
        self.c = container
        self.users = UserRepository(session)
        self.audit = AuditRepository(session)
        self.msgs = MessageRepository(session)
        self.chat = ChatService(session, container)

    async def _target(self, user_id: uuid.UUID) -> User:
        user = await self.users.get(user_id, for_update=True)
        if user is None:
            raise NotFound("User not found", code="USER_NOT_FOUND")
        if user.role != UserRole.USER:
            raise Conflict("Admin accounts are managed in the Clerk dashboard", code="ADMIN_PROTECTED")
        return user

    # -------------------------------------------------------------- invitations
    async def invite(self, actor: User, *, email: str, ip: str) -> ClerkInvitation:
        invitation = await self.c.clerk.create_invitation(
            email.strip().lower(), role="user", redirect_url=self.c.settings.invitation_redirect_url
        )
        self.audit.add("user.invite", actor_id=actor.id, ip=ip, meta={"email": email.strip().lower()})
        await self.session.commit()
        return invitation

    async def list_invitations(self) -> list[ClerkInvitation]:
        return await self.c.clerk.list_invitations()

    async def revoke_invitation(self, actor: User, invitation_id: str, *, ip: str) -> None:
        await self.c.clerk.revoke_invitation(invitation_id)
        self.audit.add("invitation.revoke", actor_id=actor.id, ip=ip, meta={"invitation": invitation_id})
        await self.session.commit()

    # -------------------------------------------------------------------- users
    async def list_users(
        self, *, q: str | None, status: UserStatus | None, cursor: str | None, limit: int
    ) -> tuple[list[User], str | None]:
        rows = await self.users.list_page(
            q=q, status=status, role=UserRole.USER, after_id=parse_uuid_cursor(cursor), limit=limit
        )
        return rows[:limit], (str(rows[limit - 1].id) if len(rows) > limit else None)

    async def approve_user(self, actor: User, user_id: uuid.UUID, *, ip: str) -> User:
        user = await self._target(user_id)
        if user.status != UserStatus.PENDING:
            raise Conflict("Only pending users can be approved", code="USER_NOT_PENDING")
        clerk_user = await self.c.clerk.get_user(user.clerk_user_id)
        if clerk_user.role == UserRole.ADMIN.value:
            raise Conflict("Admin accounts are managed separately", code="ADMIN_PROTECTED")
        if clerk_user.banned or clerk_user.locked:
            raise Conflict("This Clerk account is banned or locked", code="ACCOUNT_DISABLED")
        if not clerk_user.email_verified:
            raise Conflict("Verify the account email before approval", code="EMAIL_NOT_VERIFIED")
        await self.c.clerk.set_user_role(user.clerk_user_id, UserRole.USER.value)
        user.role = UserRole.USER
        user.status = UserStatus.ACTIVE
        user.synced_at = utcnow()
        self.audit.add("user.approve", actor_id=actor.id, target_id=user.id, ip=ip)
        await self.session.commit()
        return user

    async def set_status(self, actor: User, user_id: uuid.UUID, *, status: str, ip: str) -> User:
        """Ban/unban in Clerk first (source of truth), then mirror locally and cut live connections."""
        user = await self._target(user_id)
        if user.status == UserStatus.PENDING:
            raise Conflict("Pending users must be approved or deleted", code="USER_NOT_PENDING")
        disable = UserStatus(status) == UserStatus.DISABLED
        if disable:
            await self.c.clerk.ban_user(user.clerk_user_id)
            await self.c.clerk.revoke_user_sessions(user.clerk_user_id)
        else:
            clerk_user = await self.c.clerk.get_user(user.clerk_user_id)
            if clerk_user.role != user.role.value:
                raise Conflict("This account is not approved in Clerk", code="USER_NOT_APPROVED")
            await self.c.clerk.unban_user(user.clerk_user_id)
        user.status = UserStatus.DISABLED if disable else UserStatus.ACTIVE
        user.synced_at = utcnow()
        self.audit.add("user.disable" if disable else "user.enable", actor_id=actor.id, target_id=user.id, ip=ip)
        await self.session.commit()
        if disable:
            await self.c.hub.disconnect_user(user.id)
        return user

    async def reset_key(self, actor: User, user_id: uuid.UUID, *, ip: str) -> None:
        """Lost device: forget the user's public key so they can enrol a new one. Their direct chats are
        deleted and their wrapped keys removed from groups/broadcasts (flagged ``rotationRequired``)."""
        user = await self._target(user_id)
        user.public_key = None
        user.key_fingerprint = None
        await self.chat.detach_user(user.id, remove_membership=False)
        self.audit.add("user.reset_key", actor_id=actor.id, target_id=user.id, ip=ip)
        await self.session.commit()
        await self.c.hub.disconnect_user(user.id)
        await self.chat.flush_notifications()

    async def revoke_sessions(self, actor: User, user_id: uuid.UUID, *, ip: str) -> int:
        user = await self._target(user_id)
        count = await self.c.clerk.revoke_user_sessions(user.clerk_user_id)
        self.audit.add("user.revoke_sessions", actor_id=actor.id, target_id=user.id, ip=ip, meta={"count": count})
        await self.session.commit()
        await self.c.hub.disconnect_user(user.id)
        return count

    async def delete_user(self, actor: User, user_id: uuid.UUID, *, ip: str) -> None:
        user = await self._target(user_id)
        with contextlib.suppress(NotFound):  # already gone in Clerk; Clerk first so it can't re-provision
            await self.c.clerk.delete_user(user.clerk_user_id)
        self.audit.add("user.delete", actor_id=actor.id, target_id=user.id, ip=ip, meta={"username": user.username})
        await self._delete_local(user)

    async def delete_local_by_clerk_id(self, clerk_user_id: str) -> None:
        """Webhook path (``user.deleted``): Clerk already removed the account."""
        user = await self.users.get_by_clerk_id(clerk_user_id, for_update=True)
        if user is not None:
            self.audit.add("user.delete", target_id=user.id, meta={"username": user.username, "via": "webhook"})
            await self._delete_local(user)

    async def _delete_local(self, user: User) -> None:
        user_id = user.id
        await self.chat.detach_user(user_id, remove_membership=True)
        await self.users.delete(user_id)
        await self.session.commit()
        await self.c.hub.disconnect_user(user_id)
        await self.chat.flush_notifications()

    # ------------------------------------------------------------- audit/stats
    async def audit_page(
        self, *, cursor: str | None, action: str | None, limit: int
    ) -> tuple[list[AuditLog], str | None]:
        before = None
        if cursor:
            try:
                before = int(cursor)
            except ValueError:
                from app.core.errors import ValidationFailed

                raise ValidationFailed("Invalid cursor") from None
        rows = await self.audit.list_page(before_id=before, action=action, limit=limit)
        return rows[:limit], (str(rows[limit - 1].id) if len(rows) > limit else None)

    async def stats(self) -> AdminStats:
        counts = await self.users.counts()
        state = self.c.purge_state
        return AdminStats(
            users_total=counts["total"],
            users_pending=counts["pending"],
            users_active=counts["active"],
            users_disabled=counts["disabled"],
            live_messages=await self.msgs.count_live(),
            ws_connections=self.c.hub.connection_count,
            conversations_total=await self.chat.count_conversations(),
            last_purge_at=state.last_run_at,
            last_purge_deleted=state.last_deleted,
        )
