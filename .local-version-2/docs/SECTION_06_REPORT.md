# Section 06 — student class enrollment and code verification

Date: 2026-10-17 (Asia/Manila).

Status: **implemented in source; live PostgreSQL and native end-to-end verification pending**. Awaiting user acceptance before Section 07. This report does not claim a successfully executed mobile-to-PostgreSQL enrollment or completed device acceptance.

## Scope and approved decisions

Implemented authenticated school-student invitation verification, limited preview, explicit Join Class confirmation, transactional membership/audit/completion writes, own-membership retrieval and membership-based restoration. Existing personal onboarding and instructor class management remain. No learning engine, administrator authentication, research enrollment/randomization or Section 07 dashboard redesign was added.

The user approved the Section 06 plan and these policies:

- Multiple active classes; first onboarding joins one, and My Classes lists memberships with Join another class.
- Left students may rejoin through a newly reviewed invitation, creating a new row and preserving history.
- Prior instructor removal blocks self-rejoining. No reinstatement/removal/departure UI/API is introduced.
- Duplicate active enrollment returns the same membership without another audit event.
- Active/unended membership, active/unarchived class and available instructor owner define restored eligibility. Invitation expiry/revocation does not terminate existing membership.
- Nullable curriculum subject is allowed; no inference from Tagalog to Filipino.

## API and data changes

| Method | Endpoint | Implemented behavior |
|---|---|---|
| POST | /api/v1/class-enrollment-previews | Strict six-digit string in JSON; returns only class name, grade, language, nullable instructor display name and snapshot version; no membership write |
| POST | /api/v1/class-memberships | Explicit code/version confirmation; revalidates current eligibility; HTTP 200 committed new/existing own membership |
| GET | /api/v1/class-memberships/mine | Own eligible memberships only, limit/offset pagination |
| GET | /api/v1/sessions/me | School-student completion derived from eligible memberships; existing personal/instructor derivation retained |

No new table, model, migration or dependency. The existing 58-table schema, partial active-membership uniqueness and foreign keys are reused. Migration head remains 0002_class_creation; frozen 0001/0002 and SQL artifacts are unchanged. No application/developer database was migrated, downgraded, reset or seeded.

The approved plan deliberately uses code + optimistic class_version instead of the conceptual short-lived preview reference. This fingerprint checks freshness of displayed context, invitation versions and student membership history; it is not authorization or a secret and has no separate TTL. Confirmation always rechecks the authenticated user and current invitation/class/history. A changed preview returns 409 and requires new review. Existing active membership can be replayed despite an old snapshot; an expired/revoked invitation instead requires recovery through own memberships/session restoration.

Full request/response/error/lifecycle documentation is in [ENROLLMENT.md](ENROLLMENT.md).

## Transactions, authorization and privacy

- Existing bearer session validation and student-row locks span the protected transaction. Only school_student is admitted. Missing/expired/revoked/disabled/archived identities fail. Enrollment never creates another identity or credential.
- Invitation lookup resolves IDs, then locks owner (shared), class and code in owner-before-class order compatible with instructor writes. Current status/expiry and removal history are rechecked. User locking serializes requests across sessions; class locking protects the Section 05 context-edit boundary.
- New membership, server onboarding completion and safe class.enrolled audit event commit together. Failure rolls back all writes. Duplicate requests reuse the active row. Historical rows/codes are never deleted by the service.
- Student payloads contain no roster, invitation code, owner username/ID, private description, credentials, answer keys or research data. Existing instructor detail/edit endpoints stay instructor-only.
- Generic unavailable errors cover unknown, expired, revoked, archived, owner-unavailable and removal-blocked invitations. All new routes/error responses receive no-store headers. Codes travel in JSON, never URL parameters; application logs record request ID/status, not bodies/credentials.
- Peer/session budgets default to 60/10 preview+confirmation requests per existing 60-second window. They are bounded and process-local. Global edge limiting, trusted proxy/TLS deployment and shared-school-network tuning remain production prerequisites.

## Mobile workflow

Existing native identity -> class-code input -> Verify -> safe preview -> Join Class -> committed-success confirmation -> My Classes. Cancel/Back from preview does not enroll. Repeat taps are guarded. Network/5xx/429 confirmation failures retain the same in-memory request for manual retry; definitive other 4xx responses clear preview for correction. Check saved classes recovers backend state after an uncertain response. Cancelling cannot undo a committed enrollment.

Startup uses SecureStore and sessions/me; unenrolled school students reach class-code, enrolled students reach student/My Classes. My Classes fetches authenticated paginated records on focus, ignores responses after navigation, and hides class data during loading/error. Active school students may reopen the code screen to join another class. Personal preferences and instructor routes are retained. The class-code route is ordered after student so restored eligible students default to their portal while the success screen can remain visible after joining.

The shared keyboard-aware layout, numeric keyboard, six-ASCII-digit validation, accessible labels, disabled/loading/error actions and hardware Back handling are used. Native keyboard, gestures, text scaling and TalkBack behavior have not been exercised. Web remains navigation preview only; no browser credential storage or runtime authentication bypass was added.

## Checks executed and results

Environment: Node 24.21.0, npm 11.19.0, existing virtual environment Python 3.14.8. This differs from the documented historical Python 3.11.8 baseline. No system-wide tools or package versions were installed/changed. Passing tests here do not establish Python 3.11 equivalence.

| Check | Actual result |
|---|---|
| Existing backend regression suite before enrollment tests | 158 passed, 32 skipped |
| Final backend pytest | **190 passed, 40 skipped**, one upstream Starlette/AnyIO deprecation warning |
| Ruff check | Passed |
| Ruff format check | Passed, 67 Python files |
| Python compileall | Passed |
| pip check | Passed; no broken requirements |
| Node enrollment/classes/onboarding/API-client tests | **22 passed**, zero skipped; existing module-type inference warnings |
| Mobile TypeScript / ESLint | Passed |
| Expo web export | Passed |
| Expo Android Hermes export | Passed outside restricted temporary-directory sandbox |
| Database diagnostic | Configuration absent (diagnostic exit 2); no live connection/migration verified |
| Native device / Keystore / keyboard / Back / TalkBack | Not executed; tooling unavailable on PATH |

The 32 new non-database backend cases cover code validation/leading zeros, safe preview/no implicit join, multiple classes, duplicate confirmation, missing/expired/revoked credentials, wrong roles, stale preview/cross-class mismatch, unavailable code/class/owner, restoration filtering, historical rejoining/removal, service-double concurrency, audit rollback, throttling, redacted logging, management denial and runtime 503 without storage. Repository doubles are test-only and do not prove database locking/persistence.

Eight new conditional PostgreSQL cases cover real persistence/restoration/access boundaries, invitation-independent membership, concurrent confirmation deduplication/audit, left/removed history, transactional failure after writes, and four post-preview availability/version changes. All eight skipped, along with 32 existing PostgreSQL cases, because FLUENTT_TEST_DATABASE_URL is unset. They use only the existing generated UUID database fixture. No SQLite substitute was used.

Client tests cover malformed code, separate confirmation, cancellation, single-flight requests, interrupted retry with identical body, 4xx/429/5xx behavior, safe typed API responses/requests, routing/restoration/revocation and existing personal/instructor regressions. These tests inject ports; they are not native interaction tests.

Initial sandbox backend tests stalled in Windows asyncio's fallback socketpair before application execution; the diagnostic stack showed socket accept while initializing TestClient. Those processes were interrupted. The same health/full suites passed outside the sandbox. Android export initially failed writing index.hbc in sandbox Temp (permission denied); the approved outside-sandbox rerun passed. These failures are recorded separately from application test results.

Commands run from services/api:

```powershell
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m ruff check app migrations scripts tests
.venv/Scripts/python -m ruff format --check app migrations scripts tests
.venv/Scripts/python -m compileall -q app migrations scripts tests
.venv/Scripts/python -m pip check
.venv/Scripts/python scripts/check_database.py
```

From repository root / apps/mobile respectively:

```powershell
node --test scripts/enrollment.test.mjs scripts/classes.test.mjs scripts/onboarding.test.mjs scripts/api-clients.test.mjs
npm run typecheck
npm run lint
npx --no-install expo export --platform web
npx --no-install expo export --platform android
```

## Remaining verification and known limitations

1. Resolve/document the Python baseline difference before relying on cross-environment reproducibility. Current checks used the existing Python 3.14 environment; no 3.11 environment was created.
2. Configure PostgreSQL per MIGRATIONS.md, inspect any existing database, then apply head without resetting data. Set a maintenance FLUENTT_TEST_DATABASE_URL with CREATEDB and run the disposable suite. Live locking, constraints, migration metadata and persistence are still unverified.
3. Run a native development build with configured API URL and reachable backend. Create synthetic instructor/classes and school students through real onboarding. Verify preview/cancel/no membership, explicit join, leading zeros, duplicate taps, another class and relaunch/restoration.
4. Interrupt confirmation networking and check saved classes. Test revoked/expired credentials and backend outages. Use disposable fixtures to test departure/removal/unavailable-class scenarios; this section adds no lifecycle-management API.
5. Check small displays, keyboard, increased text size, Android Back, screen-reader labels and cancellation. No browser/static screenshot is presented as a native authenticated enrollment.
6. Dependency audit findings from earlier reports were not remediated or freshly audited; no clean-security-audit claim. Process-local limits and schema-owner research privileges remain deployment limitations.
7. Preview markers and pending confirmation live only in memory. Force-close discards the draft; restoration recovers committed membership. Account recovery/device pairing remain unresolved and outside scope.

No new critical enrollment policy remains open for this section. Future instructor reinstatement/departure/removal management, curriculum binding and class lifecycle actions need their own authorized scope.

## Section 07 prerequisites and stop boundary

The Section 07 prompt has been read, but no Section 07 implementation was performed. Its dashboard/navigation work must follow user acceptance of Section 06 and account for pending live/native verification. Existing membership listing is the minimum Section 06 class-access integration, not a complete learning dashboard. Administrator authentication remains Section 08; learning, AI, scheduling and research execution remain deferred.

## File inventory and Git state

The inventory below lists Section 06 changes separately from the pre-existing mobile lockfile modification and untracked PROJECT_HANDOFF.md. No automatic commit/push occurred. Both pre-existing changes are preserved; PROJECT_HANDOFF.md remains the Section 05 handoff snapshot.

The mobile package-lock SHA-256 before and after implementation is:
`92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6`.

No migration, model, manifest, administrator source or existing preview artifact changed. Ignored test caches, Python bytecode and Expo export outputs are generated verification artifacts.

Modified tracked files:

- AGENTS.md
- README.md
- apps/mobile/src/app/_layout.tsx
- apps/mobile/src/app/class-code.tsx
- apps/mobile/src/app/student.tsx
- apps/mobile/src/services/api/client.ts
- apps/mobile/src/session/provider.tsx
- docs/API_DESIGN.md
- docs/ARCHITECTURE.md
- docs/CLASSROOMS.md
- docs/DATABASE_SCHEMA.md
- docs/DECISIONS.md
- docs/DEVELOPMENT_PLAN.md
- docs/IDENTITY_AND_SESSIONS.md
- docs/MIGRATIONS.md
- services/api/.env.example
- services/api/app/api/v1/router.py
- services/api/app/core/config.py
- services/api/app/main.py
- services/api/app/modules/identity/repository.py

Added Section 06 files:

- apps/mobile/src/features/enrollment/MyClasses.tsx
- apps/mobile/src/features/enrollment/state.ts
- apps/mobile/src/services/api/enrollment.ts
- docs/ENROLLMENT.md
- docs/SECTION_06_REPORT.md
- scripts/enrollment.test.mjs
- services/api/app/modules/enrollment/__init__.py
- services/api/app/modules/enrollment/queries.py
- services/api/app/modules/enrollment/repository.py
- services/api/app/modules/enrollment/router.py
- services/api/app/modules/enrollment/schemas.py
- services/api/app/modules/enrollment/service.py
- services/api/tests/enrollment_support.py
- services/api/tests/integration/test_enrollment_postgresql.py
- services/api/tests/test_enrollment.py

Git status at completion (pre-existing lockfile/handoff entries intentionally retained):

```text
 M AGENTS.md
 M README.md
 M apps/mobile/package-lock.json
 M apps/mobile/src/app/_layout.tsx
 M apps/mobile/src/app/class-code.tsx
 M apps/mobile/src/app/student.tsx
 M apps/mobile/src/services/api/client.ts
 M apps/mobile/src/session/provider.tsx
 M docs/API_DESIGN.md
 M docs/ARCHITECTURE.md
 M docs/CLASSROOMS.md
 M docs/DATABASE_SCHEMA.md
 M docs/DECISIONS.md
 M docs/DEVELOPMENT_PLAN.md
 M docs/IDENTITY_AND_SESSIONS.md
 M docs/MIGRATIONS.md
 M services/api/.env.example
 M services/api/app/api/v1/router.py
 M services/api/app/core/config.py
 M services/api/app/main.py
 M services/api/app/modules/identity/repository.py
?? PROJECT_HANDOFF.md
?? apps/mobile/src/features/enrollment/MyClasses.tsx
?? apps/mobile/src/features/enrollment/state.ts
?? apps/mobile/src/services/api/enrollment.ts
?? docs/ENROLLMENT.md
?? docs/SECTION_06_REPORT.md
?? scripts/enrollment.test.mjs
?? services/api/app/modules/enrollment/__init__.py
?? services/api/app/modules/enrollment/queries.py
?? services/api/app/modules/enrollment/repository.py
?? services/api/app/modules/enrollment/router.py
?? services/api/app/modules/enrollment/schemas.py
?? services/api/app/modules/enrollment/service.py
?? services/api/tests/enrollment_support.py
?? services/api/tests/integration/test_enrollment_postgresql.py
?? services/api/tests/test_enrollment.py
```

Implementation references consulted: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo Router protected routes](https://docs.expo.dev/router/advanced/protected/), [Expo documentation index](https://docs.expo.dev/llms.txt), [React Native BackHandler](https://reactnative.dev/docs/backhandler), and [TextInput](https://reactnative.dev/docs/textinput). Protected navigation remains a presentation boundary; API authorization is enforced separately.
