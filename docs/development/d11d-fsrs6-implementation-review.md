# D11D FSRS 6.3.2 Enhanced Scheduler Implementation Review

## 1. Status

**D11D READY FOR CODE REVIEW** on 2026-10-17. Final backend regression and protection checks passed as recorded below. This report requests independent code review of the pure engine only. Research acceptance remains disabled.

## 2. Baseline

- Repository `F:\FLUENTT`; branch `main`.
- HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353` (`fix(reviews): isolate per-item timing lifecycle`).
- Initial index empty; initial `git diff --check` passed.
- Existing reviewed D11B/D11C modifications and prior untracked reports retained. SHA-256 protection captured 250 existing tracked/untracked files before editing.
- Only two existing files changed for D11D: backend dependency manifest and lockfile. The other 248 existing files match the starting hashes, including SM-2, contracts/configuration, acceptance, migrations, mobile and prior evidence/reports.
- No staging, commit, push, cleanup/reset, enrollment or production-data operation.

## 3. Dependency Verification

Before installation, `fsrs` was absent from the backend manifest, lock and environment. Backend runtime is CPython 3.13.15; manifest requires `>=3.13,<3.14`.

Official [PyPI fsrs 6.3.2 metadata](https://pypi.org/pypi/fsrs/6.3.2/json) identifies distribution `fsrs`, version `6.3.2`, Python `>=3.10`, and base dependency `typing-extensions`. Optimizer dependencies are optional extras. This includes Python 3.13 compatibility.

Added exactly `fsrs==6.3.2` through `uv --system-certs add 'fsrs==6.3.2'`. The initial ordinary uv attempt failed certificate validation; using the system certificate store succeeded without weakening TLS. Actual `import fsrs` and installed distribution version check passed. Only fsrs was installed; `typing-extensions==4.16.0` already existed. No optimizer, torch, numpy or pandas added. Lock resolves 49 packages, up from 48; all existing package versions/dependencies are unchanged except the backend project's new fsrs dependency.

Locked artifacts:

- Wheel `fsrs-6.3.2-py3-none-any.whl`: SHA-256 `bc55066c821164b1cff6d75b17a3ed8e86cfd45789e3d775cfcb895319ce9ba4`.
- Sdist `fsrs-6.3.2.tar.gz`: SHA-256 `7fe79947ceb92ca35fdca3dfa511a239be15b317cde63d6643a2da6110844d91`.
- `uv lock --check --offline`: exit 0, `Resolved 49 packages in 3ms`.

## 4. Files Changed

Existing files modified:

- `backend/pyproject.toml`: exact runtime dependency pin.
- `backend/uv.lock`: fsrs package/artifact checksums and backend dependency entries.

New files, left untracked:

- `backend/app/scheduling/fsrs6.py`: pure engine and strict reconstruction context.
- `backend/scripts/capture_fsrs6_goldens.py`: independent direct-library capture/check utility.
- `backend/tests/scheduling/fixtures/fsrs6_6_3_2_goldens.json`: literal outputs with runtime/source/config provenance.
- `backend/tests/scheduling/test_fsrs6.py`: 79 pure-engine/API/golden/boundary tests.
- `backend/tests/reviews/test_d11d_routing.py`: two online/sync routing-negative tests.
- `docs/development/d11d-fsrs6-implementation-review.md`: this report.

## 5. Installed FSRS API

Inspected actual installed signatures/source for `fsrs.Scheduler`, `Card`, `Rating`, `State` and `Scheduler.review_card` before adapter implementation:

```text
Scheduler(parameters, desired_retention, learning_steps, relearning_steps,
          maximum_interval, enable_fuzzing)
Card(card_id, state, step, stability, difficulty, due, last_review)
Scheduler.review_card(self, card, rating, review_datetime, review_duration)
```

These list actual signature fields; optional library defaults exist but all research-locked fields and both review options are supplied explicitly. Rating Again=1, Good=3; State Learning=1, Review=2, Relearning=3. Full 256-bit integer IDs survive Card construction, copy and transition unchanged. Both first Good and first Again yield Review/step None with empty steps. No D11A API mismatch/stop condition occurred.

Source inspection confirms Card generates an ID/reads current time only when ID/due are omitted; review_card uses current time only when review_datetime is omitted. Explicit values avoid those paths. review_card copies its input Card; tests inspect both the unchanged original and returned ReviewLog.

## 6. Frozen Configuration

At import, validate the frozen canonical document and seed-record digest against:

`4e4c56a9f928cae5581e5d577de413b17c9d581185482db423a98551f6575e4f`.

Validate identity/document/record agreement, then detach values into an immutable tuple with a frozen identity model. No scheduler instance or mutable seed dictionary is shared across calculations.

```text
scheduler_type = enhanced_srs
algorithm_version = fluentt-esr-fsrs6-binary-v1
state_schema_version = 1
config_version = fsrs6-binary-r90-config-v1
parameters = (0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194,
              0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
              1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542)
desired_retention = 0.9
learning_steps = ()
relearning_steps = ()
maximum_interval = 36500
enable_fuzzing = False
```

Tests spy the real Scheduler constructor and inspect all six resulting settings, with literal independent fixture parameters. Version/signature/enum guards detect package/API drift. No optimizer/retraining/default selection.

## 7. Engine / Reconstruction Contract

`EnhancedFsrsScheduler.schedule(inputs, reconstruction)` consumes the unchanged four-field `ResearchSchedulerInput` plus `FsrsReconstructionContext`. Context has exactly strict UUID `user_id`, strict UUID `vocabulary_item_id`, and required nullable UTC-aware `prior_due_at_utc`. The context represents server-owned facts; no client ID/identity routing was added.

Card ID is `(user_id.int << 128) | vocabulary_item_id.int`, with no hash/truncation/randomness. Inputs and context are revalidated from copies to reject bypassed model validation. Prior state/interaction pairing remains enforced by the shared contract; prior due presence must also agree. Subsequent state must validate as EnhancedState. Extra mathematical/context features and arbitrary dictionaries fail before a library transition.

## 8. First Review

Prior state, interaction and due absent. Construct exactly Learning/step 0, stability/difficulty None, due=current interaction, last_review=None, explicit deterministic ID. Call real review_card once with explicit UTC `review_datetime` and `review_duration=None`.

Fixed first anchor: `2026-01-01T10:11:12.123456+00:00`.

| Answer/rating | State/step | Stability | Difficulty | Days / seconds | Due UTC |
| --- | --- | --- | --- | --- | --- |
| Correct / Good (3) | Review / null | 2.3065 | 2.118103970459016 | 2 / 172800 | 2026-01-03T10:11:12.123456+00:00 |
| Incorrect / Again (1) | Review / null | 0.212 | 6.4133 | 1 / 86400 | 2026-01-02T10:11:12.123456+00:00 |

Transient Learning state is never returned as application memory.

## 9. Subsequent Reconstruction

Build a fresh Card with Review/step None, prior application stability/difficulty, authoritative context due, prior linked interaction as last_review, and deterministic owner/item ID. No history replay, due inference, server receipt time or acceptance eligibility rule. The spy test covers every mixed transition and a cap-state reconstruction, including exact prior due and last_review facts.

## 10. Binary Rating Mapping

Correct -> Good (3); Incorrect -> Again (1). No Hard/Easy, response duration, confidence, pronunciation, instructional difficulty, interruption evidence, network delay or receipt timestamp input. Review duration is explicitly None on every call, including inspected real ReviewLogs.

## 11. Interval / Due Contract

Validate returned Review/step None, unchanged integer Card ID and last_review matching explicit UTC interaction. Derive `delta = updated.due - interaction_at_utc`. Reject nonzero remainder seconds/microseconds, nonpositive days or days outside 1..36500. No rounding/truncation of due evidence.

Recompute application due as interaction + timedelta(days=days), require exact equality with library due, then pass days*86400 and the result through existing `validate_research_result`. Library maximum cap fixture yields 36500 days / 3153600000 seconds. Corrupt-output tests reject state/step, nonfinite/out-of-range/coerced memory, identity/time mismatch and fractional/zero/negative/out-of-cap due values.

## 12. Application State Extraction

Use existing `FsrsMemory` and `EnhancedState`. Memory contains exactly `state`, `step`, `stability`, `difficulty`; state envelope contains exactly schema/type/algorithm/config/memory. Finite positive stability and difficulty within 1..10 are validated without arbitrary float rounding. Card, card_id, due, last_review and ReviewLog never enter memory or escape as canonical state. Input state/context and reconstructed Card remain unchanged.

## 13. Runtime Numerical Goldens

Direct capture used installed fsrs 6.3.2 before the adapter existed, with only stdlib/fsrs imports. The script independently checks the frozen configuration using AST literal data, literal parameter values and the exact digest. It carries a direct uninterrupted library Card across answers; expected outputs are never calculated with the wrapper.

Fixture contains 16 families / 39 literal transitions: first Correct/Incorrect, Correct-Correct, Correct-Incorrect, Incorrect-Correct, multiple Correct, repeated Incorrect, eight-answer mixed sequence, on/after/before due, same day, three elapsed-day boundaries and maximum cap. Provenance includes CPython 3.13.15/AMD64, installed version, actual Card/Scheduler source SHA-256, fixed synthetic UUIDs/full 256-bit ID and explicit config. `--check` reproduced the fixture without rewriting it.

Mixed sequence (day offsets from the first anchor; C=Correct, I=Incorrect):

| Day / answer | Stability | Difficulty | Interval days |
| --- | --- | --- | --- |
| 0 / C | 2.3065 | 2.118103970459016 | 2 |
| 2 / I | 0.6075801062519337 | 7.394502741279718 | 1 |
| 3 / C | 2.4004040500172708 | 7.382336607835277 | 2 |
| 6 / C | 7.122749316158636 | 7.37018264052428 | 7 |
| 7 / I | 0.9955848131321441 | 9.120825285995213 | 1 |
| 8 / I | 0.30437873506378604 | 9.69624961919152 | 1 |
| 11 / C | 1.171313786891941 | 9.681781738869166 | 1 |
| 20 / C | 3.627507508106244 | 9.667328326427134 | 4 |

All steps are Review/null; literal fixture also includes rating, seconds, due and last_review.

## 14. Elapsed-Time Behavior

From first Correct with 2-day due, subsequent Good yields: on due day 2 -> 11 days; after due day 9 -> 24 days; before due day 1 -> 7 days. These are direct engine inputs, not acceptance authorization. Library elapsed calculation uses timedelta.days. Immediately below one elapsed day -> 2 days, exactly one day -> 7, immediately above -> 7. Microsecond anchor precision is retained. Same-day mixed behavior is separately frozen.

## 15. State / JSON Round Trip

Every family runs both uninterrupted application memory and FastAPI `jsonable_encoder` -> actual JSON encode/decode -> existing `decode_research_state` -> next reconstruction. Every numerical state/interval/due equals the independent literal fixtures exactly. Mixed sequences show no consequential precision loss. Floats remain numeric JSON, not decimal strings. No accepted research DB rows are created by pure tests.

## 16. Purity / Determinism

All 79 pure tests run without database setup/cleanup. Explicit Card fields and review datetime avoid library current-clock/default-ID paths. Repeated mixed JSON sequences are equal while library clock methods, time/time.sleep, fuzz path, environment reads, socket construction and SQLAlchemy connection entry are patched to fail. Production code contains no filesystem/network/environment/database/random/current-time operations. Source review confirms one review_card invocation per schedule; real-call spy verifies one Card, one configured Scheduler and one transition per answer.

Pinned FSRS uses binary64; these are runtime goldens, not Decimal-exact or cross-platform transcendental guarantees. Deliberately no change to Binary SM-2 Decimal behavior.

## 17. Routing Closure

No existing acceptance/service/router source changed in D11D. New tests calculate a real enhanced result and then attempt allocated-owner online and sync acceptance: both still return HTTP 503 `D11_ROUTING_DISABLED`; all five accepted-chain counts remain zero. Existing D11B/D11C closure tests also pass. No research persistence, current-pointer integration, assignment/content provisioning, migration, discovery/dispatch registration or research activation added.

## 18. Regression Results

Commands run from backend, with Python `-B` and pytest cache disabled. Database tests use the existing guarded helper that refuses non-`*_test` databases and confines search_path to `fluentt_test` / `d11b_21ec17a1c5` (no public fallback). No accepted D10 evidence database was used.

| Check | Actual result |
| --- | --- |
| TDD RED: new pure tests before adapter | 78 failed / 1 API guard passed, missing module as expected |
| TDD RED: new routing tests before adapter | 2 failed, missing module as expected |
| New FSRS focused tests, final formatted source | 79 passed, 2 existing deprecation warnings, 0.20s |
| Existing contracts + SM-2 + D11B/D11C/new routing checks | 141 passed, 2 existing warnings, 21.77s |
| Direct fixture reproduction (`--check`) | PASS, no rewrite |
| Full backend `pytest -q --tb=short` (cache disabled) | 418 passed, 2 existing warnings in 81.27s (0:01:21) |
| `ruff check --no-cache app tests scripts` | All checks passed |
| Static in-memory compilation: app/tests/scripts/alembic | 98 Python files passed |
| `uv lock --check --offline` | PASS, 49 packages |
| `git diff --check` | PASS; final check repeated after report creation |

The two warnings are existing Starlette/httpx and AnyIO BlockingPortal deprecations. No dependency expansion was made for those unrelated warnings.

## 19. Deferred Issues

- **M-01 remains open:** extreme research UTC normalization/predecessor due overflow. SAFE TO DEFER UNTIL BEFORE RESEARCH ACCEPTANCE INTEGRATION; must be corrected and regression-tested before that integration. No extreme-date support claim.
- **M-02 remains open:** global D9 trigger-count test isolation. Must be corrected before changing verification to shared multi-schema layouts. Current dedicated test layout retained.
- **M-03 remains open:** pre-existing development extreme due overflow; retain separate hardening gate before claiming extreme-date support/expanding development time validation.

No D11B deferred fix was required for this pure normal-range milestone. None is falsely closed here.

## 20. Git Status

Branch/HEAD remain the baseline values; index remains empty. D11D introduces exactly the two modified dependency files and six untracked files listed in section 4. Prior working-tree modifications/untracked evidence remain untouched. The complete final short status is included below after verification.

```text
 M backend/alembic/env.py
 M backend/app/database/session.py
 M backend/app/reviews/models.py
 M backend/app/reviews/service.py
 M backend/pyproject.toml
 M backend/tests/conftest.py
 M backend/tests/content/test_provenance_migration.py
 M backend/tests/research_helpers.py
 M backend/tests/reviews/test_due_review.py
 M backend/uv.lock
?? backend/alembic/versions/d11b00000001_scheduler_persistence.py
?? backend/app/research_authority/
?? backend/app/reviews/acceptance.py
?? backend/app/scheduling/fsrs6.py
?? backend/app/scheduling/research_contracts.py
?? backend/app/scheduling/sm2.py
?? backend/scripts/capture_fsrs6_goldens.py
?? backend/tests/reviews/test_d11b_acceptance.py
?? backend/tests/reviews/test_d11b_persistence.py
?? backend/tests/reviews/test_d11c_routing.py
?? backend/tests/reviews/test_d11d_routing.py
?? backend/tests/reviews/test_research_contracts.py
?? backend/tests/scheduling/
?? docs/development/d10-timing-fix-review-bundle.txt
?? docs/development/d11-esr-preimplementation-audit.md
?? docs/development/d11a-scheduler-contracts-spec.md
?? docs/development/d11b-implementation-review.md
?? docs/development/d11b-independent-code-review.md
?? docs/development/d11c-binary-sm2-implementation-review.md
?? docs/development/d11c-f1-decimal-context-fix-review.md
?? docs/development/d11c-f1-independent-rereview.md
?? docs/development/d11c-independent-code-review.md
?? docs/development/d11d-fsrs6-implementation-review.md
?? docs/development/p01-pronunciation-preimplementation-audit.md
?? docs/development/p02-pronunciation-architecture-scoring-spec.md
?? docs/development/p02f-pronunciation-feasibility-report.md
```

Ordinary status collapses `backend/tests/scheduling/`; the protected SM-2 test remains unchanged. Only the new D11D FSRS test and fixture were added beneath that directory. The other existing dirty/untracked entries belong to the protected starting baseline, not D11D edits.

## 21. Recommendation

**D11D READY FOR CODE REVIEW**. Submit only the pure enhanced FSRS engine, locked dependency, independent fixtures/tests and this report for independent review. Research acceptance must remain disabled through the deferred gates and separate future authorization. No stop condition occurred. Nothing staged, committed or pushed.
