# Section 04 implementation report

Implemented only mobile onboarding and the minimal personal preference contract. No class creation, enrollment, curriculum, AI or administrator features were implemented. No production deployment or real user data was created.

## Screens and navigation

A root startup/session-loading gate reads Expo SecureStore and validates GET /sessions/me. Read/connection failures keep an explicit Retry gate and preserve credentials. Invalid/expired/revoked HTTP 401 clears local storage before returning to welcome. No credential means welcome.

| Screen | Route | Behavior |
|---|---|---|
| Welcome / pathway choice | / | Distinct personal and school choices, existing FLUENTT theme |
| School role | /school-role | Student/instructor only, explicit role explanations |
| Unique username | /username?role=… | Shared validation, debounced availability, retry, race conflict and single-flight creation |
| Grade | /grade | Grade 1–12; backend persistence before advancing |
| Language | /language | English/Tagalog; backend persistence before student placeholder |
| School class code | /class-code | Exactly six ASCII digits as a string, preserves leading zeros; Section 06 boundary |
| First class | /first-class | Name, grade, language draft; Section 05 boundary, no saved claim/code |
| Student placeholder | /student | Saved setup and explicit future dashboard status |
| Instructor placeholder | /instructor | Available only when backend marks instructor active in a future section |

Personal restoration is based on returned preferences: missing grade -> grade, missing language -> language, both present -> student. School/instructor onboarding profiles stay at their boundary; active profiles use their portal. Protected Expo Router screens remove creation history after secure session installation and restrict cross-role routes/deep links. Back is available before creation; native Back and gestures are blocked during issuance/storage retry. Saved setup steps are not put back on the creation stack. At the authenticated root, Android Back follows normal exit behavior; this needs device verification.

## API and storage

Integrated real GET /usernames/check, POST /users, GET /sessions/me and new PATCH /users/me/preferences. The existing revocation API is preserved; no logout/change-user flow existed, so no such action was added. Shared identity API service handles timeouts, connectivity, 401/409/422/429/503 and malformed profile roles. Availability is advisory; POST conflict invalidates availability. Repeated taps cannot issue concurrent POSTs.

PATCH accepts optional non-null grade (strict integer 1–12) and language (english/tagalog), rejects extra fields and authorizes only the credential's personal_student. Authentication, session/user locks, preferences and completion status are one transaction. It reuses learner_profiles fields; PostgreSQL upserts missing standard Grade N reference labels by unique number without replacing existing IDs/names. No curriculum content or migration is added. GET /sessions/me and issuance include nullable grade/language. Both saved values set personal status active and clear onboarding_step.

Credentials use Expo SecureStore on Android/iOS, never route parameters, AsyncStorage, browser storage or logs. Failed secure persistence retains issuance only in memory and retries storage without another POST. Closing the app before successful secure persistence can lose access; username-based recovery remains unsupported. Creation with an existing device credential is blocked. Network failure during restoration does not start another account. The web build explicitly blocks profile creation before POST because native SecureStore is unavailable; it is a navigation preview.

Class code/name/grade/language boundary drafts are unsaved. They validate input and display explicit not-implemented feedback. They do not call a fake API or simulate a loading/success response. Real loading, verification, confirmation and server errors belong to Sections 05/06.

## Validation

- Backend pytest: **131 passed, 27 skipped**, one upstream Starlette/AnyIO deprecation warning. Includes 24 added preference cases for all grades, languages, completion, restoration, invalid fields, own-user scoping, revoked credentials and school-role rejection. Existing identity/security/schema tests pass. The added live PostgreSQL preference test is among skipped cases.
- Backend Ruff check and format check: passed (49 files). Python compilation and pip dependency check passed.
- Mobile TypeScript and ESLint: passed.
- Node service/session tests plus existing health-client tests: **11 passed**, covering routing, first launch, restoration, expired/network sessions, single-flight issuance, secure-save retry, SecureStore adapter, web fail-closed behavior, all roles, validation, API errors, timeout and malformed backend roles. Node prints a non-failing module-type warning; no application module-format change was needed.
- Expo web export: passed. Android Hermes export: passed. An initial sandbox Hermes invocation failed; the same export outside the restricted temporary directory succeeded. Metro rebuilt an unreadable cache successfully. These exports are compilation checks, not device tests.
- Browser: welcome -> personal username verified; invalid short username disables creation and shows validation. School choice -> student username and instructor username checked with correct role labels. Real no-database backend availability failure and Retry checked. Protected direct access without a credential returns to welcome. Screenshots in docs/previews (web viewport, not an Android screenshot).
- Expo SecureStore was installed via Expo's SDK-compatible installer (~58.0.2), with config plugin. Installation audit reported 27 vulnerabilities (8 moderate, 19 high) across the dependency tree; no force upgrades were applied. This is not a clean dependency-security audit.

PostgreSQL is not configured here. No live persistence, migration, uniqueness-race or real successful mobile account creation is claimed. No physical Android/emulator keyboard, native secure storage or native Back interaction was executed. Automated storage uses an injected port; it does not prove Android Keystore behavior.

## Exact remaining device verification

1. Use the PostgreSQL setup in README and docs/MIGRATIONS; set FLUENTT_DATABASE_URL and apply `alembic upgrade head` from services/api using its virtual environment. Run the disposable PostgreSQL suite with FLUENTT_TEST_DATABASE_URL configured as documented (never point it at an existing application database).
2. Start the API via scripts/start.ps1 api. Set apps/mobile/.env EXPO_PUBLIC_API_URL to http://10.0.2.2:8000 for the Android emulator, or the computer's reachable LAN address for a phone; restart Metro after changing it.
3. Run a native development build with `npx expo run:android` from apps/mobile after installing Android tooling, or configure an EAS development profile and use `npx eas-cli@latest build --profile development --platform android`. No EAS profile/project is provisioned by this section.
4. On a clean app installation, choose Personal. Check invalid/reserved/taken names, then create a synthetic unique profile. Tap Continue repeatedly during a slow connection; verify only one user/session is created. Save grade 1 and English. Relaunch after creation, after grade, and after language; expect grade, language, student respectively. Repeat with grade 12 and Tagalog.
5. Stop the API before relaunch with an existing credential: expect Retry, never welcome/new creation. Restart API and retry. Revoke that synthetic session via the authenticated backend, then relaunch: expect local credential deletion and welcome. Do not place a real token in logs, screenshots or saved test files.
6. On separate clean test installations, create school_student and instructor profiles. Relaunch: expect class-code and first-class. Code 000001 remains six digits; malformed/short codes fail; valid code cannot enroll yet. Instructor drafts cannot create a class/code or open the dashboard.
7. At 320–360 logical pixel width, landscape and increased font size, open each input with Android keyboard, scroll to actions, use TalkBack labels/selected states, and verify no blocked controls or clipping. Press hardware Back before creation and after each saved step: creation screens must not reappear after account creation. Test interruption/rotation/kill and reopen.
8. Exercise a SecureStore failure in a test build/injected storage harness: first save fails after issuance, Retry saves the same credential with no second POST. Do not force-close before saving unless explicitly testing the documented recovery limitation.

## Complete Section 04 file inventory

Paths below are repository-relative for this inventory. Git has no baseline commit and all project source remains untracked from previous sections; this is a section-specific inventory, not a git-diff claim.

Added:
- apps/mobile/src/app/school-role.tsx
- apps/mobile/src/app/username.tsx
- apps/mobile/src/app/grade.tsx
- apps/mobile/src/app/language.tsx
- apps/mobile/src/app/class-code.tsx
- apps/mobile/src/app/first-class.tsx
- apps/mobile/src/components/onboarding.tsx
- apps/mobile/src/services/api/identity.ts
- apps/mobile/src/session/controller.ts
- apps/mobile/src/session/provider.tsx
- apps/mobile/src/session/routing.ts
- apps/mobile/src/session/vault.ts
- scripts/onboarding.test.mjs
- docs/SECTION_04_REPORT.md
- docs/previews/section04-welcome.png
- docs/previews/section04-school-role.png
- docs/previews/section04-backend-unavailable.png

Modified:
- apps/mobile/package.json
- apps/mobile/package-lock.json
- apps/mobile/app.json
- apps/mobile/src/app/_layout.tsx
- apps/mobile/src/app/index.tsx
- apps/mobile/src/app/student.tsx
- apps/mobile/src/app/instructor.tsx
- apps/mobile/src/components/ui.tsx
- services/api/app/modules/identity/schemas.py
- services/api/app/modules/identity/router.py
- services/api/app/modules/identity/repository.py
- services/api/app/modules/identity/session_service.py
- services/api/tests/identity_support.py
- services/api/tests/test_identity_api.py
- services/api/tests/integration/test_identity_postgresql.py
- AGENTS.md
- README.md
- docs/ARCHITECTURE.md
- docs/DECISIONS.md
- docs/IDENTITY_AND_SESSIONS.md
- docs/MIGRATIONS.md

Generated ignored outputs: Expo dist/.expo and normal package caches. Temporary implementation scripts and export log were removed. Existing assets/admin/schema migrations are preserved.

## Next boundary

Section 05 must add the actual owned classroom creation contract and transaction, required subject/context configuration, server-generated six-digit code and backend onboarding completion, then wire the existing first-class draft to it. Section 06 must add authenticated code verification, class preview/explicit confirmation and enrollment before marking school students active. No future section has been started.

SECTION 04 COMPLETE — READY FOR SECTION 05
