"""Immutable internal evaluation records. Frozen DDL, no existing learner row changes."""

from alembic import op

revision = "0010_grading_results"
down_revision = "0009_response_capture"
branch_labels = depends_on = None

SCHEMA_SQL = (
    "CREATE TABLE grading_runs (\n\tattempt_id UUID NOT NULL, \n\tassignment_version_id UUID NOT NULL, \n\tactor_id UUID NOT NULL, \n\tengine_version VARCHAR(80) NOT NULL, \n\tpolicy_version VARCHAR(80) NOT NULL, \n\tpolicy_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tevaluated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tcompleted_at TIMESTAMP WITH TIME ZONE, \n\tcontext VARCHAR(40) NOT NULL, \n\tstatus VARCHAR(15) NOT NULL, \n\titem_count INTEGER NOT NULL, \n\tearned_points NUMERIC(10, 2), \n\tpossible_points NUMERIC(10, 2), \n\tautomatic_earned_points NUMERIC(10, 2) NOT NULL, \n\tautomatic_possible_points NUMERIC(10, 2) NOT NULL, \n\tid UUID DEFAULT gen_random_uuid() NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tCONSTRAINT pk_grading_runs PRIMARY KEY (id), \n\tCONSTRAINT uq_grading_runs_attempt_id UNIQUE (attempt_id, engine_version, policy_version), \n\tCONSTRAINT uq_grading_runs_version UNIQUE (id, assignment_version_id), \n\tCONSTRAINT fk_grading_runs_attempt_version FOREIGN KEY(attempt_id, assignment_version_id) REFERENCES assignment_attempts (id, assignment_version_id) ON DELETE RESTRICT, \n\tCONSTRAINT ck_grading_runs_valid_subtotals CHECK (item_count > 0 AND automatic_earned_points >= 0 AND automatic_possible_points >= automatic_earned_points), \n\tCONSTRAINT ck_grading_runs_valid_totals CHECK ((status='COMPLETE' AND earned_points IS NOT NULL AND possible_points IS NOT NULL AND earned_points >= 0 AND possible_points >= earned_points AND possible_points > 0) OR (status <> 'COMPLETE' AND earned_points IS NULL AND possible_points IS NULL)), \n\tCONSTRAINT ck_grading_runs_classroom_only CHECK (context='ordinary_classroom'), \n\tCONSTRAINT fk_grading_runs_attempt_id_assignment_attempts FOREIGN KEY(attempt_id) REFERENCES assignment_attempts (id) ON DELETE RESTRICT, \n\tCONSTRAINT fk_grading_runs_assignment_version_id_assignment_versions FOREIGN KEY(assignment_version_id) REFERENCES assignment_versions (id) ON DELETE RESTRICT, \n\tCONSTRAINT fk_grading_runs_actor_id_users FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE RESTRICT, \n\tCONSTRAINT ck_grading_runs_grading_run_status CHECK (status IN ('COMPLETE', 'REVIEW_REQUIRED', 'NOT_APPLICABLE'))\n)",
    "CREATE INDEX ix_grading_runs_actor_id ON grading_runs (actor_id)",
    "CREATE INDEX ix_grading_runs_assignment_version_id ON grading_runs (assignment_version_id)",
    "CREATE INDEX ix_grading_runs_attempt_id ON grading_runs (attempt_id)",
    "CREATE TABLE grading_item_results (\n\trun_id UUID NOT NULL, \n\tassignment_version_id UUID NOT NULL, \n\tassignment_question_id UUID NOT NULL, \n\tquestion_revision_id UUID NOT NULL, \n\tresponse_id UUID, \n\tkey_id UUID, \n\tsource_grading_version VARCHAR(80), \n\trubric_version VARCHAR(80) NOT NULL, \n\tmethod VARCHAR(40) NOT NULL, \n\tposition INTEGER NOT NULL, \n\tstate VARCHAR(22) NOT NULL, \n\treason VARCHAR(80) NOT NULL, \n\tcorrect BOOLEAN, \n\tawarded_points NUMERIC(10, 2), \n\tmax_points NUMERIC(10, 2), \n\tevaluation_metadata JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tid UUID DEFAULT gen_random_uuid() NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tCONSTRAINT pk_grading_item_results PRIMARY KEY (id), \n\tCONSTRAINT uq_grading_item_results_run_id UNIQUE (run_id, assignment_question_id), \n\tCONSTRAINT uq_grading_item_results_position UNIQUE (run_id, position), \n\tCONSTRAINT fk_grading_items_run_version FOREIGN KEY(run_id, assignment_version_id) REFERENCES grading_runs (id, assignment_version_id) ON DELETE RESTRICT, \n\tCONSTRAINT fk_grading_items_question_version FOREIGN KEY(assignment_question_id, assignment_version_id) REFERENCES assignment_questions (id, assignment_version_id) ON DELETE RESTRICT, \n\tCONSTRAINT ck_grading_item_results_positive_position CHECK (position > 0), \n\tCONSTRAINT ck_grading_item_results_valid_outcome CHECK ((state='AUTO_GRADABLE' AND correct IS NOT NULL AND max_points IS NOT NULL AND max_points=1.00 AND awarded_points IS NOT NULL AND awarded_points IN (0.00,1.00) AND awarded_points=CASE WHEN correct THEN 1.00 ELSE 0.00 END) OR (state <> 'AUTO_GRADABLE' AND correct IS NULL AND awarded_points IS NULL AND max_points IS NULL)), \n\tCONSTRAINT fk_grading_item_results_run_id_grading_runs FOREIGN KEY(run_id) REFERENCES grading_runs (id) ON DELETE RESTRICT, \n\tCONSTRAINT fk_grading_item_results_assignment_version_id_assignmen_c0b9 FOREIGN KEY(assignment_version_id) REFERENCES assignment_versions (id) ON DELETE RESTRICT, \n\tCONSTRAINT fk_grading_item_results_assignment_question_id_assignme_fbf9 FOREIGN KEY(assignment_question_id) REFERENCES assignment_questions (id) ON DELETE RESTRICT, \n\tCONSTRAINT fk_grading_item_results_question_revision_id_question_revisions FOREIGN KEY(question_revision_id) REFERENCES question_revisions (id) ON DELETE RESTRICT, \n\tCONSTRAINT fk_grading_item_results_response_id_student_responses FOREIGN KEY(response_id) REFERENCES student_responses (id) ON DELETE RESTRICT, \n\tCONSTRAINT fk_grading_item_results_key_id_question_answer_keys FOREIGN KEY(key_id) REFERENCES question_answer_keys (id) ON DELETE RESTRICT, \n\tCONSTRAINT ck_grading_item_results_grading_item_state CHECK (state IN ('AUTO_GRADABLE', 'MANUAL_REVIEW_REQUIRED', 'NOT_APPLICABLE', 'UNSUPPORTED'))\n)",
    "CREATE INDEX ix_grading_item_results_assignment_question_id ON grading_item_results (assignment_question_id)",
    "CREATE INDEX ix_grading_item_results_assignment_version_id ON grading_item_results (assignment_version_id)",
    "CREATE INDEX ix_grading_item_results_key_id ON grading_item_results (key_id)",
    "CREATE INDEX ix_grading_item_results_question_revision_id ON grading_item_results (question_revision_id)",
    "CREATE INDEX ix_grading_item_results_response_id ON grading_item_results (response_id)",
    "CREATE INDEX ix_grading_item_results_run_id ON grading_item_results (run_id)",
)


def upgrade():
    for statement in SCHEMA_SQL:
        op.execute(statement)
    install_guards()


def install_guards():
    op.execute("REVOKE ALL ON grading_runs, grading_item_results FROM PUBLIC")
    op.execute("""CREATE FUNCTION fluentt_guard_grading_run() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
      DECLARE n integer; e numeric; m numeric; expected text; BEGIN
      IF TG_OP<>'INSERT' THEN
        IF OLD.completed_at IS NOT NULL OR TG_OP='DELETE' THEN
          RAISE EXCEPTION 'Retain immutable evaluation history' USING ERRCODE='23514'; END IF;
        IF (to_jsonb(NEW)-'completed_at'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'completed_at'-'updated_at') THEN
          RAISE EXCEPTION 'Evaluation definition is immutable' USING ERRCODE='23514'; END IF;
      ELSIF NEW.completed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Seal evaluation after its items' USING ERRCODE='23514';
      END IF;
      PERFORM id FROM public.assignment_attempts WHERE id=NEW.attempt_id FOR SHARE;
      IF NOT EXISTS (SELECT 1 FROM public.assignment_attempts a JOIN public.assignment_versions v ON v.id=a.assignment_version_id
        JOIN public.assignments r ON r.id=v.assignment_id WHERE a.id=NEW.attempt_id AND a.assignment_version_id=NEW.assignment_version_id
        AND a.capture_contract='unscored-capture-v1' AND a.status='submitted' AND a.submitted_at IS NOT NULL
        AND a.submission_key IS NOT NULL AND a.submission_fingerprint IS NOT NULL AND a.attempt_number=1
        AND v.publication_contract='distribution-only-v1' AND v.locked_at IS NOT NULL AND r.status='published') THEN
        RAISE EXCEPTION 'Evaluation requires finalized ordinary classroom capture' USING ERRCODE='23514'; END IF;
      IF NEW.completed_at IS NOT NULL THEN
        SELECT count(*),coalesce(sum(awarded_points) FILTER (WHERE state='AUTO_GRADABLE'),0),
          coalesce(sum(max_points) FILTER (WHERE state='AUTO_GRADABLE'),0) INTO n,e,m
          FROM public.grading_item_results WHERE run_id=NEW.id;
        IF n<>NEW.item_count OR n<>(SELECT count(*) FROM public.assignment_questions WHERE assignment_version_id=NEW.assignment_version_id)
          OR e<>NEW.automatic_earned_points OR m<>NEW.automatic_possible_points THEN
          RAISE EXCEPTION 'Incomplete or inconsistent evaluation totals' USING ERRCODE='23514'; END IF;
        expected := CASE WHEN EXISTS (SELECT 1 FROM public.grading_item_results WHERE run_id=NEW.id AND state IN ('MANUAL_REVIEW_REQUIRED','UNSUPPORTED'))
          THEN 'REVIEW_REQUIRED' WHEN m>0 THEN 'COMPLETE' ELSE 'NOT_APPLICABLE' END;
        IF NEW.status<>expected OR (expected='COMPLETE' AND (NEW.earned_points IS DISTINCT FROM e OR NEW.possible_points IS DISTINCT FROM m))
          OR NEW.completed_at<NEW.evaluated_at THEN
          RAISE EXCEPTION 'Evaluation state does not match item outcomes' USING ERRCODE='23514'; END IF;
      END IF; RETURN NEW; END; $$""")
    op.execute(
        "CREATE TRIGGER guard_grading_run BEFORE INSERT OR UPDATE OR DELETE ON grading_runs "
        "FOR EACH ROW EXECUTE FUNCTION fluentt_guard_grading_run()"
    )
    op.execute("""CREATE FUNCTION fluentt_guard_grading_item() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE r public.grading_runs%ROWTYPE; BEGIN
      IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Evaluation items are append-only' USING ERRCODE='23514'; END IF;
      SELECT * INTO r FROM public.grading_runs WHERE id=NEW.run_id FOR UPDATE;
      IF r.id IS NULL OR r.completed_at IS NOT NULL OR NEW.rubric_version<>r.policy_version THEN
        RAISE EXCEPTION 'Evaluation is unavailable or sealed' USING ERRCODE='23514'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.assignment_questions a JOIN public.question_revisions q ON q.id=a.question_revision_id
        WHERE a.id=NEW.assignment_question_id AND a.assignment_version_id=r.assignment_version_id
        AND a.question_revision_id=NEW.question_revision_id AND a.position=NEW.position AND q.method=NEW.method) THEN
        RAISE EXCEPTION 'Evaluation item version mismatch' USING ERRCODE='23514'; END IF;
      IF NEW.response_id IS DISTINCT FROM (SELECT id FROM public.student_responses WHERE attempt_id=r.attempt_id AND assignment_question_id=NEW.assignment_question_id)
        OR NEW.key_id IS DISTINCT FROM (SELECT id FROM public.question_answer_keys WHERE question_revision_id=NEW.question_revision_id)
        OR NEW.source_grading_version IS DISTINCT FROM (SELECT grading_version FROM public.question_answer_keys WHERE question_revision_id=NEW.question_revision_id) THEN
        RAISE EXCEPTION 'Evaluation evidence mismatch' USING ERRCODE='23514'; END IF;
      RETURN NEW; END; $$""")
    op.execute(
        "CREATE TRIGGER guard_grading_item BEFORE INSERT OR UPDATE OR DELETE ON grading_item_results "
        "FOR EACH ROW EXECUTE FUNCTION fluentt_guard_grading_item()"
    )


def downgrade():
    op.execute("""DO $$ BEGIN IF EXISTS (SELECT 1 FROM grading_runs) OR EXISTS (SELECT 1 FROM grading_item_results)
      THEN RAISE EXCEPTION 'Preserve grading history before downgrade'; END IF; END $$""")
    op.execute("DROP TRIGGER guard_grading_item ON grading_item_results")
    op.execute("DROP FUNCTION fluentt_guard_grading_item()")
    op.execute("DROP TRIGGER guard_grading_run ON grading_runs")
    op.execute("DROP FUNCTION fluentt_guard_grading_run()")
    op.drop_table("grading_item_results")
    op.drop_table("grading_runs")
