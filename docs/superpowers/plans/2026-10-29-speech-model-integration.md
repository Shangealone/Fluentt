# Wav2Vec2 and WavLM Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated online speech recognition and pronunciation assessment to the tracked `fluentt/main` Android app, using Wav2Vec2 for word feedback and WavLM for completed-recording assessment while keeping the existing offline lesson and review features intact.

**Architecture:** The existing FastAPI backend authenticates the learner with `get_current_user`, resolves the exact published vocabulary revision with `resolve_review_content`, validates bounded PCM audio, and forwards it to two isolated model workers. The Expo SDK 57 client captures foreground audio, sends throttled cumulative snapshots for Wav2Vec2, and sends a finished clip to WavLM only after separate permission. Normal learner capabilities default off. A server-side user-ID allowlist may expose real, unvalidated candidate output only in a visibly labeled internal QA mode. Existing SQLite content caching and review synchronization remain as they are.

**Tech Stack:** Expo SDK `~57.0.24`, React Native `0.86.3`, `expo-audio ~57.0.5`, Expo Router, Jest; FastAPI, Pydantic, SQLAlchemy, current bearer-token auth; isolated Python model workers using separately locked PyTorch/Transformers environments.

**Spec:** `docs/superpowers/specs/2026-10-29-speech-model-integration-design.md`

## Global Constraints

- Work only in tracked root `mobile/` and `backend/` on `fluentt/main`; do not port the old `.local-version-2` app or merge either speech branch wholesale.
- The user-approved Wav2Vec2/WavLM direction supersedes P02's Azure provider choice; do not modify `docs/development/p02-pronunciation-architecture-scoring-spec.md`.
- Keep `en` as the only candidate language; `fil` recognition and scoring stay unavailable until their own artifacts and validation are approved.
- Default both learner capabilities to disabled. No model download at runtime and no PyTorch/Transformers dependency in the normal API environment.
- Capture foreground mono little-endian PCM16 only, for at most 10 seconds and 1 MB per request. Request 16 kHz but validate actual channel count, sample rate (8–48 kHz), bytes, duration, and non-silence on the server. Do not trust a client language, target phrase, or owner ID.
- Do not persist audio, transcripts, pronunciation scores, or speech events. Do not write to the review queue, scheduler, progress analytics, or research-event ledger.
- Speech requires a live authenticated API connection; no audio, transcript, or speech result may enter SQLite or the existing offline review queue.
- Keep raw audio in memory or a bounded per-request temporary area removed after processing. Never log audio, transcripts, or unrestricted model output.
- No model-training, dataset-procurement, public-hosting, field-enablement, or release-APK work is included.

## Review Focus

1. **A stale content target or switched account during recognition** must not display another learner's late response or assess a changed vocabulary revision. Pin exact release/revision IDs and generation-check every async result.
2. **Unexpected microphone output format** (sample rate, channel count, odd byte length, over-duration or silence) must fail closed before model dispatch.
3. **Expired auth or a lost network response** must not silently replay scoring or leave audio in the offline queue. Do not automatically retry a completed assessment.
4. **Missing model artifacts, unvalidated candidate mode, unsupported Tagalog, insufficient memory or a full worker queue** must return unavailable/busy without a transcript match or score.
5. **Offline use and permission denial** must leave cached lessons usable while speech stays unavailable; microphone and server-processing consent remain separate and deliberate.

---

### Task 1: Define and validate the speech payloads

**Files:**
- Create: `backend/app/speech/__init__.py`
- Create: `backend/app/speech/schemas.py`
- Create: `backend/app/speech/audio.py`
- Test: `backend/tests/test_speech_schemas.py`
- Test: `backend/tests/test_speech_audio.py`

**Interfaces:**
- `PCMRecording` is `{ pcm_le: bytes, sample_rate_hz: int, channels: Literal[1], duration_ms: int }`. `parse_pcm16(body, sample_rate_hz, channels)` derives duration from byte count and rejects empty, odd-byte, over-1 MB, over-10-second, unsupported-rate, non-mono, and silent input.
- `RecognitionResponse` is `{ request_id, sequence, is_final, transcript, words, model_id, model_revision, validation_status }`. Each ordered `words[]` item is `{ target_index, expected_word, recognized_word: str | null, state: pending | match | mismatch }`. It has no score, confidence-derived grade, or pronunciation claim.
- `AssessmentResponse` is `{ status, overall_score: number | null, n_errors: int | null, words, duration_ms, model_id, model_revision, validation_status }`. Each bounded ordered word may contain actual model word score and phoneme predictions from WavLM. A score is present only when the model returned a finite value in `[0,100]`; invalid or absent output is unavailable, never coerced to zero.
- Mobile sends binary PCM in `application/octet-stream` with explicit metadata headers: `X-Speech-Request-Id`, `X-Speech-Session-Id`, `X-Speech-Sequence`, `X-Speech-Final`, `X-Audio-Sample-Rate`, `X-Audio-Channels`, `X-Content-Item-Id`, `X-Content-Revision-Id`, `X-Content-Release-Id`, and the applicable versioned consent header. The API resolves language from the immutable release and reference text from the revision; the client never supplies either as authority or an owner ID.
- The normal learner capability mode is `unavailable` until validated artifacts are approved. An allowlisted internal QA user can receive candidate availability tagged `unvalidated_model_prediction`; the client shows “Internal model test — not a learner score.” The user cannot self-select this mode.

- [ ] **Step 1: Add failing tests for PCM validation and strict result schemas**

  Cover 8,000/16,000/48,000 Hz valid mono input; 10-second boundary; empty, odd-byte, stereo, unsupported-rate, oversized, silent, non-finite, out-of-range, missing-score, and extra-field responses. Assert recognition results cannot contain a score.

- [ ] **Step 2: Run the new backend tests and confirm they fail for the missing contracts**

  Run from `backend/`: `uv run pytest tests/test_speech_schemas.py tests/test_speech_audio.py -q`

- [ ] **Step 3: Implement the PCM parser and strict DTOs**

  Derive duration from byte count and actual sample rate, not client duration claims. Use Pydantic strict types and reject NaN/infinity and unknown response fields.

- [ ] **Step 4: Run the targeted tests and confirm all boundary cases pass**

  Run from `backend/`: `uv run pytest tests/test_speech_schemas.py tests/test_speech_audio.py -q`

- [ ] **Step 5: Commit the isolated contract change**

  ```bash
  git add backend/app/speech backend/tests/test_speech_schemas.py backend/tests/test_speech_audio.py
  git commit -m "feat: define bounded speech contracts"
  ```

### Task 2: Add isolated Wav2Vec2 and WavLM workers

**Files:**
- Create: `speech-workers/wav2vec2/app.py`
- Create: `speech-workers/wav2vec2/Dockerfile`
- Create: `speech-workers/wav2vec2/pyproject.toml`
- Create: `speech-workers/wav2vec2/requirements.lock`
- Create: `speech-workers/wav2vec2/README.md`
- Create: `speech-workers/wavlm/app.py`
- Create: `speech-workers/wavlm/Dockerfile`
- Create: `speech-workers/wavlm/pyproject.toml`
- Create: `speech-workers/wavlm/requirements.lock`
- Create: `speech-workers/wavlm/README.md`
- Create: `speech-workers/tests/test_worker_contracts.py`
- Create: `docker-compose.speech.yml`

**Interfaces:**
- Wav2Vec2 worker: `POST /v1/recognize`, raw bounded PCM body plus sample rate, sequence, and final marker; returns actual transcript/phoneme-decoder metadata and pinned model identity, with no score or target-word labels. The API aligns its actual transcript to the server-derived target tokens to create provisional/final `WordMatch` states; this is transcript matching, never an assessment score. Candidate output is tagged unvalidated unless an approved artifact manifest says otherwise.
- WavLM worker: `POST /v1/assess`, raw bounded PCM body plus the exact server-resolved target text; returns the strict actual prediction and pinned model identity. It must not imply that candidate predictions are validated.
- Both expose `GET /health/capabilities` without leaking paths or secrets. Worker-to-backend access uses a private network and a configured service token; workers are not published as mobile-facing ports.
- Model directories and SHA-256 manifest are supplied by configuration. Missing or mismatched artifacts report unavailable; startup and inference never fetch model weights. Keep Wav2Vec2 and WavLM dependency environments independently locked; do not adopt unverified future pins from either candidate branch.

- [ ] **Step 1: Add failing worker contract tests with injected fake models**

  Assert each worker rejects absent artifacts, invalid audio, wrong language, malformed model output, and non-finite results. Assert worker output includes revision/decoder provenance and never marks candidate output as validated.

- [ ] **Step 2: Run worker contract tests and confirm the adapters are absent**

  Run from `speech-workers/`: `python -m pytest tests/test_worker_contracts.py -q`

- [ ] **Step 3: Implement separate worker entry points and fixed artifact loading**

  Port only the CTC/phoneme decoding needed from `origin/codex/wav2vec2-local-speech` and the strict WavLM prediction adapter from `origin/version-3`. Keep their dependency locks separate; do not add either ML stack to `backend/pyproject.toml`.

- [ ] **Step 4: Add private local service wiring and offline-only artifact setup notes**

  Configure internal-only worker URLs/tokens and read-only model mounts. Do not include model files, credentials, dataset downloads, or a public speech endpoint in Compose.

- [ ] **Step 5: Run worker tests and verify no request-time model download path exists**

  Run from `speech-workers/`: `python -m pytest tests/test_worker_contracts.py -q`; inspect worker configuration tests for offline loading and missing-artifact behavior.

- [ ] **Step 6: Commit the isolated worker change**

  ```bash
  git add speech-workers docker-compose.speech.yml
  git commit -m "feat: add isolated speech model workers"
  ```

### Task 3: Add authenticated FastAPI speech endpoints

**Files:**
- Create: `backend/app/speech/worker_client.py`
- Create: `backend/app/speech/service.py`
- Create: `backend/app/speech/router.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/core/config.py`
- Test: `backend/tests/test_speech_api.py`
- Test: `backend/tests/test_speech_service.py`

**Interfaces:**
- `GET /speech/capabilities?language_code=en|fil` returns separate recognition and assessment modes (`unavailable`, `learner`, or `internal_qa`), stable reason codes, model identity, and validation status. Learner mode defaults off; `fil` is unsupported. Internal QA access is controlled by a server-side allowlist of authenticated user UUIDs.
- `POST /speech/recognitions` accepts `application/octet-stream` cumulative PCM snapshots and the metadata headers from Task 1, including stable client session ID, increasing sequence, final marker, actual sample rate, exact content IDs, and versioned recognition consent. The server derives language and expected phrase from the released revision. Response is `RecognitionResponse`.
- `POST /speech/assessments` accepts one complete PCM body with exact content IDs, `X-Speech-Request-Id` as a unique request UUID, actual sample rate/channels, and versioned assessment consent. Response is `AssessmentResponse`. No automatic assessment retry is performed after a network ambiguity.
- `resolve_speech_target(db, item_id, revision_id, release_id) -> SpeechTarget` calls the existing `content.provenance.resolve_review_content` for membership, uses `revision.term` and `release.language_code`, and rejects unsupported/retired releases. All responses include `Cache-Control: no-store`.
- `SpeechWorkerClient` uses bounded connect/read timeouts, a configured internal service token, and bounded concurrency. Busy workers return retryable 503; they do not run inference outside the queue limit.
- Add `speech_internal_qa_user_ids` to backend configuration. The API derives the caller from `get_current_user`; a mobile request cannot enable internal QA by setting a flag or header.

- [ ] **Step 1: Add failing API tests for authentication, exact target provenance and consent**

  Cover unauthenticated calls, inactive auth, mismatched item/revision/release, retired content, no consent, language mismatch, disabled capability, unavailable worker, queue-full behavior, and successful mocked responses. Assert API requests do not commit database writes.

- [ ] **Step 2: Run the targeted tests and confirm the speech router is not registered**

  Run from `backend/`: `uv run pytest tests/test_speech_api.py tests/test_speech_service.py -q`

- [ ] **Step 3: Implement target resolution, capability gates and worker client**

  Resolve the target and release database facts before inference, then close/rollback the read transaction before waiting on a worker. Never pass client-supplied target text or user identity to the model as authority.

- [ ] **Step 4: Register the router and add default-off configuration**

  Add `speech_recognition_enabled`, `speech_assessment_enabled`, internal worker URLs/tokens, maximum active work, and worker deadlines. Production speech URLs must be HTTPS; local development may use the private local worker configuration.

- [ ] **Step 5: Run targeted backend tests and confirm the disabled-by-default behavior**

  Run from `backend/`: `uv run pytest tests/test_speech_api.py tests/test_speech_service.py -q`; then `uv run ruff check app/speech tests/test_speech_api.py tests/test_speech_service.py`.

- [ ] **Step 6: Commit the authenticated API change**

  ```bash
  git add backend/app/main.py backend/app/core/config.py backend/app/speech backend/tests/test_speech_api.py backend/tests/test_speech_service.py
  git commit -m "feat: add authenticated speech endpoints"
  ```

### Task 4: Add secure Android PCM streaming and speech API client

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`
- Modify: `mobile/app.json`
- Modify: `mobile/src/api/client.ts`
- Create: `mobile/src/speech/types.ts`
- Create: `mobile/src/speech/api.ts`
- Create: `mobile/src/speech/useSpeechCapture.ts`
- Create: `mobile/src/speech/__tests__/api.test.ts`
- Create: `mobile/src/speech/__tests__/capture.test.ts`

**Interfaces:**
- `SpeechRequest` is `{ requestId, sessionId, sequence, isFinal, sampleRateHz, channels: 1, itemId, revisionId, releaseId, consentVersion, expectedUserId }`. All content IDs come from a `PublishedVocabularyItem`; `expectedUserId` is used only by `apiClient`'s account guard and is never serialized. Reject speech navigation when the item lacks revision/release provenance.
- `getSpeechCapabilities(languageCode: 'en' | 'fil') -> Promise<SpeechCapabilities>` uses the existing authenticated `apiClient` and rejects malformed contracts.
- `recognizeSnapshot(input: SpeechRequest, pcm: ArrayBuffer) -> Promise<RecognitionResponse>` sends binary PCM with `application/octet-stream`, explicit metadata headers, stable session ID, and strictly increasing sequence. `assessRecording(input, pcm, consentVersion) -> Promise<AssessmentResponse>` is explicit and never automatically replayed after an ambiguous result. Extend `apiClient` with an opt-in binary body mode without changing JSON defaults or bearer-refresh behavior; assessment opts out of replay after a 401.
- `useSpeechCapture({ onBuffer })` wraps SDK 57 `useAudioStream` with mono/int16/16 kHz requested. It reports the actual buffer sample rate, stops on route blur/background/account change, retains no more than 10 seconds in memory, and deletes its buffer on stop/cancel/unmount.

- [ ] **Step 1: Add failing API tests for binary headers, owner binding and unsupported capability**

  Assert JSON API requests keep their existing behavior, PCM requests do not receive a JSON content type, bearer refresh cannot replay an ambiguous assessment, disabled/unsupported language blocks audio submission, and malformed responses are rejected.

- [ ] **Step 2: Add failing capture lifecycle tests with a mocked `expo-audio` stream**

  Cover permission denial, start/stop, 10-second buffer ceiling, actual sample-rate reporting, background interruption, blur, account change, and complete buffer cleanup.

- [ ] **Step 3: Install SDK-matched `expo-audio` and configure foreground microphone permission**

  Run from `mobile/`: `pnpm exec expo install expo-audio`. Configure its plugin with a clear microphone message and `enableBackgroundRecording: false`.

- [ ] **Step 4: Implement binary API transport and `useSpeechCapture`**

  Keep JSON request behavior unchanged. Add a binary body path that sets the supplied content type explicitly, preserves the current bearer/session owner checks, and cannot silently retry an assessment after an ambiguous response.

- [ ] **Step 5: Run speech API/capture tests and the existing auth/offline tests**

  Run from `mobile/`: `pnpm exec jest src/speech/__tests__ --runInBand` and `pnpm exec jest src/auth/__tests__ src/offline/__tests__ src/content/__tests__ --runInBand`.

- [ ] **Step 6: Commit the capture and transport change**

  ```bash
  git add mobile/package.json mobile/pnpm-lock.yaml mobile/app.json mobile/src/api/client.ts mobile/src/speech
  git commit -m "feat: stream Android speech audio securely"
  ```

### Task 5: Add the learner speech-practice screen

**Files:**
- Modify: `mobile/app/(app)/_layout.tsx`
- Modify: `mobile/app/(app)/lessons/[lessonId].tsx`
- Modify: `mobile/src/content/components/VocabularyCard.tsx`
- Create: `mobile/app/(app)/speech/[itemId].tsx`
- Modify: `mobile/src/i18n/locales/en.json`
- Modify: `mobile/src/i18n/locales/fil.json`
- Create: `mobile/src/speech/__tests__/practiceScreen.test.tsx`

**Interfaces:**
- Add a “Practise saying it” action to the published vocabulary card in `mobile/app/(app)/lessons/[lessonId].tsx`; keep the existing `VocabularyCard` presentation and review action intact. Navigation passes `item_id`, `content_revision_id`, `content_release_id`, and `lesson_id`. Omit or disable the action for legacy/unreleased content and while the lesson is offline.
- The practice screen displays a selected target, a clear recording/stop state, actual provisional word matches, final transcript, and a separate WavLM assessment action. It displays a numeric assessment only when learner capability is explicitly enabled and the server returns a valid real score.
- Consent to send audio for recognition and consent to request WavLM assessment are separate controls. Candidate/unvalidated output is restricted to allowlisted internal QA users and visibly labeled there; normal learners see a plain unavailable explanation while flags are off. Do not show transcript controls before recognition consent or the assessment action before its separate consent.
- For Tagalog, offline use, expired session, denied permission, missing capability, or worker failure, the app shows an honest unavailable/retry state. No speech result is fabricated or saved to progress.

- [ ] **Step 1: Add failing screen tests for route provenance, word states and unavailable states**

  Cover exact IDs passed from vocabulary cards, partial word updates that can revise, final mismatch coloring only after recognition settles, no score from word matches, separate consent, unsupported Tagalog, offline/expired session, and no automatic assessment retry.

- [ ] **Step 2: Run the screen tests and confirm the speech route is absent**

  Run from `mobile/`: `pnpm exec jest src/speech/__tests__/practiceScreen.test.tsx --runInBand`.

- [ ] **Step 3: Implement the route, launch action and translated copy**

  Follow the current app screen/card conventions. Keep the interface readable with enlarged text and keyboard/screen-reader navigation; do not add a new design system.

- [ ] **Step 4: Run the new screen tests and existing lessons/navigation tests**

  Run from `mobile/`: `pnpm exec jest src/speech/__tests__/practiceScreen.test.tsx src/content/__tests__/lessons.test.tsx --runInBand`.

- [ ] **Step 5: Commit the learner screen**

  ```bash
  git add "mobile/app/(app)/_layout.tsx" "mobile/app/(app)/lessons/[lessonId].tsx" mobile/src/content/components/VocabularyCard.tsx "mobile/app/(app)/speech/[itemId].tsx" mobile/src/i18n/locales/en.json mobile/src/i18n/locales/fil.json mobile/src/speech/__tests__/practiceScreen.test.tsx
  git commit -m "feat: add online speech practice screen"
  ```

### Task 6: Verify full integration and deployment gates

**Files:**
- Modify: `docs/superpowers/specs/2026-10-29-speech-model-integration-design.md`
- Modify: `speech-workers/wav2vec2/README.md`
- Modify: `speech-workers/wavlm/README.md`
- Test: `backend/tests/test_speech_api.py`
- Test: `mobile/src/speech/__tests__/practiceScreen.test.tsx`

- [ ] **Step 1: Run mobile tests, typecheck, and lint**

  From `mobile/`: `pnpm test -- --runInBand`, `pnpm exec tsc --noEmit`, and `pnpm lint`.

- [ ] **Step 2: Run backend tests and lint**

  From `backend/`: `uv run pytest -q` and `uv run ruff check app tests`.

- [ ] **Step 3: Run real-model and load checks only when approved artifacts and a suitable server are configured**

  Verify real Wav2Vec2 partial/final recognition and WavLM assessment without test doubles, keep raw audio out of logs/storage, measure memory and latency, and test up to 30 concurrent learner sessions. Keep results classified as unvalidated until a separate held-out evaluation is approved.

- [ ] **Step 4: Verify Android microphone and stream behavior in an existing development environment**

  On an Android 13+ device, check permission denial/recovery, actual PCM sample rate/channels, record/stop, route/background cleanup, online word updates, WavLM request, offline lesson fallback, and no audio queueing. This plan does not build or release an APK; report any device/build gate that cannot be run without a later build request.

- [ ] **Step 5: Record readiness gates and leave learner flags disabled until validation is complete**

  Document tested model revisions, actual device/OS, server memory, concurrency, latency and unsupported languages. Do not enable a learner capability based only on unit tests or model loading.

- [ ] **Step 6: Commit the verification notes**

  ```bash
  git add docs/superpowers/specs/2026-10-29-speech-model-integration-design.md speech-workers/wav2vec2/README.md speech-workers/wavlm/README.md
  git commit -m "docs: record speech integration gates"
  ```
