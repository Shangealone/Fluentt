from sqlalchemy import event, select

from app.models.assessments import (
    AssignmentAttempt,
    AssignmentQuestion,
    QuestionAnswerKey,
    QuestionRevision,
    StudentResponse,
)
from app.schemas.question_config import validate_definition, validate_prompt, validate_response


@event.listens_for(QuestionRevision, "before_insert")
@event.listens_for(QuestionRevision, "before_update")
def validate_question_content(mapper, connection, target):
    validate_prompt(target.method, target.content, target.prompt)
    existing_key = connection.execute(
        select(QuestionAnswerKey.configuration).where(QuestionAnswerKey.question_revision_id == target.id)
    ).scalar_one_or_none()
    if existing_key is not None:
        validate_definition(target.method, target.content, existing_key)


@event.listens_for(QuestionAnswerKey, "before_insert")
@event.listens_for(QuestionAnswerKey, "before_update")
def validate_answer_key(mapper, connection, target):
    revision = connection.execute(
        select(QuestionRevision.method, QuestionRevision.content).where(
            QuestionRevision.id == target.question_revision_id
        )
    ).one()
    validate_definition(revision.method, revision.content, target.configuration)


@event.listens_for(StudentResponse, "before_insert")
@event.listens_for(StudentResponse, "before_update")
def validate_student_response(mapper, connection, target):
    revision = connection.execute(
        select(QuestionRevision.method, QuestionRevision.content)
        .join(AssignmentQuestion, AssignmentQuestion.question_revision_id == QuestionRevision.id)
        .where(AssignmentQuestion.id == target.assignment_question_id)
    ).one()
    from app.schemas.capture import CONTRACT, validate_capture

    contract = connection.scalar(
        select(AssignmentAttempt.capture_contract).where(AssignmentAttempt.id == target.attempt_id)
    )
    if contract == CONTRACT:
        validate_capture(revision.method, revision.content, target.answer)
    else:
        validate_response(revision.method, revision.content, target.answer)
