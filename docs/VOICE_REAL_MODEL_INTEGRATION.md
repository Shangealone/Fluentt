# Voice real-model integration in the redesigned app

Date: 2026-11-01. **Overall: PARTIAL.** The redesigned Speak flow now routes English recordings to the pinned WavLM service and Tagalog recordings to pinned MMS `tgl` transcription. The API refuses legacy simulated processing. This run did **not** produce a new genuine model result: the measured free RAM was below both unchanged cold-load gates. The earlier 88.11 result remains a historical simulated record, not evidence for this integration.

## Application and route verified

Integrated checkout: `versions/fluentt-groupmate/.local-version-2`, within the saved `codex/fluentt-main-correct` checkout at `7b1da6e`. The older WavLM/MMS workspace remains at the root of `C:/Users/shang/Desktop/Fluent`. The separate local API started on `127.0.0.1:8003`; the redesigned Expo web preview started on `localhost:8083`. API health and web `/pronunciation` returned HTTP 200. The API OpenAPI document contains `/api/v1/me/pronunciation/capabilities`; an unsigned call returned HTTP 401. The older local servers on 8001/8082 were left alone. This is route/build evidence, **not** a signed-in microphone test.

The active Speak screen sends an explicitly consented recording via `POST /api/v1/me/pronunciation/attempts` with `assessment_engine=wavlm` or `mms`, pinned activity version, a retained request UUID for deliberate retries, and the model-specific consent version. The client validates the complete returned contract and rejects simulated or incomplete output. English renders overall, word and phone-level model predictions with provenance and the unvalidated-prediction notice. Tagalog renders the MMS transcript and reference-text comparison with no `/100` score. Personal and school users can choose English or Tagalog phrases in Speak; this does not change their learning-profile language or scheduling. Model history is read via engine-specific endpoints and shows only model-provenance results.

The original local model services preserve authentication, activity/version checks, classroom/research boundaries, retry identity, before/after inference authorization, no retained raw model audio, immutable model provenance, and serial worker loading. The old upload route now returns 409 instead of registering simulated speech or a heuristic rating. Legacy history and assessment reads mask old numerical feedback without modifying stored records. Legacy default ASR/evaluator factories fail closed. The demo adapter no longer copies a reference into a fake transcript, returns an 88.5 score, or attaches a fixed 92.5 conversation audio rating. Conversation audio can no longer promote old simulated scores; unsupported old audio may now require a text message or a separately approved model flow.

## Model resources and capacity

- English: `Jianshu001/wavlm-phoneme-scorer` revision `19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da`, existing backbone revision `c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c`, alignment revision `2c733782da5604684829819a5eb744c193fe9398`. Cold-load gate: **5 GiB available physical RAM**.
- Tagalog ASR: `facebook/mms-1b-all` revision `3d33597edbdaaba14a8e858e2c8caa76e3cec0cd`, `tgl` adapter. Cold-load gate: **8 GiB available physical RAM**, plus existing noncommercial acknowledgement. MMS is transcription only; no Tagalog phoneme rating, confidence percentage or stress prediction is produced.
- Existing ignored model Python environments and caches were reused. Both cache manifests passed current file-hash verification. No checkpoint was downloaded or committed. The redesigned API uses Python 3.13; the existing isolated model workers remain separate. A temporary ignored local runner imports the already installed backend dependencies; this cross-environment launcher is a local development workaround, not a packaged deployment configuration.
- Windows `GlobalMemoryStatusEx`: **15.86 GiB total, 2.55 GiB initially available; 2.90 GiB available after server startup**. Both preflights returned `insufficient_memory`. No WavLM or MMS inference was attempted, no threshold was lowered, and no model overlap occurred. Close user applications voluntarily or use a host with at least 5 GiB available for English and 8 GiB available for MMS at the moment of cold load. Prior Section 8 showed genuine sequential model inference in the older app; it does not validate this redesigned API path.

## Persistence and privacy

The configured Supabase database was read only during verification. Aggregate query returned **one** `simulated=true, scoring_status=scored` pronunciation attempt, the previously identified historical record. No new attempt was created in this run; therefore current Supabase persistence of a genuine redesigned-app result remains **NOT TESTED**. The model services store WavLM scores or MMS text/provenance only after successful inference and reauthorization. New model uploads use temporary server audio and normal cleanup. Historical raw recordings under `services/storage/audio` and the previous bootstrap adapter change were preserved; no old rows or recordings were rewritten or deleted. Saved transcript/feedback retention and deletion policy remains unapproved.

MMS is declared CC BY-NC 4.0; the local acknowledgement flag is not a deployment rights grant. WavLM, its backbone/alignment resources, FFmpeg build, and reference voice terms require deployment-specific review. Allosaurus remains outside this student feature. No production/hosted rollout or academic-grade validation is claimed.

## Verification results

| Check | Actual outcome |
| --- | --- |
| Pinned cache file-hash verification | PASS, both prepared caches |
| Imported model/safety/audio unit tests | 119 passed, 4 skipped (final combined synthetic/mock suite, including 3 redesigned-route checks; no checkpoint load) |
| Original redesigned pronunciation/ASR/assessment tests | Initial run: 28 passed, 9 failed because assertions expected the retired simulated writer/transcript/rating or mutation of historical rows. Their expectations were updated to assert refusal/read-only masking; final combined suite above passed |
| Upload-limit test | PASS when rerun outside the restricted process environment. Its earlier apparent stall was caused by Windows `asyncio.run` hanging in that environment, reproduced by `asyncio.run(asyncio.sleep(0))`; the same command succeeded in the normal local process environment. No upload-limit code change was retained. |
| Mobile focused ESLint | 0 errors, 0 warnings for five active Voice files; demo adapter has 8 existing unused-import warnings |
| Mobile full ESLint | 3 errors and 14 warnings in unrelated auth/account/other files; not resolved in this speech scope |
| Mobile TypeScript | 21 errors in existing accessibility/scroll-ref files; 0 in changed Voice files |
| API/web route smoke checks | API health 200, capability route present, unsigned capability 401, web pronunciation route 200 |
| Authenticated recording, English model inference and saved score | **NOT TESTED** on this run: less than 5 GiB available |
| Authenticated Tagalog MMS transcript and saved comparison | **NOT TESTED** on this run: less than 8 GiB available |
| Browser microphone / Android device acceptance | **NOT TESTED**; browser on-device speech recognition also requires its supported offline language pack |

The imported unit results prove routing and failure protection under synthetic conditions. They are separate from the older Section 8 genuine model experiments and are not a new genuine recorded-audio result. A fresh user-recording pass through this redesigned API, with consent, sufficient free RAM and verified Supabase provenance, remains the critical acceptance step.

## Verification commands

Run from `versions/fluentt-groupmate/.local-version-2/services/api`:

```powershell
& 'C:/Users/shang/Desktop/Fluent/versions/fluentt-main/backend/.venv/Scripts/python.exe' -m pytest tests/test_pronunciation.py tests/test_speech_recognition.py tests/test_pronunciation_assessment.py tests/test_wavlm.py tests/test_mms.py tests/test_voice_safety.py tests/test_speech_audio_runtime.py tests/test_redesigned_model_routes.py -q
```

Final result: **119 passed, 4 skipped**. The four skipped decoder cases report: "Reviewed optional ML runtime is not installed; no actual decoder execution claimed." They are not genuine model inference. The isolated model cache hash check called `verify_artifacts(settings.pronunciation_wavlm_cache)` and `manifest(settings.pronunciation_mms_cache, verify=True)`; both returned without error. No model weights were loaded.

Run from `versions/fluentt-groupmate/.local-version-2/apps/mobile`:

```powershell
npm run typecheck
npm run lint
npx eslint src/app/pronunciation.tsx src/features/pronunciation/LivePronunciationPractice.tsx src/services/api/pronunciation.ts src/services/api/wavlm.ts src/services/api/mms.ts
```

Typecheck remained at 21 unrelated errors; full lint reported 3 unrelated errors and 14 warnings. The focused five-file lint completed with exit 0 and no findings. A later demo-adapter lint found eight existing unused-import warnings and no errors. No claim is made that full mobile checks pass.

## Source files changed

- `apps/mobile/src/app/pronunciation.tsx`; `features/pronunciation/LivePronunciationPractice.tsx`; `services/api/pronunciation.ts`, `wavlm.ts`, `mms.ts`; `demo/demoData.ts`.
- `services/api/.env.example`; `app/core/config.py`.
- `app/modules/pronunciation/router.py`, `schemas.py`, `service.py`, `wavlm_contract.py`, `wavlm_runtime.py`, `wavlm_service.py`, `mms_contract.py`, `mms_runtime.py`, `mms_service.py`, `speech_text.py`, `upload_limit.py`, `validation_metrics.py`.
- `app/modules/speech/asr_engine.py`, `evaluator.py`, `schemas.py`, `service.py`; `app/modules/conversation/service.py`.
- Model source/NOTICE files under `services/api/ml/wavlm/` and `services/api/ml/mms/`; regression modules `tests/test_wavlm.py`, `test_mms.py`, `test_voice_safety.py`, `test_speech_audio_runtime.py`, `test_redesigned_model_routes.py`, and updated `test_pronunciation.py`, `test_speech_recognition.py`, `test_pronunciation_assessment.py`.
- This document. Local `.env` settings and runner/logs are ignored. The pre-existing `scripts/bootstrap_names.py` change and `services/storage/` are unrelated and untouched.

## Local start commands

From `C:/Users/shang/Desktop/Fluent` in PowerShell, with the existing ignored local configuration:

```powershell
$api = 'C:/Users/shang/Desktop/Fluent/versions/fluentt-groupmate/.local-version-2/services/api'
$mobile = 'C:/Users/shang/Desktop/Fluent/versions/fluentt-groupmate/.local-version-2/apps/mobile'
$runner = 'C:/Users/shang/Desktop/Fluent/versions/fluentt-groupmate/.local-version-2/private-data/run-integrated-api.py'
Set-Location $api
& 'C:/Users/shang/Desktop/Fluent/versions/fluentt-main/backend/.venv/Scripts/python.exe' $runner
# In another PowerShell terminal:
Set-Location $mobile
& 'C:/Program Files/nodejs/node.exe' node_modules/expo/bin/cli start --web --port 8083 --host localhost
```

Open `http://localhost:8083/pronunciation`. The existing ignored mobile `.env` points its browser and Android API targets to port 8003. The running API is bound to loopback only, so Android cannot connect until an approved LAN binding/firewall setup is made and tested; Android remains NOT TESTED. The backend's ignored `.env` contains the existing Supabase connection and verified local model paths. Do not copy those secrets into source, logs or chat. Once the measured available RAM meets the relevant gate, reload Speak, explicitly allow the local assessment/transcription and submit a consented full phrase. Verify returned model ID/version, `simulated=false`, score only for English, and the resulting Supabase row before claiming end-to-end PASS.

## Decision

- **WavLM integration: PARTIAL** — pinned real service and redesigned UI route connected; new genuine inference through this app blocked by current RAM.
- **MMS integration: PARTIAL** — pinned `tgl` service and transcript-only UI route connected; current 8 GiB preflight blocks new inference.
- **Simulated scoring removal: PASS for active Speak and API legacy boundaries**, supported by synthetic regression tests. Historical simulated data remains labeled and masked; obsolete speech-test expectations were migrated.
- **Deployment/device readiness: BLOCKED** pending RAM-safe genuine redesigned-API/device acceptance, existing unrelated mobile check failures, retention policy and license review.

## Follow-up: disabled consent control

The user's Chrome tab was observed at `localhost:8082/pronunciation`, the older preview, while the integrated preview and model API use ports 8083 and 8003. A missing capability route on an older backend is now identified explicitly in the Speak message. The model-consent checkbox no longer depends on capability readiness. After consent, the assessment button is enabled and **rechecks readiness before any audio upload**. A failed check leaves the recording local and displays the actual connection or preflight reason; it cannot produce a score or save a result. On blur/phrase change, pending capability responses are invalidated before they can update the next screen.

At follow-up, the actual English preflight measured **4.52 GiB available** and returned `insufficient_memory` under the unchanged 5 GiB gate. This means the button can be pressed for an honest readiness check, but genuine scoring still waits for sufficient available RAM. The integrated page returned HTTP 200 on port 8083 after the change. Focused ESLint passed with no findings; TypeScript reported zero Voice-file errors and the same 21 unrelated project errors. No recording/model inference was run in this follow-up.
