"""Preserve same-lesson question competency associations in both write directions."""

from alembic import op

revision = "0006_question_associations"
down_revision = "0005_constraint_names"
branch_labels = None
depends_on = None

GUARD = """CREATE FUNCTION fluentt_guard_question_association() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(78090001);
  IF TG_TABLE_NAME='question_competencies' THEN
    IF EXISTS (SELECT 1 FROM public.question_revisions r, public.learning_competencies c
      WHERE r.id=NEW.question_revision_id AND c.id=NEW.competency_id AND r.lesson_id<>c.lesson_id) THEN
      RAISE EXCEPTION 'Question competency must belong to its lesson' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='question_revisions' THEN
    IF EXISTS (SELECT 1 FROM public.question_competencies q JOIN public.learning_competencies c ON c.id=q.competency_id
      WHERE q.question_revision_id=NEW.id AND c.lesson_id<>NEW.lesson_id) THEN
      RAISE EXCEPTION 'Preserve question competency lesson relationship' USING ERRCODE='23514';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.question_competencies q JOIN public.question_revisions r ON r.id=q.question_revision_id
      WHERE q.competency_id=NEW.id AND r.lesson_id<>NEW.lesson_id) THEN
      RAISE EXCEPTION 'Referenced competency cannot move away from question lesson' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END; $$"""


def upgrade():
    # Abort rather than relabel or delete pre-existing inconsistent associations.
    op.execute("""DO $$ BEGIN
      PERFORM pg_advisory_xact_lock(78090001);
      IF EXISTS (SELECT 1 FROM question_competencies q JOIN question_revisions r ON r.id=q.question_revision_id
        JOIN learning_competencies c ON c.id=q.competency_id WHERE r.lesson_id<>c.lesson_id) THEN
        RAISE EXCEPTION 'Existing question associations need operator review; no data was changed';
      END IF;
    END $$""")
    op.execute(GUARD)
    for table in ("question_competencies", "question_revisions", "learning_competencies"):
        op.execute(
            f"CREATE TRIGGER guard_question_association BEFORE INSERT OR UPDATE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION fluentt_guard_question_association()"
        )


def downgrade():
    for table in ("question_competencies", "question_revisions", "learning_competencies"):
        op.execute(f"DROP TRIGGER guard_question_association ON {table}")
    op.execute("DROP FUNCTION fluentt_guard_question_association()")
