from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import ContainerDep, CurrentUser, SessionDep
from app.core.rate_limit import enforce
from app.schemas.auth import WsTicketResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/ws-ticket", response_model=WsTicketResponse)
async def ws_ticket(user: CurrentUser, session: SessionDep, container: ContainerDep) -> WsTicketResponse:
    """Authenticated with a Clerk session token; returns a single-use ticket for ``/ws?ticket=``."""
    await enforce(container.limiter, f"wsticket:{user.id}", container.settings.ticket_rate_limit_per_minute, 60)
    ticket, ttl = await AuthService(session, container).issue_ws_ticket(user)
    return WsTicketResponse(ticket=ticket, expires_in=ttl)
