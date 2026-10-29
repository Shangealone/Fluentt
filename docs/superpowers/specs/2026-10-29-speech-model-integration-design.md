# Fluentt Wav2Vec2 and WavLM integration

**Status:** Integration implemented in the tracked app (2026-10-29); verification in progress. Candidate model artifacts and a compatible Android device remain required for real inference/device checks. Learner capabilities remain disabled.

## Active project and spec relationship

- The target is the tracked repository root on `fluentt/main` (`73676bc`): Expo app in `mobile/`, FastAPI service in `backend/`. The separate `.local-version-2` folder is not the active tracked application and is not part of this integration.
- This root app already caches published lessons in SQLite and queues its existing vocabulary-review events for sync. It has no speech screen, recorder, speech API, model runtime, or pronunciation-result history. Reuse its existing content cache, authentication, and API conventions; do not copy the unrelated old app's screen/session architecture.
- The earlier [P02 pronunciation specification](../../development/p02-pronunciation-architecture-scoring-spec.md) selected Azure for a different proposed vertical slice. This versioned, user-approved direction replaces that provider and target choice with Wav2Vec2 plus WavLM. Preserve P02's separation from review/scheduling, truthful failures, audio minimization, and formal research approval gates. Do not edit the historical P02 document.

## Intent and model roles

Add a connected speech-practice flow to the current Android-first learner app, keeping its existing limited offline lessons and review behavior.

- **Wav2Vec2** recognizes speech and supplies provisional word-match feedback. Word recognition is not a pronunciation score.
- **WavLM** separately assesses a completed recording and returns only genuine model output. It does not replace speech recognition.

## Candidate readiness

- `origin/codex/wav2vec2-local-speech` currently uses `facebook/wav2vec2-lv-60-espeak-cv-ft`, which emits phonemes. Its English words are estimates from a pronunciation lexicon; general Tagalog word recognition is unavailable. Its development endpoint and web recorder are not suitable to expose directly to an APK.
- `origin/version-3` contains an English-only WavLM scoring candidate. Its predictions are unvalidated, model assets are not present in the active app, and the measured runtime needs at least 4 GiB of free memory. The worker must report unavailable when assets or capacity are absent.
- These checkpoints are integration candidates, not evidence of final English or Tagalog support. Both normal learner capabilities remain off until the group selects/trains an artifact and completes a language-specific held-out validation. No training, restricted dataset access, or model download is part of this work. Tagalog stays unavailable until it has its own supported artifact and validation.

## Online speech flow

- Add an authenticated speech API to the current FastAPI backend and a separate model-worker boundary so PyTorch/Transformers and model memory do not inflate or destabilize the ordinary API process. Port only needed decoding/scoring logic; do not merge either source branch wholesale.
- Model artifacts are supplied at configured local paths and never downloaded at request time. Capability responses identify the language/model status and return unavailable by default. A separate server-side allowlist may expose real, unvalidated candidate output to internal QA users only, with a visible “internal model test; not a learner score” label. Learner capability stays off until validation. There is no Azure, device-recognition, or simulated fallback.
- Use the existing mobile bearer session and owner checks. The server resolves the exact published vocabulary revision/release and target text; it does not trust client-provided reference text, owner IDs, or language claims.
- Android captures foreground mono PCM with Expo SDK 57 `expo-audio`'s audio-stream API. Request 16 kHz signed PCM16, inspect actual sample rate/channels, and fail or safely resample when the device differs. Stream bounded snapshots for provisional Wav2Vec2 updates; final recognition follows Stop. Updates may revise until final. The recording is held in memory only and capped at 10 seconds.
- WavLM runs only after a complete recording and a separate deliberate assessment choice. Its response contains only finite model-returned values and model identity/version. Never compute a score from recognized words, invent a result, or show an unvalidated candidate score as a learner assessment.
- Require distinct, clear permission before sending audio for recognition and for assessment. Capability stays disabled for field participants until the approved school/research protocol authorizes that specific processing of minors' audio.
- Bound requests, worker concurrency, and queue length. Return a clear busy/unavailable response when capacity is full. No retry may cause an unnoticed duplicate inference.
- Raw PCM stays in memory or a bounded per-request temporary area that is removed after processing. Do not persist recordings, transcripts, scores, or pronunciation events, and do not write to the review scheduler or current research-event ledger. A future saved-score/history or formal research-collection feature requires its own approved data contract.

## Offline behavior

- Keep the existing SQLite cache of previously fetched published lessons and the existing review sync queue unchanged. They already provide limited offline learning in this branch.
- Speech recognition and assessment require a reachable API. No audio, speech transcript, model result, or new speech-practice event is placed in the offline queue. When offline, cached lessons remain usable and speech actions report that a connection is needed.
- Sign-in/refresh failure, expired sessions, account switching, and access errors must never use protected content as an authentication fallback. Do not cache new classroom, research, answer-key, or grade data.

## Model evaluation boundary

- Evaluate ASR against verified transcripts, reporting English and Filipino/Tagalog separately. Evaluate pronunciation scores against independent human ratings, never against ASR transcript matching.
- Keep the 60 participating students out of model training and threshold tuning. Freeze identical app and model revisions before the first 30-student section and keep them unchanged for the second section.
- Measure worker memory, latency, failure rates, back-pressure, and output quality with realistic network conditions and up to 30 concurrent learners before either capability is enabled for field use.
- No result should be described as proficiency, certification, a research outcome, or a pronunciation grade without a separately approved and validated measure.

## Scope and acceptance

Included: model-worker adapters, authenticated API contracts, Android streaming capture, honest capability/error states, temporary audio handling, and compatibility with existing offline lessons/review sync.

Not included: training, dataset procurement, public model hosting, score/history persistence, new research writes, Tagalog capability without validation, full offline model inference, or a release APK build.

Acceptance requires that: authenticated English Wav2Vec2 requests can return actual provisional/final recognition from a configured real artifact; WavLM runs only on completed recordings and returns only actual finite output; unsupported language, missing artifact, offline network, invalid audio, session loss, and saturated workers never produce a match or score; raw audio is never permanently stored or queued offline and any bounded worker temporary WAV is removed; existing lesson cache and review sync tests remain intact; and no pronunciation output mutates review, scheduling, progress, or research ledgers.

## Operator setup

See the [Wav2Vec2 worker setup](../../../speech-workers/wav2vec2/README.md) and
[WavLM worker setup](../../../speech-workers/wavlm/README.md). The active app's
native capture uses SDK 57 PCM streaming. Its installed web implementation does
not provide a PCM stream, so web and incompatible older native clients show
recording unavailable safely. A future browser recording adapter is a separate
addition; no browser/device cloud speech service is substituted.
