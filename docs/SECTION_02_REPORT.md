# Section 02 completion report

Date: 2026-10-17 (Asia/Manila).

## Inspection and implemented scope

The workspace already contained Section 00 architecture documentation and the working Section 01 Expo, Next.js and FastAPI foundation. All relevant instructions/plans and backend configuration, source, tests and dependency manifests were reviewed. Root Git had no commits; previous-section files remain untracked, so the file lists below compare against the Section 01 inventory rather than claiming Git diff history. No existing database tables or migrations were found or replaced. No frontend files were modified.

Implemented: 58 SQLAlchemy 2.x domain tables with UUID keys, foreign keys, timezone-aware timestamps, named constraints/indexes, PostgreSQL JSONB and synchronous psycopg configuration; an initial frozen Alembic revision plus offline review SQL; explicit session injection/rollback/closing; model registry; structural Pydantic storage validation for exactly ten question methods and student response shapes; private research identity/consent schema; immutable/versioned artifact guards; schema dictionary and complete ERD; Docker/native setup instructions; isolated PostgreSQL integration tests.

No accounts/session issuance endpoints, class enrollment APIs, grading engine, schedulers, model integrations, experiment execution or fabricated curriculum/participant data were added. Existing health response remains unchanged and does not claim database connectivity.

## Entities and relationships

- **users:** admin_identities, admin_permissions, admin_role_permissions, admin_roles, admin_user_roles, class_join_codes, class_memberships, classes, instructor_profiles, learner_profiles, user_sessions, users.
- **curriculum:** curriculum_grades, curriculum_subjects, curriculum_topics, curriculum_versions, grade_levels, learning_competencies, lessons, quarters, subjects.
- **assessments:** assignment_attempts, assignment_questions, assignment_versions, assignments, question_answer_keys, question_competencies, question_revisions, questions, student_responses.
- **learning:** learner_progress, learning_contexts, points_transactions, vocabulary_items, vocabulary_review_events, vocabulary_review_states.
- **ai:** conversation_messages, conversation_sessions, conversation_topics, pronunciation_activities, pronunciation_attempts.
- **research:** model_configurations, model_versions, research_assessment_results, research_assessments, research_events, research_group_assignments, research_groups, research_levels, research_participants, research_private.research_consent_records, research_private.research_identity_links, research_studies, scheduler_configurations.
- **operations:** audit_logs, message_reads, messages, notifications.

Major paths: users → sessions/profiles/class memberships; curriculum version → grade association → subject association → quarter → topic → lesson → competency; question → revision → private key; class → assignment → version → items/attempts/responses; learning context → vocabulary state → append-only review events; study → coded participant → group allocation/assessment results/events. Research user links and consent evidence references reside in research_private. Research contexts forbid ordinary user/class IDs, so coded activity does not duplicate the identity mapping.

The complete 58-table ERD, all column responsibilities/types, primary/foreign keys, unique/CHECK constraints and indexes are in [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md). The initial revision adds PostgreSQL guards for publication locks, append-only histories, study protocol locks and conversation retention. Model/scheduler configurations are recorded only; nothing is trained or executed.

## Configuration and migration commands

Full password-safe Docker Desktop and native Windows setup commands are in [MIGRATIONS.md](MIGRATIONS.md). The optional local service uses infra/compose.yaml. Set FLUENTT_POSTGRES_PASSWORD in the shell before starting Docker; set FLUENTT_DATABASE_URL with your encoded credentials in the backend shell or ignored services/api/.env. No credentials were added to source control, and existing local .env files were not overwritten.

From repository root, after setting the password as documented:

```powershell
docker compose -f infra/compose.yaml up -d postgres
docker compose -f infra/compose.yaml exec postgres pg_isready -U fluentt_dev -d fluentt
Set-Location services/api
.venv/Scripts/python -m pip install -r requirements.lock.txt
.venv/Scripts/python scripts/check_database.py
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m alembic current
.venv/Scripts/python -m alembic history
.venv/Scripts/python -m alembic revision --autogenerate -m 'Describe the next schema change'
```

The revision-generation command is for a later deliberate model change, not a required setup step. No migration runs during application startup. Never edit an applied revision or downgrade an existing developer database without explicit approval. The PostgreSQL fixture creates its own fluentt_test_<uuid> database and only downgrades/drops that database.

## Actual checks and results

| Check | Result |
|---|---|
| SQLAlchemy model imports/configure_mappers | Passed: 58 tables; all FK targets resolve |
| Initial frozen DDL vs metadata | Passed: compiled table/index definitions match |
| Ten question content/key contracts | Valid examples accepted; unsupported methods, bad types, unknown/duplicate identifiers rejected |
| Ten student answer shapes | Structural validation passed; malformed references rejected; no grading executed |
| Username normalization / research schema boundary / digest-only fields | Non-database tests passed; DB uniqueness remains live-test pending |
| Engine/session/settings checks | Lazy bounded pool, rollback/close, redacted 503 behavior and invalid/redacted configuration tests passed |
| Existing health/CORS/error regression tests | Passed |
| Full backend pytest | **46 passed, 18 skipped**, one existing Starlette/AnyIO deprecation warning |
| Ruff lint / formatting | Passed; 34 Python files checked/formatted |
| Python compileall | Passed |
| pip check | Passed: no broken requirements |
| Documentation consistency | All 58 ERD nodes, 45 changed-file paths and local links verified |
| Alembic history | Passed: base → 0001_initial (head) |
| Offline upgrade / downgrade SQL | Both generated successfully; no live database connected |
| Explicit database diagnostic | Exit 2: database not configured; no success fabricated |
| Local infrastructure inspection | psql/pg_ctl/initdb/docker unavailable; default PostgreSQL/Docker installation paths absent; localhost:5432 TCP check false |

The 18 PostgreSQL tests were collected and skipped because FLUENTT_TEST_DATABASE_URL was unset and infrastructure unavailable. Incomplete live checks: creating users/sessions and duplicate canonical-name/required-field constraints; class/code/membership constraints; curriculum FKs/order uniqueness; all ten methods' JSONB round trips and publication guards; assignment attempts/responses/history; review event/state persistence; research cross-study/private relationships and locks; actual initial upgrade, metadata drift comparison and safe downgrade/re-upgrade. No SQLite substitute or claimed database success was used.

To run the pending suite after local setup, set FLUENTT_TEST_DATABASE_URL to a PostgreSQL maintenance database with CREATEDB privileges and run from services/api:

```powershell
.venv/Scripts/python -m pytest -m postgresql -rs
```

No PostgreSQL service, Docker installation, developer database, dataset or model was created or changed by this section. The supplied Compose configuration is not live-validated here.

## Migration/schema concerns and next-section readiness

- Live PostgreSQL checks are still required before using real data. Offline compilation does not execute PL/pgSQL or prove database constraint behavior.
- Revision 0001_initial contains frozen DDL, trigger functions and private-schema PUBLIC revocations. Later schema changes need new revisions; autogeneration does not preserve/update functions or deployment grants by itself.
- Owners/superusers retain access to research_private. Production needs restricted runtime/migration/research roles and approved consent/retention/deletion processes; application authorization is not implemented by these tables.
- Full Python storage validation runs for ordinary ORM writes; direct/bulk SQL only enforces database checks. Future services must use validated contracts, explicit transactions and immutable snapshots, including JSONB replacement rather than untracked nested mutation.
- Active code expiry/rotation, profile role authorization, assignment deadlines/attempt limits, consent gates, allocation balancing and experiment orchestration require future API/services. Study counts are configurable defaults, not global caps. Research execution is scheduled for Sections 36–38 per this prompt.
- No raw speech is persisted; conversation retention defaults off, but retention approval and cleanup workers remain future work.

The metadata, session dependency, migrations, identity/session/classroom foundations and validated storage types are available for Section 03. Apply the migration and run the PostgreSQL suite when infrastructure is available before verifying live profile/session behavior.

## Created files

- docs/DATABASE_SCHEMA.md
- docs/MIGRATIONS.md
- docs/SECTION_02_REPORT.md
- infra/compose.yaml
- services/api/alembic.ini
- services/api/app/db/base.py
- services/api/app/db/session.py
- services/api/app/models/__init__.py
- services/api/app/models/ai.py
- services/api/app/models/assessments.py
- services/api/app/models/curriculum.py
- services/api/app/models/learning.py
- services/api/app/models/operations.py
- services/api/app/models/research.py
- services/api/app/models/users.py
- services/api/app/models/validation.py
- services/api/app/schemas/__init__.py
- services/api/app/schemas/question_config.py
- services/api/migrations/env.py
- services/api/migrations/initial_downgrade.sql
- services/api/migrations/initial_schema.sql
- services/api/migrations/script.py.mako
- services/api/migrations/versions/0001_initial.py
- services/api/scripts/check_database.py
- services/api/scripts/document_schema.py
- services/api/tests/__init__.py
- services/api/tests/integration/__init__.py
- services/api/tests/integration/conftest.py
- services/api/tests/integration/test_postgresql.py
- services/api/tests/test_database_session.py
- services/api/tests/test_question_config.py
- services/api/tests/test_schema.py

## Modified existing files

- AGENTS.md
- README.md
- docs/ARCHITECTURE.md
- docs/DATABASE_PLAN.md
- docs/DECISIONS.md
- docs/DEVELOPMENT_PLAN.md
- services/api/.env.example
- services/api/app/core/config.py
- services/api/app/db/engine.py
- services/api/app/main.py
- services/api/pyproject.toml
- services/api/requirements.lock.txt
- services/api/requirements.txt

Generated caches, installed Alembic/Mako dependencies inside the ignored virtual environment, and existing ignored local files are excluded from the source inventory. No files were staged, committed or pushed.

**SECTION 02 COMPLETE — READY FOR SECTION 03**

