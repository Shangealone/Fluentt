# Personal learning reference design

## Scope

The user supplied five mobile screenshots and requested the same design direction for personal learning. Implemented a responsive native layout with a compact FLUENTT header, initials-based account access, navy surfaces, muted rose actions, teal accents, rounded white cards, and consistent native line icons.

- Home: personalized greeting, dark learning focus panel, Learn/Voice/Tutor entry cards, saved interests, and simulator disclosure.
- Learn: lesson/topic search and authored easy/medium/hard difficulty, card position indicator, existing ten question formats, and redesigned individual Flashcard reveal/recall cards. Ratings remain one local self-report per focused visit; no score or schedule is created.
- Voice: phrase picker, focused target phrase/instructions, recording/playback interface, and existing simulated feedback. Hide the picker introduction/filters during a selected activity so recording controls fit on a phone.
- Tutor: scenario picker, navy learner bubbles, white partner bubbles, rose simulated coaching, and a composer above the bottom navigation. Message bubbles now shrink/wrap at phone widths. Render state copies the starting message array so mutable demo adapters do not duplicate the first reply.
- Stats: a personal-only protected overview route. Four styled metrics explicitly say Not measured. No invented percentages, streaks, retention curves, CEFR level, acoustic measurements, or claims about ESR integration. The page shows saved focus and links to actual practice.
- Account and preferences keep existing actions within the same personal shell. Setup/session-recovery routes retain their guards and no bottom navigation. The demo launcher is hidden for personal learners to avoid covering content.

The reference pictures are visual guidance. Their numerical/research/model claims are not evidence about this system. No new backend, migration, dependency, external provider, tracking writer, or real AI capability was added. Existing published-question authorization, exact Flashcard reveal, focus cleanup, temporary answers, and classroom capture remain in place. Actual personal analytics are still unavailable.

## Verification

- Mobile typecheck passed; lint passed with 29 existing warnings and no errors.
- 79 focused screen/widget/client tests passed: personal navigation and Stats guards, honest unavailable measurements, all ten sample formats, reveal and one local rating, selection/arrangement/matching, classroom capture/release regressions, conversation/pronunciation API contracts, and stale-response cleanup.
- Browser checked at 390×844: Home and five tabs, Stats unavailable cards, Learn lesson selection/question navigation/Flashcard reveal, Voice phrase selection and visible recording control, Tutor send/reply/coaching with one exchange per send and correctly wrapped bubbles.
- Browser also checked in the default desktop layout. Temporary mobile viewport override is reset after verification.
- No microphone permission was requested, no native device recording was tested, and no production deployment was performed. Pronunciation/conversation feedback is simulated. The reference's native example playback and acoustic graphs are not fabricated when supporting audio/data is absent.
- Screenshots are saved under `output/personal-reference/`.

## Files added or edited for this request

New: `apps/mobile/src/theme/personal.ts`, `apps/mobile/src/components/PersonalScreen.tsx`, `apps/mobile/src/components/PersonalIcon.tsx`, `apps/mobile/src/app/personal-stats.tsx`, and this document.

Edited:

- `apps/mobile/src/app/_layout.tsx`
- `apps/mobile/src/app/student.tsx`
- `apps/mobile/src/app/question-practice.tsx`
- `apps/mobile/src/app/pronunciation.tsx`
- `apps/mobile/src/app/conversation.tsx`
- `apps/mobile/src/app/account.tsx`
- `apps/mobile/src/app/preferences.tsx`
- `apps/mobile/src/components/ui.tsx`
- `apps/mobile/src/components/PersonalBottomNavigation.tsx`
- `apps/mobile/src/components/DemoNavigator.tsx`
- `apps/mobile/src/features/dashboard/PersonalHome.tsx`
- `apps/mobile/src/features/assignments/CaptureQuestion.tsx`
- `apps/mobile/src/features/questions/FlashcardQuestion.tsx`
- `apps/mobile/src/features/pronunciation/PronunciationPractice.tsx`
- `apps/mobile/src/features/conversation/ConversationPractice.tsx`
- `apps/mobile/src/session/routing.ts`
- `scripts/dashboard-components.test.cjs`
- `scripts/personal-practice.test.cjs`
- `docs/DECISIONS.md`
- `docs/PERSONAL_LEARNING.md`

Other existing user/Gemini working-tree changes were preserved and are not attributed to this request.
