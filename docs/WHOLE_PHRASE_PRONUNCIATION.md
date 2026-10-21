# Personal English whole-recording pronunciation

2026-10-21 — **Integration prepared, disabled, and not tested against live Azure.** The user selected “Prepare English Azure integration.” No service credentials, approved audio-processing materials, human recording or live provider result were supplied. No cloud resource was provisioned.

## Behavior and boundaries

Personal Voice continues highlighting recognized words locally. Interim matches never cut off the recording; a complete finalized transcript requests stop. Only after complete audio delivery and recording end does one request assess the whole sentence. A learner can also finish manually and deliberately assess the complete recording when live recognition missed words. Azure evaluates the actual audio against the exact published server reference independently of those highlights.

The overall score is Azure's raw full-recording `PronScore`, with accuracy, fluency and completeness diagnostics. No word-score average, custom weighted grade, confidence percentage, transcript evaluator or simulated fallback is used. Missing/invalid/provider-failure results display no score. The hosted model build is undisclosed, so `model_version=null`; `whole-phrase-azure-rest-v1` identifies our contract, not model weights. Feedback is not certification, validated research evidence or demonstrated educational effectiveness.

English uses en-US. Microsoft's [pronunciation language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=pronunciation-assessment) includes English but does not list Filipino/Tagalog for this feature. ASR support does not imply pronunciation-assessment support. Tagalog stays unscored, with local practice where an offline language exists. School/research pronunciation and their existing simulated backend services remain unchanged; this does not unblock Section 38B.

## Setup still needed

1. Review applicable audio-processing permissions, privacy information, Azure terms and required institutional/participant authorization. Existing repository audio policy requires this before cloud processing. A configuration reference cannot verify or grant approval. No research or minor-permission procedure was invented.
2. Supply an appropriate Azure Speech resource with custom resource domain, its key and a reviewed authorization reference through the API service's ignored `.env` or secret manager. Never use `EXPO_PUBLIC_*`, source, screenshots or chat for the key. No actual `.env` was edited.

   ```dotenv
   FLUENTT_PRONUNCIATION_AZURE_ENABLED=true
   FLUENTT_PRONUNCIATION_AZURE_RESOURCE=your-speech-resource
   FLUENTT_PRONUNCIATION_AZURE_KEY=<supply-secret-outside-source>
   FLUENTT_PRONUNCIATION_CLOUD_AUTHORIZATION_REFERENCE=<reviewed-policy-reference>
   ```

   The checked-in example remains disabled. Resource must be a DNS label, not a URL. Outbound requests use only `https://<resource>.cognitiveservices.azure.com`; redirects and environment proxies are not followed.
3. Restart the backend using normal secure session/transport configuration and existing published English pronunciation activities. No curriculum or application data was seeded. Availability remains false until configured; demo adapters never simulate a real score.
4. Build an updated native app using the existing Expo build workflow. Expo Go cannot supply speech recognition; this change also adds SDK-compatible `expo-file-system ~58.0.10` for temporary WAV cleanup. No native binary was built or deployed.
5. Learners explicitly allow Microsoft Azure assessment before recording. Leaving it unchecked preserves device-only practice. Permission resets on leaving/backgrounding/phrase change. Verify actual authorized microphone audio against the configured service and native devices before calling scoring operational.

## Contracts and privacy

- `GET /api/v1/me/pronunciation/whole-phrase/capabilities?language=english|tagalog`: availability and fixed permission contract, no credentials.
- `POST /api/v1/me/pronunciation/whole-phrase/assess`: multipart `activity_id`, `activity_version`, `cloud_consent_version=azure-whole-phrase-audio-v1`, `audio_file`. Both routes require a current authenticated session and active personal role; school/instructor roles are forbidden. Existing no-store middleware applies to successes/errors.
- Server locks the published activity/version and supplies its reference. Client transcript/score/duration cannot control assessment. Actual WAV bytes must decode as 16 kHz mono PCM16, 0.5–30 seconds, at most 1,000,000 bytes. Invalid/truncated/all-zero audio is rejected. Duration is calculated from PCM frames, not the client clock.
- The [Azure short-audio REST contract](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short) uses FullText, comprehensive hundred-point assessment and miscue detection. The request contains the whole WAV and reference, without user/participant IDs. Four finite 0–100 provider scores are required. Errors exclude raw provider bodies, keys, audio and transcripts.
- Provider I/O runs in a route worker thread. One request is sent per handler call; no automatic retries. The client prevents duplicate requests for the same recording and ignores late responses. There is no durable server idempotency/billing guarantee: a lost response can hide provider processing and repeated HTTP calls can incur another request. Existing session throttling applies; deployment upload/request/concurrency limits remain relevant.
- Browser capture is memory-only. Native capture uses a uniquely named cache WAV released after assessment/new recording/cancel/navigation. Deletion is best effort, not secure erasure; crash/OS cleanup is unverified. Upload spool files close on success/error. No durable audio, score, transcript, attempt, personal progress, scheduler, research context or analytics record is written. Results are transient.

## Actual verification

All audio, identities, keys, approval references and provider responses in tests are explicitly synthetic QA fixtures. No microphone permission was granted or cloud audio sent.

| Command / check | Result |
|---|---|
| API: `.venv/Scripts/python.exe -m ruff check app/core/config.py app/modules/pronunciation/whole_phrase.py app/modules/pronunciation/whole_phrase_router.py tests/test_whole_phrase.py tests/integration/test_whole_phrase_postgresql.py` | Passed |
| API: `.venv/Scripts/python.exe -m pytest tests/test_whole_phrase.py tests/test_pronunciation.py tests/test_pronunciation_assessment.py tests/test_speech_recognition.py -q --tb=short` | 62 passed |
| API: `.venv/Scripts/python.exe -m pytest -m 'not postgresql' -q --tb=short --maxfail=3` | 753 passed, 1 existing failure, 201 deselected, 2 dependency warnings |
| Disposable PostgreSQL: `pytest.main(['tests/integration/test_whole_phrase_postgresql.py','tests/integration/test_personal_practice_postgresql.py','tests/integration/test_research_final_verification_postgresql.py','-q','--tb=short','--maxfail=3'])` through `.venv/Scripts/python.exe` | 8 passed, 2 dependency warnings. Local maintenance connection port 55432; fixtures create/migrate/drop their own UUID databases only. |
| Repository: `node --test scripts/whole-phrase.test.mjs scripts/live-pronunciation.test.cjs scripts/pronunciation.test.mjs scripts/personal-practice.test.cjs scripts/dashboard-components.test.cjs` | 51 passed; Node module-type warnings |
| Mobile: `npm run typecheck`; `npm run lint` | Typecheck passed; lint 0 errors, 29 existing warnings |
| Mobile: `node node_modules/expo/bin/cli export --platform all --no-bytecode --max-workers 2 --output-dir <unique temporary directory>` with CI/offline settings | Web, Android and iOS JS exports passed; not native execution |
| Actual browser personal demo | English setup-required and Tagalog unscored messages verified. Screenshots under `output/pronunciation-scoring/`. No fake result or live microphone test. |

The existing full-suite failure is `test_schema.py::test_learning_focus_is_additive_and_retains_grade_history`, whose old exact-column assertion excludes the pre-existing `learning_experience` column. It was observed before this change and was not edited. Initial sandbox runs hit Windows temporary-directory restrictions; normal host runs resolved fixture errors. Oversized binary parameter test IDs were corrected with short IDs. Typecheck initially traversed historical generated JS exports; explicit TS source includes now preserve strict checks while excluding build artifacts. Expo removes generated-route includes when typedRoutes is disabled. No source test exclusion was introduced.

Coverage includes final-only completion, final audio chunk inclusion/resampling, stop/cancel cleanup, WAV bytes, role/permission/configuration/version gates, raw provider overall score, invalid results, no retry/error leakage, stale response cleanup, genuine DB/session authorization and unchanged history counts. Microphone/provider events are mocked. Live Azure compatibility, actual acoustic quality, native capture/cleanup, and educational validity remain unverified. Dependency installation reported 27 audit findings (8 moderate/19 high); no unrelated dependency remediation was attempted.

## Files for this request

Unrelated existing working-tree edits were preserved.

- API: `services/api/.env.example`; `services/api/app/core/config.py`; `services/api/app/api/v1/router.py` (whole-phrase registration only); new `services/api/app/modules/pronunciation/{whole_phrase.py,whole_phrase_router.py}`; new `services/api/tests/test_whole_phrase.py` and `services/api/tests/integration/test_whole_phrase_postgresql.py`.
- Mobile (relative to `apps/mobile/`): `package.json`, `package-lock.json`, `tsconfig.json`; `src/app/pronunciation.tsx`; `src/features/dashboard/PersonalHome.tsx`; `src/features/pronunciation/{LivePronunciationPractice.tsx,liveSpeech.ts,liveSpeech.web.ts,liveWordTracking.ts,useLiveWordTracking.ts}`; new `src/features/pronunciation/{wholePhraseAudio.web.ts,useWholePhraseAssessment.ts}`; `src/services/api/{client.ts,pronunciation.ts}`; new `src/services/api/wholePhrase.ts`.
- Tests/docs: `scripts/live-pronunciation.test.cjs`; new `scripts/whole-phrase.test.mjs`; `docs/{PRONUNCIATION.md,PERSONAL_LEARNING.md,DECISIONS.md}`; this new report; `output/pronunciation-scoring/{english-setup-required.png,tagalog-unscored.png}`.

No migrations, models, application data mutations, commit, push or deployment were performed for this request.
