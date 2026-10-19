"""Add isolated administrator browser sessions and one-use OIDC attempts."""

from alembic import op
import sqlalchemy as sa

revision = "0003_admin_sessions"
down_revision = "0002_class_creation"
branch_labels = None
depends_on = None


def columns():
    return [
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade():
    op.create_table(
        "admin_browser_sessions",
        *columns(),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("credential_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("absolute_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("credential_digest ~ '^[0-9a-f]{64}$'", name="digest_format"),
        sa.CheckConstraint("expires_at > created_at AND absolute_expires_at >= expires_at", name="expiry_order"),
    )
    op.create_index("ix_admin_browser_sessions_user_id", "admin_browser_sessions", ["user_id"])
    op.create_index(
        "ix_admin_browser_sessions_active",
        "admin_browser_sessions",
        ["user_id", "expires_at"],
        postgresql_where=sa.text("revoked_at IS NULL"),
    )
    op.create_table(
        "admin_oidc_attempts",
        *columns(),
        sa.Column("state_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("binding_digest", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "state_digest ~ '^[0-9a-f]{64}$' AND binding_digest ~ '^[0-9a-f]{64}$'", name="digest_format"
        ),
        sa.CheckConstraint("expires_at > created_at", name="expiry_order"),
    )
    # No changes to existing guards/private-schema grants. Public access is explicitly denied.
    op.execute("REVOKE ALL ON admin_browser_sessions, admin_oidc_attempts FROM PUBLIC")
    for table in ("admin_browser_sessions", "admin_oidc_attempts"):
        op.execute(
            f"CREATE TRIGGER touch_updated_at BEFORE UPDATE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION fluentt_touch_updated_at()"
        )


def downgrade():
    # Prevent accidental loss of session/audit-related evidence on an occupied installation.
    op.execute("""DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM admin_browser_sessions) OR EXISTS (SELECT 1 FROM admin_oidc_attempts) THEN
        RAISE EXCEPTION 'Admin session tables are occupied; preserve records before an explicitly reviewed downgrade';
      END IF;
    END $$""")
    op.drop_table("admin_oidc_attempts")
    op.drop_table("admin_browser_sessions")
