"""Frozen D5 PostgreSQL guard statements shared with schema creation and migration."""

IMMUTABLE_CONTENT_DDL = (
    """CREATE OR REPLACE FUNCTION fluentt_content_immutable() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'Immutable content evidence cannot be updated or deleted'
        USING ERRCODE = '55000';
    END; $$""",
    "DROP TRIGGER IF EXISTS immutable_vocabulary_revision ON vocabulary_revisions",
    """CREATE TRIGGER immutable_vocabulary_revision BEFORE UPDATE OR DELETE
       ON vocabulary_revisions FOR EACH ROW EXECUTE FUNCTION fluentt_content_immutable()""",
    "DROP TRIGGER IF EXISTS immutable_content_release ON content_releases",
    """CREATE TRIGGER immutable_content_release BEFORE UPDATE OR DELETE
       ON content_releases FOR EACH ROW EXECUTE FUNCTION fluentt_content_immutable()""",
)
