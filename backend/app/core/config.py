"""Application settings (12-factor, validated at startup)."""

from __future__ import annotations

import ipaddress
import ssl
from functools import lru_cache
from typing import Any, Literal

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- runtime -----------------------------------------------------------
    env: Literal["development", "test", "staging", "production"] = "development"
    log_level: str = "INFO"
    log_json: bool = True
    enable_docs: bool = False
    sentry_dsn: str | None = None

    # --- database (Neon) ---------------------------------------------------
    database_url: str  # POOLED endpoint (-pooler) used by the app
    database_url_direct: str | None = None  # DIRECT endpoint used by Alembic
    db_ssl: bool = True
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout: int = 10
    db_pool_recycle: int = 300

    # --- Clerk -------------------------------------------------------------
    clerk_secret_key: SecretStr  # sk_live_… / sk_test_… (Backend API)
    clerk_issuer: str  # Frontend API URL, e.g. https://clerk.example.com  (the JWT "iss")
    clerk_jwks_url: str | None = None  # defaults to {issuer}/.well-known/jwks.json
    clerk_api_url: str = "https://api.clerk.com/v1"
    clerk_webhook_secret: SecretStr | None = None  # whsec_… (Svix); webhook endpoint is off without it
    clerk_authorized_parties: str = ""  # defaults to ALLOWED_ORIGINS
    clerk_sync_ttl_seconds: int = 300  # how long a mirrored profile/role is trusted
    clerk_admin_sync_ttl_seconds: int = 60  # admin endpoints re-check role/ban at most this stale
    invitation_redirect_url: str | None = None  # where invitees land to finish sign-up
    ws_ticket_ttl_seconds: int = 30

    # --- web ---------------------------------------------------------------
    allowed_origins: str = "http://localhost:3000"
    trust_proxy_headers: bool = False
    trusted_proxy_count: int = 1
    admin_ip_allowlist: str = ""
    max_request_body_bytes: int = 262_144
    ticket_rate_limit_per_minute: int = 30

    # --- chat limits -------------------------------------------------------
    max_group_size: int = 200
    allow_user_group_creation: bool = True
    ws_max_connections_total: int = 1500
    ws_max_connections_per_user: int = 5
    ws_send_queue_size: int = 256
    ws_idle_timeout_seconds: int = 90
    ws_max_frame_bytes: int = 384 * 1024
    ws_rate_limit_messages: int = 20
    ws_rate_limit_window_seconds: int = 10

    # --- purge -------------------------------------------------------------
    purge_interval_seconds: int = 60
    purge_batch_size: int = 5000
    purge_max_batches_per_tick: int = 20
    audit_retention_days: int = 90

    redis_url: str | None = None

    # ----------------------------------------------------------------------
    @field_validator("admin_ip_allowlist")
    @classmethod
    def _validate_admin_ip_allowlist(cls, value: str) -> str:
        for entry in value.split(","):
            entry = entry.strip()
            if entry:
                try:
                    ipaddress.ip_network(entry, strict=False)
                except ValueError as exc:
                    raise ValueError("ADMIN_IP_ALLOWLIST entries must be IP addresses or CIDRs") from exc
        return value

    @model_validator(mode="after")
    def _production_guards(self) -> Settings:
        if self.is_production:
            if "*" in self.origins:
                raise ValueError("ALLOWED_ORIGINS must not contain '*'")
        if self.env == "production" and self.enable_docs:
            raise ValueError("ENABLE_DOCS must be false in production")
        return self

    @property
    def origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def admin_networks(self) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
        return [ipaddress.ip_network(n.strip(), strict=False) for n in self.admin_ip_allowlist.split(",") if n.strip()]

    @property
    def authorized_parties(self) -> list[str]:
        raw = self.clerk_authorized_parties or self.allowed_origins
        return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.env in ("production", "staging")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


def build_async_database_url(url: str, *, force_ssl: bool = True) -> tuple[URL, dict[str, Any]]:
    """Turn a libpq-style Neon URL into an asyncpg URL + connect_args.

    asyncpg rejects ``sslmode``/``channel_binding`` query params, so they are
    translated into an SSLContext (certificate-verifying) and stripped.
    ``sslmode=disable`` (local dev) always wins.
    """
    parsed = make_url(url).set(drivername="postgresql+asyncpg")
    query = dict(parsed.query)
    sslmode = str(query.pop("sslmode", "") or "")
    query.pop("channel_binding", None)
    ssl_flag = str(query.pop("ssl", "") or "").lower()
    connect_args: dict[str, Any] = {"statement_cache_size": 0, "prepared_statement_cache_size": 0}
    wants_ssl = (
        sslmode in {"require", "verify-ca", "verify-full"}
        or ssl_flag in {"true", "require", "1"}
        or (force_ssl and sslmode != "disable" and ssl_flag not in {"false", "disable", "0"})
    )
    if wants_ssl:
        connect_args["ssl"] = ssl.create_default_context()
    return parsed.set(query=query), connect_args
