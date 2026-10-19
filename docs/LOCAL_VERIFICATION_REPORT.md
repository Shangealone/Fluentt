# Local database repair and verification — 2026-10-18

Authorized maintenance after Section 09; no Section 10 feature implementation, commit or push.

## Outcome

Local PostgreSQL is configured and running; the separate development database is migrated through **0005_constraint_names**, and Alembic reports no schema drift. The complete backend suite runs with real PostgreSQL: **333 passed, zero skipped**. Earlier section reports describing unavailable PostgreSQL remain historical.

The user is unsure whether another computer has a database. No remote/earlier deployment was accessed, reset, stamped or migrated. Frozen revisions 0001–0004, their SQL artifacts, PROJECT_HANDOFF.md and the pre-existing mobile lockfile remain unchanged. The user confirmed no OIDC provider is available and requested administrator sign-in stay disabled.

## Repair design and evidence

Running the original migration on a generated disposable database reproduced SQLSTATE **42P07**, `relation "uq_learning_competencies_lesson_id" already exists`. Static review also identified the assignment-version/question unique-name collision and review-state/scheduler composite FK collision.

- Explicit fresh-bootstrap option: `alembic -x repair_initial_names=true upgrade head`. It checks database emptiness and applies a three-declaration, name-only adapter during SQL execution. Frozen files are not rewritten; no unbuilt schema is stamped. Existing relations/schemas/functions/types or a populated version table reject the option. Use exclusive operator access during bootstrap.
- Current models explicitly name those three constraints; integrity, IDs, columns and table count (60) are unchanged.
- Forward revision 0005 locates constraints by ordered column signature/type and renames only when necessary. Missing/ambiguous matches abort. It never drops constraints/indexes or edits records. Downgrade retains valid names rather than recreating invalid collisions. Any discovered old deployment still needs a backup and schema/history review before ordinary forward upgrade.
- New tests check exact adapter scope/idempotence, unique compiled constraint names, refusal on existing schema, and forward name convergence with preserved fixture rows. Integration fixtures and disposable round-trip tests use the same empty-bootstrap adapter.

Two previously skipped test issues surfaced and were corrected: the concurrent-code test waited at a barrier inside a transaction after the curriculum advisory lock, blocking its peer; the barrier now synchronizes requests before database work. A curriculum fixture attempted to recreate Grade 4 after an earlier API test persisted that reference; it now reuses the existing row without relabeling it. Application authorization/locking was not weakened to pass either check.

## Local environment

Official EDB portable PostgreSQL 17 binaries were downloaded from the [vendor binary page](https://www.enterprisedb.com/download-postgresql-binaries) and extracted under ignored `private-data/verification/runtime`. The downloaded archive SHA-256 is `80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F` (recorded locally, not an independently verified vendor checksum).

The new cluster listens only on **127.0.0.1:55432**, uses SCRAM password authentication, and is not a Windows service. The generated password file is restricted to the current Windows account. Runtime/data/logs/password/test output remain ignored. A new `fluentt_local` development database was created, and its URL was added to ignored services/api/.env while preserving prior settings. No production credentials or real administrator were created. The local owner account is development-only; restricted production runtime/operator grants remain a separate deployment gate.

From the repository root, use separate terminals:

```powershell
./scripts/local-postgres.ps1 start
./scripts/start.ps1 api
```

```powershell
./scripts/start.ps1 admin
```

```powershell
./scripts/start.ps1 mobile
```

API docs: http://localhost:8000/docs. Administrator development website: http://localhost:3000. Android emulator uses existing `http://10.0.2.2:8000` mobile configuration. The web mobile build remains a navigation preview; it cannot create/persist mobile identities. Use development mode for localhost HTTP; production Next correctly rejects non-HTTPS API origins.

`./scripts/local-postgres.ps1 status` checks this specific cluster. Close API/test connections before `./scripts/local-postgres.ps1 stop` (smart shutdown). The helper never initializes, migrates, resets or deletes data. The portable installation is specific to this workstation and is not committed.

To rerun all backend tests from services/api against generated disposable databases:

```powershell
$testPassword = Get-Content -Raw '../../private-data/verification/pg-password'
$env:FLUENTT_TEST_DATABASE_URL = "postgresql+psycopg://fluentt_local:${testPassword}@127.0.0.1:55432/postgres"
.venv/Scripts/python -m pytest -q
Remove-Item Env:FLUENTT_TEST_DATABASE_URL
Remove-Variable testPassword
```

This maintenance URL is used only to create/drop the fixture's UUID-named databases; it never migrates/resets postgres or fluentt_local.

## Actual verification

| Check | Result |
|---|---|
| Full backend suite with PostgreSQL | **333 passed, 0 skipped**, two existing dependency deprecation warnings. Includes all 74 PostgreSQL integration cases. |
| Database migration/integrity | Disposable upgrade/downgrade/re-upgrade passed; live model/schema comparison passed; occupied bootstrap refusal and name-convergence fixture preservation passed. |
| Exact documented Alembic CLI | Fresh opt-in bootstrap passed on another generated UUID database; repeating the opt-in flag was rejected; ordinary upgrade then passed. Only that generated database was removed. |
| Configured development database | Connectivity check passed; current=head 0005; `alembic check`: no new upgrade operations. |
| Backend Ruff / format / compileall | Passed; 91 Python files satisfy formatter. |
| Node mobile/client/state/component tests | **45 passed**, no skipped tests. |
| Administrator HTTP integration | **8 passed** against real Next with synthetic backend contracts; these do not prove a real provider. |
| Mobile TypeScript / ESLint | Passed. |
| Administrator production build, then serial TypeScript / ESLint | Passed. |
| Mobile web and Android exports | Passed together into ignored dist/local-verification; export is not native UI execution. |
| Actual API HTTP smoke against development PostgreSQL | Three mobile roles created as explicitly synthetic accounts; personal preferences, class creation, code preview/confirmation, membership/owned-class reads, fresh-client role/completion restoration, wrong-role denial, mobile rejection at admin endpoint and curriculum read passed. All issued smoke credentials revoked; no raw credentials retained. An initial smoke request used grade_level instead of the documented preference field grade and correctly returned 422; the corrected smoke passed without changing the API. |
| Real local browser / backend | Anonymous direct dashboard request redirects to login; disabled provider button and no public registration shown. |
| Android emulator | Existing AVD booted, adb reports device/boot complete, Expo Go installed. Native visual inspection could not complete: computer-use screen capture failed twice with `window crop is outside captured monitor`. No native user-journey pass is claimed. |

Synthetic HTTP smoke profiles/classes remain clearly labeled in the separate local development database. Disposable test fixtures were removed with their generated databases. No real educational content, fabricated progress or production administrator was seeded.

## Remaining gates

1. Real OIDC issuer/confidential client/provider-enforced MFA and accepted claim semantics, exact administrator mapping/provisioning and deployed HTTPS browser cookie checks remain pending. Sign-in stays safely disabled, as requested. No password/auth bypass was introduced.
2. Android UI onboarding, SecureStore restart restoration, back navigation, accessible layouts and logout still need successful device/emulator interaction. Backend persistence/client contracts and packaging passed; those are not replacements for native UI checks.
3. Unknown databases on other computers require inspection/backups before upgrades. No repair claim applies to an uninspected deployment.
4. Production restricted database grants, trusted proxy/TLS, distributed rate limiting, retention and operator attribution remain operational prerequisites. Local owner-role testing is not proof of production access isolation.
5. Section 10 requires its own prompt/approval.

## Every changed source/documentation file in this maintenance task

```text
AGENTS.md
README.md
docs/ADMIN_AUTH.md
docs/DATABASE_SCHEMA.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/LOCAL_VERIFICATION_REPORT.md
docs/MIGRATIONS.md
scripts/local-postgres.ps1
services/api/app/models/assessments.py
services/api/app/models/curriculum.py
services/api/app/models/learning.py
services/api/migrations/env.py
services/api/migrations/versions/0005_constraint_names.py
services/api/scripts/bootstrap_names.py
services/api/scripts/document_schema.py
services/api/tests/integration/conftest.py
services/api/tests/integration/test_bootstrap_postgresql.py
services/api/tests/integration/test_classrooms_postgresql.py
services/api/tests/integration/test_curriculum_postgresql.py
services/api/tests/integration/test_postgresql.py
services/api/tests/test_bootstrap_names.py
services/api/tests/test_schema.py
```

In addition, ignored backend .env now contains the local database URL, and ignored runtime/test/export files plus Expo's emulator installation were created. Existing unrelated source changes are preserved; no files were deleted.
