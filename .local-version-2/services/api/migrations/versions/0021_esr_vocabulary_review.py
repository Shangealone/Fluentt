"""Isolated coded ESR review snapshots; no historical scheduler rows are rewritten."""
from alembic import op

revision = "0021_esr_vocabulary_review"
down_revision = "0020_teacher_trigger_dispatch"
branch_labels = None
depends_on = None

PREFIX = "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), "
TABLES = [
    ("esr_vocabulary_packs", """author_id uuid NOT NULL REFERENCES users(id), lesson_id uuid NOT NULL REFERENCES lessons(id),
      title varchar(200) NOT NULL, language varchar(20) NOT NULL CHECK(language IN ('english','tagalog')),
      content jsonb NOT NULL DEFAULT '{}', fingerprint varchar(64) NOT NULL, published_at timestamptz,
      CHECK(jsonb_typeof(content)='object' AND fingerprint ~ '^[0-9a-f]{64}$')"""),
    ("esr_protocols", """study_id uuid NOT NULL UNIQUE REFERENCES research_studies(id), manager_id uuid NOT NULL REFERENCES users(id),
      class_id uuid NOT NULL REFERENCES classes(id), pack_a_id uuid NOT NULL REFERENCES research_private.esr_vocabulary_packs(id),
      pack_b_id uuid NOT NULL REFERENCES research_private.esr_vocabulary_packs(id), configuration jsonb NOT NULL DEFAULT '{}',
      status varchar(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','completed')),
      revision integer NOT NULL DEFAULT 1 CHECK(revision>0), CHECK(pack_a_id<>pack_b_id)"""),
    ("esr_approvals", """protocol_id uuid NOT NULL REFERENCES research_private.esr_protocols(id),
      kind varchar(30) NOT NULL CHECK(kind IN ('protocol','ethics','site','instruments','model')), sequence integer NOT NULL CHECK(sequence>0),
      status varchar(20) NOT NULL CHECK(status IN ('verified','revoked')), evidence_reference varchar(1000) NOT NULL,
      evidence_sha256 varchar(64) NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
      configuration_sha256 varchar(64) NOT NULL CHECK(configuration_sha256 ~ '^[0-9a-f]{64}$'), UNIQUE(protocol_id,kind,sequence)"""),
    ("esr_allocations", """protocol_id uuid NOT NULL REFERENCES research_private.esr_protocols(id),
      participant_id uuid NOT NULL REFERENCES research_participants(id), mapping integer NOT NULL CHECK(mapping IN (1,2)),
      UNIQUE(protocol_id,participant_id)"""),
    ("esr_review_states", """allocation_id uuid NOT NULL REFERENCES research_private.esr_allocations(id),
      pack_id uuid NOT NULL REFERENCES research_private.esr_vocabulary_packs(id), vocabulary_item_id uuid NOT NULL REFERENCES vocabulary_items(id),
      memory jsonb NOT NULL DEFAULT '{}', due_at timestamptz NOT NULL, revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
      UNIQUE(allocation_id,pack_id,vocabulary_item_id)"""),
    ("esr_reviews", """state_id uuid NOT NULL REFERENCES research_private.esr_review_states(id),
      format varchar(30) NOT NULL CHECK(format IN ('multiple_choice','typed_recall')), state_revision integer NOT NULL CHECK(state_revision>0),
      presented_at timestamptz NOT NULL, answered_at timestamptz, finalized_at timestamptz,
      response jsonb NOT NULL DEFAULT '{}', decision jsonb NOT NULL DEFAULT '{}', UNIQUE(state_id,state_revision),
      CHECK((answered_at IS NULL)=(response='{}'::jsonb)), CHECK(finalized_at IS NULL OR answered_at IS NOT NULL),
      CHECK((finalized_at IS NULL)=(decision='{}'::jsonb))"""),
    ("esr_mutations", """actor_id uuid NOT NULL REFERENCES users(id), request_id uuid NOT NULL,
      fingerprint varchar(64) NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'), response jsonb NOT NULL DEFAULT '{}', UNIQUE(actor_id,request_id)"""),
]


def upgrade():
    for name, columns in TABLES:
        op.execute(f"CREATE TABLE research_private.{name} ({PREFIX}{columns})")
    op.execute("CREATE INDEX ix_esr_due ON research_private.esr_review_states(allocation_id,due_at)")
    op.execute("""CREATE FUNCTION research_private.guard_esr_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ESR evidence is retained' USING ERRCODE='23514'; END IF;
      IF TG_TABLE_NAME IN ('esr_mutations','esr_allocations','esr_approvals') THEN
        RAISE EXCEPTION 'ESR evidence is append only' USING ERRCODE='23514';
      ELSIF TG_TABLE_NAME='esr_vocabulary_packs' THEN
        IF OLD.published_at IS NOT NULL OR (to_jsonb(OLD)-'updated_at'-'published_at') IS DISTINCT FROM (to_jsonb(NEW)-'updated_at'-'published_at') THEN
          RAISE EXCEPTION 'Create a new pool snapshot for content changes' USING ERRCODE='23514'; END IF;
      ELSIF TG_TABLE_NAME='esr_protocols' THEN
        IF (to_jsonb(OLD)-'updated_at'-'status'-'revision') IS DISTINCT FROM (to_jsonb(NEW)-'updated_at'-'status'-'revision') OR NEW.revision<>OLD.revision+1 THEN
          RAISE EXCEPTION 'Create a new protocol for configuration changes' USING ERRCODE='23514'; END IF;
      ELSIF TG_TABLE_NAME='esr_reviews' THEN
        IF OLD.finalized_at IS NOT NULL OR NEW.state_id<>OLD.state_id OR NEW.format<>OLD.format OR NEW.state_revision<>OLD.state_revision OR NEW.presented_at<>OLD.presented_at
          OR (OLD.answered_at IS NOT NULL AND (NEW.response IS DISTINCT FROM OLD.response OR NEW.answered_at IS DISTINCT FROM OLD.answered_at)) THEN
          RAISE EXCEPTION 'Committed answers and final reviews are immutable' USING ERRCODE='23514'; END IF;
      ELSIF TG_TABLE_NAME='esr_review_states' THEN
        IF NEW.allocation_id<>OLD.allocation_id OR NEW.pack_id<>OLD.pack_id OR NEW.vocabulary_item_id<>OLD.vocabulary_item_id OR NEW.revision<>OLD.revision+1 THEN
          RAISE EXCEPTION 'Review state scope and revisions are protected' USING ERRCODE='23514'; END IF;
      END IF;
      RETURN NEW;
    END $$""")
    for name, _ in TABLES:
        op.execute(f"CREATE TRIGGER protect_{name} BEFORE UPDATE OR DELETE ON research_private.{name} FOR EACH ROW EXECUTE FUNCTION research_private.guard_esr_evidence()")
    op.execute("REVOKE INSERT, UPDATE, DELETE ON research_private.esr_approvals FROM PUBLIC")


def downgrade():
    raise RuntimeError("ESR research evidence must not be removed by an automatic downgrade.")
