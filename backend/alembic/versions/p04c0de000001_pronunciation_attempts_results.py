"""Add pronunciation attempts and write-once terminal results."""

import sqlalchemy as sa

from alembic import op

revision = "p04c0de000001"
down_revision = "d11b00000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pronunciation_attempts",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey(
                "users.id", ondelete="RESTRICT", name="fk_pronunciation_attempt_user"
            ),
            nullable=False,
        ),
        sa.Column(
            "client_pronunciation_attempt_id", sa.Uuid(as_uuid=True), nullable=False
        ),
        sa.Column(
            "content_release_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey(
                "content_releases.id",
                ondelete="RESTRICT",
                name="fk_pronunciation_attempt_release",
            ),
            nullable=False,
        ),
        sa.Column(
            "vocabulary_item_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey(
                "vocabulary_items.id",
                ondelete="RESTRICT",
                name="fk_pronunciation_attempt_item",
            ),
            nullable=False,
        ),
        sa.Column(
            "content_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey(
                "vocabulary_revisions.id",
                ondelete="RESTRICT",
                name="fk_pronunciation_attempt_revision",
            ),
            nullable=False,
        ),
        sa.Column("target_kind", sa.String(16), nullable=False),
        sa.Column(
            "original_interaction_at", sa.DateTime(timezone=True), nullable=False
        ),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("processing_token", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("processing_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "provider_dispatch_started_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column("capture_profile_version", sa.String(64), nullable=False),
        sa.Column("device_platform", sa.String(32), nullable=False),
        sa.Column("application_version", sa.String(32), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "client_pronunciation_attempt_id",
            name="uq_pronunciation_owner_client_attempt",
        ),
        sa.CheckConstraint(
            "target_kind IN ('term', 'sentence')", name="ck_pronunciation_target_kind"
        ),
        sa.CheckConstraint(
            "status IN ('processing', 'scored', 'unscorable', 'failed')",
            name="ck_pronunciation_attempt_status",
        ),
        sa.CheckConstraint(
            "(status = 'processing') = (completed_at IS NULL)",
            name="ck_pronunciation_attempt_completed",
        ),
    )
    op.create_index(
        "uq_pronunciation_one_processing_per_owner",
        "pronunciation_attempts",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'processing'"),
    )

    op.create_table(
        "pronunciation_results",
        sa.Column(
            "pronunciation_attempt_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey(
                "pronunciation_attempts.id",
                ondelete="RESTRICT",
                name="fk_pronunciation_result_attempt",
            ),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey(
                "users.id", ondelete="RESTRICT", name="fk_pronunciation_result_user"
            ),
            nullable=False,
        ),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("provider", sa.String(64), nullable=False),
        sa.Column("locale", sa.String(16), nullable=False),
        sa.Column("assessment_config_version", sa.String(64), nullable=False),
        sa.Column("integration", sa.String(64), nullable=False),
        sa.Column("api_contract", sa.String(128), nullable=False),
        sa.Column("adapter_version", sa.String(64), nullable=False),
        sa.Column("http_client_version", sa.String(32), nullable=True),
        sa.Column("sdk_version", sa.String(32), nullable=True),
        sa.Column("hosted_model_version", sa.String(64), nullable=True),
        sa.Column("recognition_status", sa.String(64), nullable=True),
        sa.Column("capture_profile_version", sa.String(64), nullable=False),
        sa.Column("converter_profile_version", sa.String(64), nullable=False),
        sa.Column("converter_version", sa.String(128), nullable=True),
        sa.Column("accuracy_score", sa.Numeric(), nullable=True),
        sa.Column("accuracy_score_display", sa.String(16), nullable=True),
        sa.Column("category", sa.String(1), nullable=True),
        sa.Column("category_policy_version", sa.String(64), nullable=True),
        sa.Column("pronunciation_score", sa.Numeric(), nullable=True),
        sa.Column("completeness_score", sa.Numeric(), nullable=True),
        sa.Column("fluency_score", sa.Numeric(), nullable=True),
        sa.Column("word_observations", sa.JSON(), nullable=False),
        sa.Column("issues", sa.JSON(), nullable=False),
        sa.Column("general_feedback_key", sa.String(128), nullable=True),
        sa.Column("selected_issue_refs", sa.JSON(), nullable=False),
        sa.Column("feedback_policy_version", sa.String(64), nullable=True),
        sa.Column("reason_category", sa.String(32), nullable=True),
        sa.Column("reason_code", sa.String(64), nullable=True),
        sa.Column("reason_recovery", sa.String(32), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_pronunciation_results_user_id", "user_id"),
        sa.CheckConstraint(
            "status IN ('scored', 'unscorable', 'failed')",
            name="ck_pronunciation_result_status",
        ),
        sa.CheckConstraint(
            "category IN ('A', 'B', 'C', 'D')", name="ck_pronunciation_result_category"
        ),
        sa.CheckConstraint(
            "(status = 'scored') = (accuracy_score IS NOT NULL)",
            name="ck_pronunciation_result_scored_primary",
        ),
        sa.CheckConstraint(
            "accuracy_score IS NULL OR (accuracy_score >= 0 AND accuracy_score <= 100)",
            name="ck_pronunciation_result_primary_range",
        ),
        sa.CheckConstraint(
            "(status = 'scored') = (category IS NOT NULL)",
            name="ck_pronunciation_result_scored_category",
        ),
        sa.CheckConstraint(
            "status != 'scored' OR general_feedback_key IS NOT NULL",
            name="ck_pronunciation_result_scored_feedback",
        ),
        sa.CheckConstraint(
            "reason_category IS NULL OR reason_category IN "
            "('USER_CORRECTABLE', 'RETRYABLE_SERVICE', 'SERVER_CONFIGURATION')",
            name="ck_pronunciation_result_reason_category",
        ),
    )


def downgrade() -> None:
    op.drop_table("pronunciation_results")
    op.drop_table("pronunciation_attempts")
