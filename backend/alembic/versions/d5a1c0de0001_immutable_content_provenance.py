"""Immutable content provenance; legacy attempts intentionally retain null references.

Revision ID: d5a1c0de0001
Revises: 65b5e4087f54
"""

from alembic import op
import sqlalchemy as sa

from app.content.provenance_ddl import IMMUTABLE_CONTENT_DDL

revision = "d5a1c0de0001"
down_revision = "65b5e4087f54"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vocabulary_revisions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "vocabulary_item_id",
            sa.Uuid(),
            sa.ForeignKey("vocabulary_items.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "lesson_id",
            sa.Uuid(),
            sa.ForeignKey("lessons.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("term", sa.String(255), nullable=False),
        sa.Column("definition", sa.Text(), nullable=False),
        sa.Column("example_sentence", sa.Text(), nullable=False),
        sa.Column("difficulty", sa.String(32), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("translation", sa.String(255), nullable=True),
        sa.Column("content_version", sa.String(64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("semantic_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("id", "vocabulary_item_id", name="uq_revision_item"),
    )
    for column in ["vocabulary_item_id", "lesson_id"]:
        op.create_index(
            f"ix_vocabulary_revisions_{column}", "vocabulary_revisions", [column]
        )
    op.create_table(
        "content_releases",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "language_code",
            sa.String(10),
            sa.ForeignKey("languages.code", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("content_version", sa.String(64), nullable=False),
        sa.Column("manifest", sa.JSON(), nullable=False),
        sa.Column("semantic_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in ["language_code", "content_version"]:
        op.create_index(f"ix_content_releases_{column}", "content_releases", [column])
    op.add_column(
        "languages", sa.Column("current_content_release_id", sa.Uuid(), nullable=True)
    )
    op.create_foreign_key(
        "fk_language_current_release",
        "languages",
        "content_releases",
        ["current_content_release_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.add_column(
        "review_attempts", sa.Column("content_revision_id", sa.Uuid(), nullable=True)
    )
    op.add_column(
        "review_attempts", sa.Column("content_release_id", sa.Uuid(), nullable=True)
    )
    op.create_foreign_key(
        "fk_attempt_content_revision",
        "review_attempts",
        "vocabulary_revisions",
        ["content_revision_id", "vocabulary_item_id"],
        ["id", "vocabulary_item_id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_attempt_content_release",
        "review_attempts",
        "content_releases",
        ["content_release_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_check_constraint(
        "ck_attempt_provenance_pair",
        "review_attempts",
        "(content_revision_id IS NULL) = (content_release_id IS NULL)",
    )
    for column in ["content_revision_id", "content_release_id"]:
        op.create_index(f"ix_review_attempts_{column}", "review_attempts", [column])
    for constraint in sa.inspect(op.get_bind()).get_foreign_keys("review_attempts"):
        if constraint["constrained_columns"] == ["vocabulary_item_id"]:
            op.drop_constraint(
                constraint["name"], "review_attempts", type_="foreignkey"
            )
    op.create_foreign_key(
        "fk_attempt_vocabulary_retained",
        "review_attempts",
        "vocabulary_items",
        ["vocabulary_item_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    for statement in IMMUTABLE_CONTENT_DDL:
        op.execute(statement)


def downgrade() -> None:
    # A schema downgrade is not authorization to erase research evidence.
    evidence = op.get_bind().scalar(
        sa.text("""SELECT EXISTS (SELECT 1 FROM vocabulary_revisions)
        OR EXISTS (SELECT 1 FROM content_releases)
        OR EXISTS (SELECT 1 FROM review_attempts WHERE content_revision_id IS NOT NULL)""")
    )
    if evidence:
        raise RuntimeError(
            "D5 downgrade refused: immutable provenance exists; preserve/export evidence first."
        )
    op.drop_constraint(
        "fk_attempt_vocabulary_retained", "review_attempts", type_="foreignkey"
    )
    op.create_foreign_key(
        "review_attempts_vocabulary_item_id_fkey",
        "review_attempts",
        "vocabulary_items",
        ["vocabulary_item_id"],
        ["id"],
        ondelete="CASCADE",
    )
    for name in ["fk_attempt_content_revision", "fk_attempt_content_release"]:
        op.drop_constraint(name, "review_attempts", type_="foreignkey")
    op.drop_constraint("ck_attempt_provenance_pair", "review_attempts", type_="check")
    for column in ["content_revision_id", "content_release_id"]:
        op.drop_index(f"ix_review_attempts_{column}", table_name="review_attempts")
        op.drop_column("review_attempts", column)
    op.drop_constraint("fk_language_current_release", "languages", type_="foreignkey")
    op.drop_column("languages", "current_content_release_id")
    op.drop_table("content_releases")
    op.drop_table("vocabulary_revisions")
    op.execute("DROP FUNCTION fluentt_content_immutable()")
