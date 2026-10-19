# FLUENTT Project Handoff

> Prepared from the current repository and the available original Codex session context on 2026-10-17 (Asia/Manila). This document is a handoff, not a new implementation plan. It records verified repository facts separately from historical limitations.

## 1. Current repository state

- **Current path:** `C:\Users\Shan Gealone\Desktop\Projects\Fluentt`
- **Git branch:** `main`, tracking `origin/main`
- **Remote:** `https://github.com/Shangealone/Fluentt.git`
- **Latest committed revision:** `d2b98be Initialize FLUENTT through instructor class management`
- **Current working-tree change:** `apps/mobile/package-lock.json` is modified and uncommitted. Inspect the diff before committing or reverting it; do not assume it is disposable.
- The Section 05 implementation was previously pushed to the repository. The current checkout is otherwise at the Section 05 boundary.
- This handoff is the only file intended to be created by the current handoff task. No Section 06 work is authorized by this document.

## 2. Project overview and thesis scope

FLUENTT is the thesis project **“FLUENTT: An Adaptive Language Learning System with Enhanced Spaced Repetition and NLP-Driven Pronunciation Modeling”** for NE Learning Inc. The intended system supports adaptive English/Tagalog language learning, classroom learning, versioned curriculum and assessments, spaced repetition, pronunciation/conversation integrations, and a controlled research evaluation.

The architecture separates:

- An Expo/React Native mobile app for learners and instructors.
- A separate Next.js administrator website.
- A FastAPI backend that owns authorization, PostgreSQL access, AI/provider access, storage boundaries and domain transactions.
- PostgreSQL for users, sessions, classes, curriculum, assessments, learning state, AI activity, research and operations.

Important thesis constraints:

- No traditional password-login flow is planned. Mobile identity uses globally unique canonical usernames plus opaque server-issued device sessions.
- Class codes are invitation identifiers, not identity, authentication or consent.
- Filipino as a subject must remain distinct from Tagalog as a learning language/track.
- The ten assessment methods defined in `docs/API_DESIGN.md` must remain exactly preserved.
- Published curriculum, grading and model/scheduler configurations must be versioned.
- Research identities, consent and coded study data must remain separated from ordinary user identity.
- Do not claim DepEd verification, trained FIFAKT, valid Tagalog pronunciation scoring, research outcomes or real model results without evidence.
- Use synthetic fixtures only for early testing; never fabricate participants, curriculum outcomes or production data.

Primary architectural references: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/API_DESIGN.md`, `docs/DATABASE_SCHEMA.md`, `docs/MIGRATIONS.md`, and `AGENTS.md`.

## 3. Technology stack and repository layout

### Stack

- Mobile: Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6, Expo Router, React Native Web, Safe Area Context, SecureStore, Clipboard and Crypto.
- Admin: Next.js 16.4.2 App Router, React 19.3, TypeScript.
- Backend: Python 3.11, FastAPI 0.119, Pydantic 2.14, SQLAlchemy 2.0 synchronous sessions, psycopg 3.2, Alembic, Uvicorn.
- Tooling: Node 24.11.0/npm 11 were used historically; Python 3.11.8 was used historically; pytest, Ruff and Node’s built-in test runner.
- Database: PostgreSQL 17 is the intended runtime. SQLite is not an accepted substitute.

### Folders

```text
apps/mobile/     Expo Router app, session state, onboarding and instructor class UI
apps/admin/      Public Next.js landing/health page; no admin authentication yet
services/api/    FastAPI app, SQLAlchemy models, migrations, identity and classroom modules
services/api/app/models/       58-table SQLAlchemy registry
services/api/app/modules/identity/     username/device-session APIs
services/api/app/modules/classrooms/   Section 05 class APIs and services
docs/             architecture, decisions, schema, contracts and section reports
infra/            optional PostgreSQL Docker Compose setup
scripts/          API/client tests, preview tooling and startup helpers
```

Backend API composition is in `services/api/app/api/v1/router.py`; application lifecycle, CORS, errors and no-store headers are in `services/api/app/main.py`. The runtime is PostgreSQL-only when database operations are needed; no in-memory runtime fallback exists.

## 4. Roadmap status

The numbered allocation in `docs/DEVELOPMENT_PLAN.md` is explicitly provisional. Each supplied section prompt supersedes it, and future work must not be implemented without its prompt.

| Section | Status | Verified scope |
|---|---|---|
| 00 | Complete | Architecture/system analysis and planning documentation only. |
| 01 | Complete | Mobile, admin and FastAPI health/configuration shells. |
| 02 | Complete in source; live DB verification pending | 58 SQLAlchemy tables, frozen initial migration, session/database foundation, storage contracts and ERD. |
| 03 | Complete in source; live PostgreSQL verification pending | Username availability/creation, opaque device sessions, restore and revoke APIs. |
| 04 | Complete in source; native/live DB verification pending | Mobile onboarding, SecureStore session restoration, personal preferences, school/instructor boundaries. |
| 05 | Complete in source; live PostgreSQL/native verification pending | Instructor class creation, secure six-digit codes, list/details/edit/copy/share. |
| 06 | Pending | Authenticated school-student class-code verification, preview, explicit confirmation and enrollment. |
| 07 onward | Pending and prompt-gated | Do not infer implementation from the provisional roadmap. |

The provisional roadmap groups later themes roughly as curriculum/content (09–11), assessment/grading (12–16), progress/notifications (17–19), vocabulary/schedulers (20–22), FSRS/FIFAKT/ESR feasibility (23–25), audio/pronunciation (26–28), conversation (29–30), research (31–36 or the accepted prompt’s later research sections), and final evaluation/accessibility/security/deployment (37–39). These are planning references only, not authorization.

Administrator authentication is explicitly deferred to Section 08 in the accepted Section 01 scope. Research enrollment/randomization/execution was placed in later research sections by the accepted Section 02 prompt; do not move it earlier without a new prompt.

## 5. Section 00 — architecture baseline

Section 00 created the planning baseline and did not create application code, dependencies, database tables, migrations, model downloads, datasets or runtime claims. It established the system boundaries, privacy/research constraints, stack, ten assessment methods, provisional roadmap and unresolved decisions. The original architecture documents remain the source of truth for intended future scope.

## 6. Section 01 — full-stack initialization

### Implemented

- Expo mobile shell under `apps/mobile/src/app`, with welcome, student and instructor placeholders, safe-area layout, theme tokens and reusable UI components.
- Next.js admin public landing page with loading/error boundaries, reusable styling and health diagnostics. No privileged dashboard or admin authentication.
- FastAPI v1 health route, typed settings, explicit CORS, request IDs, safe error envelopes, logging and lazy optional SQLAlchemy engine/session setup.
- Environment examples, independent manifests/lockfiles, `.gitignore`, editor settings and PowerShell startup helper.

### Verified historically

The Section 01 report records passing mobile/admin typecheck/lint/build checks, Expo web and Android bundle exports, browser shell checks, backend tests and API-client tests. These are historical Section 01 results, not evidence of a current native device run.

Reference: `docs/SECTION_01_REPORT.md`.

## 7. Section 02 — PostgreSQL database implementation

### Implemented

- 58 SQLAlchemy entities using UUID keys, foreign keys, timezone-aware timestamps, named constraints/indexes and PostgreSQL JSONB.
- Domains include users/sessions/profiles, classes/memberships/codes, curriculum, assessments, learning/progress/reviews, AI activity, research/private research identity and operations/communications.
- Synchronous database engine/session dependency with explicit transaction ownership, rollback and close behavior.
- Model registry and frozen Alembic revision `services/api/migrations/versions/0001_initial.py` plus offline schema/downgrade SQL.
- Storage validation for exactly ten question methods and student-response shapes.
- PostgreSQL guard functions for publication locks, append-only histories, study protocol locks and conversation retention.
- ERD/schema dictionary in `docs/DATABASE_SCHEMA.md`.

### Verification limitation

The Section 02 report records **46 passed and 18 skipped**. PostgreSQL/Docker/psql infrastructure was unavailable, so live migration, persistence, constraint, JSONB, research-private and downgrade/re-upgrade behavior were not proven. No SQLite substitute was used. The current repository still requires PostgreSQL configuration before live use.

Reference: `docs/SECTION_02_REPORT.md` and `docs/MIGRATIONS.md`.

## 8. Section 03 — usernames and device sessions

### APIs

```text
GET  /api/v1/usernames/check?username=...
POST /api/v1/users
GET  /api/v1/sessions/me
POST /api/v1/sessions/revoke
```

Creation payload:

```json
{"username":"shan123","role":"school_student"}
```

Supported mobile roles: `personal_student`, `school_student`, `instructor`. Public usernames are 3–24 ASCII letters/digits/underscores, no surrounding whitespace; reserved names are rejected. Legacy stored values up to 32 remain supported.

### Security/design

- Credentials are opaque `flt_...` bearer tokens generated with secure randomness; only SHA-256 digests are stored.
- Raw credentials appear only in issuance response and are intended for native SecureStore.
- Creation atomically creates the user, role profile and session. Duplicate canonical usernames return a conflict and never return an existing session.
- Restoration checks token format, digest, expiry, idle/absolute limits, revocation, disabled/archived status and mobile role.
- Rate limiting is bounded, per-peer and process-local; production needs an edge/global limiter and trusted proxy design.

### Verification

The Section 03 report records **107 passed and 26 skipped** at that milestone. Passed tests used repository doubles and static/security checks. PostgreSQL persistence/race tests were skipped because PostgreSQL was unavailable.

Reference: `docs/IDENTITY_AND_SESSIONS.md` and `docs/SECTION_03_REPORT.md`.

## 9. Section 04 — mobile onboarding

### Screens/routes

- `/` welcome with Personal Learning and School Learning choices.
- `/school-role` student/instructor choice.
- `/username?role=...` shared username validation, debounced availability and creation.
- `/grade` and `/language` personal preference screens.
- `/class-code` honest school-student future boundary.
- `/first-class` instructor class form boundary, completed in Section 05.
- `/student` and `/instructor` placeholders/portals.

### Behavior

- Startup reads native SecureStore and validates `GET /sessions/me`; no credential shows welcome.
- Network/503 restore failures hold a retry gate and preserve the credential; 401 clears invalid storage.
- Personal grade and English/Tagalog preferences persist via authenticated `PATCH /api/v1/users/me/preferences`; restoration uses backend values.
- Browser preview deliberately blocks profile creation because native SecureStore is required; no AsyncStorage/localStorage fallback exists.
- Expo Router protected routes and centralized routing prevent invalid role/deep-link access. Repeated create/save actions are guarded; storage failure retains the issued credential in volatile state for secure-save retry without another profile creation.

### Verification

The report records **131 backend tests passed and 27 skipped**, **11 client tests passed**, TypeScript/lint and web/Android exports. Browser preview verified welcome, pathway/username validation, school roles, backend-unavailable retry and protected route behavior. Static/browser preview is not native device or live PostgreSQL verification. Native SecureStore/Android keyboard/back/clipboard behavior remains pending.

Reference: `docs/SECTION_04_REPORT.md`.

## 10. Section 05 — instructor classrooms

### User flow

School Learning → Instructor → username/session → First Class form → authenticated create → server-generated six-digit code → details/confirmation → copy/share → My Classes. Additional classes use the same form. Editing updates allowed metadata without rotating the code.

### Backend APIs

```text
POST  /api/v1/classes
GET   /api/v1/classes/mine?limit=50&offset=0
GET   /api/v1/classes/{class_id}
PATCH /api/v1/classes/{class_id}
```

`POST /classes` requires a UUID `Idempotency-Key` header. Ownership comes from the authenticated session, never request JSON. Class creation validates trimmed name (1–150), strict grade 1–12, `english|tagalog`, and optional trimmed description up to 500. Patch permits metadata updates and protects context-bound grade/language.

### Code and persistence rules

- Codes use `secrets.randbelow(1_000_000)` and `:06d` formatting, preserving leading zeros.
- `class_join_codes.code` is permanently unique across history; inactive codes are not recycled.
- Code allocation has bounded retries/savepoints. Recognized uniqueness collisions retry; unexpected failures roll back the class and completion state.
- `(instructor_id, creation_request_id)` provides idempotent retry identity. Same owner/request/body deduplicates; changed body conflicts.
- Owner-only access is enforced server-side. Other owners/missing classes return generic 404; non-instructor roles are rejected.
- Session/user locking and class writes share one transaction. Class routes use no-store headers and bounded creation throttling.
- `classes.subject_id` became nullable because the approved Section 05 form does not select a curriculum subject. Never infer Filipino from Tagalog.

### Database migration

`services/api/migrations/versions/0002_class_creation.py` is the current head and preserves frozen `0001_initial`. It adds nullable `classes.creation_request_id`, makes `classes.subject_id` nullable, and adds permanent uniqueness for class codes. Historical duplicate codes abort migration for review rather than being deleted or relabeled. Downgrade refuses while null-subject classes exist so records are preserved.

### Mobile implementation

Relevant paths include:

```text
apps/mobile/src/services/api/classes.ts
apps/mobile/src/features/classes/state.ts
apps/mobile/src/features/classes/ClassForm.tsx
apps/mobile/src/features/classes/CodeCard.tsx
apps/mobile/src/app/first-class.tsx
apps/mobile/src/app/instructor.tsx
apps/mobile/src/app/class-details.tsx
apps/mobile/src/app/class-edit.tsx
```

`expo-clipboard` supports copy/share UI and `expo-crypto` supports request UUID generation. The session provider exposes authenticated class access and routes instructors based on actual backend-owned classes, not local completion flags.

### Verification

The final Section 05 report records:

- Backend: **158 passed, 32 skipped**, one Starlette/AnyIO deprecation warning.
- Client/session/API tests: **17 passed** via Node test scripts.
- Mobile TypeScript and ESLint: passed.
- Expo web export and Android Hermes bundle export: passed.
- Static component review used synthetic data and generated `docs/previews/section05-components.png` and `section05-form-bottom.png`; controls were inert and no credentials/API calls were used.
- PostgreSQL integration tests remain skipped because `FLUENTT_TEST_DATABASE_URL` and PostgreSQL infrastructure are unavailable.
- Native device, OS clipboard/share sheet, Android Keystore, keyboard, TalkBack and real authenticated mobile-to-PostgreSQL flows remain unverified.

Reference: `docs/CLASSROOMS.md` and `docs/SECTION_05_REPORT.md`.

## 11. Database and migration state

Migration files currently include:

```text
0001_initial.py          frozen 58-table initial schema
0002_class_creation.py   Section 05 additive classroom changes
```

The application does not create tables at startup. Before online use:

1. Provision PostgreSQL 17 or use the documented `infra/compose.yaml` service.
2. Set a local `FLUENTT_POSTGRES_PASSWORD` for Compose if used.
3. Set `FLUENTT_DATABASE_URL` in ignored `services/api/.env`, using a URL-encoded password.
4. Run `services/api/.venv/Scripts/python -m alembic upgrade head` from `services/api`.
5. Run `services/api/.venv/Scripts/python scripts/check_database.py` and the PostgreSQL tests.

Never downgrade/reset an existing developer or production database for testing. The integration fixture creates and removes only its own UUID-named disposable database and requires `FLUENTT_TEST_DATABASE_URL` with CREATEDB privileges.

## 12. Environment and setup

Prerequisites documented in `README.md`:

- Windows PowerShell.
- Node 24 LTS/npm 11, Python 3.11.
- PostgreSQL 17 for online migration/integration tests.
- Android SDK/JDK and emulator or physical device for native checks.

Initial setup from the repository root:

```powershell
npm --prefix apps/mobile ci
npm --prefix apps/admin ci
python -m venv services/api/.venv
services/api/.venv/Scripts/python -m pip install -r services/api/requirements.lock.txt
Copy-Item apps/mobile/.env.example apps/mobile/.env
Copy-Item apps/admin/.env.example apps/admin/.env.local
Copy-Item services/api/.env.example services/api/.env
```

Important variables (names only; never commit values):

- Mobile: `EXPO_PUBLIC_API_URL` (backend origin, without `/api/v1`). Android emulator normally uses `http://10.0.2.2:8000`; browser uses localhost; physical device uses reachable LAN address.
- Admin: `NEXT_PUBLIC_API_URL`.
- Backend: `FLUENTT_ENVIRONMENT`, `FLUENTT_CORS_ORIGINS`, `FLUENTT_DATABASE_URL`, pool/connect timeout settings, session lifetime settings, identity rate limits and `FLUENTT_CLASS_CREATION_LIMIT`.
- Database setup: `FLUENTT_POSTGRES_PASSWORD`, `FLUENTT_TEST_DATABASE_URL`.

Never place secrets in `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*`; frontend variables are bundled into client code.

Run development processes separately:

```powershell
# API
Set-Location services/api
.venv/Scripts/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --no-access-log

# Admin
Set-Location apps/admin
npm run dev

# Mobile
Set-Location apps/mobile
npm start
```

Useful checks:

```powershell
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile run lint
npm --prefix apps/admin run typecheck
npm --prefix apps/admin run lint
npm --prefix apps/admin run build
Set-Location services/api
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m ruff check app migrations scripts tests
.venv/Scripts/python -m ruff format --check app migrations scripts tests
.venv/Scripts/python -m compileall -q app migrations scripts tests
.venv/Scripts/python -m pip check
Set-Location ../..
node --test scripts/classes.test.mjs scripts/onboarding.test.mjs scripts/api-clients.test.mjs
```

## 13. Testing and known limitations

Latest recorded Section 05 verification is 158 backend tests passed/32 skipped and 17 client tests passed. The current checkout has not been re-tested as part of this handoff task; do not treat the handoff creation as a fresh test run.

Known limitations:

- No PostgreSQL service, Docker, psql or live migration was available in the original work environment. The new laptop must independently configure and verify PostgreSQL.
- No native Android/iOS device test was completed. Bundle export is not device execution.
- Copy/share tests inject ports and do not prove OS integration.
- Mobile dependency audit previously reported 27 findings (8 moderate, 19 high); forced remediation was deliberately not applied because it could break Expo/React/Next compatibility. Reassess advisories before deployment.
- Backend tests emit an upstream Starlette/AnyIO deprecation warning; Node tests emit module-type inference warnings.
- The current uncommitted `apps/mobile/package-lock.json` change must be investigated before any new commit or push.
- Existing documentation contains some historical paths and milestone wording from the original PC; prefer the current repository path and current Git state.

## 14. Exact Section 06 handoff

Section 06 is **not implemented**. It must be implemented only after receiving/reading the authoritative Section 06 prompt and then re-reading `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/CLASSROOMS.md`, the current mobile class-code boundary, and the classroom/session backend.

Expected Section 06 boundary from Section 05 documentation and available context:

- Authenticated school students enter a six-digit string code after creating/restoring a username/session.
- The backend must verify the code without treating it as identity or consent.
- Provide a limited class preview before enrollment and require explicit confirmation.
- Enrollment must be transactional, ownership/role/status/expiry checked, and protected against duplicate enrollment and abuse/rate-limit attacks.
- Student enrollment should not expose private data, roster details, answer keys or research information.
- Existing class codes are six-digit strings with leading zeros preserved. Do not generate codes on the client.
- Do not alter instructor class ownership or code permanence to implement enrollment.
- Reuse authenticated session/transaction/locking patterns; do not authenticate in one unchecked transaction and mutate in another.
- Restore school-student routing from backend enrollment/completion state, not a local flag or route parameter.
- Add PostgreSQL conditional integration coverage for code lookup, expiry/status, duplicate/concurrent enrollment and transaction rollback. Do not call skipped tests passed.
- Add appropriate client/state tests and honest web/native limitations.

Before Section 06 coding, the next agent should:

1. Confirm the current path, Git status and the uncommitted package-lock diff.
2. Read the authoritative Section 06 prompt; do not use this handoff as permission to implement it.
3. Read `docs/CLASSROOMS.md`, `docs/IDENTITY_AND_SESSIONS.md`, relevant models (`users.py`, class/membership/code definitions), classroom repository/service/router, session provider and `class-code.tsx`.
4. Verify migration head and inspect whether PostgreSQL is available. Do not downgrade existing databases.
5. Preserve `0001_initial` and `0002_class_creation`; create a new migration only if the Section 06 prompt requires schema changes.
6. Define the smallest backend contract first, with ownership, code lookup, role checks, class status/expiry and transaction semantics.
7. Keep student preview limited and avoid any enrollment success claim until the backend transaction commits.
8. Run backend/client tests, typecheck/lint and bundle checks; report PostgreSQL/native skips precisely.
9. Stop at the Section 06 boundary and update its report without beginning later curriculum/assessment work.

## 15. Warnings for the next Codex agent

- Read all applicable `AGENTS.md` files. `apps/mobile/AGENTS.md` has additional Expo SDK 58/documentation requirements.
- Implement only the user-supplied section. A roadmap row or this handoff is not authorization for later sections.
- Do not rebuild or replace the repository. Preserve existing behavior and migrations.
- Do not modify `0001_initial.py`; applied migrations are immutable. Use additive revisions.
- Do not add SQLite or in-memory runtime fallbacks. In-memory repositories are test-only.
- Do not infer subject from Tagalog, use class code as authentication, restore by username, or put credentials in URLs, route params, logs, clipboard/share text or browser storage.
- Do not expose credentials, private answer keys, research identities, rosters or sensitive metadata.
- Do not claim PostgreSQL, native device, Keystore, OS clipboard/share, production or research behavior without actual evidence.
- Do not run broad cleanup/reset/delete commands. Do not downgrade or reset an existing database.
- Keep security settings and CORS scoped; no wildcard production CORS.
- Preserve server-side authorization and object ownership; UI route guards are not security boundaries.
- Keep codes as strings so leading zeros survive every API/UI boundary.
- Inspect and resolve the current package-lock modification deliberately before publishing more changes.

## 16. Source-of-truth index

- Rules: `AGENTS.md`, `apps/mobile/AGENTS.md`, `apps/admin/AGENTS.md`.
- Architecture/decisions: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`.
- Roadmap: `docs/DEVELOPMENT_PLAN.md` (provisional only).
- Database: `docs/DATABASE_SCHEMA.md`, `docs/MIGRATIONS.md`.
- Identity: `docs/IDENTITY_AND_SESSIONS.md`.
- Classes: `docs/CLASSROOMS.md`.
- Milestones: `docs/SECTION_01_REPORT.md` through `docs/SECTION_05_REPORT.md`.
- API design/ten methods: `docs/API_DESIGN.md`.
- Setup: `README.md`, `infra/compose.yaml`, `.env.example` files.

## Handoff completion

This document records the project through Section 05. The next agent should verify the current checkout and obtain the authoritative Section 06 prompt before making code changes.
