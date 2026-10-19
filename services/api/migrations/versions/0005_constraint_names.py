"""Converge three constraint names without replacing constraints or touching data.

Empty databases use the explicit naming adapter for frozen 0001 first. Existing
databases require review/backups; identify each constraint by columns, never guess
which historical name an operator may have used to bootstrap their database.
"""

from alembic import op

revision = "0005_constraint_names"
down_revision = "0004_curriculum_snapshots"
branch_labels = None
depends_on = None

CONSTRAINTS = (
    ("learning_competencies", "u", ["lesson_id", "code"], "uq_learning_competencies_lesson_code"),
    (
        "assignment_questions",
        "u",
        ["assignment_version_id", "question_revision_id"],
        "uq_assignment_questions_version_question",
    ),
    (
        "vocabulary_review_events",
        "f",
        ["review_state_id", "scheduler_configuration_id"],
        "fk_vocabulary_review_events_state_scheduler",
    ),
)


def upgrade():
    for table, kind, columns, desired in CONSTRAINTS:
        column_sql = ",".join("'" + column + "'" for column in columns)
        # All interpolated identifiers are fixed revision constants, never user input.
        op.execute(f"""DO $$ DECLARE previous_name name; matches integer; BEGIN
          SELECT count(*), min(c.conname::text) INTO matches, previous_name
          FROM pg_constraint c
          WHERE c.conrelid='public.{table}'::regclass AND c.contype='{kind}'
            AND ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.ord)
              = ARRAY[{column_sql}]::text[];
          IF matches <> 1 THEN
            RAISE EXCEPTION 'Expected one matching constraint on {table}; review existing schema';
          END IF;
          IF previous_name <> '{desired}' THEN
            EXECUTE format('ALTER TABLE public.{table} RENAME CONSTRAINT %I TO %I', previous_name, '{desired}');
          END IF;
        END $$""")


def downgrade():
    # Names intentionally remain valid. Reintroducing colliding names is impossible
    # on PostgreSQL; no integrity rule or data was changed by this revision.
    pass
