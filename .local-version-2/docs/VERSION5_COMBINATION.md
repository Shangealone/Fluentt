# Version 5 + current WavLM app

Date: 2026-11-05 (Asia/Manila). Source combination: PASS. Live hybrid intervention: BLOCKED.

## Saved versions and exact application

- Before changes, current work was committed as `2aebe91` on local branch `codex/backup-before-version5-2026-11-05` and pushed to https://github.com/Shangealone/Fluentt/tree/backup-before-version5-2026-11-05 . This includes the previously uncommitted administrator monitoring work. Ignored credentials, model caches, recordings, databases and installed dependencies were excluded.
- Incoming branch: https://github.com/BlackKaiser1121/FLUENTT/tree/version-5 , fetched at `d49a23919e05290b0eb3cf7b81c888970f1f3cdc`.
- Combined local branch: `codex/version5-wavlm-integration`.
- Combined app directory: `C:/Users/shang/Desktop/Fluent/versions/fluentt-version5-combined/.local-version-2`. Use its `apps/mobile`, `apps/admin`, and `services/api`. The repository's other `mobile`/`backend` tree is not the redesigned app.
- Current app remains in `C:/Users/shang/Desktop/Fluent/versions/fluentt-groupmate/.local-version-2`. Existing services were not switched to the combined code. No combined deployment or APK is claimed.

## Integration decisions

Merged version 5's client account policy, proficiency grouping, lesson library, instructor questions, vocabulary authoring, ESR review foundation, migrations, research scripts, and navigation fixes. Version 5 disables **new personal registration by default**; it retains existing personal accounts and history. This integration preserves that exact policy rather than deleting accounts or converting roles. See PERSONAL_LEARNER_REGISTRATION.md.

Retained current administrator monitoring and removal of simulated administrator responses in conflicting files. Kept both `serve_web` (current deployment) and `personal_learner_registration_enabled` (version 5) in Settings. Retained both decision histories. The new vocabulary editor continues to require a real authorized administrator; local monitoring preview does not grant editing/research privileges.

English WavLM and Tagalog MMS implementation files are unchanged relative to backup `2aebe91`, including models, worker resources, scoring, modern/legacy scoring safety, mobile Voice component and model clients. Automatic merges in demoData/client only add new version-5 metadata/API wiring; no simulated Voice scoring was restored. Tagalog pronunciation ratings remain unavailable. No model download or inference was executed.

## What FSRS + FIFAKT means in this combined version

Version 5 already implements the FSRS-6 baseline and **interval** fusion under `services/api/app/modules/vocabulary_review/`. The baseline memory state remains unchanged; only the proposed interval receives a bounded factor derived from a provider's future-recall probability. Invalid/unavailable/sparse predictions preserve the baseline schedule under the same calendar policy. The older `spaced_repetition/fifakt.py` simulated stability-fusion prototype is a separate implementation, not the study provider.

The combined app now contains vocabulary pool authoring, protocol configuration, review queue/answer/rating flow, state persistence, retry protection, and counterbalanced condition code from version 5. It is **not an active trained FIFAKT experiment**. The following existing blockers remain intact:

1. No compatible non-simulated `PredictionProvider` is installed. No default loader exists; an approved implementation must supply the pinned artifact hash, mappings and `future-recall-probability-v1` contract.
2. The documented bounded public-data training pilot is an engineering benchmark. Its reduced embeddings, English-only session-recall labels and absent format-aware future-recall calibration do not satisfy that contract. Its saved checkpoint is not distributed by this branch.
3. Participant consent/enrollment/withdrawal and pool-linked baseline/immediate/delayed assessment integration are incomplete. `study_workflow_unavailable` deliberately prevents accidental activation even if a model is injected.
4. Approved frozen settings, matched pools, external study approvals and independent evaluation remain required. Do not reuse ordinary classroom submissions as research evidence.

See ESR_IMPLEMENTATION.md, ESR_TRAINING_PREPARATION.md, and ESR_PUBLIC_DATA_PILOT_RESULTS.md. Next work depends on obtaining a compatible trained bundle or preparing and validating one, then completing the participant workflow. No random/model-placeholder probabilities were connected to scheduling.

Administrator FSRS and hybrid pages retain ordinary-classroom scope. They do not read private ESR participant tables or silently treat study decisions as ordinary classroom metrics. Existing simulated traces remain explicitly identified.

## Verification performed

All checks used the combined app directory. Backend Python was the existing `versions/fluentt-main/backend/.venv/Scripts/python.exe`, with the older API's site-packages appended for the missing Authlib package, as in the current local development launcher. No shared environment was modified. Ignored node_modules junctions reuse existing installed packages; no new dependency was added.

| Check | Actual outcome |
| --- | --- |
| Backend FSRS/FIFAKT policies, vocabulary, bundle, speech safety/routes, registration, proficiency, monitoring | 163 passed, 4 skipped |
| New combination checks (settings coexistence, protected routes, no default provider) | 3 passed |
| Disposable PostgreSQL vocabulary/proficiency/instructor question tests | 7 passed |
| Administrator proxy/demo-cookie regression tests | 4 passed |
| Mobile `npm run typecheck` | PASS |
| Mobile `npm run lint` | 0 errors, 6 warnings (existing hook dependency warnings) |
| Administrator `npm run typecheck` and `npm run lint` | PASS, no lint findings |
| `git diff --check`, merge-marker search | PASS |
| Real WavLM/MMS/FIFAKT inference, browser/device acceptance, APK build | NOT RUN |

Backend command: `python -m pytest tests/test_fsrs6.py tests/test_fifakt.py tests/test_vocabulary_review.py tests/test_esr_bundle_preparation.py tests/test_wavlm.py tests/test_mms.py tests/test_voice_safety.py tests/test_speech_audio_runtime.py tests/test_redesigned_model_routes.py tests/test_registration_policy.py tests/test_class_proficiency.py tests/test_admin_monitoring_surface.py -q`. Separate command: `python -m pytest tests/test_version5_combination.py -q`.

PostgreSQL command: `python -m pytest tests/integration/test_vocabulary_review_postgresql.py tests/integration/test_class_proficiency_postgresql.py tests/integration/test_assessed_proficiency_postgresql.py tests/integration/test_instructor_question_supplements_postgresql.py -q --tb=short`, with local maintenance connection injected privately as FLUENTT_TEST_DATABASE_URL. Fixtures created/migrated/dropped only their generated UUID database through head `0025_assessed_proficiency`. No Supabase or existing database migrations were applied.

Administrator tests: `node --test tests/*.test.mjs`. Typecheck/lint commands ran in each app directory.

Initial attempts are not counted as passes: the first backend collection lacked Authlib; appending the existing dependency location resolved this. Restricted Windows execution stalled asynchronous tests and was interrupted; the normal-process rerun completed. An initial PostgreSQL selection named two absent speech integration modules and ran no tests; the corrected selection initially had 7 setup errors while PostgreSQL was stopped, then passed all 7 after starting the existing isolated cluster. Two new test fixtures initially failed (missing web export and unconfigured-DB dependency); supplying a temporary web fixture and a no-access sentinel DB dependency verified the intended contracts. These were test setup corrections, not model/app fallbacks.

## Running and remaining work

The combined source needs its own ignored backend/mobile/admin environment configuration. Do not copy example absolute paths from another PC or blindly run initializers against Supabase. Review and back up the target database before applying version-5 migrations; this task verified them only on disposable data. Existing deployed services and the phone APK still use their prior code/configuration.

WavLM keeps its 5 GiB available-RAM gate; MMS keeps 8 GiB. Source merging does not establish model readiness, licenses, new phone connectivity or microphone scoring. Do not change these gates to make a demonstration appear operational.

The user authorized the backup push. The combined branch is local; no team repository branch was overwritten. The exact changed-file inventory is VERSION5_COMBINATION_FILES.txt.
