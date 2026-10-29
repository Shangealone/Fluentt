# Student classroom visual refresh

Date: 2026-10-21. User-authorized visual update after Section 38B; its research status and historical reports remain unchanged.

The school-student dashboard now uses the same pale background, compact FLUENTT header, navy hero, rose primary accent, teal/pink icon surfaces, rounded cards, typography and spacing as Personal Learning. Classes remain educational classrooms with existing assignments, instructor messages and learning history. No new learning metrics or research activity are introduced.

Bottom tabs: Home, Classes, Voice, Tutor, Progress. Classes opens the new school-only `/my-classes` route using the existing membership-scoped MyClasses component. Tabs are hidden for other roles, incomplete profiles, session loading/errors, onboarding and attempt/unsaved-form routes. Personal Learning's components and bottom tabs are unchanged. Existing screen access and backend permission checks remain authoritative.

Changed source:

- `apps/mobile/src/app/student.tsx`: retains personal branch; school branch uses separate classroom presentation.
- `apps/mobile/src/app/_layout.tsx`: registers guarded my-classes and school-only navigation.
- `apps/mobile/src/app/my-classes.tsx`: new protected classroom list screen.
- `apps/mobile/src/components/ClassroomScreen.tsx`: new visual shell.
- `apps/mobile/src/components/ClassroomBottomNavigation.tsx`: new role/focus-aware main navigation.
- `apps/mobile/src/features/dashboard/ClassroomHome.tsx`: new student home layout and existing-feature links.
- `apps/mobile/src/features/enrollment/MyClasses.tsx`: visual cards/selector; existing fetching, paging, selection and class-specific route arguments preserved.
- `apps/mobile/src/features/dashboard/LearningPathwayView.tsx`: optional classroom card/title presentation; default appearance/read behavior preserved.
- `apps/mobile/src/features/progress/ProgressSummary.tsx`: optional classroom card presentation; counts/read logic unchanged.
- `apps/mobile/src/session/routing.ts`: explicit active-school-student guard for my-classes.
- `scripts/dashboard-components.test.cjs`: three new checks for classroom presentation, tab boundaries/selection/repeated taps and role/onboarding access.
- `docs/DECISIONS.md` and this document.

Checks: `npm run typecheck` and `npm run lint` from apps/mobile pass (29 existing lint warnings, zero errors). `node --test scripts/dashboard-components.test.cjs scripts/classes.test.mjs scripts/personal-practice.test.cjs scripts/live-pronunciation.test.cjs` initially passed 42 tests; after three added navigation/access checks the dashboard suite passed 18/18. Personal practice and live voice tests are unchanged. Existing Expo preview on localhost:8096 was used, without replacing its process; an attempted additional server exited because the port was already occupied.

Browser review uses the existing synthetic Preview as student flow. Home -> Classes -> View assignments preserves the selected classId; Back returns to the class list; Home tab returns to the new dashboard. New UI is visible at 319px; the Classes document has width 319px without document overflow. The demo hub is an existing preview-only overlay. Screenshots are synthetic visual examples, not research observations. No real login, microphone recording, account creation, consent, database writes, commit, push or deployment performed.

Final combined rerun of the four named client suites: **45 passed, zero failed/skipped**, 4.69 seconds. New screenshot: `output/classroom-design/student-home.png`; synthetic student dashboard left open in the browser. Both Home and Classes document widths equal the 319px viewport. `git diff --check` passes, with only existing line-ending notices. No native-device validation is claimed for this presentation-only task.

Navigation cleanup requested after the visual refresh: removed the hero Classes shortcut, Voice/Tutor activity links, duplicate history links and the repeated general Class messages shortcut. Retained the bottom tabs and class-scoped assignment/message actions; Progress still provides history and class filtering. ClassroomHome, MyClasses and existing dashboard assertions updated. Dashboard/navigation regression suite: 18 passed; mobile typecheck/lint passed with the same 29 existing warnings. Browser accessibility review confirms the duplicate actions are absent and all five bottom tabs remain.

Header notifications follow-up: moved Notifications to a 44px accessible bell button immediately left of the profile avatar in ClassroomScreen (Home and Classes). Moved the Class learning label below the wordmark to keep the header compact, and removed the old lower-page duplicate. Existing /notifications routing and notification data remain unchanged; no invented unread badge. Browser preview confirms bell -> notification center -> Back to student; saved output/classroom-design/notification-bell.png. Existing dashboard test now checks exactly one notification action before the profile control; 18 tests pass. Changed files: ClassroomScreen.tsx, ClassroomHome.tsx, dashboard-components.test.cjs and this note.

Personal Learning notification follow-up: the user explicitly requests the same header bell in personal mode. Added a shared NotificationButton used by PersonalScreen and ClassroomScreen, preserving the classroom appearance/route. Personal language/context label moves below the wordmark so the bell fits beside the avatar. The bell respects PersonalScreen's backDisabled boundary, opens the existing /notifications page, and does not query or invent unread counts. Updated the existing personal-dashboard assertion for the requested notification access; dashboard/practice/live voice selection passes 39 tests. Browser demo review verifies personal bell -> notification center -> Back to personal home. Changes: components/NotificationButton.tsx (new), PersonalScreen.tsx, ClassroomScreen.tsx, scripts/dashboard-components.test.cjs and this note. No learning algorithm, research, backend or notification-record changes.
