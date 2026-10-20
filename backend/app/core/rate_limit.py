"""Fixed-window rate limiter with in-memory and Redis backends."""

from __future__ import annotations

import time
from typing import Protocol

from app.core.errors import RateLimited


class RateLimiter(Protocol):
    async def incr(self, key: str, window: int) -> tuple[int, int]:
        """Increment; returns ``(count, seconds_until_reset)``."""

    async def get(self, key: str) -> tuple[int, int]:
        """Current ``(count, seconds_until_reset)`` without incrementing."""

    async def delete(self, key: str) -> None: ...

    async def close(self) -> None: ...


class InMemoryRateLimiter:
    """Single-process limiter. Use RedisRateLimiter when running >1 instance."""

    def __init__(self, max_keys: int = 200_000) -> None:
        self._data: dict[str, tuple[int, float]] = {}
        self._max_keys = max_keys
        self._ops = 0

    def _sweep(self, now: float) -> None:
        self._ops += 1
        if self._ops % 1000 and len(self._data) < self._max_keys:
            return
        self._data = {k: v for k, v in self._data.items() if v[1] > now}
        if len(self._data) >= self._max_keys:  # hard cap: drop oldest windows
            for key in sorted(self._data, key=lambda k: self._data[k][1])[: self._max_keys // 10]:
                self._data.pop(key, None)

    async def incr(self, key: str, window: int) -> tuple[int, int]:
        now = time.monotonic()
        self._sweep(now)
        count, expires = self._data.get(key, (0, 0.0))
        if expires <= now:
            count, expires = 0, now + window
        count += 1
        self._data[key] = (count, expires)
        return count, max(1, int(expires - now))

    async def get(self, key: str) -> tuple[int, int]:
        now = time.monotonic()
        count, expires = self._data.get(key, (0, 0.0))
        if expires <= now:
            return 0, 0
        return count, max(1, int(expires - now))

    async def delete(self, key: str) -> None:
        self._data.pop(key, None)

    async def close(self) -> None:
        self._data.clear()


class RedisRateLimiter:
    _INCR = (
        "local c = redis.call('INCR', KEYS[1]) "
        "if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end "
        "return {c, redis.call('TTL', KEYS[1])}"
    )

    def __init__(self, url: str, prefix: str = "vc:rl:") -> None:
        import redis.asyncio as aioredis

        self._redis = aioredis.from_url(url, decode_responses=True, health_check_interval=30)
        self._prefix = prefix
        self._script = self._redis.register_script(self._INCR)

    async def incr(self, key: str, window: int) -> tuple[int, int]:
        count, ttl = await self._script(keys=[self._prefix + key], args=[window])
        return int(count), max(1, int(ttl))

    async def get(self, key: str) -> tuple[int, int]:
        pipe = self._redis.pipeline()
        pipe.get(self._prefix + key)
        pipe.ttl(self._prefix + key)
        raw, ttl = await pipe.execute()
        return (int(raw) if raw else 0), max(0, int(ttl or 0))

    async def delete(self, key: str) -> None:
        await self._redis.delete(self._prefix + key)

    async def close(self) -> None:
        await self._redis.aclose()


def build_rate_limiter(redis_url: str | None) -> RateLimiter:
    return RedisRateLimiter(redis_url) if redis_url else InMemoryRateLimiter()


async def enforce(limiter: RateLimiter, key: str, limit: int, window: int) -> None:
    """Count one hit and raise ``RateLimited`` if over the limit."""
    count, ttl = await limiter.incr(key, window)
    if count > limit:
        raise RateLimited(ttl)


async def ensure_not_blocked(limiter: RateLimiter, key: str, limit: int) -> None:
    """Raise if ``key`` already reached ``limit`` (no increment)."""
    count, ttl = await limiter.get(key)
    if count >= limit:
        raise RateLimited(ttl)
