"""Freeze distribution-only versions without enabling assessment attempts."""

from alembic import op
import sqlalchemy as sa

revision = "0008_assignment_publication"
down_revision = "0007_assignment_drafts"
branch_labels = depends_on = None


def upgrade():
    op.add_column("assignment_versions", sa.Column("publication_contract", sa.String(40), nullable=True))
    op.add_column("assignment_versions", sa.Column("publication_request_id", sa.Uuid(), nullable=True))
    op.execute("""CREATE OR REPLACE FUNCTION fluentt_require_assignment_configuration() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
      IF NEW.publication_contract IS NOT NULL THEN
        IF NEW.publication_contract <> 'distribution-only-v1' OR NEW.publication_request_id IS NULL
          OR NEW.locked_at IS NULL OR NEW.max_attempts IS NOT NULL OR NEW.starts_at IS NOT NULL
          OR NEW.due_at IS NOT NULL OR NEW.time_limit_seconds IS NOT NULL OR NEW.grading_policy <> '{}'::jsonb
          OR EXISTS (SELECT 1 FROM public.assignment_questions WHERE assignment_version_id=NEW.id AND points IS NOT NULL)
        THEN RAISE EXCEPTION 'Invalid distribution-only publication' USING ERRCODE='23514'; END IF;
      ELSIF NEW.publication_request_id IS NOT NULL THEN
        RAISE EXCEPTION 'Publication contract required' USING ERRCODE='23514';
      ELSIF NEW.locked_at IS NOT NULL AND (NEW.max_attempts IS NULL OR EXISTS
        (SELECT 1 FROM public.assignment_questions WHERE assignment_version_id=NEW.id AND points IS NULL)) THEN
        RAISE EXCEPTION 'Configure attempt and item policies before locking' USING ERRCODE='23514';
      END IF; RETURN NEW; END; $$""")
    op.execute("""CREATE OR REPLACE FUNCTION fluentt_require_locked_assignment() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE v public.assignment_versions%ROWTYPE; BEGIN
      SELECT * INTO v FROM public.assignment_versions WHERE id=NEW.assignment_version_id FOR SHARE;
      IF v.locked_at IS NULL OR v.publication_contract IS NOT NULL OR v.max_attempts IS NULL
        OR EXISTS (SELECT 1 FROM public.assignment_questions WHERE assignment_version_id=v.id AND points IS NULL)
      THEN RAISE EXCEPTION 'Attempt requires a configured executable version' USING ERRCODE='23514'; END IF;
      RETURN NEW; END; $$""")
    op.execute("""CREATE FUNCTION fluentt_guard_distributed_assignment() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
      IF TG_OP='UPDATE' AND OLD.status='published' AND EXISTS
        (SELECT 1 FROM public.assignment_versions WHERE assignment_id=OLD.id AND publication_contract='distribution-only-v1')
      THEN RAISE EXCEPTION 'Distributed assignment is immutable' USING ERRCODE='23514'; END IF;
      IF NEW.status='published' AND EXISTS
        (SELECT 1 FROM public.assignment_versions WHERE assignment_id=NEW.id AND publication_contract='distribution-only-v1')
        AND (SELECT count(*) FROM public.assignment_versions WHERE assignment_id=NEW.id) <> 1
      THEN RAISE EXCEPTION 'Distribution requires one pinned version' USING ERRCODE='23514'; END IF;
      RETURN NEW; END; $$""")
    op.execute(
        "CREATE TRIGGER guard_distributed_assignment BEFORE UPDATE ON assignments "
        "FOR EACH ROW EXECUTE FUNCTION fluentt_guard_distributed_assignment()"
    )
    op.execute("""CREATE FUNCTION fluentt_guard_distributed_version() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
      PERFORM id FROM public.assignments WHERE id=NEW.assignment_id FOR UPDATE;
      IF EXISTS (SELECT 1 FROM public.assignment_versions WHERE assignment_id=NEW.assignment_id AND id<>NEW.id
        AND publication_contract='distribution-only-v1') THEN
        RAISE EXCEPTION 'Distributed assignment cannot acquire new versions' USING ERRCODE='23514'; END IF;
      RETURN NEW; END; $$""")
    op.execute(
        "CREATE TRIGGER guard_distributed_version BEFORE INSERT OR UPDATE OF assignment_id ON assignment_versions "
        "FOR EACH ROW EXECUTE FUNCTION fluentt_guard_distributed_version()"
    )


def downgrade():
    op.execute("""DO $$ BEGIN IF EXISTS (SELECT 1 FROM assignment_versions WHERE publication_contract IS NOT NULL)
      THEN RAISE EXCEPTION 'Preserve distributed assignment history'; END IF; END $$""")
    op.execute("DROP TRIGGER guard_distributed_assignment ON assignments")
    op.execute("DROP FUNCTION fluentt_guard_distributed_assignment()")
    op.execute("DROP TRIGGER guard_distributed_version ON assignment_versions")
    op.execute("DROP FUNCTION fluentt_guard_distributed_version()")
    # Restore the exact previous functions without changing frozen migration files.
    op.execute("""CREATE OR REPLACE FUNCTION fluentt_require_assignment_configuration() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
      IF NEW.locked_at IS NOT NULL AND (NEW.max_attempts IS NULL OR EXISTS
        (SELECT 1 FROM public.assignment_questions WHERE assignment_version_id=NEW.id AND points IS NULL)) THEN
        RAISE EXCEPTION 'Configure attempt and item policies before locking' USING ERRCODE='23514';
      END IF; RETURN NEW; END; $$""")
    op.execute("""CREATE OR REPLACE FUNCTION fluentt_require_locked_assignment() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE locked timestamptz; BEGIN
      SELECT locked_at INTO locked FROM public.assignment_versions WHERE id=NEW.assignment_version_id FOR SHARE;
      IF locked IS NULL THEN RAISE EXCEPTION 'Attempt requires a locked assignment version' USING ERRCODE='23514'; END IF;
      RETURN NEW; END; $$""")
    op.drop_column("assignment_versions", "publication_request_id")
    op.drop_column("assignment_versions", "publication_contract")
