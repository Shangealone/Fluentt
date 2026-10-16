# Section 05 implementation report

Implemented instructor class creation and owner-only management, reusing Section 04 onboarding/session storage and Section 02 class tables. Student enrollment and code verification remain Section 06. No PostgreSQL server or device session was configured here; this report distinguishes implemented source and passing tests from pending live verification.

## Completed flow

School -> Instructor -> existing username/session -> First Class form -> authenticated POST -> class details with code and confirmed save -> Copy/Share -> My Classes. Additional classes reuse the same form and receive new IDs/codes. Basic editing updates metadata without changing code. My Classes refetches on focus and supports paginated loading. No invented roster count, analytics, assignments, messaging or curriculum UI was added.

The form validates trimmed name (1–150), grade 1–12, English/Tagalog and optional description up to 500 characters. It has loading/errors, disabled fields while saving, keyboard-aware scrolling and single-flight submission. Interrupted requests retain the same UUID/body for safe retry. The owner is always the authenticated instructor. Credentials remain in the existing SecureStore/session layer, never class routes, clipboard/share payloads or logs.

Backend restoration checks actual owned class records through GET /sessions/me: no class -> first-class, any class -> instructor dashboard. Creation persists onboarding completion with the class/code. Restoration never creates a new profile/class. Students still resume their existing class-code boundary.

## APIs and example

- POST /api/v1/classes — requires bearer session and UUID Idempotency-Key; 201 class/code after commit.
- GET /api/v1/classes/mine — owned classes only; limit/offset pagination.
- GET /api/v1/classes/{class_id} — owner-only details, otherwise generic 404.
- PATCH /api/v1/classes/{class_id} — owner-only permitted details, preserves code.

Complete typed contract and synthetic HTTP request/JSON response: [CLASSROOMS.md](CLASSROOMS.md). The example uses Grade 5 English A with grade_level 5, language english, optional description and a UUID request header. The response includes UUID, grade, language, description, a six-digit string such as illustrative 000042, status and UTC timestamps. No example is claimed as an executed PostgreSQL response.

## Security and uniqueness

- Valid instructor session required for every class route. Invalid/expired/revoked/disabled/archived identities fail. Students and personal learners receive 403. Ownership is never accepted in JSON; another owner's class and a missing class are both 404.
- Authentication/session/user locks and all class writes share one transaction. Code failure rolls back the new class and completion state. Only recognized unique-code conflicts are retried inside savepoints.
- Secure backend `secrets.randbelow(1_000_000)` formatted to exactly six digits; leading zeros preserved. Database uniqueness across all historical codes prohibits inactive-code reuse. Allocation has 12 bounded attempts; exhaustion returns safe 503 without a partial class.
- Unique owner/request UUID plus the authenticated user lock deduplicates concurrent/lost-response creation retries. Same key and normalized body return the existing class; changed data conflicts. No timestamp/counter/user ID produces invitation codes.
- Name/description changes do not rotate the code. Grade/language changes are rejected once subject, historical memberships, assignments, learning contexts or class messages exist. Archived classes cannot be edited. Future relation writers must lock/revalidate the class, as documented.
- Class routes return no-store headers. Per-peer creation throttling defaults to 10/window, with existing session request throttling. Limits remain process-local; Section 06 must add verification-specific session/peer/global protections and explicit enrollment confirmation. Codes never authenticate users or provide consent.

## Database migration

New additive head: **0002_class_creation**. Frozen 0001 and initial SQL remain unchanged. Existing classes/subject values are preserved.

1. classes.subject_id becomes nullable with its FK intact. The approved form supplies no curriculum subject, so it remains unset rather than incorrectly inferring Filipino from Tagalog or fabricating curriculum. Later assignments must explicitly configure/validate subject.
2. classes.creation_request_id nullable UUID with unique owner/request identity; historical rows are preserved.
3. class_join_codes.code gets permanent uniqueness, while original active-code/class indexes remain.

Historical duplicate codes cause a clear migration abort requiring review; no records are deleted or silently relabeled. Downgrade refuses while null-subject classes exist, preserving those records. Apply `alembic upgrade head` on a configured development PostgreSQL database before live use. No live migration was applied here.

## Checks executed and actual results

From services/api:

```powershell
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m ruff check app migrations scripts tests
.venv/Scripts/python -m ruff format --check app migrations scripts tests
.venv/Scripts/python -m compileall -q app migrations scripts tests
.venv/Scripts/python -m pip check
.venv/Scripts/python scripts/document_schema.py
```

- **158 passed, 32 skipped**, one upstream Starlette/AnyIO deprecation warning. Includes creation, all roles, validation, missing authentication, other-owner access/edit denial, leading zeros, collision recovery/exhaustion, unexpected failure rollback, multiple classes, pagination, idempotency, metadata editing, context restrictions, expired/disabled/archived sessions, rate limiting and inactive-code non-reuse. Existing identity/preferences/schema tests pass.
- PostgreSQL tests skip because FLUENTT_TEST_DATABASE_URL is unset. Five new conditional live checks cover persistence/ownership/editing, real collision savepoints/non-reuse/rollback, concurrent same-request deduplication, unexpected generator failure rollback and concurrent code collisions. Existing integration checks include head migration/metadata round trip. None of these skipped checks is claimed as passing.
- Ruff checks/format: passed (58 Python files). Compilation and pip dependency check passed. Generated 58-table schema dictionary updated. Offline upgrade/downgrade SQL compilation passes; unchanged tables remain checked against frozen 0001, revised class tables are checked through revision assertions plus conditional live metadata comparison.
- Database diagnostic: configuration absent. No psql/pg_ctl/Docker command found. No SQLite/in-memory runtime fallback was added.

From repository root:

```powershell
node --test scripts/classes.test.mjs scripts/onboarding.test.mjs scripts/api-clients.test.mjs
node scripts/preview-classes.cjs
```

- **17 client/session/service tests passed**. Six new tests cover class validation, loading/single-flight success, interrupted-save UUID reuse, definitive error correction, backend-driven instructor routing, leading-zero copy/share/cancel/failure, authenticated create/list/details/update requests, pagination, safe HTTP errors and malformed response rejection. Copy/share tests inject ports; they do not prove OS integration.
- Static component review generated from the actual ClassForm and CodeCard via React Native Web/React server rendering. It is explicitly labeled synthetic, has inert controls and no API/session/auth bypass. Native clipboard/safe-area imports are stubbed only in this standalone review tool. Browser review confirmed layout, selected grade/language accessibility, readable leading-zero code, description/create action and scrolling. The review fixed an empty-text-child issue and web checked-state accessibility. Screenshots: docs/previews/section05-components.png and section05-form-bottom.png. This is not a live class save or Android screen.

From apps/mobile:

```powershell
npm run typecheck
npm run lint
npx expo export --platform web
npx expo export --platform android
```

Final TypeScript, ESLint (no warnings), web export and Android Hermes export passed. An intermediate class-list callback edit produced a syntax failure, which was corrected before final checks/exports. Class list now reloads on focus and ignores stale initial-load responses. Exports are compilation evidence, not installed-device execution.

Expo-compatible expo-clipboard ~58.0.3 and expo-crypto ~58.0.7 installed through Expo. npm reported a nonfatal optional-directory cleanup warning and the existing dependency-tree audit finding of 27 vulnerabilities (8 moderate, 19 high); no forced dependency upgrades or clean security-audit claim. Node tests print a non-failing module-type warning.

## Remaining live/native verification steps

1. Configure PostgreSQL per README/MIGRATIONS and apply head 0002 with the virtual environment's Alembic. Set a maintenance FLUENTT_TEST_DATABASE_URL with CREATEDB and run the PostgreSQL suite; the fixture creates/drops only its UUID-named disposable database. Never downgrade/reset an existing application database for testing.
2. Start the API with scripts/start.ps1 api. Set EXPO_PUBLIC_API_URL to http://10.0.2.2:8000 for an Android emulator or the computer's reachable LAN address for a physical phone. Restart Metro after environment changes. Use HTTPS in production.
3. Run a native development build (`npx expo run:android` after Android toolchain setup, or an explicitly configured EAS development build). No native directories/EAS project were provisioned by this section. Web remains a navigation preview because native SecureStore is required.
4. Create a synthetic instructor through existing onboarding. Close before creating a class and reopen: expect First Class, same username. Submit blank/overlong name, missing grade/language and oversized description; no invalid class should be created.
5. Save a valid class while tapping Create repeatedly: expect one persisted class/code, save confirmation and six-digit display. Copy into a separate text field and compare all six characters; test Share and cancellation in the actual OS sheet. Verify no device credential appears.
6. Open My Classes; verify its actual name/grade/language/code. Create Another Class, return using the button and hardware Back, and confirm the refreshed list contains distinct IDs/codes. Open details; edit name/description and verify the code remains unchanged. Try safe grade/language edits before adding relationships and verify locked-context 409 cases through tests.
7. Interrupt networking during POST and retry: inspect only one class exists for that request UUID. If the save committed before response loss, relaunch should use backend class existence and show My Classes without auto-creating. On failure, use Check saved classes before deliberately starting a different class.
8. Test a second instructor's class UUID and student/personal credentials against all management APIs; expect generic 404/403. Revoke/expire a test credential and ensure local session recovery behaves as Section 04. Stop the API to check honest errors/retry with no false success.
9. Verify at small phone widths, landscape, larger text and Android keyboard/TalkBack. Scroll to description/Create, check selected radio/disabled states and hardware Back during saves. Physical keyboard, native storage, OS clipboard/share and full authenticated mobile-to-PostgreSQL flows were not executed here.

## Section-specific file inventory

Paths are repository-relative in this inventory. Git still has no baseline commit and previous project files remain untracked, so this inventory records this section's work rather than claiming a git diff.

Added:
- services/api/app/modules/classrooms/__init__.py
- services/api/app/modules/classrooms/schemas.py
- services/api/app/modules/classrooms/repository.py
- services/api/app/modules/classrooms/service.py
- services/api/app/modules/classrooms/router.py
- services/api/migrations/versions/0002_class_creation.py
- services/api/tests/classroom_support.py
- services/api/tests/test_classrooms.py
- services/api/tests/integration/test_classrooms_postgresql.py
- apps/mobile/src/services/api/classes.ts
- apps/mobile/src/features/classes/state.ts
- apps/mobile/src/features/classes/ClassForm.tsx
- apps/mobile/src/features/classes/CodeCard.tsx
- apps/mobile/src/app/class-details.tsx
- apps/mobile/src/app/class-edit.tsx
- scripts/classes.test.mjs
- scripts/preview-classes.cjs
- docs/CLASSROOMS.md
- docs/SECTION_05_REPORT.md
- docs/previews/section05-components.html
- docs/previews/section05-components.png
- docs/previews/section05-form-bottom.png

Modified:
- services/api/app/models/users.py
- services/api/app/modules/identity/session_service.py
- services/api/app/modules/identity/repository.py
- services/api/app/api/v1/router.py
- services/api/app/core/config.py
- services/api/app/main.py
- services/api/.env.example
- services/api/tests/test_schema.py
- services/api/scripts/document_schema.py
- apps/mobile/package.json
- apps/mobile/package-lock.json
- apps/mobile/tsconfig.json
- apps/mobile/src/services/api/client.ts
- apps/mobile/src/services/api/identity.ts
- apps/mobile/src/session/provider.tsx
- apps/mobile/src/components/onboarding.tsx
- apps/mobile/src/app/_layout.tsx
- apps/mobile/src/app/first-class.tsx
- apps/mobile/src/app/instructor.tsx
- AGENTS.md
- README.md
- docs/ARCHITECTURE.md
- docs/DECISIONS.md
- docs/IDENTITY_AND_SESSIONS.md
- docs/MIGRATIONS.md
- docs/DATABASE_SCHEMA.md

No existing assets, administrator functionality or applied migration was replaced. Generated ignored Expo/Python/package artifacts are not source inventory. Temporary implementation scripts were removed.

## Next section boundary

Section 06 must implement authenticated school-student code verification, limited class preview, explicit confirmation, transactional enrollment, expiry/status checks and verification-specific abuse protection. Student onboarding still stops at its honest class-code boundary. No enrollment or future learning/research feature was started.

SECTION 05 COMPLETE — READY FOR SECTION 06
