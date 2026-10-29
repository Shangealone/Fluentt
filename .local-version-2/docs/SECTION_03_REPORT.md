# Section 03 completion report

Date: 2026-10-17 (Asia/Manila).

## Inspection and implementation summary

Reviewed root instructions, the architecture/development/database/security documentation, FastAPI routers/settings/error handling, SQLAlchemy user/session/profile models, the initial Alembic revision and existing test conventions. Sections 00–02 were present; root Git still had no commits and earlier files were untracked. The inventory below compares against the previous section reports, not a claimed committed Git diff. Existing application/database foundations were reused. No frontend files, dependency manifests/lockfiles, database data or migration files were changed.

Implemented an identity module with separate API routes, typed request/response schemas, username validation, repositories, user/session services, credential helpers, authorization dependency and bounded throttling. Public creation supports only personal_student, school_student and instructor. A duplicate cannot claim an account or receive another session. Account IDs and roles are saved with a blank learner/instructor subtype and SHA-256-only session verifier in one transaction. Profiles remain in onboarding; no class/enrollment is created.

Device credentials use 256 cryptographically random bits, Bearer transport, 30-day rolling inactivity expiry bounded by 90 days absolute, revocation and generic 401 behavior. Disabled/archived/non-mobile users are denied. Protected requests derive the profile from the verifier lookup, not a supplied user ID or username. Raw secrets are returned once on successful creation after commit, omitted from object representations and excluded from database/log/error fields. Identity responses use no-store headers; production requires HTTPS.

## Implemented API and examples

| Endpoint | Request | Success |
|---|---|---|
| GET /api/v1/usernames/check | ?username=shan123 | 200: username, available, message |
| POST /api/v1/users | {"username":"shan123","role":"school_student"} | 201: user profile plus issued session |
| GET /api/v1/sessions/me | Authorization: Bearer <device-credential> | 200: current mobile profile |
| POST /api/v1/sessions/revoke | Authorization: Bearer <device-credential> | 204: empty body |

Expected failure codes include 422 invalid input/role, 409 duplicate username, 401 invalid/inaccessible session, 429 throttled (Retry-After), 503 unavailable database and 400 non-HTTPS identity access in production. Errors follow the existing request-ID envelope with fixed safe messages and no raw input/credentials. Availability never exposes IDs, roles or session data.

Full contracts, response shapes and password-safe PowerShell request examples are in [IDENTITY_AND_SESSIONS.md](IDENTITY_AND_SESSIONS.md). GET /sessions/me is the restoration endpoint; no redundant POST /sessions/restore, password login, role update or administrator creation route exists.

## Username policy and migration details

New public usernames use 3–24 ASCII letters/numbers/underscores without surrounding whitespace. Canonical comparison is lowercase ASCII. admin, administrator, system and support are reserved in any case. The existing 3–32 storage/ORM policy is retained for compatibility: no user is renamed/deleted and valid sessions can restore longer legacy names. One centralized module defines both policies with the same canonical rule.

No schema migration is necessary. users.canonical_username remains generated under C collation and globally unique, including administrator records. The authoritative initial revision 0001_initial and all migration review artifacts are unchanged; all 58 tables/index definitions still match its metadata snapshot. Both offline migration directions compile; no live upgrade/downgrade was run.

## Tests and actual results

| Verification | Actual result |
|---|---|
| Full backend pytest | **107 passed, 26 skipped**; one existing Starlette/AnyIO deprecation warning |
| Identity API tests with test-only repository doubles | Passed: three roles, availability/case duplicates, invalid/reserved names, admin/extra-field rejection, creation/restoration/revocation, invalid/expired/revoked/disabled/archived/non-mobile accounts, bounded rolling expiry, no user-ID spoofing, cache/log/error redaction, 429 and HTTPS enforcement |
| Security/service unit tests | Passed: random credential format/digest and hidden repr, legacy/new policy boundaries, limiter expiry/capacity, positive configuration, atomic rollback, exact constraint-error mapping and service-level admin rejection |
| Missing-storage behavior | Valid creation returns 503; invalid input is rejected before storage; missing credentials return 401; no simulated success |
| OpenAPI | Four identity routes, required creation body, max-24 username rule, exact three-role enum and HTTP Bearer security verified |
| Ruff / format checks | Passed; 49 Python files already formatted |
| Python compileall / pip check | Passed; no broken dependencies |
| Existing health, CORS, storage-contract and migration regression tests | Passed |
| Alembic history/offline compilation | Passed: only 0001_initial head; upgrade/downgrade SQL compile without connecting |
| Schema preservation | Passed: 58 tables and all indexes still match the initial frozen definitions |
| Real local server smoke (separate port 8001) | Uvicorn started with database_configured=False; HTTP health 200, rejected administrator-role request 422, missing credential 401, and four identity routes in OpenAPI. No accounts/credentials created; temporary server stopped afterward. |

The **8 new PostgreSQL identity tests** and **18 existing PostgreSQL tests** were collected and skipped because FLUENTT_TEST_DATABASE_URL was unset and local PostgreSQL/Docker remained unavailable. Test-only repository doubles exercise API behavior and are never a production fallback. Live creation/persistence, case-variant registration races, revocation/expiration and rollback have **not passed PostgreSQL verification** here. No SQLite substitute was used.

Commands (from services/api):

```powershell
.venv/Scripts/python -m pytest -q -rs
.venv/Scripts/python -m ruff check app tests migrations scripts
.venv/Scripts/python -m ruff format --check app tests migrations scripts
.venv/Scripts/python -m compileall -q app tests migrations scripts
.venv/Scripts/python -m alembic history
.venv/Scripts/python -m alembic upgrade head --sql
.venv/Scripts/python -m alembic downgrade 0001_initial:base --sql
```

For the pending live suite, follow MIGRATIONS.md to set up local PostgreSQL, apply 0001_initial, then set FLUENTT_TEST_DATABASE_URL to a maintenance connection with CREATEDB and run:

```powershell
.venv/Scripts/python -m pytest -m postgresql -rs
```

Only a fresh UUID-named test database is migrated/downgraded/dropped by those tests. No developer database is reset.

## Security decisions and remaining limitations

- No username-based recovery. Registration is an explicit creation, not a login. If a committed issuance response is lost, retry returns 409 without redisclosing credentials. Idempotent credential replay/recovery is deferred until an approved ownership design exists.
- On later mobile launches, Section 04 must store/read the secret through Expo SecureStore and call GET /sessions/me. Never use AsyncStorage, query strings, logs or persisted ordinary app-state snapshots for secrets. Preserve credentials on temporary failures; an invalid session is not permission to claim a username.
- Revocation is current-session only; no rotation/recovery/device-pairing or administrator authentication is implemented. Existing session table supports future multiple records without providing an unsafe public attachment route.
- Per-peer fixed-window limits are configurable and thread-safe but **single-process**, with bounded memory and restart-local state. Production/multiple workers require global edge limits and trusted proxy/TLS configuration. Shared classroom network capacity must be considered. No new distributed infrastructure was added.
- HTTPS is enforced by the production ASGI scheme; the proxy/server must supply it only from trusted forwarding. Backend startup instructions/helper disable Uvicorn access logs to avoid retaining username query values. Deployment must also avoid Authorization/body logging upstream.
- Future instructor class ownership remains a later authorization task. This section only validates mobile identity/role and does not grant administrative permissions, enroll students or create classes.
- PostgreSQL integration is still the blocking environment dependency for live persistence verification. No actual credentials, curriculum or participant records were seeded; existing local .env files were preserved.

## Readiness for Section 04

The documented backend identity contracts and current-mobile-user dependency are ready for onboarding integration. PostgreSQL configuration/migration and the pending live test suite must be completed to verify end-to-end storage. Restart the backend after code changes to load the new routes. Stop here; no Section 04 UI was implemented.

## Created files

- docs/IDENTITY_AND_SESSIONS.md
- docs/SECTION_03_REPORT.md
- services/api/app/core/rate_limit.py
- services/api/app/core/security.py
- services/api/app/core/usernames.py
- services/api/app/modules/identity/__init__.py
- services/api/app/modules/identity/dependencies.py
- services/api/app/modules/identity/errors.py
- services/api/app/modules/identity/repository.py
- services/api/app/modules/identity/router.py
- services/api/app/modules/identity/schemas.py
- services/api/app/modules/identity/session_service.py
- services/api/app/modules/identity/user_service.py
- services/api/tests/identity_support.py
- services/api/tests/integration/test_identity_postgresql.py
- services/api/tests/test_identity_api.py
- services/api/tests/test_identity_security.py

## Modified existing files

- AGENTS.md
- README.md
- docs/API_DESIGN.md
- docs/ARCHITECTURE.md
- docs/DATABASE_PLAN.md
- docs/DECISIONS.md
- docs/DEVELOPMENT_PLAN.md
- docs/MIGRATIONS.md
- scripts/start.ps1
- services/api/.env.example
- services/api/app/api/v1/router.py
- services/api/app/core/config.py
- services/api/app/main.py
- services/api/app/models/users.py

Ignored virtual-environment/cache files and prior-section untracked source are excluded from the new-file inventory. No files were staged, committed or pushed.

**SECTION 03 COMPLETE — READY FOR SECTION 04**
