"""Independent review state for shared assignment results."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0026_assignment_practice"
down_revision = "0025_assessed_proficiency"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "assignment_practice_states",
        sa.Column(
            "result_id", sa.UUID(), sa.ForeignKey("grading_item_results.id", ondelete="RESTRICT"), primary_key=True
        ),
        sa.Column("memory", JSONB(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.UUID(), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("last_correct", sa.Boolean(), nullable=False),
        sa.CheckConstraint("revision > 0", name=op.f("ck_assignment_practice_states_positive_revision")),
    )
    op.execute("REVOKE ALL ON assignment_practice_states FROM PUBLIC")


def downgrade():
    op.execute("""DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM assignment_practice_states) THEN
            RAISE EXCEPTION 'Cannot drop retained assignment practice';
        END IF;
    END $$""")
    op.drop_table("assignment_practice_states")
