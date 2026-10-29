# Student Signup Class-Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a valid instructor class code before a new school-student account is persisted, and atomically create the account and its class enrollment.

**Architecture:** Add a public, rate-limited read-only class preview for registration. The final browser or native registration request carries the code and preview version; one API transaction revalidates the invitation and writes the user, profile, session, membership, and audit row. The unified auth page collects and previews the code before enabling account creation.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy/PostgreSQL, React Native, Expo Router, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-29-student-signup-class-code-design.md`

All implementation paths below are relative to `.local-version-2`.

## Global Constraints

- New Student signup on the one-page account form requires a six-digit class code.
- Code preview creates no user, profile, session, or membership; browser preview requires an allowed origin and rate limiting.
- Final registration revalidates invitation status and preview version under locks, then saves account and enrollment in one transaction.
- Browser and native registration endpoints enforce the same requirement.
- Keep verified code in page memory only; never put it in a URL, browser storage, or logs.
- Personal learner and Teacher registration remains unchanged.
- Existing onboarding students remain untouched and can complete enrollment through the current class-code page.
- Preserve browser cookie/CSRF, Android SecureStore, password rules, and session retry behavior.

## Review Focus

- Missing, malformed, expired, revoked, or unavailable codes must not create user/profile/session rows.
- A class or code change after preview must be rejected without creating an account.
- Duplicate usernames and invalid passwords must not create a membership or partial account.
- Native and browser endpoints must enforce the same student-code requirement.
- Existing pending students must still sign in and complete enrollment through `/class-code`.

---

### Task 1: Add unauthenticated registration class preview

**Files:**
- Modify: `services/api/app/modules/enrollment/service.py`
- Modify: `services/api/app/modules/enrollment/router.py`
- Modify: `services/api/app/modules/identity/browser_security.py`
- Modify: `services/api/app/main.py`

**Interfaces:**
- Produces `POST /api/v1/class-enrollment-registration-previews` with JSON `{ "code": "123456" }` and a `ClassPreview` response.
- Web requests must pass the configured origin and browser marker checks; native requests may omit browser headers. All requests use the existing peer rate limit and no-store response policy.

- [x] Reuse the existing `CodeRequest` and add a service operation that resolves an active invitation, returns the safe class details plus a preview version, and performs no writes.
- [x] Add the unauthenticated route with origin validation for browser requests and the existing enrollment request rate limiter.
- [x] Add the new route path to the API no-store response and error headers.
- [x] Run `uv run ruff check app/modules/enrollment app/modules/identity app/main.py` from `.local-version-2/services/api`.

### Task 2: Create Student account and membership atomically

**Files:**
- Modify: `services/api/app/modules/identity/schemas.py`
- Modify: `services/api/app/modules/identity/dependencies.py`
- Modify: `services/api/app/modules/identity/user_service.py`
- Modify: `services/api/app/modules/identity/router.py`
- Modify: `services/api/app/modules/identity/browser_router.py`
- Modify: `services/api/app/modules/enrollment/repository.py`
- Modify: `services/api/app/modules/enrollment/service.py`

**Interfaces:**
- `RegistrationRequest` accepts `class_code` and `class_version` for `school_student`; both are required for that role and forbidden for other roles.
- Both registration routes use the same registration service and enrollment-capable repository.

- [x] Extend registration validation so a school-student request without both class fields is rejected before database writes.
- [x] In the shared registration service, lock and revalidate the invitation and preview version before writing; create the user, profile, session, active membership, and `class.enrolled` audit row in the same transaction.
- [x] Return an active student profile after the transaction commits; keep the existing personal-learner and Teacher creation behavior unchanged.
- [x] Ensure browser cookies are set only after successful commit and native credentials are returned only after successful commit.
- [x] Run `uv run ruff check app/modules/enrollment app/modules/identity app/main.py` from `.local-version-2/services/api`.

### Task 3: Add the code-first Student flow to the unified account page

**Files:**
- Modify: `apps/mobile/src/services/api/enrollment.ts`
- Modify: `apps/mobile/src/services/api/identity.ts`
- Modify: `apps/mobile/src/session/provider.tsx`
- Modify: `apps/mobile/src/app/auth.tsx`
- Modify: `docs/UNIFIED_ACCOUNTS.md`
- Modify: `docs/ENROLLMENT.md`

**Interfaces:**
- Add a public registration-preview call returning `ClassPreview`.
- Extend `Session.create` and browser/native create helpers with optional `{ code, class_version }`, required by the API for `school_student`.

- [x] Add response validation and safe error copy for registration previews.
- [x] When Student is selected, show a six-digit code field and verify action before account details; show the returned class, instructor, grade, and language.
- [x] Clear preview state when the code changes or another role is selected; disable account creation until a current preview exists.
- [x] Submit code and preview version with account creation; on success route the now-enrolled student directly to the dashboard.
- [x] Preserve the existing sign-in and legacy pending-student class-code flows, then update the auth documentation.
- [x] Run `npm run typecheck` from `.local-version-2/apps/mobile`.

### Task 4: Review the finished flow

- [x] Review that code is never persisted in browser storage or placed in URLs, and that the final API transaction has no partial-write path. Independent read-only review found no actionable issues; code remains page-memory-only and all signup rows share one transaction.
- [x] Confirm implementation edits are limited to the planned API, mobile, and documentation areas; leave unrelated untracked APKs and folders untouched. No automated tests were added or run.
