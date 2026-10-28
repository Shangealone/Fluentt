# Instructor classroom design alignment — 2026-10-27

The instructor interface now reuses the student classroom presentation: F. wordmark, fixed header, bell/profile controls, circular Back button, soft background, navy/rose/teal palette, white cards, welcome copy and navy hero. Content and actions remain instructor-specific.

## Implementation

`ClassroomScreen` adds opt-in `instructor` and `backDisabled` props. Defaults preserve the existing student presentation. New `InstructorScreen` wraps that shell only for an instructor; shared routes return the prior `Screen` for other roles. Existing instructor pages and instructor views of account, communication, notifications and materials use this wrapper. `AppHeader` renders just the heading/subtitle for instructors to avoid a second logo/account/nav block; the non-instructor branch retains its existing output. Busy form wrappers disable header navigation through their existing `backDisabled` props; unsaved-change and session guards remain authoritative.

The home screen follows the student dashboard's structure, with returned owned-class records, invitation codes and create/refresh actions. Duplicated top Home/Messages/Monitoring buttons are removed. Class detail cards adopt the same palette and spacing; the unsupported “Verified Classroom” decoration was removed.

New role-gated instructor bottom tabs: Home, Classes, Messages, Progress and Materials. Classes uses `/instructor?view=classes`, showing the same owned records in a focused list; Home uses `view=home`. The global bar uses `useGlobalSearchParams` so query-only navigation updates the active tab correctly. It appears only on eligible read/list destinations and account/notifications. It stays hidden on onboarding, creation, editing, builder, release and attempt forms. Existing routes, role policies, ownership checks, API calls and save/publication behavior are unchanged. The demo launcher is raised above instructor tabs so it cannot cover them on a phone.

## Actual verification

- `node scripts/dashboard-components.test.cjs`: **21 passed**, including three new instructor shell/query-navigation/role/form tests; existing student and Personal Learning checks pass.
- `node scripts/choice-components.test.cjs`: **50 passed**.
- `node scripts/class-activity-demo.test.cjs`: **3 passed**.
- Mobile `npm run typecheck`: passed; `npm run lint`: **0 errors, 29 existing warnings**.
- Broader `node --test scripts/navigation.test.mjs`: **11 passed, 1 existing failure** at line 24. Its personal fixture omits the required experience setting but expects access to preferences/student destinations. Neither that test nor `src/session/routing.ts` was changed in this task; the outdated expectation remains outside this presentation change. No claim of a fully passing repository-wide suite.
- Actual browser preview: checked the instructor header/home/class detail layout, Classes query navigation and active tab. A browser check caught stale active-tab selection with a route-local hook outside the Stack; switching to the global search hook fixed it, and `aria-selected=true` was confirmed. Checked 390×844 phone viewport: document and content both 390 pixels, no page-wide horizontal overflow. Restored normal viewport afterwards. Screenshots: `output/instructor-design/mobile.png`, `desktop.png`.

No native-device execution, APK rebuild, backend changes, new migrations, learning policy changes, research changes, production data edits, commit, push or deployment were performed. Existing unrelated working-tree changes were preserved.

## Files changed for this request

- `apps/mobile/src/components/InstructorScreen.tsx` (new)
- `apps/mobile/src/components/InstructorBottomNavigation.tsx` (new)
- `apps/mobile/src/components/ClassroomScreen.tsx` (opt-in instructor shell/busy props)
- `apps/mobile/src/components/navigation.tsx` (compact instructor heading)
- `apps/mobile/src/components/DemoNavigator.tsx` (instructor launcher position)
- `apps/mobile/src/app/_layout.tsx` (role-gated instructor bottom bar)
- `apps/mobile/src/app/instructor.tsx` (dashboard redesign and focused Classes view)
- `apps/mobile/src/app/class-details.tsx` (shell and card styling)
- `apps/mobile/src/app/class-edit.tsx`, `first-class.tsx`, `assignments.tsx`, `assignment-builder.tsx`, `assignment-results.tsx`, `instructor-monitoring.tsx` (shell imports)
- `apps/mobile/src/app/account.tsx`, `notifications.tsx`, `learning-materials.tsx` (instructor-only wrapper, other roles unchanged)
- `apps/mobile/src/app/communication.tsx` (wrapper and removal of duplicate instructor account action)
- `scripts/dashboard-components.test.cjs` (three instructor checks and query hook fixture)
- `docs/INSTRUCTOR_DESIGN.md` (new), `docs/DECISIONS.md`, `PROJECT_HANDOFF.md`
