# Section 07 — mobile navigation and role-based dashboards

Date: 2026-10-17 (Asia/Manila).

Status: implemented with passing automated state/render/regression checks and web/Android exports. Native device interaction and live PostgreSQL verification remain unverified. Stop before Section 08 and await user approval.

## Inspection and scope reconciliation

Read the existing handoff, development plan, Section 06 report/enrollment contracts, architecture/decisions, applicable repository rules, mobile routing, session/SecureStore, onboarding, API clients, class screens and current Git changes. The handoff remains a historical Section 05 snapshot. The current user prompt accepts Section 06 source with its reported database/native limitations and authorizes Section 07. No unresolved product policy blocked this implementation.

Existing APIs already support every implemented account/class operation. No new backend endpoint, SQLAlchemy model, migration, package or alternate navigation framework was needed. Section 06 multi-class policy authorizes the selector. The existing revoke API authorizes sign-out, but absent recovery makes explicit confirmation and a clear access-loss explanation necessary. Instructor first-class onboarding remains the default; deliberate dashboard access additionally supports the required honest zero-class empty state.

## Implemented routes and dashboards

| Route | Authorized behavior |
|---|---|
| /student | Completed personal learner or eligible enrolled school student; real role-specific dashboard |
| /instructor | Instructor only, including deliberate zero-class dashboard access |
| /first-class | Existing instructor creation flow; default for incomplete instructor setup |
| /class-details, /class-edit | Existing owner-authorized management, refreshed on focus |
| /class-code | Existing school-student verification/confirmation; available for initial or additional enrollment |
| /account | Current authenticated mobile profile; safe account state, refresh, and confirmed device sign-out |
| /preferences | Completed personal learner only; existing grade/language PATCH API |
| /grade, /language | Existing personal onboarding completion gates, unchanged |
| /, /school-role, /username | Existing unauthenticated onboarding; pending issuance still restricts back/history |

The existing Expo Router stack remains the sole navigator. Protected route declarations use shared routeAllowed policy and explicit redirectTo destinations; inaccessible routes redirect to the server-profile-derived onboarding/dashboard destination. Existing public creation routes disappear from protected history. No locally selected role is sufficient for API access.

Personal dashboard displays username, saved grade/language and saved-setup context, links to account/preferences, and supports profile refresh. A failed/ongoing refresh identifies displayed preferences as previously verified. The supported preference editor reuses grade/language choices, single-flight saving, keyboard-aware scrolling and save-time hardware Back protection. It introduces no username, role or account-recovery mutation.

School dashboard loads its authenticated eligible memberships, displays class name, nullable instructor display name, grade/language, active enrollment and joined date. Multiple returned classes have accessible radio-style selection. Selection is transient over returned membership IDs; removed/missing selections fall back only within currently returned records. No roster/private instructor fields are fetched. Empty membership results revalidate sessions/me and return an unenrolled student to class-code. Pagination and Join another class remain.

Instructor dashboard uses the existing owned-class list and links to create/details/edit. Zero, one and multiple classes have real loading/empty/ready/error behavior. Archived state and invitation codes come from authorized responses; no student counts or performance metrics are invented. Class detail/edit refresh on focus, hide previous context during loading/error and reject late navigation responses. Existing name/context edit rules and copy/share remain.

All dashboards/account/class screens reuse the established theme, keyboard-aware Screen, buttons, cards and inputs. New AppHeader/LoadState/UpcomingLearning patterns standardize account/back navigation and states. Future lessons, assessments, vocabulary/spaced repetition, pronunciation, AI conversation and progress remain clearly unavailable. Rosters, grading, analytics and content authoring are not implemented.

## Session and privacy behavior

- Startup continues to read native SecureStore and validate GET sessions/me. Backend role, preferences, owned classes and eligible memberships remain authoritative. No raw credential is displayed, routed, logged or stored in a browser fallback.
- Current authenticated 401 immediately removes the visible profile, gates protected routes and invalidates in-memory credentials before secure deletion. Cleanup failure leaves only a retry gate; no second network request is needed to recognize an already-invalid credential.
- Session-generation checks reject late successful/error responses from an old restore or protected operation after logout/invalidation/newer restoration. A missing stored credential also clears the in-memory reference. New creation remains single-flight with its original secure-save retry semantics.
- Account sign-out first explains that the device holds access and username recovery is unavailable. Explicit confirmation immediately hides protected views and blocks old requests. Server revoke/401 must be acknowledged before secure deletion; network/429/5xx keeps the credential securely stored behind Retry sign-out. A lost successful revoke response is safe to retry and accept as 401.
- Secure-delete failure after acknowledged revoke retries deletion without another revoke. Ordinary network failures do not silently create profiles or claim logout success. External server revocation is detected on the next authenticated request/refresh; no push/background invalidation is claimed.
- A restart during an unacknowledged logout loses its in-memory retry intent and validates the still-stored credential normally. If revocation never reached the server it may restore; otherwise it clears on 401. No persistent logout queue or recovery protocol was invented.
- Shared paged reads invalidate on blur/unmount, deduplicate requests/results, and clear visible class context while loading or after failure. Returning from navigation refetches rather than presenting old classes as current. Components unmount behind the session gate on logout/invalidity.

No research identity/consent/allocation, private answer keys, database credentials or administrator access was added. Backend authorization and process-local limiter/deployment constraints remain unchanged.

## Tests and actual results

| Check | Result |
|---|---|
| Client/state/API regression tests | **33 passed**, zero skipped |
| Synthetic actual-screen server-render tests | **12 passed**, zero skipped |
| Backend pytest regression | **190 passed, 40 skipped**, one existing Starlette/AnyIO deprecation warning |
| Mobile TypeScript | Passed |
| Mobile ESLint | Passed, no warnings in final check |
| Expo web export | Passed |
| Expo Android Hermes export | Passed |
| Whitespace check | git diff --check passed |
| Live PostgreSQL / native device interaction | Not executed; remain unverified |

Eleven new navigation/session/state tests cover role/onboarding guards, instructor zero-class access, paged loading/error/empty/refresh states, pagination deduplication, duplicate taps, blurred/superseded reads, selection isolation, sign-out ordering, late responses, interrupted revoke/401 retry, secure-delete retry without re-revoke, invalid-session cleanup, overlapping restore and credential retention on temporary/forbidden errors. The 22 existing identity/onboarding/class/enrollment/client tests remain passing.

Twelve new render tests use the actual React components with React Native Web server rendering and synthetic injected session/read ports in the test process only. They cover personal details/preferences/upcoming modules, authorized school selection, school/instructor loading/error data hiding, instructor zero/one/multiple classes, account/recovery explanation, preference selected/accessibility state and class-detail failure privacy. They make no API calls and do not create a runtime authentication bypass. They do not prove native interactions or full Expo Router execution.

The 40 PostgreSQL tests skipped because test infrastructure is not configured, as in Section 06. No new backend test or database test was necessary for this mobile-only change. No skipped test is claimed as passing. Backend tests and exports used the previously established outside-sandbox runner because Windows TestClient sockets/Hermes temporary output were restricted in the sandbox. No application workaround or insecure fallback was introduced.

Current environment remains Node 24.21.0, npm 11.19.0 and the existing Python 3.14.8 virtual environment; historical Python 3.11 equivalence remains unverified. No system tools were installed. Existing Node module-type inference, Metro color-environment and upstream Starlette warnings remain non-failing. An intermediate JSX apostrophe lint error was corrected before final checks.

Commands:

```powershell
# Repository root
node --test scripts/navigation.test.mjs scripts/onboarding.test.mjs scripts/enrollment.test.mjs scripts/classes.test.mjs scripts/api-clients.test.mjs
node --test scripts/dashboard-components.test.cjs

# apps/mobile
npm run typecheck
npm run lint
npx --no-install expo export --platform web
npx --no-install expo export --platform android

# services/api
.venv/Scripts/python -m pytest -q
```

## Native/live acceptance still required

- Configure PostgreSQL and apply existing head safely, then run the disposable UUID database suite. Do not reset an existing developer database.
- On native devices, exercise personal onboarding -> dashboard -> edit/save preferences -> relaunch; verify saved values, retry, role guards and hardware Back.
- Exercise school zero/multiple eligible memberships, class selection, additional joining, relaunch, membership removal/unavailability and recovery through authenticated backend state.
- Exercise instructor zero/one/multiple owned classes, create/edit/return/refresh and unauthorized other-owner IDs. Check pending-save Back/gesture behavior.
- Confirm sign-out only with synthetic accounts because recovery is unavailable. Test server unavailable/revoke response loss/storage deletion failure, then verify protected history and data cannot return through Back. Check expired/revoked credentials during reads.
- Check small screens, increased text size, keyboard, touch targets and TalkBack. Server-render assertions and bundle compilation do not verify these native behaviors. No installed Android/iOS build, device screenshot or native secure-storage result is claimed.

## Section 08 prerequisites / stop

Receive user acceptance of Section 07 and the authoritative Section 08 prompt. Review separate administrator authentication/provider/provisioning and backend permission decisions before implementing it; the existing documentation's OIDC preference is not a completed provider selection. Preserve pending PostgreSQL/native verification and deployment security prerequisites. No administrator authentication, assessment engine, AI tutoring, ESR, pronunciation service or research execution was implemented. No automatic commit or push occurred.

## Section 07 file inventory

This inventory distinguishes this section from already-uncommitted Section 06 work. Git diffs against HEAD include both sections; that is not a claim that all working-tree changes were introduced here.

Added:

- apps/mobile/src/app/account.tsx
- apps/mobile/src/app/preferences.tsx
- apps/mobile/src/components/navigation.tsx
- apps/mobile/src/features/dashboard/paging.ts
- apps/mobile/src/features/dashboard/usePagedList.ts
- scripts/navigation.test.mjs
- scripts/dashboard-components.test.cjs
- docs/SECTION_07_REPORT.md

Modified:

- apps/mobile/src/app/_layout.tsx
- apps/mobile/src/app/class-code.tsx
- apps/mobile/src/app/class-details.tsx
- apps/mobile/src/app/class-edit.tsx
- apps/mobile/src/app/first-class.tsx
- apps/mobile/src/app/instructor.tsx
- apps/mobile/src/app/student.tsx
- apps/mobile/src/features/enrollment/MyClasses.tsx
- apps/mobile/src/services/api/identity.ts
- apps/mobile/src/session/controller.ts
- apps/mobile/src/session/provider.tsx
- apps/mobile/src/session/routing.ts
- AGENTS.md
- README.md
- docs/ARCHITECTURE.md
- docs/DECISIONS.md
- docs/DEVELOPMENT_PLAN.md
- docs/ENROLLMENT.md
- docs/IDENTITY_AND_SESSIONS.md

Pre-existing mobile package-lock SHA-256 remains `92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6`. PROJECT_HANDOFF.md remains untouched with SHA-256 `EFBA6D1FA5B51D4FD0695553E0BBA19E857E30C37F3D09E00C6249EC45F39F71`. Earlier section reports and all Section 06 backend/schema changes are preserved. No dependency manifest, applied migration, model, backend endpoint, administrator source or previous preview artifact was changed in Section 07.

Implementation references: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [protected routes and explicit redirects](https://docs.expo.dev/router/advanced/protected/), and [Expo documentation index](https://docs.expo.dev/llms.txt). API authorization remains separate from client navigation guards.

Git status at Section 07 completion (contains preserved Section 06 and earlier uncommitted work):

```text
 M AGENTS.md
 M README.md
 M apps/mobile/package-lock.json
 M apps/mobile/src/app/_layout.tsx
 M apps/mobile/src/app/class-code.tsx
 M apps/mobile/src/app/class-details.tsx
 M apps/mobile/src/app/class-edit.tsx
 M apps/mobile/src/app/first-class.tsx
 M apps/mobile/src/app/instructor.tsx
 M apps/mobile/src/app/student.tsx
 M apps/mobile/src/services/api/client.ts
 M apps/mobile/src/services/api/identity.ts
 M apps/mobile/src/session/controller.ts
 M apps/mobile/src/session/provider.tsx
 M apps/mobile/src/session/routing.ts
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
?? apps/mobile/src/app/account.tsx
?? apps/mobile/src/app/preferences.tsx
?? apps/mobile/src/components/navigation.tsx
?? apps/mobile/src/features/dashboard/paging.ts
?? apps/mobile/src/features/dashboard/usePagedList.ts
?? apps/mobile/src/features/enrollment/MyClasses.tsx
?? apps/mobile/src/features/enrollment/state.ts
?? apps/mobile/src/services/api/enrollment.ts
?? docs/ENROLLMENT.md
?? docs/SECTION_06_REPORT.md
?? docs/SECTION_07_REPORT.md
?? scripts/dashboard-components.test.cjs
?? scripts/enrollment.test.mjs
?? scripts/navigation.test.mjs
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
