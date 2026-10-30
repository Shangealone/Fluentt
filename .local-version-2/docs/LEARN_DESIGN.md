# Approved Learn screen implementation

The user approved the two-screen illustrated preview and requested a close implementation on the localhost app's `/question-practice` route. The running target is `.local-version-2/apps/mobile`, not the separate root `mobile/` app.

## Presentation

Learn now has the approved compact Back/Fluentt/account header, warm background, green type, illustrated hero, pastel level pills, white activity cards, coral primary action and outlined secondary action. Existing logo B and bottom navigation are reused. New listening and sentence illustrations and the speaker icon have editable SVG sources and bundled PNG exports; they follow the preview's composition without introducing dependencies.

Easy keeps the existing listening and sentence starter activities. The listening player has an audio button, slower playback, optional Show words, green progress, radio answer cards, concise feedback and completion. Sentence practice uses the same player and matching word tiles, retaining drag, tap and keyboard-accessible position controls. Medium/Challenging retain their real lesson catalog/search and all existing question renderers. The old All difficulties filter remains available as All levels from the catalog. The backend value `hard` is displayed as Challenging.

Page Back exits an active starter before returning Home; Android's hardware handler follows the same rule. Explicit activity, question and catalog transitions scroll to the top. Existing authored exercises, answer validation, increasing sentence distractors, protected session cleanup and activity-history semantics are unchanged. Starter checks remain local practice feedback. No score/model, API, schema, authentication, shared classroom renderer, package or APK change is part of this update.

## Verification

- `node node_modules/typescript/bin/tsc --noEmit` in apps/mobile: pass.
- `node node_modules/eslint/bin/eslint.js src` in apps/mobile: 0 errors; 13 pre-existing unused-variable warnings outside changed learning files.
- `node --test scripts/personal-practice.test.cjs scripts/personal-history.test.cjs scripts/personal-setup.test.cjs`: 34 passed, 0 failed. Existing Node harnesses now handle bundled image imports, match approved labels and use the current setup component. Added a focused regression for page Back returning to starter choices.
- Browser: activity selection and listening layout at 390x844; 320x568 wrapping/scrolling; reading support, answer selection/enabled state, Back, sentence tile tap, and real catalog empty state verified. Test harnesses cover both languages, actual playback callbacks/voice errors, retry/correct checks, all starter completions, ten published question formats, history deduplication, reveal, previous/next and late-response cleanup.
- No browser answer was submitted to the signed-in account during visual review. Browser checks do not establish physical playback, native text scaling, native keyboard/hardware Back or Android execution. Those still need device testing. No APK was built.

Local browser screenshots are under `output/learn-redesign/`. The preceding language-heading spelling edit in PersonalSetupView.tsx belongs to the previous request and was preserved.

## Changed files

- `apps/mobile/src/app/question-practice.tsx`
- `apps/mobile/src/features/learning/{LearnUI,BeginnerPractice,SentenceCards}.tsx`
- `apps/mobile/src/features/learning/useLessonSpeech.ts`
- `apps/mobile/assets/illustrations/learn-{listening,sentence}.{svg,png}`
- `apps/mobile/assets/icons/speaker.{svg,png}`
- `scripts/personal-practice.test.cjs`
- `scripts/personal-history.test.cjs`
- `docs/DECISIONS.md` and this report
