# D11E-F1 Independent Complete Result Revalidation Review

## 1. Verdict

**D11E-F1 RE-REVIEW BLOCKED — ambient Decimal context permits unreachable SM-2 state to persist.**

New findings: **1 CRITICAL (C-01 in this re-review), 0 IMPORTANT, 0 MINOR**. The original negative-FSRS-stability and SM-2-EF=9 instance-trust reproductions now reject before staging. However, a new actual acceptance probe commits unreachable SM-2 memory when caller Decimal precision is 2; its genuine 238-day counterpart is rejected. Complete validation therefore does not yet establish a persistence-safe result under the reviewed exact-arithmetic requirements.

Checked-in focused/full regressions pass. Independent new probes produce **102 passed, 2 failed**; both failures establish C-01. Existing 67 independent D11E probes pass. No implementation fix, staging, commit or push was performed.

## 2. Scope

Reviewed on 2026-10-18 in F:\FLUENTT. Branch `main`; HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; index empty. Existing D10/D11/P01/P02 work remained present. Initial git diff --check passed with existing line-ending advisories.

Read the complete current research_contracts.py, every new F1 test, original blocking finding, correction report, D11E integration report, relevant D11A result/state/transaction/time rules, reviewed SM-2 Decimal-context evidence, both engines, service/result-persistence call sites, authority routing, request models, sync path and test isolation/concurrency helpers.

Scope verification does not rely solely on the implementation report:

- Reconstructing the pre-F1 canonical source in memory by removing only the added helper and reverting its call reproduces the original recorded SHA-256 **a23adf8856e9f4d10950dcbd409bb9800a384fb0019567e9986c607d3b97b781**.
- Removing only F1 imports/snapshot helper/appended tests in memory reproduces the original test SHA-256 **833afba0c95b7490edc913aa08c10b542547bc14317bc22fb74f4be6c7274e84**.
- All **11** published protected-file hashes in the correction report match actual current files. The two corrected paths have their reported after-F1 hashes; service/acceptance, engines/configuration, goldens, dependency/lock and prior blocking report remain at their protected hashes.
- No F1 migration, model/DDL, authority-schema, mobile or dependency addition was found. Existing dependency/lock and D11B migration changes from HEAD predate F1.

Captured review-start SHA-256 for **266 tracked/untracked non-ignored files**. All remain byte-identical after this re-review; the sole repository addition is this requested untracked report. Relevant review-start entries:

| File | SHA-256 |
| --- | --- |
| `backend/app/scheduling/research_contracts.py` | `73c4c28447daa1115570efa94d128f3504627e166355ccabb74da73d4e769e36` |
| `backend/tests/reviews/test_d11e_acceptance.py` | `82827fba74216a45a95bbd937a629c40134cc35018d46118c405d582ee599ca1` |
| `backend/app/reviews/service.py` | `4b3ad5f9360f67ea8847c8b2f0eefe4508a4a13d39eb4b6644345e7dbf491514` |
| `backend/app/reviews/acceptance.py` | `9d67f292d9a7187afff1e3ff0790c6e7ec58c24d9b8db572d3223b9e80eb1680` |
| `backend/app/scheduling/sm2.py` | `02491e6e347e9fa3cf4c01dad17899b998475e453bd89b414269a3b10ceed48d` |
| `backend/app/scheduling/fsrs6.py` | `ae55c25605ed748e8341d69f00a484921988db921477e58f82b12b3920272f52` |
| `backend/app/research_authority/config_v1.py` | `b3af792ef3bc623ea4f2575d963574df094f08b45156653972e0d36e02f1a670` |
| `backend/tests/scheduling/fixtures/fsrs6_6_3_2_goldens.json` | `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6` |
| `backend/pyproject.toml` | `1052e4282cb0bb8a0161e91997c53ff900385d0f8a1634378c9a6b40ea2a8006` |
| `backend/uv.lock` | `19142dde9e25413c7ad7de31071173b5088984c09acb475cc0c3b31ac7a55eca` |
| `docs/development/d11e-f1-complete-result-revalidation-review.md` | `1269ca42065f16366a5852d52380152d0281cf88431a3769baa3438980205411` |

Independent disposable probes were written only outside the repository: `C:\Users\user\AppData\Local\Temp\test_fluentt_d11ef1r_probes.py`. Existing `test_fluentt_d11er_probes.py` and the guarded test runner were inspected/reused without edits. Database runs were sequential in `fluentt_test` / private schema `d11b_21ec17a1c5`; no D10 evidence, native app storage or human credentials were accessed.

## 3. Original I-01 Reproduction

**Specific original attacks: PASS, rejected.** New independent probes start with real assigned-engine results, mutate only FSRS stability to -1.0 or SM-2 EF to Decimal("9"), preserve identities/interval/due, and pass the malformed existing objects through actual TEST-authorized shared acceptance.

Both model_copy and model_construct variants reject. The independent matrix observes actual Session attachments and accepted-table SQL, without replacing the persistence helper: no accepted evidence is staged or written, and complete before/after table snapshots remain equal. Construct variants preserve an existing accepted predecessor/pointer and use sync; copy variants enter direct shared acceptance. Supplied HTTP online/sync cases also pass.

Two pure negative controls demonstrate probe sensitivity: direct legacy ResearchSchedulerResult.model_validate(bad_instance) still trusts those invalid nested values, whereas the corrected canonical function rejects them. Thus the original unsafe framework behavior is exercised, not accidentally avoided.

These successful specific rejections do not close the broader persistence-safety invariant because C-01 admits another unreachable returned state.

## 4. Canonical Deep Revalidation

**Structural reconstruction: PASS. Domain determinism: FAIL under C-01.**

_result_field_data extracts BaseModel __dict__ plus model_extra and recursively rebuilds ordinary dictionaries. Nested result, state and memory model instances become field dictionaries before ResearchSchedulerResult.model_validate. It invokes no serializer and does not rely on the model instance's prior validation history.

StrictContract retains extra=forbid, frozen=True, strict=True and allow_inf_nan=False. Pydantic's default revalidate_instances=never remains unchanged, but no expected model instance survives the reconstruction at a valid result/state/memory object layer. Registered identity, strict field domains, reachability, result consistency and due-anchor checks run again.

Scalars remain Python Decimal/datetime/float values; there is no JSON round trip. No domain rules were duplicated by the helper, and no scheduler transition occurs inside it.

The new call reruns Sm2Memory.reachable outside the scheduler-owned Decimal context. Executing a validator is insufficient if its arithmetic result depends on ambient rounding/precision. That is the remaining blocker.

## 5. Pydantic Instance-Bypass Resistance

**PASS for the original instance-trust mechanism.** Independent constructs bypass validation at outer result, state envelope and memory levels using both model_copy and model_construct; resulting declared-field defects are rejected through real acceptance.

Ordinary dictionaries and hybrid dictionaries with nested BaseModel values are also reconstructed and validated. Valid instance/dictionary inputs yield fresh value-equivalent result/state/memory objects. Standard UserDict and MappingProxyType envelope probes reject with model_type under the existing strict models; unsupported mapping wrappers did not bypass reconstruction.

Retained extras from model_copy remain visible to validation. Inputs already discarded by extra-forbid model_construct cannot be recovered; this is accurately distinguished in the correction report and is not a hidden accepted-field defect.

C-01 does not mean model instances are still trusted wholesale: the nested validator demonstrably executes but computes the wrong reachable interval under a reduced caller context.

## 6. Enhanced Adversarial Results

**PASS.** Independently exercised 12 malformed enhanced-memory families, each through copy and construct paths: negative/zero/NaN/+infinite stability; low/high/NaN/+infinite difficulty; Relearning state; non-null step; bool stability; numeric-string difficulty. All **24** reject with ValidationError, zero accepted-table attachments/DML, unchanged complete evidence and one real FSRS transition.

These cover the requested minimum matrix with deliberate no-validation model replacement. The result's identities, interval, seconds and due remain unchanged, so the original negative-stability rejection depends on nested constraints rather than an outer interval mismatch.

Pinned valid first Good/Again outputs and mixed-sequence floats remain correct. No enhanced-specific remaining bypass was found.

## 7. Conventional Adversarial Results

**PASS under the ordinary context; overall FAIL under C-01.** Thirteen independent malformed-memory families, each copy/construct, cover EF 9, 1.29, 2.51, NaN and infinity; negative repetitions/lapses; zero/over-cap intervals; unreachable repetition/interval and EF/lapse combinations; string and bool counters. All **26** ordinary-context cases reject before any accepted-table staging.

In contrast, with caller precision 2, a sixth-Correct memory of repetitions=6, EF=2.5, interval=240, lapses=0 is accepted and committed, although the reviewed exact interval is 238. After leaving that context, the existing decoder rejects the stored state. Details and source locations are in section 19.

## 8. Extra / Strict-Type Handling

**PASS for reconstruction and existing strict contracts.** Eighteen independent extra-field cases cover both conditions, all result/envelope/memory levels, and model/dict/hybrid forms. The helper preserves injected retained keys and extra-forbid rejects them.

Additional independent checks reject boolean days/schema, floating seconds of the otherwise correct numeric value, numeric strings in strict counters/float memory, unknown identities/config and unsupported state/step. The accepted-table instrumentation confirms these cases reach the real engine/result boundary and fail without staging.

Existing validators intentionally accept finite actual int/float/Decimal EF inputs and reconstruct Decimal from their exact string representation; this re-review does not impose a stronger input type rule than the contract. Bool/string/nonfinite exceptions remain enforced.

## 9. Decimal Preservation

**Scalar preservation PASS; arithmetic-domain safety FAIL.** Independent normal-context read-back sequences exercise exact Decimal values **2.5, 2.18, 1.86, 1.54 and 1.3**. Decimal.as_tuple() values remain equal before/after fresh validation. No Decimal-to-float-to-Decimal conversion is introduced at this boundary. Subsequent actual accepts reconstruct the persisted predecessor and remain equivalent under the ordinary context.

C-01 isolates a different effect: the Decimal values themselves remain exact, while multiplication in Sm2Memory.reachable rounds using the caller's precision. At precision 2, 95 * 2.5 becomes 2.4E+2 before the explicit ceiling; it cannot recover the exact 237.5 that must ceil to 238. The same boundary rejects a correct 238-day result and approves a forged 240-day result.

The pure BinarySm2Scheduler remains protected by its complete owned Context and calculates 238. The earlier D11C-F1 review explicitly limited that protection to work inside schedule(); F1 adds an acceptance-side revalidation call after that scope has ended. This finding is about that integration boundary, not a claim that the pure engine's correction regressed.

## 10. FSRS Float Preservation

**PASS.** New independent observers compare before/after float.hex() for stability/difficulty and complete state equality for valid model and raw-dictionary results. PostgreSQL read-back decodes to exactly the freshly validated state, then supplies the next real transition in a mixed Good/Again sequence.

Original independent tests separately verify literal first Good stability 2.3065 / difficulty 2.118103970459016 / 2 days, and first Again stability 0.212 / difficulty 6.4133 / 1 day. Supplied F1 tests additionally compare next pure results from original, validated-model and validated-dictionary candidates.

The pinned direct-library fixture check passes unchanged. No JSON serialization or binary64 display rounding was introduced, and no FSRS precision regression was found.

## 11. Outer Result Validation

**PASS.** Twenty-eight independent outer cases cover both conditions and both construction techniques: strict days/seconds, seconds mismatch, one-microsecond due-anchor mismatch, boolean schema, unknown state configuration and unsupported result identity.

Two additional conventional cases use a separately reachable memory envelope whose interval disagrees with the outer result (rep2/day6 versus result/day1, or rep3/day15 versus result/day6). These reject, proving outer consistency remains active even when memory itself is valid. The older mutation regression is also retained and passes.

Identity, config, interval-seconds and due checks do not rescue C-01 when all these outer values are mutually consistent with the wrong 240-day memory.

## 12. Valid Acceptance

**PASS for the ordinary tested context, with C-01's valid-output rejection exception.** Real TEST authority executes the assigned reviewed engine once. Independent literal oracles preserve conventional first Correct 1 day, second Correct 6 days, first Incorrect EF2.18/1 day; enhanced first Good/Again values remain pinned as above.

New independent PostgreSQL sequences accept six events per condition, reload each actual schedule row, decode through decode_research_state and compare with the fresh acceptance-side result. Each next event uses that stored predecessor. Final counts are 6 attempts, 6 schedules, 6 ledgers, 1 pointer and 12 canonical events.

No second scheduler transition was added. Supplied valid-acceptance spies and independent invalid-result observers count one adapter call per answer; Enhanced also counts exactly one review_card call.

With precision 2, an otherwise genuine sixth-Correct 238-day result raises ValidationError at acceptance. This is a real valid-output regression under the tested caller context, not an error of engine calculation.

## 13. Atomicity

**Raised-failure rollback PASS; invalid-output safety FAIL under C-01.**

The supplied six post-calculation/staging injection points were inspected and rerun. Existing independent probes repeat all six after real calculation, attempt/schedule/ledger/event flush and actual pointer SQL for both conditions with an existing chain; complete count/hash snapshots remain unchanged.

New independent malformed-output probes observe ORM after_attach and accepted-table DML without suppressing persistence. Ordinary malformed results produce no accepted-table attachments or writes. Complete row/column snapshots of attempts, schedules, ledgers, pointer and research events remain equal.

C-01 raises no error for the malformed 240-day candidate: it commits one complete invalid chain and moves the pointer. This is not a partial-rollback failure; it is incorrect approval of invalid memory before a successful atomic commit. Genuine 238-day rejection leaves the five-event baseline unchanged.

Session preflight alone may create a session, as explicitly permitted by D11A; it is not included as accepted evidence.

## 14. Replay / Online / Sync

**Replay and shared-boundary behavior PASS; C-01 affects shared new-work validation.** Supplied online/sync malformed-instance cases pass and valid replay forbids both engine resolution and service result validation. Original independent probes accept through sync, advance current state, disable routing and replay through online/sync; original output and complete evidence snapshots remain unchanged.

No second sync scheduler or weaker path exists: both transports call record_review_attempt. New independent construct cases use sync with a stored predecessor; copy cases use the real shared service. No generic Exception expectation is used; rejection assertions require ValidationError.

This re-review does not claim the Decimal-context exploit was reproduced through a network request or that a client can select Decimal precision. It was reproduced through the actual shared service with a caller-local standard Decimal context, the boundary being reviewed.

Mobile request models still expose no authoritative scheduler/assignment selector. Response time remains evidence only; pronunciation is excluded. Independent paired-input probes confirm unchanged state/interval/due when those unrelated fields vary. No mobile file changed.

## 15. Concurrency

**PASS.** Re-ran genuine PostgreSQL distinct-event and same-UUID races for both engines using independent sessions, real learner FOR UPDATE and an observer checking pg_blocking_pids. The second distinct event sees the first committed predecessor; pointer ends at the second schedule, with no lost update or divergent chain.

For same UUID, the waiting request returns the first result through post-lock replay without new predecessor calculation or evidence. Lock/order/resolver code hashes are unchanged. The F1 boundary remains inside the reviewed transaction after calculation; C-01 is arithmetic-validation integrity, not a serialization regression.

## 16. Formal Routing Closure

**PASS, CLOSED.** Complete formal authority with valid frozen protocol/allocation, both conditions/sets, supported configuration/content and explicit policy still returns **503 D11_ROUTING_DISABLED** under APP_ENV=testing, through direct/online and sync coverage. Accepted-table snapshots remain unchanged.

Exact testing/test routing, assignment mapping, configuration binding, chronology/future-policy and development isolation remain unchanged and pass existing independent probes. No migration, formal enrollment, mobile selector or live clock policy was introduced.

## 17. Test Quality

The supplied **144 malformed-case claim is numerically and substantively accurate within its tested context**:

- 24 memory mutations * 2 contexts (first-copy/subsequent-construct) * 2 transports = 96.
- 8 structural mutations * 3 representations * 2 conditions = 48.
- Four preservation, two valid acceptance/replay and two formal cases bring the new focused total to 152.

Real engines and assignment resolution execute. A persistence-entry sentinel prevents silent acceptance in the supplied negative tests; full row snapshots support zero-write assertions, and memory error locations/call counts help exclude unrelated preflight failures. The two original I-01 mutants are explicitly represented. Some over-cap/interval mutations would also violate outer consistency, but EF=9 and FSRS negative stability have unchanged outer intervals and directly prove nested validation. Independent valid-memory/outer-disagreement controls separate those concerns.

The precision tests compare transformation invariance, which is appropriate; pinned independent literals/goldens supply math oracles. There is no major test tautology or mocked-away validator. However, all new preservation tests validate under the ordinary ambient context and emphasize low repetition/lapse sequences. They do not cover the complete all-Correct chain and reduced caller precision at the new acceptance-side revalidation call. That consequential omission allows C-01 while all supplied cases pass; it is recorded as part of the critical finding, not counted twice.

The new independent suite has **104 cases**: 50 memory, 28 outer, 18 extras, 2 valid-memory/outer controls, 2 legacy-trust sensitivity controls, 2 precision/read-back sequences and 2 Decimal-context integrity assertions. The first 102 pass; the last two fail for the actual defect.

## 18. Regression Results

Fresh observed executions:

| Check | Result |
| --- | --- |
| F1-focused (-k f1) | 152 passed, 25 deselected, 2 warnings in 130.46s; exit 0 |
| Complete D11E acceptance | 177 passed, 2 warnings in 58.09s; exit 0 |
| Time boundaries / contracts / SM-2 / FSRS | 238 passed, 2 warnings in 11.82s; exit 0 |
| FSRS capture --check only | Pinned direct-library golden reproduction: PASS; exit 0 |
| D11B acceptance / D11C-D11D routing | 32 passed, 2 warnings in 9.99s; exit 0 |
| New independent F1 re-review suite | **2 failed, 102 passed**, 2 warnings in 83.17s; exit 1 |
| Original independent D11E probes | 67 passed, 2 warnings in 30.82s; exit 0 |
| Reduced-context pure sensitivity probe | Correct 238 rejected; unreachable 240 accepted |
| Strict mapping-wrapper probes | UserDict and MappingProxyType rejected with model_type |
| Full backend pytest | **645 passed**, 2 warnings in 141.65s (0:02:21); exit 0 |
| Ruff app tests scripts, --no-cache | All checks passed!; exit 0 |
| Static compilation | 100 Python files, app/tests/scripts/alembic, compile() in memory; exit 0 |
| uv lock --check --offline | 49 packages resolved in 1ms; exit 0 |
| Final git diff --check | PASS; exit 0; existing LF-to-CRLF advisories only |
| Final repository integrity | All 266 pre-existing non-ignored files unchanged; only this new report added |

Database tests used the inspected guarded `C:\Users\user\AppData\Local\Temp\fluentt-d11b-run.py` runner and backend virtualenv Python -B. The runner refuses a non-*_test database and unexpected/private-schema search path; no public fallback or D10 database use. Test runs were sequential. Pytest used -q --tb=short -p no:cacheprovider; independent diagnostics additionally used -s. Full pytest had no test-path filter. Golden capture ran only --check.

The two warnings are existing Starlette/httpx TestClient and AnyIO BlockingPortal deprecations. No failed product behavior was patched or suppressed.

## 19. Findings

### C-01 — CRITICAL: acceptance-side SM-2 revalidation uses ambient Decimal arithmetic

**Locations:** `backend/app/scheduling/research_contracts.py:255` freshly rebuilds the result and invokes nested validators; `research_contracts.py:98` / `:116` performs reachable-memory Decimal arithmetic under the ambient context. `backend/app/reviews/service.py:205` calls that boundary after `BinarySm2Scheduler.schedule` has exited its owned localcontext at `backend/app/scheduling/sm2.py:83`. Serialization into immutable state follows at `service.py:432`.

**Required invariant:** D11A section 7 requires exact Decimal/rational arithmetic for reachable intervals. Complete result validation must establish that invariant before any accepted evidence insert; running the code under a context that rounds its arithmetic does not establish it.

**Actual transaction reproduction, complete TEST authority:**

1. Accept five genuine Correct events in new sessions for the same conventional-assigned item. Real stored intervals are **1, 6, 15, 38, 95** days; all timestamps are aware, strictly increasing, after freeze and before captured server time. Baseline counts are **5 / 5 / 5 / 1 / 10** (attempt / schedule / ledger / pointer / canonical events).
2. Enter a caller-local `decimal.localcontext()` with `prec=2`. No source, engine configuration, authority or stored history is altered.
3. Run the real sixth Correct transition once. The owned engine context returns the correct result: repetitions 6, EF2.5, interval **238** days, lapses0.
4. With that genuine result unchanged, acceptance's fresh memory validation rejects it. Evidence counts remain **5 / 5 / 5 / 1 / 10**.
5. In an independent fixture, repeat the same five valid accepts. Wrap the one real sixth transition and use model_copy to replace memory.interval_days with **240**, adjusting result days/seconds/due to agree. Identity, schema, config, correctness, repetitions, EF and lapses stay unchanged.
6. Under caller precision 2 the canonical validator approves the forged reachable-memory claim; the service commits it and advances the pointer.

Observed stored memory:

```json
{"repetition_count":6,"ease_factor":2.5,"interval_days":240,"lapse_count":0}
```

Actual post-commit counts are **6 / 6 / 6 / 1 / 12**. Pointer identity equals the new invalid schedule. Back under the ordinary context, the existing decoder rejects the actual stored JSON with ValidationError. The independent engine-call assertion remains exactly one.

**Why:** exact 95 * 2.5 is 237.5, whose ceiling is 238. At precision 2, multiplication has already rounded to 2.4E+2, and the later ROUND_CEILING call sees 240. Sm2Memory.reachable therefore considers 240 reachable and 238 unreachable. Raw Decimal scalar preservation does not prevent this arithmetic error.

**Impact/severity:** malformed scheduler memory reaches immutable research persistence, and a genuine reviewed result is rejected under the same coherent caller context. This matches the brief's CRITICAL invalid-memory-persistence criterion. The accepted state also fails normal-context decoding, poisoning the current predecessor. It is a complete invalid chain, not a partial transaction surviving an exception.

**Scope limit:** the test controls a standard in-process Decimal caller context, not an API selector or learner-controlled field. No claim is made that production workers currently use precision 2 or that real D10/formal evidence is corrupt. The independent review's fault model already includes malformed adapter return objects; this adds the numeric context at the new validation boundary. The pure SM-2 engine remains correct and its earlier standalone context guarantee remains intact.

**Recommended correction scope (not implemented):** make all arithmetic used to establish the acceptance-side memory/result domains deterministic under the locked numeric policy, including reachable-memory checks, without skipping validators, changing the vectors/configuration, clamping results or executing another transition. Add actual acceptance regressions for valid sixth-Correct 238 under reduced caller context and invalid consistent 240 rejection with complete unchanged evidence/pointer snapshots. Preserve caller settings/flags, replay, locking, routing and one-call semantics. Independent re-review is required before closure.

No other CRITICAL, IMPORTANT or MINOR finding was established.

## 20. I-01 Disposition

The original wholesale Pydantic instance-trust bypass is corrected: negative stability, EF=9, copy/construct and retained-extra probes now fail closed in the ordinary context, through actual acceptance.

**Overall I-01 persistence-safety closure is NOT approved.** C-01 demonstrates that fresh nested execution can still approve unreachable memory at the integration boundary. The historical blocking/correction reports remain untouched; this report records the qualification to the correction's readiness claim.

## 21. M-02 / M-03

- **M-02 OPEN / DEFERRED.** Tests retain the existing dedicated private schema. Real concurrency uses multiple connections to that schema, not a shared parallel multi-schema topology.
- **M-03 OPEN / DEFERRED.** DevelopmentScheduler is unchanged and outside this research result path.

No deferred item was fixed or silently closed. C-01 is a new acceptance/revalidation-context finding; it does not reopen the independently correct pure-engine D11C-F1 implementation or the reviewed research UTC-boundary fixes.

## 22. Git Status

Final branch/head: `main` / `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`. Index empty; no staging, commit or push. Existing dirty tracked/untracked D10/D11/P artifacts remain.

Tracked diff is unchanged at **10 files, 460 insertions, 192 deletions**. All **266** pre-existing tracked/untracked non-ignored files retain their review-start SHA-256, including both corrected F1 paths, scheduler engines/config, goldens, dependency/lock, mobile and all prior reports. Git diff alone is not used to infer integrity of the untracked implementation directories.

Only new repository item created by this re-review:

```text
?? docs/development/d11e-f1-independent-rereview.md
```

Disposable probes outside the repository are test harnesses, not implementation/test-source modifications. No clean/reset, fixture regeneration, native verification or later milestone execution occurred.

## 23. Recommendation

Block approval on C-01. Keep the original instance-reconstruction improvement, but require deterministic acceptance-side arithmetic and its valid/invalid regression controls before treating the complete result as persistence-safe. Preserve the passing shared routing, replay, exact dispatch, real concurrency, ordinary-context scalar/float fidelity and formal closure.

Do not infer formal/live readiness from green checked-in tests. No implementation fix was made during this read-only re-review.

**D11E-F1 RE-REVIEW BLOCKED — ambient Decimal context permits unreachable SM-2 state to persist.**
