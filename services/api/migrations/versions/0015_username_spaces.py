"""Allow internal spaces in usernames without changing canonical identity."""
from alembic import op

revision = "0015_username_spaces"
down_revision = "0014_user_passwords"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint(op.f("ck_users_username_format"), "users", type_="check")
    op.create_check_constraint(op.f("ck_users_username_format"), "users",
                               "username ~ '^[A-Za-z0-9_][A-Za-z0-9_ ]{1,30}[A-Za-z0-9_]$'")


def downgrade():
    op.execute("""DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM users WHERE username LIKE '% %') THEN
        RAISE EXCEPTION 'Cannot downgrade while usernames contain spaces';
      END IF;
    END $$""")
    op.drop_constraint(op.f("ck_users_username_format"), "users", type_="check")
    op.create_check_constraint(op.f("ck_users_username_format"), "users", "username ~ '^[A-Za-z0-9_]{3,32}$'")
