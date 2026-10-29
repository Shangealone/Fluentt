# Approved personal Home and Fluentt identity

The user approved the illustrated Home preview on 2026-10-29, then selected logo B (Open dialogue), superseding A. Implement that approved visual in the existing Expo app.

## Design
- Warm white #FAFBF7 background, dark teal #173E3B headings, coral #C64A2C main action.
- Illustrated neighborhood hero with a readable pale blue left side. “Kumusta!” / “Hello there!”, “Let’s learn Tagalog.” / “Let’s learn English.”, “Try a few new words today.” and “Start learning”. Language comes from the current profile.
- Three consistent full-width activity cards: Learn / Discover new words.; Speak / Listen, then try it out loud.; Chat / Try everyday conversations.
- Logo B: the approved blue/mint open book with a coral bookmark, followed by the lowercase fluentt wordmark.
- Personal bottom tabs: Home, Learn, Speak, Chat, My progress. Preserve their existing route identities.
- Home omits the redundant back row. Other personal screens retain their current back/disabled boundaries and gain the selected brand mark.

## Integration and constraints
Reuse existing protected routes, language settings, session controller and existing notification access. The Home language chip opens the existing language/starting-level flow; it does not mutate the profile directly. Notifications remain reachable from My account when the Home header uses the approved language/profile arrangement. Assets are bundled JPEG/PNG with editable SVG sources, requiring no new native dependency. Existing scores, speech capture, audio consent, destination disclosures, stored history, classroom screens and backend behavior are unchanged. The accepted scope is Home, shared personal branding and navigation labels; the rest of the learner pages remain separate work.

## Approaches and approval
The user chose the illustrated layout after reviewing the interactive prototype; a copy-only refresh and a full navigation replacement were not selected. Three logo directions were shown interactively; B supersedes A in the latest user instruction. Preserve the current working checkout because it contains the user's untracked app; do not clean or reset it.

## Acceptance
The actual app matches the approved Home composition at 320px and 390px widths without horizontal overflow, and supports larger text. Each card and tab opens its existing destination; the language flow and account notifications remain available. Mobile typecheck/lint pass, assets load from the bundle, and the actual app is served on localhost:8082. A browser check does not prove APK/device execution.
