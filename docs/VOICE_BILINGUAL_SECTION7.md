# Section 7 — Bilingual Voice acceptance and deployment readiness

Date: 2026-10-30. **Overall: PARTIAL. Automated safety checks PASS; real-device acceptance NOT TESTED; production deployment readiness BLOCKED by unresolved acceptance/privacy/rights decisions.** Current RAM also fails the unchanged MMS cold-load requirement. No deployment, new model run/download, recording collection, commit or push occurred.

Read Section 5, Section 6 and the relevant Allosaurus Stage 1–4A.2 reports. Their scientific findings are preserved: Tagalog phone/stress scoring is unavailable; independent pronunciation validation remains NO-GO, and further dataset clearance is deferred. Neither speech recognition agreement nor synthetic tests establish pronunciation validity. Existing uncommitted work was inventoried before this section.

## 1. Safety and workflow re-verification

The source review and freshly executed API/service/client suites confirm the Section 6 boundary. Paths below use `/api/v1/me/pronunciation` unless indicated otherwise.

| Surface | Verified behavior / remaining acceptance |
|---|---|
| Activities/list/detail; language tabs | Published reference metadata; All/English/Tagalog selection clears the prior selected activity. Modern selection is English → WavLM, Tagalog → MMS. Physical Android navigation is NOT TESTED. |
| Capabilities and explicit model uploads | English rejects Tagalog references; MMS rejects English references. Consent, activity version, request UUID and authorized ordinary context remain required. No model-unavailable result becomes a number. |
| Default/explicit `legacy` upload | Authenticated 409 `legacy_speech_unavailable`; no legacy audio/attempt write or simulated inference. |
| Legacy transcribe/evaluate/history/assessment | Forced transcription also refused; owned evaluation/retrieval returns unavailable/null rating; stored numerical evidence is masked without mutation. Missing/unowned records remain concealed. |
| Modern model histories and class summary | Strict engine-specific contracts retained; Tagalog overall score null, no phone/stress/fluency rating. Class summary remains the existing authorized English WavLM projection. |
| Whole-phrase Azure alternative | Separate optional English-only path; Tagalog unsupported. Not enabled or changed here. |
| Conversation audio/demo | No legacy score propagation or fixed demo rating; recognized text requires owned context and nonsimulated provenance. Default legacy factories fail closed. |
| Microphone/start/stop/submission | Explicit UI consent and separate OS permission; private native M4A or browser Blob; roughly 29-second cap; completed clip submitted once after Stop. Backend validates decoded duration/energy, not client MIME/timer alone. Native hardware execution remains NOT TESTED. |
| Reference playback | `useLessonSpeech` selects `en` or `fil`/`tl` device voices, stops on focus change and before recording; missing voice/playback errors exposed. Synthesized reference is not human-verified phonetic gold. |
| Result display | English phone/word/overall predictions and uncertainty; Tagalog recognized/reference words and text differences only. No calibrated Tagalog confidence or pronunciation percentage. |
| Retry/loading/error | Stable original request UUID/audio on deliberate retry; history reconciliation for lost replies; no auto-retry or numerical fallback. Model uploads allow longer client deadlines (English 190 s, MMS 310 s) than ordinary reads. Network loss does not prove the server did not commit. |
| Accessibility | Shared buttons expose roles/labels/disabled state; consent checked state, processing live region and alert errors exist. Language-filter selection announcements, result focus, contrast, large text, TalkBack and interruption behavior still need device evidence. No accessibility PASS inferred from source. |

Evidence paths: `services/api/app/modules/pronunciation/{router,service,schemas,wavlm_service,mms_service,wavlm_contract,mms_contract,whole_phrase}.py`, `app/modules/speech/{service,asr_engine,evaluator,schemas}.py`, `app/modules/conversation/service.py`; `apps/mobile/src/app/pronunciation.tsx`, `features/pronunciation/{WavLMPractice,LivePronunciationPractice,VoicePracticeFallback,LocalRecordingPractice,PronunciationPractice,useAudioRecorder}`, and `services/api/{pronunciation,wavlm,mms}.ts`. Current tests exercise these boundaries with synthetic fixtures/doubles, not trained-model accuracy.

## 2. Demonstrated privacy defect and narrow fix

Three new tests against the actual recorder hook initially **failed 3/3** with synthetic browser APIs:

1. Leaving private capture did not revoke its browser Blob preview URL.
2. A late Stop callback restored audio after discard.
3. Old recorder chunks contaminated a subsequent take (34 bytes instead of the expected 17-byte synthetic final chunk).

`useAudioRecorder.ts` now tracks the owned private preview URL in a ref, revokes it on discard/unmount, drops chunk buffers on private cleanup, and checks the capture generation before accepting private data/Stop callbacks. The Stop callback uses its captured recorder's MIME type. All three tests now pass, along with existing recorder checks. This is browser-memory/callback cleanup, not a retention policy or Android filesystem-erasure claim. Model processing, native recorder ownership, UI architecture and scheduling are unchanged.

## 3. Audio/transcript data-flow and retention inventory

Paths are exact code-derived patterns, not private participant filenames. Device-dependent cache roots cannot be certified without an actual device.

| Stage/location | Data and access | Lifetime/deletion / unresolved issue |
|---|---|---|
| Android `Paths.cache.uri` / Expo recorder URI | Finished private M4A; app/OS cache, passed as a native file upload object. Actual Expo-generated filename/root NOT TESTED on device. | `privateTemporary` tracks owned URIs; discard/success/unmount attempts deletion through `expo-file-system.File` only inside the cache prefix. Errors are swallowed as best effort. Crash, pending native Stop, OS backup/cache rules and deletion failure need device evidence. No secure-erasure guarantee. |
| Web MediaRecorder chunks, Blob, `blob:` preview | Process memory; preview and in-memory retry payload. | Discard/unmount revokes private URL and drops chunks; stale private callbacks rejected by this fix. Fetch/FormData can retain bytes until its request completes. Garbage collection is not secure erasure. |
| Client request | Multipart finished audio plus activity/version/consent/request/context metadata; authenticated bearer session. No credential printed by the inspected speech client. | Upload only after explicit model consent. Session-generation checks hide late responses but do not guarantee cancellation of backend work. No speech recording persisted by these clients to browser storage. |
| Backend request/spooling | Upload body bounded to 10 MiB plus multipart overhead before parsing; request-local body cache, `UploadFile` memory/OS spool. | Router closes the upload in `finally`; request/bytes reclaimed after request lifetime. Framework spool is under the service account's OS temporary storage, not a durable application audio URL. No crash-recovery proof. |
| `%TEMP%`/OS temp `fluentt-wavlm-*/recording.bin` | Shared WavLM/MMS transport writes input bytes; private path sent over worker stdin, not returned to students. | `TemporaryDirectory` removes normal/error/timeout input; timeout kills worker. Runtime uses `stderr=DEVNULL`, bounded JSON replies and offline environment. ACL hardening/encryption/OS crash cleanup are deployment responsibilities, not verified here. |
| OS temp `wavlm-decoded-*/normalized.wav` or `mms-decoded-*/normalized.wav` | FFmpeg 16 kHz mono PCM16; local worker only. | Worker temporary context removes on normal/error exits; forced process termination can leave orphan directories. No periodic reaper/TTL was added. |
| PostgreSQL `pronunciation_attempts` | English result JSON includes expected text, phone feedback/scores/provenance. MMS stores `transcription` and `result.mms` reference/transcript/comparison; no raw bytes and no pronunciation score. | Saved history has no approved expiry/deletion workflow. Authorization revalidated before persistence; engine-specific reads are session/context scoped. English instructor visibility follows existing class authorization. OS/DB administrator access remains possible. |
| Linked conversation / personal activity history | Real recognized text may become conversation message content. Existing personal live-practice journal saves activity/reference metadata; it does not save audio/transcript/pronunciation score. | Their existing persistence is unchanged; they are additional locations to include in a later retention decision. Do not claim deleting a Voice result deletes every linked record. |
| Historical `services/storage/audio/<context UUID>/<attempt UUID>.<ext>` | Old durable recordings; compatibility constant retained. Both this directory and `services/api/storage/audio/` ignored by Git. | No new legacy writer/reader inference path; no existing recordings deleted. Git ignore is not encryption, access control or retention approval. |
| Application/SQL/proxy logs and backups | Inspected API middleware logs request ID/status and exception type; SQL engine hides parameters; workers suppress audio paths/error bodies. No speech body/transcript logging found in those code paths. | Proxy access/body logging, crash dumps, database backups, service-account temp ACLs and host monitoring were not certified. Require restricted logging/backups; do not attach raw network bodies or credentials to acceptance reports. |
| Optional other Voice modes | Local/offline word tracking, explicitly opted-in online browser speech provider, device TTS, and separately configured Azure whole-phrase service. | These have different recipients/terms. MMS/WavLM backend inference is local to that server; a blanket “all Voice audio stays on this PC” claim would be inaccurate. No new cloud mode activated. |

`main.py` applies no-store to `/me/` success/error responses; `identity/dependencies.py` requires HTTPS in production. Reverse-proxy trusted-forwarding/TLS configuration, network reachability and released Android build behavior remain acceptance/deployment tasks. Do not assume development HTTP behavior establishes production safety. No public audio-serving route was found in the inspected speech API.

**Retention decision explicitly deferred by the user:** document both options, enable neither. Option A: institution-managed retention with an approved purpose, duration, accountable owner, access/backup schedule and withdrawal/deletion procedure. Option B: learner-controlled deletion with a precisely approved scope for Voice outputs, linked records and backups, plus clear limits on retained institutional/research records. Either option needs separate approval and implementation design. No period, consent revision, database deletion or policy approval was invented. Current “local-server” consent copy must be reviewed against the actual recipient/location before a remote-hosted deployment.

## 4. License and deployment-readiness matrix

Checked official publisher/current model pages and installed package metadata; preserved pinned NOTICE findings. Some pinned Hub/raw pages and GNU/FFmpeg sites could not be retrieved through the browser tool. Current-card metadata does not replace the exact pinned grant/notice. This is an engineering inventory, not legal clearance.

| Component | Local inference/execution | Hosted use | Redistribution / readiness |
|---|---|---|---|
| English `Jianshu001/wavlm-phoneme-scorer`, pinned `19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da` | Publisher declares MIT; local NOTICE records absent copyright/license file at the pinned revision. | Does not become licensed/validated merely by hosting; resolve applicable notices and actual deployment review. | **PARTIAL**: preserve attribution and resolve missing upstream notice before distributing adapted code/weights. [Publisher card](https://huggingface.co/Jianshu001/wavlm-phoneme-scorer); `services/api/ml/wavlm/NOTICE.md`. |
| WavLM backbone/alignment/G2P/resources | Local NOTICE identifies separate MIT/Apache terms and language-resource dependencies. | Review the actual deployed stack, not just the scoring head. | **PARTIAL**: retain each artifact/package/resource notice; no cache in APK. Pinned revisions stay unchanged. |
| Meta `facebook/mms-1b-all`, pinned `3d33597edbdaaba14a8e858e2c8caa76e3cec0cd`, `tgl` | Declared CC BY-NC 4.0; noncommercial purpose and attribution conditions require review. | Serving it behind an API does not remove its noncommercial restriction. Institution/thesis branding alone is insufficient. | **CONDITIONAL / no deployment clearance**: redistribution/modified copies need applicable attribution/notices and purpose compliance. Flag acknowledgement is not permission. [Publisher card](https://huggingface.co/facebook/mms-1b-all), [license terms](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en), local MMS NOTICE. |
| Allosaurus software / `uni2005` checkpoint | Software GPL-3.0; checkpoint rights remain unresolved in prior reports. No Section 7 inference. | Network interaction is distinguished from conveying copies by GPL text; this does not settle checkpoint rights or combined-work obligations. | **BLOCKED for packaging/rollout; excluded from student feature.** Do not redistribute. [Pinned software license](https://raw.githubusercontent.com/xinjli/allosaurus/d9f1adaf47d3b3765b41f4177da62a051516d636/LICENSE). No further dataset/weight clearance undertaken. |
| Reference playback: `expo-speech` 58.0.3 / OS voices | Installed package metadata declares MIT; installed `expo-audio` 58.0.9 also MIT. Actual voice/provider terms are separate. | Device-selected voices may require network. The app does not certify offline-only synthesis or provider rights. | **PARTIAL**: Expo software notice is not a grant to redistribute voice models or synthesized recordings. [Expo license](https://raw.githubusercontent.com/expo/expo/main/LICENSE); [Android voice network requirement](https://developer.android.com/reference/android/speech/tts/Voice#isNetworkConnectionRequired()). |
| Actual installed FFmpeg binary | `imageio_ffmpeg.get_ffmpeg_exe()` followed by `-L` reports FFmpeg 7.1 and **GPL version 3 or later** for this installed build. Command performs no inference. | Review execution/process integration and deployment packaging obligations separately. | **PARTIAL**: preserve corresponding license/source obligations if conveying the binary; do not assume LGPL merely from the FFmpeg project name. Exact output retained in ignored `voice-section7/ffmpeg-license.txt`. |
| Optional browser speech/Azure | No new service enabled. | Provider-specific processing/privacy/contract approval needed if used. | **NOT CLEARED here**; unrelated to a grant for MMS/WavLM or OS voice assets. |

No model accuracy, speech-reference correctness, commercial permission or academic-grade suitability follows from a software license. Allosaurus rights need not block a limited MMS transcription release if its research code/checkpoints are excluded from the deployed feature; other release conditions still apply.

## 5. MMS hardware and deployment recommendation

Section 7 measurement: **15.8645 GiB total physical RAM, 5.8061 GiB available**. MMS cold preflight requires **8 GiB available**, including another check after imports; this PC fails that measurement. No MMS load was attempted. Total installed memory and available RAM are not interchangeable. WavLM's separate 5 GiB available gate is unchanged; being above that instantaneous number would not constitute authorization/readiness for a new model run.

Prior actual measurements, not Section 7 inference:

| Existing evidence | Observed peak and latency |
|---|---|
| `MMS_LOCAL_VERIFICATION.md`, three public clips | Process RSS **4.68 GiB**; initialization 17.985 s; clip processing 17.848 / 7.680 / 13.275 s; minimum available 3.64 GiB. |
| Stage 1 serial retry | Process-tree RSS **4.0811 GiB**; load 29.356 s, inference 8.475 s on a 12.3 s clip; minimum available 4.0745 GiB. |

Different process/RSS sampling, imports and workloads explain why these are not interchangeable capacity guarantees. Transient tensors, decoder buffers, API/client/OS demand and imports need headroom. The observed peak is not evidence authorizing a lower preflight. The Stage 1 practical 8.5–9 GiB pre-launch buffer is a historical planning observation, not a replacement gate.

Recommended options: dedicated backend with at least 16 GB installed **and measured headroom passing the checks**, or a higher-memory institutional host if concurrent services need it; smaller client phones/8 GB PCs can connect to that backend. CPU inference is implemented; GPU capacity/compatibility is not certified here. No paid external inference is required or authorized. Keep sequential loading, control API process count (lock is process-local), and measure cold/warm latency and resource peaks later under separate authorization. Until then expose safe unavailable/local-practice states. No simultaneous model loading, threshold bypass, quantization, model replacement or configuration changes were made.

## 6. Android acceptance and lint review

The executable, step-by-step [Android checklist](VOICE_ANDROID_ACCEPTANCE.md) contains 25 cases, prerequisites, evidence fields and explicit **PASS / FAIL / NOT TESTED** rules. **All real-device rows currently remain NOT TESTED.** It covers normal English/Tagalog, silent/short audio, denied permission, reference playback, interruption/background, disconnect/lost reply, backend/model unavailable, memory refusal, concurrency, history/session/class boundaries, cleanup and accessibility. Mock-backed evidence must be identified separately from actual inference.

Lint JSON confirms **15 unused-variable/type-import warnings** and **15 hook-dependency warnings** (30 total), all severity warning, no errors. Unused items are in learning-materials, notifications, DemoNavigator, demo type imports, AttemptPlayer and research UI. Dependency warnings are one AssignmentEditor dependency and 14 deliberate demo-version dependencies in session/provider. These are maintenance/review items; changing protected-state/demo refresh dependencies could change behavior. There are **zero warnings in pronunciation feature files**. No clearly relevant Voice lint fix was necessary, so no unrelated refactor or warning suppression was performed. The privacy fix introduced no lint warning.

## 7. Commands and actual checks

Backend commands run from `services/api` using `private-data/api-runtime/.venv/Scripts/python.exe`. Local Windows socket access was permitted for asyncio/upload and disposable PostgreSQL tests; no upload-limit test was deselected or weakened.

```powershell
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest tests/test_voice_safety.py tests/test_pronunciation.py tests/test_speech_recognition.py tests/test_pronunciation_assessment.py tests/test_wavlm.py tests/test_mms.py tests/test_whole_phrase.py tests/test_speech_audio_runtime.py tests/test_conversation_practice.py -q --tb=short
./private-data/api-runtime/.venv/Scripts/python.exe private-data/voice-section7/run_pg.py
# Repository root:
node --test scripts/voice-recorder-privacy.test.cjs scripts/voice-safety.test.cjs scripts/pronunciation.test.mjs scripts/wavlm.test.cjs scripts/live-pronunciation.test.cjs scripts/native-audio-recorder.test.cjs scripts/whole-phrase.test.mjs scripts/conversation.test.mjs
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile run lint -- --format json --output-file C:/Users/shang/Desktop/Fluent/services/api/private-data/voice-section7/lint.json
git diff --check
```

| Check | Section 7 outcome |
|---|---|
| Backend speech/conversation checks | **162 passed**, 7.66 s; zero failed/skipped/deselected |
| WavLM/MMS disposable PostgreSQL integration | **13 passed**, 13.78 s; two dependency deprecation warnings |
| Mobile/client/recorder suites | **49 passed**, approximately 3.029 s; zero failed/skipped |
| Mobile typecheck | PASS, exit 0 |
| Lint | PASS, exit 0; **0 errors, 30 warnings** |
| New privacy regressions before fix | **3 failed**, demonstrating the defects; after fix included in final passing mobile run |
| Physical device / real human model inference | **NOT TESTED / NOT RUN** |

The PostgreSQL launcher reads only the ignored loopback maintenance credential without printing it; fixtures create/migrate/drop only generated `fluentt_test_<UUID>` databases. No developer/production migration/reset occurred. Tests use synthetic identities and model doubles. FFmpeg audio tests decode generated tone/silence only; package/FFmpeg license inspection performs no speech inference. Logs/baselines/resource and lint JSON are ignored local evidence under `services/api/private-data/voice-section7/`.

## 8. Exact changes and remaining priorities

Modified this section:

- `apps/mobile/src/features/pronunciation/useAudioRecorder.ts` — private browser URL/chunk/callback cleanup only.
- `docs/DECISIONS.md` — appended Section 7 acceptance/privacy boundary.

Added:

- `scripts/voice-recorder-privacy.test.cjs` — three deterministic behavior regressions.
- `docs/VOICE_ANDROID_ACCEPTANCE.md` — actionable device checklist; no invented PASS.
- `docs/VOICE_BILINGUAL_SECTION7.md` — this report.

Preservation is checked against the starting hash inventory, including the ignored backend environment hash: English scoring, MMS pipeline/gates, Section 6 masking, backend flags, prior Allosaurus reports, Voice architecture, FSRS-6/FIFAKT, experimental assignments/allocation, Personal/Class scheduling and administrator functionality remain unchanged. No cache/recording/credential added to source.

| Priority | Remaining requirement |
|---|---|
| P0 before production | Approve actual consent/recipient, saved-output/historical audio retention and deletion/backup scope; choice explicitly deferred. Verify deployment-specific model/software/voice rights. No public rollout on inferred permission. |
| P1 operational | Execute Android checklist on an approved build/account, including privacy/accessibility/error cases; obtain separate authorization and adequate hardware for genuine English/MMS acceptance. Current MMS resource gate blocks cold loading. |
| P1 operational privacy | Verify native cache cleanup/interruption and service-account temp/proxy/backup restrictions; design crash-orphan recovery without deleting unrelated files. No blanket erasure/retention guarantee. |
| P1 deployment capacity | HTTPS/proxy/native reachability, one-model concurrency/process budget, cold/warm latency and memory evidence under actual workload. |
| P2 scientific/maintenance | Independently validate English before academic-grade/effectiveness claims; retain uncertainty. Review unrelated lint warnings separately. Tagalog pronunciation/stress ratings remain disabled and research deferred. |

**Section 7 complete as preparation and lightweight verification, overall PARTIAL. Production GO remains BLOCKED; no next-section implementation, real-model run or deployment is authorized by this report.**
