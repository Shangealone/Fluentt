"""Guard tests verify the default-off shared boundary without changing schedulers."""

from types import SimpleNamespace
from uuid import uuid4
import pytest
from app.modules.identity.errors import IdentityError
from app.modules.research.execution_guard import guard_managed_review, assert_no_managed_execution


@pytest.mark.parametrize("context", ["self_study", "personal", "classroom"])
def test_nonresearch_requests_perform_no_research_queries_even_with_untrusted_ids(context):
    class NoResearchDB:
        def get(self, *_):
            raise AssertionError("Personal/ordinary request queried research")

        def scalar(self, *_):
            raise AssertionError("Personal/ordinary request queried research")

    assert (
        guard_managed_review(NoResearchDB(), SimpleNamespace(id=uuid4()), context, study_id=uuid4(), class_id=uuid4())
        is None
    )


def test_unmarked_study_is_delegated_and_managed_study_is_refused():
    assert assert_no_managed_execution(SimpleNamespace(conditions={})) is None
    with pytest.raises(IdentityError) as exc:
        assert_no_managed_execution(SimpleNamespace(conditions={"research_contract": "research-classrooms-v1"}))
    assert exc.value.code == "research_classroom_execution_blocked"


def test_unmarked_legacy_research_resolution_remains_delegated():
    class UnmarkedDB:
        def get(self, *_):
            return SimpleNamespace(conditions={})

        def scalar(self, *_):
            return None

    assert guard_managed_review(UnmarkedDB(), SimpleNamespace(id=uuid4()), "research", study_id=uuid4()) is None
