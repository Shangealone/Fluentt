# Approved welcome screen — 2026-10-29

The user approved the revised welcome preview and explicitly requested implementation. Match logo B and the existing personal Home visual system.

- Bundled neighborhood illustration, logo B, headline “Learn words. Start talking.” and “Build your confidence, one conversation at a time.”
- Remove “English & Tagalog” without replacement.
- Coral “Learn on my own” card with the exact Home Learn book illustration and mint badge; white “Learn with my class” card with the approved filled school illustration and lavender badge.
- Keep the exact helper copy from the preview, Sign in, Try a sample, and footer.
- Personal opens /username?role=personal_student; classroom opens /school-role; Sign in opens /login. Reuse existing switchDemoRole and destinations for all three samples.
- Samples live in a dismissible native Modal with the approved explanation. Close/Escape/Android Back dismiss; selecting a sample closes before navigating.
- Suppress the duplicate floating Demo Hub on welcome only; preserve its other screen behavior.
- No new dependencies, auth/session semantics, backend writes or scoring changes. Reuse Home art/icon palette, optimize bundled welcome JPEG, retain school SVG source.

The user reviewed the original welcome direction, requested filled icons matching Home plus removal of the language label, then approved that corrected preview. A copy-only refresh would not satisfy the visual approval; a new onboarding flow was not requested. Keep the current untracked app in place and retain source snapshots.

Acceptance: 320/390/1280px layouts and enlarged text have no horizontal overflow; entry routes and all samples work; sample chooser can close and scroll on short screens; new welcome art loads; Home remains reachable. Typecheck/lint complete. Actual app available at localhost:8082. Browser verification does not prove native APK/device execution.
