# Section 8 — Real Voice inference and end-to-end functional validation

Date: 2026-10-30. **Overall: PARTIAL. Genuine English and Tagalog model inference succeeded sequentially.** English also succeeded through the authenticated backend API with persistence/retry/history. A later genuine MMS API attempt was refused with HTTP 503 under insufficient memory headroom. Android microphone acceptance remains NOT TESTED. No production deployment, participant recording, checkpoint download, commit or push occurred.

## 1. Separate final statuses

| Requested area | Status | Evidence / limit |
|---|---|---|
| English real-model inference | **PASS** | Pinned scorer/backbone/alignment executed on public recorded speech; complete 6-word/21-phone output. Actual API worker, one saved result, retry and history also passed. |
| Tagalog real-model inference | **PASS** | Existing pinned MMS `tgl` pipeline genuinely transcribed one public clip after its unchanged 8 GiB preflight passed. Transcript-only contract/comparison and mobile rendering passed. **Full actual MMS API persistence is BLOCKED on this run's memory headroom**, not a demonstrated model defect. |
| End-to-end Android operation | **NOT TESTED** | Installed ADB reported zero connected targets; no emulator was running. No Android capture, permission interaction, live student sign-in or acoustic reference playback was exercised. |
| Automated regression testing | **PASS** | 162 backend, 13 PostgreSQL and 49 mobile checks; typecheck passed; lint 0 errors/30 warnings. Synthetic tests remain separate from the genuine runs. |
| Production deployment readiness | **BLOCKED** | Device acceptance, approved retention/consent/deletion/backup scope, deployment-specific rights and independent English validation remain unresolved. Tagalog pronunciation/stress scoring remains disabled. |

Read the Section 5–7 reports, Android checklist, and relevant Stage 1–4A.2 Allosaurus findings before execution. Historical reports are preserved. This section performed actual model execution rather than another static-only audit; no confirmed product-code defect required a source fix. Allosaurus was neither loaded nor connected to student scoring.

## 2. Preflight and verified prerequisites

Initial Windows `GlobalMemoryStatusEx` measurement: **15.8645 GiB total, 7.8471 GiB available**, 50% memory load. Disk free was **97.077 GiB**. A later supported PowerShell CIM measurement (`Get-CimInstance Win32_OperatingSystem` / `Win32_Processor`) reported the same total and **8.0258 GiB available**, Intel Core i5-10400 at 2.90 GHz, 12 logical processors, 64-bit OS. Availability fluctuated; closing Chrome was not assumed to guarantee capacity. No unrelated user process was stopped. The final post-check measured **6.4457 GiB available**, with no matching model/diagnostic processes remaining; the successful earlier MMS preflight does not establish current cold-load availability.

Process inspection found existing API/Python processes, but no active WavLM/MMS worker or Allosaurus model process. Each monitored job refused overlap before starting. After each genuine run, its child exited and no matching model process remained. Only supervisor-owned children could be stopped for emergency memory pressure; no emergency stop occurred.

Both isolated Python environments exist (Python **3.12.10**); `pip check` passed in each. ML metadata includes Torch **2.11.0+cpu**, Transformers **4.57.6**, NumPy **2.2.6**, psutil **7.2.2**, g2p-en **2.1.0**, imageio-ffmpeg **0.6.0**. These runs used CPU, not a GPU or remote inference.

Configured WavLM/MMS Python/cache paths exist; local enable flags and the MMS noncommercial acknowledgement were already true. They were not edited. Presence of a flag is not deployment clearance or proof that a different long-running API process has reloaded settings.

| Artifact set | Verified availability |
|---|---|
| English scorer `Jianshu001/wavlm-phoneme-scorer` | Revision `19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da` |
| WavLM backbone | Revision `c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c` |
| English alignment model | Revision `2c733782da5604684829819a5eb744c193fe9398` |
| English prepared manifest | **16 files, 2,550,095,935 bytes**; existing hash verifier completed, including required prepared language resources. |
| MMS `facebook/mms-1b-all`, `tgl` | Revision `3d33597edbdaaba14a8e858e2c8caa76e3cec0cd` |
| MMS prepared manifest | **7 files, 3,869,923,935 bytes**; `manifest(..., verify=True)` completed. Native adapter loading retained. |

No setup/download command was run. All loads used reviewed local Python, prepared data artifacts and offline settings; no model-repository Python was fetched/executed. The current dataset publisher cards confirm Apache-2.0 for [SpeechOcean762](https://huggingface.co/datasets/mispeech/speechocean762) and CC BY 4.0 for [FLEURS](https://huggingface.co/datasets/google/fleurs). These permissions do not clear model redistribution or a future participant study.

## 3. Genuine English execution

Input: existing public SpeechOcean762 `test` clip ID `0`, dataset revision `06385584fad212b26134c656fdd3ccf9f093f33e`. Its cached audio hash matches the earlier actual-run evidence. Exact reference: **“MARK IS GOING TO SEE ELEPHANT”**, decoded duration **3.360 seconds**. No private/student recording was used; no missing word was repaired or invented.

The existing `services/api/ml/wavlm/benchmark.py` loaded the actual learned scorer and alignment model and performed its first/warm passes. A separate actual API run then executed the existing offline worker against the same public recording, using a server-issued device session for a disposable test identity and a generated UUID PostgreSQL database. No model double or monkeypatch supplied these predictions.

| Observed metric | Benchmark | Actual API route run |
|---|---:|---:|
| Available RAM before monitored job | 7.9120 GiB | 8.1287 GiB |
| Model initialization | 7,240 ms | 12,485 ms |
| First inference / processing | 4,394 ms | 2,281 ms |
| Warm benchmark inference | 1,717 ms | Not separately repeated; retry replayed the saved result |
| Sampled peak process-tree RSS | 4.0451 GiB | 4.1847 GiB, including test API/worker |
| Minimum system available | 3.9962 GiB | 3.9811 GiB |
| Whole monitored job | 23.782 s | 27.097 s, including API/database setup |
| Available after process exit | 7.9870 GiB | 8.0784 GiB |

Actual overall prediction: **91.9/100**, **0 phones flagged** at the existing 0.70 threshold. This is an unvalidated model prediction, not a human pronunciation grade or evidence of perfect speech.

| Word | Actual model aggregate | Phones returned |
|---|---:|---:|
| MARK | 89.7 | 4 |
| IS | 97.8 | 2 |
| GOING | 98.3 | 4 |
| TO | 92.8 | 2 |
| SEE | 96.5 | 2 |
| ELEPHANT | 86.1 | 7 |

Representative actual phone outputs for MARK:

| Phone | Score | Error probability | Flag |
|---|---:|---:|---|
| m | 94.8 | 0.1308523 | false |
| aa | 78.4 | 0.2880941 | false |
| r | 94.5 | 0.0994953 | false |
| k | 91.0 | 0.2358873 | false |

The actual API returned `status=scored`, pinned provenance, `simulated=false` and the existing unvalidated status. The response matched strict backend validation and the mobile validator. Retrying the identical request produced the identical saved result; model-specific history returned that exact result and only one attempt existed. No scheduler review event changed. Raw-audio retention was false and the transport temporary directory disappeared. The worker was explicitly closed before the next model run.

The test identity was synthetic and disposable, **not a real student's Android sign-in**. This proves the actual API/service/worker/database path, not microphone capture or a deployed mobile session. The public clip may overlap scorer training; no held-out accuracy/fairness/academic validation is claimed.

## 4. Genuine Tagalog execution and API limitation

English had fully exited before MMS was attempted. Available RAM was **8.0657 GiB** at supervisor start and **8.0375 GiB immediately before `Transcriber.load()`**. The unchanged native pipeline preflight passed; no gate was lowered, skipped, warmed around or overridden.

Input: existing public FLEURS `fil_ph/test` clip ID `1930`, revision `fdd74f7cdf01fc7641ab3072b6a38d364b3667f6`, **12.300 seconds**. Cached SHA-256 matched its prior manifest. Expected text:

> anim na bihag kabilang ang mga bata at matatanda ang maagang pinakawalan gayon din ang mga pilipinong potograpo

**Actual unedited MMS transcript:**

> a6im na bihag kabilang ang mga bata at matatanda ang maagang pinakawalan gayundin ang mga pilipinong potograpo

Initialization was **14,990 ms**, inference **8,184 ms**, whole monitored process **24.869 s**. Sampled peak process-tree RSS was **4.0808 GiB**, minimum system available **4.0398 GiB**, available after exit **8.0841 GiB**. Sampled CPU time was 32.094 CPU-seconds (parallel CPU execution). Model references were cleared, the process exited, and no MMS/English worker remained. Temporary normalized audio was removed.

Existing backend `Prediction`/`compare`/`Transcription` postprocessing accepted the actual output and retained the exact transcript. Differences were **anim → a6im** and **gayon din → gayundin**. They are text/ASR differences, not verified learner phoneme errors. No automatic spelling repair, confidence value, pronunciation percentage, stress result or Allosaurus fallback was inserted. `overall_score=null`, `pronunciation_scoring=unavailable`, confidence unavailable/uncalibrated. This postprocessing used diagnostic IDs, not a saved student record or a successful MMS HTTP submission.

A later genuine MMS API attempt used another disposable test database/account, with **8.0234 GiB** available before API/bootstrap work. It returned **HTTP 503** before model weights loaded; sampled job peak was only **0.1471 GiB**, and available memory fell to **7.8226 GiB**. The following unchanged `prepared(settings)` check explicitly returned **insufficient_memory** at about **7.96 GiB**. The first diagnostic assertion captured HTTP status but **did not retain the exact HTTP error code**; do not present a guessed envelope as captured evidence. The observation is consistent with the existing memory gate, and the diagnostic stopped without forcing another load. No MMS API history/retry success is claimed for that attempt.

Thus, **MMS model inference PASS; full MMS API acceptance remains resource-blocked on this run.** It needs additional headroom for API/import/database work, not a lower threshold. A practical target is about 9 GiB available before that later test, while retaining the actual 8 GiB checks. A dedicated backend with at least 16 GB installed and enough measured free capacity, or a higher-memory institutional host, is the alternative. CPU is sufficient for these measured clips; concurrency/p95 capacity remains unvalidated.

## 5. Mobile/workflow and Android evidence

The actual English API JSON and actual MMS output passed the existing TypeScript validators and the actual React result components rendered them successfully. The English view preserved model scores/words; the Tagalog view preserved the recognized transcript and “Not a pronunciation score”, without `/100`. This was **server-side component rendering**, not a running Android UI or a browser microphone session. The MMS envelope's diagnostic identity metadata is distinct from genuine acoustic inference.

Lightweight tests exercised language routing, microphone permission adapters, complete-recording submission, silent/invalid audio, network errors/backend/model unavailability, insufficient-memory refusal, retry/idempotency/history, cleanup and legacy/demo masking. They use synthetic audio/model doubles where stated. No numerical rating was produced on unsupported/failure Tagalog paths.

ADB was found in the installed SDK under the supported execution context, but is not on PATH and SDK environment variables are unset. `adb devices` exited 0 with **zero connected targets**; no emulator/ADB process was initially running, and no generated `apps/mobile/android` project was present. No emulator was launched, native app rebuilt or test device altered. The existing Android checklist remains historical and unmodified; **all physical Android permission, microphone, playback, interruption, disconnection, real-history and accessibility cases remain NOT TESTED in Section 8**. Mock adapters/rendering do not change that status.

## 6. Regression commands and results

Actual execution commands, repository root (diagnostic helpers/evidence are ignored local files):

```powershell
./services/api/ml/wavlm/.venv/Scripts/python.exe services/api/private-data/voice-section8/monitor.py english
./services/api/ml/wavlm/.venv/Scripts/python.exe services/api/private-data/voice-section8/monitor.py api
./services/api/ml/wavlm/.venv/Scripts/python.exe services/api/private-data/voice-section8/monitor.py mms
node services/api/private-data/voice-section8/render_actual.cjs
./services/api/ml/wavlm/.venv/Scripts/python.exe services/api/private-data/voice-section8/monitor.py mms-api
```

The English mode invokes the **existing benchmark.py** with the configured cache, cached public clip and exact reference. API modes use the unchanged authenticated routes and real runtime, never a model double. Supervisors monitor every 100 ms, refuse overlap/low starting RAM, and stop only their children below 1.5 GiB available, above a 6.5 GiB process-tree limit or after 240 s. These additional emergency protections never relax production gates and did not trigger. RSS values are sampled process-tree working sets, not certified peaks or exclusive physical allocation.

From `services/api`:

```powershell
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest tests/test_voice_safety.py tests/test_pronunciation.py tests/test_speech_recognition.py tests/test_pronunciation_assessment.py tests/test_wavlm.py tests/test_mms.py tests/test_whole_phrase.py tests/test_speech_audio_runtime.py tests/test_conversation_practice.py -q --tb=short
./private-data/api-runtime/.venv/Scripts/python.exe private-data/voice-section8/run_pg.py
```

From repository root:

```powershell
node --test scripts/voice-recorder-privacy.test.cjs scripts/voice-safety.test.cjs scripts/pronunciation.test.mjs scripts/wavlm.test.cjs scripts/live-pronunciation.test.cjs scripts/native-audio-recorder.test.cjs scripts/whole-phrase.test.mjs scripts/conversation.test.mjs
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile run lint -- --format json --output-file C:/Users/shang/Desktop/Fluent/services/api/private-data/voice-section8/lint.json
git diff --check
```

| Fresh check | Actual outcome |
|---|---|
| Backend lightweight suites | **162 passed**, 7.82 s; no failures/skips/deselections, upload-limit test included |
| Disposable PostgreSQL regression suites | **13 passed**, 15.08 s, two dependency deprecation warnings |
| Mobile/client/recorder suites | **49 passed**, approximately 2.990 s; no failures/skips |
| Typecheck | PASS, exit 0 |
| Lint | PASS, 0 errors, 30 existing warnings |
| Real English API result + actual MMS result validators/renderers | PASS, separately from the 49 synthetic checks |
| Genuine MMS HTTP attempt | **503 / BLOCKED**, not counted as a regression PASS |

The first preflight metadata helper incorrectly expected an English manifest audio-hash key; English hashes actually reside in the prior real-result JSON. The lookup was corrected and matched all three cached English clips against that evidence. This was diagnostic bookkeeping, not a product/model defect. Both model-manifest hash verifiers had already completed. No failed helper or blocked API attempt was silently counted as successful inference/testing.

All database mutations used generated UUID disposable databases with synthetic identities. Fixtures removed only their own databases. No developer/production record, historical score, research data or recording was rewritten. Full test logs, public outputs/hashes, metrics and restricted diagnostics remain under ignored `services/api/private-data/voice-section8/`; no credentials/private participant audio are included in this report.

## 7. Changes, preservation and smallest next steps

**Product source changes: none required.** The real supported pipelines executed without a confirmed code defect; observed ASR text differences and the API memory refusal are not grounds to fabricate corrections or alter model/gate semantics.

Tracked/unignored changes this section:

- Added `docs/VOICE_BILINGUAL_SECTION8.md`.
- Appended the Section 8 evidence/limits note to `docs/DECISIONS.md`.

Ignored local additions: monitored run helpers (`monitor.py`, `real_api.py`, `real_mms.py`, `real_mms_api.py`), actual-output validator/renderer, disposable regression launcher, measurements, public result JSON and rendered diagnostic HTML. No new checkpoint/dataset was downloaded and no audio/cache/credential was added to source. Baseline hashes and backend environment hash verify preservation of all product code/configuration, Section 6/7 privacy and scoring protections, Stage 1–4A.2 reports, FSRS-6/FIFAKT, allocation, scheduling, Personal/Class Learning and unrelated administration.

For a real student-facing demonstration, first obtain an approved non-research acceptance account/session and permitted test-recording/storage scope, connect a compatible Android development build/device, and free additional backend RAM before the MMS API check (about 9 GiB available gives a practical bootstrap buffer; keep all checks). English actual API persistence/retry/history already has public-audio test evidence. Then execute the Android checklist and genuine MMS API/history/retry with the device under safe resources; do not claim it passed from these component tests.

Production remains blocked by the deferred transcript/feedback/historical audio retention and deletion/backup decisions, provider/deployment-specific licensing review (including MMS noncommercial terms, missing pinned WavLM notice, separate dependencies/voices), operational TLS/device/capacity acceptance and independent English validation. Local public-audio success does not grant deployment permission. Do not collect participant recordings before approved consent/retention scope. Tagalog phone/stress/numerical pronunciation scoring remains unavailable regardless of ASR output.

**Stop after Section 8. No commit, push, production deployment or next-section implementation occurred.**
