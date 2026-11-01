# Section 6 — Bilingual Voice safety and usability hardening

Date: 2026-10-30. **Implementation/tests: PASS for the checks below. Overall delivery: PARTIAL**, pending real-device acceptance, deployment privacy/licensing decisions and independent English model validation. **Tagalog pronunciation ratings remain unavailable.** No speech model was loaded, downloaded or redistributed; no new accuracy or real-recording inference result is claimed.

## Scope and evidence

Read Section 5 and the Allosaurus Stage 1–4A.2 reports/permission tracker before implementation. Preserve their findings: preliminary phone recognition is not pronunciation validation, stress prediction is unsupported, independent Tagalog evaluation remains NO-GO, and further dataset clearance/research is deferred. This section changes the ordinary Voice safety boundary, not the Allosaurus roadmap or learning/research algorithms.

The working tree already contained substantial uncommitted bilingual integration work. A pre-change file-hash inventory was retained in ignored `services/api/private-data/voice-section6/baseline.json`; the file list below is relative to that inventory, not a misleading diff against Git HEAD. Earlier reports remain unchanged.

## Route, service and consumer inventory

Paths below have prefix `/api/v1/me/pronunciation`, except the conversation route.

| Path/consumer | Score source and final behavior |
|---|---|
| `GET /activities`, `/activities/{id}` | Activity/reference metadata only. Existing activity behavior preserved. |
| `GET /capabilities` | Explicit `wavlm`/`mms` selection, model/license/resource readiness; no predictions. Existing strict language contracts preserved. |
| `POST /attempts`, engine `wavlm` | Existing English-only real WavLM service, strict result contract, consent/version/request UUID, alignment and model failure handling unchanged. |
| `POST /attempts`, engine `mms` | Existing Tagalog-only real MMS service; recognized text and normalized reference comparison, null overall score, pronunciation scoring unavailable. No fallback rating. |
| `POST /attempts`, omitted engine or `legacy` | Authenticated **409 `legacy_speech_unavailable`**, before legacy database/file writes or inference. Old requests lack the explicit consent/version/retry contract; no automatic engine substitution. |
| `GET /attempts`, `wavlm`/`mms` | Existing engine-specific validated history unchanged. |
| `GET /attempts`, default/`legacy` | Retained history stays readable, with `score=null`, `scoring_status=unsupported`, `pronunciation_scoring=unavailable`, and neutral feedback. Retained numerical/diagnostic feedback is not exposed. Simulated transcripts are suppressed. |
| `POST /attempts/{id}/transcribe` | Ownership checked; **409**, including forced retry. Does not read retained audio or copy expected text. Modern retained results remain protected by the existing guard. |
| `GET /attempts/{id}/transcription` | Ownership checked; retained nonsimulated text may remain; simulated text is hidden, unavailable state explicit. No numerical feedback. |
| `POST /attempts/{id}/evaluate`, `GET /attempts/{id}/assessment` | Owned legacy records return a compatible **200 unavailable envelope**, `score=null`, `assessment=null`, no evaluator reference. Read-only projection; stored evidence is not rewritten. Modern results retain their existing protection and dedicated history. |
| `GET /classes/{id}/attempts` | Existing owner-authorized English WavLM monitoring only; unchanged. |
| `/whole-phrase/capabilities`, `/whole-phrase/assess` | Separate optional English-only Azure capability; already rejects Tagalog, remains unchanged and is not enabled here. No new service purchased/authorized. |
| `/api/v1/me/conversation/sessions/{id}/messages` | Audio linkage previously copied `attempt.score` and attempted legacy processing. Now uses only nonsimulated retained text from the owned session's context; never auto-transcribes/evaluates or returns a pronunciation number. Unsupported audio returns 409; unmatched context returns 404. Text/conversation feedback behavior is otherwise unchanged. |

There is no separately registered speech recognizer router. The legacy speech factories no longer instantiate the simulated recognizer/evaluator by default: they fail closed. Historical deterministic classes remain explicitly documented as isolated test fixtures; they are not connected to student inference. The historical model-registration helper remains for compatibility/test fixtures, with no runtime scoring caller.

Modern selection uses canonical `english` → WavLM and `tagalog` → MMS. Unsupported modern language/engine combinations remain rejected rather than translated into a score. Legacy denial/projection does not depend on spelling: tests include `tagalog`, `tl`, `fil`, `filipino`, `Tagalog`, `english` and `en`. These tests do not claim every alias is accepted by the canonical modern API.

Mobile consumers inspected: `pronunciationAccess` and its legacy helpers, strict `wavlm.ts`/`mms.ts`, the current `WavLMPracticeOption` result UI, personal live/whole-phrase practice, school `VoicePracticeFallback`, local record/playback, the dormant `PronunciationPractice`, instructor summary, pronunciation demo and conversation audio/demo. Demo pronunciation no longer fabricates prompt-copy transcripts, timing/confidence, fixed phone scores or an 88.5 rating. Demo conversation no longer assigns 92.5 for audio.

## Contract and UI changes

Legacy response serializers permit **only null** score/assessment values; `pronunciation_scoring=unavailable` is explicit. Old fields/identities/history remain, but a new legacy upload cannot silently succeed with a fake result. Both English and Tagalog legacy ratings are disabled: real English results remain accessible through the unchanged WavLM contract, not this obsolete projection.

The mobile compatibility adapter also masks nested assessments, flat score aliases, phone diagnostics, confidence and score-bearing messages from older server responses. The dormant component applies the same masking even to a supplied legacy adapter. Genuine model clients do not pass through this mask.

Tagalog consent, retry and history labels now refer to transcription/text comparison. Shared failure wording says speech processing rather than scoring. The incorrect claim that a failed request cannot have saved a result is replaced by original-request retry/history reconciliation guidance. Memory unavailability distinguishes available RAM from installed RAM. Privacy copy describes temporary server cleanup and best-effort device cache cleanup rather than promising universal erasure.

English score semantics are unchanged: learned phone outputs, word means, overall phone mean, error threshold and unvalidated-prediction disclaimer remain. MMS comparison/normalization, unavailable calibrated confidence, repeat recording and model-specific history remain. No transcript difference is promoted to a verified pronunciation error. Allosaurus and stress analysis remain outside student results.

## Audio privacy and memory

Disabling the old writer removes new durable legacy recording creation and its storage-exception path exposure. Existing recordings/rows are not deleted or migrated. **Path correction to Section 5:** the old `parents[4]` expression actually resolves to `services/storage/audio`, not `services/api/storage/audio`. Both locations are now ignored by Git. An initial historical test wrote a synthetic byte-pattern file there; only that exact verified generated fixture was removed. Subsequent legacy-refusal tests assert no files or attempts are created.

Modern temporary-audio handling is unchanged and exercised through decoding, failure and timeout tests. Still unresolved: retention/deletion approval for historical recordings and saved transcripts/feedback, backup/log access, process-crash orphan cleanup, native deletion failure and secure-erasure guarantees. No retention interval or rightsholder approval was invented. Normal temporary cleanup is not a crash-recovery guarantee.

Direct Section 6 measurement, without model loading: **15.8645 GiB total physical, 6.0668 GiB available**. The unchanged MMS gate requires **8 GiB available**; this measurement fails it. WavLM retains its 5 GiB available cold-load gate. Total RAM, process peak and available RAM are different quantities.

Prior evidence, not new benchmarks: Stage 1's serial MMS run reports approximately **4.0811 GiB peak**, **29.356 seconds loading**, **8.475 seconds inference** for a 12.3-second clip; earlier whole-runtime accounting reports higher peaks. Imports, temporary tensors/decoder work, API/client/OS allocations and transient demand require headroom beyond one observed peak. Those tiny runs do not justify lowering the 8 GiB gate. An 8 GB Windows machine cannot reliably meet it; use a backend with sufficient measured free memory. Loaded-worker reuse and sequential language switching remain unchanged. The shared model lock is process-local, so deployment must also control API process count/concurrency.

Tests explicitly show that 7 GiB available produces **503 `mms_insufficient_memory` without starting a subprocess**. UI retains local practice/recheck when the capability is unavailable. No real MMS inference ran on this PC during Section 6.

Existing NOTICE findings remain unresolved deployment questions: MMS is identified as CC BY-NC 4.0, and its acknowledgement flag is not a rights grant; the WavLM scorer's declared MIT metadata lacks the pinned upstream copyright/license notice; separate backbone/alignment/language-resource/FFmpeg obligations apply. Allosaurus GPL software and checkpoint clearance stay separate and deferred. No legal clearance, commercial deployment, new provider or checkpoint distribution is claimed.

## Executed checks and actual outcomes

All model results in API/client tests are explicitly synthetic fixtures/doubles. Audio-runtime tests decode generated tone/silence with FFmpeg; they do not evaluate human speech or load checkpoints.

Commands below run from `services/api` unless marked repository root. The interpreter is `private-data/api-runtime/.venv/Scripts/python.exe`.

```powershell
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest tests/test_voice_safety.py tests/test_pronunciation.py tests/test_speech_recognition.py tests/test_pronunciation_assessment.py tests/test_wavlm.py tests/test_mms.py tests/test_whole_phrase.py tests/test_speech_audio_runtime.py tests/test_conversation_practice.py -q --tb=short
./private-data/api-runtime/.venv/Scripts/python.exe private-data/voice-section6/run_pg.py
# Repository root:
node --test scripts/voice-safety.test.cjs scripts/pronunciation.test.mjs scripts/wavlm.test.cjs scripts/live-pronunciation.test.cjs scripts/native-audio-recorder.test.cjs scripts/whole-phrase.test.mjs scripts/conversation.test.mjs
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile run lint
git diff --check
```

The ignored PostgreSQL launcher loads the local maintenance credential without printing it, requires a loopback host, and invokes `tests/integration/test_wavlm_postgresql.py` and `test_mms_postgresql.py`. Existing fixtures create/migrate/drop **only generated UUID-named test databases**. The developer/production database is never migrated/reset by these tests.

| Final check | Actual result |
|---|---|
| Backend speech/conversation safety suites | **162 passed**, 7.64 s, zero failures/skips/deselections |
| Disposable PostgreSQL WavLM/MMS suites | **13 passed**, 14.18 s; two dependency deprecation warnings |
| Mobile/client/recorder/whole-phrase/conversation suites | **46 passed**, zero failed/skipped; approximately 2.929 s |
| Mobile typecheck | PASS, exit 0 |
| Mobile lint | PASS with **0 errors, 30 warnings** in existing unused-variable/dependency patterns; no claim of warning-free lint |
| Whitespace check | PASS |

The first restricted backend run stalled at the upload-limit test. A focused rerun with `-o faulthandler_timeout=10` showed the stack in Windows `socket.accept` → `_fallback_socketpair` → asyncio event-loop creation, **before upload handling**. It was interrupted. Running with local socket access then passed the upload-limit test in the complete suite; no application limit or test assertion was weakened. An intermediate run excluding it passed 155 checks, but that is not the final result above.

Initial older tests expected the retired legacy processing behavior and were updated to assert refusal/unavailable results. The first expanded PostgreSQL run had **12 passes, 1 failure** because the new historical-score fixture omitted its required evaluator configuration. The fixture was corrected to satisfy the existing database guard; no schema/constraint was changed. The final 13-pass run includes that regression. Earlier runs and partial progress are not added to final counts.

New safety coverage includes omitted/explicit legacy engine, service-level refusal before storage, canonical/alias inputs, retained nested numerical evidence and misleading feedback masking, null-only serializers, default factories, silence/mismatch/low-confidence legacy states, modern memory refusal without loading, owned and missing records, read-only history preservation, demo rejection, old-server client responses, and conversation audio rejection/context binding. Existing suites continue to exercise English model contracts, MMS comparison, failure/invalid audio, consent, idempotency, actual synthetic-signal decoding, model reuse, concurrency and scheduling-history boundaries.

## Exact files changed in Section 6

Modified:

- `.gitignore`
- `apps/mobile/src/demo/demoData.ts`
- `apps/mobile/src/features/pronunciation/PronunciationPractice.tsx`
- `apps/mobile/src/features/pronunciation/WavLMPractice.tsx`
- `apps/mobile/src/services/api/pronunciation.ts`
- `scripts/pronunciation.test.mjs`
- `services/api/app/modules/conversation/service.py`
- `services/api/app/modules/pronunciation/schemas.py`
- `services/api/app/modules/pronunciation/service.py`
- `services/api/app/modules/speech/asr_engine.py`
- `services/api/app/modules/speech/evaluator.py`
- `services/api/app/modules/speech/schemas.py`
- `services/api/app/modules/speech/service.py`
- `services/api/tests/integration/test_mms_postgresql.py`
- `services/api/tests/test_conversation_practice.py`
- `services/api/tests/test_pronunciation.py`
- `services/api/tests/test_pronunciation_assessment.py`
- `services/api/tests/test_speech_recognition.py`
- `docs/DECISIONS.md` (appended Section 6 boundary)

Added:

- `scripts/voice-safety.test.cjs`
- `services/api/tests/test_voice_safety.py`
- `docs/VOICE_BILINGUAL_SECTION6.md`

Ignored local evidence includes the baseline, resource measurement, PostgreSQL launcher and mobile output logs. No credentials, model weights or recordings are added to source.

## Preservation and remaining acceptance

Hash comparison against the initial inventory confines source changes to the listed files. WavLM/MMS model loaders, pipeline/contracts, feature flags and ignored backend settings remain unchanged. Stage 1–4A.2 reports, allocation, FSRS-6/FIFAKT, Personal/Class Learning scheduling, migrations and administrator functionality are not changed. The conversation edit is limited to the identified speech-rating propagation/ownership boundary; it does not redesign conversation learning.

Before declaring an operational release, restart/reload the development services with these changes and perform consented authenticated native/web recording acceptance on adequate hardware: microphone denial, stop/background/discard, reference voice availability, actual English output, actual Tagalog transcript, failure/retry with a lost reply, history and temporary-file cleanup. Test screen-reader/focus behavior and target-platform interruptions. No such new device/model execution is claimed here. Resolve deployment privacy/rights and measure cold/warm latency/memory under actual load. Independently validate English pronunciation before academic-grade or effectiveness claims. Tagalog phone/stress scoring remains unavailable regardless of ASR agreement.

**Section 6 stops here.** No commit, push, deployment, new model activation or subsequent section was performed.
