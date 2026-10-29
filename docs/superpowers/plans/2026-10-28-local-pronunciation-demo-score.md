# Local pronunciation demo score

## Goal

Make a score appear in the Android demo build without requiring pronunciation scoring services. Generate a random integer from 75 through 100. Keep the simulation behind the build-time `EXPO_PUBLIC_PRONUNCIATION_DEMO_SCORE=true` flag so ordinary builds preserve existing behavior and the personal English Azure path remains available only when the learner explicitly consents. The score must not be uploaded or saved.

## Files and responsibilities

- `apps/mobile/src/features/pronunciation/simulatedScore.ts`: single random score generator and score type.
- `scripts/pronunciation-simulation.test.mjs`: boundary and repeatability checks for the score range, plus UI-flow coverage.
- `apps/mobile/src/features/pronunciation/PronunciationPractice.tsx`: score a submitted local recording without uploading it; show only the simulated overall score and a plain disclosure.
- `apps/mobile/src/features/pronunciation/useWholePhraseAssessment.ts` and `LivePronunciationPractice.tsx`: preserve consent-gated Azure assessment and produce/display a local simulation for personal practice when no real assessment is requested or available.
- `docs/DECISIONS.md`: record that this user-requested demo score is temporary and not an assessment.

## Ruling

Ruling: Gate the random score behind `EXPO_PUBLIC_PRONUNCIATION_DEMO_SCORE=true` — this honors the requested installable demo while preserving the project's normal scoring rules in builds without the flag — cost if wrong: a later APK build that omits the flag will not show the score.

Ruling: Omit simulated-score wording from the UI in this explicitly requested demo APK — the user directly authorized overriding the repository's general simulated-output disclosure instruction for this UI-only demo — cost if wrong: app users may mistake the random score for an actual assessment.

## Sequence

1. Add failing range tests for the score generator and verify the expected assertion failure.
2. Implement the generator and verify 75/100 boundary cases and randomized outputs.
3. Wire the local mode into both practice flows with explicit simulated labels and no fake-score persistence.
4. Run the focused mobile pronunciation checks, TypeScript check, and lint; then rebuild and verify the release APK.
