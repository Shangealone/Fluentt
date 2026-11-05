"""Allow a server-generated first release for the student's completed evaluation."""

from alembic import op
import sqlalchemy as sa

revision = "0027_automatic_results"
down_revision = "0026_assignment_practice"
branch_labels = None
depends_on = None

MANUAL = "AND r.instructor_id=u.id AND c.instructor_id=u.id AND u.role='instructor'"
AUTOMATIC = """AND (
    (NOT NEW.automatic AND r.instructor_id=u.id AND c.instructor_id=u.id AND u.role='instructor')
    OR (NEW.automatic AND u.id=a.student_id AND u.role='school_student'
        AND evidence.actor_id=u.id AND NEW.sequence=1 AND NEW.released
        AND NOT EXISTS (SELECT 1 FROM research_private.classroom_bindings b WHERE b.class_id=c.id)
        AND NOT EXISTS (SELECT 1 FROM research_private.esr_protocols p WHERE p.class_id=c.id))
)"""


def update_guard(previous, replacement):
    connection = op.get_bind()
    definition = connection.execute(
        sa.text("SELECT pg_get_functiondef('public.fluentt_guard_result_release()'::regprocedure)")
    ).scalar_one()
    if definition.count(previous) != 1:
        raise RuntimeError("Unexpected result release guard")
    op.execute(sa.text(definition.replace(previous, replacement)))


def upgrade():
    op.add_column(
        "assessment_result_releases", sa.Column("automatic", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    update_guard(MANUAL, AUTOMATIC)


def downgrade():
    op.execute("""DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM assessment_result_releases WHERE automatic) THEN
            RAISE EXCEPTION 'Cannot downgrade retained automatic releases';
        END IF;
    END $$""")
    update_guard(AUTOMATIC, MANUAL)
    op.drop_column("assessment_result_releases", "automatic")
