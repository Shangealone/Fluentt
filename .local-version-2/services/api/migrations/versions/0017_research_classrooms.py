"""Add opt-in research classroom configuration; preserve all previous models and data."""

from alembic import op

revision = "0017_research_classrooms"
down_revision = "0016_learning_experience"
branch_labels = None
depends_on = None

SCHEMA_SQL = [
    """CREATE TABLE research_private.classroom_studies (
	study_id UUID NOT NULL, 
	manager_id UUID NOT NULL, 
	status VARCHAR(9) NOT NULL, 
	revision INTEGER NOT NULL, 
	current_protocol_id UUID, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_classroom_studies PRIMARY KEY (id), 
	CONSTRAINT uq_classroom_studies_id UNIQUE (id, study_id), 
	CONSTRAINT ck_classroom_studies_revision_positive CHECK (revision > 0), 
	CONSTRAINT fk_classroom_studies_study_id_research_studies FOREIGN KEY(study_id) REFERENCES research_studies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_classroom_studies_manager_id_users FOREIGN KEY(manager_id) REFERENCES users (id) ON DELETE RESTRICT, 
	CONSTRAINT ck_classroom_studies_classroom_study_status CHECK (status IN ('DRAFT', 'READY', 'ACTIVE', 'PAUSED', 'COMPLETED'))
)""",
    """CREATE TABLE research_private.classroom_bindings (
	scope_id UUID NOT NULL, 
	study_id UUID NOT NULL, 
	class_id UUID NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_classroom_bindings PRIMARY KEY (id), 
	CONSTRAINT uq_classroom_bindings_scope_id UNIQUE (scope_id, class_id), 
	CONSTRAINT uq_classroom_bindings_id UNIQUE (id, study_id), 
	CONSTRAINT fk_classroom_bindings_scope_study FOREIGN KEY(scope_id, study_id) REFERENCES research_private.classroom_studies (id, study_id), 
	CONSTRAINT fk_classroom_bindings_scope_id_classroom_studies FOREIGN KEY(scope_id) REFERENCES research_private.classroom_studies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_classroom_bindings_study_id_research_studies FOREIGN KEY(study_id) REFERENCES research_studies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_classroom_bindings_class_id_classes FOREIGN KEY(class_id) REFERENCES classes (id) ON DELETE RESTRICT
)""",
    """CREATE TABLE research_private.classroom_protocols (
	scope_id UUID NOT NULL, 
	study_id UUID NOT NULL, 
	version INTEGER NOT NULL, 
	protocol_version VARCHAR(80) NOT NULL, 
	fingerprint VARCHAR(64) NOT NULL, 
	configuration JSONB DEFAULT '{}'::jsonb NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_classroom_protocols PRIMARY KEY (id), 
	CONSTRAINT uq_classroom_protocols_scope_id UNIQUE (scope_id, version), 
	CONSTRAINT uq_rc_protocol_scope UNIQUE (id, scope_id), 
	CONSTRAINT uq_rc_protocol_study UNIQUE (id, study_id), 
	CONSTRAINT fk_classroom_protocols_scope_study FOREIGN KEY(scope_id, study_id) REFERENCES research_private.classroom_studies (id, study_id), 
	CONSTRAINT ck_classroom_protocols_valid_protocol CHECK (version > 0 AND fingerprint ~ '^[0-9a-f]{64}$'), 
	CONSTRAINT ck_classroom_protocols_configuration_object CHECK (jsonb_typeof(configuration) = 'object'), 
	CONSTRAINT fk_classroom_protocols_scope_id_classroom_studies FOREIGN KEY(scope_id) REFERENCES research_private.classroom_studies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_classroom_protocols_study_id_research_studies FOREIGN KEY(study_id) REFERENCES research_studies (id) ON DELETE RESTRICT
)""",
    """CREATE TABLE research_private.classroom_assessment_references (
	study_id UUID NOT NULL, 
	protocol_id UUID NOT NULL, 
	assessment_id UUID NOT NULL, 
	instrument_version VARCHAR(80) NOT NULL, 
	opens_at TIMESTAMP WITH TIME ZONE, 
	closes_at TIMESTAMP WITH TIME ZONE, 
	timer_limit_seconds INTEGER, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_classroom_assessment_references PRIMARY KEY (id), 
	CONSTRAINT uq_classroom_assessment_references_protocol_id UNIQUE (protocol_id, assessment_id), 
	CONSTRAINT fk_classroom_assessment_references_protocol_id_classroo_8355 FOREIGN KEY(protocol_id, study_id) REFERENCES research_private.classroom_protocols (id, study_id), 
	CONSTRAINT fk_classroom_assessment_references_assessment_id_resear_0bf2 FOREIGN KEY(assessment_id, study_id) REFERENCES research_assessments (id, study_id), 
	CONSTRAINT ck_classroom_assessment_references_positive_timer CHECK (timer_limit_seconds IS NULL OR timer_limit_seconds > 0), 
	CONSTRAINT ck_classroom_assessment_references_ordered_window CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at), 
	CONSTRAINT fk_classroom_assessment_references_study_id_research_studies FOREIGN KEY(study_id) REFERENCES research_studies (id) ON DELETE RESTRICT
)""",
    """CREATE TABLE research_private.classroom_clearances (
	protocol_id UUID NOT NULL, 
	kind VARCHAR(15) NOT NULL, 
	sequence INTEGER NOT NULL, 
	status VARCHAR(8) NOT NULL, 
	evidence_reference TEXT NOT NULL, 
	evidence_sha256 VARCHAR(64) NOT NULL, 
	verifier_reference TEXT NOT NULL, 
	recorded_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_classroom_clearances PRIMARY KEY (id), 
	CONSTRAINT uq_classroom_clearances_protocol_id UNIQUE (protocol_id, kind, sequence), 
	CONSTRAINT ck_classroom_clearances_clearance_evidence CHECK (sequence > 0 AND evidence_sha256 ~ '^[0-9a-f]{64}$'), 
	CONSTRAINT ck_classroom_clearances_clearance_references CHECK (length(btrim(evidence_reference)) > 0 AND length(btrim(verifier_reference)) > 0), 
	CONSTRAINT fk_classroom_clearances_protocol_id_classroom_protocols FOREIGN KEY(protocol_id) REFERENCES research_private.classroom_protocols (id) ON DELETE RESTRICT, 
	CONSTRAINT ck_classroom_clearances_classroom_clearance_kind CHECK (kind IN ('protocol', 'ethics', 'site_permission', 'instruments', 'conditions')), 
	CONSTRAINT ck_classroom_clearances_classroom_clearance_status CHECK (status IN ('verified', 'revoked'))
)""",
    """CREATE TABLE research_private.classroom_enrollments (
	study_id UUID NOT NULL, 
	binding_id UUID NOT NULL, 
	participant_id UUID NOT NULL, 
	protocol_id UUID NOT NULL, 
	group_assignment_id UUID, 
	authorization_state VARCHAR(10) NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_classroom_enrollments PRIMARY KEY (id), 
	CONSTRAINT uq_classroom_enrollments_binding_id UNIQUE (binding_id, participant_id), 
	CONSTRAINT uq_classroom_enrollments_id UNIQUE (id, study_id), 
	CONSTRAINT fk_classroom_enrollments_binding_id_classroom_bindings FOREIGN KEY(binding_id, study_id) REFERENCES research_private.classroom_bindings (id, study_id), 
	CONSTRAINT fk_classroom_enrollments_participant_id_research_participants FOREIGN KEY(participant_id, study_id) REFERENCES research_participants (id, study_id), 
	CONSTRAINT fk_classroom_enrollments_protocol_id_classroom_protocols FOREIGN KEY(protocol_id, study_id) REFERENCES research_private.classroom_protocols (id, study_id), 
	CONSTRAINT fk_classroom_enrollments_group_assignment_id_research_g_cf3d FOREIGN KEY(group_assignment_id, participant_id) REFERENCES research_group_assignments (id, participant_id), 
	CONSTRAINT fk_classroom_enrollments_study_id_research_studies FOREIGN KEY(study_id) REFERENCES research_studies (id) ON DELETE RESTRICT, 
	CONSTRAINT ck_classroom_enrollments_classroom_participation_authorization CHECK (authorization_state IN ('pending', 'authorized', 'withdrawn'))
)""",
    """CREATE TABLE research_private.classroom_events (
	scope_id UUID NOT NULL, 
	study_id UUID NOT NULL, 
	protocol_id UUID, 
	binding_id UUID, 
	participant_id UUID, 
	group_assignment_id UUID, 
	condition VARCHAR(16), 
	scheduler_configuration_id UUID, 
	actor_id UUID NOT NULL, 
	request_id UUID NOT NULL, 
	operation VARCHAR(50) NOT NULL, 
	request_fingerprint VARCHAR(64) NOT NULL, 
	response_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_classroom_events PRIMARY KEY (id), 
	CONSTRAINT uq_classroom_events_actor_id UNIQUE (actor_id, request_id), 
	CONSTRAINT fk_classroom_events_scope_study FOREIGN KEY(scope_id, study_id) REFERENCES research_private.classroom_studies (id, study_id), 
	CONSTRAINT fk_classroom_events_protocol_id_classroom_protocols FOREIGN KEY(protocol_id, study_id) REFERENCES research_private.classroom_protocols (id, study_id), 
	CONSTRAINT fk_classroom_events_binding_id_classroom_bindings FOREIGN KEY(binding_id, study_id) REFERENCES research_private.classroom_bindings (id, study_id), 
	CONSTRAINT fk_classroom_events_participant_id_research_participants FOREIGN KEY(participant_id, study_id) REFERENCES research_participants (id, study_id), 
	CONSTRAINT fk_classroom_events_group_assignment_id_research_group__c50b FOREIGN KEY(group_assignment_id, participant_id) REFERENCES research_group_assignments (id, participant_id), 
	CONSTRAINT ck_classroom_events_event_allocation_context CHECK ((group_assignment_id IS NULL AND condition IS NULL AND scheduler_configuration_id IS NULL) OR (group_assignment_id IS NOT NULL AND condition IS NOT NULL AND scheduler_configuration_id IS NOT NULL AND participant_id IS NOT NULL AND protocol_id IS NOT NULL AND binding_id IS NOT NULL)), 
	CONSTRAINT ck_classroom_events_event_contract CHECK (request_fingerprint ~ '^[0-9a-f]{64}$' AND jsonb_typeof(response_snapshot) = 'object'), 
	CONSTRAINT fk_classroom_events_scope_id_classroom_studies FOREIGN KEY(scope_id) REFERENCES research_private.classroom_studies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_classroom_events_study_id_research_studies FOREIGN KEY(study_id) REFERENCES research_studies (id) ON DELETE RESTRICT, 
	CONSTRAINT ck_classroom_events_classroom_event_condition CHECK (condition IN ('sm2_control', 'esr_experimental')), 
	CONSTRAINT fk_classroom_events_scheduler_configuration_id_schedule_17ce FOREIGN KEY(scheduler_configuration_id) REFERENCES scheduler_configurations (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_classroom_events_actor_id_users FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE RESTRICT
)""",
    """ALTER TABLE research_private.classroom_studies ADD CONSTRAINT fk_classroom_study_current_protocol FOREIGN KEY(current_protocol_id, id) REFERENCES research_private.classroom_protocols (id, scope_id)""",
]

INDEX_SQL = [
    """CREATE INDEX ix_classroom_studies_manager_id ON research_private.classroom_studies (manager_id)""",
    """CREATE UNIQUE INDEX ix_classroom_studies_study_id ON research_private.classroom_studies (study_id)""",
    """CREATE INDEX ix_classroom_bindings_class_id ON research_private.classroom_bindings (class_id)""",
    """CREATE INDEX ix_classroom_bindings_scope_id ON research_private.classroom_bindings (scope_id)""",
    """CREATE INDEX ix_classroom_bindings_study_id ON research_private.classroom_bindings (study_id)""",
    """CREATE INDEX ix_classroom_protocols_scope_id ON research_private.classroom_protocols (scope_id)""",
    """CREATE INDEX ix_classroom_protocols_study_id ON research_private.classroom_protocols (study_id)""",
    """CREATE INDEX ix_classroom_assessment_references_assessment_id ON research_private.classroom_assessment_references (assessment_id)""",
    """CREATE INDEX ix_classroom_assessment_references_protocol_id ON research_private.classroom_assessment_references (protocol_id)""",
    """CREATE INDEX ix_classroom_assessment_references_study_id ON research_private.classroom_assessment_references (study_id)""",
    """CREATE INDEX ix_classroom_clearances_protocol_id ON research_private.classroom_clearances (protocol_id)""",
    """CREATE INDEX ix_classroom_enrollments_binding_id ON research_private.classroom_enrollments (binding_id)""",
    """CREATE INDEX ix_classroom_enrollments_participant_id ON research_private.classroom_enrollments (participant_id)""",
    """CREATE INDEX ix_classroom_enrollments_protocol_id ON research_private.classroom_enrollments (protocol_id)""",
    """CREATE INDEX ix_classroom_enrollments_study_id ON research_private.classroom_enrollments (study_id)""",
    """CREATE INDEX ix_classroom_events_actor_id ON research_private.classroom_events (actor_id)""",
    """CREATE INDEX ix_classroom_events_scheduler_configuration_id ON research_private.classroom_events (scheduler_configuration_id)""",
    """CREATE INDEX ix_classroom_events_scope_id ON research_private.classroom_events (scope_id)""",
    """CREATE INDEX ix_classroom_events_study_id ON research_private.classroom_events (study_id)""",
]

GUARDS = [
    """CREATE FUNCTION research_private.fluentt_rc_scope() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, research_private AS $$
DECLARE cfg jsonb; k text; verdict text;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Research configuration history is retained' USING ERRCODE='23514'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' OR NEW.revision <> 1 OR NEW.current_protocol_id IS NOT NULL THEN
      RAISE EXCEPTION 'A research configuration starts as an unresolved draft' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM research_studies WHERE id=NEW.study_id AND status='draft' AND conditions->>'research_contract'='research-classrooms-v1') OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.manager_id AND role='administrator' AND profile_status='active' AND archived_at IS NULL) THEN RAISE EXCEPTION 'Explicit managed draft and administrator required' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF (NEW.id,NEW.study_id,NEW.manager_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.study_id,OLD.manager_id,OLD.created_at) THEN
    RAISE EXCEPTION 'Research identity/ownership is immutable' USING ERRCODE='23514';
  END IF;
  IF NOT (OLD.current_protocol_id IS NULL AND OLD.status='DRAFT' AND NEW.status='DRAFT' AND OLD.revision=1 AND NEW.revision=1) AND NEW.revision <> OLD.revision+1 THEN
    RAISE EXCEPTION 'Research revision must advance once' USING ERRCODE='23514';
  END IF;
  IF OLD.status <> 'DRAFT' AND NEW.current_protocol_id IS DISTINCT FROM OLD.current_protocol_id THEN
    RAISE EXCEPTION 'Active or historical protocol cannot change silently' USING ERRCODE='23514';
  END IF;
  IF NEW.current_protocol_id IS DISTINCT FROM OLD.current_protocol_id AND NOT EXISTS(SELECT 1 FROM research_private.classroom_protocols WHERE id=NEW.current_protocol_id AND scope_id=NEW.id AND version=COALESCE((SELECT version FROM research_private.classroom_protocols WHERE id=OLD.current_protocol_id),0)+1) THEN RAISE EXCEPTION 'Protocol pointer must advance consecutively' USING ERRCODE='23514'; END IF;
  IF NEW.status <> OLD.status AND NOT ((OLD.status='DRAFT' AND NEW.status='READY') OR (OLD.status='READY' AND NEW.status IN ('ACTIVE','COMPLETED')) OR (OLD.status='ACTIVE' AND NEW.status IN ('PAUSED','COMPLETED')) OR (OLD.status='PAUSED' AND NEW.status IN ('ACTIVE','COMPLETED'))) THEN
    RAISE EXCEPTION 'Invalid research state transition' USING ERRCODE='23514';
  END IF;
  IF NEW.status IN ('READY','ACTIVE') THEN
    SELECT configuration INTO cfg FROM research_private.classroom_protocols WHERE id=NEW.current_protocol_id AND scope_id=NEW.id;
    IF cfg IS NULL OR EXISTS(SELECT 1 FROM unnest(ARRAY['protocol_reference','starts_at','ends_at','timezone','active_weekdays','due_date_policy','consent_document_version','consent_requirements','allocation_unit','allocation_policy','conditions','assessments']) AS n WHERE NOT cfg ? n OR cfg->n IN ('null'::jsonb,'[]'::jsonb,'{}'::jsonb)) THEN
      RAISE EXCEPTION 'Research configuration is incomplete' USING ERRCODE='23514';
    END IF;
    FOREACH k IN ARRAY ARRAY['protocol','ethics','site_permission','instruments','conditions'] LOOP
      SELECT status INTO verdict FROM research_private.classroom_clearances WHERE protocol_id=NEW.current_protocol_id AND kind=k ORDER BY sequence DESC LIMIT 1;
      IF verdict IS DISTINCT FROM 'verified' THEN RAISE EXCEPTION 'Independent research authorization is missing' USING ERRCODE='23514'; END IF;
    END LOOP;
    IF NOT EXISTS(SELECT 1 FROM research_private.classroom_bindings WHERE scope_id=NEW.id) THEN RAISE EXCEPTION 'No designated research classroom' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END; $$""",
    """CREATE FUNCTION research_private.fluentt_rc_child() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, research_private AS $$
DECLARE s research_private.classroom_studies; root research_studies;
BEGIN
  SELECT * INTO s FROM research_private.classroom_studies WHERE id=NEW.scope_id FOR UPDATE;
  IF s.status <> 'DRAFT' OR s.study_id <> NEW.study_id THEN RAISE EXCEPTION 'Research draft scope required' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='classroom_protocols' THEN
    SELECT * INTO root FROM research_studies WHERE id=s.study_id;
    IF NEW.protocol_version <> root.protocol_version OR NEW.version <> COALESCE((SELECT MAX(version) FROM research_private.classroom_protocols WHERE scope_id=s.id),0)+1 THEN
      RAISE EXCEPTION 'Protocol identity and consecutive history required' USING ERRCODE='23514';
    END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM classes c JOIN users u ON u.id=c.instructor_id JOIN research_studies r ON r.id=NEW.study_id WHERE c.id=NEW.class_id AND c.status='active' AND c.archived_at IS NULL AND c.language=r.target_language AND u.role='instructor' AND u.profile_status='active' AND u.archived_at IS NULL) THEN RAISE EXCEPTION 'Eligible matching-language classroom required' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END; $$""",
    """CREATE FUNCTION research_private.fluentt_rc_instrument() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, research_private AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM research_private.classroom_protocols p JOIN research_private.classroom_studies s ON s.id=p.scope_id WHERE p.id=NEW.protocol_id AND p.study_id=NEW.study_id AND s.status='DRAFT' AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.configuration->'assessments') a WHERE (a->>'assessment_id')::uuid=NEW.assessment_id AND a->>'instrument_version'=NEW.instrument_version AND (a->>'opens_at')::timestamptz IS NOT DISTINCT FROM NEW.opens_at AND (a->>'closes_at')::timestamptz IS NOT DISTINCT FROM NEW.closes_at AND (a->>'timer_limit_seconds')::integer IS NOT DISTINCT FROM NEW.timer_limit_seconds)) THEN
    RAISE EXCEPTION 'Instrument window must match its immutable draft protocol' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM research_assessments WHERE id=NEW.assessment_id AND study_id=NEW.study_id AND instrument_version=NEW.instrument_version AND locked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Exact locked research instrument required' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$""",
    """CREATE FUNCTION research_private.fluentt_rc_clearance() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, research_private AS $$
DECLARE scope_uuid uuid; previous_sequence integer;
BEGIN
  SELECT scope_id INTO scope_uuid FROM research_private.classroom_protocols WHERE id=NEW.protocol_id;
  PERFORM 1 FROM research_private.classroom_studies WHERE id=scope_uuid FOR UPDATE;
  SELECT COALESCE(MAX(sequence),0) INTO previous_sequence FROM research_private.classroom_clearances WHERE protocol_id=NEW.protocol_id AND kind=NEW.kind;
  IF NEW.sequence <> previous_sequence+1 THEN RAISE EXCEPTION 'Authorization history must be consecutive' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END; $$""",
    """CREATE FUNCTION research_private.fluentt_rc_enrollment() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, research_private AS $$
DECLARE binding research_private.classroom_bindings; protocol research_private.classroom_protocols; scope research_private.classroom_studies; student_uuid uuid; required_kind text; verdict text;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Research identity history is retained' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND ((NEW.id,NEW.study_id,NEW.binding_id,NEW.participant_id,NEW.protocol_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.study_id,OLD.binding_id,OLD.participant_id,OLD.protocol_id,OLD.created_at) OR OLD.authorization_state='withdrawn' OR (OLD.group_assignment_id IS NOT NULL AND NEW.group_assignment_id IS DISTINCT FROM OLD.group_assignment_id)) THEN
    RAISE EXCEPTION 'Research enrollment identity is immutable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO binding FROM research_private.classroom_bindings WHERE id=NEW.binding_id;
  SELECT * INTO scope FROM research_private.classroom_studies WHERE id=binding.scope_id;
  SELECT * INTO protocol FROM research_private.classroom_protocols WHERE id=NEW.protocol_id;
  IF protocol.scope_id <> scope.id THEN RAISE EXCEPTION 'Research scope mismatch' USING ERRCODE='23514'; END IF;
  SELECT l.user_id INTO student_uuid FROM research_private.research_identity_links l JOIN users u ON u.id=l.user_id WHERE l.participant_id=NEW.participant_id AND l.study_id=NEW.study_id AND u.role='school_student' AND u.profile_status='active' AND u.archived_at IS NULL;
  IF student_uuid IS NULL THEN RAISE EXCEPTION 'Only a school research identity can be bound' USING ERRCODE='23514'; END IF;
  IF NEW.group_assignment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM research_group_assignments a JOIN research_groups g ON g.id=a.group_id WHERE a.id=NEW.group_assignment_id AND a.participant_id=NEW.participant_id AND a.study_id=NEW.study_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(protocol.configuration->'conditions') c WHERE c->>'condition'=g.condition AND (c->>'scheduler_configuration_id')::uuid=g.scheduler_configuration_id)) THEN RAISE EXCEPTION 'Allocation must match the pinned protocol condition' USING ERRCODE='23514'; END IF;
  IF NEW.authorization_state='authorized' THEN
    IF scope.status <> 'ACTIVE' OR scope.current_protocol_id <> protocol.id OR NEW.group_assignment_id IS NULL OR NOT EXISTS(SELECT 1 FROM class_memberships WHERE student_id=student_uuid AND class_id=binding.class_id AND status='active' AND ended_at IS NULL) OR NOT EXISTS(SELECT 1 FROM research_participants WHERE id=NEW.participant_id AND enrollment_status='enrolled') THEN
      RAISE EXCEPTION 'Live classroom research authorization required' USING ERRCODE='23514';
    END IF;
    IF COALESCE(jsonb_array_length(protocol.configuration->'consent_requirements'),0)=0 THEN RAISE EXCEPTION 'Consent policy unresolved' USING ERRCODE='23514'; END IF;
    FOR required_kind IN SELECT jsonb_array_elements_text(protocol.configuration->'consent_requirements') LOOP
      SELECT status INTO verdict FROM research_private.research_consent_records WHERE participant_id=NEW.participant_id AND kind=required_kind AND protocol_version=protocol.protocol_version ORDER BY recorded_at DESC,id DESC LIMIT 1;
      IF verdict IS DISTINCT FROM 'granted' THEN RAISE EXCEPTION 'Required consent evidence missing' USING ERRCODE='23514'; END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$""",
    """CREATE FUNCTION research_private.fluentt_rc_root() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, research_private AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM research_private.classroom_studies WHERE study_id=OLD.id) THEN
    RAISE EXCEPTION 'Use the separate versioned classroom research configuration' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$""",
]

EVENT_GUARD = """CREATE FUNCTION research_private.fluentt_rc_event() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, research_private AS $$
BEGIN
  IF NEW.group_assignment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM research_group_assignments a JOIN research_groups g ON g.id=a.group_id JOIN research_private.classroom_protocols p ON p.id=NEW.protocol_id JOIN research_private.classroom_bindings b ON b.id=NEW.binding_id WHERE a.id=NEW.group_assignment_id AND a.participant_id=NEW.participant_id AND a.study_id=NEW.study_id AND g.condition=NEW.condition AND g.scheduler_configuration_id=NEW.scheduler_configuration_id AND p.scope_id=NEW.scope_id AND b.scope_id=NEW.scope_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.configuration->'conditions') c WHERE c->>'condition'=NEW.condition AND (c->>'scheduler_configuration_id')::uuid=NEW.scheduler_configuration_id)) THEN
    RAISE EXCEPTION 'Event allocation context must match the pinned study protocol' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$"""

TABLES = (
    "classroom_studies",
    "classroom_protocols",
    "classroom_bindings",
    "classroom_enrollments",
    "classroom_assessment_references",
    "classroom_clearances",
    "classroom_events",
)


def upgrade():
    for statement in SCHEMA_SQL + INDEX_SQL:
        op.execute(statement)
    for statement in GUARDS + [EVENT_GUARD]:
        op.execute(statement)
    for table in (
        "classroom_protocols",
        "classroom_bindings",
        "classroom_assessment_references",
        "classroom_clearances",
        "classroom_events",
    ):
        op.execute(
            f"CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON research_private.{table} FOR EACH ROW EXECUTE FUNCTION fluentt_append_only()"
        )
    for table in ("classroom_protocols", "classroom_bindings"):
        op.execute(
            f"CREATE TRIGGER draft_scope BEFORE INSERT ON research_private.{table} FOR EACH ROW EXECUTE FUNCTION research_private.fluentt_rc_child()"
        )
    op.execute(
        "CREATE TRIGGER guard_scope BEFORE INSERT OR UPDATE OR DELETE ON research_private.classroom_studies FOR EACH ROW EXECUTE FUNCTION research_private.fluentt_rc_scope()"
    )
    op.execute(
        "CREATE TRIGGER guard_instrument BEFORE INSERT ON research_private.classroom_assessment_references FOR EACH ROW EXECUTE FUNCTION research_private.fluentt_rc_instrument()"
    )
    op.execute(
        "CREATE TRIGGER guard_clearance BEFORE INSERT ON research_private.classroom_clearances FOR EACH ROW EXECUTE FUNCTION research_private.fluentt_rc_clearance()"
    )
    op.execute(
        "CREATE TRIGGER guard_enrollment BEFORE INSERT OR UPDATE OR DELETE ON research_private.classroom_enrollments FOR EACH ROW EXECUTE FUNCTION research_private.fluentt_rc_enrollment()"
    )
    op.execute(
        "CREATE TRIGGER guard_classroom_research_root BEFORE UPDATE OR DELETE ON research_studies FOR EACH ROW EXECUTE FUNCTION research_private.fluentt_rc_root()"
    )
    op.execute(
        "CREATE TRIGGER guard_event BEFORE INSERT ON research_private.classroom_events FOR EACH ROW EXECUTE FUNCTION research_private.fluentt_rc_event()"
    )
    for table in TABLES:
        op.execute(f"REVOKE ALL ON TABLE research_private.{table} FROM PUBLIC")
    for function in ("scope", "child", "instrument", "clearance", "enrollment", "root", "event"):
        op.execute(f"REVOKE ALL ON FUNCTION research_private.fluentt_rc_{function}() FROM PUBLIC")


def downgrade():
    # Never erase retained configurations, authorizations, bindings or events.
    op.execute(
        """DO $$ BEGIN IF EXISTS(SELECT 1 FROM research_private.classroom_studies) OR EXISTS(SELECT 1 FROM research_private.classroom_protocols) OR EXISTS(SELECT 1 FROM research_private.classroom_bindings) OR EXISTS(SELECT 1 FROM research_private.classroom_events) OR EXISTS(SELECT 1 FROM research_private.classroom_clearances) OR EXISTS(SELECT 1 FROM research_private.classroom_enrollments) OR EXISTS(SELECT 1 FROM research_private.classroom_assessment_references) THEN RAISE EXCEPTION 'Retained classroom research prevents downgrade'; END IF; END; $$"""
    )
    op.execute("DROP TRIGGER guard_classroom_research_root ON research_studies")
    op.execute("ALTER TABLE research_private.classroom_studies DROP CONSTRAINT fk_classroom_study_current_protocol")
    for table in (
        "classroom_events",
        "classroom_enrollments",
        "classroom_assessment_references",
        "classroom_clearances",
        "classroom_bindings",
        "classroom_protocols",
        "classroom_studies",
    ):
        op.execute(f"DROP TABLE research_private.{table}")
    for function in ("scope", "child", "instrument", "clearance", "enrollment", "root", "event"):
        op.execute(f"DROP FUNCTION research_private.fluentt_rc_{function}()")
