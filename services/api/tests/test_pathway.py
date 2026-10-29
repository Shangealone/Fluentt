from datetime import datetime, timezone
from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.modules.progress.pathway_schemas import (
    Pathway,
    CurrentPosition,
    EligibleActivity,
    CurrentMilestone,
    Recommendation,
    PrerequisiteStatus,
)


def test_pathway_schema_validation():
    now = datetime.now(timezone.utc)
    pathway = Pathway(
        availability="available",
        as_of=now,
        policy_version="deterministic-curriculum-v1",
        student_role="school_student",
        class_id=uuid4(),
        class_name="Grade 7 - Mabini",
        current_position=CurrentPosition(
            curriculum_version_id=uuid4(),
            curriculum_version_name="DepEd MATATAG 2024",
            grade_number=7,
            subject_id=uuid4(),
            subject_name="Filipino",
            topic_id=uuid4(),
            topic_name="Panitikan",
            lesson_id=uuid4(),
            lesson_name="Kuwentong Bayan",
            position_index=1,
            total_lessons_in_topic=3,
        ),
        eligible_activities=[
            EligibleActivity(
                activity_type="assignment",
                id=uuid4(),
                title="Pagsusuri sa Kuwentong Bayan",
                topic_name="Panitikan",
                position=1,
                prerequisites=PrerequisiteStatus(
                    total_required=0,
                    fulfilled=0,
                    all_met=True,
                ),
                is_required=True,
                status="available",
            )
        ],
        completed_milestones=[],
        recommendations=[
            Recommendation(
                id="rec-1",
                recommendation_type="classroom_assignment",
                title="Start assignment: Pagsusuri sa Kuwentong Bayan",
                reason="Required classroom assignment ready for your attention.",
                target_id=uuid4(),
                is_required=True,
            )
        ],
    )

    assert pathway.availability == "available"
    assert pathway.policy_version == "deterministic-curriculum-v1"
    assert len(pathway.eligible_activities) == 1
    assert pathway.eligible_activities[0].prerequisites.all_met is True


def test_pathway_schema_rejects_extra_fields():
    with pytest.raises(ValidationError):
        Pathway(
            availability="available",
            as_of=datetime.now(timezone.utc),
            student_role="school_student",
            ai_predicted_retention=0.95,  # Forbidden extra field!
        )
