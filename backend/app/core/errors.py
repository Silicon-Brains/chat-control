"""Typed application errors and global exception handlers.

Wire format (rules.md §4): {"error": {"code": "...", "message": "..."}}
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import request_id_ctx

log = logging.getLogger("app.errors")


class AppError(Exception):
    status_code = 400
    code = "BAD_REQUEST"
    message = "Bad request"

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
        headers: dict[str, str] | None = None,
        details: Any = None,
    ) -> None:
        self.message = message or self.message
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        self.headers = headers or {}
        self.details = details
        super().__init__(self.message)


class BadRequest(AppError):
    status_code, code, message = 400, "BAD_REQUEST", "Bad request"


class Unauthorized(AppError):
    status_code, code, message = 401, "UNAUTHORIZED", "Authentication required"


class InvalidCredentials(AppError):
    status_code, code, message = 401, "INVALID_CREDENTIALS", "Invalid credentials"


class Forbidden(AppError):
    status_code, code, message = 403, "FORBIDDEN", "You do not have access to this resource"


class NotFound(AppError):
    status_code, code, message = 404, "NOT_FOUND", "Resource not found"


class Conflict(AppError):
    status_code, code, message = 409, "CONFLICT", "Conflict"


class PayloadTooLarge(AppError):
    status_code, code, message = 413, "PAYLOAD_TOO_LARGE", "Payload too large"


class ValidationFailed(AppError):
    status_code, code, message = 422, "VALIDATION_ERROR", "Validation failed"


class RateLimited(AppError):
    status_code, code, message = 429, "RATE_LIMITED", "Too many requests"

    def __init__(self, retry_after: int = 60, message: str | None = None) -> None:
        super().__init__(message, headers={"Retry-After": str(max(1, retry_after))})
        self.retry_after = max(1, retry_after)


def error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    body: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        body["details"] = details
    body["requestId"] = request_id_ctx.get()
    return {"error": body}


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            error_body(exc.code, exc.message, exc.details),
            status_code=exc.status_code,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Never echo the submitted input back (may contain secrets).
        details = [
            {"loc": [str(p) for p in e.get("loc", ())], "msg": e.get("msg"), "type": e.get("type")}
            for e in exc.errors()
        ]
        return JSONResponse(error_body("VALIDATION_ERROR", "Request validation failed", details), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
        message = "Resource not found" if exc.status_code == 404 else str(exc.detail)
        return JSONResponse(
            error_body(code, message),
            status_code=exc.status_code,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.error("unhandled exception", exc_info=exc)
        return JSONResponse(error_body("INTERNAL_ERROR", "An unexpected error occurred"), status_code=500)
