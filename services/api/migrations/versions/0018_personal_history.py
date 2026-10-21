"""Add owner-only personal practice receipts; no historical backfill or progress writes."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0018_personal_history"
down_revision = "0017_research_classrooms"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "personal_activity_events",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("event_key", postgresql.UUID(), nullable=False),
        sa.Column("kind", sa.String(14), nullable=False),
        sa.Column("source_id", sa.String(120), nullable=False),
        sa.Column("content_version", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("language", sa.String(7), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "event_key"),
        sa.CheckConstraint(
            "kind IN ('learn_question','learn_lesson','voice_phrase','tutor_reply','tutor_session')",
            name="personal_activity_kind",
        ),
        sa.CheckConstraint("language IN ('english','tagalog')", name="language"),
        sa.CheckConstraint("content_version IS NULL OR content_version > 0", name="positive_version"),
        sa.CheckConstraint(
            "char_length(title) BETWEEN 1 AND 200 AND char_length(source_id) BETWEEN 1 AND 120 AND (prompt IS NULL OR char_length(prompt) <= 8000)",
            name="bounded_display",
        ),
        sa.CheckConstraint(
            "kind NOT IN ('tutor_reply','tutor_session') OR prompt IS NULL", name="no_dialogue_retention"
        ),
    )
    op.create_index("ix_personal_activity_events_user_id", "personal_activity_events", ["user_id"])
    op.create_index("ix_personal_activity_owner_time", "personal_activity_events", ["user_id", "recorded_at", "id"])
    op.execute("""CREATE FUNCTION guard_personal_activity_event() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Personal activity receipts are immutable'; END IF;
      IF NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND role='personal_student' AND profile_status='active' AND archived_at IS NULL) THEN
        RAISE EXCEPTION 'Personal activity requires an active personal owner';
      END IF;
      RETURN NEW;
    END $$""")
    op.execute(
        "CREATE TRIGGER personal_activity_immutable BEFORE INSERT OR UPDATE OR DELETE ON personal_activity_events FOR EACH ROW EXECUTE FUNCTION guard_personal_activity_event()"
    )
    op.execute("REVOKE ALL ON personal_activity_events FROM PUBLIC")
    op.execute("REVOKE ALL ON FUNCTION guard_personal_activity_event() FROM PUBLIC")


def downgrade():
    op.execute("""DO $$ BEGIN IF EXISTS (SELECT 1 FROM personal_activity_events) THEN
      RAISE EXCEPTION 'Retained personal history prevents downgrade'; END IF; END $$""")
    op.drop_table("personal_activity_events")
    op.execute("DROP FUNCTION guard_personal_activity_event()")
