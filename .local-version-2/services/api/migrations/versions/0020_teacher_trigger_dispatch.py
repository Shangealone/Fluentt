"""Dispatch teacher-only trigger fields only for teacher lesson rows."""
from alembic import op

revision = "0020_teacher_trigger_dispatch"
down_revision = "0019_teacher_lessons"
branch_labels = None
depends_on = None

OLD = """IF TG_TABLE_NAME='teacher_lessons' AND TG_OP='UPDATE' AND NEW.instructor_id IS DISTINCT FROM OLD.instructor_id THEN
            RAISE EXCEPTION 'Teacher lesson ownership is immutable' USING ERRCODE='23514';
          ELSIF TG_TABLE_NAME='teacher_lesson_versions' THEN"""
NEW = """IF TG_TABLE_NAME='teacher_lessons' THEN
            IF TG_OP='UPDATE' AND NEW.instructor_id IS DISTINCT FROM OLD.instructor_id THEN
              RAISE EXCEPTION 'Teacher lesson ownership is immutable' USING ERRCODE='23514';
            END IF;
          ELSIF TG_TABLE_NAME='teacher_lesson_versions' THEN"""


def upgrade():
    definition = op.get_bind().exec_driver_sql(
        "SELECT pg_get_functiondef('public.fluentt_guard_teacher_content()'::regprocedure)"
    ).scalar_one()
    if definition.count(OLD) != 1:
        raise RuntimeError("The teacher content guard differs from migration 0019; review before changing it.")
    op.execute(definition.replace(OLD, NEW, 1))


def downgrade():
    raise RuntimeError("Downgrade would restore a trigger that blocks ordinary curriculum writes; reviewed downgrade required.")
