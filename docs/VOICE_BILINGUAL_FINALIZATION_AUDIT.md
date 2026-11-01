# Section 5 — Bilingual Voice feature finalization audit

Audit date: 2026-10-30. Scope: the current local working tree, including its pre-existing uncommitted speech changes. **Overall: PARTIAL; finalization is blocked by a reachable legacy simulated-scoring path.** The modern English WavLM and Tagalog MMS paths have distinct, appropriate result contracts, but the application cannot yet claim that every Tagalog pronunciation-rating path is disabled.

This is a static source/documentation audit, not a deployment certification or a new model benchmark. No application source, settings, models, database records, or earlier research reports were changed. No speech inference, model/dataset downloads, new participant recordings, or tests were executed in this section. Historical test and benchmark results below are attributed to their existing reports.

## 1. Evidence and status definitions

VERIFIED means directly established by the inspected source or retained documentation; it does not imply that a real device executed that behavior today. PARTIAL means implemented or previously exercised with material acceptance gaps. BLOCKED means a necessary prerequisite is missing. NOT IMPLEMENTED means the inspected implementation does not supply that capability.

Read before assessment: `TAGALOG_ALLOSAURUS_PILOT.md`, `TAGALOG_ALLOSAURUS_STAGE2.md`, `TAGALOG_ALLOSAURUS_STAGE3.md`, `TAGALOG_ALLOSAURUS_STAGE4A.md`, `TAGALOG_ALLOSAURUS_STAGE4A1.md`, `TAGALOG_ALLOSAURUS_STAGE4A2.md`, and `TAGALOG_DATASET_PERMISSION_TRACKER.md`. Also inspected the bilingual, WavLM, MMS setup/validation reports, model NOTICE files, contracts, workers, recorder, speech services, route registration, client API adapters, and relevant tests. Stage 4A.2 retains NO-GO for independent Tagalog evaluation: no eligible independently annotated cohort or permission grant was established. Its statement that ratings remain disabled describes the intended research boundary; it does not eliminate the legacy API defect identified here.

Primary source references, relative to this report's repository root:

| Evidence | Files |
|---|---|
| Route registration and legacy dispatch | `services/api/app/api/v1/router.py:28`, `services/api/app/modules/pronunciation/router.py:69`, `:79`, `:181`, `:226` |
| Legacy persisted recording/scoring | `services/api/app/modules/pronunciation/service.py:27`, `:202`, `:247`; `services/api/app/modules/speech/service.py`; `speech/asr_engine.py:244`; `speech/evaluator.py` |
| English model and strict result boundary | `services/api/ml/wavlm/pipeline.py:338`, `:414`; `ml/wavlm/worker.py`; `app/modules/pronunciation/wavlm_contract.py`; `wavlm_service.py:182` |
| Tagalog model and comparison boundary | `services/api/ml/mms/pipeline.py`; `app/modules/pronunciation/mms_contract.py`; `mms_service.py:94`; `speech_text.py` |
| Modern interface | `apps/mobile/src/app/pronunciation.tsx`; `features/pronunciation/WavLMPractice.tsx`; `feedback.ts`; `automaticAssessment.ts`; `services/api/mms.ts` |
| Recording/reference/fallbacks | `features/pronunciation/useAudioRecorder.ts`; `LocalRecordingPractice.tsx`; `VoicePracticeFallback.tsx`; `LivePronunciationPractice.tsx`; `features/learning/useLessonSpeech.ts` |
| Runtime limits and cloud alternative | `services/api/app/modules/pronunciation/wavlm_runtime.py`; `mms_runtime.py`; `whole_phrase.py`; `whole_phrase_router.py`; `services/api/ml/mms/artifacts.py` |
| Configuration/licensing | `services/api/.env.example`; `services/api/app/core/config.py`; `services/api/ml/wavlm/NOTICE.md`; `services/api/ml/mms/NOTICE.md` |

## 2. Current implementation and decisive findings

| Area | Status | Finding |
|---|---|---|
| English actual model integration | VERIFIED / operational acceptance PARTIAL | The explicit `wavlm` path runs the pinned learned scorer and rejects incomplete results. Historical real inference exists; no new inference was performed here. |
| Tagalog MMS integration | VERIFIED / operational acceptance PARTIAL | The explicit `mms` path produces recognized text and normalized reference comparison, with no pronunciation score. Historical real ASR inference exists. |
| Tagalog numerical ratings disabled everywhere | BLOCKED | Default/explicit `legacy` upload and legacy evaluation routes remain registered and can return simulated numerical and phoneme assessments for Tagalog. |
| Independent Tagalog pronunciation scoring | NOT IMPLEMENTED / validation BLOCKED | Allosaurus remains separate research code. Independent validation, stress prediction, and student scoring are not supplied by MMS. Further dataset work is deferred. |
| Language selection, consent, retry, history | VERIFIED in source / PARTIAL end-to-end | Modern UI selects the correct engine, separates result rendering, and keeps an idempotent retry. Real authenticated device acceptance remains unverified. |
| Audio/privacy/deployment clearance | PARTIAL | Modern inference uses temporary audio; legacy audio persists. Saved-output retention, crash recovery, deployment-specific rights and operational controls remain unresolved. |
| Scientific validation | BLOCKED for claimed pronunciation validity | Neither contract tests nor the retained small public-clip runs establish Filipino-accented English pronunciation validity or Tagalog pronunciation quality. |

### 2.1 Priority-zero legacy bypass

`/api/v1/me/pronunciation/attempts` accepts `assessment_engine=legacy` and **defaults to it when omitted**. That branch calls the older recording service rather than either real-model service. The registered `.../attempts/{id}/transcribe`, `.../evaluate`, and assessment/history retrieval paths also retain the legacy implementation. Protection against re-evaluating modern WavLM/MMS results does not prohibit legacy Tagalog evaluation.

The default legacy recognizer is `SimulatedWhisperASR`: its transcript is assigned from the expected text. Its evaluator creates numerical accuracy/fluency/completeness/prosody and phone feedback from transcript matching and fixed heuristics. Results carry simulation provenance, but they remain simulated scores exposed by ordinary authenticated API paths. A module description mentioning GOP is not evidence of acoustic GOP inference. This is a source-established reachable behavior, not a new live API reproduction.

The legacy recording service also writes audio beneath `services/api/storage/audio` and persists the recording location. No expiration/deletion policy was identified in that path. This differs materially from the modern temporary-audio promise.

The currently routed screen uses `WavLMPracticeOption`, with local/live fallbacks; it does not mount the old `PronunciationPractice` component. The school fallback labels retained simulation history and does not display its old numerical scores. Nevertheless, the dormant component and exported legacy client operations remain: the old submit helper omits the engine and therefore selects the backend default. Hiding a component does not close its API.

**Required before finalization:** fail closed on simulated ordinary-runtime scoring/evaluation, including omitted-engine behavior; prevent legacy Tagalog numbers from being projected as current model assessments. Preserve retained rows and provenance rather than rewriting historical evidence. Decide explicitly how old retained recordings will be handled. Do not disable or replace real English WavLM/MMS to accomplish this.

## 3. English result semantics

The model is `Jianshu001/wavlm-phoneme-scorer`, revision `19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da`. Its WavLM backbone revision is `c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c`; alignment revision is `2c733782da5604684829819a5eb744c193fe9398`. Preparation pins artifacts; worker startup verifies prepared hashes and uses the reviewed local implementation rather than model-repository Python.

The worker returns learned phone scores, phone error probabilities/flags, word aggregates, an overall aggregate, and processing/startup metadata. Phone scores are bounded to 0–100; the configured phone-error decision threshold is 0.70. Word scores are means of constituent phone scores; overall score is the mean of phone scores across the utterance. The overall value is **not a separately validated sentence-level grade**. The strict contract requires complete expected-word coverage and coherent error counts, finite bounded values, English language, pinned model provenance, and `unvalidated_model_prediction`. Alignment failures are rejected rather than returned as successful empty/zero-score assessments.

The UI renders these actual fields and derives sound-practice hints from flagged phones. Those hints are fixed advice attached to model predictions, not expert-confirmed diagnoses. An absence of flags is not proof of perfect pronunciation. There is no demonstrated calibrated confidence, independent fluency/prosody assessment, or Filipino-accent fairness validation in this path. Retain the existing unvalidated/not-an-academic-grade disclosure.

Historical public English clip runs demonstrate that the pipeline executed. They do not establish an independently held-out evaluation: scorer-training overlap and relevance to FLUENTT learners are unresolved. A separately designed, appropriately annotated held-out evaluation is still required before claiming pronunciation validity or using the values academically.

## 4. Tagalog result semantics and labels

MMS uses `facebook/mms-1b-all`, revision `3d33597edbdaaba14a8e858e2c8caa76e3cec0cd`, adapter `tgl`. Expected reference text does not enter its acoustic decoder. The backend preserves the original reference/transcript and separately normalizes text for comparison: NFC, case folding, apostrophe normalization, selected punctuation handling and whitespace collapse. Diacritics and meaningful spelling distinctions are retained. Word comparison uses sequence alignment of normalized text, reporting matches, substitutions, insertions and omissions.

The strict MMS contract returns `status=transcribed`, `overall_score=null`, `pronunciation_scoring=unavailable`, and unavailable calibrated utterance confidence. Persistence stores an unscored attempt. The modern client requires that result type and renders recognized speech plus text differences, with an explanation that differences may be recognition errors or different spoken words. It does not turn exact-match status, WER, or text similarity into a pronunciation percentage. **This modern branch satisfies the intended Tagalog boundary; the legacy branch does not.**

No stress, glottal-stop quality, mispronounced-phone diagnosis, or learner pronunciation correctness can be inferred from this contract. Allosaurus's preliminary output is not connected to student results and supplies no validated stress analysis. Do not add it as a fallback or continue dataset clearance under this section.

Minor current-interface wording needs correction: the Tagalog flow shares generic “assessment/model feedback” consent and a fallback “Scoring did not finish” error. Prefer transcription/text-comparison language. More seriously, history says “Failed requests do not create completed records.” An unknown network outcome may follow a committed result; show an unconfirmed outcome and offer original-request retry/history reconciliation instead.

## 5. Interaction, accessibility, and boundaries

The screen exposes All/Tagalog/English activity filtering; selecting an activity routes to its language-specific real engine. Focus/session generation checks clear protected state and ignore late responses. Modern recording requires explicit consent; full recorded audio is submitted once after stopping, with a roughly 29-second client limit against the 30-second server limit. This is not streaming assessment or automatic end-of-sentence detection. Retry preserves the original audio and request UUID; engine-specific history supports refresh/paging. Both services authorize before inference and revalidate before persistence, including ordinary-class ownership/membership/research boundaries.

Reference playback uses device text-to-speech, including available English/Filipino/Tagalog voices; missing voices and playback errors are handled. It is not a verified native-speaker phonetic reference. Installed voices and platform settings determine availability; offline availability was not demonstrated on every target device. Local-only recording/playback remains a distinct unscored practice mode.

Personal live word tracking also has device/optional online browser-recognition behavior. A separate English-only whole-phrase Azure path exists with its own configuration/authorization requirements. It is not MMS or WavLM; current configuration does not explicitly enable Azure and its default is disabled. Its presence alongside local-model options can confuse users about which assessment they are enabling. Do not acquire a paid provider or enable it as part of local-model finalization. Existing personal activity journaling must not be described as pronunciation grading or scheduler evidence.

Shared buttons have accessibility roles/labels/disabled state and error text has alert semantics. This is only partial evidence: selected language/consent state announcements, focus after results/errors, recording status, keyboard operation, contrast, screen-reader order, permission denial, interruption and TalkBack/VoiceOver behavior need actual device acceptance. Source exports and Node tests do not prove microphone or native execution.

No treatment-dependent Voice branch was identified in the inspected modern paths. Keep the same practice capability across both research groups. This audit neither modifies nor validates FSRS-6/FIFAKT algorithms, assignment allocation, or Personal/Class Learning scheduling. Ordinary speech history is not research enrollment or consent.

## 6. Resources, storage, privacy and licenses

Modern uploads are bounded to 10 MiB, decoded to mono 16 kHz PCM, and checked for 0.5–30 second duration and low energy. The energy threshold is not a validated speech detector; noise or ASR hallucinations still need explicit acceptance coverage. The backend uses temporary directories and removes normal-path/error/timeout audio. Native private recordings use best-effort deletion of owned cache files. These controls do not prove secure erasure or cleanup after a process/OS crash; no complete orphan-reconciliation policy was verified. The legacy durable-audio path is an explicit exception requiring resolution.

English feedback and Tagalog reference/transcript/comparison are saved against authenticated history. They remain sensitive even when raw audio is deleted. No complete deployment-approved retention/deletion schedule, backup policy, or user deletion workflow was established by the inspected speech documentation. Confirm production transport, storage/access controls, logs and backup handling before deployment. Browser online recognition and the optional cloud path must have mode-specific disclosure; “all Voice processing stays local” would be inaccurate for those modes.

Configuration inspection found WavLM and MMS enabled in the ignored local environment and MMS noncommercial acknowledgement enabled. This establishes configured intent only: it does not prove the running process has reloaded those settings, that capabilities are ready, or that an authenticated recording succeeds. No live readiness endpoint was called because capability handling can release an idle model worker.

Cold-load safety gates are **5 GiB available RAM for WavLM** and **8 GiB available RAM for MMS**, not installed-memory requirements. An 8 GB Windows machine cannot reliably satisfy the MMS gate after OS/application overhead; nominal GB and GiB also differ. Keep the threshold. A practical deployment is a backend machine with sufficient measured free memory while FLUENTT is running (typically at least 16 GB installed, still subject to measurement), with lighter client devices connecting to it. No GPU is required by the CPU-capable integration; GPU memory, dependencies and latency still need target-specific verification.

Both models use reusable offline subprocesses and a shared lock; switching releases an idle alternate model and concurrent work is rejected rather than loading both. This resource coordination is process-local: multiple API worker processes could each load weights. Limit deployment concurrency/process count or establish a cross-process resource budget before scaling.

Historical Stage 1 sequential MMS evidence reports about **4.0811 GiB peak**, **29.356 s loading**, and **8.475 s inference** for a 12.3-second clip. Other earlier MMS measurements use different peak accounting and report larger totals. Historical English setup includes a worker-tree peak about **4.095 GiB**, with substantial system-memory pressure. These are historical observations, not current Section 5 measurements or p95 guarantees. Stage 3 correctly refused a new MMS load with only about 6.17 GiB available.

Licensing remains deployment-specific:

- English scorer metadata declares MIT, but the pinned upstream revision lacks its LICENSE/copyright notice; the local [WavLM NOTICE](../services/api/ml/wavlm/NOTICE.md) records unresolved notice/redistribution review. Backbone, alignment, G2P/language resources and FFmpeg have separate terms.
- The [MMS model card](https://huggingface.co/facebook/mms-1b-all) and local [MMS NOTICE](../services/api/ml/mms/NOTICE.md) identify [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). An acknowledgement flag or thesis purpose alone is not deployment clearance. Preserve attribution and assess actual noncommercial use.
- Allosaurus GPL-3.0 software obligations and unresolved checkpoint rights remain documented in Stages 3–4A.2. Do not package its research environment/checkpoint into the feature. Further clearance is deferred, not silently granted.

No new external legal verification or rightsholder contact occurred in this audit; these findings preserve the checked-in NOTICE and prior source-backed research evidence rather than certifying legal permission.

## 7. Test and validation evidence

Inspected coverage includes `test_wavlm.py`, `test_mms.py`, `test_speech_audio_runtime.py`, PostgreSQL WavLM/MMS integration tests, `scripts/wavlm.test.cjs`, and the live-pronunciation/pronunciation test scripts. They cover strict contracts, fabricated-value rejection, language routing, normalization, worker reuse, memory/license gates, invalid audio, temporary cleanup, timeout/upload bounds, consent, idempotency and history/access boundaries. Many use doubles or generated signals; these are functional tests, not human pronunciation validation.

Historical evidence only:

| Source | Recorded outcome and interpretation |
|---|---|
| `MMS_LOCAL_VERIFICATION.md` | 115 backend speech tests and 10 disposable-PostgreSQL speech checks passed in that run. Not rerun here. |
| `TAGALOG_ALLOSAURUS_STAGE3.md` | 115 relevant backend tests, including upload limit, and 34 mobile speech/pronunciation tests passed. Earlier upload-limit stall was attributed to Windows test-environment socket setup; do not claim a new pass or an unresolved product upload hang from that history alone. |
| `MMS_LOCAL_VERIFICATION.md` | Three public FLEURS clips: WER approximately 10.45%, CER approximately 3.03%. Tiny ASR diagnostic, not pronunciation validation or representative production accuracy. |
| English setup/validation reports | Actual public-clip English model execution, plus synthetic functional checks. No adequate independent Filipino-accented held-out pronunciation evaluation established. |

Missing finalization evidence: negative tests across **all legacy/default-engine scoring and read paths**; authenticated real-device consent/record/stop/upload/result/history; lost-response reconciliation; permission denial/background/unmount; supported audio containers, silence/noise and very short speech; concurrency and repeated language switching under resource pressure; cold/warm latency distributions and memory peaks with API/client running; crash cleanup; accessibility acceptance. Typecheck/lint outcomes from older reports do not certify the current dirty tree. Do not describe the full repository as green based on selected speech suites.

## 8. Minimum implementation plan and exit criteria

Recommended next section: **Section 6 — Bilingual Voice safety and usability hardening**, under separate implementation authorization.

1. **P0: Close simulated scoring paths.** Fail closed on legacy/default scoring and re-evaluation in ordinary runtime; preserve historical rows/provenance and prohibit their presentation as current model ratings. Add endpoint tests for omitted/explicit legacy engine, Tagalog old-attempt evaluation and history/assessment projections, while proving real WavLM/MMS contracts remain intact. Resolve legacy retained-audio handling without inventing an approved deletion policy.
2. **P1: Clarify the supported product flow.** English = optional unvalidated WavLM feedback; Tagalog = MMS transcript and text comparison only. Correct scoring wording and unknown-outcome copy. Make local-recording versus real-model versus separately configured cloud behavior understandable. Preserve original-request retry and authorization/session cleanup.
3. **P1: Establish privacy and deployment decisions.** Approve actual saved-output/raw-audio retention, access and crash cleanup; document model/resource rights and intended noncommercial MMS deployment. Confirm available RAM and one-model concurrency on the target backend. Never lower safety gates for an 8 GB demonstration.
4. **P1: Complete acceptance evidence.** Run relevant backend and disposable PostgreSQL tests, mobile tests/typecheck/lint, then a consented authenticated device recording for each supported language on adequate hardware. Verify actual provenance, English phone/word/overall feedback, Tagalog null score, retry/history and audio cleanup. Record exact commands, failures, startup/inference/memory measurements and platform limitations.
5. **P2: Finish accessibility and scientific scope.** Test assistive technology and recording interruptions. Retain unvalidated-English disclosure; schedule separate held-out English assessment research before academic-grade or effectiveness claims. Tagalog scoring/independent dataset work stays deferred and disabled; neither ASR WER nor phone similarity may substitute for that evidence.

Feature finalization can proceed toward a clearly limited bilingual practice release after the P0/P1 conditions are satisfied; it does not require inventing Tagalog pronunciation scores. Independent Tagalog scoring remains NO-GO. The FSRS-6 + FIFAKT experiment stays the main research contribution and is outside this implementation plan. Section 5 stops here; no next-section code has been implemented.
