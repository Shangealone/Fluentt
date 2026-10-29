# Student sign-up requires a class code

## Intent

New school-student accounts must not be saved until a valid instructor class code is supplied and the student is enrolled. This prevents unlinked accounts while keeping the existing unified account page.

## Approaches

- **One-page sign-up (selected):** Student selects their role, verifies a code, reviews the class, then submits username and password. The API rechecks the code and creates the account, session, and enrollment in one transaction. This keeps the current account page and prevents partial records.
- **Separate join step:** Verify the code on a separate screen, then continue to account creation. It is clear but adds navigation and requires carrying the verified class into sign-up.
- **Client-only requirement:** Require a code in the form but leave API registration unchanged. This is not sufficient because other clients can still create unlinked student accounts.

The one-page flow was selected because it preserves the current sign-up experience while enforcing the rule in the API for both browser and Android registrations.

## Behavior

- Selecting **Student** exposes a six-digit class-code step on the create-account page. A valid code shows the class name, instructor, grade, and language before the user creates an account.
- Code preview is read-only: it creates no user, profile, session, or membership. Browser preview requests must use an allowed origin and be rate-limited.
- Final registration sends the class code and preview version. The API locks and revalidates the invitation and class details, then atomically creates the user, profile, session, and active class membership. Any invalid, expired, revoked, changed, or unavailable invitation fails without leaving a new account or session.
- Both browser and native registration endpoints require the code for new school-student accounts. Personal-learner and teacher registration stays unchanged.
- Previously created onboarding students remain untouched and can still sign in and finish joining through the existing class-code page. No existing accounts are deleted or converted.

## Boundaries and acceptance

- Do not change account roles, delete pending accounts, or alter classroom permissions.
- On success, a new student reaches their class dashboard directly. On failure, the form explains the issue and allows correction or retry; no new student account has been saved.
- Keep the verified code in page memory only; do not put it in a URL, browser storage, or logs.
- Preserve current password validation, browser cookie/CSRF handling, Android SecureStore behavior, and session-retry handling.
