"""Client IP resolution (proxy-aware, spoof-resistant)."""

from __future__ import annotations

import ipaddress

from starlette.requests import HTTPConnection


def client_ip(conn: HTTPConnection, *, trust_proxy: bool, proxy_count: int) -> str:
    """Return the client IP.

    With ``trust_proxy`` we read ``X-Forwarded-For`` but only trust the entry
    appended by *our* outermost trusted proxy (``-proxy_count`` from the right),
    never the left-most value which the client controls.
    """
    candidate: str | None = None
    if trust_proxy:
        forwarded = [p.strip() for p in conn.headers.get("x-forwarded-for", "").split(",") if p.strip()]
        if len(forwarded) >= proxy_count >= 1:
            candidate = forwarded[-proxy_count]
    if candidate is None:
        candidate = conn.client.host if conn.client else "0.0.0.0"  # noqa: S104
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return "0.0.0.0"  # noqa: S104
