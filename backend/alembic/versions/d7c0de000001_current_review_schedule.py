"""Retain historical schedules and establish one current pointer per learner/item.

Revision ID: d7c0de000001
Revises: d5a1c0de0001
"""

import sqlalchemy as sa

from alembic import op

revision = "d7c0de000001"
down_revision = "d5a1c0de0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(
        sa.text("""
        SELECT count(*) FROM review_schedules s JOIN review_attempts a ON a.id=s.attempt_id
        WHERE s.user_id<>a.user_id OR s.vocabulary_item_id<>a.vocabulary_item_id
    """)
    ):
        raise RuntimeError(
            "Inconsistent historical schedule ownership; migration refused"
        )
    if connection.scalar(
        sa.text("""
        SELECT count(*) FROM (
          SELECT user_id, vocabulary_item_id FROM (
            SELECT s.user_id, s.vocabulary_item_id, dense_rank() OVER (
              PARTITION BY s.user_id, s.vocabulary_item_id ORDER BY a.server_acceptance_at DESC
            ) AS rank FROM review_schedules s JOIN review_attempts a ON a.id=s.attempt_id
          ) ranked WHERE rank=1 GROUP BY user_id, vocabulary_item_id HAVING count(*)>1
        ) ambiguous
    """)
    ):
        raise RuntimeError("Ambiguous historical acceptance order; migration refused")
    op.create_unique_constraint(
        "uq_review_schedule_attempt", "review_schedules", ["attempt_id"]
    )
    op.create_unique_constraint(
        "uq_schedule_owner_item",
        "review_schedules",
        ["id", "user_id", "vocabulary_item_id"],
    )
    op.create_table(
        "current_review_schedules",
        sa.Column("user_id", sa.Uuid(), primary_key=True),
        sa.Column("vocabulary_item_id", sa.Uuid(), primary_key=True),
        sa.Column("schedule_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["schedule_id", "user_id", "vocabulary_item_id"],
            [
                "review_schedules.id",
                "review_schedules.user_id",
                "review_schedules.vocabulary_item_id",
            ],
            ondelete="CASCADE",
            name="fk_current_schedule_owner_item",
        ),
    )
    connection.execute(
        sa.text("""
        INSERT INTO current_review_schedules (user_id, vocabulary_item_id, schedule_id)
        SELECT user_id, vocabulary_item_id, id FROM (
          SELECT s.id, s.user_id, s.vocabulary_item_id, row_number() OVER (
            PARTITION BY s.user_id, s.vocabulary_item_id ORDER BY a.server_acceptance_at DESC
          ) AS rank FROM review_schedules s JOIN review_attempts a ON a.id=s.attempt_id
        ) ranked WHERE rank=1
    """)
    )


def downgrade() -> None:
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM current_review_schedules")):
        raise RuntimeError(
            "D7 downgrade refused: current acceptance order must be retained"
        )
    op.drop_table("current_review_schedules")
    op.drop_constraint("uq_schedule_owner_item", "review_schedules", type_="unique")
    op.drop_constraint("uq_review_schedule_attempt", "review_schedules", type_="unique")
