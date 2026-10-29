"""Approved submission counts, shared by student and instructor projections."""

from app.modules.progress.schemas import Counts


def submission_counts(available, in_progress, submitted):
    not_started = available - in_progress - submitted
    if min(available, in_progress, submitted, not_started) < 0:
        raise ValueError("Inconsistent submission counts")
    return Counts(
        available=available,
        not_started=not_started,
        in_progress=in_progress,
        submitted=submitted,
        pending=not_started + in_progress,
    )
