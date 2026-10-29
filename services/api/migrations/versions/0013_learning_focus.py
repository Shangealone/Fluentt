"""Store explicitly requested personal topics and lessons; retain legacy grades.

Revision ID: 0013_learning_focus
Revises: 0012_class_communication
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0013_learning_focus"
down_revision = "0012_class_communication"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("learner_profiles", sa.Column("learning_focus", postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column("learner_profiles", "learning_focus")
