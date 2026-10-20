from __future__ import annotations

import json

from fastapi import APIRouter, Request, Response, status

from app.api.deps import ContainerDep, SessionDep
from app.core.errors import AppError, BadRequest, Unauthorized
from app.integrations.clerk import verify_webhook
from app.services.webhook_service import WebhookService

router = APIRouter(prefix="/webhooks", tags=["webhooks"], include_in_schema=False)


@router.post("/clerk", status_code=status.HTTP_204_NO_CONTENT)
async def clerk_webhook(request: Request, container: ContainerDep, session: SessionDep) -> Response:
    secret = container.settings.clerk_webhook_secret
    if secret is None:
        raise AppError("Webhooks are not configured", status_code=503, code="WEBHOOK_DISABLED")
    body = await request.body()
    h = request.headers
    if not verify_webhook(
        secret.get_secret_value(),
        body=body,
        msg_id=h.get("svix-id"),
        timestamp=h.get("svix-timestamp"),
        signature=h.get("svix-signature"),
    ):
        raise Unauthorized(
            "Invalid webhook signature",
        )
    try:
        event = json.loads(body)
        event_type, data = str(event["type"]), dict(event["data"])
    except (ValueError, KeyError, TypeError) as exc:
        raise BadRequest("Malformed webhook payload") from exc
    await WebhookService(session, container).handle(event_type, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
