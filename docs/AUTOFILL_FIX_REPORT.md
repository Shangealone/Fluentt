# Username autofill repair — 2026-10-19

Reproduced the reported failure at /username?role=school_student: selecting a sample and pressing Continue updated the sample profile but stayed on the username page. Demo route guards intentionally keep setup screens accessible, so they did not perform the redirect used by the live flow.

## Fix

- Navigate explicitly after successful creation once the session exposes the matching role and canonical username. No navigation on failed creation or before the requested profile is ready.
- Selecting a sample marks it explicitly as preview creation. The session provider accepts that preview intent even on native, so a sample selection does not create a real account.
- Sample selections and existing demo sessions skip real username availability requests. Effect cleanup cancels stale checks. Editing the username clears the selected sample marker.
- Fast-Enter passes its handle and preview intent directly instead of relying on not-yet-updated React state.
- Autofill choices now expose button/selected/disabled accessibility states and cannot change during creation or a pending secure save. Existing real creation, session guards and SecureStore retries are retained.

## Validation

- Eight new username regression checks passed: three roles via autofill + Continue, three Fast-Enter roles, single-flight creation/matching-session wait, and failure feedback without navigation.
- Combined username, navigation/session and dashboard checks: 33 passed.
- Mobile TypeScript check passed. Mobile lint passed with zero errors and 19 existing warnings.
- Browser verified school-student and instructor autofill + Continue, plus personal Fast-Enter. Selected names appeared on the correct dashboards. Left the original juan_delacruz student dashboard open.
- Native-device execution was not performed. No backend or database change was needed.

## Changed files

- apps/mobile/src/app/username.tsx
- apps/mobile/src/session/provider.tsx
- scripts/username.test.cjs (new)
- docs/DECISIONS.md
- docs/AUTOFILL_FIX_REPORT.md (this report)
- output/ui-redesign/autofill-fixed.jpg (new browser evidence)

All pre-existing checkout changes were retained.
