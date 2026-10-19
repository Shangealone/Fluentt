# FLUENTT

Section 25 adds persisted class announcements and bounded instructor–student direct messages. Open **Class communication** from instructor/class details or the school student's My Classes card. Current class access is required; text is immutable after send, retries reuse request IDs, and read marking is private to the viewer. Manual refresh only. Migration 0012_class_communication preserves existing message destinations/history (63 tables). See docs/COMMUNICATIONS.md, docs/SECTION_25_REPORT.md and docs/OCT_21_DEMO_CHECKLIST.md. Real OIDC remains disabled and the normal local database has no published curriculum/questions/assignments; the passed synthetic backend smoke does not make the hands-on demo ready.

Section 24 adds instructor monitoring: open **Monitor class progress** from the instructor dashboard or class details. Browse current eligible students, student class history, published assignment submission counts and explicitly released objective results. Assignment means use only comparable released results from that exact version; no cross-class grades, mastery or research analytics. See docs/INSTRUCTOR_MONITORING.md and docs/SECTION_24_REPORT.md. No migration or dependency change; head remains 0011_result_release (63 tables). Earlier milestone exclusions are historical.

Section 23 adds student submission progress and learning history: open the dashboard's Progress and learning history link, or My Classes → View this class learning history. Real server counts distinguish not started/in progress/submitted; filter records by class, status or local calendar dates. Only released pinned evaluations show objective totals. Counts are not mastery or academic grades; personal tracking remains explicitly unavailable. No migration is needed (head 0011_result_release, 63 tables). See docs/PROGRESS.md and docs/SECTION_23_REPORT.md. Earlier milestone exclusions remain historical.

Section 22 adds real assessment results: students open My Classes → Published assignments → Results; instructors open their class assignments → Results and release for a published assignment. Current-member authorization and explicit instructor release protect objective totals and readonly original-answer review. Administrator-only grading runs separately; no scores appear automatically and expected answers/private feedback/card backs stay hidden. Release/withdraw/re-release preserves immutable evaluation history. Head 0011_result_release (63 tables). See docs/RESULTS_AND_FEEDBACK.md and docs/SECTION_22_REPORT.md. Earlier section scope notes are historical.

Section 21 adds backend-only internal objective grading through explicit administrator grading.read/run permissions. Nine methods use the approved exact-match/equal-point policy; Flashcards are not objectively scored. Versioned immutable results preserve submitted captures, with manual/unsupported states and no student result release or grading-on-submit. Head is 0010_grading_results (62 tables). See docs/GRADING.md and docs/SECTION_21_REPORT.md; client workflows below remain unchanged.

Section 20 adds school-student assignment taking: My Classes → published assignment → Start, resume or view submitted receipt. All ten methods use existing widgets; Save progress is explicit, incomplete final submission is confirmed, and Flashcard backs require deliberate reveal. One unscored attempt, no timer/retakes/automatic grading/scheduler or research. Head is 0009_response_capture. See docs/ASSIGNMENTS.md and docs/SECTION_20_REPORT.md; earlier exclusions below are historical.

Section 19 adds confirmed instructor publication and school-student published-assignment metadata: instructors open a saved draft and choose Review and publish; students use My Classes → View published assignments. Live membership controls access, including later joiners. Published versions are immutable, with no question answering, attempts, scores or notifications. Head is 0008_assignment_publication. See docs/ASSIGNMENTS.md and docs/SECTION_19_REPORT.md; earlier milestone exclusions below are historical.

Section 18 adds instructor assignment drafts from owned class details: choose a published lesson and exact question versions, preview/add/reorder/remove, save/edit or archive. Drafts stay private; no publishing, student attempts or scoring. Migration head is 0007_assignment_drafts. See docs/ASSIGNMENTS.md and docs/SECTION_18_REPORT.md for contracts, evidence and Section 19 prerequisites.

Section 17 added Flashcards authoring, administrator reveal and component-only local recall. All ten methods have interfaces; practice persistence remains OPEN. See docs/VOCABULARY.md and docs/SECTION_17_REPORT.md.

Section 16 added Matching Type authoring and reusable unscored matching controls; its historical scope/evidence is recorded in docs/SECTION_16_REPORT.md.

Section 15 added Word/Sentence Arrangement authoring and unscored sequencing controls; its historical scope/evidence is recorded in docs/SECTION_15_REPORT.md.

Section 14 adds Multiple Select and Error Identification to **/questions** and reusable Expo checkbox/segment previews. Existing versioned APIs and permissions are reused; no grading or learner delivery is added. See docs/QUESTION_BANK.md and docs/SECTION_14_REPORT.md for approved contracts, verification and Section 15 readiness.

Section 13 extends **/questions** to Identification/Fill in the Blank authoring and safe previews, plus reusable Expo text-entry components. Optional Unicode input limits and explicitly tagged gap templates preserve legacy items and raw responses. No learner delivery or grading is added; real OIDC sign-in still requires configuration. See docs/QUESTION_BANK.md and docs/SECTION_13_REPORT.md for contracts, verification and Section 14 readiness.

Section 12 adds the protected administrator **/questions** page for Multiple Choice/True or False authoring and unscored previews, plus reusable Expo selection components. It reuses the Section 11 backend and permissions; migration head remains 0006. Real OIDC sign-in still needs configuration. No student assessment route, submission or grading is included. See docs/QUESTION_BANK.md and docs/SECTION_12_REPORT.md for usage, checks and remaining verification limits.

Section 11 implements the versioned administrator question-bank backend for all ten existing methods. See docs/QUESTION_BANK.md for endpoints/operator grants, draft/publish/retire rules and deferred scoring/delivery policies; docs/SECTION_11_REPORT.md records verification. Source migration head is 0006_question_associations. No question-authoring website, student assessment delivery or grading is included. Earlier section status/head notes below are historical.

Section 10 administrator curriculum management is implemented at `/curriculum`, with real backend CRUD/publishing and explicit operator-granted permissions. OIDC sign-in still requires local provider/MFA configuration; no development bypass or seeded administrator is supplied. See docs/CURRICULUM.md for workflows/operator commands and docs/SECTION_10_REPORT.md for verification and remaining activation gates.

Local database verification is now configured: PostgreSQL on localhost:55432, migrated through 0005_constraint_names. Start this isolated cluster with `./scripts/local-postgres.ps1 start`, then run `./scripts/start.ps1 api`. The ignored API .env contains its local URL; do not share/commit it. Run `./scripts/start.ps1 admin` and `./scripts/start.ps1 mobile` in separate terminals. Administrator sign-in intentionally remains disabled until a real OIDC/MFA provider is configured. See docs/LOCAL_VERIFICATION_REPORT.md for verification results and docs/MIGRATIONS.md for the required explicit fresh-database bootstrap repair. Older setup/milestone notes below remain historical.

Section 09 adds backend curriculum structure/competency reads and immutable curriculum snapshots, with no authoring screens or learning delivery. See [curriculum contracts](docs/CURRICULUM.md) and [Section 09 verification](docs/SECTION_09_REPORT.md). Source head is 0004_curriculum_snapshots; 60 tables remain. PostgreSQL bootstrap repair/verification and OIDC activation are still prerequisites for live use. Earlier milestone paragraphs below are historical.

Section 08 adds administrator OIDC/MFA integration, operator-only provisioning and protected Next.js access. Sign-in deliberately stays disabled until a provider/client/accepted MFA policy is configured. See [administrator setup and security](docs/ADMIN_AUTH.md) and [Section 08 verification](docs/SECTION_08_REPORT.md). PostgreSQL migration 0003 and real provider/TLS verification remain activation prerequisites; no admin account or credential is bundled.

Development foundation through Section 07 for NE Learning Inc.: Expo mobile identity/onboarding, instructor classes, student enrollment and role-based dashboards/account navigation, a public Next.js administrator placeholder, FastAPI and SQLAlchemy/Alembic. Assignment delivery, administrator authentication and AI remain future work. Live PostgreSQL and native end-to-end verification remain pending. Earlier section descriptions below record their milestone scope; see docs/SECTION_07_REPORT.md for current results.

## Prerequisites

Windows PowerShell, Node.js 24 LTS (tested 24.11.0), npm 11 and Python 3.11 (tested 3.11.8). Android testing needs a running emulator or a compatible Expo Go/development build on a physical phone. PostgreSQL 17 setup is documented in docs/MIGRATIONS.md; it is required for online migrations and database integration tests.

## First-time setup (from this folder)

```powershell
npm --prefix apps/mobile ci
npm --prefix apps/admin ci
python -m venv services/api/.venv
services/api/.venv/Scripts/python -m pip install -r services/api/requirements.lock.txt
Copy-Item apps/mobile/.env.example apps/mobile/.env
Copy-Item apps/admin/.env.example apps/admin/.env.local
Copy-Item services/api/.env.example services/api/.env
```

Each application owns its dependencies and lockfile. No global Expo install is needed. Environment templates contain examples only; never put secrets in EXPO_PUBLIC_* or NEXT_PUBLIC_* variables because those are bundled into frontend code.

## Run in three separate PowerShell terminals

Backend:

```powershell
Set-Location C:\Users\shang\Desktop\Fluent\services\api
.venv/Scripts/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --no-access-log
```

Administrator website:

```powershell
Set-Location C:\Users\shang\Desktop\Fluent\apps\admin
npm run dev
```

Mobile:

```powershell
Set-Location C:\Users\shang\Desktop\Fluent\apps\mobile
npm start
```

Open http://localhost:3000 for the administrator landing page and http://localhost:8000/docs for development API documentation. Health: http://localhost:8000/api/v1/health returns {"status":"ok","service":"fluentt-api"}. It reports application liveness only; PostgreSQL is not connected. In Expo press A for the Android emulator, scan the QR code for a physical device, or run `npm run web` for a browser preview. Native Android validation: `npx expo run:android` (Android SDK/JDK setup required). Future signed production builds need separate EAS configuration, package identifiers, HTTPS hosting and secrets configuration; none are deployed here.

## Backend URL and CORS

Set EXPO_PUBLIC_API_URL in apps/mobile/.env to the backend origin (no /api/v1 suffix). Android Studio emulator: http://10.0.2.2:8000. Browser preview: http://localhost:8000. Physical phone: http://YOUR-PC-LAN-ADDRESS:8000 on an accessible shared network. A phone's localhost is the phone, not this PC. No developer-specific IP is committed. Windows Firewall may need an inbound development rule for port 8000 on your private network. Restart Expo after changing environment values.

Set NEXT_PUBLIC_API_URL in apps/admin/.env.local (default http://localhost:8000), then restart Next.js. Production public variables are embedded at build time. Both clients time out after eight seconds and validate the health response. Mobile diagnostics are development-only; the public administrator page exposes only health status and has no privileged actions.

FLUENTT_CORS_ORIGINS is a JSON array of exact browser origins, defaulting to http://localhost:3000 and http://localhost:8081. Add the exact LAN/browser preview origin when needed; no wildcard origins. Native mobile networking is not governed by browser CORS. FLUENTT_ENVIRONMENT accepts development/test/production. Configuration fails fast for invalid origins or a non-PostgreSQL database URL. Leave FLUENTT_DATABASE_URL unset for Section 01; a configured SQLAlchemy engine is lazy and never creates tables or claims connectivity.

## Checks

```powershell
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile run lint
npm --prefix apps/admin run typecheck
npm --prefix apps/admin run lint
npm --prefix apps/admin run build
Set-Location services/api
.venv/Scripts/python -m pytest
.venv/Scripts/python -m ruff check app tests
.venv/Scripts/python -m ruff format --check app tests
```

Mobile bundle checks (from apps/mobile): `npx expo export --platform web` and `npx expo export --platform android`. These do not validate native rendering on a device. See docs/SECTION_01_REPORT.md for actual results and the file inventory.

## Structure

```text
apps/mobile/       Expo Router app and reusable src components/services/theme
apps/admin/        Next.js App Router and reusable src components/services/styles
services/api/      FastAPI app, configuration, lazy database engine and tests
docs/              Architecture, decisions and implementation reports
scripts/           Development helpers
```

Section 02 provides PostgreSQL entities and migrations; live validation remains pending local database setup. Administrator authentication is explicitly scheduled for Section 08 by the Section 01 prompt. Read AGENTS.md and docs/DECISIONS.md before later work.

Frontend API-client checks (Node 24, from repository root): `node --test scripts/api-clients.test.mjs`. These exercise success, malformed responses, HTTP/network errors, timeouts and missing configuration for both clients.

## Section 02 database work

The backend now contains SQLAlchemy models, a complete database dictionary/ERD, a frozen initial Alembic revision and synchronous session dependency. See [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md), [MIGRATIONS.md](docs/MIGRATIONS.md) and [SECTION_02_REPORT.md](docs/SECTION_02_REPORT.md). PostgreSQL infrastructure is not installed/configured in this workspace; no live migration or database integration test has passed yet. Earlier Section 01 notes describe the state at that milestone.

Quick migration commands after local PostgreSQL setup and configuring FLUENTT_DATABASE_URL (from services/api):

```powershell
.venv/Scripts/python -m pip install -r requirements.lock.txt
.venv/Scripts/python scripts/check_database.py
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m alembic current
.venv/Scripts/python -m alembic history
```

The optional local service is infra/compose.yaml. Follow MIGRATIONS.md for password configuration and exact Docker/native setup commands. No secret is committed and no database service starts automatically. Tests use FLUENTT_TEST_DATABASE_URL only to create a fresh UUID-named disposable database; never point this at production. In services/api run `.venv/Scripts/python -m pytest -q` (PostgreSQL tests skip without test infrastructure).


## Section 03 identity APIs

The backend now implements unique public username creation and device-session restoration/revocation. See [IDENTITY_AND_SESSIONS.md](docs/IDENTITY_AND_SESSIONS.md) for exact requests, status codes, secure mobile storage expectations and recovery limitations. The Section 02 schema is reused unchanged; PostgreSQL must be configured and migrated before these endpoints can persist profiles. Without it they return 503 rather than simulated success. Onboarding screens and SecureStore integration remain Section 04 work.

Implemented routes: GET /api/v1/usernames/check, POST /api/v1/users, GET /api/v1/sessions/me, POST /api/v1/sessions/revoke. New public usernames allow 3–24 ASCII letters/digits/underscores without whitespace; older stored names up to 32 remain intact. Administrators cannot be registered through this mobile API. No traditional password login exists.


## Mobile onboarding (Section 04)

The app checks its secure device session on startup. Personal learners save grade and English/Tagalog through the API. School students now join classes through Section 06 verification/confirmation; instructors create classes through Section 05. All real creation/restoration requires configured PostgreSQL and native SecureStore.

Use the Android/iOS app for actual profile creation: the browser build is a navigation preview and intentionally cannot save device credentials. Expo SecureStore is configured through app.json. For a development build use `npx expo run:android` with the Android toolchain, or `npx eas-cli@latest build --profile development --platform android` after configuring EAS. No native project directories are created by hand. Follow the existing API/PostgreSQL setup first; health success alone does not mean identity storage is ready. On a physical phone, EXPO_PUBLIC_API_URL must use your development computer's reachable LAN address, and the API must bind to 0.0.0.0. Production uses HTTPS.

Run `node --test scripts/onboarding.test.mjs scripts/api-clients.test.mjs` from the repository root (Node 24). Full verification and a device checklist are in docs/SECTION_04_REPORT.md.

## Instructor classes (Section 05)

Instructors can create their first/additional classes, view invitation codes, copy/share them, list My Classes and edit permitted metadata. Configure PostgreSQL and run `alembic upgrade head` from services/api first; head is now 0002_class_creation. The API always derives the owner from the device session. Class requests need a UUID Idempotency-Key header; the mobile app supplies and reuses it on interrupted saves. Class codes remain six-digit strings and never authenticate accounts.

The additive migration preserves existing class/subject data and prevents historical code reuse. If historical codes are duplicated, upgrade stops for review rather than deleting records. Curriculum subject is configured separately from learning language. See docs/CLASSROOMS.md and docs/SECTION_05_REPORT.md for API examples, migration conditions and native verification steps. Student verification/enrollment remains Section 06.

Additional tests: `node --test scripts/classes.test.mjs scripts/onboarding.test.mjs scripts/api-clients.test.mjs` from the root. `node scripts/preview-classes.cjs` generates a clearly labeled static visual review using synthetic data; its controls are inert and it is not an authenticated app/test backend.

## Student enrollment (Section 06)

Authenticated school students verify a six-digit invitation code, review limited class context, explicitly join, and see their backend memberships in My Classes. Multiple active classes are supported. Students who left may rejoin with a new historical row; instructor removal blocks self-rejoining. Personal/instructor flows retain existing behavior. Web remains a navigation preview; native SecureStore is required for real onboarding.

Endpoints: POST /api/v1/class-enrollment-previews, POST /api/v1/class-memberships, GET /api/v1/class-memberships/mine. GET /sessions/me derives school completion from eligible database memberships. No new migration; head is 0002_class_creation. See docs/ENROLLMENT.md and docs/SECTION_06_REPORT.md. Configure PostgreSQL and use the existing migration instructions before live use.

Run `node --test scripts/enrollment.test.mjs scripts/classes.test.mjs scripts/onboarding.test.mjs scripts/api-clients.test.mjs` from the root, plus backend pytest and mobile typecheck/lint/exports. Current machine: Node 24.21.0/npm 11.19.0 and an existing Python 3.14.8 virtual environment, differing from the documented Python 3.11 baseline. No system tools were installed or dependency versions changed for Section 06. The current checks do not establish Python 3.11 equivalence, PostgreSQL persistence or native device behavior.

Section 07's prompt is available, but implementation waits for user acceptance of Section 06. PROJECT_HANDOFF.md remains the preserved handoff snapshot through Section 05.

## Section 07 mobile dashboards

Personal learners see saved preferences and can edit them through the existing API. School students select among their real memberships; instructors use their owned-class dashboard and existing creation/details/editing. My account provides a confirmed, server-revoked sign-out with secure cleanup and explicit recovery limitations. Loading/errors/refresh and late-response handling are shared; future learning features are labeled upcoming.

Run `node --test scripts/navigation.test.mjs scripts/dashboard-components.test.cjs scripts/enrollment.test.mjs scripts/classes.test.mjs scripts/onboarding.test.mjs scripts/api-clients.test.mjs` from the repository root. Section 07 results, native/database limits and the file inventory are in docs/SECTION_07_REPORT.md. No package, migration or backend endpoint was added. Stop for approval before Section 08.
