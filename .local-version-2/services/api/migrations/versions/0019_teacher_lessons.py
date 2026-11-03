"""Add private reusable teacher lessons, immutable versions and explicit class shares."""
from alembic import op

revision = "0019_teacher_lessons"
down_revision = "0018_personal_history"
branch_labels = None
depends_on = None


def upgrade():
    entity = "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()"
    statements = [
        f"CREATE TABLE teacher_lessons ({entity}, instructor_id uuid NOT NULL REFERENCES users(id), archived_at timestamptz, revision integer NOT NULL DEFAULT 1 CHECK(revision > 0))",
        "CREATE INDEX ix_teacher_lessons_instructor_id ON teacher_lessons(instructor_id)",
        "ALTER TABLE lessons ALTER COLUMN topic_id DROP NOT NULL",
        "ALTER TABLE lessons ADD COLUMN teacher_owned boolean NOT NULL DEFAULT false",
        "ALTER TABLE lessons ADD CONSTRAINT ck_lessons_lesson_source CHECK ((teacher_owned AND topic_id IS NULL) OR (NOT teacher_owned AND topic_id IS NOT NULL))",
        f"CREATE TABLE teacher_lesson_versions ({entity}, teacher_lesson_id uuid NOT NULL REFERENCES teacher_lessons(id), lesson_id uuid NOT NULL UNIQUE REFERENCES lessons(id), version integer NOT NULL CHECK(version > 0), grade_level_id uuid NOT NULL REFERENCES grade_levels(id), subject_id uuid NOT NULL REFERENCES subjects(id), language varchar(7) NOT NULL CHECK(language IN ('english','tagalog')), sections jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(sections)='array'), published_at timestamptz, UNIQUE(teacher_lesson_id,version))",
        "CREATE INDEX ix_teacher_lesson_versions_teacher_lesson_id ON teacher_lesson_versions(teacher_lesson_id)",
        "ALTER TABLE questions ADD COLUMN teacher_lesson_id uuid REFERENCES teacher_lessons(id)",
        "CREATE INDEX ix_questions_teacher_lesson_id ON questions(teacher_lesson_id)",
        f"CREATE TABLE teacher_lesson_questions ({entity}, version_id uuid NOT NULL REFERENCES teacher_lesson_versions(id), question_revision_id uuid NOT NULL UNIQUE REFERENCES question_revisions(id), position integer NOT NULL CHECK(position>0), UNIQUE(version_id,position))",
        f"CREATE TABLE teacher_lesson_shares ({entity}, teacher_lesson_id uuid NOT NULL REFERENCES teacher_lessons(id), class_id uuid NOT NULL REFERENCES classes(id), version_id uuid NOT NULL REFERENCES teacher_lesson_versions(id), ordinal integer NOT NULL CHECK(ordinal>0), active boolean NOT NULL, request_id uuid NOT NULL, UNIQUE(teacher_lesson_id,class_id,ordinal), UNIQUE(teacher_lesson_id,class_id,request_id))",
        "CREATE INDEX ix_teacher_lesson_shares_class_id ON teacher_lesson_shares(class_id)",
        f"CREATE TABLE teacher_lesson_mutations ({entity}, instructor_id uuid NOT NULL REFERENCES users(id), request_id uuid NOT NULL, fingerprint varchar(64) NOT NULL, response jsonb NOT NULL, UNIQUE(instructor_id,request_id))",
        """CREATE FUNCTION fluentt_guard_teacher_content() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
        DECLARE v public.teacher_lesson_versions; owner uuid; q public.question_revisions; root uuid;
        BEGIN
          PERFORM pg_advisory_xact_lock(78090001);
          IF TG_TABLE_NAME IN ('teacher_lesson_shares','teacher_lesson_mutations') AND TG_OP <> 'INSERT' THEN
            RAISE EXCEPTION 'Teacher lesson request and sharing history is immutable' USING ERRCODE='23514';
          END IF;
          IF TG_TABLE_NAME='teacher_lessons' AND TG_OP='UPDATE' AND NEW.instructor_id IS DISTINCT FROM OLD.instructor_id THEN
            RAISE EXCEPTION 'Teacher lesson ownership is immutable' USING ERRCODE='23514';
          ELSIF TG_TABLE_NAME='teacher_lesson_versions' THEN
            IF TG_OP<>'INSERT' AND OLD.published_at IS NOT NULL THEN
              RAISE EXCEPTION 'Published teacher versions are immutable' USING ERRCODE='23514';
            END IF;
            IF TG_OP='UPDATE' AND (NEW.teacher_lesson_id,NEW.lesson_id,NEW.version) IS DISTINCT FROM (OLD.teacher_lesson_id,OLD.lesson_id,OLD.version) THEN
              RAISE EXCEPTION 'Teacher version identity is immutable' USING ERRCODE='23514';
            END IF;
            IF TG_OP<>'DELETE' AND NOT EXISTS(SELECT 1 FROM lessons WHERE id=NEW.lesson_id AND teacher_owned AND topic_id IS NULL) THEN
              RAISE EXCEPTION 'Teacher version requires its own lesson source' USING ERRCODE='23514';
            END IF;
            IF TG_OP='UPDATE' AND OLD.published_at IS NULL AND NEW.published_at IS NOT NULL THEN
              IF NOT EXISTS(SELECT 1 FROM lessons WHERE id=NEW.lesson_id AND status='published') OR
                 (jsonb_array_length(NEW.sections)=0 AND NOT EXISTS(SELECT 1 FROM teacher_lesson_questions WHERE version_id=NEW.id)) OR
                 EXISTS(SELECT 1 FROM teacher_lesson_questions t JOIN question_revisions r ON r.id=t.question_revision_id
                        WHERE t.version_id=NEW.id AND (r.locked_at IS NULL OR NOT EXISTS(SELECT 1 FROM question_answer_keys k WHERE k.question_revision_id=r.id))) THEN
                RAISE EXCEPTION 'Publish complete content and locked question evidence only' USING ERRCODE='23514';
              END IF;
            END IF;
          ELSIF TG_TABLE_NAME='lessons' THEN
            IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM teacher_lesson_versions WHERE lesson_id=OLD.id AND published_at IS NOT NULL) THEN
              RAISE EXCEPTION 'Published teacher lesson text is immutable' USING ERRCODE='23514';
            END IF;
            IF TG_OP='UPDATE' AND NEW.teacher_owned IS DISTINCT FROM OLD.teacher_owned THEN
              RAISE EXCEPTION 'Lesson source identity is immutable' USING ERRCODE='23514';
            END IF;
          ELSIF TG_TABLE_NAME='teacher_lesson_questions' THEN
            SELECT * INTO v FROM teacher_lesson_versions WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.version_id ELSE NEW.version_id END;
            IF v.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published question order is immutable' USING ERRCODE='23514'; END IF;
            IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Replace draft links instead of moving version identities' USING ERRCODE='23514'; END IF;
            IF TG_OP='INSERT' THEN
              SELECT * INTO q FROM question_revisions WHERE id=NEW.question_revision_id;
              IF q.lesson_id<>v.lesson_id OR NOT EXISTS(SELECT 1 FROM questions WHERE id=q.question_id AND teacher_lesson_id=v.teacher_lesson_id) THEN
                RAISE EXCEPTION 'Teacher question must belong to its lesson version' USING ERRCODE='23514';
              END IF;
            END IF;
          ELSIF TG_TABLE_NAME='teacher_lesson_shares' THEN
            SELECT * INTO v FROM teacher_lesson_versions WHERE id=NEW.version_id;
            SELECT instructor_id INTO owner FROM teacher_lessons WHERE id=NEW.teacher_lesson_id;
            IF v.teacher_lesson_id<>NEW.teacher_lesson_id OR v.published_at IS NULL OR NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND instructor_id=owner) THEN
              RAISE EXCEPTION 'Sharing requires an owned class and published version' USING ERRCODE='23514';
            END IF;
            IF NEW.active AND (EXISTS(SELECT 1 FROM teacher_lessons WHERE id=NEW.teacher_lesson_id AND archived_at IS NOT NULL) OR
                NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND status='active' AND archived_at IS NULL AND grade_level_id=v.grade_level_id AND language=v.language AND subject_id=v.subject_id)) THEN
              RAISE EXCEPTION 'New sharing requires a compatible active class and explicit subject' USING ERRCODE='23514';
            END IF;
          ELSIF TG_TABLE_NAME='questions' AND TG_OP<>'DELETE' THEN
            IF TG_OP='UPDATE' AND (NEW.teacher_lesson_id,NEW.author_id) IS DISTINCT FROM (OLD.teacher_lesson_id,OLD.author_id) AND OLD.teacher_lesson_id IS NOT NULL THEN
              RAISE EXCEPTION 'Teacher question ownership is immutable' USING ERRCODE='23514';
            END IF;
            IF NEW.teacher_lesson_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM teacher_lessons WHERE id=NEW.teacher_lesson_id AND instructor_id=NEW.author_id) THEN
              RAISE EXCEPTION 'Teacher question author must own its lesson' USING ERRCODE='23514';
            END IF;
          ELSIF TG_TABLE_NAME='question_revisions' AND TG_OP<>'DELETE' THEN
            SELECT * INTO v FROM teacher_lesson_versions WHERE lesson_id=NEW.lesson_id;
            SELECT teacher_lesson_id INTO root FROM questions WHERE id=NEW.question_id;
            IF (v.id IS NULL) IS DISTINCT FROM (root IS NULL) OR (root IS NOT NULL AND (v.teacher_lesson_id<>root OR v.language<>NEW.language OR v.published_at IS NOT NULL)) THEN
              RAISE EXCEPTION 'Author only within the matching owned draft version' USING ERRCODE='23514';
            END IF;
          ELSIF TG_TABLE_NAME IN ('grade_levels','subjects') AND TG_OP<>'INSERT' THEN
            IF TG_OP='DELETE' OR (to_jsonb(OLD)-'updated_at') IS DISTINCT FROM (to_jsonb(NEW)-'updated_at') THEN
              IF EXISTS(SELECT 1 FROM teacher_lesson_versions WHERE published_at IS NOT NULL AND
                  (CASE WHEN TG_TABLE_NAME='grade_levels' THEN grade_level_id ELSE subject_id END)=OLD.id) THEN
                RAISE EXCEPTION 'Published teacher context labels are immutable' USING ERRCODE='23514';
              END IF;
            END IF;
          END IF;
          IF TG_OP='DELETE' THEN RETURN OLD; END IF;
          RETURN NEW;
        END $$""",
        """CREATE FUNCTION fluentt_teacher_leaf_consistency() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
        BEGIN
          IF EXISTS(SELECT 1 FROM lessons l WHERE l.id=NEW.id AND l.teacher_owned AND NOT EXISTS(SELECT 1 FROM teacher_lesson_versions v WHERE v.lesson_id=l.id)) THEN
            RAISE EXCEPTION 'A teacher lesson leaf requires version ownership' USING ERRCODE='23514';
          END IF;
          RETURN NEW;
        END $$""",
        "CREATE CONSTRAINT TRIGGER teacher_leaf_consistency AFTER INSERT OR UPDATE ON lessons DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fluentt_teacher_leaf_consistency()",
    ]
    for statement in statements:
        op.execute(statement)
    for table in ("teacher_lessons", "teacher_lesson_versions", "teacher_lesson_questions", "teacher_lesson_shares", "teacher_lesson_mutations", "lessons", "questions", "question_revisions", "grade_levels", "subjects"):
        op.execute(f"CREATE TRIGGER guard_teacher_content BEFORE INSERT OR UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION fluentt_guard_teacher_content()")
    for table in ("teacher_lessons", "teacher_lesson_versions"):
        op.execute(f"CREATE TRIGGER touch_updated_at BEFORE UPDATE ON {table} FOR EACH ROW EXECUTE FUNCTION fluentt_touch_updated_at()")


def downgrade():
    # Never remove retained authored content, publication, or replay evidence automatically.
    op.execute("""DO $$ BEGIN IF EXISTS(SELECT 1 FROM teacher_lessons) THEN RAISE EXCEPTION 'Teacher lesson history exists; reviewed downgrade required'; END IF; END $$""")
    for table in ("teacher_lessons", "teacher_lesson_versions", "teacher_lesson_questions", "teacher_lesson_shares", "teacher_lesson_mutations", "lessons", "questions", "question_revisions", "grade_levels", "subjects"):
        op.execute(f"DROP TRIGGER guard_teacher_content ON {table}")
    op.execute("DROP TRIGGER teacher_leaf_consistency ON lessons")
    op.execute("DROP FUNCTION fluentt_teacher_leaf_consistency()")
    op.execute("DROP FUNCTION fluentt_guard_teacher_content()")
    op.execute("ALTER TABLE questions DROP COLUMN teacher_lesson_id")
    for table in ("teacher_lesson_mutations", "teacher_lesson_shares", "teacher_lesson_questions", "teacher_lesson_versions", "teacher_lessons"):
        op.execute(f"DROP TABLE {table}")
    op.execute("ALTER TABLE lessons DROP CONSTRAINT ck_lessons_lesson_source")
    op.execute("ALTER TABLE lessons DROP COLUMN teacher_owned")
    op.execute("ALTER TABLE lessons ALTER COLUMN topic_id SET NOT NULL")
