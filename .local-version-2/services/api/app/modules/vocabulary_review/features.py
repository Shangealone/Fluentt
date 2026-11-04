"""Only a condition's past encounters may inform its next prediction."""
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class HistoryEntry:
    scope: tuple[str, str, str, str]  # study, coded participant, pool, configuration
    item_id: str
    content_version: int
    format: str
    reviewed_at: datetime
    correct: bool
    revision: int


def history_before(entries, scope, as_of: datetime) -> list[HistoryEntry]:
    if as_of.tzinfo is None:
        raise ValueError("History cutoff must include its timezone.")
    return sorted((row for row in entries if row.scope == scope and row.reviewed_at.tzinfo is not None
                   and row.reviewed_at < as_of), key=lambda row: (row.reviewed_at, row.revision, row.item_id))
