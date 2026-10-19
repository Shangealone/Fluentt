# D11E-F2 SM-2 Validation Determinism Review

## 1. Status

**D11E-F2 READY FOR INDEPENDENT RE-REVIEW.**

C-01 is corrected at the SM-2 memory validator. The exact pre-fix acceptance failures were reproduced before editing, new tests were observed failing, and the correction passes the required regressions plus the unchanged independent probes. This report submits a correction for independent approval; it does not declare D11E or formal/live research approved.

No staging, commit, push, clean/reset, existing-evidence repair or unrelated milestone work occurred.

## 2. Baseline

Date: 2026-10-18. Repository: F:\FLUENTT. Branch `main`; HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; index empty. Existing D10/D11/P01/P02 work remained present. Initial git diff --check passed with existing LF-to-CRLF advisories.

Captured SHA-256 for all **267 pre-existing tracked/untracked non-ignored files** before editing. Three authorized existing files changed; the other **264 remain byte-identical**. This new report is the only addition.

Files changed:

- `backend/app/scheduling/research_contracts.py`: Decimal imports and a complete validator-owned context around the existing Sm2Memory.reachable body.
- `backend/tests/reviews/test_research_contracts.py`: direct contract-layer hostile-context, full-sequence/lapse/domain and caller-preservation regressions.
- `backend/tests/reviews/test_d11e_acceptance.py`: actual sixth-Correct 238/240 acceptance regressions through shared acceptance and sync.
- This new untracked report.

The implementation plan followed the supplied narrow brief: reproduce C-01; add failing behavior tests; isolate all existing reachability arithmetic in a complete numeric context; execute the required checks; verify protected files and publish the evidence. No shared policy module or engine edit was necessary.

Removing only the F2 additions in memory reconstructs the exact pre-task hashes of all three edited files. This verifies the arithmetic body and earlier tests were preserved, beyond merely inspecting git diff for these already-untracked files.

| File | Before F2 SHA-256 | After F2 SHA-256 |
| --- | --- | --- |
| `backend/app/scheduling/research_contracts.py` | `73c4c28447daa1115570efa94d128f3504627e166355ccabb74da73d4e769e36` | `e2f36306d3950c9a0a6d5104a3c42435aac6751eeaefdfaa3b521982542f12d2` |
| `backend/tests/reviews/test_d11e_acceptance.py` | `82827fba74216a45a95bbd937a629c40134cc35018d46118c405d582ee599ca1` | `1b3c2f81862fd7c10e37d13360869837d152781fead3d4becb563fe6554707d0` |
| `backend/tests/reviews/test_research_contracts.py` | `d1cd8bb7b51931fc655685195270bbb199ab50cd12e3e263bed6a94bde0ac727` | `3e7a0ba67b25462bdde019b8691bfefca575bedf116ab31f16164e92393d9bfe` |
| `backend/app/scheduling/sm2.py` | `02491e6e347e9fa3cf4c01dad17899b998475e453bd89b414269a3b10ceed48d` | `02491e6e347e9fa3cf4c01dad17899b998475e453bd89b414269a3b10ceed48d` |
| `backend/app/scheduling/fsrs6.py` | `ae55c25605ed748e8341d69f00a484921988db921477e58f82b12b3920272f52` | `ae55c25605ed748e8341d69f00a484921988db921477e58f82b12b3920272f52` |
| `backend/app/reviews/service.py` | `4b3ad5f9360f67ea8847c8b2f0eefe4508a4a13d39eb4b6644345e7dbf491514` | `4b3ad5f9360f67ea8847c8b2f0eefe4508a4a13d39eb4b6644345e7dbf491514` |
| `backend/app/reviews/acceptance.py` | `9d67f292d9a7187afff1e3ff0790c6e7ec58c24d9b8db572d3223b9e80eb1680` | `9d67f292d9a7187afff1e3ff0790c6e7ec58c24d9b8db572d3223b9e80eb1680` |
| `backend/app/scheduling/development.py` | `6a175fe574e33f8409a8e2b9952f5acfefe98dcbeae4f892e4feda63cfa9ca0c` | `6a175fe574e33f8409a8e2b9952f5acfefe98dcbeae4f892e4feda63cfa9ca0c` |
| `backend/tests/scheduling/fixtures/fsrs6_6_3_2_goldens.json` | `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6` | `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6` |
| `backend/pyproject.toml` | `1052e4282cb0bb8a0161e91997c53ff900385d0f8a1634378c9a6b40ea2a8006` | `1052e4282cb0bb8a0161e91997c53ff900385d0f8a1634378c9a6b40ea2a8006` |
| `backend/uv.lock` | `19142dde9e25413c7ad7de31071173b5088984c09acb475cc0c3b31ac7a55eca` | `19142dde9e25413c7ad7de31071173b5088984c09acb475cc0c3b31ac7a55eca` |

Prior specifications/reports, migrations, authority/schema/models/DDL, mobile, Chapter 3, pronunciation, dependencies, lockfile, engines and scheduler-vector fixtures remain unchanged.

## 3. C-01 Reproduction

Before any production change, reran the unchanged independent F1 re-review probe through actual shared acceptance with complete TEST authority in isolated PostgreSQL.

Both cases first accepted genuine conventional Correct intervals **1, 6, 15, 38, 95**. Baseline durable counts were **5 / 5 / 5 / 1 / 10** (attempts / schedules / ledgers / pointer / canonical events).

Under caller Decimal precision 2:

| Candidate returned after one real sixth transition | Pre-fix observation |
| --- | --- |
| Genuine rep6 / EF2.5 / interval238 / lapses0 | Rejected; counts remained 5 / 5 / 5 / 1 / 10 |
| Copied memory interval240, with mutually consistent result days/seconds/due | Accepted; counts became 6 / 6 / 6 / 1 / 12; pointer advanced to invalid schedule |

The real engine returned 238 in both probes. The forged persisted JSON failed decoding under the ordinary context. Result: **2 failed, 102 deselected, 2 warnings in 3.24s**, exit 1.

New permanent precision-2 regressions were then run before the correction: **5 failed, 235 deselected in 2.98s**. The genuine shared/sync cases raised unreachable-memory errors; forged shared/sync cases reached the forbidden persistence sentinel. The direct contract test also exposed the caller Inexact flag changing during validation.

No stored fixture was manually edited to produce these failures. The unchanged independent scripts were reused without modification.

## 4. Root Cause

Decimal scalar conversion was exact. The fault was multiplication/subtraction inside Sm2Memory.reachable using the active caller's arithmetic context after the engine-owned context had exited.

Exact **95 * 2.5 = 237.5**, followed by explicit ceiling, gives **238**. With caller precision 2, multiplication had already rounded to **2.4E+2** before ceiling, producing 240. The same dependency also affected EF/lapse consistency, other reachable intervals, exponent/trap behavior and caller flags.

F1 correctly forced fresh nested validators to execute. F2 makes the arithmetic used by those validators deterministic; it does not remove or bypass the fresh validation.

## 5. Validator-Owned Numeric Policy

Sm2Memory.reachable now encloses its complete existing body in `localcontext(Context(...))`, constructing a fresh explicit Context for every invocation. It does not copy the active caller policy, mutate getcontext(), or reuse a mutable global Context.

The policy matches the reviewed BinarySm2Scheduler exactly:

| Setting | Value |
| --- | --- |
| precision | 28 |
| rounding | ROUND_HALF_EVEN |
| Emin / Emax | -999999 / 999999 |
| capitals / clamp | 1 / 0 |
| initial flags | all clear |
| traps enabled | InvalidOperation, DivisionByZero, Overflow, Underflow, Inexact, Subnormal, Clamped, FloatOperation |
| Rounded trap | disabled intentionally |

Rounded alone may reflect removal of redundant trailing zeroes from an otherwise exact Decimal representation; Inexact remains an error. Deliberate interval ceiling still uses ROUND_CEILING at the original operation.

An independent AST comparison of the two complete Context constructor calls confirmed that validator and engine settings, flags and traps are identical. The engine file itself is byte-identical.

## 6. Reachability Arithmetic

All scheduler-semantic Decimal arithmetic in research_contracts.py is now covered by the validator-owned context:

- EF/lapse expected-value multiplication and subtraction.
- Interval reachability multiplication.
- The existing explicit ceiling and integer extraction.
- Their comparisons, loop, rejection paths and return remain within the same local scope.

The formula, accepted-state relationships, transient zero/zero rejection and existing bounded cap-saturation logic are unchanged. This is snapshot validation, not another answer transition. No interval is repaired or newly clamped.

Other Decimal-related operations were audited: _decimal_number uses exact string construction and a finite check; field bounds are exact scalar comparisons; the JSON-only EF serializer is unchanged. They introduce no scheduler-semantic context-dependent arithmetic requiring a second policy wrapper. Integer interval consistency and datetime anchors are unchanged.

Removing the context wrapper/comments and added imports in memory reproduces the prior production hash **73c4c28447daa1115570efa94d128f3504627e166355ccabb74da73d4e769e36** exactly. Thus no arithmetic rule or other contract/helper was altered.

## 7. 238-Day Valid Regression

New actual-acceptance tests create five real Correct predecessors, then submit the genuine sixth Correct under both ordinary precision 28 and precision 2, using shared acceptance and sync.

All accept **238 days**, repetitions6, exact Decimal EF2.5 and lapses0. Exactly one adapter transition occurs for the sixth answer. Post-commit assertions verify:

- 6 attempts, 6 schedules, 6 accepted-event ledgers, 1 current pointer, 12 canonical events.
- The new attempt/schedule linkage and pointer reference the sixth event.
- Seconds equal 238 * 86400 and due uses the captured interaction plus 238 days.
- Stored memory is exactly rep6 / EF2.5 / interval238 / lapses0.

Direct Sm2Memory, ConventionalState and canonical ResearchSchedulerResult validation also accept the 238-day state across the entire hostile-context matrix.

## 8. 240-Day Invalid Regression

The same five-event setup wraps one real sixth transition, verifies its genuine 238-day output, then changes memory.interval_days to 240 and adjusts outer days/seconds/due to match.

Both ordinary and precision-2 shared/sync cases reject with a memory-local ValidationError. No outer mismatch is introduced; rejection depends on reachability.

A persistence-entry sentinel proves rejection occurs before _persist_research_acceptance, and complete before/after rows for attempts, schedules, ledgers, pointer and research events remain identical. The original five-event pointer does not move. The adapter call count remains one.

The unchanged independent C-01 genuine/forged probes also now pass, without their script being edited.

## 9. Hostile Decimal Contexts

Eight direct-validator cases cover:

1. Ordinary context.
2. Precision 2.
3. Precision 1.
4. Altered ROUND_UP rounding.
5. Emax=0.
6. Inexact trap enabled.
7. Rounded trap enabled.
8. Combination: precision1, ROUND_FLOOR, Emin/Emax0, capitals0, clamp1, all traps and all flags enabled.

Candidates are prepared before entering each hostile caller context. Every snapshot is checked through **four paths**: direct memory, conventional envelope, raw canonical result and a model_construct result containing nested constructed envelope/memory instances. The canonical path retains F1's deep reconstruction.

Literal Correct vectors are **1, 6, 15, 38, 95, 238, 595, 1488, 3720, 9300, 23250, 36500, 36500**. Every reachable state accepts; adjacent wrong intervals reject wherever bounds permit. The 36500 cap saturates, including a million-repetition snapshot, without accepting nearby wrong values. The forged 240 and transient zero/zero snapshot reject.

Each context covers 38 valid and 88 invalid snapshots through all four paths: **4032 contract classifications** across the eight contexts. Expected values come from literal approved vectors, not the production engine or a duplicate transition implementation.

## 10. Lapse / EF Reachability

Literal reachable lapse families cover:

| Lapses | EF | Incorrect / first Correct / second Correct / third Correct intervals |
| --- | --- | --- |
| 1 | 2.18 | 1 / 1 / 6 / 14 |
| 2 | 1.86 | 1 / 1 / 6 / 12 |
| 3 | 1.54 | 1 / 1 / 6 / 10 |
| 4 | 1.3 | 1 / 1 / 6 / 8 |
| 5 | 1.3 | 1 / 1 / 6 / 8 |

All classifications remain identical across hostile contexts. Unreachable EF/lapse pairings and adjacent wrong intervals reject, with outer result fields otherwise internally consistent.

Exact Decimal values **2.5, 2.18, 1.86, 1.54, 1.3** remain unchanged. New direct checks also preserve as_tuple() for EF representations padded with 1000 trailing zeroes; F1's genuine-engine instance/dictionary preservation tests remain green. No JSON conversion, binary float intermediate or quantization was introduced.

## 11. Caller Context Preservation

Direct tests compare active Context identity plus precision, rounding, Emin, Emax, capitals, clamp, every trap and every flag after **each successful validation and each expected rejection**. Both initially clear and preset flags, including the all-flags hostile combination, are preserved. After exiting the test context, the original outer Context object and complete snapshot also match.

Actual acceptance/sync success and rejection cases likewise snapshot all fields before/after while the reduced context remains active, including a preset Rounded flag. The original outer context is checked again after exit.

The validator's return and every ValueError path unwind its private localcontext. A standalone negative control confirms the Rounded-trap case is sensitive: unprotected 6 * padded Decimal2.18 raises Rounded, while the owned-context validator accepts the same valid 14-day snapshot, preserves the exact EF tuple and leaves initially clear caller flags clear. No policy or arithmetic flag leaks into the caller.

## 12. Original F1 Preservation

All **152 F1-focused cases** pass unchanged: negative FSRS stability, SM-2 EF9, nonfinite and strict-type mutations, model_copy/model_construct, nested existing models, retained extras, raw/hybrid dictionaries, exact scalar preservation, call counts, replay and complete-formal closure.

The F1 deep reconstruction helper, result-validation ordering and strict contracts were not modified. Two test-prefix reconstructions prove the existing tests remain unchanged:

- Contract test file before F2: **d1cd8bb7b51931fc655685195270bbb199ab50cd12e3e263bed6a94bde0ac727**.
- Acceptance test file before F2: **82827fba74216a45a95bbd937a629c40134cc35018d46118c405d582ee599ca1**.

All **171** unchanged independent D11E/F1 re-review probes pass, including the formerly failing C-01 cases and original I-01 negative controls.

## 13. FSRS Preservation

Enhanced engine, configuration, golden fixture and existing FSRS tests are byte-identical. First Good remains 2 days / stability2.3065 / difficulty2.118103970459016; first Again remains 1 day / stability0.212 / difficulty6.4133.

The exact pinned mixed intervals remain **2 / 1 / 2 / 7 / 1 / 1 / 1 / 4**. An independent read-only fixture assertion checked that literal sequence; direct-library capture ran in --check mode only and passed.

Existing F1 float.hex() comparisons and subsequent transition/read-back checks remain green. Enhanced still makes one schedule call and one native review_card call per answer. No FSRS math, state, default, dependency or fixture change was needed.

## 14. Acceptance Atomicity

The forged-240 tests reject before accepted persistence staging and compare complete durable rows, rather than counts alone. Valid238 commits exactly one complete chain.

The existing six D11E injected post-calculation/staging failures pass in the full acceptance file. Independent probes additionally exercise all six with existing predecessor evidence for both engines; rollback preserves complete evidence/pointer snapshots.

The existing separately permitted session preflight boundary remains unchanged. No accepted evidence is partially committed on a validation or staging failure.

## 15. Replay / Sync / Concurrency

Shared acceptance and sync both execute the corrected canonical result validation. The unchanged online router delegates to that same service; F1 HTTP malformed-output cases remain green. The new precision-2 shared/sync probes directly exercise the actual context of the previously failing service boundary, without claiming a network request controls Decimal precision.

Accepted replay remains first: original stored output returns without a scheduler call, new result/reachability calculation or evidence write. Independent replay after predecessor advancement and routing disablement passes.

Real PostgreSQL races for both engines pass: independent sessions, real learner row FOR UPDATE, observer pg_blocking_pids, second event reading the first committed predecessor, final pointer at the second schedule, and same-UUID post-lock replay without duplication. Service/acceptance code and transaction ordering remain byte-identical. No lock or predecessor logic moved.

## 16. Formal Routing Closure

Complete formal authority remains **503 D11_ROUTING_DISABLED**, with zero accepted-chain writes, through the existing online/shared/sync coverage for both groups. Only explicitly authorized testing/test authority can accept research work.

Authority/schema, assignment/config binding, environment gates, clock policy and routing are unchanged. No formal allocation, enrollment, migration, live clock tolerance or mobile selector was introduced.

## 17. Regression Results

Fresh executed results:

| Check | Result |
| --- | --- |
| Exact original C-01 probes before fix | 2 failed, 102 deselected in 3.24s; expected reproduction |
| New precision-2 regressions before fix | 5 failed, 235 deselected in 2.98s; expected red |
| All new F2 regressions | **16 passed**, 224 deselected, 2 warnings in 56.90s; exit0 |
| Complete D11E acceptance + contracts + SM-2 | **302 passed**, 2 warnings in 132.46s; exit0 |
| Research time boundaries + FSRS | **129 passed**, 2 warnings in 0.28s; exit0 |
| FSRS capture --check only | Pinned direct-library golden reproduction: PASS; exit0 |
| D11B acceptance + D11C/D11D routing | **32 passed**, 2 warnings in 10.58s; exit0 |
| Explicit F1-focused rerun | **152 passed**, 33 deselected, 2 warnings in 65.87s; exit0 |
| Unchanged independent D11E and F1 re-review probes together | **171 passed**, 2 warnings in 64.16s; exit0 |
| Full backend pytest | **661 passed**, 2 warnings in 140.86s (0:02:20); exit0 |
| Complete Context-policy AST comparison | Validator and reviewed engine policies identical |
| Exact FSRS mixed-vector read-only check | 2 / 1 / 2 / 7 / 1 / 1 / 1 / 4 |
| Ruff app tests scripts, --no-cache | All checks passed!; exit0 |
| Static Python compilation | 100 files, app/tests/scripts/alembic, compile() in memory; exit0 |
| uv lock --check --offline | 49 packages resolved in 1ms; exit0 |
| Final git diff --check | PASS; exit0; existing line-ending advisories only |
| Final protected-file check | Only 3 authorized existing files changed; 264 others unchanged; this one new report |

Backend virtualenv Python ran with -B and the inspected `C:\Users\user\AppData\Local\Temp\fluentt-d11b-run.py` guard. All database tests ran sequentially in `fluentt_test` / private schema `d11b_21ec17a1c5`; the guard rejects non-*_test or unexpected schema/search-path configuration. No D10 database or native app storage was used.

Pytest options: -q --tb=short -p no:cacheprovider; original reproduction diagnostics additionally used -s. Full pytest had no file filter. Ruff used --no-cache, static compilation produced no bytecode, and golden capture never regenerated a fixture.

The final padded-EF cases exercise a reachable multiplication under Rounded trapping, including initially clear caller flags; the final focused/full runs include that strengthened coverage. The two warnings are existing Starlette/httpx TestClient and AnyIO BlockingPortal deprecations. No failing test was weakened or removed. The red failures were captured before the correction; all required final checks passed.

## 18. Remaining M-02/M-03

- **M-02 OPEN / DEFERRED.** Dedicated existing schema topology retained; real concurrency uses multiple connections to that same schema, not parallel shared multi-schema verification.
- **M-03 OPEN / DEFERRED.** DevelopmentScheduler and its extreme-date behavior remain unchanged and outside this correction.

No deferred issue was modified or silently closed.

## 19. Git Status

Final branch/head: `main` / `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; index empty. Existing dirty tracked and untracked D10/D11/P artifacts remain intact.

Relative to the 267-file task baseline:

```text
modified (already untracked): backend/app/scheduling/research_contracts.py
modified (already untracked): backend/tests/reviews/test_d11e_acceptance.py
modified (already untracked): backend/tests/reviews/test_research_contracts.py
new untracked: docs/development/d11e-f2-sm2-validation-determinism-review.md
```

Git still reports the three edited source/test paths as ?? because they were already untracked. Hash comparisons establish the actual task delta; git diff alone is insufficient for those files. All **264** other pre-existing non-ignored files retain their exact hashes, including both engines, service/acceptance, all earlier reports, migrations, authority/models/config, mobile, golden/vector files and dependency/lock files.

No staging, commit, push, clean/reset or broader work occurred.

## 20. Recommendation

Submit this narrow C-01 correction for independent re-review. The exact genuine238/forged240 behavior is corrected under reduced precision; full snapshot reachability and lapse/EF validation now own deterministic arithmetic without leaking caller context or changing engine math.

Keep formal/live routing closed and M-02/M-03 deferred. Preserve prior blocking reports as historical evidence. This correction's ready status does not replace independent approval.

**D11E-F2 READY FOR INDEPENDENT RE-REVIEW.**
