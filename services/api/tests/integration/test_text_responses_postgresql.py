"""Synthetic storage-only checks; no attempt or response API is implemented here."""

from datetime import datetime, timezone

import pytest

from app.models.assessments import (
    Assignment,
    AssignmentAttempt,
    AssignmentQuestion,
    AssignmentVersion,
    Question,
    QuestionAnswerKey,
    QuestionRevision,
    StudentResponse,
)

pytestmark = pytest.mark.postgresql


@pytest.mark.parametrize("method", ["identification", "fill_in_the_blank"])
def test_raw_text_roundtrip_and_orm_limits(db, graph, method):
    add = graph["add"]
    question = add(Question())
    content = {"input_max_length": 500}
    if method == "fill_in_the_blank":
        content["blank_ids"] = ["gap"]
    revision = add(
        QuestionRevision(
            question_id=question.id,
            lesson_id=graph["lesson"].id,
            version=1,
            method=method,
            language="tagalog",
            prompt="Synthetic fixture",
            content=content,
        )
    )
    key = (
        {"accepted_answers": ["fixture"]} if method == "identification" else {"accepted_answers": {"gap": ["fixture"]}}
    )
    add(QuestionAnswerKey(question_revision_id=revision.id, configuration=key, grading_version="ungraded-v1"))
    revision.locked_at = datetime.now(timezone.utc)
    db.flush()
    assignment = add(Assignment(class_id=graph["classroom"].id, instructor_id=graph["instructor"].id))
    version = add(
        AssignmentVersion(
            assignment_id=assignment.id, lesson_id=graph["lesson"].id, version=1, title="Synthetic fixture"
        )
    )
    item = add(
        AssignmentQuestion(assignment_version_id=version.id, question_revision_id=revision.id, position=1, points=1)
    )
    version.locked_at = datetime.now(timezone.utc)
    db.flush()
    attempt = add(
        AssignmentAttempt(
            assignment_version_id=version.id,
            student_id=graph["student"].id,
            attempt_number=1,
            started_at=datetime.now(timezone.utc),
        )
    )
    raw = "  Pag-ibig! e\u0301 ñ 😀\n"

    def answer(text):
        return {"text": text} if method == "identification" else {"blanks": [{"blank_id": "gap", "text": text}]}

    response = add(
        StudentResponse(
            attempt_id=attempt.id, assignment_question_id=item.id, assignment_version_id=version.id, answer=answer(raw)
        )
    )
    db.expire(response)
    assert response.answer == answer(raw)
    assert response.correct is None and response.awarded_points is None
    with pytest.raises(ValueError, match="input_max_length"), db.begin_nested():
        response.answer = answer("x" * 501)
        db.flush()
    db.refresh(response)
    assert response.answer == answer(raw)
