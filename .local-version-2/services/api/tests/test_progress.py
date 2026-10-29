from datetime import datetime, timezone, timedelta
from uuid import uuid4
import pytest
from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import dialect
from app.modules.assignments.results import result_state
from app.modules.progress.schemas import HistoryQuery
from app.modules.progress.queries import assignments, with_results


@pytest.mark.parametrize(
    "status,run,released,expected",
    [
        ("not_started", None, False, "not_submitted"),
        ("in_progress", None, False, "not_submitted"),
        ("submitted", None, False, "submitted"),
        ("submitted", "COMPLETE", False, "withheld"),
        ("submitted", "COMPLETE", True, "released"),
        ("submitted", "REVIEW_REQUIRED", False, "awaiting_manual_review"),
        ("submitted", "NOT_APPLICABLE", False, "not_applicable"),
    ],
)
def test_existing_result_lifecycle_is_shared(status, run, released, expected):
    assert result_state(status, run, released) == expected


@pytest.mark.parametrize(
    "data",
    [
        {"limit": 0},
        {"limit": 101},
        {"offset": -1},
        {"offset": 100001},
        {"status": "mastered"},
        {"student_id": str(uuid4())},
        {"since": "2026-10-19T00:00:00"},
        {"since": "2026-10-20T00:00:00Z", "before": "2026-10-19T00:00:00Z"},
    ],
)
def test_progress_filters_reject_unbounded_or_ambiguous_requests(data):
    with pytest.raises(ValidationError):
        HistoryQuery(**data)


def test_bounded_history_uses_pinned_visibility_without_private_learning_tables():
    now = datetime.now(timezone.utc)
    filters = HistoryQuery(since=now, before=now + timedelta(days=1))
    assert filters.since == now
    source = assignments(uuid4(), [uuid4()]).subquery()
    page = source.select().limit(21).subquery("page")
    sql = str(with_results(page).compile(dialect=dialect())).lower()
    for table in ("question_answer_keys", "student_responses", "learner_progress", "vocabulary_review", "research_"):
        assert table not in sql
    assert "lateral" in sql and "visibility.run_id" in sql and "case when" in sql
    assert "limit" in sql and "attempt_number" in sql
