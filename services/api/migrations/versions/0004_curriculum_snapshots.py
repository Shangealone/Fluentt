"""Freeze published curriculum hierarchies without rewriting existing content or frozen revisions."""

from alembic import op

revision = "0004_curriculum_snapshots"
down_revision = "0003_admin_sessions"
branch_labels = None
depends_on = None

CHILDREN = {
    "curriculum_grades": ("curriculum_versions", "curriculum_version_id"),
    "curriculum_subjects": ("curriculum_grades", "curriculum_grade_id"),
    "quarters": ("curriculum_subjects", "curriculum_subject_id"),
    "curriculum_topics": ("quarters", "quarter_id"),
    "lessons": ("curriculum_topics", "topic_id"),
    "learning_competencies": ("lessons", "lesson_id"),
}

ROOT = """CREATE FUNCTION fluentt_curriculum_root(kind text, node uuid) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE parent uuid;
BEGIN
  CASE kind
    WHEN 'curriculum_versions' THEN RETURN node;
    WHEN 'curriculum_grades' THEN SELECT curriculum_version_id INTO parent FROM public.curriculum_grades WHERE id=node;
    WHEN 'curriculum_subjects' THEN SELECT curriculum_grade_id INTO parent FROM public.curriculum_subjects WHERE id=node;
    WHEN 'quarters' THEN SELECT curriculum_subject_id INTO parent FROM public.quarters WHERE id=node;
    WHEN 'curriculum_topics' THEN SELECT quarter_id INTO parent FROM public.curriculum_topics WHERE id=node;
    WHEN 'lessons' THEN SELECT topic_id INTO parent FROM public.lessons WHERE id=node;
    WHEN 'learning_competencies' THEN SELECT lesson_id INTO parent FROM public.learning_competencies WHERE id=node;
    ELSE RAISE EXCEPTION 'Unknown curriculum node' USING ERRCODE='23514';
  END CASE;
  IF parent IS NULL THEN RETURN NULL; END IF;
  RETURN public.fluentt_curriculum_root(CASE kind
    WHEN 'curriculum_grades' THEN 'curriculum_versions' WHEN 'curriculum_subjects' THEN 'curriculum_grades'
    WHEN 'quarters' THEN 'curriculum_subjects' WHEN 'curriculum_topics' THEN 'quarters'
    WHEN 'lessons' THEN 'curriculum_topics' ELSE 'lessons' END, parent);
END; $$"""

FROZEN = """CREATE FUNCTION fluentt_curriculum_frozen(root uuid) RETURNS boolean
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.curriculum_versions WHERE id=root AND (status != 'draft' OR published_at IS NOT NULL))
    OR EXISTS (
      SELECT 1 FROM public.lessons l JOIN public.curriculum_topics t ON t.id=l.topic_id
      JOIN public.quarters q ON q.id=t.quarter_id
      JOIN public.curriculum_subjects s ON s.id=q.curriculum_subject_id
      JOIN public.curriculum_grades g ON g.id=s.curriculum_grade_id
      WHERE g.curriculum_version_id=root AND (
        EXISTS (SELECT 1 FROM public.assignment_versions a WHERE a.lesson_id=l.id)
        OR EXISTS (SELECT 1 FROM public.learner_progress p WHERE p.lesson_id=l.id)));
END; $$"""

VERSION_GUARD = """CREATE FUNCTION fluentt_guard_curriculum_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(78090001);
  IF TG_OP='INSERT' THEN
    IF NEW.status != 'draft' OR NEW.published_at IS NOT NULL OR NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Create a draft curriculum version before publication' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN
    IF public.fluentt_curriculum_frozen(OLD.id) THEN
      RAISE EXCEPTION 'Referenced or published curriculum must be preserved' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Curriculum identity is immutable' USING ERRCODE='23514';
  END IF;
  IF public.fluentt_curriculum_frozen(OLD.id) AND
     (to_jsonb(OLD)-ARRAY['status','published_at','archived_at','updated_at']) IS DISTINCT FROM
     (to_jsonb(NEW)-ARRAY['status','published_at','archived_at','updated_at']) THEN
    RAISE EXCEPTION 'Create a new curriculum version for corrections' USING ERRCODE='23514';
  END IF;
  IF OLD.status='archived' THEN
    IF (to_jsonb(OLD)-'updated_at') IS DISTINCT FROM (to_jsonb(NEW)-'updated_at') THEN
      RAISE EXCEPTION 'Retired curriculum cannot be restored or rewritten' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='published' AND NEW.status NOT IN ('published','archived') THEN
    RAISE EXCEPTION 'Published curriculum cannot return to draft' USING ERRCODE='23514';
  END IF;
  IF (OLD.published_at IS NOT NULL OR OLD.status != 'draft') AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'Publication evidence is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status='draft' AND (NEW.published_at IS NOT NULL OR NEW.archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Draft lifecycle timestamps are invalid' USING ERRCODE='23514';
  ELSIF OLD.status='draft' AND NEW.status='published' THEN
    NEW.published_at := coalesce(NEW.published_at, clock_timestamp());
    IF NEW.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Published curriculum is not retired' USING ERRCODE='23514'; END IF;
  ELSIF NEW.status='published' AND NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Published curriculum is not retired' USING ERRCODE='23514';
  ELSIF NEW.status='archived' THEN
    NEW.archived_at := coalesce(NEW.archived_at, clock_timestamp());
    IF OLD.status='draft' AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
      RAISE EXCEPTION 'Do not fabricate publication evidence' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END; $$"""

CHILD_GUARD = """CREATE FUNCTION fluentt_guard_curriculum_child() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE root uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(78090001);
  IF TG_OP != 'INSERT' THEN
    root := public.fluentt_curriculum_root(TG_ARGV[0], (to_jsonb(OLD)->>TG_ARGV[1])::uuid);
    IF public.fluentt_curriculum_frozen(root) THEN
      RAISE EXCEPTION 'Published or historically referenced curriculum hierarchy is immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP != 'DELETE' THEN
    root := public.fluentt_curriculum_root(TG_ARGV[0], (to_jsonb(NEW)->>TG_ARGV[1])::uuid);
    IF public.fluentt_curriculum_frozen(root) THEN
      RAISE EXCEPTION 'Cannot attach content to a frozen curriculum version' USING ERRCODE='23514';
    END IF;
    IF TG_OP='UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Curriculum node identity is immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END; $$"""

REFERENCE_GUARD = """CREATE FUNCTION fluentt_guard_curriculum_reference() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE frozen boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(78090001);
  IF TG_OP='INSERT' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND (to_jsonb(OLD)-'updated_at') IS NOT DISTINCT FROM (to_jsonb(NEW)-'updated_at') THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='grade_levels' THEN
    SELECT EXISTS (SELECT 1 FROM public.curriculum_grades g
      WHERE g.grade_level_id=OLD.id AND public.fluentt_curriculum_frozen(g.curriculum_version_id)) INTO frozen;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.curriculum_subjects s JOIN public.curriculum_grades g ON g.id=s.curriculum_grade_id
      WHERE s.subject_id=OLD.id AND public.fluentt_curriculum_frozen(g.curriculum_version_id)) INTO frozen;
  END IF;
  IF frozen THEN RAISE EXCEPTION 'Shared curriculum labels referenced by frozen versions are immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$"""

HISTORY_GUARD = """CREATE FUNCTION fluentt_guard_curriculum_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.lesson_id IS NOT DISTINCT FROM OLD.lesson_id THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(78090001);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$"""


def upgrade():
    for statement in (ROOT, FROZEN, VERSION_GUARD, CHILD_GUARD, REFERENCE_GUARD, HISTORY_GUARD):
        op.execute(statement)
    op.execute(
        "CREATE TRIGGER guard_curriculum_version BEFORE INSERT OR UPDATE OR DELETE ON curriculum_versions "
        "FOR EACH ROW EXECUTE FUNCTION fluentt_guard_curriculum_version()"
    )
    for table, (parent, field) in CHILDREN.items():
        op.execute(
            f"CREATE TRIGGER guard_curriculum_child BEFORE INSERT OR UPDATE OR DELETE ON {table} "
            f"FOR EACH ROW EXECUTE FUNCTION fluentt_guard_curriculum_child('{parent}', '{field}')"
        )
    for table in ("grade_levels", "subjects"):
        op.execute(
            f"CREATE TRIGGER guard_curriculum_reference BEFORE INSERT OR UPDATE OR DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION fluentt_guard_curriculum_reference()"
        )
    for table in ("assignment_versions", "learner_progress"):
        op.execute(
            f"CREATE TRIGGER guard_curriculum_history BEFORE INSERT OR UPDATE OR DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION fluentt_guard_curriculum_history()"
        )


def downgrade():
    op.execute("""DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM curriculum_versions v WHERE fluentt_curriculum_frozen(v.id)) THEN
        RAISE EXCEPTION 'Preserve frozen curriculum protections; reviewed downgrade required';
      END IF;
    END $$""")
    for table in ("grade_levels", "subjects"):
        op.execute(f"DROP TRIGGER guard_curriculum_reference ON {table}")
    for table in ("assignment_versions", "learner_progress"):
        op.execute(f"DROP TRIGGER guard_curriculum_history ON {table}")
    for table in CHILDREN:
        op.execute(f"DROP TRIGGER guard_curriculum_child ON {table}")
    op.execute("DROP TRIGGER guard_curriculum_version ON curriculum_versions")
    for function in (
        "fluentt_guard_curriculum_history()",
        "fluentt_guard_curriculum_reference()",
        "fluentt_guard_curriculum_child()",
        "fluentt_guard_curriculum_version()",
        "fluentt_curriculum_frozen(uuid)",
        "fluentt_curriculum_root(text, uuid)",
    ):
        op.execute(f"DROP FUNCTION {function}")
