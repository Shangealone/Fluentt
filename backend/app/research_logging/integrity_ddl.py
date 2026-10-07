"""Frozen D9 PostgreSQL guards, also installed for isolated create_all schemas."""

HISTORY_TABLES = (
    "research_events",
    "review_attempts",
    "review_schedules",
    "accepted_client_events",
)
GUARDED_TABLES = (*HISTORY_TABLES, "review_sessions")
RESEARCH_INTEGRITY_DDL = (
    """CREATE OR REPLACE FUNCTION fluentt_research_immutable() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'Accepted research evidence cannot be updated, deleted or truncated; approved policy required'
        USING ERRCODE = '55000';
    END; $$""",
    """CREATE OR REPLACE FUNCTION fluentt_research_session_immutable() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS (SELECT 1 FROM review_attempts WHERE session_id = OLD.id) THEN
        RAISE EXCEPTION 'Accepted review session identity is immutable' USING ERRCODE = '55000';
      END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END; $$""",
    """CREATE OR REPLACE FUNCTION fluentt_participant_code_immutable() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.participant_code IS DISTINCT FROM OLD.participant_code THEN
        RAISE EXCEPTION 'Provisioned participant code is immutable' USING ERRCODE = '55000';
      END IF;
      RETURN NEW;
    END; $$""",
    *(
        statement
        for table in HISTORY_TABLES
        for statement in (
            f"DROP TRIGGER IF EXISTS d9_immutable_row ON {table}",
            f"CREATE TRIGGER d9_immutable_row BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION fluentt_research_immutable()",
        )
    ),
    *(
        statement
        for table in GUARDED_TABLES
        for statement in (
            f"DROP TRIGGER IF EXISTS d9_no_truncate ON {table}",
            f"CREATE TRIGGER d9_no_truncate BEFORE TRUNCATE ON {table} FOR EACH STATEMENT EXECUTE FUNCTION fluentt_research_immutable()",
        )
    ),
    "DROP TRIGGER IF EXISTS d9_immutable_session ON review_sessions",
    "CREATE TRIGGER d9_immutable_session BEFORE UPDATE OR DELETE ON review_sessions FOR EACH ROW EXECUTE FUNCTION fluentt_research_session_immutable()",
    "DROP TRIGGER IF EXISTS d9_immutable_code ON users",
    "CREATE TRIGGER d9_immutable_code BEFORE UPDATE OF participant_code ON users FOR EACH ROW EXECUTE FUNCTION fluentt_participant_code_immutable()",
)
