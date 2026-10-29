"""Add password_hash column to users table for account credential protection.

Revision ID: 0014_user_passwords
Revises: 0013_learning_focus
"""

from alembic import op
import sqlalchemy as sa

revision = "0014_user_passwords"
down_revision = "0013_learning_focus"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))


def downgrade():
    op.drop_column("users", "password_hash")
