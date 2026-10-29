"""Store explicitly selected personal learning experience separately per language."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0016_learning_experience"
down_revision = "0015_username_spaces"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("learner_profiles", sa.Column("learning_experience", postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column("learner_profiles", "learning_experience")
