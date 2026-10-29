"""Bounded, thread-safe single-process throttling; no credentials in keys."""

import hashlib
import math
import time
from threading import Lock


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after


class IdentityRateLimiter:
    def __init__(self, window_seconds: int, max_buckets: int = 4096):
        self.window_seconds = window_seconds
        self.max_buckets = max_buckets
        self._buckets: dict[tuple[str, str], tuple[float, int]] = {}
        self._lock = Lock()

    def check(self, scope: str, peer: str, limit: int) -> None:
        now = time.monotonic()
        key = (scope, hashlib.sha256(peer.encode()).hexdigest())
        with self._lock:
            expired = [key for key, (start, _) in self._buckets.items() if now - start >= self.window_seconds]
            for old_key in expired:
                del self._buckets[old_key]
            start, count = self._buckets.get(key, (now, 0))
            if key not in self._buckets and len(self._buckets) >= self.max_buckets:
                raise RateLimitExceeded(self.window_seconds)
            if count >= limit:
                raise RateLimitExceeded(max(1, math.ceil(self.window_seconds - (now - start))))
            self._buckets[key] = (start, count + 1)
