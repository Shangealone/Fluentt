"""Append-only external assessment outcomes, per student and language."""
from alembic import op
import sqlalchemy as sa

revision = "0025_assessed_proficiency"
down_revision = "0024_instructor_questions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("student_proficiency_events",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        *[sa.Column(name, sa.UUID(), sa.ForeignKey(target, ondelete="RESTRICT"), nullable=False)
          for name, target in [("student_id", "users.id"), ("recorded_by", "users.id"), ("source_class_id", "classes.id")]],
        sa.Column("language", sa.String(7), nullable=False), sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(20)), sa.Column("assessed_on", sa.Date()),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorder_username", sa.String(200), nullable=False),
        sa.Column("request_id", sa.UUID(), nullable=False), sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.UniqueConstraint("student_id", "language", "ordinal"), sa.UniqueConstraint("recorded_by", "request_id"),
        sa.CheckConstraint("language IN ('english','tagalog')", name=op.f("ck_student_proficiency_events_language")),
        sa.CheckConstraint("ordinal > 0", name=op.f("ck_student_proficiency_events_ordinal")),
        sa.CheckConstraint("level IN ('beginner','intermediate','advanced')", name=op.f("ck_student_proficiency_events_level")),
        sa.CheckConstraint("(level IS NULL AND assessed_on IS NULL) OR (level IS NOT NULL AND assessed_on IS NOT NULL)", name=op.f("ck_student_proficiency_events_assessment_date")))
    for name in ("student_id", "recorded_by", "source_class_id"):
        op.create_index(f"ix_student_proficiency_events_{name}", "student_proficiency_events", [name])
    op.execute("""CREATE FUNCTION fluentt_preserve_proficiency_history() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$ BEGIN
      RAISE EXCEPTION 'External assessment history is append-only' USING ERRCODE='23514';
    END $$""")
    op.execute("CREATE TRIGGER preserve_proficiency_history BEFORE UPDATE OR DELETE ON student_proficiency_events FOR EACH ROW EXECUTE FUNCTION fluentt_preserve_proficiency_history()")


def downgrade():
    if op.get_bind().exec_driver_sql("SELECT EXISTS(SELECT 1 FROM student_proficiency_events)").scalar_one():
        raise RuntimeError("Assessment history exists; reviewed downgrade required.")
    op.drop_table("student_proficiency_events")
    op.execute("DROP FUNCTION fluentt_preserve_proficiency_history()")
