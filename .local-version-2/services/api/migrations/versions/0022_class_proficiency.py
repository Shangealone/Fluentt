"""Optional external-assessment label; preserve legacy class grades and curriculum."""
from alembic import op
import sqlalchemy as sa

revision = "0022_class_proficiency"
down_revision = "0021_esr_vocabulary_review"
branch_labels = None
depends_on = None

OLD_SHARE_CONTEXT = "AND archived_at IS NULL AND grade_level_id=v.grade_level_id AND language=v.language AND subject_id=v.subject_id"
NEW_SHARE_CONTEXT = "AND archived_at IS NULL AND language=v.language AND subject_id=v.subject_id"


def replace_teacher_share_context(old, new):
    # Retain the deployed guard, including 0020 dispatch and all publication/ownership guards.
    definition = op.get_bind().exec_driver_sql(
        "SELECT pg_get_functiondef('public.fluentt_guard_teacher_content()'::regprocedure)"
    ).scalar_one()
    if definition.count(old) != 1:
        raise RuntimeError("The teacher sharing guard differs from its expected definition; review before changing it.")
    op.execute(definition.replace(old, new, 1))


def upgrade():
    replace_teacher_share_context(OLD_SHARE_CONTEXT, NEW_SHARE_CONTEXT)
    op.alter_column("classes", "grade_level_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("classes", sa.Column("proficiency_level", sa.String(20), nullable=True))
    op.create_check_constraint(op.f("ck_classes_proficiency_level"), "classes",
                               "proficiency_level IN ('beginner', 'intermediate', 'advanced')")


def downgrade():
    # Refuse lossy rollback when classes have no legacy grade; never invent a grade.
    op.alter_column("classes", "grade_level_id", existing_type=sa.UUID(), nullable=False)
    replace_teacher_share_context(NEW_SHARE_CONTEXT, OLD_SHARE_CONTEXT)
    op.drop_constraint(op.f("ck_classes_proficiency_level"), "classes", type_="check")
    op.drop_column("classes", "proficiency_level")
