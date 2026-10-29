"""Explicit empty-database execution adapter; frozen migration bytes stay unchanged."""

from contextlib import contextmanager

from sqlalchemy import event, text


REPAIRS = (
    (
        "CONSTRAINT uq_learning_competencies_lesson_id UNIQUE (lesson_id, code)",
        "CONSTRAINT uq_learning_competencies_lesson_code UNIQUE (lesson_id, code)",
    ),
    (
        "CONSTRAINT uq_assignment_questions_assignment_version_id UNIQUE (assignment_version_id, question_revision_id)",
        "CONSTRAINT uq_assignment_questions_version_question UNIQUE (assignment_version_id, question_revision_id)",
    ),
    (
        "CONSTRAINT fk_vocabulary_review_events_review_state_id_vocabulary__c719 "
        "FOREIGN KEY(review_state_id, scheduler_configuration_id)",
        "CONSTRAINT fk_vocabulary_review_events_state_scheduler "
        "FOREIGN KEY(review_state_id, scheduler_configuration_id)",
    ),
)


def repair_statement(statement):
    if not statement.startswith("CREATE TABLE "):
        return statement
    for original, replacement in REPAIRS:
        statement = statement.replace(original, replacement)
    return statement


def require_empty(connection):
    # Permit only an empty Alembic version table left by a disposable downgrade.
    objects = connection.execute(
        text("""
        SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
          AND NOT (n.nspname='public' AND (c.relname='alembic_version' OR c.oid IN (
            SELECT indexrelid FROM pg_index WHERE indrelid=to_regclass('public.alembic_version'))))
    """)
    ).all()
    if objects:
        raise RuntimeError("Bootstrap naming repair requires an empty database; existing objects were found")
    version_table = connection.execute(text("SELECT to_regclass('public.alembic_version')")).scalar_one()
    if version_table and connection.execute(text("SELECT count(*) FROM public.alembic_version")).scalar_one():
        raise RuntimeError("Bootstrap naming repair cannot run against versioned databases")
    custom = connection.execute(
        text("""
        SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT IN
            ('public','pg_catalog','information_schema') AND nspname NOT LIKE 'pg_toast%'
            AND nspname NOT LIKE 'pg_temp%')
        OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public')
        OR EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
            WHERE n.nspname='public' AND t.typname NOT IN ('alembic_version','_alembic_version'))
    """)
    ).scalar_one()
    if custom:
        raise RuntimeError("Bootstrap naming repair requires an empty database without custom schemas/functions")


@contextmanager
def repaired_bootstrap(connection):
    require_empty(connection)

    def replace(conn, cursor, statement, parameters, context, executemany):
        return repair_statement(statement), parameters

    event.listen(connection, "before_cursor_execute", replace, retval=True)
    try:
        yield
    finally:
        event.remove(connection, "before_cursor_execute", replace)
