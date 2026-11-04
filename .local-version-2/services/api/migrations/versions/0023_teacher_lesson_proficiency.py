"""Separate instructor lesson proficiency from optional legacy curriculum grades."""
from alembic import op
import sqlalchemy as sa

revision = "0023_teacher_lesson_proficiency"
down_revision = "0022_class_proficiency"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("teacher_lesson_versions", "grade_level_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("teacher_lesson_versions", sa.Column("proficiency_level", sa.String(20), nullable=True))
    op.create_check_constraint(op.f("ck_teacher_lesson_versions_proficiency_level"), "teacher_lesson_versions",
                               "proficiency_level IN ('beginner', 'intermediate', 'advanced')")


def downgrade():
    # Refuse loss of authored levels or inventing a grade for grade-free lessons.
    bind = op.get_bind()
    if bind.exec_driver_sql("SELECT EXISTS (SELECT 1 FROM teacher_lesson_versions WHERE grade_level_id IS NULL OR proficiency_level IS NOT NULL)").scalar_one():
        raise RuntimeError("Lesson proficiency or grade-free history exists; reviewed downgrade required.")
    op.drop_constraint(op.f("ck_teacher_lesson_versions_proficiency_level"), "teacher_lesson_versions", type_="check")
    op.drop_column("teacher_lesson_versions", "proficiency_level")
    op.alter_column("teacher_lesson_versions", "grade_level_id", existing_type=sa.UUID(), nullable=False)
