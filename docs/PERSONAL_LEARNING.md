# Personal learning simplification — 2026-10-20

The user requested only conversation simulation, pronunciation learning, and question activities in personal learning. They explicitly replaced school grade labels with lessons/topics and difficulty because school curricula differ.

## Implemented behavior

- Personal home has exactly three activity cards plus essential Back/account controls. Classroom, research, notifications, history, and pathway panels are absent from that home. School/instructor dashboards retain their existing features.
- Question practice searches published lessons/topics across curriculum grades, filtered by the personal profile's language. Easy/medium/hard are existing authored question metadata, not inferred proficiency. Lesson difficulty badges list the difficulties actually available in the selected question set; a lesson can have multiple badges.
- The personal grade route redirects to learning-focus setup. Existing grade storage and classroom curriculum structure remain intact. Legacy grade-plus-language accounts continue to work.
- Conversation cards display their authored level descriptors without school grade prefixes. Existing conversation/pronunciation engines remain simulations and the UI says so. Pronunciation opens a phrase picker, with live loading/error/empty states, and discards its selected practice view on blur.
- All ten question methods reuse the existing widgets. Learners may move back/forward or skip questions, finish, restart, and select another lesson. Answers and revealed backs are in-memory only for the focused visit; no grade, attempt, history, scheduler, or progress record is written.

## API boundary

`GET /api/v1/me/practice/lessons` accepts bounded `q`, optional `difficulty`, and `offset`. `GET /api/v1/me/practice/lessons/{lesson_id}/questions` accepts optional `difficulty` and `offset`. Both return at most 20 rows with `has_more` and `offset`. There is no grade eligibility filter. Catalog difficulty is aggregated from eligible authored question revisions.

`POST /api/v1/me/practice/flashcards/{revision_id}/reveal` is invoked deliberately for an individual Flashcard. It returns only that exact locked revision's back. No other method key, rubric, explanation, or private configuration is exposed.

Requests use live personal-only authentication and the existing user/session transaction followed by shared content advisory lock 78090001. Published, nonretired hierarchy and question roots are required. Question lists choose the latest locked revision per stable question, never a newer draft. Flashcard reveal rechecks the exact revision's live eligibility. Protected successes and errors use existing `/me/` no-store middleware. There are no new migrations, dependencies, or grading/release changes.

The mobile API runs through SessionController.run. Focus-scoped generation checks ignore late catalog/question/reveal responses; blur/session loss clears protected data. Demo adapters use explicitly labeled synthetic fixtures, never seed the live database, and do not represent educational verification.

## Verification

- Mobile TypeScript: passed.
- Mobile lint: passed with existing warnings in unrelated/demo files; no lint errors.
- 17 focused screen/contract tests: passed, including the three-card dashboard, topic/difficulty samples, all ten sample formats, answer navigation, Flashcard reveal, restart cleanup, role navigation, and late-response rejection.
- 101 existing widget/capture/onboarding/conversation/pronunciation tests: passed.
- 2 PostgreSQL HTTP integration tests: passed using the fixture's generated disposable database. Checks include all ten methods, no-grade personal setup, difficulty/search, private-key exclusion, deliberate Flashcard-only reveal, newer draft exclusion, retirement, role/language rejection, unpublished hierarchy, no-store, and no classroom attempts.
- Browser preview checked: three-card personal home; Hard filter; opening a lesson, selecting an answer, moving to the next question, Back to home; conversation entry without grade labels; pronunciation phrase picker.
- No Android/iOS device or microphone recording test was performed. No external AI provider was integrated. Real practice needs authored published questions; empty live catalogs remain honest empty states.

## Files changed for this request

- `apps/mobile/src/app/{_layout,index,student,grade,conversation,pronunciation,question-practice}.tsx`
- `apps/mobile/src/components/navigation.tsx`
- `apps/mobile/src/features/dashboard/PersonalHome.tsx`
- `apps/mobile/src/features/assignments/CaptureQuestion.tsx`
- `apps/mobile/src/features/conversation/{ConversationPractice.tsx,levels.ts}`
- `apps/mobile/src/demo/personalPractice.ts`
- `apps/mobile/src/services/api/practice.ts`
- `apps/mobile/src/session/{provider.tsx,routing.ts}`
- `services/api/app/api/v1/router.py`
- `services/api/app/modules/questions/practice.py`
- `services/api/tests/integration/test_personal_practice_postgresql.py`
- `scripts/{dashboard-components.test.cjs,personal-practice.test.cjs}`
- `docs/{DECISIONS.md,QUESTION_BANK.md,PERSONAL_LEARNING.md}`

Pre-existing Gemini changes remain in the working tree. This inventory identifies the files additionally edited in this request; it does not attribute the rest of the working tree to this change.

## Bottom navigation follow-up — 2026-10-20

User requested every personal feature in a persistent bottom bar. Added Home, Chat (conversation simulator), Pronounce, Questions, and Account tabs with icons, accessible selected states, and a safe-area bottom edge. The bar occupies its own layout space below the scrolling screen, so it does not cover question controls. Personal top shortcut rows are removed; the demo control is raised above the bar. Setup, session recovery, and preference-save screens preserve their existing navigation boundaries. Account retains the link to learning preferences.

Follow-up files: `apps/mobile/src/components/PersonalBottomNavigation.tsx`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/components/navigation.tsx`, `apps/mobile/src/components/DemoNavigator.tsx`, `scripts/dashboard-components.test.cjs`, and this report. Mobile typecheck and lint passed (29 pre-existing warnings, zero errors). Focused navigation/personal screen checks cover destinations, selected state, duplicate-tap prevention, and hiding during session loss or onboarding. Browser navigation and fixed positioning were verified; native keyboard/device behavior was not tested.

## Supplied-reference redesign

The user's five mobile visual references supersede the earlier bottom-tab labels and three-card home layout. The current personal interface uses Home, Learn, Voice, Tutor, and Stats with account access in its compact header. See PERSONAL_REFERENCE_DESIGN.md for the current appearance, changed files, and verification. Earlier entries describe the implementation sequence; the personal API, security, and temporary-answer boundary remain unchanged.

## Language and starting-experience setup

New personal learners first select English or Tagalog and then describe their experience. From scratch / a few words start Easy; simple conversations start Medium; using the language for some time starts Hard. These are adjustable starting preferences, not measured ability. Topics/lessons stay optional saved interests. The selected language filters personal lessons, Voice and Tutor. Experience is retained independently per language through migration 0016 and the existing authenticated preference API. Existing accounts missing experience are routed to that question before Home; complete demo accounts retain their preselected sample preferences. Change either choice through Learning preferences → Change language or starting level.

## Easy starter listening — 2026-10-21

Easy now opens two starter activities: play a word and select its matching written option, or play a sentence and tap jumbled tokens into its authored order. Normal/slow replay, token removal, clear, retry, next, finish and activity navigation are available. There are three exercises of each kind in English and Tagalog. These are public built-in starter examples, not private question-bank answers or database curriculum seeds. Exact local feedback saves no score, grade, progress, history or scheduler state. All difficulties / Medium / Hard retain the published lesson catalog; the Easy landing does not fetch that bank.

Audio uses expo-speech device voices, with matching English or Tagalog (fil/tl) selection only. Unavailable voice discovery times out after five seconds; missing voices and playback failures show actionable messages. Transcript support allows deliberate reading practice when listening is unavailable. Playback stops on blur or exercise/language changes; late voice results are ignored. iOS silent mode can mute output. Native-device voice quality and actual Tagalog audio were not verified.

Validation: 26 focused personal-practice/dashboard tests passed, covering both activities, wrong/correct answers, sentence ordering/reset, slow replay, voice matching, unavailable-voice fallback, speech cleanup and existing navigation. Mobile TypeScript passed; lint had zero errors and the same 29 pre-existing warnings. Browser preview verified English playback controls and matching-word feedback, sentence reconstruction and feedback, activity return, and a 390px layout with unobstructed bottom controls. These checks do not establish native audio behavior or educational effectiveness.

Files for this follow-up: apps/mobile/package.json and package-lock.json; apps/mobile/src/app/question-practice.tsx; apps/mobile/src/features/learning/{beginnerLessons.ts,BeginnerPractice.tsx,useLessonSpeech.ts}; scripts/personal-practice.test.cjs; docs/DECISIONS.md and this report. No backend changes or migrations in this follow-up.

### Progressive Listen & Choose expansion

Listen & Choose now contains ten exercises per language: exercises 1–4 use one word, 5–7 use two words, and 8–10 use three words. English ends with “I drink water”, “This is mine” and “Please come in”; Tagalog ends with “Ako si Ana”, “Gusto ko ito” and “Salamat sa iyo”. Each exercise's choices share its word count. The screen shows current exercise/total and word count; activity cards derive totals from the library. Sentence building remains three exercises per language. This expansion changes beginnerLessons.ts, BeginnerPractice.tsx, scripts/personal-practice.test.cjs and these two documentation files only.

Expansion verification: 27 focused tests passed, including each language's count, nondecreasing phrase lengths, unambiguous same-length options, authored navigation and finish after exercise ten. Mobile typecheck passed; lint completed with zero errors and 29 existing warnings. Browser preview showed the updated count and progression description. No native-device audio test was performed for this content expansion.

### Jumbled sentences with draggable cards

Added ten sentences per language to the existing three: 13 English and 13 Tagalog sentence exercises. Each added exercise has one unused word card, including English “I will go hunting” with the additional “swimming” card. Sentence audio and slow replay remain available. Learners drag cards into the answer area, reposition them relative to other cards, or return them to the word bank. Tapping adds a card; selecting an answer card exposes Move earlier / Move later / Remove word. Clear resets the answer. These alternatives preserve keyboard/screen-reader access. Exact temporary feedback accepts the complete target order while leaving extras unused; repeated words remain distinct stable cards. No formal grades or saved activity records are introduced.

Changed files for this request: apps/mobile/src/features/learning/beginnerLessons.ts, BeginnerPractice.tsx and new SentenceCards.tsx; scripts/personal-practice.test.cjs; docs/DECISIONS.md and this report. No backend or dependency changes.

Verification: 29 personal/dashboard tests passed, including 13-exercise navigation in both languages, target/distractor contracts, drag insertion/reordering/removal, outside-drop cancellation, wrapped-row placement, capacity and existing speech cleanup. Mobile typecheck passed; lint completed with zero errors and 29 existing warnings. At a 390px browser viewport, actual mouse drags built “I will go hunting”, reordered the cards and restored the correct order, left “swimming” unused and produced correct feedback after audio playback. Tap navigation through the first three sentences also passed. This does not establish Android/iOS touch behavior or Tagalog voice availability; those still need device verification.

## Personal Voice live highlighting

Personal Voice now opens LivePronunciationPractice: listen to a reference phrase normally/slowly, press Record, watch matching words turn green, and finish when a finalized transcript contains every target word in order. For “I like eating pizza”, interim “i like” highlights two words; revised recognition can remove unconfirmed highlights. Reaching the last word requests final recognition automatically. Partial/stopped recognition offers retry rather than completion. Completion and transcript are temporary for the focused visit; no audio upload, score, progress or attempt record is written by this personal flow. School pronunciation retains its existing component and API.

Recognition is local-only, using installed speech languages. The browser requires SpeechRecognition.processLocally; a setup button can request a supported offline language download after an error. No remote browser fallback is enabled. Native uses expo-speech-recognition 58.0.0 with its Expo config plugin, on-device recognition and recording persistence disabled. A fresh native development/release build is required; Expo Go cannot supply this module. Unsupported offline languages (including Tagalog on some devices) show a clear unavailable message. No browser/cloud API key is involved.

Changed files: apps/mobile/package.json, package-lock.json and app.json; apps/mobile/src/app/pronunciation.tsx; apps/mobile/src/features/learning/useLessonSpeech.ts; new apps/mobile/src/features/pronunciation/{liveWordTracking.ts,liveSpeech.ts,liveSpeech.web.ts,useLiveWordTracking.ts,LivePronunciationPractice.tsx}; new scripts/live-pronunciation.test.cjs; docs/{DECISIONS.md,PRONUNCIATION.md,PERSONAL_LEARNING.md}. Other in-progress repository edits are preserved.

Focused verification covers ordered matching, partial/corrected interim results, final-only completion, repeat words, Tagalog text, retry, microphone denial, late-result rejection, blur/background disposal, permission-request cancellation, native local-only/nonpersistent options, browser local-only setup and rendered word states. These are controlled recognition-event tests, not live microphone or native-device proof. Browser preview verified the personal Voice route, phrase picker, word chips, controls and language selection. No real microphone permission was granted or recording made during verification; supported-device audio and native builds still require end-to-end testing.

Results: 39 focused live-voice, personal-practice, dashboard and existing pronunciation API checks passed. Mobile typecheck passed; lint completed with zero errors and the same 29 existing warnings. The 390px preview keeps phrase chips and recording controls usable together after scrolling. Voice recognition capability, language-pack installation and real microphone input were not tested in that browser. No deployment or native build was performed.
