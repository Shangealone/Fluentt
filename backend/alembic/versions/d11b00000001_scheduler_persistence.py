"""D11B additive frozen authority, nullable provenance and BIGINT intervals."""

import sqlalchemy as sa

from alembic import op
from app.research_authority.integrity_v1 import install
from app.research_authority.schema_v1 import TABLE_NAMES, tables

revision = "d11b00000001"
down_revision = "d9c0de000001"
branch_labels = None
depends_on = None


def frozen_tables():
    metadata = sa.MetaData()
    sa.Table("users", metadata, sa.Column("id", sa.Uuid(), primary_key=True))
    sa.Table("content_releases", metadata, sa.Column("id", sa.Uuid(), primary_key=True))
    sa.Table(
        "vocabulary_revisions",
        metadata,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("vocabulary_item_id", sa.Uuid()),
    )
    tables(metadata)
    return [table for table in metadata.sorted_tables if table.name in TABLE_NAMES]


def upgrade():
    # Additive constraints reference new, initially empty tables: no legacy backfill.
    if op.get_bind().scalar(
        sa.text(
            "SELECT EXISTS(SELECT 1 FROM review_attempts WHERE scheduler_type IN ('conventional_srs','enhanced_srs'))"
        )
    ):
        raise RuntimeError(
            "D11 migration preflight: existing research labels lack frozen assignment provenance"
        )
    op.alter_column(
        "review_schedules",
        "interval_seconds",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
    )
    for table in frozen_tables():
        table.create(op.get_bind())
    op.add_column(
        "review_attempts", sa.Column("research_assignment_id", sa.Uuid(), nullable=True)
    )
    op.create_foreign_key(
        "fk_d11_attempt_condition",
        "review_attempts",
        "participant_set_conditions",
        ["research_assignment_id", "user_id", "scheduler_type", "algorithm_version"],
        ["id", "user_id", "scheduler_type", "algorithm_version"],
        ondelete="RESTRICT",
    )
    op.create_check_constraint(
        "ck_d11_attempt_assignment",
        "review_attempts",
        "(research_assignment_id IS NOT NULL) = (scheduler_type IN ('conventional_srs','enhanced_srs'))",
    )
    install(op.get_bind())


def downgrade():
    connection = op.get_bind()
    if connection.scalar(
        sa.text(
            "SELECT EXISTS(SELECT 1 FROM review_schedules WHERE interval_seconds > 2147483647 OR interval_seconds < -2147483648)"
        )
    ):
        raise RuntimeError(
            "Cannot safely downcast BIGINT intervals: values do not fit INTEGER"
        )
    if connection.scalar(
        sa.text(
            "SELECT EXISTS(SELECT 1 FROM research_protocols) OR EXISTS(SELECT 1 FROM review_attempts WHERE research_assignment_id IS NOT NULL)"
        )
    ):
        raise RuntimeError("Cannot remove populated frozen D11 research authority")
    op.execute("DROP TRIGGER d11_validate_insert ON review_attempts")
    op.drop_constraint(
        "fk_d11_attempt_condition", "review_attempts", type_="foreignkey"
    )
    op.drop_constraint("ck_d11_attempt_assignment", "review_attempts", type_="check")
    op.drop_column("review_attempts", "research_assignment_id")
    for table in reversed(frozen_tables()):
        table.drop(connection)
    for function in (
        "attempt_valid",
        "condition_valid",
        "order_valid",
        "member_valid",
        "frozen_immutable",
    ):
        op.execute(f"DROP FUNCTION fluentt_d11_{function}()")
    op.alter_column(
        "review_schedules",
        "interval_seconds",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
    )
