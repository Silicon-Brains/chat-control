from __future__ import annotations

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import and_, delete, func, literal_column, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Conversation,
    ConversationKey,
    ConversationMember,
    ConversationType,
    MemberRole,
    Message,
)


@dataclass(slots=True)
class ConversationView:
    conversation: Conversation
    my_role: MemberRole | None
    members: list[tuple[uuid.UUID, MemberRole]] = field(default_factory=list)
    has_current_key: bool | None = None
    unread_count: int = 0
    last_message_at: datetime | None = None


class ConversationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- conversations -------------------------------------------------------
    async def get(
        self, conversation_id: uuid.UUID, *, for_update: bool = False, for_share: bool = False
    ) -> Conversation | None:
        stmt = select(Conversation).where(Conversation.id == conversation_id)
        if for_update:
            stmt = stmt.with_for_update()
        elif for_share:
            stmt = stmt.with_for_update(read=True)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_direct_by_pair_key(self, pair_key: str) -> Conversation | None:
        stmt = select(Conversation).where(Conversation.direct_pair_key == pair_key)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    def add(self, conversation: Conversation) -> None:
        self.session.add(conversation)

    async def delete(self, conversation_id: uuid.UUID) -> None:
        await self.session.execute(delete(Conversation).where(Conversation.id == conversation_id))

    async def bump_key_version(self, conversation_id: uuid.UUID) -> int:
        stmt = (
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(current_key_version=Conversation.current_key_version + 1, rotation_required=False)
            .returning(Conversation.current_key_version)
        )
        return int((await self.session.execute(stmt)).scalar_one())

    async def set_rotation_required(self, conversation_ids: Iterable[uuid.UUID], value: bool = True) -> None:
        ids = list(conversation_ids)
        if ids:
            await self.session.execute(
                update(Conversation).where(Conversation.id.in_(ids)).values(rotation_required=value)
            )

    # --- membership ----------------------------------------------------------
    async def get_member(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> ConversationMember | None:
        stmt = select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == user_id
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def members(self, conversation_id: uuid.UUID) -> list[ConversationMember]:
        stmt = select(ConversationMember).where(ConversationMember.conversation_id == conversation_id)
        return list((await self.session.execute(stmt.order_by(ConversationMember.joined_at))).scalars())

    async def member_ids(self, conversation_id: uuid.UUID) -> list[uuid.UUID]:
        stmt = select(ConversationMember.user_id).where(ConversationMember.conversation_id == conversation_id)
        return list((await self.session.execute(stmt)).scalars())

    async def members_for_conversations(
        self, conversation_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, list[uuid.UUID]]:
        if not conversation_ids:
            return {}
        stmt = select(ConversationMember.conversation_id, ConversationMember.user_id).where(
            ConversationMember.conversation_id.in_(conversation_ids)
        )
        out: dict[uuid.UUID, list[uuid.UUID]] = {}
        for cid, uid in (await self.session.execute(stmt)).all():
            out.setdefault(cid, []).append(uid)
        return out

    def add_member(self, conversation_id: uuid.UUID, user_id: uuid.UUID, role: MemberRole) -> None:
        self.session.add(ConversationMember(conversation_id=conversation_id, user_id=user_id, role=role))

    async def remove_member(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self.session.execute(
            delete(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == user_id
            )
        )

    async def set_member_role(self, conversation_id: uuid.UUID, user_id: uuid.UUID, role: MemberRole) -> None:
        await self.session.execute(
            update(ConversationMember)
            .where(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == user_id)
            .values(role=role)
        )

    async def mark_read(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(ConversationMember)
            .where(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == user_id)
            .values(last_read_at=func.now())
        )

    async def memberships_of_user(self, user_id: uuid.UUID) -> list[tuple[uuid.UUID, ConversationType, MemberRole]]:
        stmt = (
            select(Conversation.id, Conversation.type, ConversationMember.role)
            .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
            .where(ConversationMember.user_id == user_id)
        )
        return [(cid, ctype, role) for cid, ctype, role in (await self.session.execute(stmt)).all()]

    # --- keys ------------------------------------------------------------------
    async def add_keys(
        self,
        conversation_id: uuid.UUID,
        key_version: int,
        grants: Iterable[tuple[uuid.UUID, bytes, bytes]],
    ) -> None:
        rows = [
            {
                "conversation_id": conversation_id,
                "user_id": uid,
                "key_version": key_version,
                "wrapped_key": wrapped,
                "wrapper_pub": wpub,
            }
            for uid, wrapped, wpub in grants
        ]
        if rows:
            await self.session.execute(pg_insert(ConversationKey).values(rows).on_conflict_do_nothing())

    async def keys_for_user(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> list[ConversationKey]:
        stmt = (
            select(ConversationKey)
            .where(ConversationKey.conversation_id == conversation_id, ConversationKey.user_id == user_id)
            .order_by(ConversationKey.key_version)
        )
        return list((await self.session.execute(stmt)).scalars())

    async def delete_keys_for_user(self, user_id: uuid.UUID, conversation_id: uuid.UUID | None = None) -> None:
        stmt = delete(ConversationKey).where(ConversationKey.user_id == user_id)
        if conversation_id:
            stmt = stmt.where(ConversationKey.conversation_id == conversation_id)
        await self.session.execute(stmt)

    async def users_missing_current_key(self, conversation_id: uuid.UUID, key_version: int) -> list[uuid.UUID]:
        has_key = select(ConversationKey.user_id).where(
            ConversationKey.conversation_id == conversation_id, ConversationKey.key_version == key_version
        )
        stmt = select(ConversationMember.user_id).where(
            ConversationMember.conversation_id == conversation_id, ConversationMember.user_id.not_in(has_key)
        )
        return list((await self.session.execute(stmt)).scalars())

    async def delete_superseded_keys(self) -> int:
        """Drop key versions older than current once no live message uses them."""
        still_used = (
            select(1)
            .where(
                Message.conversation_id == ConversationKey.conversation_id,
                Message.key_version == ConversationKey.key_version,
            )
            .exists()
        )
        superseded = (
            select(Conversation.id)
            .where(Conversation.id == ConversationKey.conversation_id)
            .where(Conversation.current_key_version > ConversationKey.key_version)
            .exists()
        )
        result = await self.session.execute(delete(ConversationKey).where(superseded, ~still_used))
        return result.rowcount or 0

    # --- read models -----------------------------------------------------------
    async def list_for_user(
        self, user_id: uuid.UUID, *, conversation_ids: Sequence[uuid.UUID] | None = None, limit: int = 500
    ) -> list[ConversationView]:
        stmt = (
            select(Conversation, ConversationMember.role)
            .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
            .where(ConversationMember.user_id == user_id)
            .order_by(Conversation.created_at.desc())
            .limit(limit)
        )
        if conversation_ids is not None:
            stmt = stmt.where(Conversation.id.in_(conversation_ids))
        rows = (await self.session.execute(stmt)).all()
        return await self._hydrate(user_id, [(c, r) for c, r in rows])

    async def list_broadcasts(self, *, limit: int = 500) -> list[ConversationView]:
        stmt = (
            select(Conversation)
            .where(Conversation.type == ConversationType.BROADCAST)
            .order_by(Conversation.created_at.desc())
            .limit(limit)
        )
        convs = list((await self.session.execute(stmt)).scalars())
        return await self._hydrate(None, [(c, None) for c in convs])

    async def _hydrate(
        self, user_id: uuid.UUID | None, rows: list[tuple[Conversation, MemberRole | None]]
    ) -> list[ConversationView]:
        if not rows:
            return []
        ids = [c.id for c, _ in rows]
        views = {c.id: ConversationView(conversation=c, my_role=role) for c, role in rows}

        member_rows = await self.session.execute(
            select(ConversationMember.conversation_id, ConversationMember.user_id, ConversationMember.role).where(
                ConversationMember.conversation_id.in_(ids)
            )
        )
        for cid, uid, role in member_rows.all():
            views[cid].members.append((uid, role))

        last_rows = await self.session.execute(
            select(Message.conversation_id, func.max(Message.created_at))
            .where(Message.conversation_id.in_(ids), Message.expires_at > func.now())
            .group_by(Message.conversation_id)
        )
        for cid, last in last_rows.all():
            views[cid].last_message_at = last

        if user_id is not None:
            cm = ConversationMember
            unread_rows = await self.session.execute(
                select(Message.conversation_id, func.count())
                .join(cm, and_(cm.conversation_id == Message.conversation_id, cm.user_id == user_id))
                .where(
                    Message.conversation_id.in_(ids),
                    Message.expires_at > func.now(),
                    Message.created_at > func.coalesce(cm.last_read_at, literal_column("'-infinity'::timestamptz")),
                    Message.sender_id != user_id,
                )
                .group_by(Message.conversation_id)
            )
            for cid, count in unread_rows.all():
                views[cid].unread_count = int(count)

            key_rows = await self.session.execute(
                select(ConversationKey.conversation_id)
                .join(Conversation, Conversation.id == ConversationKey.conversation_id)
                .where(
                    ConversationKey.user_id == user_id,
                    ConversationKey.conversation_id.in_(ids),
                    ConversationKey.key_version == Conversation.current_key_version,
                )
            )
            with_key = set(key_rows.scalars())
            for cid, view in views.items():
                view.has_current_key = cid in with_key
        return [views[c.id] for c, _ in rows]
