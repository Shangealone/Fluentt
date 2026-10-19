# D11E-F1 Complete Scheduler Result Revalidation Review

## 1. Status

**D11E-F1 READY FOR INDEPENDENT RE-REVIEW.**

I-01 is corrected and verified by the original independent reproductions, new acceptance-level adversarial tests and the required regressions. This is a correction submission, not an independent approval of D11E or authorization for formal/live collection. No staging, commit or push occurred.

## 2. Baseline

- Date: 2026-10-18.
- Branch: `main`.
- HEAD: `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`.
- Index empty; existing dirty D10/D11/P01/P02 work preserved; no clean/reset.
- Initial `git diff --check` passed; only existing LF-to-CRLF advisories appeared.
- Captured SHA-256 for all **265 pre-existing tracked/untracked non-ignored files** before editing. Exactly two existing files changed; the other **263 remain byte-identical**. One new report was added.
- Read the F1 brief, D11A output/state contracts, I-01 independent finding and D11E implementation evidence. Inspected the actual models, serializer, pure engines, canonical validator and shared service call site.

Authorized implementation scope was kept to:

1. `backend/app/scheduling/research_contracts.py`: canonical deep field reconstruction before the existing model validation.
2. `backend/tests/reviews/test_d11e_acceptance.py`: adversarial acceptance, representation/strictness, precision, call-count/replay and complete-formal regression coverage.
3. This new untracked report.

Neither `service.py` nor `acceptance.py` needed a change. Engines, authority, schema/models/DDL, migrations, dependencies, lockfile, mobile, pronunciation, Chapter 3 and previous reports were protected.

Review-start/current SHA-256:

| File | Before F1 | After F1 |
| --- | --- | --- |
| `backend/app/scheduling/research_contracts.py` | `a23adf8856e9f4d10950dcbd409bb9800a384fb0019567e9986c607d3b97b781` | `73c4c28447daa1115570efa94d128f3504627e166355ccabb74da73d4e769e36` |
| `backend/tests/reviews/test_d11e_acceptance.py` | `833afba0c95b7490edc913aa08c10b542547bc14317bc22fb74f4be6c7274e84` | `82827fba74216a45a95bbd937a629c40134cc35018d46118c405d582ee599ca1` |
| `backend/app/reviews/service.py` | `4b3ad5f9360f67ea8847c8b2f0eefe4508a4a13d39eb4b6644345e7dbf491514` | `4b3ad5f9360f67ea8847c8b2f0eefe4508a4a13d39eb4b6644345e7dbf491514` |
| `backend/app/reviews/acceptance.py` | `9d67f292d9a7187afff1e3ff0790c6e7ec58c24d9b8db572d3223b9e80eb1680` | `9d67f292d9a7187afff1e3ff0790c6e7ec58c24d9b8db572d3223b9e80eb1680` |
| `backend/app/scheduling/sm2.py` | `02491e6e347e9fa3cf4c01dad17899b998475e453bd89b414269a3b10ceed48d` | `02491e6e347e9fa3cf4c01dad17899b998475e453bd89b414269a3b10ceed48d` |
| `backend/app/scheduling/fsrs6.py` | `ae55c25605ed748e8341d69f00a484921988db921477e58f82b12b3920272f52` | `ae55c25605ed748e8341d69f00a484921988db921477e58f82b12b3920272f52` |
| `backend/app/research_authority/config_v1.py` | `b3af792ef3bc623ea4f2575d963574df094f08b45156653972e0d36e02f1a670` | `b3af792ef3bc623ea4f2575d963574df094f08b45156653972e0d36e02f1a670` |
| `backend/tests/scheduling/fixtures/fsrs6_6_3_2_goldens.json` | `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6` | `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6` |
| `backend/pyproject.toml` | `1052e4282cb0bb8a0161e91997c53ff900385d0f8a1634378c9a6b40ea2a8006` | `1052e4282cb0bb8a0161e91997c53ff900385d0f8a1634378c9a6b40ea2a8006` |
| `backend/uv.lock` | `19142dde9e25413c7ad7de31071173b5088984c09acb475cc0c3b31ac7a55eca` | `19142dde9e25413c7ad7de31071173b5088984c09acb475cc0c3b31ac7a55eca` |
| `docs/development/d11e-independent-code-review.md` | `4c131a1a7c90bb80429fb248253b278dcc22d112961d7f450047b816611448ba` | `4c131a1a7c90bb80429fb248253b278dcc22d112961d7f450047b816611448ba` |

## 3. I-01 Reproduction

Before any production change, reran the unchanged external independent-review probes through actual shared research acceptance in the guarded isolated PostgreSQL test schema.

| Real adapter, then nested no-validation mutation | Observed pre-fix durable counts: attempt / schedule / ledger / pointer / canonical events |
| --- | --- |
| Enhanced, stability = -1.0 | 1 / 1 / 1 / 1 / 2 |
| Conventional, ease_factor = Decimal("9"), other fields unchanged | 1 / 1 / 1 / 1 / 2 |

Both rejection assertions failed: **2 failed, 65 deselected in 3.20s**, exit 1. The probe wrapper calculated once using the real engine, changed only nested memory with model_copy, and kept result identities, interval and due unchanged. No stored row was manually altered.

Added permanent tests before the production correction. The two original online first-review cases then failed at the explicit persistence sentinel: **2 failed, 175 deselected in 2.59s**, exit 1, with “Malformed result reached accepted-evidence staging”. This establishes the regressions detected the actual missing boundary rather than an unrelated setup error.

After the correction, the unchanged full independent suite passes **67 cases**, including both original negative-stability and EF=9 assertions. Invalid results now raise ValidationError before evidence staging; complete row/pointer snapshots remain unchanged.

All database execution used `fluentt_test` / private schema `d11b_21ec17a1c5`. D10 evidence, app-owned SQLite and human credentials were not accessed.

## 4. Root Cause

`ResearchSchedulerResult.model_validate(existing_instance)` did not force fresh field validation through the result, state envelope and condition-specific memory. Pydantic defaults to trusting existing model instances. strict/frozen/extra-forbid settings do not make model_copy(update=...) or model_construct validate their updates.

The outer after-validator reran identity/interval agreement, but did not recheck every nested domain or SM-2 reachability invariant. Thus the old interval-disagreement mutation test passed while negative FSRS stability and out-of-range SM-2 EF could persist.

A plain model_dump-based fix would also be incomplete for retained extra fields: with extra=forbid, model_copy can retain unknown keys in __dict__ that model_dump silently omits. That behavior was independently verified and is covered by the new extra-field tests.

## 5. Canonical Deep Revalidation Boundary

Implementation plan followed: reproduce both original failures; write rejection tests and observe red; correct only the canonical validator; run the focused, complete, scheduler/routing and full regression gates; protect unrelated files by hash; publish this correction evidence.

`research_contracts._result_field_data` recursively converts BaseModel field storage and ordinary nested dictionaries into fresh ordinary dictionaries. For a model, it reads `vars(value)` plus any `model_extra`. It never invokes a field/model serializer and does not filter away retained unknown keys. Scalars are passed unchanged.

`validate_research_result` now calls:

```python
result = ResearchSchedulerResult.model_validate(_result_field_data(value))
```

The existing Pydantic models remain the only domain/strictness/reachability validators. Result, envelope and memory are reconstructed freshly even for existing instances, constructed objects and dictionaries containing model instances. No global instance-revalidation policy, duplicate handwritten domain validator, engine retry, transition recalculation, new schema or routing change was introduced.

The schema has model/dictionary object layers and scalar memory fields; lists or other invalid field types are rejected by the existing contracts. Decimal, datetime and binary64 float values retain their original Python representation before field validation. The JSON-only EF serializer is bypassed. Valid memory state remains Review/null for FSRS.

**Extra-field distinction:** retained unknown keys from model_copy are exposed and rejected at result/state/memory levels. An extra-forbid model_construct may discard an unknown input key before returning an object; no later validator can recover a key that no longer exists. The report does not claim otherwise. Direct malformed dictionary inputs retain unknown keys and are rejected. Missing required fields in result/state/memory constructed objects were separately probed and reject with ValidationError.

The unchanged service call occurs after one calculation and before `_persist_research_acceptance`. The latter stages the first accepted ReviewAttempt; therefore complete fresh validation precedes every attempt/schedule/ledger/research-event insert and pointer change.

## 6. Enhanced Invalid-Memory Rejection

Twelve malformed enhanced-memory cases are injected after a real valid EnhancedFsrsScheduler calculation:

- Stability -1.0, zero, NaN, +infinity and bool.
- Difficulty zero, 11, NaN, +infinity and numeric string.
- State Learning and non-null step 0.

Each runs through **online and sync**, for **first and subsequent reviews**: **48 cases**. First-review memory uses model_copy; subsequent-review memory uses model_construct, then already-instantiated outer state/result copies. Outer identities, due and interval remain untouched.

All reject with ValidationError identifying memory, with the persistence entry forbidden and complete durable evidence snapshots equal before/after. The subsequent cases preserve an existing valid accepted chain and current pointer. Exactly one real adapter calculation and one native FSRS review_card call occur in each challenged answer.

## 7. Conventional Invalid-Memory Rejection

Twelve malformed conventional-memory cases:

- EF 9, 1.29, NaN and infinity.
- Negative repetitions and negative lapses.
- Interval zero and 36501.
- Domain-valid EF 2.18 inconsistent with zero lapses, proving the reachable-memory validator reruns.
- Floating repetition count, boolean lapse count and string interval.

Again **48 cases** cover both transports and both contexts with existing malformed model instances. All fail before accepted-evidence staging. The valid predecessor/current pointer remains value-identical at the durable-row level. The adapter executes once, and FSRS is never invoked for these conventional assignments.

The original outer consistency test, where memory.interval_days differs from result.interval_days, is retained and passes. It is not treated as proof of nested domain validation.

An additional **48 structural cases** span both conditions, model instances, ordinary dictionaries and hybrid dictionaries containing model instances. They reject unknown fields at result/envelope/memory, boolean result days, floating seconds, boolean schema version, unknown algorithm and unknown configuration. These tests explicitly prevent serializer-based extra-key stripping and weaker dictionary paths.

## 8. Valid Decimal / Float Preservation

Four precision/determinism tests cover both conditions, first Correct and first Incorrect, then a six-answer sequence with lapses and recovery. Genuine instance output and ordinary Python dictionary output validate to equal complete results, with fresh result/state/memory objects. The original is unchanged.

Conventional tests assert type Decimal and identical Decimal.as_tuple(), and exercise exactly **2.5, 2.18, 1.86, 1.54 and 1.3**. There is no float or JSON conversion at the boundary. Next SM-2 results calculated from original, validated-instance and validated-dictionary memory are identical.

Enhanced tests compare stability/difficulty float.hex() values, preserving exact binary64 bits across revalidation. First Good, first Again and mixed lapse/recovery sequences retain complete state/interval/due equivalence and identical next pure transition.

The required 238 time/contract/SM-2/FSRS tests pass. The pinned FSRS fixture check reproduces the direct-library outputs without regeneration; its protected SHA-256 remains `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6`. Neither engine nor SM-2 vectors changed.

These deterministic comparison tests intentionally make separate pure calls to compare candidates. Production acceptance still makes exactly one transition for one answer.

## 9. Persistence Atomicity

All **144 malformed acceptance cases** capture every row/column of:

- ReviewAttempt
- ReviewSchedule
- AcceptedClientEvent
- CurrentReviewSchedule
- ResearchEvent

Snapshots use fresh ordered database reads before/after, not counts alone. For each invalid return, `_persist_research_acceptance` is replaced by a failure sentinel and must never be entered. This proves rejection **before staging**, rather than relying on rollback after invalid inserts.

For subsequent memory cases, an accepted predecessor exists before injection and the entire chain/pointer remains unchanged. For first-review cases, all accepted-chain tables remain empty. Session preflight remains the existing separately permitted session boundary, not accepted evidence.

The unchanged independent probes also retain all six real staged failure/rollback points for both engines, with existing evidence preserved, as well as actual due-overflow failures. No schema or exception/fallback routing change was used.

## 10. Replay / Online / Sync

Two new valid-acceptance/replay cases verify one adapter call for each condition and exactly one FSRS review_card call only for Enhanced. After acceptance, engine resolution and the service result validator are forbidden. Online and sync replays both return the original stored complete result with unchanged evidence snapshots.

All 96 malformed-memory cases exercise both HTTP online acceptance and sync shared acceptance. Online TestClient propagates the same result-domain ValidationError; no new transport-specific validation or HTTP error-mapping policy was introduced. Both transports reject before persistence.

Independent replay probes after predecessor advancement and routing disablement also pass. No accepted replay reruns fresh validation of a hypothetical adapter output or advances a pointer.

## 11. Routing / Concurrency Preservation

`service.py`, `acceptance.py`, authority/configuration/schema/migration files and engines are byte-identical to baseline. Learner-lock order, post-lock replay, assignment resolution, exact dispatch and fresh predecessor reconstruction are untouched.

Two new complete-formal authority cases, covering both groups, have both condition mappings, valid frozen configs/content and the explicit test clock reference. Online and sync return **503 D11_ROUTING_DISABLED**, with complete evidence snapshots unchanged. The independent complete-formal probes also pass.

The existing real PostgreSQL conventional concurrency test passes. The unchanged independent probes repeat distinct-event and same-UUID races for **both engines**: actual FOR UPDATE, independent sessions/observer, pg_blocking_pids, B reading A's committed predecessor and final pointer at B. No duplicate chain, lost update or divergent predecessor.

No formal/live routing, allocation, period-order policy or clock tolerance was opened or altered. Only explicitly authorized testing/test authority can accept research work.

## 12. Regression Results

Fresh executions in the requested order, with independent probes additionally run before the full suite:

| Check | Result |
| --- | --- |
| New I-01 focused cases, -k f1 | **152 passed**, 25 deselected, 2 warnings in 45.98s; exit 0 |
| Complete D11E acceptance file | **177 passed**, 2 warnings in 67.09s; exit 0 |
| Time boundaries / research contracts / SM-2 / FSRS | **238 passed**, 2 warnings in 10.94s; exit 0 |
| FSRS capture --check only | Pinned direct-library golden reproduction: PASS; exit 0 |
| D11B acceptance / D11C-D11D routing | **32 passed**, 2 warnings in 9.66s; exit 0 |
| Unchanged independent review probes | **67 passed**, 2 warnings in 21.69s; exit 0; previously 2 failed |
| Missing constructed fields and malformed raw numeric dictionary | **4 rejected** with ValidationError; no database used |
| Retained versus already-discarded extra-field probe | PASS; no database used |
| Full backend pytest | **645 passed**, 2 warnings in 132.34s (0:02:12); exit 0 |
| Ruff app tests scripts, --no-cache | All checks passed!; exit 0 |
| Static Python compilation | **100 files**, app/tests/scripts/alembic, compile() in memory; exit 0 |
| uv lock --check --offline | **49 packages**, resolved in 1ms; exit 0 |
| git diff --check | PASS; exit 0; existing LF-to-CRLF advisories only |
| Final file protection | Exactly 2 authorized existing files changed; 263 others unchanged; 1 new untracked report |

Commands used backend virtualenv Python with -B and the reviewed `C:\Users\user\AppData\Local\Temp\fluentt-d11b-run.py` wrapper. Pytest ran with `-q --tb=short -p no:cacheprovider`; the full suite had no file filter. Tests were sequential in the existing dedicated private schema, never the D10 database. The original independent probe script was not edited.

The two pytest warnings remain the existing Starlette/httpx and AnyIO BlockingPortal deprecations. No failing product test was changed to avoid its failure. Initial lint caught import ordering, an unused import and Decimal(9) style in the new test code; those were corrected, and the final complete lint passes. Formatting was restricted to newly added test ranges.

## 13. Remaining M-02/M-03

- **M-02 OPEN / DEFERRED.** Dedicated existing test-schema topology retained. Multi-connection concurrency uses that same private schema; no shared parallel multi-schema topology was introduced.
- **M-03 OPEN / DEFERRED.** DevelopmentScheduler extreme-date behavior and source remain untouched; not counted as a new F1 failure.

Prior reviewed research-time corrections remain preserved. No deferred item was silently closed.

## 14. Git Status

Branch `main`; HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; index empty. Existing tracked dirty changes and untracked D10/D11/P artifacts remain. The only changes relative to this task's 265-file baseline are:

```text
modified (already untracked): backend/app/scheduling/research_contracts.py
modified (already untracked): backend/tests/reviews/test_d11e_acceptance.py
new untracked: docs/development/d11e-f1-complete-result-revalidation-review.md
```

Git still reports the two implementation/test paths as ??, because they were untracked before F1. File hashes, rather than git diff alone, establish the exact correction scope. All 263 other existing files are unchanged, including the prior independent report, integration report, engines, service/acceptance code, authority/configuration, migration, fixtures and dependency/lock files.

No files staged; no commit, push, clean/reset, mobile/native change or unrelated milestone execution.

## 15. Recommendation

Submit this narrow I-01 correction for independent re-review. The result boundary now reconstructs and validates every result/envelope/memory layer, rejects malformed existing instances before evidence staging and preserves exact valid scalar values. Original failures, expanded adversarial cases, valid outputs, one-transition acceptance, replay, real concurrency and complete-formal closure are verified.

Keep formal/live collection closed and M-02/M-03 deferred. This report preserves the prior independent BLOCKED finding as historical evidence; independent approval remains a separate review.

**D11E-F1 READY FOR INDEPENDENT RE-REVIEW.**
