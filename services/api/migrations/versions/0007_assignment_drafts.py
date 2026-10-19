"""Draft-only unset policies and durable creation retry identity; preserve historical values."""

from alembic import op
import sqlalchemy as sa

revision = "0007_assignment_drafts"
down_revision = "0006_question_associations"
branch_labels = depends_on = None


def upgrade():
    op.add_column("assignments", sa.Column("creation_request_id", sa.Uuid(), nullable=True))
    op.add_column("assignments", sa.Column("creation_fingerprint", sa.String(64), nullable=True))
    op.create_unique_constraint("uq_assignments_instructor_id", "assignments", ["instructor_id", "creation_request_id"])
    op.alter_column("assignment_versions", "max_attempts", existing_type=sa.Integer(), nullable=True)
    op.alter_column("assignment_questions", "points", existing_type=sa.Numeric(10, 2), nullable=True)
    op.execute("""CREATE FUNCTION fluentt_require_assignment_configuration() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
      IF NEW.locked_at IS NOT NULL AND (NEW.max_attempts IS NULL OR EXISTS
        (SELECT 1 FROM public.assignment_questions WHERE assignment_version_id=NEW.id AND points IS NULL)) THEN
        RAISE EXCEPTION 'Configure attempt and item policies before locking' USING ERRCODE='23514';
      END IF; RETURN NEW; END; $$""")
    op.execute(
        "CREATE TRIGGER require_assignment_configuration BEFORE INSERT OR UPDATE ON assignment_versions "
        "FOR EACH ROW EXECUTE FUNCTION fluentt_require_assignment_configuration()"
    )


def downgrade():
    # Refuse data loss or invented policy values when new nullable drafts exist.
    op.execute("""DO $$ BEGIN IF EXISTS (SELECT 1 FROM assignment_versions WHERE max_attempts IS NULL)
      OR EXISTS (SELECT 1 FROM assignment_questions WHERE points IS NULL)
      OR EXISTS (SELECT 1 FROM assignments WHERE creation_request_id IS NOT NULL) THEN
      RAISE EXCEPTION 'New assignment drafts require operator review before downgrade'; END IF; END $$""")
    op.execute("DROP TRIGGER require_assignment_configuration ON assignment_versions")
    op.execute("DROP FUNCTION fluentt_require_assignment_configuration()")
    op.alter_column("assignment_questions", "points", existing_type=sa.Numeric(10, 2), nullable=False)
    op.alter_column("assignment_versions", "max_attempts", existing_type=sa.Integer(), nullable=False)
    op.drop_constraint("uq_assignments_instructor_id", "assignments", type_="unique")
    op.drop_column("assignments", "creation_fingerprint")
    op.drop_column("assignments", "creation_request_id")
