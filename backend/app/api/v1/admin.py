from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import AdminUser, ClientIp, ContainerDep, SessionDep, enforce_admin_network
from app.models import UserStatus
from app.schemas.conversation import ConversationOut
from app.schemas.user import (
    AdminStats,
    AdminUpdateUserRequest,
    AdminUserOut,
    AdminUserPage,
    AuditOut,
    AuditPage,
    InvitationOut,
    InviteRequest,
)
from app.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(enforce_admin_network)])
NO_CONTENT = status.HTTP_204_NO_CONTENT


def _invitation_out(i) -> InvitationOut:  # type: ignore[no-untyped-def]
    return InvitationOut(
        id=i.id, email_address=i.email, status=i.status, created_at=datetime.fromtimestamp(i.created_at / 1000, UTC)
    )


def _user_out(u) -> AdminUserOut:  # type: ignore[no-untyped-def]
    return AdminUserOut(
        id=u.id,
        username=u.username,
        display_name=u.display_name,
        email=u.email,
        role=u.role.value,
        status=u.status.value,
        key_fingerprint=u.key_fingerprint,
        created_at=u.created_at,
        last_login_at=u.last_login_at,
    )


# ------------------------------------------------------------------ invitations (invite-only sign-up)
@router.post("/invitations", response_model=InvitationOut, status_code=status.HTTP_201_CREATED)
async def invite(
    body: InviteRequest, admin: AdminUser, session: SessionDep, container: ContainerDep, ip: ClientIp
) -> InvitationOut:
    return _invitation_out(await AdminService(session, container).invite(admin, email=body.email_address, ip=ip))


@router.get("/invitations", response_model=list[InvitationOut])
async def list_invitations(_: AdminUser, session: SessionDep, container: ContainerDep) -> list[InvitationOut]:
    return [_invitation_out(i) for i in await AdminService(session, container).list_invitations()]


@router.delete("/invitations/{invitation_id}", status_code=NO_CONTENT)
async def revoke_invitation(
    invitation_id: str, admin: AdminUser, session: SessionDep, container: ContainerDep, ip: ClientIp
) -> Response:
    await AdminService(session, container).revoke_invitation(admin, invitation_id, ip=ip)
    return Response(status_code=NO_CONTENT)


# ------------------------------------------------------------------------------------------- users
@router.get("/users", response_model=AdminUserPage)
async def list_users(
    _: AdminUser,
    session: SessionDep,
    container: ContainerDep,
    q: Annotated[str | None, Query(max_length=64)] = None,
    status_: Annotated[UserStatus | None, Query(alias="status")] = None,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AdminUserPage:
    rows, nxt = await AdminService(session, container).list_users(q=q, status=status_, cursor=cursor, limit=limit)
    return AdminUserPage(items=[_user_out(u) for u in rows], next_cursor=nxt)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def update_user(
    user_id: uuid.UUID,
    body: AdminUpdateUserRequest,
    admin: AdminUser,
    session: SessionDep,
    container: ContainerDep,
    ip: ClientIp,
) -> AdminUserOut:
    return _user_out(await AdminService(session, container).set_status(admin, user_id, status=body.status, ip=ip))


@router.post("/users/{user_id}/reset-key", status_code=NO_CONTENT)
async def reset_key(
    user_id: uuid.UUID, admin: AdminUser, session: SessionDep, container: ContainerDep, ip: ClientIp
) -> Response:
    await AdminService(session, container).reset_key(admin, user_id, ip=ip)
    return Response(status_code=NO_CONTENT)


@router.post("/users/{user_id}/revoke-sessions")
async def revoke_sessions(
    user_id: uuid.UUID, admin: AdminUser, session: SessionDep, container: ContainerDep, ip: ClientIp
) -> dict[str, int]:
    return {"revoked": await AdminService(session, container).revoke_sessions(admin, user_id, ip=ip)}


@router.delete("/users/{user_id}", status_code=NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID, admin: AdminUser, session: SessionDep, container: ContainerDep, ip: ClientIp
) -> Response:
    await AdminService(session, container).delete_user(admin, user_id, ip=ip)
    return Response(status_code=NO_CONTENT)


# --------------------------------------------------------------------------------- audit / stats
@router.get("/audit", response_model=AuditPage)
async def audit(
    _: AdminUser,
    session: SessionDep,
    container: ContainerDep,
    cursor: str | None = None,
    action: Annotated[str | None, Query(max_length=64)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AuditPage:
    rows, nxt = await AdminService(session, container).audit_page(cursor=cursor, action=action, limit=limit)
    return AuditPage(
        items=[
            AuditOut(
                id=r.id,
                actor_id=r.actor_id,
                action=r.action,
                target_id=r.target_id,
                ip=str(r.ip) if r.ip else None,
                meta=r.meta,
                created_at=r.created_at,
            )
            for r in rows
        ],
        next_cursor=nxt,
    )


@router.get("/stats", response_model=AdminStats)
async def stats(_: AdminUser, session: SessionDep, container: ContainerDep) -> AdminStats:
    return await AdminService(session, container).stats()


@router.get("/broadcasts", response_model=list[ConversationOut])
async def broadcasts(_: AdminUser, session: SessionDep, container: ContainerDep) -> list[ConversationOut]:
    return await AdminService(session, container).chat.list_broadcasts()
