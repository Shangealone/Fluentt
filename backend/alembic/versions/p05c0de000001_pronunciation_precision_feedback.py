"""Preserve decimal precision and permit terminal feedback on all outcomes."""

import sqlalchemy as sa

from alembic import op

revision = "p05c0de000001"
down_revision = "p04c0de000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for name in (
        "accuracy_score",
        "pronunciation_score",
        "completeness_score",
        "fluency_score",
    ):
        op.alter_column("pronunciation_results", name, type_=sa.Numeric())
    op.drop_constraint(
        "ck_pronunciation_result_scored_feedback", "pronunciation_results"
    )
    op.create_check_constraint(
        "ck_pronunciation_result_scored_feedback",
        "pronunciation_results",
        "status != 'scored' OR general_feedback_key IS NOT NULL",
    )


def downgrade() -> None:
    # The previous contract truncates scores and rejects legitimate feedback.
    raise RuntimeError(
        "Pronunciation precision/feedback repair cannot be safely downgraded"
    )
