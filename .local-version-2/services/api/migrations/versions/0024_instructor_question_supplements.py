"""Private class-scoped question supplements; retain frozen lesson versions."""
from alembic import op
import sqlalchemy as sa

revision = "0024_instructor_questions"
down_revision = "0023_teacher_lesson_proficiency"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("instructor_lesson_questions",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        *[sa.Column(name, sa.UUID(), sa.ForeignKey(target, ondelete="RESTRICT"), nullable=False)
          for name, target in [("instructor_id", "users.id"), ("class_id", "classes.id"), ("lesson_id", "lessons.id"), ("question_id", "questions.id")]],
        sa.Column("request_id", sa.UUID(), nullable=False), sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.UniqueConstraint("question_id"), sa.UniqueConstraint("instructor_id", "request_id"))
    for name in ("instructor_id", "class_id", "lesson_id", "question_id"):
        op.create_index(f"ix_instructor_lesson_questions_{name}", "instructor_lesson_questions", [name])
    op.execute("""CREATE FUNCTION fluentt_guard_question_supplement() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$ BEGIN
      IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Question supplement history is immutable' USING ERRCODE='23514'; END IF;
      IF NOT EXISTS(SELECT 1 FROM questions q JOIN classes c ON c.id=NEW.class_id
        WHERE q.id=NEW.question_id AND q.author_id=NEW.instructor_id
          AND c.instructor_id=NEW.instructor_id AND q.teacher_lesson_id IS NULL) THEN
        RAISE EXCEPTION 'Question supplement owner mismatch' USING ERRCODE='23514'; END IF;
      RETURN NEW;
    END $$""")
    op.execute("CREATE TRIGGER guard_question_supplement BEFORE INSERT OR UPDATE OR DELETE ON instructor_lesson_questions FOR EACH ROW EXECUTE FUNCTION fluentt_guard_question_supplement()")


def downgrade():
    if op.get_bind().exec_driver_sql("SELECT EXISTS(SELECT 1 FROM instructor_lesson_questions)").scalar_one():
        raise RuntimeError("Instructor question history exists; reviewed downgrade required.")
    op.drop_table("instructor_lesson_questions")
    op.execute("DROP FUNCTION fluentt_guard_question_supplement()")
