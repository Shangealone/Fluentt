"""Version and retain accepted research evidence; leave historical links unknown."""

import sqlalchemy as sa

from alembic import op
from app.research_logging.integrity_ddl import (
    GUARDED_TABLES,
    HISTORY_TABLES,
    RESEARCH_INTEGRITY_DDL,
)

revision = "d9c0de000001"
down_revision = "d8c0de000001"
branch_labels = None
depends_on = None

# Exact relationships inspected in the pre-D9 schema. No historical row rewrite.
RETAINED_FKS = (
    ("review_sessions", "user_id", "users", "fk_review_session_user_retained"),
    ("review_attempts", "user_id", "users", "fk_review_attempt_user_retained"),
    (
        "review_attempts",
        "session_id",
        "review_sessions",
        "fk_review_attempt_session_retained",
    ),
    ("review_schedules", "user_id", "users", "fk_review_schedule_user_retained"),
    (
        "review_schedules",
        "vocabulary_item_id",
        "vocabulary_items",
        "fk_review_schedule_item_retained",
    ),
    (
        "review_schedules",
        "attempt_id",
        "review_attempts",
        "fk_review_schedule_attempt_retained",
    ),
    ("accepted_client_events", "user_id", "users", "fk_accepted_event_user_retained"),
    (
        "accepted_client_events",
        "attempt_id",
        "review_attempts",
        "fk_accepted_event_attempt_retained",
    ),
    ("research_events", "user_id", "users", "fk_research_user_retained"),
)


def upgrade() -> None:
    op.add_column(
        "research_events", sa.Column("schema_version", sa.String(32), nullable=True)
    )
    op.add_column(
        "research_events", sa.Column("review_attempt_id", sa.Uuid(), nullable=True)
    )
    op.create_index(
        "ix_research_events_review_attempt_id", "research_events", ["review_attempt_id"]
    )
    op.create_unique_constraint(
        "uq_review_attempt_owner", "review_attempts", ["id", "user_id"]
    )
    op.create_foreign_key(
        "fk_research_attempt_owner",
        "research_events",
        "review_attempts",
        ["review_attempt_id", "user_id"],
        ["id", "user_id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint(
        "uq_current_review_event",
        "research_events",
        ["review_attempt_id", "event_type", "schema_version"],
    )
    op.create_check_constraint(
        "ck_current_review_event",
        "research_events",
        "(schema_version IS NULL AND review_attempt_id IS NULL) OR "
        "(schema_version IS NOT NULL AND schema_version = 'review-events-1' AND review_attempt_id IS NOT NULL "
        "AND event_type IN ('REVIEW_ANSWERED', 'REVIEW_SCHEDULED') "
        'AND CAST(payload AS jsonb) = \'{"scope":"item_attempt"}\'::jsonb)',
    )
    for table, column, target, new_name in RETAINED_FKS:
        matches = [
            fk
            for fk in sa.inspect(op.get_bind()).get_foreign_keys(table)
            if fk["constrained_columns"] == [column] and fk["referred_table"] == target
        ]
        if len(matches) != 1:
            raise RuntimeError(f"Unexpected historical FK: {table}.{column}")
        op.drop_constraint(matches[0]["name"], table, type_="foreignkey")
        op.create_foreign_key(
            new_name, table, target, [column], ["id"], ondelete="RESTRICT"
        )
    for statement in RESEARCH_INTEGRITY_DDL:
        op.execute(statement)


def downgrade() -> None:
    for table in HISTORY_TABLES:
        if op.get_bind().scalar(sa.text(f"SELECT EXISTS (SELECT 1 FROM {table})")):
            raise RuntimeError(
                "Cannot remove protection of accepted research evidence; approved policy required"
            )
    for table in HISTORY_TABLES:
        op.execute(f"DROP TRIGGER d9_immutable_row ON {table}")
    for table in GUARDED_TABLES:
        op.execute(f"DROP TRIGGER d9_no_truncate ON {table}")
    op.execute("DROP TRIGGER d9_immutable_session ON review_sessions")
    op.execute("DROP TRIGGER d9_immutable_code ON users")
    for function in (
        "fluentt_research_immutable",
        "fluentt_research_session_immutable",
        "fluentt_participant_code_immutable",
    ):
        op.execute(f"DROP FUNCTION {function}()")
    op.drop_constraint("ck_current_review_event", "research_events", type_="check")
    op.drop_constraint("uq_current_review_event", "research_events", type_="unique")
    op.drop_constraint(
        "fk_research_attempt_owner", "research_events", type_="foreignkey"
    )
    op.drop_constraint("uq_review_attempt_owner", "review_attempts", type_="unique")
    op.drop_index("ix_research_events_review_attempt_id", table_name="research_events")
    op.drop_column("research_events", "review_attempt_id")
    op.drop_column("research_events", "schema_version")
    for table, column, target, name in RETAINED_FKS:
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(
            f"{table}_{column}_fkey",
            table,
            target,
            [column],
            ["id"],
            ondelete="CASCADE",
        )
