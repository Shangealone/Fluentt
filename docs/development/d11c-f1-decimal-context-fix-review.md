# D11C-F1 Decimal Context Determinism Correction

Date: 2026-10-17 (Asia/Manila). Repository: `F:\FLUENTT`. Branch: `main`. HEAD: `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`.

## 1. Status

**D11C-F1 READY FOR INDEPENDENT RE-REVIEW**

The exact C-01 reproduction now passes, all hostile-context regressions pass, and the full backend suite passes. Final integrity checks confirm only the two authorized Python files changed and this new report was added.

Scope is limited to the engine's Decimal context boundary and its regression tests. Research routing remains CLOSED. Earlier reports/specifications, including the independent review's historical blocked verdict, remain unchanged.

## 2. C-01 Reproduction

Before changing source, the exact independent-review case was reproduced with a normally validated conventional predecessor:

```text
repetition_count = 2
ease_factor = Decimal("2.5")
interval_days = 6
lapse_count = 0
correct = True
interaction_at_utc = 2026-10-17T11:23:45Z
prior_interaction_at_utc = 2026-10-16T11:23:45Z
```

The same input object returned 15 days normally, raised **decimal.Overflow** inside a caller `localcontext()` with `Emax=0`, then returned 15 days after caller context restoration. The complete input dump was unchanged.

The new tests were then run against the original engine: **5 failed, 7 passed, 50 deselected**. Failures included the exact Emax overflow, a combined-context `decimal.Clamped` during shared input/state revalidation, both expected-error paths under that combination, and the hostile-context rational oracle. This demonstrated that context coverage must include validation as well as interval multiplication.

After correction, the exact standalone case returns **15 days in both normal and Emax=0 contexts**, with value-identical complete results and an unchanged input. Due for that exact case is `2026-11-01T11:23:45Z`; interval seconds are 1296000.

## 3. Root Cause

`localcontext(prec=28)` copied the active caller context and changed only precision. Exponent bounds, rounding/traps, clamp and flags still came from the caller. The hidden numeric environment could therefore alter both synchronous D11B validation and the engine's transition, despite an unchanged valid four-field input and frozen configuration.

The fix replaces that copied policy at the D11C boundary. It does not require shared D11B contract changes, formula changes or acceptance integration.

## 4. Files Changed

Only these two pre-existing authorized files were edited:

- `backend/app/scheduling/sm2.py`: imports and complete per-execution Decimal context construction.
- `backend/tests/scheduling/test_sm2.py`: twelve context regression cases and rational-oracle coverage, with test helpers.

One new untracked report was created: `docs/development/d11c-f1-decimal-context-fix-review.md`.

`backend/tests/reviews/test_d11c_routing.py` required no modification. No source outside the two authorized paths was changed. In particular, D11B contracts/configuration/migrations, review service, authority resolver, sync, mobile, pronunciation, dependencies, lockfiles, manuscripts and previous evidence/reports remain protected.

## 5. Engine-Owned Decimal Context

Each `schedule()` call constructs a new explicit `decimal.Context` and supplies it to `localcontext(...)`. It is not copied from the active caller or a mutable global template. All Context fields are specified:

| Field | Engine policy |
| --- | --- |
| precision | 28 |
| rounding | ROUND_HALF_EVEN |
| Emin / Emax | -999999 / 999999 |
| capitals | 1 |
| clamp | 0 |
| initial flags | all clear (`flags=[]`) |
| enabled traps | InvalidOperation, DivisionByZero, Overflow, Underflow, Inexact, Subnormal, Clamped, FloatOperation |
| Rounded trap | disabled deliberately; the Inexact trap remains enabled |

The range comfortably contains the locked domain: EF 1.3..2.5, intervals up to 36500 days and products up to 91250. Valid numeric operations fit exactly within 28 digits. The coefficient formula and explicit `ROUND_CEILING` interval operation are unchanged; the context's general rounding mode introduces no new interval rounding rule.

`Rounded` can signal removal of insignificant trailing zeros without any numerical change. Its trap is deliberately disabled to retain valid Decimal representations with padding. Any actual loss of value raises Inexact. A separate post-fix probe using EF 2.5 padded with 100 zeroes produced the identical exact result. This is not quantization or suppression of a genuine inexact computation. Caller traps are never weakened or edited; the scheduler uses its own complete policy.

The temporary Context has no persistent scheduler/global state. Genuine trapped arithmetic errors propagate; no numeric exception is caught and silently converted into an accepted result.

## 6. Caller Context Isolation

The explicit context encloses the entire synchronous Decimal-dependent path: input-copy revalidation, conventional predecessor validation/reachability, EF update/floor, interval multiplication/ceiling, memory/envelope construction, and result validation. All return/exception paths leave the local context through its context manager.

Production code does not call or mutate `decimal.getcontext()`. Tests capture the caller context's object identity, precision, rounding, Emin, Emax, capitals, clamp, complete traps map and complete flags map. Those properties remain identical after success and after both an invalid-predecessor ValidationError and due-overflow ValidationError. The outer context's identity/state also remains unchanged after the caller's local context exits.

Combined testing enables all nine caller traps, narrows exponent range to zero, sets precision 1, uses ROUND_UP, enables clamp, changes capitals and pre-populates flags. Neither caller flags nor traps become engine policy. All requested configurations were coherent in Python Decimal; no requested case had to be omitted.

## 7. Algorithm Preservation

The incremental source comparison against the captured pre-fix file shows only Decimal imports and replacement of the context boundary. Input/result models, identities, configuration document/digest, response mapping, formula, initialization, branch logic, interval bounds, UTC due calculation and serialization are unchanged.

No binary-float transition arithmetic, additional input feature, clock/environment access, state-schema change, remediation queue or second schedule was introduced. A fresh explicit Context removes the caller dependency while preserving the original numerical method.

## 8. C-01 Regression Tests

Eight literal 15-day cases construct/validate the input before changing caller settings, then reuse it unchanged:

1. Emax=0.
2. Precision=1.
3. ROUND_UP.
4. Inexact trap enabled.
5. Rounded trap enabled.
6. Emin=0.
7. Clamp enabled.
8. Combined settings with all caller traps enabled and pre-existing flags.

Each checks the full result against the normal result, literal interval 15 / seconds 1296000, literal due, new memory `(rep3, EF2.5, day15, lapses0)`, unchanged input, and unchanged caller/outer context state. Two more cases check context restoration on the expected validation failures. Two oracle cases compare broad normal/hostile execution independently.

The new regression selection changed from **5 failed / 7 passed** before the fix to **12 passed, 50 deselected in 0.28s** after the fix. The complete engine test module passes all **62** cases.

## 9. Exact Vector Verification

All original literal vectors remain exact:

| Sequence | Result |
| --- | --- |
| First four Correct answers | 1, 6, 15, 38 days; EF 2.5 |
| Repeated Incorrect answers | EF 2.18, 1.86, 1.54, 1.3, 1.3; one day; repetitions reset; lapses increment |
| Correct answers after first lapse | 1, 6, 14 days; EF 2.18; lapse count stays 1 |
| Raw fourth-Correct product | 37.5, ceiling to 38 |
| Saturation | 36500 days, then remains 36500 |
| Maximum seconds | 3153600000 |

The existing immutability, interleaved determinism, giant counters, floor/cap, non-midnight/offset UTC anchoring, invalid-state and excluded-feature cases also pass. No original expected value was modified.

## 10. Rational Oracle Verification

The new Fraction oracle covers lapse counts 0..7, repetitions 0..35 excluding the transient initial zero/zero state, and both answers. Expected EF uses rational `5/2 - (8/25)*lapses` with floor `13/10`; intervals use rational numerator/denominator ceiling, independently of engine Decimal helpers.

There are **574 transitions per context**, executed once normally and once with the hostile combination: **1148 comparisons pass**. This includes multiple repetitions, all reachable EF values, floor lapses, cap reach/saturation and Incorrect after the cap. Every input is validated before hostile caller settings are applied. The checks compare complete memory, seconds, exact due and caller context preservation.

## 11. Serialization Verification

Existing Pydantic numeric JSON and shared state-decoder round trips remain green for EF **2.5, 2.18, 1.86, 1.54 and 1.3**, preserving Decimal equality and the next transition. The unchanged routing/serialization test module also passes FastAPI encoding, standard JSON, PostgreSQL `CAST(... AS JSON)` and driver reconstruction for those five values.

EF remains a JSON number, with Decimal used for arithmetic; no schema, quoted-number representation or extra persisted numeric field was added. The PostgreSQL checks remain server/driver compatibility probes without accepted research-row inserts. Actual research persistence integration is still outside this milestone.

## 12. Routing Closure

**CLOSED.** The unchanged D11C tests execute the pure engine, then call the real online/shared service or sync service for an allocated owner. Both paths still return **503 D11_ROUTING_DISABLED** with zero accepted-chain counts. The unchanged D11B acceptance suite proves historical accepted replay remains available before new-work authority checks.

Production searches show no new BinarySm2Scheduler import/use outside the pure engine. The resolver still rejects any owner allocation without restricting mode, covering test/formal allocations. No provisioning, randomization, new research content or activation occurred. Database-backed tests use only the reviewed private schema in `fluentt_test`.

## 13. Full Regression Results

| Check | Observed result |
| --- | --- |
| Exact pre-fix C-01 probe | decimal.Overflow with caller Emax=0; normal/restored context returns 15 days |
| New pre-fix regression selection | 5 failed, 7 passed, 50 deselected; expected evidence of the defect |
| New post-fix regression selection | **12 passed, 50 deselected, 2 warnings in 0.28s** |
| Complete SM-2 test module | **62 passed, 2 warnings in 0.30s** |
| D11C routing/JSON tests | **7 passed, 2 warnings in 2.50s** |
| Existing research-contract tests | **47 passed, 2 warnings in 12.34s** |
| D11B acceptance/replay tests | **23 passed, 2 warnings in 8.48s** |
| Full backend suite | **337 passed, 2 warnings in 110.90s (0:01:50)**; exit 0 |
| Ruff `app tests scripts` | **All checks passed!** |
| Formatting, two edited Python files | **2 files already formatted** |
| Static Python compilation | **94 files PASS**, compiled in memory |
| Rational oracle | **1148 normal/hostile comparisons PASS** |
| Final whitespace/integrity checks | **PASS**; only two authorized edits and this new report |

Execution order followed the brief. Pytest ran with `-q -p no:cacheprovider --tb=short`, Python with `-B`, and Ruff with `--no-cache`. Database-backed checks use `C:\Users\user\AppData\Local\Temp\fluentt-d11b-run.py`, enforcing `_test` database naming and private schema search_path. The observed target is `fluentt_test`, schema `d11b_21ec17a1c5`; no production/D10 database was used.

The two warnings are the existing Starlette/httpx TestClient and AnyIO BlockingPortal deprecations. Static checks cover app/tests/scripts/alembic without writing bytecode. No dependency installation or unrelated fixture/test modification was required.

Self-review compared the authorized files against their captured pre-fix contents and checked context construction, caller restoration, unchanged mathematics/identity/schema, lack of float arithmetic, closed routing and absence of D11B edits. The previous caller-derived localcontext call is removed; only the complete explicit policy is used in production schedule execution.

## 14. Deferred Issues

The earlier reports are preserved, and these D11B gates remain unchanged:

- **M-01:** extreme research UTC normalization/predecessor overflow. **SAFE TO DEFER UNTIL BEFORE RESEARCH ACCEPTANCE INTEGRATION**. No fix or relabeling is claimed.
- **M-02:** database-wide D9 trigger-count test isolation, deferred under the dedicated schema test layout and required before shared multi-schema/parallel execution.
- **M-03:** pre-existing development extreme due overflow, unchanged.

C-01 is the only corrected finding. This report requests independent re-review rather than rewriting the historical independent-review verdict or claiming research activation approval.

## 15. Git Status

Initial and final target: `main`, HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`, nothing staged. A baseline protected all **248 pre-existing tracked/untracked files**. The final SHA-256 comparison confirms only `sm2.py` and `test_sm2.py` differ and this report is the sole added path. All other **246 pre-existing files**, including every prior report/specification and the routing tests, remain byte-identical.

The two edited Python files were already untracked as part of D11C, so ordinary `git diff` does not display their incremental F1 change. Their before/after contents were compared separately. The inherited tracked D11B diff remains eight files, 237 insertions and 193 deletions. Existing user work has not been cleaned/reset, staged, committed or pushed.

## 16. Recommendation

Submit this narrow correction for independent re-review. Research routing remains CLOSED and the M-01/M-02/M-03 gates remain in force. No staging, commit or push was performed.

**D11C-F1 READY FOR INDEPENDENT RE-REVIEW**
