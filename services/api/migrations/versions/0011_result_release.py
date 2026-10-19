"""Append-only classroom result visibility. Existing grading/capture history is untouched."""

from alembic import op

revision = "0011_result_release"
down_revision = "0010_grading_results"
branch_labels = depends_on = None

SCHEMA_SQL = (
    "CREATE TABLE assessment_result_releases (\n\tattempt_id UUID NOT NULL, \n\trun_id UUID NOT NULL, \n\tassignment_version_id UUID NOT NULL, \n\tactor_id UUID NOT NULL, \n\trequest_key UUID NOT NULL, \n\tsequence INTEGER NOT NULL, \n\treleased BOOLEAN NOT NULL, \n\tid UUID DEFAULT gen_random_uuid() NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tCONSTRAINT pk_assessment_result_releases PRIMARY KEY (id), \n\tCONSTRAINT uq_result_release_sequence UNIQUE (attempt_id, sequence), \n\tCONSTRAINT uq_result_release_request UNIQUE (actor_id, request_key), \n\tCONSTRAINT fk_result_release_run_version FOREIGN KEY(run_id, assignment_version_id) REFERENCES grading_runs (id, assignment_version_id) ON DELETE RESTRICT, \n\tCONSTRAINT ck_assessment_result_releases_positive_sequence CHECK (sequence > 0), \n\tCONSTRAINT fk_assessment_result_releases_attempt_id_assignment_attempts FOREIGN KEY(attempt_id) REFERENCES assignment_attempts (id) ON DELETE RESTRICT, \n\tCONSTRAINT fk_assessment_result_releases_run_id_grading_runs FOREIGN KEY(run_id) REFERENCES grading_runs (id) ON DELETE RESTRICT, \n\tCONSTRAINT fk_assessment_result_releases_assignment_version_id_ass_8d96 FOREIGN KEY(assignment_version_id) REFERENCES assignment_versions (id) ON DELETE RESTRICT, \n\tCONSTRAINT fk_assessment_result_releases_actor_id_users FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE RESTRICT\n)",
    "CREATE INDEX ix_assessment_result_releases_actor_id ON assessment_result_releases (actor_id)",
    "CREATE INDEX ix_assessment_result_releases_assignment_version_id ON assessment_result_releases (assignment_version_id)",
    "CREATE INDEX ix_assessment_result_releases_attempt_id ON assessment_result_releases (attempt_id)",
    "CREATE INDEX ix_assessment_result_releases_run_id ON assessment_result_releases (run_id)",
)


def upgrade():
    for statement in SCHEMA_SQL:
        op.execute(statement)
    op.execute("""
    CREATE FUNCTION fluentt_guard_result_release() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE previous assessment_result_releases%ROWTYPE;
            evidence grading_runs%ROWTYPE;
    BEGIN
        IF TG_OP <> 'INSERT' THEN
            RAISE EXCEPTION 'Result visibility history is immutable' USING ERRCODE='23514';
        END IF;
        PERFORM 1 FROM assignment_attempts WHERE id=NEW.attempt_id FOR UPDATE;
        SELECT * INTO evidence FROM grading_runs WHERE id=NEW.run_id;
        IF NOT FOUND OR evidence.completed_at IS NULL OR evidence.status <> 'COMPLETE'
           OR evidence.context <> 'ordinary_classroom' OR evidence.attempt_id <> NEW.attempt_id
           OR evidence.assignment_version_id <> NEW.assignment_version_id THEN
            RAISE EXCEPTION 'Only the exact complete classroom evaluation may be released' USING ERRCODE='23514';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM assignment_attempts a JOIN assignment_versions v ON v.id=a.assignment_version_id
            JOIN assignments r ON r.id=v.assignment_id JOIN classes c ON c.id=r.class_id
            JOIN users u ON u.id=NEW.actor_id
            WHERE a.id=NEW.attempt_id AND a.status='submitted' AND a.capture_contract='unscored-capture-v1'
              AND a.submitted_at IS NOT NULL AND v.publication_contract='distribution-only-v1'
              AND v.locked_at IS NOT NULL AND r.status='published'
              AND r.instructor_id=u.id AND c.instructor_id=u.id AND u.role='instructor'
        ) THEN
            RAISE EXCEPTION 'Invalid classroom release context' USING ERRCODE='23514';
        END IF;
        SELECT * INTO previous FROM assessment_result_releases WHERE attempt_id=NEW.attempt_id
            ORDER BY sequence DESC LIMIT 1;
        IF FOUND THEN
            IF NEW.run_id <> previous.run_id OR NEW.sequence <> previous.sequence+1
               OR NEW.released=previous.released THEN
                RAISE EXCEPTION 'Pinned result or visibility sequence conflict' USING ERRCODE='23514';
            END IF;
        ELSIF NEW.sequence <> 1 OR NOT NEW.released THEN
            RAISE EXCEPTION 'Initial result decision must release' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
    END $$;
    CREATE TRIGGER guard_result_release BEFORE INSERT OR UPDATE OR DELETE ON assessment_result_releases
      FOR EACH ROW EXECUTE FUNCTION fluentt_guard_result_release();
    REVOKE ALL ON assessment_result_releases FROM PUBLIC;
    """)


def downgrade():
    op.execute("""DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM assessment_result_releases) THEN
            RAISE EXCEPTION 'Result release history is occupied; downgrade refused';
        END IF;
    END $$;""")
    op.execute("DROP TRIGGER guard_result_release ON assessment_result_releases")
    op.execute("DROP FUNCTION fluentt_guard_result_release()")
    op.drop_table("assessment_result_releases")
