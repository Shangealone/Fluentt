# D11E-F2 Independent SM-2 Validation Determinism Re-Review

## 1. Verdict

**D11E-F2 INDEPENDENT RE-REVIEW PASS**

C-01 is closed by the reviewed correction. Zero new CRITICAL, IMPORTANT or MINOR findings. Genuine sixth-Correct 238 accepts under precision 2; an outer-consistent forged 240 rejects before accepted-evidence staging. Classification and persisted-state decoding are invariant under the tested hostile contexts, with caller policy/flags preserved. Original F1 protections and the routing, replay, transaction and concurrency contracts remain intact.

This approves the bounded F2 correction. Formal/live research routing remains closed; M-02 and M-03 remain deferred.

## 2. Scope

Reviewed on 2026-10-18 in F:\FLUENTT, branch main, HEAD 4135cd7334acbdb1b97fc1a8843eaf03cdddd353; index empty. Read the actual corrected contracts/tests, both engines, acceptance/service/persistence and online/sync callers, test isolation helpers, D11A locked arithmetic/output/state rules, D11C-F1 review, original D11E/F1 blocking reports and F2 correction report. Actual untracked implementation files were inspected; git diff alone was not treated as their evidence.

Captured SHA-256 for all **268 pre-existing non-ignored tracked/untracked files**. Verified all 11 published F2 after-hashes. Independently removing only F2 imports/context wrapper/appended test additions **in memory** reconstructs the exact three pre-F2 hashes:

| File | Reconstructed pre-F2 SHA-256 |
| --- | --- |
| backend/app/scheduling/research_contracts.py | 73c4c28447daa1115570efa94d128f3504627e166355ccabb74da73d4e769e36 |
| backend/tests/reviews/test_d11e_acceptance.py | 82827fba74216a45a95bbd937a629c40134cc35018d46118c405d582ee599ca1 |
| backend/tests/reviews/test_research_contracts.py | d1cd8bb7b51931fc655685195270bbb199ab50cd12e3e263bed6a94bde0ac727 |

Thus F2 preserved the prior arithmetic body, deep-reconstruction helper and existing tests. Both engines, service/acceptance, frozen configuration, golden fixture and dependency/lock protected hashes match prior evidence. No new F2 migration, authority-schema or mobile change was found. Existing D11B persistence and D11D dependency changes from HEAD predate this correction.

Only this report was created in the repository during this review. Independent disposable probes were created under C:\Users\user\AppData\Local\Temp. No source/tests/previous reports/fixtures were changed, staged or committed; no push. No D10 database, SQLite/native storage or human credentials were accessed.

## 3. Original C-01 Reproduction

Freshly reran the unchanged independent C-01 acceptance probes from the prior F1 re-review. Both first build real conventional accepted intervals **1, 6, 15, 38, 95**, then invoke one real sixth transition under caller precision 2. The genuine result now accepts and the forged result now rejects.

A separate sensitivity control extracts the original reachability body from the current source AST, removes only the F2 context wrapper in a detached in-memory function, and runs it on constructed memory. Under precision 2 that original body rejects 238 and accepts 240. The live application callable and files are never replaced. This confirms the causal arithmetic difference independently of the historical red-run claims.

The external Fraction oracle establishes **95 * 5/2 = 475/2 = 237.5**, with integer ceiling **238**. Ambient precision-2 multiplication rounds first; applying ceiling afterward cannot recover the lost fraction.

## 4. Validator-Owned Decimal Context

**PASS.** Sm2Memory.reachable constructs a fresh Context inside localcontext for every invocation, enclosing the complete EF relationship, interval multiplication/ceiling, cap loop, failure paths and return.

| Policy field | Explicit value |
| --- | --- |
| precision | 28 |
| rounding | ROUND_HALF_EVEN |
| Emin / Emax | -999999 / 999999 |
| capitals / clamp | 1 / 0 |
| initial flags | all nine clear |
| enabled traps | InvalidOperation, DivisionByZero, Overflow, Underflow, Inexact, Subnormal, Clamped, FloatOperation |
| Rounded trap | disabled intentionally |

It does not copy the ambient context, omit policy fields, mutate global getcontext(), or reuse a mutable global policy. AST comparison confirms its complete Context constructor is identical to the unchanged BinarySm2Scheduler constructor.

Exact accepted EF values have at most two significant decimal places and bounded interval products; precision 28 cannot lose meaningful digits in these operations. EF expectation uses at most three decrements before its floor branch. Padded equivalent EF representations can discard redundant zeroes and set Rounded without Inexact; deliberately leaving Rounded untrapped is mathematically appropriate. A sensitive negative control proves unprotected 6 * a 1000-zero-padded 2.18 raises Rounded when the caller trap is enabled, while the actual validator accepts 14 and preserves the exact EF tuple and caller flags. Inexact and exceptional range/nonfinite conditions remain trapped/rejected. Explicit interval ceiling remains ROUND_CEILING.

Other numeric paths were inspected: Decimal string construction and finite checks are exact and context independent; field bounds compare exact scalars. Fresh result reconstruction preserves Python Decimal/datetime/float values, with no JSON/float intermediate, quantization or new formatting rule.

## 5. 238-Day Genuine Result

**PASS.** Supplied and independent actual-PostgreSQL probes build the five accepted predecessors, then wrap the real sixth transition exactly once under precision 2. Result: repetitions6, EF numerically2.5, lapses0, **238 days**, 20563200 seconds, due exactly interaction +238 days.

Both shared acceptance and sync accept. Complete counts become **6 attempts / 6 schedules / 6 accepted ledgers / 1 current pointer / 12 canonical events**. The pointer references the sixth schedule linked to the sixth event. No second engine transition is used to validate or persist the result.

## 6. 240-Day Forged Result

**PASS: rejected.** In separate fixtures the real sixth transition returns genuine238 once, then only returned memory.interval_days and outer days/seconds/due are changed consistently to240. Repetition, EF, lapses and identity/config remain genuine.

Both ordinary/precision2 supplied regressions and precision2 independent shared/sync probes raise a memory-local ValidationError. The supplied persistence-entry sentinel remains uncalled. Independent SQLAlchemy after_attach and SQL-DML observers see **zero accepted-table attachments and zero accepted-table DML**, without replacing persistence with a mock.

Full ordered row snapshots of attempts, schedules, accepted ledgers, pointer and research events remain identical to the five-event baseline **5/5/5/1/10**. The pointer does not move. Rejection is genuine unreachable-memory classification, not an outer interval/due mismatch or unrelated preflight error.

## 7. Hostile Context Independence

**PASS.** New independent Fraction/integer probes cover ten explicitly constructed caller policies:

ordinary; precision2; precision1; ROUND_DOWN; ROUND_UP; ROUND_FLOOR; Emax0; Inexact trap; Rounded trap; and combined precision1/ROUND_FLOOR/Emin0/Emax0/capitals0/clamp1/all traps/all flags.

Inputs and expected scalars are constructed before entering hostile contexts. The oracle derives EF as max(13/10, 5/2 - (8/25)*lapses), and interval ceiling using integer numerator/denominator arithmetic, independent of production Decimal validation.

Per context: **337 valid / 852 invalid candidates**, through **five** paths: raw Sm2Memory, raw ConventionalState, raw ResearchSchedulerResult, canonical deep validation of constructed nested result models, and existing decode_research_state. Total: **59,450 top-level classifications**, all as expected. Families cover lapses0..8, repetitions0..36 except transient0/0, a million-repetition cap, neighboring intervals, wrong EF relationships, forged240 and padded EF. An additional **250** validations preserve the five exact requested Decimal spellings/tuples.

## 8. Reachable Correct Sequence

**PASS.** The independent rational oracle agrees with the locked literal sequence:

**1, 6, 15, 38, 95, 238, 595, 1488, 3720, 9300, 23250, 36500, 36500.**

All reachable states accept through every tested layer/context. Expected-1 and expected+1 reject wherever domain bounds permit. In particular 38,95,238,595 have explicit neighbors;240 rejects at repetition6. Cap states at repetitions12/13 and a million repetitions accept36500 and reject36499. Saturation is the locked mathematical cap, not repair of a malformed result.

## 9. Lapse / EF Reachability

**PASS.** Exact Incorrect EFs remain **2.18,1.86,1.54,1.3,1.3**. After the first lapse, Correct progression is **1,6,14**. The independent rational families additionally cover third Correct12,10,8,8 at lapse counts2,3,4,5, and continued floor states through lapse8.

Compatible repetition0/1/2/3 and longer histories accept under all ten policies; adjacent wrong intervals and incompatible EF/lapse relationships reject. Transient repetition0/lapse0 is rejected. Exact Decimal.as_tuple() is preserved for **2.5,2.18,1.86,1.54,1.3**, including raw and constructed canonical paths; padded representations remain unchanged.

## 10. Caller Context Preservation

**PASS.** After every independent success and expected rejection, assert getcontext() is the same caller object and compare precision, rounding, Emin, Emax, capitals, clamp, all traps and all flags. Partially preset flags and the all-flags combined policy are preserved. The outer caller object and all fields match again after exiting localcontext.

Supplied direct and real acceptance/sync tests also compare all fields/flags, including preset Rounded, on success and failure. The independent Rounded sensitivity control checks initially clear flags. No validator context or arithmetic flags leak outward.

## 11. Persisted State Decoding

**PASS, actual PostgreSQL read-back.** Following genuine sixth acceptance, the independent harness selects the scheduler_state column from PostgreSQL by the sixth schedule ID, rather than reusing engine output or an identity-map state object.

Existing decode_research_state returns equal valid rep6/EF2.5/day238/lapse0 state under ordinary, precision2, ROUND_UP, ROUND_DOWN and combined hostile contexts. Exact decoded EF tuples agree; caller snapshots and original raw data remain unchanged.

A deep copy of that ordinary data is changed to interval240 **only in memory**. Existing decoding rejects it with ValidationError in every selected context. No corrupt JSON is manually persisted. This directly closes the historical valid-on-write/corrupt-on-read scenario.

## 12. Original F1 Preservation

**PASS.** Canonical _result_field_data still reconstructs result/envelope/memory from model fields and retained extras before fresh strict validation. F2 changes neither that helper nor its call.

All **152** supplied F1 adversarial/preservation cases and the unchanged **104-case** independent F1 suite pass (the latter within the171 combined independent cases). Negative FSRS stability and SM-2 EF9 reject before evidence staging. Copy/construct, nested malformed memory, extra fields at all levels, raw/hybrid representations, strict bool/string/float mutations, nonfinite values and valid-memory/outer-disagreement controls remain covered. Exact Decimal tuples and FSRS float.hex() survive fresh reconstruction and subsequent transition/read-back.

## 13. FSRS Preservation

**PASS.** Enhanced engine/configuration, pinned dependency and fixture hashes remain unchanged.

- First Good: **2 days / stability2.3065 / difficulty2.118103970459016**.
- First Again: **1 day / stability0.212 / difficulty6.4133**.
- Mixed intervals: **2,1,2,7,1,1,1,4**.

Independently checked those literals against the preserved fixture; actual adapter/direct-runtime regressions pass. Capture ran **--check only** and reproduced the pinned goldens. Existing fresh-validation and PostgreSQL read-back hex comparisons pass. Call instrumentation still proves one EnhancedFsrsScheduler.schedule and one native review_card per acceptance, with review_duration=None; malformed results do not trigger a second transition.

## 14. Atomicity

**PASS.** Forged240 rejects before accepted staging, with complete five-table snapshots and SQL/attachment observations as described above.

All six established failure points pass: after calculation, attempt, schedule, ledger, canonical-event staging and pointer advancement. The unchanged independent suite also repeats all six with existing predecessor evidence for **both algorithms** (12 cases), comparing counts and SHA-256 of complete rows. Real pointer SQL is executed before the injected pointer failure. No partial chain survives rollback.

The separately permitted review-session preflight boundary is unchanged; the no-write assertions concern accepted attempts/schedules/ledger/pointer/canonical events.

## 15. Replay / Online / Sync

**PASS.** Online router and sync delegate to the same record_review_attempt boundary. Fresh238 and forged240 are exercised under precision2 through shared acceptance and sync; representative actual HTTP F1 coverage confirms delegation.

After accepting238, new independent tests replay its UUID under the combined hostile policy through shared acceptance and sync. They return the original IDs, interval and state. Engine resolution, fresh service validation, predecessor decoding and accepted persistence are forbidden sentinels. A Python profile additionally sees zero executions of the original reachable function during shared replay. Complete evidence snapshots stay unchanged; caller policy/flags remain unchanged.

The unchanged independent suite also verifies cross-transport original replay after pointer advancement and routing disablement for both conditions. Replay precedes new-work validation and assignment calculation.

## 16. Concurrency

**PASS.** Freshly reran real PostgreSQL distinct-event and same-UUID races for conventional and enhanced (four independent cases). Each uses separate sessions, the real learner-row FOR UPDATE call, and an observer connection querying pg_blocking_pids. B is actually blocked by A.

For distinct events B reads A's committed predecessor, both chains commit, and the pointer ends at B: **2/2/2/1/4**. Duplicate B returns A from post-lock replay without predecessor calculation: **1/1/1/1/2**. No lost update or duplicate accepted chain. Service/acceptance hashes and lock placement/order remain unchanged.

## 17. Formal Routing Closure

**PASS.** Otherwise complete frozen formal authority for both mapping groups is tested through shared acceptance and sync. It returns **503 D11_ROUTING_DISABLED** with zero accepted-chain writes. Existing HTTP formal closure cases also pass.

Exact testing/test authority, supported configuration binding and explicit test-no-future-v1 policy remain required. Formal mode is rejected before assignment completeness can accidentally activate it. No development fallback, formal activation, live clock policy, enrollment or client-selected scheduler was introduced.

## 18. Test Quality

The supplied **4032** classification claim is correct: 13 literal all-Correct states +20 lapse-family states +4 padded EF states +1 million-repetition state =38 valid;62 in-domain neighbors +24 wrong-EF/lapse candidates +forged240 +transient0/0 =88 invalid. **(38+88)*4 paths*8 contexts =4032 top-level classifications.** Nested validators can execute additionally;4032 is not claimed as a unique nested-call count.

Expected intervals/EF come from locked literals, not results produced by the validator. Candidates/path closures are built before hostile scope. Four paths actually enter memory validation, including deep reconstruction of constructed nested instances. The eight policies have distinct material settings: default, precision2/1, ROUND_UP, Emax0, Inexact/Rounded traps, and the combined policy. Independent probes add standalone ROUND_DOWN/ROUND_FLOOR and an external Fraction oracle.

Acceptance fixtures use complete real TEST authority and real assigned engines. Genuine/forged wrappers count exactly one transition;240 outer fields are all consistent. Errors are specific ValidationError assertions, and memory locations, staging sentinels/full snapshots and independent DML instrumentation exclude unrelated failures. Caller flags and context identity are explicitly checked. No consequential tautology or coverage weakness found.

Disposable integrity-harness development encountered a sandbox Python-launch restriction and an extra-newline error in its detached pre-F2 prefix reconstruction. The launcher was rerun with the permitted execution context and the reconstruction boundary corrected; all three exact hashes then matched. These were review-harness issues, not application/test failures. No implementation file was edited to make any check pass.

## 19. Regression Results

All test/check rows below are freshly executed for this review. Every final invocation exited0.

| Check | Result |
| --- | --- |
| F2-focused: contract + acceptance files, -k f2 | 16 passed, 224 deselected, 2 warnings in 5.90s |
| Complete D11E acceptance + research contracts + SM-2 | 302 passed, 2 warnings in 71.96s (0:01:11) |
| Research time boundaries + FSRS | 129 passed, 2 warnings in 0.26s |
| FSRS capture --check only | Pinned direct-library golden reproduction: PASS |
| D11B acceptance + D11C/D11D routing | 32 passed, 2 warnings in 10.14s |
| F1 adversarial: complete acceptance file, -k f1 | 152 passed, 33 deselected, 2 warnings in 47.58s |
| Unchanged independent D11E/F1 suites (67+104) | 171 passed, 2 warnings in 58.40s |
| New independent F2 probes | 17 passed, 2 warnings in 10.57s |
| Full backend pytest, no file or keyword restriction | 661 passed, 2 warnings in 141.02s (0:02:21) |
| Independent matrix | 10 contexts; 337 valid and 852 invalid candidates; 5 paths; 59,450 classifications; additional 250 exact-tuple checks |
| Protected-hash/reconstruction/context-policy checks | 11 published after-hashes verified; 3 pre-F2 file hashes exactly reconstructed; Context constructor ASTs identical |
| Ruff app tests scripts, --no-cache | All checks passed!; exit0 |
| Static Python compilation in memory | 100 Python files passed; exit0 |
| uv lock --check --offline | Resolved 49 packages in 1ms; exit0 |
| git diff --check | PASS; exit0; existing LF-to-CRLF advisories only |
| Review-start integrity | All 268 existing files unchanged; only this new report added |

All database pytest invocations were sequential via the inspected C:\Users\user\AppData\Local\Temp\fluentt-d11b-run.py guard, observing **fluentt_test / d11b_21ec17a1c5**. It rejects non-test database names and unexpected schema/search_path. Multiple sessions inside concurrency tests share that same private schema; separate suites were not run concurrently.

Commands used backend virtualenv Python -B, pytest -q --tb=short -p no:cacheprovider; disposable probes additionally used -s. Full pytest had no path/-k restriction. Ruff used --no-cache; static checks used compile() in memory across app/tests/scripts/alembic; FSRS capture never rewrote fixtures. The two warnings are existing Starlette/httpx TestClient and AnyIO BlockingPortal deprecations.

## 20. Findings

**New CRITICAL:0. IMPORTANT:0. MINOR:0.** No remaining F2 blocker found within the required scope. The current genuine/forged, decoding, context preservation, reachability, F1, FSRS, atomicity, replay and concurrency evidence supports closure.

This is a bounded source review and isolated PostgreSQL verification, not a formal/live deployment or study-readiness decision.

## 21. C-01 / I-01 Disposition

**C-01 CLOSED by F2.** The original arithmetic sensitivity is reproduced in the detached control, while corrected live validation accepts genuine238 and rejects consistent240 independently of caller policy. Persisted decoding is consistent.

**I-01 CLOSED for the reviewed complete-result validation boundary with F1+F2.** F1 deep reconstruction still rejects trusted-instance mutations; F2 supplies deterministic reachability arithmetic to that fresh validation. The prior reports correctly record their historical blockers and are preserved unchanged; this report records the new disposition.

## 22. M-02 / M-03

**M-02 OPEN / DEFERRED.** The migration test's global pg_trigger count still limits shared/parallel multi-schema topology. Verification retains the dedicated private schema and sequential suite execution. Genuine lock races use concurrent connections within that schema, not parallel schema resets.

**M-03 OPEN / DEFERRED.** DevelopmentScheduler extreme-date behavior remains unchanged and outside this research correction. Its protected hash matches; assigned research work cannot fall back to development.

Neither deferred issue was fixed or silently closed by this review.

## 23. Git Status

Branch/head remain main / 4135cd7334acbdb1b97fc1a8843eaf03cdddd353. Index empty; no staging, commit or push. Tracked diff remains the pre-existing **10 files,460 insertions,192 deletions**. Local branch status reports main...origin/main without ahead/behind markers; no fetch/network synchronization check was performed.

All **268** review-start non-ignored files remain byte-identical by SHA-256, including source/tests/engines/configuration/migrations/dependencies/mobile/fixtures and previous reports. The only new path is this untracked report. Full git status --short:

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
?? backend/tests/reviews/test_d11e_acceptance.py
?? backend/tests/reviews/test_research_contracts.py
?? backend/tests/scheduling/
?? docs/development/d10-timing-fix-review-bundle.txt
?? docs/development/d11-esr-preimplementation-audit.md
?? docs/development/d11-t1-f1-independent-rereview.md
?? docs/development/d11-t1-f1-predecessor-utc-fix-review.md
?? docs/development/d11-t1-independent-code-review.md
?? docs/development/d11-t1-research-time-boundary-hardening-review.md
?? docs/development/d11a-scheduler-contracts-spec.md
?? docs/development/d11b-implementation-review.md
?? docs/development/d11b-independent-code-review.md
?? docs/development/d11c-binary-sm2-implementation-review.md
?? docs/development/d11c-f1-decimal-context-fix-review.md
?? docs/development/d11c-f1-independent-rereview.md
?? docs/development/d11c-independent-code-review.md
?? docs/development/d11d-fsrs6-implementation-review.md
?? docs/development/d11d-independent-code-review.md
?? docs/development/d11e-f1-complete-result-revalidation-review.md
?? docs/development/d11e-f1-independent-rereview.md
?? docs/development/d11e-f2-independent-rereview.md
?? docs/development/d11e-f2-sm2-validation-determinism-review.md
?? docs/development/d11e-independent-code-review.md
?? docs/development/d11e-research-acceptance-integration-review.md
?? docs/development/p01-pronunciation-preimplementation-audit.md
?? docs/development/p02-pronunciation-architecture-scoring-spec.md
?? docs/development/p02f-pronunciation-feasibility-report.md
```

## 24. Recommendation

Accept the narrow D11E-F2 correction and close C-01 and the qualified I-01 boundary review. Preserve formal/live routing closure and deferred M-02/M-03. Retain prior evidence and this report untracked. No implementation changes, staging, commit, push or unrelated milestone work were performed.

**D11E-F2 INDEPENDENT RE-REVIEW PASS**
