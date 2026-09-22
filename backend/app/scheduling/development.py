"""Development scheduler implementation.

IMPORTANT RESEARCH NOTICE:
This scheduler is strictly for software integration testing and software workflow validation.
- It is NOT the FLUENTT Enhanced Spaced Repetition (ESR) algorithm.
- It is NOT an experimental baseline algorithm.
- It MUST NOT be used for empirical research evaluation or thesis conclusions.
- Algorithm decisions for Chapter 3 remain in draft and are explicitly held out of scope.
"""

from datetime import timedelta

from app.scheduling.types import ReviewContext, SchedulingResult


class DevelopmentScheduler:
    """Deterministic development-only scheduler.

    Returns:
        scheduler_type = "development"
        algorithm_version = "dev-0.1"

    Rules:
        correct answer   -> 24 hours (86,400 seconds)
        incorrect answer -> 10 minutes (600 seconds)
    """

    SCHEDULER_TYPE = "development"
    ALGORITHM_VERSION = "dev-0.1"

    CORRECT_INTERVAL_SECONDS = 86400  # 24 hours
    INCORRECT_INTERVAL_SECONDS = 600  # 10 minutes

    def schedule(self, context: ReviewContext) -> SchedulingResult:
        interval_seconds = (
            self.CORRECT_INTERVAL_SECONDS
            if context.correct
            else self.INCORRECT_INTERVAL_SECONDS
        )
        next_due_at = context.interaction_at + timedelta(seconds=interval_seconds)

        state: dict[str, object] = {
            "is_development_only": True,
            "deterministic_rule": ("24h_on_correct_10m_on_incorrect"),
            "last_correct": context.correct,
        }

        return SchedulingResult(
            scheduler_type=self.SCHEDULER_TYPE,
            algorithm_version=self.ALGORITHM_VERSION,
            next_interval_seconds=interval_seconds,
            next_due_at=next_due_at,
            state=state,
        )
