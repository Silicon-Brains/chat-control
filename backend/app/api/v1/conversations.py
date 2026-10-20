from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Body, Query, Response, status

from app.api.deps import ContainerDep, CurrentUser, SessionDep
from app.schemas.conversation import (
    AddMembersRequest,
    ConversationCreated,
    ConversationKeyOut,
    ConversationOut,
    CreateConversationRequest,
    GrantKeysRequest,
    RemoveMemberRequest,
    RotateKeyRequest,
    UpdateGroupRequest,
)
from app.schemas.message import MessageOut, MessagePage
from app.services.chat_service import ChatService

router = APIRouter(prefix="/conversations", tags=["conversations"])
NO_CONTENT = status.HTTP_204_NO_CONTENT


@router.post("", response_model=ConversationCreated, status_code=status.HTTP_201_CREATED)
async def create(
    body: CreateConversationRequest, response: Response, user: CurrentUser, session: SessionDep, container: ContainerDep
) -> ConversationCreated:
    conv, created = await ChatService(session, container).create(user, body)
    if not created:
        response.status_code = status.HTTP_200_OK  # existing direct chat returned
    return ConversationCreated(id=conv.id, current_key_version=conv.current_key_version, created=created)


@router.get("", response_model=list[ConversationOut])
async def list_conversations(user: CurrentUser, session: SessionDep, container: ContainerDep) -> list[ConversationOut]:
    return await ChatService(session, container).list_for_user(user)


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: uuid.UUID, user: CurrentUser, session: SessionDep, container: ContainerDep
) -> ConversationOut:
    return await ChatService(session, container).get_for_user(user, conversation_id)


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_group(
    conversation_id: uuid.UUID,
    body: UpdateGroupRequest,
    user: CurrentUser,
    session: SessionDep,
    container: ContainerDep,
) -> ConversationOut:
    return await ChatService(session, container).update_group(user, conversation_id, body)


@router.delete("/{conversation_id}", status_code=NO_CONTENT)
async def delete_group(
    conversation_id: uuid.UUID, user: CurrentUser, session: SessionDep, container: ContainerDep
) -> Response:
    await ChatService(session, container).delete_group(user, conversation_id)
    return Response(status_code=NO_CONTENT)


@router.get("/{conversation_id}/keys", response_model=list[ConversationKeyOut])
async def my_keys(
    conversation_id: uuid.UUID, user: CurrentUser, session: SessionDep, container: ContainerDep
) -> list[ConversationKeyOut]:
    rows = await ChatService(session, container).my_keys(user, conversation_id)
    return [
        ConversationKeyOut(key_version=k.key_version, wrapped_key=k.wrapped_key, wrapper_pub=k.wrapper_pub)
        for k in rows
    ]


@router.post("/{conversation_id}/members", status_code=NO_CONTENT)
async def add_members(
    conversation_id: uuid.UUID, body: AddMembersRequest, user: CurrentUser, session: SessionDep, container: ContainerDep
) -> Response:
    await ChatService(session, container).add_members(user, conversation_id, body)
    return Response(status_code=NO_CONTENT)


@router.delete("/{conversation_id}/members/{member_id}", status_code=NO_CONTENT)
async def remove_member(
    conversation_id: uuid.UUID,
    member_id: uuid.UUID,
    body: Annotated[RemoveMemberRequest, Body()],
    user: CurrentUser,
    session: SessionDep,
    container: ContainerDep,
) -> Response:
    await ChatService(session, container).remove_member(user, conversation_id, member_id, body)
    return Response(status_code=NO_CONTENT)


@router.post("/{conversation_id}/keys/rotate")
async def rotate_key(
    conversation_id: uuid.UUID, body: RotateKeyRequest, user: CurrentUser, session: SessionDep, container: ContainerDep
) -> dict[str, int]:
    return {"keyVersion": await ChatService(session, container).rotate_key(user, conversation_id, body)}


@router.post("/{conversation_id}/keys/grant", status_code=NO_CONTENT)
async def grant_keys(
    conversation_id: uuid.UUID, body: GrantKeysRequest, user: CurrentUser, session: SessionDep, container: ContainerDep
) -> Response:
    await ChatService(session, container).grant_keys(user, conversation_id, body)
    return Response(status_code=NO_CONTENT)


@router.post("/{conversation_id}/read", status_code=NO_CONTENT)
async def mark_read(
    conversation_id: uuid.UUID, user: CurrentUser, session: SessionDep, container: ContainerDep
) -> Response:
    await ChatService(session, container).mark_read(user, conversation_id)
    return Response(status_code=NO_CONTENT)


@router.get("/{conversation_id}/messages", response_model=MessagePage)
async def history(
    conversation_id: uuid.UUID,
    user: CurrentUser,
    session: SessionDep,
    container: ContainerDep,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> MessagePage:
    rows, nxt = await ChatService(session, container).history(user, conversation_id, cursor=cursor, limit=limit)
    return MessagePage(items=[MessageOut.model_validate(m) for m in rows], next_cursor=nxt)
