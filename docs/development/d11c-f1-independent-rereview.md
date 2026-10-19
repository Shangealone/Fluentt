# D11C-F1 Independent Decimal Context Re-Review

Review date: 2026-10-17 (Asia/Manila). Repository: `F:\FLUENTT`. Branch: `main`. HEAD: `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`.

## 1. Verdict

**D11C-F1 INDEPENDENT RE-REVIEW PASS**

C-01 is CLOSED and no longer reproducible in the corrected engine. Independent hostile-context, caller-preservation, rational-oracle and negative-control probes pass. There are zero remaining CRITICAL, zero IMPORTANT and zero new MINOR findings. Focused/full tests, Ruff, static compilation and final whitespace/integrity checks pass.

This review assesses the pure Binary SM-2 adaptation and its correction. Research acceptance remains CLOSED. Earlier reports, including the historical blocking review, are preserved.

## 2. Scope

The complete corrected `backend/app/scheduling/sm2.py` and `backend/tests/scheduling/test_sm2.py` were inspected, together with the F1 correction report, original C-01 finding, authoritative D11A transitions/vectors, shared research contracts, routing tests, acceptance resolver/service and sync path.

Baseline checks confirmed the expected branch/HEAD, no staged changes, `git diff --check` clean and the existing D11B/D11C work present. The tracked D11B diff remains eight files, 237 insertions and 193 deletions. No unexpected routing, model/schema, migration, dependency, lockfile, mobile, pronunciation or manuscript change was found.

All **249 pre-existing tracked/untracked files** were SHA-256 hashed before this re-review. Comparing the retained pre-F1 baseline with current files independently confirmed F1 changed exactly `sm2.py` and `test_sm2.py` and added only `d11c-f1-decimal-context-fix-review.md`. The implementation report's scope claims were therefore checked against captured file hashes, not accepted on assertion alone.

## 3. Original C-01 Reproduction

The exact conventional predecessor was validated under an ordinary context: repetitions 2, Decimal EF 2.5, interval 6, lapses 0. Correct input used ordinary aware UTC timestamps and was constructed before any hostile caller context. Normal execution produces repetitions 3, EF 2.5, interval **15 days**, lapses 0, seconds **1296000**, and current-interaction-anchored due.

The same validated input object now returns a value-identical complete result with caller Emax=0. Its input/predecessor remains unchanged. No raw caller-induced decimal Overflow escapes.

To verify the challenge can detect the original defect, a separate in-memory copy of the engine's AST reinstated only `localcontext(prec=28)`. That original-policy negative control raised the expected decimal.Overflow for Emax=0. The corrected imported module and all repository files were left untouched. This is direct evidence that the review's scenario is non-vacuous, not a source edit or a claim that the corrected engine failed.

## 4. Engine-Owned Decimal Context

**PASS.** Each call constructs a fresh explicit Context inside `schedule()` and supplies it to `localcontext`. It is independent of both the active caller context and Decimal.DefaultContext. There is no mutable global Context template and no production getcontext mutation.

Actual explicit settings are:

```text
prec=28
rounding=ROUND_HALF_EVEN
Emin=-999999
Emax=999999
capitals=1
clamp=0
flags=[]
```

The complete trap list is reviewed in section 5. An additional independent probe temporarily narrowed Decimal.DefaultContext and enabled its traps/flags in the isolated Python process; the corrected engine still returned the identical result. DefaultContext was restored afterward.

All Decimal-dependent synchronous work is lexically inside the owned context: input/model-copy revalidation, conventional predecessor validation and reachability, EF arithmetic/floor, interval multiplication/integral ceiling, output-memory/envelope validation and research-result validation. The return occurs inside the with-block, so context exit restores the caller on return or exception. Before the block, only the input instance check occurs; module configuration loading/identity hashing performs no transition Decimal arithmetic. No Decimal operation is deferred until after context exit.

## 5. Trap / Exponent Policy

**PASS.** Actual enabled traps exactly match the correction report: InvalidOperation, DivisionByZero, Overflow, Underflow, Inexact, Subnormal, Clamped and FloatOperation. Rounded is untrapped. Initial flags are explicitly clear rather than inherited.

The locked numeric domain fits well within the selected exponent/precision range: EF 1.3..2.5 and intervals up to 36500, with the largest multiplication bounded by 91250. Values 2.18 and 13.08 are finite exact decimals. Explicit ROUND_CEILING remains the deliberate interval rule; the general context rounding mode cannot change these exactly representable intermediate values.

An Inexact signal remains an error. Rounded alone can mean removal of redundant zero digits, which changes representation but not numerical value. Independent probes padded each of the five reachable EF values with **1000 trailing zeros**, validated the input before hostile settings, and obtained the identical transition under the hostile combination. No quantization or alternative state representation was introduced. Ceiling of a fractional interval is intentional algorithm behavior, not an arithmetic approximation to suppress.

## 6. Hostile Caller Contexts

**PASS.** Independently constructed probes reused one normally validated 15-day input across eight caller settings: Emax=0, precision=1, ROUND_UP, Inexact trap enabled, Rounded trap enabled, Emin=0, clamp enabled, and a combined context.

The independent combination used precision 1, ROUND_FLOOR, Emin/Emax zero, capitals 0, clamp 1, all nine traps enabled and all flags pre-set. This differs from the supplied combined regression's rounding/flag mix and independently tests the same isolation boundary. Every case returned the complete normal result without caller-induced arithmetic exceptions. All requested context settings were coherent in Python Decimal; no required case was omitted as impossible.

The correction's own tests use ROUND_UP for their combination, all caller traps and pre-existing flags. They call the engine while that hostile context is still active; they do not restore a safe context before scheduling.

## 7. Caller Context Preservation

**PASS.** Independent snapshots compared precision, rounding, Emin, Emax, capitals, clamp, every trap and every flag, together with context identity. They remain unchanged after all successful challenges, and the original outer context is unchanged after each local context exits.

The same check was repeated for two expected errors: an unrepresentable due sum at UTC datetime.max and an invalid predecessor EF/lapse binding created by model-copy bypass. Both produce ValidationError under the hostile combination; neither leaks the engine policy or flags. This independently confirms the correction report's claimed error-path coverage.

No protection is claimed for standalone shared-model validation performed by unrelated callers outside `schedule()`. The reviewed boundary is an already validated explicit input, with all validation repeated by the engine enclosed by its own complete policy, as required by the brief.

## 8. Exact Algorithm Vectors

**PASS.** Existing literal fixtures match D11A:

| Sequence | Exact result |
| --- | --- |
| First four Correct intervals | 1, 6, 15, 38 days |
| Incorrect EF sequence | 2.18, 1.86, 1.54, 1.3, 1.3 |
| Correct after first lapse | 1, 6, 14 days, with EF 2.18 and one lapse |
| Fourth Correct ceiling | 37.5 to 38 |
| Maximum interval / seconds | 36500 / 3153600000 |

The response mapping remains q4/q2; Incorrect updates EF before resetting repetitions, sets one day, and increments lapses once. Saturation, subsequent Correct at the cap and Incorrect after the cap remain correct. There is no same-session remediation or additional feature input.

An independent AST comparison used the saved pre-F1 method and current method, normalizing only the localcontext policy expression. The remaining schedule method ASTs are identical, proving the correction did not alter formula, branches, state construction, bounds, due handling or result-validation calls. Configuration, contracts and routing also retain their protected file hashes. No algorithm/config/state-schema change was found.

## 9. Rational Oracle

**PASS: 1148 independent comparisons.** A separate read-only probe used Fraction arithmetic, not the supplied test helpers or engine constants, across lapse counts 0..7, repetitions 0..35 excluding transient zero/zero, and both answers. It derives EF from rational 5/2 minus 8/25 per lapse with floor 13/10, and uses integer numerator/denominator ceiling and the 36500 cap.

Each of 574 transitions was run normally and with the independent hostile combination: **1148 comparisons**. Inputs were validated before entering the hostile context. Every result matched the rational expected memory, interval seconds and exact UTC due. The same explicit input produced equal normal/hostile results, predecessors stayed unchanged, caller snapshots were preserved, and Pydantic JSON reconstruction preserved output memory.

This independently confirms the correction report's comparison count and covers nontrivial ceilings, repeated lapses/floor, increasing repetitions, cap reach/saturation and lapse reset after long intervals.

## 10. Serialization

**PASS.** Reachable EF values 2.5, 2.18, 1.86, 1.54 and 1.3 remain JSON numbers. Existing Pydantic JSON/shared-decoder checks and the independent oracle reconstruct exact Decimal memory and preserve the next transition. No EF string, schema field or extra numeric representation was introduced.

The unchanged routing/serialization tests exercise FastAPI encoding, standard JSON, PostgreSQL JSON parsing and driver return for all five values, followed by exact Decimal and next-transition comparisons. As previously documented, these use SELECT CAST(... AS JSON), not accepted research-row persistence. This limitation remains future integration work and does not create a pure-engine defect.

Binary64 remains only the existing transport representation; transition arithmetic uses validated Decimal values. No precision change capable of altering a future ceiling was observed.

## 11. Purity / Immutability

**PASS within the supported locked domain.** Source inspection found no database/session, current clock, network, filesystem, environment, randomness or secrets dependency. The engine is stateless; the registered configuration is verified and recursively frozen. Context is freshly constructed per execution and discarded; it is not a new mutable global input.

Existing immutability/interleaved determinism tests pass, and the independent oracle compares predecessor snapshots across normal/hostile transitions. New memory/result objects do not mutate predecessor envelopes or dictionaries. No ambient caller numeric setting examined can alter valid result or failure behavior; the complete explicit policy and lexical coverage remove the original inheritance path.

## 12. Research Routing Closure

**PASS: CLOSED.** Production searches show BinarySm2Scheduler only in its own module. The review service still resolves explicit development authority, rejects non-development output and performs original accepted replay before new-work authority. Sync calls the same shared service.

The resolver rejects any allocation for the owner without filtering test/formal mode. Actual allocated-owner online/shared and sync service tests still return **503 D11_ROUTING_DISABLED** and zero accepted evidence counts after the pure engine has been executed. The resolver is not mocked in those cases. Existing D11B acceptance tests preserve historical accepted replay and concurrency/rollback behavior.

Engine correctness is not authorization to activate research acceptance. No enrollment, provisioning, migration or research-routing change occurred.

## 13. Regression Results

| Check | Fresh observed result |
| --- | --- |
| Complete SM-2 tests, including 12 F1 cases | **62 passed, 2 warnings in 0.30s** |
| Routing/JSON, research contracts, D11B acceptance | **77 passed, 2 warnings in 19.73s** (7 + 47 + 23), in the requested file order |
| Full backend suite | **337 passed, 2 warnings in 140.71s (0:02:20)**; exit 0 |
| Ruff app/tests/scripts | **All checks passed!** |
| Static in-memory Python compilation | **94 files PASS** |
| Independent same-input hostile challenges | **8 PASS** |
| Independent expected-error preservation | **2 PASS** |
| Independent rational oracle | **1148 normal/hostile comparisons PASS** |
| Independent padded-EF probes | **5 PASS**, each with 1000 redundant trailing zeros |
| Independent hostile DefaultContext probe | PASS; DefaultContext restored |
| Original-policy in-memory negative control | Expected Overflow reproduced, confirming challenge sensitivity |
| Final git diff/whitespace/integrity checks | **PASS**; all 249 pre-existing files unchanged, only this report added |

Pure tests run without their parent database setup/reset. Database-backed runs use the inspected `_test`-guarded private-schema wrapper, targeting `fluentt_test`, schema `d11b_21ec17a1c5`; no production/D10 database is used. Pytest uses `-q -p no:cacheprovider --tb=short`, Python `-B`, and Ruff `--no-cache`. Compilation uses in-memory compile() rather than writing bytecode.

The two warnings are the existing Starlette/httpx TestClient and AnyIO BlockingPortal deprecations. No source/test/report was changed to make a failing check pass. All read-only probes ran in memory; the negative control did not patch an imported production module or repository file.

## 14. Findings

- **C-01: CLOSED.** The original ambient-context dependency cannot be reproduced in the corrected supported engine domain. The explicit Context covers the full synchronous Decimal path, and independent negative-control/probe evidence supports closure.
- **CRITICAL: 0 remaining findings.** No remaining context dependence, algorithm vector/config regression or routing activation was identified.
- **IMPORTANT: 0 findings.** The twelve new cases are meaningful. Inputs precede hostile settings, live hostile contexts surround the real schedule call, literal 15-day/memory/due assertions supplement full-result comparison, and snapshots cover all relevant settings/traps/flags. The in-memory original policy fails the exact challenge.
- **MINOR: 0 new findings.** Earlier D11B minor gates remain separately deferred.

The scope of a pure-engine pass excludes future research acceptance/persistence activation. PostgreSQL CAST compatibility remains correctly described rather than presented as evidence of an accepted research-row round trip.

## 15. Deferred D11B Issues

No prior gate was fixed, waived or relabeled:

- **M-01:** extreme research UTC normalization/predecessor overflow. **SAFE TO DEFER UNTIL BEFORE RESEARCH ACCEPTANCE INTEGRATION**.
- **M-02:** global D9 trigger-count isolation. Deferred under the current dedicated schema layout; required before shared multi-schema/parallel database testing.
- **M-03:** development extreme due overflow. Unchanged, separately deferred.

Prior implementation and independent-review reports remain historical evidence. This new re-review records C-01 closure without editing their earlier verdicts.

## 16. Git Status

Branch `main`; HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; nothing staged, committed or pushed. Existing D11B/D11C work remains present, with the tracked diff still eight files, 237 insertions and 193 deletions. The sole permitted new review path is:

```text
?? docs/development/d11c-f1-independent-rereview.md
```

The final SHA-256 comparison confirms all **249 pre-existing tracked/untracked files are byte-identical** to the re-review baseline. No implementation, test, prior report/specification or other existing file changed. This new report is the sole added path and remains untracked. Branch, HEAD and absence of staged changes match the baseline; final git diff --check and report whitespace/structure checks pass. No clean/reset operation was performed.

## 17. Recommendation

Accept C-01 as closed for the pure Binary SM-2 adaptation. Retain CLOSED research routing and all deferred D11B gates. This pass does not activate research acceptance or authorize further implementation/integration. No source fix, staging, commit or push was performed during this re-review.

**D11C-F1 INDEPENDENT RE-REVIEW PASS**
