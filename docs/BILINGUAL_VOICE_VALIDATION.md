# Bilingual Voice checks and file inventory — 2026-10-30

Latest follow-up: the user freed 8.19 GiB RAM, and real MMS inference/worker reuse
now pass; Tagalog transcription is enabled locally. See MMS_LOCAL_VERIFICATION.md
for the new 115-test regression run and actual three-clip WER/CER results. The
initial MMS-blocked statements below record the earlier implementation stage.

## Actual audio versus synthetic checks

Real audio: 3/3 public human-annotated SpeechOcean762 test recordings produced
complete English WavLM predictions. A separate API worker check succeeded after
repairing the Windows OS-environment import defect. A further live API+Metro
resource check was stopped for low RAM, with no score returned. After temporary
processes released memory, the final monitored run under the raised 5 GiB gate
succeeded with the API/Metro active, retaining 1.529 GiB free at its lowest sample;
English is now enabled locally. MMS did not load:
its preflight refused insufficient memory. These outcomes are distinct from all
synthetic model/API/UI fixtures below. Full independent English validation,
Tagalog corpus WER/CER and authenticated microphone/device testing remain open.
Detailed revisions, measured timings/RSS, diagnostic annotation error/coverage,
the raised memory threshold and limitations are in BILINGUAL_VOICE.md.

No weights/audio/credentials/cache are tracked. Private verification reports
contain public audio hashes/aggregate measurements, not private audio paths.
Existing user working-tree changes were preserved; no commits/push/deployment.

## Commands and observed results

From `services/api`, using the prepared API Python 3.12 environment:

```powershell
private-data/api-runtime/.venv/Scripts/python -m pytest tests/test_mms.py tests/test_wavlm.py tests/test_pronunciation.py tests/test_pronunciation_assessment.py tests/test_speech_recognition.py tests/test_whole_phrase.py tests/test_speech_audio_runtime.py -q --tb=short
```

Final focused full speech run: **114 passed**, no skips or failures. This includes
five invalid-recognized-text cases and the Windows worker environment regression.
Actual decoder tests execute local FFmpeg on synthetic PCM tone/silence, short and
overlength clips and verify owned temporary cleanup. They are not speech inference.

```powershell
private-data/api-runtime/.venv/Scripts/python -m pytest tests/integration/test_mms_postgresql.py tests/integration/test_wavlm_postgresql.py -q --tb=short
```

**10 passed**, no skips, on generated UUID disposable PostgreSQL databases. The
maintenance URL is supplied through `FLUENTT_TEST_DATABASE_URL` from ignored local
credentials, never printed. The first attempt failed because the development
database server was stopped; starting its existing loopback cluster resolved it.
One new isolation fixture initially lacked required profile preferences; fixing
the fixture (not weakening authorization) yielded the reported passing rerun.
No existing database was reset, downgraded, stamped or used as the disposable target.

```powershell
private-data/api-runtime/.venv/Scripts/python -m pytest tests -q --tb=short -m 'not postgresql'
```

Broader backend run: **854 passed, 2 failed, 234 deselected**. The two failures
already appeared in the prior setup run and concern untouched research/schema
expectations: `test_absent_additive_plan_preserves_pre_prompt05_request_digest`
and `test_learning_focus_is_additive_and_retains_grade_history`. Their code,
research algorithms and migrations were not changed to make this task pass.
This broader run preceded the five additional text-validation cases.

The upload-limit test previously stalled before its assertions, in Windows
`asyncio` event-loop `_fallback_socketpair`/`accept`. A 20-second faulthandler
trace established that location. With local socket access the WavLM test suite
completed, including declared and streamed upload limits. No skip/pass substitution
or application upload-limit weakening was needed.

From the repository root:

```powershell
node --test scripts/pronunciation.test.mjs scripts/live-pronunciation.test.cjs scripts/wavlm.test.cjs
```

**34 passed**, no failures. Synthetic client/component and recording-coordination
fixtures; no microphone/model inference. Corrected extensionless API imports
exposed by the existing direct Node TypeScript test runner.

From `apps/mobile`:

```powershell
npm run typecheck
npm run lint
```

Final typecheck passed. Final lint: **0 errors, 30 existing warnings**. One new
refresh dependency warning was documented/suppressed because the counter
intentionally repeats a focused read; no new warning remains.

ML environment `python -m pip check`: **No broken requirements found**.
`python -m alembic heads`: **0018_personal_history**, unchanged.
`git diff --check`: passed (Git also printed an existing CRLF conversion advisory).

Browser navigation check: actual Expo web app loaded, student demo Voice displayed
both language filters, Tagalog selected MMS transcription with an explicit
unavailable pronunciation score, English selected WavLM, and demo mode correctly
refused live assessment. No microphone permission, participant account or fake score
was used. Native secure-session/microphone execution remains unverified.

## Files changed for this bilingual request

Paths below are repository-relative. Existing WavLM UI/test/decision edits were
extended rather than reverted.

```text
README.md
docs/DECISIONS.md
docs/WAVLM_AUDIT.md
docs/BILINGUAL_VOICE.md                         (new)
docs/BILINGUAL_VOICE_VALIDATION.md              (new)
apps/mobile/src/app/pronunciation.tsx
apps/mobile/src/features/pronunciation/LocalRecordingPractice.tsx
apps/mobile/src/features/pronunciation/VoicePracticeFallback.tsx (new)
apps/mobile/src/features/pronunciation/WavLMPractice.tsx
apps/mobile/src/services/api/pronunciation.ts
apps/mobile/src/services/api/wavlm.ts
apps/mobile/src/services/api/mms.ts             (new)
scripts/wavlm.test.cjs
services/api/.env.example
services/api/app/core/config.py
services/api/app/modules/pronunciation/router.py
services/api/app/modules/pronunciation/wavlm_runtime.py
services/api/app/modules/pronunciation/wavlm_service.py
services/api/app/modules/pronunciation/mms_contract.py      (new)
services/api/app/modules/pronunciation/mms_runtime.py       (new)
services/api/app/modules/pronunciation/mms_service.py       (new)
services/api/app/modules/pronunciation/speech_text.py       (new)
services/api/app/modules/pronunciation/validation_metrics.py (new)
services/api/ml/evaluate_voice.py               (new)
services/api/ml/wavlm/benchmark.py
services/api/ml/mms/artifacts.py                (new)
services/api/ml/mms/prepare.py                  (new)
services/api/ml/mms/pipeline.py                 (new)
services/api/ml/mms/worker.py                   (new)
services/api/ml/mms/requirements.lock.txt       (new, reuses existing pins)
services/api/ml/mms/NOTICE.md                   (new)
services/api/tests/test_mms.py                  (new)
services/api/tests/test_speech_audio_runtime.py (new)
services/api/tests/integration/test_mms_postgresql.py (new)
```

No dependency pin, model, migration, FSRS/FIFAKT, scheduling, experimental assignment
or research treatment file was changed for this request. Earlier uncommitted changes
in `scripts/start.ps1`, API requirements, `automaticAssessment.ts`, `feedback.ts`
and `WAVLM_LOCAL_SETUP.md` were preserved. Ignored local changes include public
test clips/annotations/reports and the backend enabled flag's temporary activation
and safety-driven restoration to false, then final English activation only after
the successful monitored recheck. MMS remained false throughout.
