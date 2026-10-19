"""Frozen D11B PostgreSQL guards, used by migration and create_all."""

from sqlalchemy import text

from app.research_authority.config_v1 import CONFIGURATIONS
from app.research_authority.schema_v1 import TABLE_NAMES

DDL = (
    """CREATE OR REPLACE FUNCTION fluentt_d11_frozen_immutable() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'Frozen D11 authority is immutable' USING ERRCODE='55000';
    END; $$""",
    """CREATE OR REPLACE FUNCTION fluentt_d11_member_valid() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM content_releases r,
        LATERAL json_array_elements(r.manifest->'lessons') l,
        LATERAL json_array_elements(l->'vocabulary_items') i,
        vocabulary_revisions v
        WHERE r.id=NEW.content_release_id
          AND i->>'id'=NEW.vocabulary_item_id::text
          AND i->>'content_revision_id'=NEW.content_revision_id::text
          AND v.id=NEW.content_revision_id AND v.vocabulary_item_id=NEW.vocabulary_item_id
          AND v.lesson_id::text=l->>'id' AND v.is_active
          AND (l->>'is_active')::boolean AND (r.manifest->'language'->>'is_active')::boolean
      ) THEN RAISE EXCEPTION 'D11 exact release membership mismatch' USING ERRCODE='23514'; END IF;
      RETURN NEW;
    END; $$""",
    """CREATE OR REPLACE FUNCTION fluentt_d11_order_valid() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF json_typeof(NEW.period_order) IS DISTINCT FROM 'array'
        OR json_array_length(NEW.period_order) <> 2 THEN
        RAISE EXCEPTION 'D11 period order requires both sets' USING ERRCODE='23514';
      END IF;
      IF (SELECT count(DISTINCT s.id) FROM research_sets s
          JOIN json_array_elements_text(NEW.period_order) p ON p=s.id::text
          WHERE s.protocol_id=NEW.protocol_id AND s.protocol_version=NEW.protocol_version) <> 2 THEN
        RAISE EXCEPTION 'D11 period order requires exact protocol sets' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END; $$""",
    """CREATE OR REPLACE FUNCTION fluentt_d11_condition_valid() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE expected_config text; BEGIN
      SELECT CASE WHEN (a.mapping_group=1 AND s.label='A') OR (a.mapping_group=2 AND s.label='B')
             THEN p.enhanced_config_version ELSE p.conventional_config_version END
      INTO expected_config FROM participant_allocations a
      JOIN research_protocols p ON p.id=a.protocol_id AND p.version=a.protocol_version
      JOIN research_sets s ON s.protocol_id=p.id AND s.protocol_version=p.version
      WHERE a.id=NEW.allocation_id AND a.user_id=NEW.user_id AND s.id=NEW.research_set_id;
      IF NEW.config_version IS DISTINCT FROM expected_config THEN
        RAISE EXCEPTION 'D11 mapping/config mismatch' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END; $$""",
    """CREATE OR REPLACE FUNCTION fluentt_d11_attempt_valid() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.research_assignment_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM participant_set_conditions c JOIN research_set_memberships m
          ON m.protocol_id=c.protocol_id AND m.protocol_version=c.protocol_version
          AND m.research_set_id=c.research_set_id
        WHERE c.id=NEW.research_assignment_id AND c.user_id=NEW.user_id
          AND m.vocabulary_item_id=NEW.vocabulary_item_id
          AND m.content_revision_id=NEW.content_revision_id AND m.content_release_id=NEW.content_release_id
      ) THEN RAISE EXCEPTION 'D11 attempt assignment/content mismatch' USING ERRCODE='23514'; END IF;
      RETURN NEW;
    END; $$""",
    *(
        statement
        for table in TABLE_NAMES
        for statement in (
            f"DROP TRIGGER IF EXISTS d11_immutable_row ON {table}",
            f"CREATE TRIGGER d11_immutable_row BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION fluentt_d11_frozen_immutable()",
            f"DROP TRIGGER IF EXISTS d11_no_truncate ON {table}",
            f"CREATE TRIGGER d11_no_truncate BEFORE TRUNCATE ON {table} FOR EACH STATEMENT EXECUTE FUNCTION fluentt_d11_frozen_immutable()",
        )
    ),
    *(
        statement
        for table, function in (
            ("research_set_memberships", "member"),
            ("participant_allocations", "order"),
            ("participant_set_conditions", "condition"),
            ("review_attempts", "attempt"),
        )
        for statement in (
            f"DROP TRIGGER IF EXISTS d11_validate_insert ON {table}",
            f"CREATE TRIGGER d11_validate_insert BEFORE INSERT ON {table} FOR EACH ROW EXECUTE FUNCTION fluentt_d11_{function}_valid()",
        )
    ),
)


def install(connection):
    for record in CONFIGURATIONS:
        connection.execute(
            text("""INSERT INTO scheduler_configurations
            (config_version,scheduler_type,algorithm_version,state_schema_version,canonical_document,config_sha256)
            VALUES (:config_version,:scheduler_type,:algorithm_version,:state_schema_version,:canonical_document,:config_sha256)
            ON CONFLICT (config_version) DO NOTHING"""),
            record,
        )
    for statement in DDL:
        connection.execute(text(statement))
