from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import ClientIp, ContainerDep, CurrentUser, SessionDep
from app.core.errors import Forbidden
from app.models import UserRole
from app.schemas.user import DirectoryPage, DirectoryUser, MeResponse, RegisterKeyRequest
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=MeResponse)
async def me(user: CurrentUser) -> MeResponse:
    return MeResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role.value,
        email=user.email,
        key_fingerprint=user.key_fingerprint,
        management_verified=user.management_verified,
        has_public_key=user.public_key is not None,
        created_at=user.created_at,
    )


@router.put("/me/key", status_code=status.HTTP_204_NO_CONTENT)
async def register_key(
    body: RegisterKeyRequest, user: CurrentUser, session: SessionDep, container: ContainerDep, ip: ClientIp
) -> Response:
    await UserService(session, container).register_public_key(user, body.public_key, ip=ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/me/key/reset", status_code=status.HTTP_204_NO_CONTENT)
async def reset_key(
    body: RegisterKeyRequest, user: CurrentUser, session: SessionDep, container: ContainerDep, ip: ClientIp
) -> Response:
    if user.role != UserRole.USER:
        raise Forbidden("Only user accounts can reset device keys")
    await UserService(session, container).reset_key(user, user.id, ip=ip, raw_public_key=body.public_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=DirectoryPage)
async def directory(
    _: CurrentUser,
    session: SessionDep,
    container: ContainerDep,
    q: Annotated[str | None, Query(max_length=64)] = None,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> DirectoryPage:
    rows, nxt = await UserService(session, container).directory(q=q, cursor=cursor, limit=limit)
    return DirectoryPage(
        items=[
            DirectoryUser(
                id=u.id,
                username=u.username,
                display_name=u.display_name,
                public_key=u.public_key,
                key_fingerprint=u.key_fingerprint,
                management_verified=u.management_verified,
            )
            for u in rows
        ],
        next_cursor=nxt,
    )
