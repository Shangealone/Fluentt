# PostgreSQL setup and migrations

Section 02 provides 58 SQLAlchemy domain tables, a frozen initial Alembic revision and PostgreSQL integration tests. No live PostgreSQL migration has been applied in this workspace: PostgreSQL tools/Docker were absent, port 5432 was closed and no database URL was configured. Offline SQL generation is not proof of live migration behavior.

## Local PostgreSQL using Docker Desktop

Install/start Docker Desktop separately if you choose this option. The supplied infra/compose.yaml uses the official PostgreSQL 17 major tag, a named persistent volume, password configuration and a host port bound to 127.0.0.1. It does not start infrastructure automatically. This configuration has not been executed here. The development database owner is intentionally suitable for local migrations/testing; production must use separate restricted runtime credentials.

From the repository root in PowerShell:

```powershell
$databaseSecret = Read-Host 'Choose your local PostgreSQL password' -AsSecureString
$databasePassword = [Net.NetworkCredential]::new('', $databaseSecret).Password
$env:FLUENTT_POSTGRES_PASSWORD = $databasePassword
$encodedDatabasePassword = [Uri]::EscapeDataString($databasePassword)
docker compose -f infra/compose.yaml up -d postgres
docker compose -f infra/compose.yaml exec postgres pg_isready -U fluentt_dev -d fluentt
$env:FLUENTT_DATABASE_URL = "postgresql+psycopg://fluentt_dev:${encodedDatabasePassword}@localhost:5432/fluentt"
Set-Location services/api
.venv/Scripts/python -m pip install -r requirements.lock.txt
.venv/Scripts/python scripts/check_database.py
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m alembic current
```

The URL environment variable applies to the current shell and processes launched from it. To persist local configuration for another terminal, put your URL in the ignored services/api/.env file without committing it. URL-encode reserved password characters. Never put database credentials into either frontend's public environment variables. Close the terminal or remove secret variables when finished. Changing POSTGRES_PASSWORD after initial volume creation does not change an existing database password; manage that database's credentials deliberately. Do not remove the volume to resolve configuration mistakes.

If port 5432 already hosts another database, choose an unused host port in the Compose configuration and corresponding URL. Do not reset or replace an existing service.

## Native Windows alternative

With a PostgreSQL 17 server and psql already installed, connect to the postgres maintenance database using your existing administrator credentials. For a fresh local project only:

```sql
CREATE ROLE fluentt_dev LOGIN CREATEDB;
\password fluentt_dev
CREATE DATABASE fluentt OWNER fluentt_dev;
```

The psql password prompt avoids placing an actual password in a SQL file. CREATEDB is for disposable development testing, not production runtime. If these names already exist, inspect ownership and contents rather than recreating them. Then configure FLUENTT_DATABASE_URL and run the same backend commands above. No native installer or service changes were performed by this section.

## Normal migration workflow

From services/api with FLUENTT_DATABASE_URL set:

```powershell
.venv/Scripts/python -m alembic current
.venv/Scripts/python -m alembic history
.venv/Scripts/python -m alembic heads
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m alembic check
```

For a subsequent schema change, edit/import SQLAlchemy models, then generate and review a new revision against a database already at the current head:

```powershell
.venv/Scripts/python -m alembic revision --autogenerate -m 'Describe the schema change'
```

Never edit the applied 0001_initial revision. Review generated DDL, backfill needs, nullable/default changes, constraint naming and lock duration before applying new revisions. PostgreSQL guard functions/triggers and private-schema grants are explicit migration operations; Alembic will not maintain them automatically. Autogeneration filters unrelated schemas/tables to avoid proposing deletion of non-FLUENTT objects. Do not use create_all() for schema deployment. Migration URLs come from environment settings, not alembic.ini. The FastAPI lifespan never runs migrations or connects simply to prove health.

## Offline review

These commands compile SQL without connecting to a database:

```powershell
.venv/Scripts/python -m alembic upgrade head --sql
.venv/Scripts/python -m alembic downgrade 0001_initial:base --sql
```

migrations/initial_schema.sql and initial_downgrade.sql are generated review artifacts. The Python revision is the migration authority; do not apply both artifacts and Alembic. SQLAlchemy metadata is the model source of truth, and static tests check the current initial snapshot matches it. Future revisions must evolve those checks without rewriting applied history.

## Disposable PostgreSQL integration tests

The suite never migrates the database named in FLUENTT_TEST_DATABASE_URL. That URL is a maintenance connection with CREATEDB privileges. Tests create their own random fluentt_test_<uuid> database, upgrade it, use rollback-isolated synthetic fixtures, test constraints/JSONB/locks, downgrade and re-upgrade, then drop only that generated test database. Do not configure a remote production server for testing. No database names from arbitrary user input are interpolated into destructive statements.

With the local Docker service running, set the test URL in the same PowerShell session where the encoded password above exists:

```powershell
$env:FLUENTT_TEST_DATABASE_URL = "postgresql+psycopg://fluentt_dev:${encodedDatabasePassword}@localhost:5432/postgres"
.venv/Scripts/python -m pytest -m postgresql -rs
.venv/Scripts/python -m pytest -q
```

The test-only URL belongs in the shell, not the application .env settings file. If unset, PostgreSQL tests skip with a reason. If configured but setup fails, tests fail rather than claiming PostgreSQL passed. A failed cleanup may leave only the generated UUID test database; inspect it manually before removal. Downgrade removes the entire FLUENTT schema and must never target a developer database without explicit approval. No manual destructive downgrade command is needed for normal development.

Other checks and documentation:

```powershell
.venv/Scripts/python -m ruff check app migrations scripts tests
.venv/Scripts/python -m ruff format --check app migrations scripts tests
.venv/Scripts/python -m compileall -q app migrations scripts tests
.venv/Scripts/python scripts/document_schema.py
```

## Backend session integration

The existing engine is synchronous psycopg with pre-ping, hidden bound parameters, UTC connection timezone, connection timeout and bounded pool (5 base + 5 overflow by default). Settings validate pool limits and redact input in configuration errors. Use get_session from app.db.session as a FastAPI dependency in future synchronous database routes. Services own explicit `with session.begin()` transaction scopes or deliberate commits; the dependency never auto-commits and rolls back/closes on failure. A missing database or operational connectivity failure produces a redacted 503 through the existing error boundary. Do not run synchronous database work directly inside an asynchronous route's event loop.

GET /api/v1/health still reports application liveness only. The explicit check_database.py diagnostic distinguishes absent configuration (exit 2), connectivity failure (exit 1) and successful SELECT 1 (exit 0); it does not assert migration readiness. No database-readiness HTTP endpoint or identity/session issuance endpoint was added.

## Privacy and schema concerns before real use

- research_private revokes PUBLIC access; owners and superusers remain privileged. Use a separate migration owner and restricted ordinary/research runtime roles, explicit grants, HTTPS, encrypted storage/backups and approved retention. No deployment roles are created or promised by the migration.
- Research learning contexts contain no ordinary user ID; only private identity links resolve coded participants. Coded exports still need an explicit allowlist and authorization. Avoid identity values in JSONB and audit metadata.
- No raw speech is stored. Conversation retention is off by default; approving retention requires policy/version/deadline and a future deletion job. Private consent evidence is a reference, not copied identifying documents.
- Most deletes are restricted. Append-only historical/consent/audit data cannot be erased through ordinary updates; approved erasure/withdrawal procedures must be designed before real participant use.
- Full method configuration/response validation runs for ordinary ORM writes, while direct SQL/bulk writes enforce only relational/CHECK/JSON-object constraints. Future repositories must use the validated contracts and avoid bypassing ORM hooks.
- Publication, class ownership/role authorization, consent eligibility, study allocation caps and schedule calculations are future services. Database triggers protect frozen artifacts but do not grant permissions or execute the experiment.
- Live upgrade, downgrade, metadata drift, transaction/constraint and JSONB behavior remain unverified until the PostgreSQL suite is run. Do not deploy based only on offline compilation.

References: [SQLAlchemy sessions](https://docs.sqlalchemy.org/en/20/orm/session_basics.html), [Alembic offline mode](https://alembic.sqlalchemy.org/en/latest/offline.html), [official PostgreSQL Docker image](https://hub.docker.com/_/postgres), [PostgreSQL CREATE DATABASE](https://www.postgresql.org/docs/17/sql-createdatabase.html), [PostgreSQL grants](https://www.postgresql.org/docs/17/sql-grant.html).

JSONB updates in future services should assign new validated dictionaries/snapshots rather than assume nested in-place mutations are tracked by SQLAlchemy. Review state advancement, event creation and points updates require a single explicit transaction; none of that business logic is implemented by these storage models.

## Section 03 migration compatibility

Section 03 reuses users and user_sessions and adds no schema revision. 0001_initial remains the head; upgrade it once before live identity operations. The stricter 3–24 public username rule does not shrink the stored column or reject older 25–32 character profiles. Normalization and database uniqueness are unchanged. New session lifetime/throttling settings are in .env.example; no actual credentials were written. See IDENTITY_AND_SESSIONS.md for API behavior and SECTION_03_REPORT.md for skipped PostgreSQL identity tests.

Section 04 uses the existing learner preference columns and grade_levels reference table. No new schema revision is required. Saving a grade uses a transactional PostgreSQL insert-on-conflict by number, preserving existing IDs and labels. This does not populate curriculum. The live preference persistence test is conditional on the same disposable test database setup described above.

## Section 05 migration

The current head is **0002_class_creation**. Apply `alembic upgrade head` using the configured PostgreSQL virtual environment before using class APIs; application startup never migrates. 0001_initial and its frozen SQL review artifacts remain unchanged. The new revision:

- Allows null curriculum subject on classes, preserving the subject FK and all existing values.
- Adds nullable creation_request_id UUID for existing rows, with unique (instructor_id, creation_request_id) for idempotent new creation.
- Adds uq_class_join_codes_code across all historical values; existing active-code indexes remain.

Upgrade first checks for duplicate historical codes. If duplicates exist, the transaction aborts without deleting or relabeling records; an operator must review a data-preserving policy/migration before retry. Do not automatically remove historic code records to free values. Downgrade refuses while any class has no subject, because restoring NOT NULL would invalidate it. No downgrade is needed for normal development, and no developer database was downgraded here. The generated DATABASE_SCHEMA reflects head metadata; initial_schema.sql remains the original revision only.

Real PostgreSQL checks now include code collision/savepoint recovery, non-reuse of inactive codes, rollback, own-class management and concurrent idempotent creation. These tests are conditional on the same generated disposable database fixture; skipped tests are not evidence that migration or persistence works on a live server.
