from __future__ import annotations

import time


class Throttle:
    def __init__(self, min_interval: float = 0.3) -> None:
        self.min_interval = min_interval
        self._last_action: dict[int, float] = {}

    def allow(self, user_id: int) -> bool:
        now = time.monotonic()
        last = self._last_action.get(user_id, 0.0)
        if now - last < self.min_interval:
            return False
        self._last_action[user_id] = now
        return True
