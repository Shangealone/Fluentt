# D11D Independent FSRS 6.3.2 Code Review

Review date: 2026-10-17 (Asia/Manila). Repository: `F:\FLUENTT`. Branch: `main`. HEAD: `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`.

## 1. Verdict

**D11D INDEPENDENT CODE REVIEW PASS**

Zero CRITICAL findings, zero IMPORTANT findings, one new MINOR finding (M-04: extreme FSRS due-addition overflow is not translated into a controlled validation error). M-04 is safely deferrable while this remains an unconnected pure engine; address it before research acceptance integration together with the existing representability gate. It does not return a wrong due/state or write accepted evidence.

The installed pinned runtime, exact frozen configuration, reconstruction, one-transition call semantics, state extraction, whole-day intervals, independent fixtures, long mixed JSON round trips and routing closure pass fresh verification. All requested focused/full tests and Ruff/static/lock/diff checks pass. This is approval of the pure foundation, not research acceptance activation or an extreme-date support claim.

## 2. Review Scope

Inspected all seven primary D11D dependency/engine/capture/fixture/test files, the D11D implementation report, normative D11A sections covering contracts/configuration/reconstruction/results, D11B independent findings and D11C-F1 re-review. Also inspected installed fsrs Card/Scheduler/ReviewLog implementation, shared research contracts/configuration, acceptance resolver/service, sync service, test fixtures/counts and historical replay checks.

Before review: expected branch/HEAD, empty index and clean `git diff --check`; reviewed D11B/D11C changes still present. Tracked diff versus HEAD is ten files, 252 insertions/193 deletions, including pre-existing D11B work. This is not a claim that all ten were changed by D11D.

Captured SHA-256 for **256 pre-existing tracked/untracked files** at review start. Separately compared the retained 250-file pre-D11D baseline: only `backend/pyproject.toml` and `backend/uv.lock` changed; exactly the engine, capture script, fixture, two test files and D11D implementation report were added. Thus no D11D migration/model/acceptance/mobile/pronunciation/manuscript modification was inferred merely from the implementation report.

This review writes only this new report. No implementation/test/dependency/previous report change, golden regeneration, staging, commit or push.

## 3. Dependency / Version

**PASS.** Manifest adds exactly runtime `fsrs==6.3.2`, with no extras. Parsed old lock from HEAD and current lock: only new package `fsrs`; no removed package; the sole changed existing package record is the backend project's new dependency entry. All other complete package records, not merely versions, are identical. `typing-extensions==4.16.0` was already present in HEAD's lock. No torch/numpy/pandas/optimizer dependency was added.

Actual installed distribution reports `6.3.2`; import works on CPython 3.13.15. Installed metadata requires Python >=3.10 and base `typing-extensions`; optimizer/dev dependencies have explicit extra markers. Backend requires >=3.13,<3.14. No installation or dependency update was performed during review.

Locked wheel SHA-256: `bc55066c821164b1cff6d75b17a3ed8e86cfd45789e3d775cfcb895319ce9ba4`. Locked sdist SHA-256: `7fe79947ceb92ca35fdca3dfa511a239be15b317cde63d6643a2da6110844d91`. Version/source/artifact hash fields are present. Fresh `uv lock --check --offline` exits 0, resolving 49 packages in 1ms.

## 4. Installed API

**PASS.** Inspected runtime signatures and source, not documentation alone:

```text
Scheduler(parameters, desired_retention, learning_steps, relearning_steps,
          maximum_interval, enable_fuzzing)
Card(card_id, state, step, stability, difficulty, due, last_review)
Scheduler.review_card(self, card, rating, review_datetime, review_duration)
```

Optional third-party defaults exist; the adapter supplies every research-locked constructor field plus both review arguments explicitly. Actual Rating values: Again=1, Hard=2, Good=3, Easy=4. State values: Learning=1, Review=2, Relearning=3. Full 256-bit ID survives construction, copy, transition and ReviewLog. Input Card remains unchanged. Installed Card/Scheduler source hashes match frozen fixture provenance.

## 5. Frozen Configuration

**PASS.** Canonical document SHA-256 and record digest both match `4e4c56a9f928cae5581e5d577de413b17c9d581185482db423a98551f6575e4f`. Document/record identity agreement is checked before loading immutable values. Independently asserted all 21 runtime parameters against literals:

```text
(0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194,
 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542)
```

Retention=0.9, learning/relearning steps=(), maximum=36500, fuzz=False, minimum=1, day_seconds=86400. Identity is enhanced_srs / fluentt-esr-fsrs6-binary-v1 / schema 1 / fsrs6-binary-r90-config-v1.

Each calculation constructs a new Scheduler with all six explicit configuration arguments. Tuple snapshot and frozen identity detach it from mutable seed dictionaries; no alternate/default/config injection route. An independent in-memory seed mutation to retention 0.80 was rejected by `_configuration()`; the already-loaded snapshot continued yielding the original result. Tuple field assignment was rejected. The seed mutation was restored inside the disposable probe process; no source changed.

## 6. Reconstruction Contract

**PASS.** Existing mathematical input remains exactly correct, interaction_at_utc, prior_state, prior_interaction_at_utc. Separate frozen/strict context contains only UUID user_id, UUID vocabulary_item_id and required nullable UTC-aware prior_due_at_utc. Extra fields and coercive UUID strings/bools/naive datetimes fail. No response time, pronunciation, instructional difficulty, interruption evidence, receipt/transport time, client condition or Card ID feature.

Adapter requires typed models, then revalidates dumped copies to catch model_copy/model_construct bypasses. Shared input validation pairs state/interaction; adapter additionally pairs state/due and requires EnhancedState for subsequent reconstruction. Independent enumeration rejected all six incomplete combinations of predecessor facts before Card construction. Both legitimate combinations (all absent/all present) work. Ownership/assignment/chronology/eligibility remain service responsibilities.

## 7. Deterministic Card Identity

**PASS.** Exact production expression: `(user_id.int << 128) | vocabulary_item_id.int`. UUID integers occupy disjoint 128-bit ranges, so division/remainder by 2**128 recovers the pair and proves injectivity. No hashing/truncation/client ID/generated ID. Adapter rejects returned ID changes and non-integer IDs.

Direct fixture check verifies the synthetic full-width ID has bit_length 256 and survives every transition. Independent long sequences use four additional distinct pairs. A separate real-call probe uses both nil UUIDs, yielding integer zero; it also bypasses ID generation, demonstrating the explicit zero case is not mistaken for missing identity.

## 8. First Review

**PASS for representable due instants; see M-04 for error mapping at the date maximum.** Explicit Card fields are Learning, step 0, None stability/difficulty/last_review, deterministic ID and due=current interaction. Both prior input facts and context due are absent.

Independent direct installed-library reproduction at `2026-01-01T10:11:12.123456+00:00`:

| Answer / rating | State / step | Stability | Difficulty | Interval | Due UTC |
| --- | --- | --- | --- | --- | --- |
| Correct / Good (3) | Review / null | 2.3065 | 2.118103970459016 | 2 days / 172800 seconds | 2026-01-03T10:11:12.123456+00:00 |
| Incorrect / Again (1) | Review / null | 0.212 | 6.4133 | 1 day / 86400 seconds | 2026-01-02T10:11:12.123456+00:00 |

Empty learning steps explicitly force Review/None for both ratings in installed source. No transient Learning state is returned as memory.

## 9. Subsequent Reconstruction

**PASS.** Fresh Card uses Review/None, validated prior stability/difficulty, authoritative context prior due, input prior interaction as last_review and deterministic pair ID. It neither recomputes due from memory nor uses receipt/current time. No history replay. Independent direct-library and real-call probes, plus supplied spies, verify predecessor fields and immutability across mixed transitions. Review + Again with empty relearning steps remains Review/None, including repeated Incorrect and same-day paths.

## 10. Binary Rating Mapping

**PASS.** Only the strict boolean selects frozen Good(3)/Again(1). No path to Hard/Easy or feature-derived rating in the adapter. Repository search found no production feature transformation feeding FSRS. Duration is explicitly None; descriptive answer/timing metadata is not consumed.

## 11. Review Call Semantics

**PASS.** `fsrs6.py:141-146` is the single production review_card invocation. It always supplies explicit current normalized UTC interaction and review_duration=None. One fresh Card, one explicit Scheduler and exactly one real transition per schedule invocation; no probing/replay/retry/optimizer/second evaluation.

Supplied spies subclass real Scheduler and call super once; Card factory returns actual Card. Independent spy also counted three actual transitions for three answers, inspected arguments/configuration, and asserted original Card unchanged. ReviewLog confirms identity/rating/date and None duration; it is discarded by the adapter.

## 12. Application State Extraction

**PASS.** Requires State.Review by identity and step None, unchanged integer ID and UTC last_review equal to current interaction. Existing FsrsMemory rejects booleans/strings/nonfinite/nonpositive stability and difficulty outside 1..10. Only state/step/stability/difficulty enter memory; the five-key envelope carries exact schema/type/algorithm/config/memory. No Card, provider dictionary, ID, due, last_review or log enters state. No arbitrary float rounding. Inputs/prior/context and reconstructed Cards remain unchanged.

## 13. Interval / Due Derivation

**PASS for returned results.** UTC-aware library due minus current UTC interaction produces a timedelta. Nonzero seconds/microseconds, nonpositive days or days outside 1..36500 are rejected. Uses integer timedelta.days with explicit remainder checks, not floating total_seconds/truncation/rounding. Negative fractional durations also fail those checks.

Application recomputes due from the interaction plus whole days, checks exact equality, computes days*86400 and invokes existing result validation. Corrupt-output tests exercise fractional, zero, negative, over-cap and state/numeric/identity/time output failures against a real library transition before corruption. No malformed output was accepted.

Library `_next_interval` performs the pinned round-then-clamp math. Direct maximum fixture and adapter both yield 36500 days / 3153600000 seconds. Adapter introduces no second/different cap. A library date-addition overflow can occur before a Card is returned; that separate controlled-error limitation is M-04, not a silently changed interval/due.

## 14. Float / JSON Round Trip

**PASS.** The supplied 16 families run through raw state and FastAPI jsonable_encoder -> standard JSON encode/decode -> existing decode_research_state -> reconstruction, matching independent literal outputs exactly.

Additional independent review probes ran four 128-answer mixed sequences: **512 transitions / 1024 wrapper results**. Each direct uninterrupted third-party Card was compared with both uninterrupted application memory and application state serialized/decoded after every answer. Varied same-day, just-below/at/above-day, 3-day and 30-day gaps; distinct UUID pairs. Every stability/difficulty, interval seconds/days and due matched exactly; prior/context snapshots remained unchanged. No consequential precision loss.

This verifies pinned-runtime binary64 behavior on CPython 3.13.15/AMD64, not Decimal arithmetic or cross-platform transcendental equivalence. Accepted research-row persistence is outside this pure milestone and was not fabricated as round-trip evidence.

## 15. Golden Fixture Independence

**PASS.** Capture imports stdlib/fsrs only; AST-literal inspection of the frozen seed is data validation, not importing an adapter. No EnhancedFsrsScheduler/helper/test path computes expected values. Direct Card remains uninterrupted across sequence steps; expected output comes from installed library Card/log and exact timedelta. Wrapper independently reconstructs from application memory. Literal fixture is a checked-in-to-worktree JSON snapshot, not runtime expectations generated by the wrapper.

CHECK mode reproduced all stored data, including Python/version/machine/config/UUID/card ID/source hashes. Source inspection confirmed CHECK reads/computes/compares only; the output-writing branch was not invoked. Independent review code did not import the capture utility or supplied test helpers. It reproduced every fixture field through its own direct calls, using integer-microsecond divmod for interval checking.

Fixture bytes remain unchanged: SHA-256 `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6`. CHECK compares parsed data, not formatting; before/after file hashes independently prove no fixture rewrite. Capture provenance intentionally describes the original runtime and is not a portable-regeneration promise for other patch/platform combinations.

## 16. Runtime Goldens

**PASS: all 16 families / 39 direct transitions independently reproduced.** Includes all required first/binary pair/multiple Correct/repeated Incorrect/mixed/on-due/after-due/before-due/cap families plus same-day and elapsed-day boundary cases. Matched rating, state, step, full-precision stability/difficulty, interval days/seconds, due and last_review for every step.

Representative mixed sequence:

| Day / answer | Stability | Difficulty | Days |
| --- | --- | --- | --- |
| 0 / C | 2.3065 | 2.118103970459016 | 2 |
| 2 / I | 0.6075801062519337 | 7.394502741279718 | 1 |
| 3 / C | 2.4004040500172708 | 7.382336607835277 | 2 |
| 6 / C | 7.122749316158636 | 7.37018264052428 | 7 |
| 7 / I | 0.9955848131321441 | 9.120825285995213 | 1 |
| 8 / I | 0.30437873506378604 | 9.69624961919152 | 1 |
| 11 / C | 1.171313786891941 | 9.681781738869166 | 1 |
| 20 / C | 3.627507508106244 | 9.667328326427134 | 4 |

All remain Review/null. Direct reproduction verifies empty learning/relearning step behavior for first and subsequent Again, rather than assuming the standard default step behavior.

## 17. Elapsed-Time Behavior

**PASS.** From first Correct and its 2-day due, subsequent Good yields on due day 2 -> 11 days; late day 9 -> 24; early day 1 -> 7. Just below one elapsed day -> 2; exactly one day -> 7; just above -> 7. Direct reproduction confirms all values.

Installed source calculates elapsed timedelta.days and passes review_datetime explicitly to get_card_retrievability. Adapter forwards exact prior interaction/due/current interaction without day/calendar normalization. Pure ability to calculate before due is not acceptance eligibility; the adapter correctly adds no such policy.

## 18. Purity / Determinism

**PASS.** Wrapper has no database/session, filesystem, network, environment, clock, sleep or random call. Stateless engine; immutable configuration snapshot. All required first/subsequent facts are explicit. Third-party math does not depend on optional optimizer packages.

Source identified default clocks in Card's missing ID/missing due, review_card's missing review_datetime and get_card_retrievability's missing current_datetime. Adapter supplies the first three; review_card internally forwards current_datetime. Fuzz executes only when enable_fuzzing is True, which this adapter explicitly disables.

Supplied guards pass. Independent real-call probe additionally patched builtins.open, socket construction, environment reads, SQLAlchemy connect, library random/fuzz methods, clocks and sleep to raise. Three real first/subsequent transitions succeeded. Five deliberate negative controls (omit ID, omit due, omit review datetime, omit retrievability date, enable fuzz) each triggered its guard, establishing that the instrumentation detects the forbidden paths. All monkeypatches were confined to disposable probe processes.

## 19. Routing Closure

**PASS: CLOSED.** Production search finds EnhancedFsrsScheduler only in its own module; no runtime dispatch/registry import reaches it. Review service replays existing accepted events before new-work authority and resolves only development authority under the learner lock. Resolver rejects any owner allocation with 503 D11_ROUTING_DISABLED; sync invokes that same service. No research engine integration/persistence/current-pointer change.

New routing tests invoke the real engine and then real online/shared or sync service with a real database allocation; resolver is not mocked. Both reject with 503 and all five counts (attempt, schedule, accepted event, current pointer, research event) stay zero. Existing acceptance tests also preserve historical replay. Existing D11B migration/model/service changes remain protected baseline files, not D11D changes.

## 20. Test Quality

**PASS.** Assertions test installed version/signatures/enums, literal parameters/explicit options, full Card arguments/ID, actual library transitions/copy, exact state/interval/due, JSON decoding, elapsed branches, cap, invalid facts and corrupt library responses. Correct/Incorrect and multiple transition sequences are covered. The supplied three enum assertions do not enumerate every State member, but version guard, reconstruction checks and independent complete enum inspection establish the expected runtime semantics.

Goldens are not tautological. Real-call spies wrap rather than replace math. Corrupt-return tests first perform a real transition and then change a field to exercise adapter rejection. Routing fixtures provision actual test allocations and use the connected service. No resolver mock hides activation. Pure tests override only inherited DB setup/cleanup; they do not replace scheduler behavior.

Remaining bounded gap: extreme library due-addition error mapping is untested by the supplied suite and was found by independent boundary probes (M-04). This does not undermine successful normal-range state/interval assertions or conceal a returned corrupt result.

## 21. Regression Results

Fresh review execution, not copied implementation timings:

| Check | Actual result |
| --- | --- |
| New FSRS tests | **79 passed, 2 warnings in 0.24s** |
| Capture utility CHECK only | **PASS**, fixture not rewritten |
| New routing / contracts / SM-2 / D11C routing / D11B acceptance | **141 passed, 2 warnings in 22.55s** (2 + 47 + 62 + 7 + 23) |
| Full backend pytest | **418 passed, 2 warnings in 83.86s (0:01:23)**; exit 0 |
| Ruff app/tests/scripts | **All checks passed!** |
| Static in-memory compilation, app/tests/scripts/alembic | **98 Python files PASS** |
| uv lock --check --offline | **PASS**, 49 packages in 1ms |
| Independent direct-library reproduction | **16 families / 39 transitions PASS** |
| Independent longer JSON/direct comparison | **512 transitions / 1024 wrapper results PASS** |
| Independent explicit real-call / forbidden-path probe | **3 transitions PASS**, including zero integer ID |
| Guard sensitivity negative controls | **5 PASS**, expected guard failures observed |
| Config drift/snapshot and incomplete predecessor probes | **PASS**, 6 invalid combinations rejected |
| Extreme due boundary probes | Two representable boundary cases pass; two raw OverflowErrors reproduced (M-04) |
| Final git diff --check / file integrity | **PASS**, all 256 existing files unchanged; only this new report added |

Python uses `-B`; pytest uses `-q -p no:cacheprovider --tb=short`; Ruff uses --no-cache; compilation uses in-memory compile(), so no bytecode output. Inspected DB helper refuses a database not ending `_test` and verifies its current private schema/search_path. Tests use `fluentt_test` / `d11b_21ec17a1c5`, with no public fallback or D10 evidence database use. Isolated fixture data operations are test execution, not production-data changes.

Warnings are the pre-existing Starlette/httpx TestClient and AnyIO BlockingPortal deprecations. No failing test was changed or hidden. Additional probes ran in memory, without saving source/tests/scripts.

## 22. Findings

**CRITICAL: 0. IMPORTANT: 0. New MINOR: 1.**

### M-04 — MINOR: unrepresentable library due raises raw OverflowError before adapter validation

- **File/symbol:** `backend/app/scheduling/fsrs6.py:141`, EnhancedFsrsScheduler.schedule() -> installed fsrs Scheduler.review_card(), scheduler.py:507 (`card.due = review_datetime + next_interval`).
- **Trigger/scenario:** fully validated first input at aware UTC datetime.max, with valid strict context and no predecessor, for either Correct or Incorrect. Correct at datetime.max minus one day also reproduces it. Input validation itself succeeds; this is distinct from offset-to-UTC normalization overflow.
- **Expected:** an unrepresentable proposed due must fail closed through a controlled scheduler/contract validation error before future acceptance, preserving the true interaction/interval and without clamping/reanchoring. Existing shared result validation and pure SM-2 already demonstrate controlled ValidationError handling for result due overflow.
- **Actual:** installed FSRS raises `OverflowError: date value out of range` while assigning its new Card due. The adapter has no exception translation around that call, so its later due/result validation never runs. Trace confirms exactly schedule:141 -> review_card:507. Boundary controls at max minus two days for Correct and max minus one day for Incorrect return the exact maximum representable UTC due normally; this isolates representability rather than algorithm/config drift. SM-2 comparison at max yields ValidationError.
- **Impact/severity:** bounded error-handling defect, not a wrong returned state/due, nondeterminism or evidence mutation. No result is returned and the pure adapter performs no writes. Research acceptance is closed, and extreme-date support is explicitly not claimed. Therefore MINOR and safe to defer for this pure-engine closure, analogous to the existing representability hardening gates; it must not silently become an unhandled service exception when integrated.
- **Recommended scope/gate:** before research acceptance integration, narrowly translate due representability failures from the actual library transition into the agreed contract/time error, with max-date Correct/Incorrect and subsequent-state tests. Preserve one transition, explicit time, whole-day interval and no date clamping/server-clock substitution. Coordinate with M-01; this is an additional FSRS call site, not closure or reclassification of M-01. No fix was made in this review.

No other actionable D11D defect or test tautology was identified within the reviewed pinned runtime.

## 23. Deferred Gates

No original finding was fixed, waived or falsely closed:

- **M-01:** extreme research UTC normalization/predecessor due overflow; **SAFE TO DEFER UNTIL BEFORE RESEARCH ACCEPTANCE INTEGRATION**. Mandatory controlled-error corrections/tests before integration.
- **M-02:** global D9 trigger-count isolation; dedicated current layout only, fix before shared multi-schema/parallel database verification.
- **M-03:** pre-existing development extreme due overflow; separate development error-boundary hardening gate unchanged.
- **M-04:** additional FSRS library due-addition representability/error-mapping site described above; safely deferred while unconnected, required before research acceptance integration.

Formal enrollment/provisioning, assignment freeze/clock/period policy and accepted research-chain persistence remain separate future work. A pure-engine review pass authorizes none of them.

## 24. Git Status

Branch `main`; HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; empty index. Existing implementation, tests, dependency files, fixture, prior reports and all other baseline files retain their review-start hashes. This report is the sole added file and remains untracked. No stage/commit/push or clean/reset was performed.

Final short status (pre-existing entries retained):

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
?? docs/development/d11d-independent-code-review.md
?? docs/development/p01-pronunciation-preimplementation-audit.md
?? docs/development/p02-pronunciation-architecture-scoring-spec.md
?? docs/development/p02f-pronunciation-feasibility-report.md
```

Hash comparison covers collapsed untracked directories too; the unchanged claim does not rely on status alone. All **256 pre-existing files are byte-identical** to this review baseline. Golden fixture hash is explicitly recorded in section 15. Final whitespace and required report structure checks pass.

## 25. Recommendation

Accept D11D as the pinned pure FSRS foundation, with M-04 recorded as a bounded deferred error-mapping issue. Keep research routing CLOSED and require M-01 plus M-04 before any research acceptance integration. Retain M-02/M-03 gates unchanged. Do not infer production/formal-study readiness or extreme-date support. No implementation fix, dependency update, golden regeneration, staging, commit or push occurred.

**D11D INDEPENDENT CODE REVIEW PASS**
