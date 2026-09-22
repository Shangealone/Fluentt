from typing import Protocol

from app.scheduling.types import ReviewContext, SchedulingResult


class Scheduler(Protocol):
    def schedule(self, context: ReviewContext) -> SchedulingResult:
        """Calculate next review schedule for a given review context."""
        ...
