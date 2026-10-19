"""Preserve nullable, original D8 timing evidence without legacy backfill."""

import sqlalchemy as sa

from alembic import op

revision = "d8c0de000001"
down_revision = "d7c0de000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("review_attempts", sa.Column("timing_evidence", sa.JSON(none_as_null=True), nullable=True))


def downgrade() -> None:
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM review_attempts WHERE timing_evidence IS NOT NULL)")):
        raise RuntimeError("Cannot discard captured timing evidence")
    op.drop_column("review_attempts", "timing_evidence")
