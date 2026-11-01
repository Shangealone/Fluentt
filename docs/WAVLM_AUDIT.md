# WavLM pronunciation integration audit — 2026-10-28

Checkpoint of the existing source: `e7071e0`, branch `codex/working-before-wavlm`. Implementation branch: `codex/wavlm-pronunciation`. No push. Existing ignored local data and untracked visual output remain on disk; the checkpoint contains source/configuration templates/docs/tests, not secrets, installed environments, APKs or application database files.

Actual stack: Expo SDK 58 / React Native 0.88 / TypeScript / Expo Router (`apps/mobile/src/app`); FastAPI/Pydantic/SQLAlchemy/PostgreSQL (`services/api`); Next.js administrator (`apps/admin`). Main API environment is Python 3.14.8; the available bundled Python is 3.12.14. No torch/torchaudio/transformers/G2P packages are installed in the API environment. At inspection this laptop had approximately 7.2 GiB total / 0.7 GiB free RAM and 78 GiB free disk. A heavyweight-model load/benchmark is not safe to assume feasible.

| Component | Existing implementation | Integration decision |
| --- | --- | --- |
| Student screen | `apps/mobile/src/app/pronunciation.tsx` selects existing activities; school uses `PronunciationPractice`, personal uses `LivePronunciationPractice` | Reuse these entry points; explicit opt-in scoring only; retain local recognition and scheduling |
| Recording | `features/pronunciation/useAudioRecorder.ts` uses Expo Audio/native AAC and browser MediaRecorder; whole-phrase personal recorder supports 16kHz mono WAV | Reuse capture; validate decoded bytes/duration server-side; no audio embedded in APK/model bundle |
| Authentication | SessionController.run / authenticated_session; school ownership/membership locks available through assignments publication.student_context | Derive identity from live session, never client student IDs; no research contexts |
| Upload/attempt API | `app/modules/pronunciation/router.py` existing `/me/pronunciation/attempts` | Add opt-in WavLM engine to existing endpoint; do not silently change legacy callers |
| Historical scoring | `speech/asr_engine.py`, `speech/evaluator.py`: simulated transcript/GOP services | Never call these as fallback for real WavLM; preserve their original callers |
| Personal whole-phrase | `pronunciation/whole_phrase*`, mobile `useWholePhraseAssessment`, `wholePhrase.ts`: disabled Azure adapter, no score persistence | Keep Azure contract intact; optional independent WavLM connection without changing phrase completion/history rules |
| Storage | Existing PronunciationAttempt + LearningContext + ModelVersion/Configuration in models/ai.py, learning.py, research.py; source head 0018, 71 tables | Reuse successful attempt/result JSON and immutable model provenance; no raw audio retention for new engine, no scheduler state/progress writes |
| Monitoring | Instructor monitoring and admin oversight existing explicit authorizations | Only ordinary classroom results under current eligibility; model predictions are unvalidated, not verified scores/research outcomes |

Reviewed public model revision `19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da`, repository `Jianshu001/wavlm-phoneme-scorer`. Actual API: constructor `(checkpoint_path=None, device=None, pherr_threshold=0.70)`; from_pretrained `(repo_id=None, device=None, pherr_threshold=0.70)`; `assess(audio_path, text)` returns overall_score, words, phonemes, counts. It does **not** accept a revision argument. Source is 27.6KB, larger than the old model-card description. Scoring checkpoint `wavlm_finetuned.pt` is approximately 1.27GB; an additional CTC alignment model is required. Source also downloads WavLM base weights although the checkpoint contains the backbone state.

Upstream loader uses `torch.load(weights_only=False)` and backbone `strict=False`. It substitutes zero scores for missing alignment segments and silently drops unmapped phones. These are unsuitable as an unqualified real-score service. Implement a reviewed local adapter with restricted weights-only loading, pinned artifacts, full state checks, complete alignment/phoneme coverage checks and failure-without-score. Do not import/download executable pipeline code at runtime or enable trust_remote_code. Scores remain the model pipeline's predicted phoneme/word/overall outputs; not constrained to 75–100 and not externally calibrated certainty.

HF model metadata says MIT. Alignment model card says Apache-2.0; WavLM links Microsoft's upstream license. Repository license endpoint returned 404, so metadata alone does not establish every dependency/dataset redistribution right. Retain source attribution, separately verify dependency license notices, and report any unresolved licensing rather than claim blanket clearance. Published validation is children's English; no Filipino-accented English/Tagalog validation was verified. Tagalog acoustic scoring must be unsupported.

Planned files: new isolated local Python model runtime/worker, reviewed adapter, dependency/setup/provenance manifest and deterministic feedback module; new pronunciation WavLM contracts/service, optional parameters in existing router/config; mobile typed optional API methods and opt-in component integrated into the two existing practice hosts; focused backend/DB/client tests; minimal authorized monitoring changes and final documentation. No FSRS/FIFAKT/research allocation/schedule module changes. Existing snapshot baseline hashes are saved in ignored `private-data/wavlm-baseline.json`.

## Local readiness check — 2026-10-29

The WavLM worker/API/UI integration exists in source, but this laptop has **7.21 GiB total / 0.79 GiB free RAM**. The server's model preflight requires at least 4 GiB free. Its separate Python runtime and pinned artifact cache are absent; local configuration is disabled. Therefore no actual WavLM inference or live pronunciation score was verified or enabled here. The opt-in live flow remains gated, and the browser demo generates no acoustic score. Tagalog remains unsupported.

Focused deterministic contract/runtime tests: `18 passed, 1 deselected` using a workspace temporary directory. The deselected upload-limit ASGI test stalled in this sandbox and is not reported as passed. These synthetic tests do not establish model loading, latency, or accuracy. Do not lower the memory gate or substitute a simulated score. A capable backend machine must install the isolated runtime from `services/api/ml/wavlm/requirements.lock.txt`, prepare pinned artifacts with `prepare.py`, run a real-audio `benchmark.py` check, then set the documented environment variables in an ignored `.env` or deployment configuration before enabling the feature.


## New PC preparation — 2026-10-29

The Windows desktop has 15.864 GiB RAM and passed the unchanged 4 GiB gate after unused apps were closed. The exact pinned CPU dependencies and all 16 hashed artifacts are prepared in ignored local environments/cache. Actual scorer and alignment weights loaded offline in 28.261 seconds; sampled peak RSS about 2.739 GiB, final RSS 2.745 GiB. This is real weight-loading evidence, not a recorded-audio assessment. The feature remains disabled pending a consented genuine-audio benchmark and configured local PostgreSQL/student connection. Tagalog is still unsupported.

Fresh API startup exposed a missing python-multipart dependency; both backend requirements files now pin 0.0.32. The branch also requires Python >=3.12 (existing generic-class syntax), so an isolated Python 3.12 API runtime was prepared without replacing the old environment. The upload-limit test now passes without deselection. Targeted pronunciation tests: 42 passed / 6 database skips; WavLM client tests: 4 passed. Full non-PostgreSQL suite: 826 passed / 2 failures in untouched research/schema expectations; no research/scheduler behavior was altered. See WAVLM_LOCAL_SETUP.md for exact commands, revisions/hashes, memory readings, known failures, changed files and remaining demo checks. No inference latency or genuine score is claimed, and nothing was committed/pushed.


### Voice-flow/database follow-up

Current bilingual follow-up (2026-10-30): actual public annotated English audio inference and the repaired real worker succeeded. An initial API+Metro memory check stopped at 688 MiB free; the startup requirement was raised to 5 GiB. After temporary processes released memory, the final monitored recheck passed with 1.529 GiB minimum available and English was enabled locally. MMS `tgl` transcription/comparison integration remains disabled, unprepared and not inference-verified under its 8 GiB gate. Tagalog phoneme scoring is unavailable. The formerly stalled upload-limit test passed with Windows local socket access; its prior hang was traced to asyncio socketpair creation before request handling. See BILINGUAL_VOICE.md and BILINGUAL_VOICE_VALIDATION.md; prior disabled/no-audio statements describe the earlier stage.

The user requested automatic assessment after finishing a recording and practice feedback, choosing to test their voice later. WavLMPractice now submits one consented completed recording after Stop and evaluate and shows model-derived sound tips; error retries remain explicit. A new isolated PostgreSQL 17.11 development cluster on 127.0.0.1:55432 is configured and migrated to 0018. Targeted pronunciation checks now pass with real disposable PostgreSQL: 48 passed, no skips; model/API/UI doubles remain synthetic. Client tests: 6 passed; mobile typecheck and changed-file lint pass. The original real-audio benchmark gate is unchanged, so scoring remains disabled pending the deferred voice test. No genuine score, audio inference latency or microphone/history/cleanup demonstration is claimed. See WAVLM_LOCAL_SETUP.md for the updated state and file inventory.
### Subsequent MMS activation after user freed RAM

The user made 8.19 GiB available. The unchanged 8 GiB gate passed; seven pinned
MMS files now verify and real Tagalog transcription succeeded on three public
FLEURS test clips. The actual API worker also succeeded twice with warm reuse.
English remains enabled; MMS transcription/comparison is now enabled locally.
A shared model lock releases idle alternate-language weights and refuses competing
inference, preserving both memory gates. Tagalog phoneme scoring remains unavailable.
See MMS_LOCAL_VERIFICATION.md; earlier MMS-unavailable statements are historical.
