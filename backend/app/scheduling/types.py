from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ReviewContext:
    correct: bool
    response_time_ms: int
    item_difficulty: float
    interaction_at: datetime


@dataclass(frozen=True)
class SchedulingResult:
    scheduler_type: str
    algorithm_version: str
    next_interval_seconds: int
    next_due_at: datetime
    state: dict[str, object]
