# Browser speech fix — 2026-10-28

The user reported unavailable offline Tagalog speech and explicitly approved optional online browser recognition. This is a narrow exception to the prior external-inference restriction: WavLM scoring still runs locally on the server and supports English only.

## Behavior and boundaries

- Check browser offline-language availability without starting recognition or requesting the microphone. Offer installation only for downloadable languages; remove the dead-end Record/setup loop for unavailable languages.
- **Use online word recognition** defaults unchecked. Before recording, disclose browser-provider voice processing and internet requirements. Reset permission on phrase change, navigation away and backgrounding. No silent online fallback or automatic provider retry.
- Use `en-US` or `fil-PH`. Online service and language availability depend on the browser/provider; failures remain errors. Recognition highlights words and completes a finalized phrase but generates no pronunciation score.
- **Practise with recording and playback** uses the existing private temporary recorder, with a 29-second limit. It performs no upload, recognition, scoring, history or completion write. Unmount on blur/background releases recording resources; deletion is best effort, not secure erasure.
- Remove the unavailable WavLM action in demo mode and explain its requirements. No demo authentication bypass, fabricated acoustic score, lowered memory guard, backend permission, scheduler, research or database change.

## Changed files for this fix

Under `apps/mobile/src/features/pronunciation/`: `browserOfflineSpeech.ts`, `LocalRecordingPractice.tsx`, `LivePronunciationPractice.tsx`, `liveWordTracking.ts`, `useLiveWordTracking.ts`, `liveSpeech.web.ts`, `WavLMPractice.tsx`.

Tests: `scripts/live-pronunciation.test.cjs`, `scripts/wavlm.test.cjs`.

## Verification and limitations

Synthetic component/driver fixtures cover unavailable/downloadable/installed offline languages, explicit online permission, service failure, actual recording controls, recognition lifecycle and existing whole-phrase behavior. Commands: `node scripts/live-pronunciation.test.cjs` (20 passed), `node scripts/native-audio-recorder.test.cjs` (4 passed), `node scripts/wavlm.test.cjs` (4 passed). Mobile `npm run typecheck` passed; `npm run lint` passed with 0 errors and 29 existing warnings.

No agent microphone/provider accuracy test was performed. Browser automation was unavailable (`browser.user is unavailable`). The user's eight-word completion screenshot demonstrates recognition, not WavLM inference. The backend configuration probe remains disabled; free RAM was 0.75 GiB versus a 4 GiB model-loading minimum. Real model inference/latency and accent accuracy remain unverified.

## Try it

Reload the app, choose a phrase, select **Use online word recognition**, allow the microphone, press **Record**, and read the full sentence. If the online provider fails, try Chrome/Edge or use local recording/playback. The feature cannot guarantee provider support for Tagalog.

Actual English acoustic scoring separately requires an authenticated live backend and a running WavLM model; the demo adapter has no live scoring connection.

References reviewed: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally , https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static , https://docs.expo.dev/versions/v58.0.0/sdk/audio/ .
