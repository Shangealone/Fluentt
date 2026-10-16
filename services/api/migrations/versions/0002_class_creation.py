"""Class creation: preserve subjects independently, never reuse invitation codes, retry identity.

No data is deleted or relabeled. Historical duplicate codes require an explicit operator decision.
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_class_creation"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM class_join_codes GROUP BY code HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Historical duplicate class codes require review before migration; no records were changed';
      END IF;
    END $$""")
    op.alter_column("classes", "subject_id", existing_type=sa.Uuid(), nullable=True)
    op.add_column("classes", sa.Column("creation_request_id", sa.Uuid(), nullable=True))
    op.create_unique_constraint("uq_classes_owner_request", "classes", ["instructor_id", "creation_request_id"])
    op.create_unique_constraint("uq_class_join_codes_code", "class_join_codes", ["code"])


def downgrade():
    op.execute("""DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM classes WHERE subject_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot downgrade classes without subjects; preserve records and assign reviewed subjects first';
      END IF;
    END $$""")
    op.drop_constraint("uq_class_join_codes_code", "class_join_codes", type_="unique")
    op.drop_constraint("uq_classes_owner_request", "classes", type_="unique")
    op.drop_column("classes", "creation_request_id")
    op.alter_column("classes", "subject_id", existing_type=sa.Uuid(), nullable=False)
