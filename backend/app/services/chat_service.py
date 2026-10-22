"""Conversations, membership, key distribution and message persistence.

The server only ever handles ciphertext and *wrapped* keys. Every mutating
operation re-checks authorization against the database (never trusts the client).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.container import Container
from app.core.errors import Conflict, Forbidden, NotFound, ValidationFailed
from app.core.ids import uuid7
from app.models import (
    Conversation,
    ConversationKey,
    ConversationType,
    MemberRole,
    User,
    UserRole,
)
from app.repositories.audit import AuditRepository
from app.repositories.conversations import ConversationRepository, ConversationView
from app.repositories.messages import MessageRepository, StoredMessage
from app.repositories.users import UserRepository
from app.schemas.conversation import (
    AddMembersRequest,
    ConversationKeyOut,
    ConversationOut,
    CreateConversationRequest,
    GrantKeysRequest,
    KeyGrant,
    MemberOut,
    RemoveMemberRequest,
    RotateKeyRequest,
    UpdateGroupRequest,
)
from app.services.common import decode_cursor, encode_cursor


def view_to_out(view: ConversationView) -> ConversationOut:
    c = view.conversation
    return ConversationOut(
        id=c.id,
        type=c.type.value,
        name=c.name,
        group_icon=c.group_icon,
        current_key_version=c.current_key_version,
        rotation_required=c.rotation_required,
        created_at=c.created_at,
        members=[
            MemberOut(user_id=uid, role=role.value, display_name=name, management_verified=verified)
            for uid, role, name, verified in view.members
        ],
        keys=[
            ConversationKeyOut(key_version=version, wrapped_key=wrapped, wrapper_pub=wrapper)
            for version, wrapped, wrapper in view.keys
        ],
        my_role=view.my_role.value if view.my_role else None,
        has_current_key=view.has_current_key,
        unread_count=view.unread_count,
        last_message_at=view.last_message_at,
    )


@dataclass(slots=True)
class SendResult:
    message: StoredMessage
    duplicate: bool
    member_ids: list[uuid.UUID]


class ChatService:
    def __init__(self, session: AsyncSession, container: Container) -> None:
        self.session = session
        self.c = container
        self.s = container.settings
        self.convs = ConversationRepository(session)
        self.msgs = MessageRepository(session)
        self.users = UserRepository(session)
        self.audit = AuditRepository(session)
        self._pending: list[tuple[list[uuid.UUID], dict]] = []

    # ------------------------------------------------------------------ helpers
    async def _require_member(self, cid: uuid.UUID, user: User):  # type: ignore[no-untyped-def]
        member = await self.convs.get_member(cid, user.id)
        if member is None:  # same answer for "missing" and "not yours" -> no existence oracle
            raise NotFound("Conversation not found", code="CONVERSATION_NOT_FOUND")
        return member

    async def _locked_conversation(self, cid: uuid.UUID, user: User, *, owner_only: bool = False) -> Conversation:
        conv = await self.convs.get(cid, for_update=True)
        member = await self.convs.get_member(cid, user.id) if conv else None
        if conv is None or member is None:
            raise NotFound("Conversation not found", code="CONVERSATION_NOT_FOUND")
        if owner_only and member.role != MemberRole.OWNER:
            raise Forbidden("Only the owner can do this", code="NOT_OWNER")
        return conv

    @staticmethod
    def _check_version(conv: Conversation, expected: int) -> None:
        if conv.current_key_version != expected:
            raise Conflict(
                "Key version is stale; refetch the conversation",
                code="KEY_VERSION_STALE",
                details={"currentKeyVersion": conv.current_key_version},
            )

    async def _notify(self, user_ids, payload: dict) -> None:  # type: ignore[no-untyped-def]
        await self.c.hub.publish(user_ids, payload)

    async def _enrolled_users(self, ids: list[uuid.UUID]) -> dict[uuid.UUID, User]:
        found = {u.id: u for u in await self.users.get_many(ids)}
        if len(found) != len(set(ids)):
            raise NotFound("One or more users were not found", code="MEMBER_NOT_FOUND")
        return found

    @staticmethod
    def _assert_assignable(user: User) -> None:
        if not user.is_active:
            raise Conflict("User is disabled", code="MEMBER_DISABLED", details={"userId": str(user.id)})
        if user.public_key is None:
            raise Conflict(
                "User has not completed key setup", code="MEMBER_NOT_ENROLLED", details={"userId": str(user.id)}
            )

    # ------------------------------------------------------------------- create
    async def create(self, creator: User, req: CreateConversationRequest) -> tuple[Conversation, bool]:
        ctype = ConversationType(req.type)
        is_admin = creator.role == UserRole.ADMIN
        if ctype == ConversationType.BROADCAST and not is_admin:
            raise Forbidden("Only admins can create broadcast channels", code="ADMIN_ONLY")
        if ctype == ConversationType.DIRECT and is_admin:
            raise Forbidden("Admins cannot start direct chats", code="ADMIN_CANNOT_CHAT")
        if ctype == ConversationType.GROUP and not is_admin and not self.s.allow_user_group_creation:
            raise Forbidden("Only admins can create groups", code="ADMIN_ONLY")
        self._assert_assignable(creator)

        grants = {m.user_id: m for m in req.members}
        if len(grants) != len(req.members):
            raise ValidationFailed("Duplicate members")
        if creator.id not in grants:
            raise ValidationFailed("The creator must be included in members with a wrapped key")
        if len(grants) < 2:
            raise ValidationFailed("A conversation needs at least two members")
        if ctype == ConversationType.DIRECT and len(grants) != 2:
            raise ValidationFailed("Direct conversations have exactly two members")
        if len(grants) > self.s.max_group_size:
            raise ValidationFailed(f"At most {self.s.max_group_size} members are allowed")
        if ctype != ConversationType.BROADCAST and any(m.role == "sender" for m in req.members):
            raise ValidationFailed("The sender role only exists in broadcast channels")

        users = await self._enrolled_users(list(grants))
        for uid, u in users.items():
            if uid != creator.id and u.role != UserRole.USER:
                raise ValidationFailed("Only regular users can be added as members")
            self._assert_assignable(u)

        pair_key = None
        if ctype == ConversationType.DIRECT:
            a, b = sorted(str(i) for i in grants)
            pair_key = f"{a}:{b}"
            existing = await self.convs.get_direct_by_pair_key(pair_key)
            if existing:
                return existing, False

        conv = Conversation(id=uuid7(), type=ctype, name=req.name, direct_pair_key=pair_key, created_by=creator.id)
        self.convs.add(conv)
        await self.session.flush()
        for uid in grants:
            role = (
                MemberRole.OWNER
                if (uid == creator.id and ctype != ConversationType.DIRECT)
                else (MemberRole.MEMBER if ctype == ConversationType.DIRECT else MemberRole(grants[uid].role))
            )
            self.convs.add_member(conv.id, uid, role)
        await self.session.flush()
        await self.convs.add_keys(conv.id, 1, [(g.user_id, g.wrapped_key, g.wrapper_pub) for g in grants.values()])
        self.audit.add("conversation.create", actor_id=creator.id, target_id=conv.id, meta={"type": ctype.value})
        try:
            await self.session.commit()
        except IntegrityError:  # concurrent creation of the same direct pair
            await self.session.rollback()
            if pair_key:
                existing = await self.convs.get_direct_by_pair_key(pair_key)
                if existing:
                    return existing, False
            raise
        await self._notify(
            [u for u in grants if u != creator.id], {"t": "conversation.created", "conversationId": str(conv.id)}
        )
        return conv, True

    # --------------------------------------------------------------------- read
    async def list_for_user(self, user: User) -> list[ConversationOut]:
        return [view_to_out(v) for v in await self.convs.list_for_user(user.id)]

    async def get_for_user(self, user: User, cid: uuid.UUID) -> ConversationOut:
        # list_for_user applies the membership predicate itself, so this single query
        # both authorizes the read and returns the conversation view.
        views = await self.convs.list_for_user(user.id, conversation_ids=[cid])
        if not views:
            raise NotFound("Conversation not found", code="CONVERSATION_NOT_FOUND")
        return view_to_out(views[0])

    async def update_group(self, actor: User, cid: uuid.UUID, req: UpdateGroupRequest) -> ConversationOut:
        conv = await self._locked_conversation(cid, actor, owner_only=True)
        if conv.type != ConversationType.GROUP:
            raise Conflict("Only groups can be edited", code="NOT_A_GROUP")
        if "name" in req.model_fields_set:
            conv.name = req.name
        if "group_icon" in req.model_fields_set:
            conv.group_icon = req.group_icon
        members = await self.convs.member_ids(cid)
        self.audit.add("conversation.group_update", actor_id=actor.id, target_id=cid)
        await self.session.commit()
        await self._notify(
            [member_id for member_id in members if member_id != actor.id],
            {"t": "conversation.updated", "conversationId": str(cid)},
        )
        return await self.get_for_user(actor, cid)

    async def delete_group(self, actor: User, cid: uuid.UUID) -> None:
        conv = await self._locked_conversation(cid, actor, owner_only=True)
        if conv.type != ConversationType.GROUP:
            raise Conflict("Only groups can be deleted", code="NOT_A_GROUP")
        members = await self.convs.member_ids(cid)
        await self.convs.delete(cid)
        self.audit.add("conversation.group_delete", actor_id=actor.id, target_id=cid)
        await self.session.commit()
        await self._notify(
            [member_id for member_id in members if member_id != actor.id],
            {"t": "conversation.deleted", "conversationId": str(cid)},
        )

    async def my_keys(self, user: User, cid: uuid.UUID) -> list[ConversationKey]:
        await self._require_member(cid, user)
        return await self.convs.keys_for_user(cid, user.id)

    async def list_broadcasts(self) -> list[ConversationOut]:
        return [view_to_out(v) for v in await self.convs.list_broadcasts()]

    async def history(self, user: User, cid: uuid.UUID, *, cursor: str | None, limit: int):  # type: ignore[no-untyped-def]
        await self._require_member(cid, user)
        before = decode_cursor(cursor) if cursor else None
        rows = await self.msgs.history(cid, before=before, limit=limit)
        page = rows[:limit]
        next_cursor = encode_cursor(page[-1].created_at, page[-1].id) if len(rows) > limit else None
        return page, next_cursor

    async def mark_read(self, user: User, cid: uuid.UUID) -> None:
        await self.mark_read_for_user(user.id, cid)

    async def mark_read_for_user(self, user_id: uuid.UUID, cid: uuid.UUID) -> None:
        if not await self.convs.mark_read(cid, user_id):
            raise NotFound("Conversation not found", code="CONVERSATION_NOT_FOUND")
        await self.session.commit()

    async def member_ids(self, cid: uuid.UUID) -> list[uuid.UUID]:
        return await self.convs.member_ids(cid)

    # --------------------------------------------------------------- membership
    async def add_members(self, actor: User, cid: uuid.UUID, req: AddMembersRequest) -> None:
        conv = await self._locked_conversation(cid, actor, owner_only=True)
        if conv.type == ConversationType.DIRECT:
            raise Conflict("Direct conversations have a fixed membership", code="DIRECT_IMMUTABLE")
        self._check_version(conv, req.key_version)
        existing = set(await self.convs.member_ids(cid))
        new = {m.user_id: m for m in req.members}
        if len(new) != len(req.members) or existing & set(new):
            raise Conflict("Duplicate or already-present members", code="ALREADY_MEMBER")
        if len(existing) + len(new) > self.s.max_group_size:
            raise ValidationFailed(f"At most {self.s.max_group_size} members are allowed")
        if conv.type != ConversationType.BROADCAST and any(m.role == "sender" for m in req.members):
            raise ValidationFailed("The sender role only exists in broadcast channels")
        users = await self._enrolled_users(list(new))
        for u in users.values():
            if u.role != UserRole.USER:
                raise ValidationFailed("Only regular users can be added as members")
            self._assert_assignable(u)
        for uid, m in new.items():
            self.convs.add_member(cid, uid, MemberRole(m.role))
        await self.session.flush()
        await self.convs.add_keys(
            cid, conv.current_key_version, [(m.user_id, m.wrapped_key, m.wrapper_pub) for m in new.values()]
        )
        self.audit.add("conversation.members_add", actor_id=actor.id, target_id=cid, meta={"count": len(new)})
        await self.session.commit()
        await self._notify(list(existing), {"t": "conversation.updated", "conversationId": str(cid)})
        await self._notify(list(new), {"t": "conversation.created", "conversationId": str(cid)})

    async def _rotate(self, conv: Conversation, remaining: list[uuid.UUID], keys: list[KeyGrant]) -> int:
        """Bump the version and store fresh wrapped keys. ``keys`` must cover every remaining
        member that is currently enrolled; un-enrolled members get theirs via /keys/grant later."""
        users = await self.users.get_many(remaining)
        enrolled = {u.id for u in users if u.public_key is not None and u.is_active}
        supplied = {k.user_id for k in keys}
        if len(supplied) != len(keys) or supplied != enrolled:
            raise ValidationFailed(
                "new keys must cover exactly the enrolled remaining members",
                details={
                    "missing": sorted(str(i) for i in enrolled - supplied),
                    "unexpected": sorted(str(i) for i in supplied - enrolled),
                },
            )
        new_version = await self.convs.bump_key_version(conv.id)
        await self.convs.add_keys(conv.id, new_version, [(k.user_id, k.wrapped_key, k.wrapper_pub) for k in keys])
        return new_version

    async def remove_member(self, actor: User, cid: uuid.UUID, target_id: uuid.UUID, req: RemoveMemberRequest) -> None:
        conv = await self._locked_conversation(cid, actor)
        if conv.type == ConversationType.DIRECT:
            raise Conflict("Direct conversations have a fixed membership", code="DIRECT_IMMUTABLE")
        actor_member = await self.convs.get_member(cid, actor.id)
        target = await self.convs.get_member(cid, target_id)
        if target is None:
            raise NotFound("Member not found", code="MEMBER_NOT_FOUND")
        if target_id != actor.id and (actor_member is None or actor_member.role != MemberRole.OWNER):
            raise Forbidden("Only the owner can remove other members", code="NOT_OWNER")
        if target.role == MemberRole.OWNER:
            raise Conflict("The owner cannot be removed or leave", code="OWNER_CANNOT_LEAVE")
        self._check_version(conv, req.key_version)
        remaining = [u for u in await self.convs.member_ids(cid) if u != target_id]
        await self.convs.remove_member(cid, target_id)
        await self.convs.delete_keys_for_user(target_id, cid)
        version = await self._rotate(conv, remaining, req.new_keys)
        self.audit.add("conversation.member_remove", actor_id=actor.id, target_id=cid, meta={"member": str(target_id)})
        await self.session.commit()
        await self._notify(remaining, {"t": "key.rotated", "conversationId": str(cid), "keyVersion": version})
        await self._notify([target_id], {"t": "conversation.removed", "conversationId": str(cid)})

    async def rotate_key(self, actor: User, cid: uuid.UUID, req: RotateKeyRequest) -> int:
        conv = await self._locked_conversation(cid, actor, owner_only=True)
        if conv.type == ConversationType.DIRECT:
            raise Conflict("Direct conversations do not support rotation", code="DIRECT_IMMUTABLE")
        self._check_version(conv, req.key_version)
        members = await self.convs.member_ids(cid)
        version = await self._rotate(conv, members, req.keys)
        self.audit.add("conversation.key_rotate", actor_id=actor.id, target_id=cid)
        await self.session.commit()
        await self._notify(members, {"t": "key.rotated", "conversationId": str(cid), "keyVersion": version})
        return version

    async def grant_keys(self, actor: User, cid: uuid.UUID, req: GrantKeysRequest) -> None:
        """A member holding the current key wraps it for members who lack it (re-enrolment)."""
        conv = await self._locked_conversation(cid, actor)
        self._check_version(conv, req.key_version)
        mine = {k.key_version for k in await self.convs.keys_for_user(cid, actor.id)}
        if conv.current_key_version not in mine:
            raise Forbidden("You do not hold the current key", code="NO_CURRENT_KEY")
        missing = set(await self.convs.users_missing_current_key(cid, conv.current_key_version))
        targets = {k.user_id for k in req.keys}
        if len(targets) != len(req.keys) or not targets <= missing:
            raise ValidationFailed("Keys may only be granted to members who lack the current key")
        for u in (await self._enrolled_users(list(targets))).values():
            self._assert_assignable(u)
        await self.convs.add_keys(
            cid, conv.current_key_version, [(k.user_id, k.wrapped_key, k.wrapper_pub) for k in req.keys]
        )
        self.audit.add("conversation.key_grant", actor_id=actor.id, target_id=cid, meta={"count": len(targets)})
        await self.session.commit()
        await self._notify(list(targets), {"t": "key.granted", "conversationId": str(cid)})

    # ----------------------------------------------- user lifecycle (admin flows)
    async def detach_user(self, user_id: uuid.UUID, *, remove_membership: bool) -> None:
        """Called inside the admin transaction (caller commits).

        * key reset  (remove_membership=False): drop the user's wrapped keys, delete their
          direct chats, flag shared groups/broadcasts ``rotation_required``.
        * deletion   (remove_membership=True): additionally leave every group; owned groups pass
          to the longest-standing member (or are deleted when nobody is left).
        Returns nothing; notifications are queued via ``self._pending``.
        """
        for cid, ctype, role in await self.convs.memberships_of_user(user_id):
            others = [u for u in await self.convs.member_ids(cid) if u != user_id]
            if ctype == ConversationType.DIRECT or not others:
                await self.convs.delete(cid)
                self._pending.append((others, {"t": "conversation.deleted", "conversationId": str(cid)}))
                continue
            if remove_membership:
                if role == MemberRole.OWNER:
                    if ctype != ConversationType.GROUP:
                        await self.convs.delete(cid)
                        self._pending.append((others, {"t": "conversation.deleted", "conversationId": str(cid)}))
                        continue
                    heir = next(m for m in await self.convs.members(cid) if m.user_id != user_id)
                    await self.convs.set_member_role(cid, heir.user_id, MemberRole.OWNER)
                await self.convs.remove_member(cid, user_id)
            await self.convs.delete_keys_for_user(user_id, cid)
            await self.convs.set_rotation_required([cid])
            self._pending.append((others, {"t": "conversation.updated", "conversationId": str(cid)}))

    async def flush_notifications(self) -> None:
        for ids, payload in self._pending:
            await self._notify(ids, payload)
        self._pending = []

    # ------------------------------------------------------------------ message
    async def send_message(
        self,
        user_id: uuid.UUID,
        *,
        conversation_id: uuid.UUID,
        ciphertext: bytes,
        nonce: bytes,
        key_version: int,
        client_id: uuid.UUID | None,
    ) -> SendResult:
        # Lock and fetch membership + fan-out targets in one query.
        conv, member_role, member_ids = await self.convs.get_for_send(conversation_id, user_id)
        if conv is None or member_role is None:
            raise Forbidden("You are not a member of this conversation", code="NOT_A_MEMBER")
        if conv.type == ConversationType.BROADCAST and member_role not in (MemberRole.OWNER, MemberRole.SENDER):
            raise Forbidden("Only senders can post in this channel", code="NOT_A_SENDER")
        if conv.current_key_version != key_version:
            raise Conflict(
                "Key version is stale",
                code="KEY_VERSION_STALE",
                details={"currentKeyVersion": conv.current_key_version},
            )
        message_id = client_id or uuid7()
        row = await self.msgs.insert(
            message_id=message_id,
            conversation_id=conversation_id,
            sender_id=user_id,
            ciphertext=ciphertext,
            nonce=nonce,
            key_version=key_version,
        )
        if row is None:  # idempotent retry of the same client id
            existing = await self.msgs.get(message_id)
            if existing and existing.sender_id == user_id and existing.conversation_id == conversation_id:
                await self.session.commit()  # releases the share lock
                return SendResult(existing, True, [])
            await self.session.commit()
            raise Conflict("Message id already in use", code="MESSAGE_ID_CONFLICT")
        await self.session.commit()
        return SendResult(row, False, member_ids)

    async def count_conversations(self) -> int:
        return int((await self.session.execute(select(func.count()).select_from(Conversation))).scalar_one())
