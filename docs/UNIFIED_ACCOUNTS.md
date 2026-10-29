# Unified accounts and local verification

Personal learners, students, and teachers use /auth to sign in or create an account. The server returns the account role and onboarding state. Old /login, /username and /school-role links lead into the shared page. New registrations require a password of 6–128 characters. Existing passwordless accounts may add a password only through an already authenticated session. Password recovery and role conversion are not implemented.

## Student registration and class codes — 2026-10-29

On the unified create-account page, selecting Student shows a six-digit class-code step before the account fields. The page requests a read-only class preview; it creates no account, profile, session or enrollment. The code stays in memory and is never placed in a URL or browser storage.

Both browser and Android registration requests require the code and preview version. The API locks and rechecks the invitation and class details, then creates the user, profile, session, class membership and `class.enrolled` audit record in one transaction. A missing, invalid, expired, revoked or changed invitation cannot leave a new account behind. On success, the student is enrolled and routes directly to the class dashboard. Personal learner and teacher registration are unchanged.

Existing onboarding Student accounts remain intact; those students can sign in and complete enrollment on `/class-code` using the existing preview-and-confirm flow.

## Personal setup design — 2026-10-29

`/language` and `/experience` share the approved compact account design, logo, warm colours, illustrated headers and accessible choice cards. Step 1 selects English or Tagalog. Step 2 selects a starting practice preference: Easy, Medium or Challenging, rather than reporting measured proficiency.

The existing API fields are unchanged. Easy saves `starting_fresh`, Medium saves `simple_conversations`, and Challenging saves `comfortable`. A saved `some_words` value displays Easy and is retained when Easy is saved for that language. The API still restores each language’s own saved experience; no existing account is converted and no migration is required. Selections are local until Continue or Start learning; failed saves retain the choice and do not advance.

Step 2 Back returns to language selection. Step 1 Back returns completed personal learners to Home, learners with a saved language but no starting point to Step 2, or asks first-time learners to confirm sign-out to the start screen. Back listeners apply only to the focused setup screen, and late save results cannot navigate away from another screen.

## Local operation

The configured local version-2 database is an isolated PostgreSQL 17 cluster under private-data/auth-local on port 55432. The older system databases had incompatible schemas and were not altered or imported. Accounts stored only in those databases are not automatically available in the new database. The new database was verified empty before the explicit bootstrap adapter applied migrations through 0018_personal_history. Restart the existing cluster and API with powershell -File scripts/start.ps1 api, and run powershell -File scripts/start.ps1 mobile separately. The web app uses http://localhost:8082 and the API uses port 8001. These commands start the existing cluster; they do not initialize, reset, or migrate any database.

The ignored API .env contains the database connection, an explicit web-origin allowlist, and a random session-proof secret. Its Windows access permissions are restricted. Copy .env.example and generate separate credentials and a secret for any new setup. Do not commit or print secrets. The app’s ignored .env has an Android API URL pointing to the current computer’s reachable LAN address. Update it if the network address changes; 10.0.2.2 is for the Android emulator. Local HTTP is for development only; production client builds and API identity routes require HTTPS. Production web origins must be explicit HTTPS origins, and production cookies are Secure, HttpOnly, host-only, SameSite Lax, and scoped to /.

## Session behavior

Web issuance, login, restore, logout and legacy exchange use /api/v1/browser; JSON contains the profile and a session-bound proof but never the bearer credential. New browser authentication uses an HttpOnly cookie, with origin, custom-header and CSRF checks for writes. The session proof is also sent on protected reads so a stale tab cannot read a different account after the shared cookie changes. Old browser local-storage credentials are exchanged once and removed after successful verification. If a valid older credential and a different browser cookie coexist, the older account is migrated first so its ownership is not lost; the other account remains saved and can sign in again. If the old credential is no longer valid, a valid cookie is retained. Android keeps opaque device credentials in SecureStore; if storage fails after issuance, the in-memory session is reused for the retry. Sessions still expire and can be revoked. Login cannot recover an older passwordless account from a username alone.

Demo account navigation, role switching, hardcoded class codes and automatic sample-data fallbacks are removed from normal app routes. Legitimate starter lessons and internal fixtures remain. Simulated pronunciation scores are disabled in runtime; available speech providers and audio permissions remain separate from account access. Verification accounts with generated usernames were created only in the isolated version-2 development database and retained; no previously existing database records were removed.

## Verification

- Backend identity, browser, administrator and classroom unit tests: 213 passed before the last browser changes; the 13 browser-specific tests passed again after the legacy-account and origin fixes.
- Isolated PostgreSQL account, identity, classroom and enrollment integration tests: 36 passed after the cross-tab fix, followed by two separate passing PostgreSQL tests for stale-cookie migration and coexisting accounts.
- Mobile session, routing, API and internal simulated-score fixture tests: 35 passed, including the HTTPS and cross-tab checks. Typecheck passes; lint reports no errors and 13 existing warnings.
- Real browser checks covered all three account roles, wrong and mismatched passwords, refresh and reopening, old links, personal onboarding, cookie refusal and subsequent sign-in, legacy password setup, cross-tab account isolation, no browser bearer storage, keyboard-only sign-in, duplicate-name errors, network errors, and 320px/390px enlarged-text layouts.
- Android test APK: not built. Several attempts failed because generated native build paths exceeded Windows limits, including after shortening paths; retries stopped when C: fell below 1 GB free. Gradle caches, temporary build files and the Android SDK were on F:. The connected phone reported Android 11 and could reach the API port; no new app was installed or tested on the device. Existing Android build configuration and the original build caches were restored. An inactive emulator temporary folder was copied and SHA-256 verified under F:/FLUENTT/.superpowers/auth-2026-10-29/preserved-android-emulator before the temporary source was removed from C:.
- A fresh GPT-6 Luna xhigh review found a cross-tab isolation issue; its fix and the later legacy-account, HTTPS and origin checks were tested and reviewed again.

## Changed source files

- README.md
- apps/mobile/.env.example
- apps/mobile/src/app/_layout.tsx
- apps/mobile/src/app/account.tsx
- apps/mobile/src/app/assessment-results.tsx
- apps/mobile/src/app/assignment-attempt.tsx
- apps/mobile/src/app/assignment-builder.tsx
- apps/mobile/src/app/assignment-results.tsx
- apps/mobile/src/app/assignments.tsx
- apps/mobile/src/app/auth.tsx
- apps/mobile/src/app/class-code.tsx
- apps/mobile/src/app/class-details.tsx
- apps/mobile/src/app/class-edit.tsx
- apps/mobile/src/app/communication.tsx
- apps/mobile/src/app/index.tsx
- apps/mobile/src/app/instructor-monitoring.tsx
- apps/mobile/src/app/learning-materials.tsx
- apps/mobile/src/app/login.tsx
- apps/mobile/src/app/personal-stats.tsx
- apps/mobile/src/app/published-assignments.tsx
- apps/mobile/src/app/question-practice.tsx
- apps/mobile/src/app/school-role.tsx
- apps/mobile/src/app/set-password.tsx
- apps/mobile/src/app/username.tsx
- apps/mobile/src/components/DemoNavigator.tsx
- apps/mobile/src/demo/demoData.ts
- apps/mobile/src/features/auth/styles.ts
- apps/mobile/src/features/history/PersonalHistory.tsx
- apps/mobile/src/features/pronunciation/PronunciationPractice.tsx
- apps/mobile/src/features/pronunciation/simulatedScore.ts
- apps/mobile/src/features/welcome/WelcomeScreen.tsx
- apps/mobile/src/services/api/assignments.ts
- apps/mobile/src/services/api/capture.ts
- apps/mobile/src/services/api/classes.ts
- apps/mobile/src/services/api/client.ts
- apps/mobile/src/services/api/communications.ts
- apps/mobile/src/services/api/conversation.ts
- apps/mobile/src/services/api/enrollment.ts
- apps/mobile/src/services/api/identity.ts
- apps/mobile/src/services/api/materials.ts
- apps/mobile/src/services/api/monitoring.ts
- apps/mobile/src/services/api/pathways.ts
- apps/mobile/src/services/api/personalHistory.ts
- apps/mobile/src/services/api/practice.ts
- apps/mobile/src/services/api/progress.ts
- apps/mobile/src/services/api/pronunciation.ts
- apps/mobile/src/services/api/research.ts
- apps/mobile/src/services/api/results.ts
- apps/mobile/src/services/api/reviews.ts
- apps/mobile/src/services/api/wholePhrase.ts
- apps/mobile/src/session/controller.ts
- apps/mobile/src/session/provider.tsx
- apps/mobile/src/session/routing.ts
- docs/DECISIONS.md
- scripts/local-postgres.ps1
- scripts/navigation.test.mjs
- scripts/onboarding.test.mjs
- scripts/pronunciation-simulation.test.mjs
- scripts/start.ps1
- scripts/unified-auth.test.mjs
- services/api/.env.example
- services/api/app/api/v1/router.py
- services/api/app/core/config.py
- services/api/app/main.py
- services/api/app/models/users.py
- services/api/app/modules/identity/browser_router.py
- services/api/app/modules/identity/browser_security.py
- services/api/app/modules/identity/dependencies.py
- services/api/app/modules/identity/repository.py
- services/api/app/modules/identity/router.py
- services/api/app/modules/identity/schemas.py
- services/api/app/modules/identity/user_service.py
- services/api/tests/integration/test_assignment_drafts_postgresql.py
- services/api/tests/integration/test_classrooms_postgresql.py
- services/api/tests/integration/test_curriculum_management_postgresql.py
- services/api/tests/integration/test_enrollment_postgresql.py
- services/api/tests/integration/test_identity_postgresql.py
- services/api/tests/integration/test_question_bank_postgresql.py
- services/api/tests/integration/test_unified_auth_postgresql.py
- services/api/tests/test_browser_auth.py
- services/api/tests/test_classrooms.py
- services/api/tests/test_identity_api.py
- docs/UNIFIED_ACCOUNTS.md

Local ignored .env files and the isolated database are operational configuration, not source artifacts. The migration history and existing databases were not reset.
