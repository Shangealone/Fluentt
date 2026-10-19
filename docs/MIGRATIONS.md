# PostgreSQL setup and migrations

## Section 25 — 0012_class_communication

Current head is 0012_class_communication, still 63 tables. Add only nullable Message.communication_contract/context_class_id/send_request_id, a RESTRICT class-context FK, sender/request uniqueness, context/time indexes and class-text-v1 shape checks. Existing recipient-XOR-class destinations, values and timestamps are retained; legacy unclassified messages remain unserved by new APIs. Invoker guards validate owner/student roles and membership, prevent sent content/identity mutation and protect new read records; PUBLIC access to messages/message_reads is revoked. Runtime/operator grants remain a deployment task. Downgrade refuses any retained new context/request/contract; empty-new-contract rollback preserves old records. Frozen 0001–0011 are unchanged. COMMUNICATIONS.md and SECTION_25_REPORT.md record actual PostgreSQL tests, backup/forward-upgrade and limitations.

## Section 22 — 0011_result_release

Current head 0011_result_release adds only assessment_result_releases (63 domain tables), an append-only visibility ledger with exact run/version/attempt identity, actor/request idempotence and consecutive visibility changes. Guards require sealed COMPLETE ordinary-classroom evidence and owner context, preserve the first run ID and reject UPDATE/DELETE. PUBLIC grants are revoked; downgrade refuses any release history. Frozen 0001–0010 and all previous data/guards remain untouched. No capture scores, answer keys, evaluation outcomes or classroom rows are backfilled. RESULTS_AND_FEEDBACK.md and SECTION_22_REPORT.md record application locks and actual migration checks.

## Section 21 internal grading

Head is **0010_grading_results**, with **62 domain tables**. Two additive tables retain immutable internal run/item evaluations because the original submitted captures must not change. Frozen DDL uses explicit composite FK/unique names, separate from the historical initial-name repair. Version/evidence FKs, natural attempt/engine/policy uniqueness, outcome/total checks, transactional sealing and append-only guards preserve exact results. PUBLIC table access is revoked; production runtime/migration grants still require review. No existing learner row or prior guard is rewritten. Downgrade refuses any grading history. Frozen 0001–0009 are unchanged; existing reviewed databases use a normal backed-up forward upgrade. See GRADING.md and SECTION_21_REPORT.md for actual verification and preservation evidence.

## Section 20 response capture

Head is **0009_response_capture**, still 60 tables. Three nullable AssignmentAttempt fields hold the explicit unscored-capture-v1 contract, server reveal/position state and internal submission fingerprint. Existing distribution-only versions/points/limits remain frozen/unset. Attempt guards authorize only ordinal-1 capture without expiry/scores; finalization identity and response/history immutability prevent retakes or later mutation. Legacy configured attempts retain prior rules. New response guards forbid grading/latency on capture records; no old rows are converted or seeded. Downgrade refuses retained capture attempts. Frozen 0001–0008 remain immutable. See ASSIGNMENTS.md and SECTION_20_REPORT.md for actual verification and local forward-upgrade evidence.

## Section 19 assignment distribution

Source head is **0008_assignment_publication**, still 60 tables. Add nullable AssignmentVersion publication_contract/request UUID, permit only explicitly marked distribution-only-v1 freezing with all attempt/points/window policies unset, and strengthen the attempt guard to reject distribution-only versions. Preserve existing configured versions, freeze/nonempty/locked-question guards and historical IDs. New root/version insertion/reparenting guards protect distributed history. No stored rows are rewritten; frozen 0001–0007 are immutable. Downgrade refuses any publication contract rather than erasing history. See ASSIGNMENTS.md and SECTION_19_REPORT.md for policy, tests and local migration evidence. Never reset or downgrade an existing database to run verification.

## Section 18 assignment drafts

Source head is **0007_assignment_drafts**, still 60 domain tables. It adds nullable Assignment creation-request UUID/fingerprint plus owner/key uniqueness, allows unset max_attempts/item points in drafts, and adds an invoker guard forbidding version locking until both are configured. Existing values remain intact; new service drafts explicitly use NULL without inventing policies. Frozen 0001–0006 remain immutable. Downgrade refuses newly unconfigured drafts or retained creation metadata; no data is erased or filled with invented defaults. See ASSIGNMENTS.md and SECTION_18_REPORT.md for tested migration/preservation evidence. Normal reviewed existing-database upgrade remains alembic upgrade head; empty bootstrap still uses the verified adapter.

## Section 11 association guard

Source head is **0006_question_associations**, still 60 domain tables. This additive revision adds an invoker function and three triggers enforcing question revision/competency same-lesson associations, including moves from either side, under advisory 78090001. It preflights existing rows and aborts on mismatches for operator review, without repair/deletion or table/column changes. Frozen 0001–0005 and original SQL remain unchanged. Existing-database upgrade is `alembic upgrade head`; fresh empty bootstrap still requires the explicit adapter below. Application startup never migrates. QUESTION_BANK.md explains ordering and preserved history.

Downgrade removes only the new function/triggers and retains every row; it weakens this association protection and is not needed for normal development. Run round-trip/preflight tests only on generated disposable databases. Never downgrade/reset an existing developer/deployed database automatically. Bootstrap repair/head paragraphs below record earlier milestones.

## Verified bootstrap repair — 2026-10-18

Current head is **0005_constraint_names**. PostgreSQL execution confirmed frozen 0001 fails with SQLSTATE 42P07 because its first duplicate unique constraint creates an already named relation. All frozen revisions 0001–0004 and their original SQL artifacts remain byte-for-byte unchanged.

For a **new empty database only**, from services/api with its URL configured:

```powershell
.venv/Scripts/python -m alembic -x repair_initial_names=true upgrade head
.venv/Scripts/python -m alembic current
.venv/Scripts/python -m alembic check
```

The opt-in adapter in scripts/bootstrap_names.py verifies no existing user relations, custom schemas/functions/types or populated Alembic version table. It changes exactly three conflicting constraint declarations in frozen CREATE TABLE statements during execution: lesson/code uniqueness, assignment-version/question uniqueness and the composite review-state/scheduler FK. It neither rewrites files nor stamps an unbuilt schema. A single transaction creates the foundation and applies subsequent revisions. Do not use this option on an existing developer/deployed database; it fails closed rather than resetting anything. Run bootstrap exclusively, without concurrent schema writers.

For an **existing database**, inspect its applied revision, constraints, data and backup first. Ordinary reviewed `alembic upgrade head` applies 0005, which identifies each affected constraint by ordered columns/type and renames it only if needed. Missing/ambiguous constraints abort the transaction for operator review. Existing constraints, indexes, rows and identities remain intact. No old deployment was inspected or upgraded here. Downgrade of 0005 retains valid names because recreating duplicate names is invalid; it changes no integrity rule.

Offline SQL without the flag deliberately reproduces frozen history, including its invalid initial names; it is a historical review artifact, **not executable fresh bootstrap SQL**. The repair flag requires online emptiness verification. Do not apply initial_schema.sql directly. Disposable integration fixtures opt into the same verified empty-database adapter.

Local verification now uses portable PostgreSQL on localhost:55432, with ignored data/runtime under private-data/verification and an ignored API .env URL. `scripts/local-postgres.ps1 start|stop|status` controls only this cluster. No Windows service or existing database was replaced. See LOCAL_VERIFICATION_REPORT.md for test evidence. Earlier unavailable/head notes below are historical.

Latest Section 09 source head is `0004_curriculum_snapshots`; the Section 08 head note below is historical. Table count remains 60. Revision 0004 adds only curriculum hierarchy/reference/history functions and triggers, with shared/exclusive transaction advisory boundary 78090001. It freezes published/retired version metadata, descendants and shared labels, and preserves already referenced assignment/progress hierarchy. Lifecycle updates preserve existing evidence; no backfill, seed, table/column replacement or stored-data rewrite occurs. Downgrade refuses protected versions. CURRICULUM.md explains writer ordering, privileges and limitations.

Apply/verify 0004 before using curriculum reads. Existing research guards/private grants and frozen 0001–0003 are unchanged. New guard functions run with invoker privileges; production runtime function/table grants and trigger restrictions require review with separate migration/operator credentials. No PostgreSQL migration or new permission command was executed here. The frozen-0001 bootstrap blocker below remains unresolved; a later additive revision cannot repair a failure before it runs.

Current source head is `0003_admin_sessions` (60 domain tables). Section 08 adds admin_browser_sessions and admin_oidc_attempts only; frozen 0001_initial and 0002_class_creation are unchanged. No live migration was applied here. New tables explicitly revoke PUBLIC access and reuse fluentt_touch_updated_at triggers; existing research guards/functions/private grants remain unchanged. Review runtime SELECT/INSERT/UPDATE and operator provisioning grants separately from schema-owner credentials (ADMIN_AUTH.md).

0003 downgrade deliberately aborts when either new table contains rows. It never erases existing sessions/attempts automatically. Normal development uses reviewed forward upgrades, not downgrades against occupied databases. Offline compilation and UUID-database integration tests are provided; source compilation does not establish live locking, grants or migration correctness.

**Existing bootstrap blocker found during Section 08 static review:** frozen 0001_initial declares `uq_learning_competencies_lesson_id` twice (lesson/position and lesson/code), `uq_assignment_questions_assignment_version_id` twice (version/position and version/question), and `fk_vocabulary_review_events_review_state_id_vocabulary__c719` twice (single and composite references). These names also collide in current model metadata. PostgreSQL requires constraint names to be unique per table; this is expected to prevent fresh bootstrap, although no PostgreSQL execution was available to reproduce it. See [PostgreSQL constraint naming](https://www.postgresql.org/docs/17/sql-createtable.html). An additive 0003 cannot repair a failure that occurs before it runs. Frozen 0001/0002 were deliberately not edited; choose and approve a repair/bootstrap strategy after inspecting any existing database/migration history, then validate on a disposable database. Do not run a destructive reset or silently rewrite migration history.

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
# New empty database only; existing databases follow the reviewed normal workflow below.
.venv/Scripts/python -m alembic -x repair_initial_names=true upgrade head
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

## Section 06 schema reuse

Student enrollment reuses class_memberships, class_join_codes, classes and audit_logs. No migration or table change is introduced; head remains 0002_class_creation. The existing per-class/student active-membership unique index and foreign keys remain authoritative. The service holds session/student, owner, class and code locks while revalidating and committing enrollment; no developer database was upgraded/downgraded/reset during Section 06. The new conditional PostgreSQL tests reuse only the generated disposable database fixture. See ENROLLMENT.md and SECTION_06_REPORT.md.

## 2026-10-19 personal focus addition

Current source/local head: 0013_learning_focus (63 tables). Add one nullable JSONB learner_profiles.learning_focus column to store the personal learner’s explicit lesson/topic requests. Preserve frozen 0001–0012 and every legacy grade value. No backfill, data rewrite, new table, grade conversion, scheduling/progress writer or curriculum-content mutation is added. The new API must be deployed with this migration; a database still at 0012 cannot serve the new profile query until upgraded normally.

Verified fresh/disposable PostgreSQL upgrade and identity roundtrips. Inspected the configured local database at 0012_class_communication, then applied only 0013_learning_focus successfully. No reset, stamp, or unknown database downgrade was performed.
