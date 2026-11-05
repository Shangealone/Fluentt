"""Allow class question supplements alongside frozen teacher lessons."""
from alembic import op

revision = "0028_teacher_supplements"
down_revision = "0027_automatic_results"
branch_labels = None
depends_on = None

ORIGINAL = """IF (v.id IS NULL) IS DISTINCT FROM (root IS NULL) OR (root IS NOT NULL AND (v.teacher_lesson_id<>root OR v.language<>NEW.language OR v.published_at IS NOT NULL)) THEN"""
WITH_SUPPLEMENTS = """IF (NOT (
                  v.id IS NOT NULL AND v.published_at IS NOT NULL AND v.language=NEW.language
                  AND root IS NULL AND EXISTS (
                    SELECT 1 FROM instructor_lesson_questions s
                    JOIN teacher_lessons t ON t.id=v.teacher_lesson_id AND t.instructor_id=s.instructor_id
                    WHERE s.question_id=NEW.question_id AND s.lesson_id=NEW.lesson_id
                  )
                )) AND (
                  (v.id IS NULL) IS DISTINCT FROM (root IS NULL)
                  OR (root IS NOT NULL AND (v.teacher_lesson_id<>root OR v.language<>NEW.language OR v.published_at IS NOT NULL))
                ) THEN"""


def _replace_guard(previous, replacement):
    definition = op.get_bind().exec_driver_sql(
        "SELECT pg_get_functiondef('public.fluentt_guard_teacher_content()'::regprocedure)"
    ).scalar_one()
    if definition.count(previous) != 1:
        raise RuntimeError("Unexpected teacher content guard")
    op.execute(definition.replace(previous, replacement, 1))


def upgrade():
    _replace_guard(ORIGINAL, WITH_SUPPLEMENTS)


def downgrade():
    op.execute("""DO $$ BEGIN
        IF EXISTS (
            SELECT 1 FROM instructor_lesson_questions s
            JOIN teacher_lesson_versions v ON v.lesson_id=s.lesson_id
        ) THEN
            RAISE EXCEPTION 'Cannot downgrade retained teacher lesson question supplements';
        END IF;
    END $$""")
    _replace_guard(WITH_SUPPLEMENTS, ORIGINAL)
