# Speech model integration: implementation and verification

Date: 2026-10-29. Target: tracked `mobile/` and `backend/` on `fluentt/main`,
starting from checkpoint `73676bc`. This is a candidate integration, with normal
learner speech capabilities disabled until trained artifacts and validation are ready.

## Implemented

- Authenticated, ephemeral speech endpoints: `GET /speech/capabilities`,
  `POST /speech/recognitions`, and `POST /speech/assessments`.
- Exact published item/revision/release resolution supplies the reference phrase
  and language. Mobile input cannot supply an authoritative owner or reference.
- Separate private Wav2Vec2 and WavLM worker processes, independent dependency
  locks, offline artifact loading, checksum manifests and bounded admission.
- Android foreground mono PCM16 capture, a ten-second limit, provisional/final
  word feedback, and separate pronunciation assessment. A numeric result renders
  only after a strict, finite, actual model response.
- Explicit recognition and assessment audio choices, session/attempt guards,
  cancellation, bounded network deadlines and no automatic audio replay.
- Existing cached lessons and review synchronization retain their behavior.
  Audio, transcripts and scores never enter that queue or the research ledger.
- The API rejects excess speech requests before buffering their audio or waiting
  for inference thread capacity. Both workers reject excess inference immediately.

No database migration, permanent speech history, model training, dataset download,
Azure fallback, public deployment or APK build was performed.

## Verification

| Check | Result |
| --- | --- |
| Complete mobile Jest suite after fixes | 258 passed across 35 suites |
| Mobile typecheck | Passed |
| Expo lint | Passed, 0 errors; 2 existing i18n import warnings |
| Backend regression after fixes | 689 passed; 3 independently reproduced baseline failures deselected |
| New backend speech checks | 31 passed |
| Private worker / acoustic decoder checks | 8 passed |
| Backend and worker Ruff checks | Passed |
| Worker Python source compilation | Passed, without importing ML libraries |

The mobile suite uses the project's Jest installation; typecheck uses
`tsc --noEmit`, and Expo lint uses the existing F: package store. Backend tests use
the existing virtualenv and `pytest -q` with only the three exact exclusions below.
Worker tests run independently with `pytest --noconftest speech-workers/tests`.
The only installed mobile additions are SDK-matched audio/UUID packages and the
direct Babel runtime/test-transform dependencies needed by the existing pnpm layout.

The three known backend failures were reproduced using an archive of untouched
checkpoint `73676bc` before excluding them from the remaining regression run:

1. `tests/content/test_provenance_migration.py::test_real_upgrade_preserves_legacy_rows_and_creates_no_inferred_content`
   fails because the existing `pronunciation_attempts` foreign key prevents its
   downgrade from dropping `content_releases`.
2. `tests/research_logging/test_migration.py::test_empty_history_round_trip_reinstalls_guards_and_nullable_columns`
   counts 12 database-wide `d9_immutable_row` triggers where the test expects 4.
3. `tests/reviews/test_d11b_persistence.py::test_real_migration_round_trip_preserves_existing_rows_and_pointer`
   fails on the same 12-versus-4 trigger-count assertion.

These failures and the existing database objects were left intact. All database
tests used the repository's guarded, isolated `_test` database fixtures.

## Independent review and fixes

A single read-only review by GPT-6 Luna at extra-high reasoning inspected
`73676bc..9a51bbd`, including the installed Expo SDK 57 streaming source. It found
three Important issues and no Critical or Minor findings. The author reproduced
and fixed all three in one follow-up pass:

- English and Filipino assessment choices now explicitly say the recording is
  **sent** for pronunciation feedback. Both visible wording checks failed before
  the change and passed afterward.
- A refreshed assessment-consent version clears the old checkbox acceptance.
  The UI test first observed `checked: true` incorrectly carrying over, then
  verified that the new version requires a fresh choice and cannot submit yet.
- A concurrent API test first observed the excess request body being consumed;
  admission now rejects that request without reading its PCM stream.

The same pass also reproduced and corrected misleading microphone advice when
model availability disappears between opening the screen and starting a recording.
This was verified with a failing-then-passing UI test.
The displayed speaking prompt also normalizes curly apostrophes consistently
with the server reference, so a contraction such as “don’t” stays one word.
Its UI check first reproduced the incorrect split and then passed after the fix.

No second reviewer was dispatched. Final fixes are verified by the regression
checks rather than described as independently re-reviewed. Deferred review minors: none.

## Pending deployment and field gates

- No model artifacts are configured. No checkpoints were downloaded or trained.
  Passing contract tests with injected test fixtures does not establish model
  accuracy, pronunciation validity, or real inference readiness.
- The current Wav2Vec2 candidate emits phonemes; English words are lexicon
  estimates. The WavLM candidate is English-only and unvalidated. Their workers
  always report `unvalidated_model_prediction`, so learner flags alone cannot
  turn those candidates into validated learner features.
- Tagalog remains unavailable until its own trained artifact, decoder/assessment
  contract, and held-out evaluation are approved.
- One Android device is attached, but actual capture/model checks require a
  compatible client with the new native module and configured model services.
  The SDK 57 web streaming implementation returns no stream; web and older native
  clients therefore show recording unavailable safely.
- Docker is not available in this environment. Images, deployed peak memory,
  real inference and up-to-30-user load were not exercised. WavLM's 4 GiB free-RAM
  guard is an initial check, not a measured peak-memory guarantee.
- Resolve the upstream scorer notice described in its NOTICE file before
  redistribution. Model/data licenses and the study's approved processing protocol
  remain required before field use.
- Configure a reachable API address for physical phones and HTTPS for release
  speech traffic. Freeze the same app/model revisions for both 30-student groups;
  keep those participants out of model training and threshold tuning.

## Implementation decisions

These record the execution rulings and their practical tradeoffs:

| Decision | Reason and practical cost |
| --- | --- |
| Work in the requested current checkout | Preserves the user's chosen branch; unrelated untracked files remain untouched. Isolation is provided by the existing checkpoint and local commits. |
| Use the existing backend environment directly and put new caches on F: | The original uv cache/interpreter launch was blocked by the local environment. Commands differ from the plan's shorthand; app behavior is unaffected. |
| Resolve language from the exact published lesson/release | Keeps mobile and server targets consistent. Legacy rows without immutable references cannot launch speech. |
| Require supplied model artifacts and a compatible client for live checks | Avoids claiming inference/device success from fixtures. Live speech remains unavailable until those resources are configured. |
| Add direct Babel runtime/test-transform dependencies | Repairs strict pnpm resolution needed to run checks. Adds small JS dependencies; no ML runtime enters the app or API. |
| Treat web and unsupported native streaming as unavailable | Follows the installed SDK's actual implementation and avoids startup crashes. Browser recording needs a future adapter. |
| Add a login/logout epoch separate from token rotation | Rejects late responses even after re-login as the same user. A new login invalidates an in-progress recording; routine refresh remains compatible. |
| Use SDK-matched Expo Crypto for UUIDs, loaded on demand | Provides distinct request/attempt IDs. A native client needs that module when recording starts. |
| Require HTTPS for release speech | Protects release audio transport. A release pointed at a plain HTTP API cannot use speech. |
| Return failed HTTP responses without score fields | Prevents empty `/100` and manufactured zero scores. A failed assessment requires a new recording. |
| Commit backend, workers and mobile in separate local checkpoints | Keeps coupled changes reviewable without a branch-wide merge. No remote push was performed. |
| Pin the pnpm store to F: or use installed verification scripts | Avoids automatic module replacement or duplicate stores. This is a tooling adjustment only. |
| Allowlist Docker build-context files and include attribution notices | Prevents old copies, APKs, secrets and caches entering images. Other root-context Docker builds would need their own allowlist additions. |

The review deliberately set aside actual model quality, device/APK execution,
container/load validation, training/Tagalog/history/research features and the old
`.local-version-2` app, because they are explicit gates or outside this integration.
Detailed dependency hashes were not manually audited by the reviewer; they were
generated by the package resolver. Those limitations do not imply deployment approval.

## Setup references

- [Wav2Vec2 worker and API configuration](../../speech-workers/wav2vec2/README.md)
- [WavLM resources and scoring boundary](../../speech-workers/wavlm/README.md)
- [Approved design](../superpowers/specs/2026-10-29-speech-model-integration-design.md)
- [Implementation plan](../superpowers/plans/2026-10-29-speech-model-integration.md)
