"""One resumable unscored capture, preserving distributed assignment versions."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0009_response_capture"
down_revision = "0008_assignment_publication"
branch_labels = depends_on = None


def upgrade():
    op.add_column("assignment_attempts", sa.Column("capture_contract", sa.String(40), nullable=True))
    op.add_column("assignment_attempts", sa.Column("capture_state", JSONB(), nullable=True))
    op.add_column("assignment_attempts", sa.Column("submission_fingerprint", sa.String(64), nullable=True))
    op.execute("""CREATE OR REPLACE FUNCTION fluentt_require_locked_assignment() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE v public.assignment_versions%ROWTYPE; BEGIN
      SELECT * INTO v FROM public.assignment_versions WHERE id=NEW.assignment_version_id FOR SHARE;
      IF NEW.capture_contract IS NOT NULL THEN
        IF NEW.capture_contract <> 'unscored-capture-v1' OR v.locked_at IS NULL
          OR v.publication_contract IS DISTINCT FROM 'distribution-only-v1' OR NEW.attempt_number<>1
          OR NEW.expires_at IS NOT NULL OR NEW.score IS NOT NULL OR NEW.maximum_score IS NOT NULL
          OR NEW.status NOT IN ('in_progress','submitted') OR NEW.capture_state IS NULL
          OR jsonb_typeof(NEW.capture_state)<>'object' THEN
          RAISE EXCEPTION 'Invalid unscored capture contract' USING ERRCODE='23514'; END IF;
      ELSIF v.locked_at IS NULL OR v.publication_contract IS NOT NULL OR v.max_attempts IS NULL
        OR EXISTS (SELECT 1 FROM public.assignment_questions WHERE assignment_version_id=v.id AND points IS NULL)
      THEN RAISE EXCEPTION 'Attempt requires a configured executable version' USING ERRCODE='23514'; END IF;
      RETURN NEW; END; $$""")
    op.execute("""CREATE FUNCTION fluentt_guard_capture_attempt() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
      IF TG_OP<>'INSERT' AND OLD.capture_contract IS NOT NULL THEN
        IF TG_OP='DELETE' OR OLD.status='submitted' THEN
          RAISE EXCEPTION 'Retain capture history' USING ERRCODE='23514'; END IF;
        IF (NEW.student_id,NEW.assignment_version_id,NEW.attempt_number,NEW.started_at,NEW.capture_contract)
          IS DISTINCT FROM (OLD.student_id,OLD.assignment_version_id,OLD.attempt_number,OLD.started_at,OLD.capture_contract)
        THEN RAISE EXCEPTION 'Capture identity is immutable' USING ERRCODE='23514'; END IF;
      ELSIF TG_OP='UPDATE' AND NEW.capture_contract IS DISTINCT FROM OLD.capture_contract THEN
        RAISE EXCEPTION 'Do not convert historical attempts' USING ERRCODE='23514';
      END IF;
      IF TG_OP<>'DELETE' AND NEW.capture_contract IS NOT NULL AND NEW.status='submitted'
        AND (NEW.submission_key IS NULL OR NEW.submission_fingerprint IS NULL OR NEW.submitted_at IS NULL)
      THEN RAISE EXCEPTION 'Finalization identity required' USING ERRCODE='23514'; END IF;
      IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END; $$""")
    op.execute(
        "CREATE TRIGGER guard_capture_attempt BEFORE INSERT OR UPDATE OR DELETE ON assignment_attempts "
        "FOR EACH ROW EXECUTE FUNCTION fluentt_guard_capture_attempt()"
    )
    op.execute("""CREATE FUNCTION fluentt_guard_capture_response() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE a public.assignment_attempts%ROWTYPE; BEGIN
      IF TG_OP='UPDATE' AND (NEW.attempt_id,NEW.assignment_version_id,NEW.assignment_question_id)
        IS DISTINCT FROM (OLD.attempt_id,OLD.assignment_version_id,OLD.assignment_question_id)
        AND EXISTS (SELECT 1 FROM public.assignment_attempts WHERE id IN (OLD.attempt_id,NEW.attempt_id) AND capture_contract IS NOT NULL) THEN
        RAISE EXCEPTION 'Response identity is immutable' USING ERRCODE='23514'; END IF;
      SELECT * INTO a FROM public.assignment_attempts WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.attempt_id ELSE NEW.attempt_id END FOR UPDATE;
      IF a.capture_contract IS NOT NULL THEN
        IF a.status<>'in_progress' THEN RAISE EXCEPTION 'Submitted responses are immutable' USING ERRCODE='23514'; END IF;
        IF TG_OP<>'DELETE' AND (NEW.correct IS NOT NULL OR NEW.awarded_points IS NOT NULL
          OR NEW.response_duration_ms IS NOT NULL OR NEW.feedback IS NOT NULL OR NEW.grading_version IS NOT NULL
          OR NEW.grading_status<>'unscored') THEN
          RAISE EXCEPTION 'No grading or telemetry in unscored capture' USING ERRCODE='23514'; END IF;
      END IF;
      IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END; $$""")
    op.execute(
        "CREATE TRIGGER guard_capture_response BEFORE INSERT OR UPDATE OR DELETE ON student_responses "
        "FOR EACH ROW EXECUTE FUNCTION fluentt_guard_capture_response()"
    )


def downgrade():
    op.execute("""DO $$ BEGIN IF EXISTS (SELECT 1 FROM assignment_attempts WHERE capture_contract IS NOT NULL)
      THEN RAISE EXCEPTION 'Preserve response capture history'; END IF; END $$""")
    op.execute("DROP TRIGGER guard_capture_response ON student_responses")
    op.execute("DROP FUNCTION fluentt_guard_capture_response()")
    op.execute("DROP TRIGGER guard_capture_attempt ON assignment_attempts")
    op.execute("DROP FUNCTION fluentt_guard_capture_attempt()")
    op.execute("""CREATE OR REPLACE FUNCTION fluentt_require_locked_assignment() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE v public.assignment_versions%ROWTYPE; BEGIN
      SELECT * INTO v FROM public.assignment_versions WHERE id=NEW.assignment_version_id FOR SHARE;
      IF v.locked_at IS NULL OR v.publication_contract IS NOT NULL OR v.max_attempts IS NULL
        OR EXISTS (SELECT 1 FROM public.assignment_questions WHERE assignment_version_id=v.id AND points IS NULL)
      THEN RAISE EXCEPTION 'Attempt requires a configured executable version' USING ERRCODE='23514'; END IF;
      RETURN NEW; END; $$""")
    for column in ("submission_fingerprint", "capture_state", "capture_contract"):
        op.drop_column("assignment_attempts", column)
