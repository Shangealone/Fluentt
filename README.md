# FLUENTT

Development foundation through Section 03 for NE Learning Inc.: React Native/Expo mobile, Next.js administrator placeholder, FastAPI backend and SQLAlchemy/Alembic database schema. Mobile identity APIs are implemented; frontend onboarding, enrollment, assignments, admin authentication and AI features remain future work. The database schema has not been applied to live PostgreSQL in this environment.

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

The app now checks its secure device session on startup. Personal learners create a unique username, then save grade and English/Tagalog through the API. School students and instructors create a profile and reach explicit class joining/creation boundaries; those APIs arrive in Sections 06 and 05 respectively.

Use the Android/iOS app for actual profile creation: the browser build is a navigation preview and intentionally cannot save device credentials. Expo SecureStore is configured through app.json. For a development build use `npx expo run:android` with the Android toolchain, or `npx eas-cli@latest build --profile development --platform android` after configuring EAS. No native project directories are created by hand. Follow the existing API/PostgreSQL setup first; health success alone does not mean identity storage is ready. On a physical phone, EXPO_PUBLIC_API_URL must use your development computer's reachable LAN address, and the API must bind to 0.0.0.0. Production uses HTTPS.

Run `node --test scripts/onboarding.test.mjs scripts/api-clients.test.mjs` from the repository root (Node 24). Full verification and a device checklist are in docs/SECTION_04_REPORT.md.

## Instructor classes (Section 05)

Instructors can create their first/additional classes, view invitation codes, copy/share them, list My Classes and edit permitted metadata. Configure PostgreSQL and run `alembic upgrade head` from services/api first; head is now 0002_class_creation. The API always derives the owner from the device session. Class requests need a UUID Idempotency-Key header; the mobile app supplies and reuses it on interrupted saves. Class codes remain six-digit strings and never authenticate accounts.

The additive migration preserves existing class/subject data and prevents historical code reuse. If historical codes are duplicated, upgrade stops for review rather than deleting records. Curriculum subject is configured separately from learning language. See docs/CLASSROOMS.md and docs/SECTION_05_REPORT.md for API examples, migration conditions and native verification steps. Student verification/enrollment remains Section 06.

Additional tests: `node --test scripts/classes.test.mjs scripts/onboarding.test.mjs scripts/api-clients.test.mjs` from the root. `node scripts/preview-classes.cjs` generates a clearly labeled static visual review using synthetic data; its controls are inert and it is not an authenticated app/test backend.
