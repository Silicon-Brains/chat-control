"""FastAPI dependencies: container/session access, authentication, guards."""

from __future__ import annotations

import ipaddress
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.container import Container
from app.core.errors import Forbidden, Unauthorized
from app.core.request import client_ip
from app.models import User, UserRole
from app.services.identity_service import IdentityService

_bearer = HTTPBearer(auto_error=False)


def get_container(request: Request) -> Container:
    return request.app.state.container  # type: ignore[no-any-return]


ContainerDep = Annotated[Container, Depends(get_container)]


async def get_session(container: ContainerDep) -> AsyncIterator[AsyncSession]:
    # Services commit explicitly; leaving the block rolls back anything unfinished.
    async with container.session_factory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_ip(request: Request, container: ContainerDep) -> str:
    s = container.settings
    return client_ip(request, trust_proxy=s.trust_proxy_headers, proxy_count=s.trusted_proxy_count)


ClientIp = Annotated[str, Depends(get_ip)]


def get_user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


UserAgent = Annotated[str | None, Depends(get_user_agent)]


async def _authenticate(
    container: Container, session: AsyncSession, creds: HTTPAuthorizationCredentials | None, *, max_age: int | None
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise Unauthorized()
    claims = await container.verifier.verify(creds.credentials)  # Clerk session JWT (RS256 / JWKS)
    return await IdentityService(session, container).resolve(claims.user_id, max_age=max_age)


async def get_current_user(
    container: ContainerDep,
    session: SessionDep,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    return await _authenticate(container, session, creds, max_age=None)


CurrentUser = Annotated[User, Depends(get_current_user)]


def enforce_admin_network(container: ContainerDep, ip: ClientIp) -> None:
    networks = container.settings.admin_networks
    if networks and not any(ipaddress.ip_address(ip) in n for n in networks):
        raise Forbidden("Admin access is not allowed from this network", code="ADMIN_NETWORK")


async def get_admin_user(
    container: ContainerDep,
    session: SessionDep,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    _: Annotated[None, Depends(enforce_admin_network)],
) -> User:
    # Admin endpoints re-check role/ban against Clerk when the mirror is older than ~60 s.
    user = await _authenticate(container, session, creds, max_age=container.settings.clerk_admin_sync_ttl_seconds)
    if user.role != UserRole.ADMIN:
        raise Forbidden("Admin privileges required", code="ADMIN_ONLY")
    return user


AdminUser = Annotated[User, Depends(get_admin_user)]
