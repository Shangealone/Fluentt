"""Algorithm registry and scheduler interface definition.
Formulas for SM-2, FSRS-6, and FIFAKT are deliberately deferred to subsequent sections.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.modules.spaced_repetition.schemas import (
    ReviewEventInput,
    ScheduleDecision,
    AlgorithmIdentity,
)


class BaseScheduler(ABC):
    @property
    @abstractmethod
    def identity(self) -> AlgorithmIdentity:
        pass

    @abstractmethod
    def initial_state(self) -> dict[str, Any]:
        """Provides the algorithm-specific initial state for a newly encountered card."""
        pass

    @abstractmethod
    def compute_next_review(
        self,
        current_state: dict[str, Any],
        rating: str,
        reviewed_at: datetime,
        duration_ms: int,
        revision: int,
    ) -> ScheduleDecision:
        """Computes next interval and due date deterministically without mutating stored rows."""
        pass


class AlgorithmRegistry:
    def __init__(self):
        self._algorithms: dict[str, BaseScheduler] = {}

    def register(self, algorithm_name: str, scheduler: BaseScheduler):
        self._algorithms[algorithm_name.lower()] = scheduler

    def get(self, algorithm_name: str) -> BaseScheduler | None:
        return self._algorithms.get(algorithm_name.lower())

    def is_available(self, algorithm_name: str) -> bool:
        return algorithm_name.lower() in self._algorithms

    def list_available(self) -> list[str]:
        return sorted(list(self._algorithms.keys()))


# Global algorithm registry instance
registry = AlgorithmRegistry()


def register_default_schedulers(reg: AlgorithmRegistry) -> None:
    from app.modules.spaced_repetition.sm2 import SM2Scheduler
    from app.modules.spaced_repetition.fsrs6 import FSRS6Scheduler
    from app.modules.spaced_repetition.fifakt import ESRScheduler

    reg.register("sm2", SM2Scheduler())
    reg.register("fsrs6", FSRS6Scheduler())
    reg.register("fifakt", ESRScheduler())


register_default_schedulers(registry)
