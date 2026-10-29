# Welcome screen implementation — 2026-10-29

Implemented the revised welcome preview explicitly approved by the user. It matches the personal Home visual system and logo B, uses the exact Home book illustration plus the matching filled school illustration, and removes the English & Tagalog label without replacement. Existing entry routes and sample role callbacks are retained.

## Verification

- Old-screen baseline confirmed the approved learning-path cards were absent before implementation.
- Final mobile TypeScript check: exit 0.
- Final full mobile lint: exit 0; 0 errors, 29 pre-existing warnings. The existing unused theme import warning in DemoNavigator was already present in the source snapshot.
- Actual app browser checks: 320, 390 and 1280px layouts, no horizontal overflow, bundled image loading and enlarged headings pass.
- Personal route retains /username?role=personal_student. Classroom retains /school-role and both existing student/instructor choices. Sign in retains /login. Checks only navigate; no account creation or sign-in request was submitted.
- All three samples retain their role and destination: Personal learner → personal /student Home; Student → school /student; Teacher → /instructor. Chooser closes before navigation.
- Explicit Close, web Escape, rapid close/reopen and subsequent entry-button interaction pass. Initial fade dismissal left a pointer-blocking layer in the browser; animationType none resolves the reproduced failure. Full browser suite passes after that correction.
- Sample chooser fits and scrolls at a short 390x360 viewport; the Teacher action remains reachable.
- Welcome's duplicate floating Demo Hub is hidden, while the existing hub remains on school-role and non-personal sample destinations.
- A fresh scoped review found no actionable findings; no deferred findings.

Checks used isolated browser contexts and the existing in-memory sample profiles. No real account was modified. Native Android/iOS execution and hardware-Back behavior were not physically tested; onRequestClose is wired to the same close callback. No APK was rebuilt. No package, backend, session/auth policy, speech provider, recording behavior or score calculation changed.

The welcome JPEG is 140,206 bytes and the school PNG is 3,080 bytes. Artwork is reused from the approved generated neighborhood illustration; the school source is the approved vector icon. Both are bundled under the app, with no runtime image service.

## Changed files

- apps/mobile/src/app/index.tsx
- apps/mobile/src/features/welcome/WelcomeScreen.tsx (new)
- apps/mobile/src/components/DemoNavigator.tsx
- apps/mobile/assets/illustrations/welcome-neighborhood.jpg (new)
- apps/mobile/assets/illustrations/activity-class.svg (new)
- apps/mobile/assets/illustrations/activity-class.png (new)
- docs/DECISIONS.md
- docs/superpowers/specs/2026-10-29-welcome-design.md (new)
- docs/superpowers/plans/2026-10-29-welcome-design.md (new)
- docs/WELCOME_DESIGN.md (this report)

## Review artifacts and run location

Actual app: http://localhost:8082/ . Preview artifacts and pre-edit snapshots remain at F:/FLUENTT/.superpowers/brainstorm/1854-1793207172/. Browser verification script: welcome-app-check.cjs. Actual screenshots: welcome-app-mobile.png, welcome-app-small.png and welcome-app-large-text.png. The app is untracked in the parent repository, so source snapshots were preserved for review; no Git reset, cleanup, commit, push or deployment was performed.
