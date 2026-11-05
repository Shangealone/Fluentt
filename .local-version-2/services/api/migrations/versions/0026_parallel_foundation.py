"""Add inactive parallel records; never relabel historical experimental data."""
from alembic import op

revision = "0026_parallel_foundation"
down_revision = "0025_assessed_proficiency"
branch_labels = None
depends_on = None

PREFIX = "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), "
TABLES = {
    "parallel_protocols": """study_id uuid NOT NULL UNIQUE REFERENCES research_studies(id), class_id uuid NOT NULL REFERENCES classes(id),
      pack_id uuid NOT NULL REFERENCES research_private.esr_vocabulary_packs(id), actor_id uuid NOT NULL REFERENCES users(id),
      request_id uuid NOT NULL, fingerprint varchar(64) NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
      configuration jsonb NOT NULL CHECK(jsonb_typeof(configuration)='object'), seed bytea NOT NULL CHECK(octet_length(seed)=32), UNIQUE(actor_id,request_id)""",
    "parallel_clearances": """protocol_id uuid NOT NULL REFERENCES research_private.parallel_protocols(id),
      configuration_sha256 varchar(64) NOT NULL CHECK(configuration_sha256 ~ '^[0-9a-f]{64}$'),
      evidence_reference varchar(1000) NOT NULL CHECK(length(trim(evidence_reference))>0),
      sequence integer NOT NULL CHECK(sequence>0), status varchar(10) NOT NULL CHECK(status IN ('verified','revoked')), UNIQUE(protocol_id,sequence)""",
    "parallel_allocations": """protocol_id uuid NOT NULL REFERENCES research_private.parallel_protocols(id),
      participant_id uuid NOT NULL REFERENCES research_participants(id), actor_id uuid NOT NULL REFERENCES users(id),
      slot integer NOT NULL CHECK(slot BETWEEN 0 AND 29), condition varchar(40) NOT NULL CHECK(condition IN ('FSRS6_CONTROL','FSRS6_FIFAKT_EXPERIMENTAL')),
      assigned_at timestamptz NOT NULL, method varchar(80) NOT NULL, UNIQUE(protocol_id,participant_id), UNIQUE(protocol_id,slot)""",
    "parallel_opportunities": """protocol_id uuid NOT NULL REFERENCES research_private.parallel_protocols(id), local_date date NOT NULL,
      opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL CHECK(closes_at>opens_at), UNIQUE(protocol_id,local_date)""",
    "parallel_assessments": """protocol_id uuid NOT NULL REFERENCES research_private.parallel_protocols(id),
      kind varchar(20) NOT NULL CHECK(kind IN ('pretest','posttest','delayed')), designated_date date, UNIQUE(protocol_id,kind)""",
}


def upgrade():
    for name, columns in TABLES.items():
        op.execute(f"CREATE TABLE research_private.{name} ({PREFIX}{columns})")
        op.execute(f"REVOKE ALL ON research_private.{name} FROM PUBLIC")
    op.execute("""CREATE FUNCTION research_private.parallel_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Parallel research evidence is immutable' USING ERRCODE='23514'; END $$""")
    for name in TABLES:
        op.execute(f"CREATE TRIGGER parallel_immutable BEFORE UPDATE OR DELETE ON research_private.{name} FOR EACH ROW EXECUTE FUNCTION research_private.parallel_immutable()")
    op.execute("""CREATE FUNCTION research_private.parallel_allocation_guard() RETURNS trigger LANGUAGE plpgsql
      SET search_path = pg_catalog, public AS $$ BEGIN
      PERFORM 1 FROM research_private.parallel_protocols WHERE id=NEW.protocol_id FOR UPDATE;
      IF (SELECT count(*) FROM research_private.parallel_allocations WHERE protocol_id=NEW.protocol_id AND condition=NEW.condition)>=15
      OR NOT EXISTS(SELECT 1 FROM research_private.parallel_protocols q JOIN research_participants p ON p.study_id=q.study_id
                    WHERE q.id=NEW.protocol_id AND p.id=NEW.participant_id AND p.enrollment_status='enrolled' AND p.eligibility_status='eligible')
      THEN RAISE EXCEPTION 'Parallel allocation scope or quota invalid' USING ERRCODE='23514'; END IF;
      RETURN NEW; END $$""")
    op.execute("CREATE TRIGGER parallel_allocation_guard BEFORE INSERT ON research_private.parallel_allocations FOR EACH ROW EXECUTE FUNCTION research_private.parallel_allocation_guard()")


def downgrade():
    for name in TABLES:
        if op.get_bind().exec_driver_sql(f"SELECT EXISTS(SELECT 1 FROM research_private.{name})").scalar_one():
            raise RuntimeError("Parallel evidence exists; downgrade requires reviewed data-preservation plan")
    for name in reversed(TABLES):
        op.execute(f"DROP TABLE research_private.{name}")
    op.execute("DROP FUNCTION research_private.parallel_allocation_guard()")
    op.execute("DROP FUNCTION research_private.parallel_immutable()")
