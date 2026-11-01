# WavLM setup on this PC — 2026-10-29

## Status

Checkout: version-3 at 988239e5bfa8f41ec6c67104a6a8466802514a1e, fetched from BlackKaiser1121/FLUENTT. Original origin and clean starting files preserved; no commit/push/deploy or production data modification.

The existing WavLM API, offline worker and optional English student UI were retained. This PC now has the actual pinned artifacts and an isolated installed ML runtime. The real scorer AND alignment model loaded successfully with strict state loading. No transcript-based/random/simulated score replaced them. No recording has been assessed, so this is **model-loading evidence, not a completed pronunciation benchmark**. WavLM remains disabled until a genuine consented English recording passes benchmark.py. Tagalog remains unsupported. No claim of Filipino-accented English validation or academic-grade readiness.

## Measured resources and loading

- Windows 11 Pro x64; Intel i5-10400, 6 cores/12 threads; AMD Radeon RX 6600. The pinned CPU package stack is used, not an unreviewed GPU port. torch.cuda.is_available() returned false.
- Python 3.12.10 for the new ML and API environments. The preserved older API environment is Python 3.11.8 and cannot parse this branch's existing class Page[T] syntax.
- Total memory 15.864 GiB. Available RAM after the user closed applications: 4.902 GiB. Before actual model initialization: 4.680 GiB. The >=4 GiB gate remains unchanged.
- Actual offline _load_models(): 28.261 seconds including runtime imports; sampled peak RSS 2.739 GiB, final RSS 2.745 GiB, minimum system-available memory 2.021 GiB. Peak is sampled at 100 ms, not a certified maximum. An additional emergency stop would abort only the checker process below 512 MiB available; it did not trigger.
- API and Metro subsequently running together: 4.328 GiB system RAM available, with no model kept loaded. Loading-plus-live-app peak and audio inference latency remain unmeasured.
- Initial C: free disk 109.84 GiB. Prepared artifact cache 2.375 GiB across 16 manifest files, plus Hub download-cache copies and environments. No weights or cache are tracked.

## Installed runtimes and compatibility

ML: services/api/ml/wavlm/.venv (Python 3.12). Exact requirements.lock.txt pins installed, including torch 2.11.0+cpu, torchaudio 2.11.0+cpu, transformers 4.57.6, numpy 2.2.6 and huggingface-hub 0.36.2. pip check passes; WavLM/Wav2Vec2 imports pass. Import-only check took 8.04 seconds; it is not model initialization/inference.

Distance 0.1.3 has no prebuilt wheel. The wheel-only dependency check exposed that limitation. Downloaded its exact PyPI sdist, verified SHA-256 60807584f5b6003f5c521aa73f39f51f631de3be5cccc5a1d67166fcbf0d4551, reviewed setup.py, and built its default pure-Python distribution without optional C code. Local wheel SHA-256 eefb7c8314641b4e6896210f4de4a1b7631c25dd8662344f6bbea53eb21ec2cc. Build tools: setuptools 81.0.0 (existing pin), wheel 0.48.0, packaging 26.3. No model version changed. Distance carries GPL notices; review applicable third-party terms before redistribution, alongside the existing model NOTICE. This was a local installation, not a redistribution clearance.

API: services/api/private-data/api-runtime/.venv (Python 3.12), using existing backend pins plus python-multipart 0.0.32. The branch omitted this required upload parser from both dependency files; a clean environment failed FastAPI route registration. Both dependency files now pin it, and the API starts successfully. requirements.txt/lock changes do not alter model versions. The former Python 3.11 environment remains intact.

Mobile: npm ci restored the pulled package-lock.json dependencies. No native app/project rebuild, package upgrades or unrelated UI changes were made.

## Preparation and verification commands

Run from the repository root unless a different working directory is shown. Build-tool/source review above preceded building Distance.

```powershell
python -m venv services/api/ml/wavlm/.venv
services/api/ml/wavlm/.venv/Scripts/python -m pip install --only-binary=:all: setuptools==81.0.0 wheel==0.48.0
services/api/ml/wavlm/.venv/Scripts/python -m pip wheel --no-deps --no-build-isolation private-data/wavlm-setup/Distance-0.1.3.tar.gz --wheel-dir private-data/wavlm-setup/wheels
services/api/ml/wavlm/.venv/Scripts/python -m pip install --only-binary=:all: --find-links private-data/wavlm-setup/wheels --extra-index-url https://download.pytorch.org/whl/cpu -r services/api/ml/wavlm/requirements.lock.txt
services/api/ml/wavlm/.venv/Scripts/python -m pip check
python -m venv services/api/private-data/api-runtime/.venv
services/api/private-data/api-runtime/.venv/Scripts/python -m pip install --only-binary=:all: -r services/api/requirements.lock.txt
$env:HF_HOME = Join-Path (Get-Location) 'models-cache/huggingface'
$env:HF_HUB_DISABLE_TELEMETRY = '1'
$env:HF_HUB_DISABLE_PROGRESS_BARS = '1'
$env:HF_HUB_DOWNLOAD_TIMEOUT = '15'
$env:HF_HUB_ETAG_TIMEOUT = '15'
services/api/ml/wavlm/.venv/Scripts/python services/api/ml/wavlm/prepare.py --cache models-cache/wavlm
```

The first preparation attempt stalled before writing bytes and was stopped. Bounded HTTP probes confirmed the pinned public artifact responded (full request 200, range request 206). Retrying the same prepare.py with explicit network timeouts completed successfully; no hf_xet package or remote Python implementation was added. Existing verify_artifacts() then recalculated and matched all 16 SHA-256 hashes and pinned revisions. The local memory-gated diagnostic private-data/wavlm-setup/load_check.py loaded actual weights offline, measured initialization/RSS and exited without producing any score or audio.

Pinned revisions:
- Scorer Jianshu001/wavlm-phoneme-scorer: 19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da
- Backbone microsoft/wavlm-large config/preprocessor: c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c; backbone weights come from the scorer checkpoint, not another unpinned download.
- Alignment facebook/wav2vec2-xlsr-53-espeak-cv-ft: 2c733782da5604684829819a5eb744c193fe9398
- NLTK cmudict and both tagger resources prepared by the existing script and hashed in the manifest; their data bytes are hash-recorded, not claimed to have a separate pinned upstream revision.

## Local configuration and launch

Only WavLM fields were updated in the ignored services/api/.env: Python points to the ML environment; cache points to models-cache/wavlm; device cpu; timeout 120; enabled false. Unrelated configuration and any secrets were preserved and not printed. The API Python environment and ML worker Python environment remain separate.

scripts/start.ps1 now accepts -ApiPython or the process environment FLUENTT_API_PYTHON, uses the prepared Python 3.12 API environment when present, and rejects an incompatible interpreter. Do not put FLUENTT_API_PYTHON into backend .env, which accepts only backend settings. Existing mobile/admin commands remain unchanged.

```powershell
./scripts/start.ps1 api
# Explicit equivalent, working directory services/api:
private-data/api-runtime/.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
# Separate terminal, working directory apps/mobile:
$env:EXPO_PUBLIC_API_URL = 'http://localhost:8000'
npx expo start --web --port 8081
```

API GET /api/v1/health returned HTTP 200 and the expected fluentt-api liveness JSON. Web shell http://localhost:8081 returned HTTP 200. Liveness does not prove database readiness. No real student authentication or scoring request was made; the initial ignored backend configuration had no FLUENTT_DATABASE_URL, and no PostgreSQL executable/service/runtime is configured on this PC. No synthetic/demo identity was substituted for the requested real student.

## Verification results

- Complete WavLM unit file, including formerly stalled upload-limit test: 19 passed on the existing Python 3.11 environment and again within the targeted Python 3.12 run. The upload-limit stall did not reproduce outside sandbox restrictions; no deselection or false pass. These tests use synthetic contracts/worker doubles, not real audio/model inference.
- Targeted pronunciation/WavLM Python 3.12 command, working directory services/api:
  `private-data/api-runtime/.venv/Scripts/python -m pytest tests/test_wavlm.py tests/test_pronunciation.py tests/test_pronunciation_assessment.py tests/integration/test_wavlm_postgresql.py -q`
  Result: 42 passed, 6 skipped. All six real PostgreSQL tests skipped because no test database is configured. An initial fresh-API collection failure exposed the missing multipart dependency; it was fixed before this result.
- `node scripts/wavlm.test.cjs`: 4 passed. Synthetic API/UI fixtures only; no microphone/scoring claim.
- Mobile `npm run typecheck`: passed after npm ci. `npm run lint`: 0 errors, 30 existing warnings in unrelated files; no blanket warning-free claim.
- Full backend non-PostgreSQL suite on Python 3.12: 826 passed, 2 failed, 230 deselected. Untouched failures: test_research_assessment_drafts.py::test_absent_additive_plan_preserves_pre_prompt05_request_digest and test_schema.py::test_learning_focus_is_additive_and_retains_grade_history (expects a column set omitting the branch's existing learning_experience). These source contracts were not changed to make unrelated tests pass. FSRS/FIFAKT/research treatment/personal scheduling implementation was not modified.
- WavLM runtime/service/model code Ruff: passed. API and ML pip check: passed. PowerShell launch script syntax parser: passed. Git ignore checks confirm environments, cache, setup artifacts and .env remain excluded.

## Not yet verified / feature still disabled

No consented human recording with exact reference text was supplied or recorded. Therefore benchmark.py has not been run on actual speech; no overall/word/phoneme result, inference time, native microphone interaction, real history/retry or real-audio deletion is claimed. Synthetic cleanup/retry tests pass, but actual audio cleanup must be checked during the real demo.

Before enabling: configure a local development PostgreSQL database and review/apply existing migrations without touching production; use a real student account and an existing English pronunciation activity; obtain a consented non-research recording; run existing benchmark.py with its exact sentence; confirm complete real output and measured memory/latency; then enable the existing setting and test recording/submission/history/cleanup through the authenticated app. The intended future benchmark invocation is:

```powershell
services/api/ml/wavlm/.venv/Scripts/python services/api/ml/wavlm/benchmark.py --cache models-cache/wavlm --audio <consented-local-recording> --text "<exact spoken sentence>" --device cpu
```

The audio path is deliberately not printed or saved here. Keep Tagalog unscored; browser word highlights/demo recognition are not WavLM predictions. The minimum RAM gate was not lowered, and no paid service/external inference/training was introduced.

## Changed files

- services/api/requirements.txt — missing upload parser pin.
- services/api/requirements.lock.txt — same exact pin.
- scripts/start.ps1 — compatible API interpreter selection/check.
- README.md — correct version-3 Python baseline and link to this setup report.
- docs/WAVLM_AUDIT.md — new-machine evidence appended; historical laptop result retained.
- docs/WAVLM_LOCAL_SETUP.md — commands, artifacts, measurements and verification limits.

Ignored local changes only: services/api/.env, the new API/ML environments, models-cache and private-data setup diagnostics. No weights, cache, credentials, recordings, commits or pushes are included.

## Verified artifact hashes

| Artifact (relative to ignored cache) | SHA-256 |
|---|---|
| alignment/config.json | 4609fb49b7e1d28aecb2840da1926c40bd915bc6f1120a940afacf7159bbfb13 |
| alignment/preprocessor_config.json | a2254a5b58f72cd4de3632f8eee64f3f098b7c1402128d2f419e7d00ae13e335 |
| alignment/pytorch_model.bin | 04366b6c8d24099ef313cf02f0e58d26f5dddfda16edbfc8eb2c713d94a9f551 |
| alignment/vocab.json | d732ab2456c0c017930001dc9af0b41b3b93d25b2eb9740bf9d925508d7d87d0 |
| backbone/config.json | a3d8fe831aaf63d725b54a8ac36f3549cd4365c5086774b2c89cabbc6f9e129d |
| backbone/preprocessor_config.json | 60ca5a31e13f69ee2fbf147504c8676db5f6398fd7a6b12294341dff838edfcf |
| nltk_data/corpora/cmudict.zip | d07cca47fd72ad32ea9d8ad1219f85301eeaf4568f8b6b73747506a71fb5afd6 |
| nltk_data/corpora/cmudict/README | b0556be7a2b12bea6a667277b75864f802dd4854480657ce298c62e6897e766b |
| nltk_data/corpora/cmudict/cmudict | cad209c39eb87677d64e93d97f8eed10b7e6f9bdd42de8e7ca8efc8e17d62e8a |
| nltk_data/taggers/averaged_perceptron_tagger.zip | e1f13cf2532daadfd6f3bc481a49859f0b8ea6432ccdcd83e6a49a5f19008de9 |
| nltk_data/taggers/averaged_perceptron_tagger/averaged_perceptron_tagger.pickle | 25a5a19c7ced7b2bac3831da5bc0afcc2c34e5dd01cd4f361bb799949a696238 |
| nltk_data/taggers/averaged_perceptron_tagger_eng.zip | 6025f530624335c67d6547d44757b357b4e79bae030a0383e9887a92c1718f0b |
| nltk_data/taggers/averaged_perceptron_tagger_eng/averaged_perceptron_tagger_eng.classes.json | d152ffa69d45b8357276341a3d592c6c025911d52ec0d9068d4f382560dd48b6 |
| nltk_data/taggers/averaged_perceptron_tagger_eng/averaged_perceptron_tagger_eng.tagdict.json | 4c713731cb06727736962bc8cd94ad919217a040e76691059af99bc0c2c9c246 |
| nltk_data/taggers/averaged_perceptron_tagger_eng/averaged_perceptron_tagger_eng.weights.json | 789e8e35f6fac656d9b7eccea29ba4e8a137cbb5b525dd31f39e4291a9e80832 |
| scorer/wavlm_finetuned.pt | 7b9485b679d9a1219ac7dbef197b5185ec16e7909632b082b1f0576a963e0040 |


## Voice-flow configuration follow-up — 2026-10-29

The user requested full-sentence voice evaluation with feedback, and explicitly chose **test my voice later**. Implemented the intended flow without bypassing the original real-audio benchmark gate:

1. Open the existing English WavLM assessment option using an authenticated student connection when the service is enabled.
2. Explicitly allow processing/saving feedback, record the complete reference sentence, then tap **Stop and evaluate**. The existing 29-second recording limit also stops the recording.
3. A one-shot coordinator submits the completed audio once after recorder status becomes recorded. No score is inferred from live speech-recognition highlights, interim text or word counts. This is not silence detection: the user deliberately stops the recording.
4. Display the existing actual model sentence score, word/phoneme outputs and a new **What to practise next** summary. Up to three distinct model-flagged sound tips are shown, using existing uncertain phoneme predictions, not a language model or transcript-derived grade. No flagged sounds explicitly does not imply perfect pronunciation.
5. Failed submissions do not automatically repeat. **Retry original assessment** preserves the same request/audio identity. Discard, blur/background and new recordings cancel the pending automatic trigger. Existing history/raw-audio cleanup contracts remain unchanged.

New UI/logic files: apps/mobile/src/features/pronunciation/automaticAssessment.ts and feedback.ts. Modified WavLMPractice.tsx and scripts/wavlm.test.cjs; no other practice modes, schedulers, research treatment or score formulas were changed.

### Local database now ready

Downloaded PostgreSQL 17 Windows x64 portable binaries from the official EDB vendor page's Windows link (fileid 1260616). Archive SHA-256 **80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f** matches the earlier repository workstation report. Extracted only bin/lib/share to ignored private-data/verification/runtime. Initialized a new cluster only at private-data/verification/pgdata with SCRAM authentication, a generated password file restricted to this Windows user, 64 MB shared buffers, 30 connections and UTC server time. It listens only on 127.0.0.1:55432; no Windows service or existing database was replaced.

Created the separate fluentt_local development database and added its URL only to ignored services/api/.env while preserving other configuration. Ran the documented empty-database adapter:

```powershell
# From services/api, using the isolated API runtime:
private-data/api-runtime/.venv/Scripts/python -m alembic -x repair_initial_names=true upgrade head
private-data/api-runtime/.venv/Scripts/python -m alembic current
private-data/api-runtime/.venv/Scripts/python scripts/check_database.py
```

Head **0018_personal_history** applied successfully; PostgreSQL connection check passed. Restarted the local API with database_configured=true. Existing scripts/local-postgres.ps1 start|stop|status now manages this specific cluster. Ordinary development data is separate from generated disposable integration databases. No actual student account was impersonated or research/production record modified.

### Final voice-flow checks

- Pronunciation/WavLM unit plus real disposable-PostgreSQL integration: **48 passed, zero skipped** (8.06 seconds), two upstream deprecation warnings. The runner read the protected local password/configuration in memory, asserted loopback/port/user identity, set FLUENTT_TEST_DATABASE_URL to this cluster's maintenance database and ran the same targeted pytest command above. Fixtures created/dropped only their own UUID-named test databases. PostgreSQL tests use synthetic identities/audio/model doubles, so this is genuine database evidence, not genuine human-audio inference evidence.
- `node scripts/wavlm.test.cjs`: **6 passed**. Added automatic-on-completion/once-only/consent/cancellation/retry checks and model-derived feedback projection checks, in addition to existing API/UI fixtures. These synthetic tests never record a microphone or produce an actual learner assessment.
- Mobile `npm run typecheck`: passed. Full lint: 0 errors, the same 30 existing unrelated warnings. Direct ESLint over all three changed/new pronunciation files: passed with no warnings. An intermediate callback dependency warning was corrected through explicit recorder field dependencies before final verification.
- No model/threshold/contract/migration/FSRS/FIFAKT/personal scheduling/research implementation was changed. Previous full backend suite's two untouched expectation failures remain as reported above.

The real scorer remains installed and load-verified. **Live scoring is deliberately still off** because the user deferred the genuine recording benchmark; local model load is not audio validation. No overall/word/phoneme prediction has been presented as a real person’s result. Once the deferred benchmark succeeds, enable FLUENTT_PRONUNCIATION_WAVLM_ENABLED in ignored .env, restart the API, and verify authenticated recording, feedback, original-request retry, history and actual cleanup. Tagalog remains unscored and demo mode never fabricates a score.

Additional changed files for this follow-up: WavLMPractice.tsx, automaticAssessment.ts, feedback.ts, scripts/wavlm.test.cjs, docs/DECISIONS.md and this report. Ignored PostgreSQL files/configuration are local setup only. No commit/push/deploy was made.
