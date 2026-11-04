"""Synthetic review transactions in a disposable database, never study validation."""
from contextlib import contextmanager
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import select, func, text
from sqlalchemy.exc import DBAPIError

from app.models.learning import VocabularyItem
from app.models.research import ResearchParticipant, ResearchStudy
from app.models.vocabulary_review import VocabularyPack, ESRProtocol, ESRAllocation, ESRReviewState, ESRReview
from app.modules.identity.errors import IdentityError
from app.modules.vocabulary_review import service
from app.modules.vocabulary_review.schemas import AnswerInput, RatingInput
from tests.test_vocabulary_review import card, config, NOW

pytestmark = pytest.mark.postgresql


@pytest.fixture
def review_graph(db, graph, monkeypatch):
    add = graph["add"]
    definition = card()
    add(VocabularyItem(id=definition.vocabulary_item_id, lesson_id=graph["lesson"].id,
                       language="english", term=definition.term, meaning=definition.meaning, version=1))
    packs = [add(VocabularyPack(author_id=graph["instructor"].id, lesson_id=graph["lesson"].id,
                 title="Synthetic pool", language="english", content={"cards": [definition.model_dump(mode="json")]},
                 fingerprint="a" * 64, published_at=NOW)) for _ in range(2)]
    study = add(ResearchStudy(code=uuid4().hex, title="Synthetic study", target_language="english", protocol_version="test"))
    protocol = add(ESRProtocol(study_id=study.id, manager_id=graph["instructor"].id, class_id=graph["classroom"].id,
                   pack_a_id=packs[0].id, pack_b_id=packs[1].id,
                   configuration={"settings": config().model_dump(mode="json"), "model_artifact_sha256": "b" * 64}))
    participant = add(ResearchParticipant(study_id=study.id, participant_code=uuid4().hex))
    allocation = add(ESRAllocation(protocol_id=protocol.id, participant_id=participant.id, mapping=1))
    state = add(ESRReviewState(allocation_id=allocation.id, pack_id=packs[0].id,
                              vocabulary_item_id=definition.vocabulary_item_id, memory={}, due_at=NOW))

    # Bypass only external enrollment/auth setup, not mutation, replay or DB guards.
    @contextmanager
    def context(*args):
        yield db, graph["student"], protocol, allocation
    monkeypatch.setattr(service, "learner_context", context)
    return SimpleNamespace(session=db), protocol, state


def test_answer_is_committed_before_rating_and_retries_advance_once(review_graph):
    repo, protocol, state = review_graph
    def mutate(action, target, payload=None, key=None):
        return service.learner_mutation(repo, None, None, protocol.id, key or uuid4(), action, target, payload, None)
    from uuid import UUID
    start = mutate("start", state.id)
    assert start["phase"] == "answer" and "feedback" not in start
    assert "accepted_forms" not in start["question"] and "correct_option_id" not in start["question"]
    review_id = UUID(start["id"])
    key = uuid4()
    first = mutate("answer", review_id, AnswerInput(response="b"), key)
    assert first["phase"] == "rating" and not first["feedback"]["correct"]
    assert mutate("answer", review_id, AnswerInput(response="b"), key) == first
    with pytest.raises(IdentityError):
        mutate("answer", review_id, AnswerInput(response="a"))
    final_key = uuid4()
    result = mutate("rating", review_id, RatingInput(rating="easy"), final_key)
    assert result["phase"] == "finished" and state.revision == 2
    assert mutate("rating", review_id, RatingInput(rating="easy"), final_key) == result
    assert state.revision == 2
    row = repo.session.get(ESRReview, review_id)
    assert row.decision["raw_rating"] == "easy" and row.decision["effective_rating"] == "again"
    assert row.decision["condition"] == "fsrs6"
    assert repo.session.scalar(select(func.count()).select_from(ESRReview)) == 1


def test_published_snapshot_and_final_answer_are_database_protected(review_graph):
    repo, protocol, _ = review_graph
    with pytest.raises(DBAPIError), repo.session.begin_nested():
        repo.session.execute(text("UPDATE research_private.esr_vocabulary_packs SET content='{}' WHERE id=:id"),
                             {"id": protocol.pack_a_id})
    assert repo.session.get(VocabularyPack, protocol.pack_a_id).content["cards"]


def test_missing_evidence_and_model_block_activation(review_graph):
    repo, protocol, _ = review_graph
    blockers = service.blockers(repo.session, protocol, None)
    assert "validated_model_unavailable" in blockers
    assert "study_workflow_unavailable" in blockers
    assert all("approval_" + kind in blockers for kind in service.APPROVALS)


def test_admin_authoring_replay_and_revoked_permission(db, graph):
    from app.modules.administration.cli import provision, curriculum_permission
    from app.modules.administration.repository import AdminRepository
    from app.modules.administration.service import issue_session, resolve_session
    from app.modules.vocabulary_review.schemas import PackInput
    from tests.integration.test_curriculum_postgresql import publish
    publish(db, graph)
    lesson_id = graph["lesson"].id
    db.commit()
    repo = AdminRepository(db)
    name = "Vocabulary_" + uuid4().hex[:10]
    provision(repo, name, "https://id.example", name)
    token = issue_session(repo, "https://id.example", name)
    payload = PackInput(lesson_id=lesson_id, title="Synthetic vocabulary", language="tagalog", cards=[card()])
    csrf = resolve_session(repo, token).csrf_token
    key = uuid4()
    with pytest.raises(IdentityError) as denied:
        service.admin_write(repo, token, csrf, key, action="pack", payload=payload)
    assert denied.value.status == 403
    curriculum_permission(repo, name, grant=True, access="editor")
    saved = service.admin_write(repo, token, csrf, key, action="pack", payload=payload)
    assert service.admin_write(repo, token, csrf, key, action="pack", payload=payload) == saved
    with pytest.raises(IdentityError):
        service.admin_write(repo, token, csrf, key, action="pack", payload=payload.model_copy(update={"title": "Different"}))
    curriculum_permission(repo, name, grant=False, access="editor")
    with pytest.raises(IdentityError) as revoked:
        service.admin_write(repo, token, csrf, key, action="pack", payload=payload)
    assert revoked.value.status == 403
