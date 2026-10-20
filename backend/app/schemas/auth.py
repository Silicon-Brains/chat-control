from __future__ import annotations

from app.schemas.base import CamelModel


class WsTicketResponse(CamelModel):
    ticket: str
    expires_in: int
