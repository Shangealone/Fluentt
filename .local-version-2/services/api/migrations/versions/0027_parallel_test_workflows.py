"""Add guarded development workflows without changing old study evidence."""
from alembic import op

revision = "0027_parallel_test_workflows"
down_revision = "0026_parallel_foundation"
branch_labels = None
depends_on = None
PREFIX = "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), "
TABLES = {
 "parallel_test_workflows": "protocol_id uuid NOT NULL UNIQUE REFERENCES research_private.parallel_protocols(id), configuration jsonb NOT NULL CHECK(configuration @> '{\"development_only\": true}'::jsonb)",
 "parallel_workflow_events": "protocol_id uuid NOT NULL REFERENCES research_private.parallel_protocols(id), participant_id uuid REFERENCES research_participants(id), actor_id uuid NOT NULL REFERENCES users(id), kind varchar(30) NOT NULL, target_id uuid NOT NULL, evidence jsonb NOT NULL DEFAULT '{}', UNIQUE(protocol_id,participant_id,kind,target_id)",
 "parallel_workflow_attempts": """allocation_id uuid NOT NULL REFERENCES research_private.parallel_allocations(id),
 assessment_id uuid REFERENCES research_private.parallel_assessments(id), opportunity_id uuid REFERENCES research_private.parallel_opportunities(id),
 snapshot jsonb NOT NULL, responses jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 started_at timestamptz NOT NULL, submitted_at timestamptz, request_id uuid, fingerprint varchar(64), result jsonb NOT NULL DEFAULT '{}',
 CHECK((assessment_id IS NULL)<>(opportunity_id IS NULL)),
 CHECK((submitted_at IS NULL)=(request_id IS NULL) AND (submitted_at IS NULL)=(fingerprint IS NULL)),
 UNIQUE(allocation_id,assessment_id), UNIQUE(allocation_id,opportunity_id), UNIQUE(allocation_id,request_id)""",
 "parallel_workflow_memory": "allocation_id uuid NOT NULL REFERENCES research_private.parallel_allocations(id), vocabulary_item_id uuid NOT NULL REFERENCES vocabulary_items(id), content_version integer NOT NULL CHECK(content_version>0), memory jsonb NOT NULL DEFAULT '{}', due_at timestamptz NOT NULL, revision integer NOT NULL DEFAULT 1 CHECK(revision>0), UNIQUE(allocation_id,vocabulary_item_id,content_version)"
}


def upgrade():
    for name, columns in TABLES.items():
        op.execute(f"CREATE TABLE research_private.{name} ({PREFIX}{columns})")
        op.execute(f"REVOKE ALL ON research_private.{name} FROM PUBLIC")
    for name in ("parallel_test_workflows", "parallel_workflow_events"):
        op.execute(f"CREATE TRIGGER workflow_immutable BEFORE UPDATE OR DELETE ON research_private.{name} FOR EACH ROW EXECUTE FUNCTION research_private.parallel_immutable()")
    op.execute("""CREATE FUNCTION research_private.workflow_attempt_guard() RETURNS trigger LANGUAGE plpgsql
      SET search_path=pg_catalog,public AS $$ DECLARE protocol uuid; target_protocol uuid; BEGIN
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Attempt history is retained' USING ERRCODE='23514'; END IF;
      SELECT protocol_id INTO protocol FROM research_private.parallel_allocations WHERE id=NEW.allocation_id;
      IF NEW.assessment_id IS NOT NULL THEN SELECT protocol_id INTO target_protocol FROM research_private.parallel_assessments WHERE id=NEW.assessment_id;
      ELSE SELECT protocol_id INTO target_protocol FROM research_private.parallel_opportunities WHERE id=NEW.opportunity_id; END IF;
      IF protocol IS DISTINCT FROM target_protocol THEN RAISE EXCEPTION 'Attempt scope mismatch' USING ERRCODE='23514'; END IF;
      IF TG_OP='UPDATE' AND (OLD.submitted_at IS NOT NULL OR
        (NEW.allocation_id,NEW.assessment_id,NEW.opportunity_id,NEW.snapshot,NEW.started_at) IS DISTINCT FROM
        (OLD.allocation_id,OLD.assessment_id,OLD.opportunity_id,OLD.snapshot,OLD.started_at))
      THEN RAISE EXCEPTION 'Final attempt or snapshot is immutable' USING ERRCODE='23514'; END IF;
      RETURN NEW; END $$""")
    op.execute("CREATE TRIGGER workflow_attempt_guard BEFORE INSERT OR UPDATE OR DELETE ON research_private.parallel_workflow_attempts FOR EACH ROW EXECUTE FUNCTION research_private.workflow_attempt_guard()")
    op.execute("""CREATE FUNCTION research_private.workflow_memory_guard() RETURNS trigger LANGUAGE plpgsql
      SET search_path=pg_catalog,public AS $$ BEGIN
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Memory history cannot be deleted' USING ERRCODE='23514'; END IF;
      IF TG_OP='UPDATE' AND ((NEW.allocation_id,NEW.vocabulary_item_id,NEW.content_version) IS DISTINCT FROM
        (OLD.allocation_id,OLD.vocabulary_item_id,OLD.content_version) OR NOT EXISTS(
        SELECT 1 FROM research_private.parallel_allocations WHERE id=NEW.allocation_id AND condition='FSRS6_CONTROL'))
      THEN RAISE EXCEPTION 'Memory identity or blocked experimental state cannot change' USING ERRCODE='23514'; END IF;
      RETURN NEW; END $$""")
    op.execute("CREATE TRIGGER workflow_memory_guard BEFORE UPDATE OR DELETE ON research_private.parallel_workflow_memory FOR EACH ROW EXECUTE FUNCTION research_private.workflow_memory_guard()")


def downgrade():
    for name in TABLES:
        if op.get_bind().exec_driver_sql(f"SELECT EXISTS(SELECT 1 FROM research_private.{name})").scalar_one():
            raise RuntimeError("Workflow evidence exists; reviewed data-preservation plan required")
    for name in reversed(TABLES):
        op.execute(f"DROP TABLE research_private.{name}")
    op.execute("DROP FUNCTION research_private.workflow_attempt_guard()")
    op.execute("DROP FUNCTION research_private.workflow_memory_guard()")
