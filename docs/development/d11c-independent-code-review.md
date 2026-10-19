# D11C Independent Binary SM-2 Code Review

Review date: 2026-10-17 (Asia/Manila). Repository: `F:\FLUENTT`. Target: current uncommitted D11B/D11C working tree on `main`, HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`.

## 1. Verdict

**D11C CODE REVIEW BLOCKED — caller Decimal exponent limits still affect valid scheduler execution**

One **CRITICAL** finding, C-01, under the brief's explicit nondeterminism criterion; zero additional IMPORTANT findings and zero new MINOR findings. With the same already validated input, the engine returns the expected 15-day result under the normal Decimal context, raises `decimal.Overflow` when only the caller's `Emax` is changed to zero, then returns 15 days when that caller context is restored.

The locked ordinary-context algorithm vectors, configuration identity and state serialization are correct. Research routing remains CLOSED. This blocker concerns the pure engine's undeclared dependence on ambient arithmetic state; no incorrect accepted research row or routing activation was observed. The finding has not been fixed during this read-only review.

## 2. Review Scope

The complete contents of `backend/app/scheduling/sm2.py`, `backend/tests/scheduling/test_sm2.py`, `backend/tests/reviews/test_d11c_routing.py`, and `docs/development/d11c-binary-sm2-implementation-review.md` were inspected. Surrounding `research_contracts.py`, `config_v1.py`, review acceptance/service, sync service and the scheduling protocol/package layout were inspected. The D11A mathematical/state/configuration requirements and deferred D11B review gates were compared directly with code. The implementation report's claims were treated as claims to verify.

Repository-wide searches for `BinarySm2Scheduler`, `conventional_srs`, and `sm2-binary-v1` found no hidden connected research acceptance integration. There is no scheduling package export or registry that activates this engine. The production `Scheduler` protocol remains the older development context/result interface; the research engine explicitly exposes the separate D11B research contract.

Baseline checks confirmed `main`, the expected HEAD, no staged changes and the reviewed D11B working tree. D11C consists of its three new Python files plus its new implementation report. No unexpected migration, dependency, lockfile, mobile, pronunciation or manuscript changes were present. SHA-256 hashes for all 247 existing tracked/untracked files were captured before review. Only this new untracked review report may be created.

## 3. Engine Identity

**PASS.** Returned identity is exactly:

```text
scheduler_type: conventional_srs
algorithm_version: sm2-binary-v1
state_schema_version: 1
config_version: sm2-binary-config-v1
```

`_configuration()` selects that configuration version, checks the document against both the seed digest and pinned literal `3bd486d1183d84a869a2470f0a97a13ecabc44365eb9fe8e158014fd1ef2a0d9`, validates the supported identity, and checks document/record identity equality. The canonical document was independently reconstructed from D11A and matched byte-for-byte; its UTF-8 SHA-256 matched the literal.

## 4. Input Contract

**PASS.** `schedule()` requires `ResearchSchedulerInput`. The shared model contains exactly `correct`, `interaction_at_utc`, `prior_state`, and `prior_interaction_at_utc`. Strict bool, aware normalized UTC timestamps, paired predecessor presence, extra-field rejection and validated research envelopes are reused.

The engine revalidates the input's dumped data and validates a non-null predecessor specifically as `ConventionalState`. It does not trust arbitrary dictionaries at its method boundary or allow a valid enhanced state to be treated as conventional memory. There is no response-time, interruption, instructional/content-difficulty, pronunciation, transport, receipt-time, participant or database argument. No client condition dispatch enters this engine.

The Decimal context is not one of those four input fields, which is why the observed dependence in C-01 violates the pure contract rather than constituting another explicit mathematical input.

## 5. Exact Arithmetic

**Correct formula and ordinary-context arithmetic; determinism BLOCKED by C-01.** q4/q2 come from the frozen document. EF arithmetic uses Decimal string constants for `0.1`, `0.08`, and `0.02`, and Decimal prior EF; there is no `Decimal(float_value)` or binary-float transition calculation. The floor comes from the frozen configuration. Interval multiplication uses Decimal and explicit `ROUND_CEILING`; no arbitrary quantization is applied.

Independent rational arithmetic gives q4 delta 0 and q2 delta `-8/25` (-0.32). A separate Fraction-based oracle checked 574 valid transitions across lapse counts 0..7, repetitions 0..35, both answers, cap saturation, due anchors, predecessor immutability and Pydantic JSON reconstruction. All matched under the default Decimal context.

However, `with localcontext(prec=28)` at `sm2.py:67` overrides only precision. It copies the caller's exponent limits and other context settings. The ordinary valid product `6 * 2.5` overflows when the inherited `Emax` is zero, at line 102. The supplied context test varies precision and rounding only; it does not cover this case.

## 6. First-Review Behavior

**PASS under the normal arithmetic context.** The transient local initialization is repetitions 0, EF 2.5, interval 0 and lapses 0. It is immediately advanced, not constructed as an accepted zero-interval envelope.

First Correct returns repetitions 1, EF 2.5, interval 1 and lapses 0. First Incorrect returns repetitions 0, EF 2.18, interval 1 and lapses 1. Existing shared state validation prevents the transient zero/zero state from escaping as accepted memory.

## 7. Correct Transition

**PASS under the normal arithmetic context.** Prior repetition 0 selects one day; prior repetition 1 selects six days. For later repetitions the code uses ceiling of the previous interval multiplied by the updated EF. Repetitions increment once; configured Correct lapse increment is zero. Bounds are applied after transition calculation.

| Correct answer | Repetitions | EF | Days | Lapses |
| --- | --- | --- | --- | --- |
| First | 1 | 2.5 | 1 | 0 |
| Second | 2 | 2.5 | 6 | 0 |
| Third | 3 | 2.5 | 15 | 0 |
| Fourth | 4 | 2.5 | 38 | 0 |

The fourth value follows exact ceiling of 37.5. Both literal existing tests and the independent rational oracle confirm it.

## 8. Incorrect Transition

**PASS under the normal arithmetic context.** The q2 EF calculation occurs before the branch resets repetitions, selects a one-day interval and increments lapses exactly once. The EF floor is 1.3. Consecutive Incorrect results are EF 2.18, 1.86, 1.54, 1.3 and 1.3, with increasing lapse counts.

No executing code retains EF on Incorrect. The older audit's EF-retention proposal is historical and explicitly superseded by D11A. There is no same-session requeue, second interval, remedial learning state or persistence call in the pure engine.

## 9. Post-Lapse Behavior

**PASS under the normal arithmetic context.** From repetition 0, EF 2.18, interval 1, lapses 1, subsequent Correct responses produce `(rep1, day1)`, `(rep2, day6)`, then `(rep3, day14)`. The last is ceiling of 13.08. EF and lapse count remain 2.18 and 1. The EF-floor sequence also yields the expected ceiling of `6 * 1.3` to eight days.

## 10. Interval Cap / Due

**PASS under the normal arithmetic context.** The literal saturation sequence is `1,6,15,38,95,238,595,1488,3720,9300,23250,36500,36500`. The transition above 23250 is capped after multiplication/ceiling, and later Correct answers retain 36500 while repetitions continue. Maximum seconds are exactly 3153600000, with Python integer arithmetic.

Due equals the current normalized interaction instant plus `interval_days * 86400` seconds. It is not anchored to prior due, prior interaction, current clock or receipt time. Microseconds and non-midnight instants are retained. The offset-input test uses elapsed seconds and produces the expected UTC instant; it does not perform local-calendar arithmetic.

For an unrepresentable UTC due sum, the fallback candidate is passed solely to the existing result validator, whose own addition catches overflow and raises `ValidationError` with `due_anchor`. No substituted candidate can be returned through the current validator. The supplied max-date test confirms rejection. This does not fix the separate D11B extreme-offset/stored-predecessor issues.

## 11. State Output

**PASS.** The envelope contains exactly `schema_version`, `scheduler_type`, `algorithm_version`, `config_version`, and `memory`. Memory contains exactly `repetition_count`, `ease_factor`, `interval_days`, and `lapse_count`. No due, last_review, timestamp, learner metadata, excluded feature or debug field is added.

The engine constructs new `Sm2Memory` and `ConventionalState` objects and validates the result with the existing D11B helper. Output identity, interval seconds/days, memory interval and due anchor are checked. All normal-context oracle outputs passed the existing decoder, including after serialization.

## 12. Decimal / JSON Round Trip

**PASS for the locked reachable EF values.** Internal EF remains Decimal. The existing shared `json_ease()` serializer converts it to binary64 only for numeric JSON transport. The five reachable EF values 2.5, 2.18, 1.86, 1.54 and 1.3 serialize to JSON numbers. Decoding via the existing `Decimal(str(value))` boundary reconstructs their exact required decimal values; binary64 is not accumulated into transition arithmetic.

The tests cover Pydantic serialization, JSON parsing, shared state decoding, FastAPI `jsonable_encoder`, PostgreSQL JSON parsing and driver return, then equal subsequent scheduling. The independent 574-case probe additionally used `ConventionalState.model_validate_json()` and compared complete state equality. No precision drift capable of altering a future ceiling was found.

Coverage limit N-01: the PostgreSQL checks use `SELECT CAST(:state AS JSON)`, not an INSERT followed by a stored-row SELECT. They exercise server JSON parsing/driver reconstruction without creating research evidence. Actual ORM research persistence remains a future integration test requirement, not an implemented D11C capability.

## 13. Validation Boundaries

**PASS, apart from ambient arithmetic context C-01.** The shared models reject unsupported scheduler/type/algorithm/config/schema identity, extra fields, malformed memory, bool/negative counters, nonfinite/out-of-range EF, out-of-range days and unreachable repetition/lapse/interval combinations. The engine explicitly rejects enhanced-state predecessors and raw dictionary method inputs, and revalidation detects the deliberately invalid model-copy test.

Some rejection cases are enforced before `schedule()` is invoked, as intended by the validated input boundary; the new tests do not need to duplicate D11B's complete validator matrix. Existing research-contract tests include negative counters and unknown/extra fields. No weaker replacement decoder or alternate development-state conversion was added.

## 14. Immutability / Purity

**Immutability PASS; complete purity/determinism BLOCKED by C-01.** Frozen envelopes/memory and new result construction preserve the predecessor. Tests compare the full input dump before/after, distinct nested object identities, repeated outputs and an interleaved unrelated call. The independent oracle also compared predecessors across transitions. Shallow model-copy bypasses are revalidated.

Source inspection found no database/session/settings, current clock, network, filesystem, random or secrets access in the engine or its called pure helpers. The stateless instance has no per-call mutable memory, and the configuration snapshot is recursively frozen. The existing purity test guards several external-call surfaces, but the actual remaining hidden input is the caller's Decimal context.

State validation retains its bounded saturation loop. Scheduling performs one transition and does not replay historical repetitions. Large-counter work is bounded in the number of transitions; ordinary big-integer cost still depends on the digits in the input, as expected. No new counter-proportional unbounded loop was added.

## 15. Configuration Binding

**PASS.** The pinned digest and exact registered document bind the parsed configuration to D11A. Ratings, initial memory, floor, first intervals, counters/resets, bounds and day length derive from the parsed document. Recursive MappingProxyType/tuple freezing was checked directly: top-level and nested assignment attempts raised TypeError without changing data. The original seed dictionaries cannot alter the initialized snapshot.

Formula coefficients and the fixed quality-distance reference remain literal in code, matching the pinned formula. For the supported binary q4/q2 domain, literal EF/interval vectors expose a changed effective delta or ceiling behavior. The digest test also catches a changed document. No silent alternate configuration, constructor override, mutable alias/default or condition-selection mechanism was found.

## 16. Research-Routing Closure

**PASS: CLOSED.** Production searches show no `BinarySm2Scheduler` reference outside its definition in `sm2.py`. `record_review_attempt()` still resolves explicit development authority and validates `development/dev-0.1` output. `sync_review_events()` calls that same service. The resolver rejects any owner allocation without filtering mode, so both test and formal enrollment remain closed for new work; unsupported environments also fail closed.

The D11C routing tests invoke the actual engine first, then real shared online/sync service calls with an allocated fixture owner. They assert 503 `D11_ROUTING_DISABLED` and zero chain counts. The resolver is not mocked. Existing D11B acceptance tests independently prove accepted historical replay occurs before authority/state/time/scheduler checks and creates no new chain. No client selection field or automatic discovery activates the engine.

## 17. Test Quality

The tests provide literal expected values for all twelve required vectors, the 36500/3153600000 cap, full ceiling/saturation progression, EF floor, immutable state, deterministic interleaving, incompatible state and excluded-field rejection. Their key expected values are not calculated by the engine/config helper under test. Explicit 38-day fourth Correct catches truncating 37.5.

The Decimal context test at `test_sm2.py:187` is incomplete: it varies precision and rounding while leaving exponent limits unchanged. It therefore passes while C-01 remains reproducible. Add a regression with a normally validated input constructed before narrowing the caller exponent range. The missing case belongs to the same blocking defect; it is not counted as a separate finding.

The external-call test and structural inspection support the absence of I/O. It is not an exhaustive sandbox for arbitrary future imports or direct environment indexing; that is a limit on test proof, not evidence of an actual hidden I/O path in the reviewed code. N-01 records the separate PostgreSQL cast-versus-storage scope.

## 18. Regression Results

| Check | Fresh observed result |
| --- | --- |
| D11C pure tests | **50 passed, 2 warnings in 0.16s** |
| Existing research-contract tests | **47 passed, 2 warnings in 10.94s** |
| D11C routing/JSON tests | **7 passed, 2 warnings in 4.44s** |
| D11B acceptance tests | **23 passed, 2 warnings in 11.57s** |
| Full backend suite | **325 passed, 2 warnings in 85.60s (0:01:25)**; exit 0 |
| Ruff `app tests scripts` | **All checks passed!** |
| In-memory static Python compilation | **94 files PASS**, app/tests/scripts/alembic |
| Independent rational/state/JSON oracle | **574 transitions PASS** under the default Decimal context |
| Caller-context reproduction | **C-01 confirmed:** default 15 days; `Emax=0` raises Overflow at engine line 102; restored context returns 15 days |
| Frozen document/digest and recursive immutability probe | PASS |
| `git diff --check` | **PASS** at baseline and finalization |

Pure tests ran without their parent database setup/reset fixtures. Database-backed runs used the inspected external `_test`-guarded wrapper and private schema `d11b_21ec17a1c5` in `fluentt_test`. The production/D10 database was not used. Pytest used `-q -p no:cacheprovider --tb=short`; Python used `-B`; Ruff used `--no-cache`. Static compilation used in-memory `compile()`, writing no bytecode.

The two warnings are existing Starlette/httpx TestClient and AnyIO BlockingPortal deprecations. No implementation or test was changed to make verification pass. Green supplied tests do not override the independently reproduced C-01 failure. The ad hoc reproduction is recorded in this report and was not added to the test tree, per the read-only instruction.

## 19. Findings

### C-01 — CRITICAL: ambient Decimal exponent limits change the outcome of a valid pure input

- **File/symbol:** `backend/app/scheduling/sm2.py:67`, `BinarySm2Scheduler.schedule()`; failure manifests in the interval product at line 102. Related coverage: `backend/tests/scheduling/test_sm2.py:187`, `test_arithmetic_is_independent_of_callers_decimal_context()`.
- **Triggering input:** normally validated conventional predecessor `{repetition_count: 2, ease_factor: Decimal('2.5'), interval_days: 6, lapse_count: 0}`; Correct answer; ordinary aware UTC interaction `2026-10-17T11:23:45Z` and prior interaction one day earlier. Construct the validated input under the normal context, then call the engine inside `decimal.localcontext()` with `Emax = 0`.
- **Expected:** the identical explicit four-field input returns repetition 3, EF 2.5, interval 15, lapses 0, seconds 1296000 and due `2026-11-01T11:23:45Z`, independent of caller numeric context.
- **Actual:** normal context returns 15 days. Narrowed context raises raw `decimal.Overflow` at `Decimal(previous_days) * ease`; restoring the caller context makes the unchanged input return 15 days again. The engine-style nested context was inspected and showed `prec=28, Emax=0`. The predecessor was unchanged throughout.
- **Root cause:** `localcontext(prec=28)` copies the current context and overrides only precision. It inherits exponent bounds and other settings. Precision isolation does not isolate the complete numeric environment. The input itself and the locked configuration do not provide this additional mathematical dependency.
- **Why it matters/severity:** the brief explicitly classifies nondeterminism as CRITICAL. A valid pure input has context-dependent success/failure, violating the four-field deterministic engine contract and the unconditional foundation claim. The limitation is not the deferred UTC issue: these are ordinary dates and a small ordinary interval. No corrupt returned schedule or connected research acceptance was observed; routing closure limits current application impact but does not satisfy the pure-engine requirement.
- **Recommended fix scope:** in a separately authorized D11C correction, give both contract checks and transition/result arithmetic a complete explicit engine-owned Decimal Context with adequate precision/exponent range and deliberate rounding/trap policy; preserve/restore caller context. Add regressions varying exponent bounds and relevant trap settings after validated input construction, alongside the existing precision/rounding case. Re-run focused/full verification and independent review. Do not change the mathematical formula, configuration identity, routing or D11B deferred issues.
- **Disposition:** blocks D11C closure. No fix was applied in this review.

Minimal read-only reproduction of the existing defect:

```python
from datetime import UTC, datetime
from decimal import Decimal, localcontext
from app.scheduling.research_contracts import ConventionalState, ResearchSchedulerInput
from app.scheduling.sm2 import BinarySm2Scheduler

prior = ConventionalState(
    schema_version=1, scheduler_type="conventional_srs",
    algorithm_version="sm2-binary-v1", config_version="sm2-binary-config-v1",
    memory={"repetition_count": 2, "ease_factor": Decimal("2.5"),
            "interval_days": 6, "lapse_count": 0},
)
value = ResearchSchedulerInput(
    correct=True, interaction_at_utc=datetime(2026, 10, 17, 11, 23, 45, tzinfo=UTC),
    prior_state=prior,
    prior_interaction_at_utc=datetime(2026, 10, 16, 11, 23, 45, tzinfo=UTC),
)
engine = BinarySm2Scheduler()
assert engine.schedule(value).interval_days == 15
with localcontext() as caller:
    caller.Emax = 0
    engine.schedule(value)  # decimal.Overflow at sm2.py:102
```

### N-01 — NOTE: PostgreSQL round-trip tests parse JSON without storing a row

- **File/symbol:** `backend/tests/reviews/test_d11c_routing.py:59`, `test_fastapi_postgresql_json_round_trip_preserves_sm2_memory_without_writes()`, SQL expression at line 81.
- **Observed scope:** the real server/driver round trip is `SELECT CAST(:state AS JSON)`. It verifies numeric EF parsing/reconstruction, but it does not exercise an ORM INSERT, actual stored-row read or the future research persistence integration.
- **Why it matters/recommended scope:** describe this evidence as server JSON/driver compatibility, as the implementation report does, and add actual persisted-chain round trips when research acceptance integration is authorized. This is not a pure-engine algorithm defect and does not independently block D11C. Do not activate routing or create real research evidence merely to extend this review.

## 20. Deferred D11B Issues

All three prior gates remain documented in the implementation and D11B independent reports, with no false resolution claim:

- **M-01:** extreme research UTC normalization/stored-predecessor due overflow. **SAFE TO DEFER UNTIL BEFORE RESEARCH ACCEPTANCE INTEGRATION**; affected research acceptance helpers remain disconnected.
- **M-02:** global trigger-count test isolation. Deferred under the dedicated schema layout; fix before shared multi-schema/parallel database execution.
- **M-03:** unchanged development extreme due overflow. No fix or changed development time semantics is claimed.

C-01 is a distinct D11C numeric-context defect and is not covered by those deferrals.

## 21. Git Status

Branch `main`; HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; no staged changes, commit or push. The existing tracked D11B diff remains eight files, 237 insertions and 193 deletions. Existing untracked D11B and D11C implementation/evidence files remain present. This review creates only:

```text
?? docs/development/d11c-independent-code-review.md
```

The final SHA-256 comparison found zero changed or missing files among all 247 pre-existing tracked/untracked files. This report is the sole added path, and remains untracked. Branch, HEAD and empty staged-change list match the review baseline. The implementation report, source, tests, migrations and all earlier evidence/specifications remain byte-identical. Final `git diff --check` passed.

## 22. Recommendation

Do not close D11C or approve its unconditional deterministic-engine claim until C-01 is corrected and independently re-reviewed. Keep research acceptance CLOSED throughout. The ordinary-context algorithm vectors and JSON state transport can be retained; the correction should isolate arithmetic context without changing the locked research method. No finding was fixed during this read-only review.

**D11C CODE REVIEW BLOCKED — caller Decimal exponent limits still affect valid scheduler execution**
