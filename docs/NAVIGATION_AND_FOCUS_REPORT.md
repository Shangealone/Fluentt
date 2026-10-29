# Back navigation, icons, and personal learning focus — 2026-10-19

## Result

- Every mobile route using Screen now includes a visible Back control. It invokes Expo Router back history, with a guarded entry fallback when no prior screen exists. Removed duplicated header/onboarding controls that always sent users to the dashboard instead of their actual previous screen.
- Shared mobile actions add consistent icons while retaining explicit accessible labels. Admin navigation also has icons and a root-layout Back control on every page.
- Critical account issuance/class/preference saves disable Back. Native attempt and assignment editor usePreventRemove guards remain in place. Admin curriculum/question managers intercept the shared Back event, block pending writes, and reuse their existing discard confirmations.
- Personal setup, preference editing, account, and home now show requested topics and lessons instead of asking for a grade. One request per line; clear limits and validation feedback. No academic content is seeded and these requests do not imply lesson availability, completion, or mastery.
- New focus plus language completes personal setup with grade null. Existing grade-based profiles remain compatible and retained grade data is untouched. Instructor classroom-grade configuration is unchanged.
- Additive 0013_learning_focus stores a nullable JSONB object on the existing learner profile; table count remains 63. Existing API authentication/session transactions and personal-only authorization are reused. No new activity, progress, research, or grading writer is added.

## Verification

- Mobile typecheck passed; lint completed with zero errors and 19 existing warnings.
- Admin typecheck passed; lint completed with zero errors and one existing warning.
- Frontend component/navigation/progress suites: 78 passed.
- Backend identity/security/schema suites: 106 passed; two dependency deprecation warnings.
- Disposable PostgreSQL identity suite: 10 passed, including a fresh full migration upgrade, focus roundtrip without a grade, and retention of legacy grades.
- Python lint and formatting checks passed for changed production preference/model/migration code and the repository test double.
- Read the configured local database revision as 0012_class_communication, then applied only verified additive 0013_learning_focus. Confirmed current revision is 0013_learning_focus. No reset, stamp, backfill, or previous migration edit.
- Browser: saved topic/lesson requests in the sample personal account and saw them on its home/account screens. Account → Preferences → Back returned to Account. No grade selector appeared in the personal form.
- Browser: Curriculum → unsaved edit → Back showed the existing discard dialog; cancelling kept the draft, confirming returned to Dashboard. No curriculum record was saved.
- Native Android/iOS hardware execution was not performed. A browser viewport override did not take effect for this tab, so the new focus screenshot is a desktop capture and no fresh phone-width validation is claimed for this follow-up.

## Files changed in this follow-up

### Mobile

- apps/mobile/src/components/BackButton.tsx (new)
- apps/mobile/src/components/ui.tsx
- apps/mobile/src/components/navigation.tsx
- apps/mobile/src/components/DemoNavigator.tsx
- apps/mobile/src/app/_layout.tsx
- apps/mobile/src/app/username.tsx
- apps/mobile/src/app/school-role.tsx
- apps/mobile/src/app/grade.tsx (legacy route alias)
- apps/mobile/src/app/learning-focus.tsx (new)
- apps/mobile/src/app/language.tsx
- apps/mobile/src/app/preferences.tsx
- apps/mobile/src/app/student.tsx
- apps/mobile/src/app/account.tsx
- apps/mobile/src/app/index.tsx
- apps/mobile/src/app/first-class.tsx
- apps/mobile/src/app/class-code.tsx
- apps/mobile/src/app/class-edit.tsx
- apps/mobile/src/features/preferences/LearningFocusFields.tsx (new)
- apps/mobile/src/features/assignments/AttemptPlayer.tsx (clearer action labels and separate icons)
- apps/mobile/src/services/api/identity.ts
- apps/mobile/src/session/provider.tsx
- apps/mobile/src/session/routing.ts
- apps/mobile/src/demo/demoData.ts

### Admin

- apps/admin/src/components/back-button.tsx (new)
- apps/admin/src/components/admin-nav.tsx
- apps/admin/src/components/curriculum-manager.tsx
- apps/admin/src/components/question-manager.tsx
- apps/admin/src/app/layout.tsx
- apps/admin/src/app/globals.css

### Backend and tests

- services/api/app/models/users.py
- services/api/app/modules/identity/schemas.py
- services/api/app/modules/identity/repository.py
- services/api/migrations/versions/0013_learning_focus.py (new)
- services/api/tests/identity_support.py
- services/api/tests/test_identity_api.py
- services/api/tests/test_schema.py
- services/api/tests/integration/test_identity_postgresql.py
- scripts/dashboard-components.test.cjs
- scripts/navigation.test.mjs
- scripts/choice-components.test.cjs

### Documentation/artifacts

- docs/DECISIONS.md
- docs/IDENTITY_AND_SESSIONS.md
- docs/MIGRATIONS.md
- docs/DATABASE_SCHEMA.md
- docs/ARCHITECTURE.md
- docs/API_DESIGN.md
- docs/NAVIGATION_AND_FOCUS_REPORT.md (this report)
- output/ui-redesign/learning-focus.jpg (new screenshot)

Pre-existing modified/untracked files were retained. This list describes only this follow-up’s edits, not all changes already present in Git.
- Final admin HTTP/BFF integration suite: 12 passed, zero failures. Combined automated test total: 206.
