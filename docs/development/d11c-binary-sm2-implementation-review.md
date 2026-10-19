# D11C Binary SM-2 Implementation Review

Date: 2026-10-17 (Asia/Manila). Repository: `F:\FLUENTT`.

## 1. Status

**D11C READY FOR CODE REVIEW**

Implementation, focused verification and the full backend regression suite pass. All 243 pre-existing tracked/untracked files retain their captured baseline hashes; only the four intended new D11C files were added.

This milestone adds the pure **Binary SM-2 adaptation**. It does not activate online/sync research acceptance. No FSRS engine/dependency, research provisioning, randomization, migration, mobile, pronunciation or manuscript change is included.

## 2. Baseline

Verified branch `main`, HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`, and no staged changes. The intentionally uncommitted reviewed D11B implementation was present. Initial `git diff --check` passed, with only the existing Git LF/CRLF advisories on two D11B files.

SHA-256 was captured for all **243 pre-existing tracked/untracked files** before editing. This includes every existing development evidence/specification document, the D10 review bundle, D11/D11A/D11B reports and specification, and P01/P02/P02F documents. Those files are protected from this milestone's edits. The authoritative D11A vectors and D11B contracts/configuration were inspected before writing the engine. No contract contradiction or serialization stop condition was found.

## 3. Files Changed

Only these four new files belong to D11C; all remain untracked:

| File | Purpose |
| --- | --- |
| `backend/app/scheduling/sm2.py` | Pure `BinarySm2Scheduler` and frozen configuration snapshot |
| `backend/tests/scheduling/test_sm2.py` | 50 pure calculation, validation, serialization and purity cases |
| `backend/tests/reviews/test_d11c_routing.py` | 2 routing-closure cases and 5 PostgreSQL JSON round-trip cases |
| `docs/development/d11c-binary-sm2-implementation-review.md` | This implementation review |

No pre-existing file was intentionally edited. In particular, `research_contracts.py`, `config_v1.py`, `DevelopmentScheduler`, review acceptance/resolution, historical migrations, fixtures and prior reports retain their baseline contents. No export/registry entry was needed: callers must explicitly import the pure engine.

## 4. Engine Contract

`BinarySm2Scheduler.schedule(inputs: ResearchSchedulerInput) -> ResearchSchedulerResult` reuses the D11B four-field input, `ConventionalState`, `Sm2Memory`, identity validation and `validate_research_result()`.

Only a `ResearchSchedulerInput` instance is accepted by the engine; an arbitrary dictionary raises TypeError. The input is revalidated from its dumped data, including values supplied through Pydantic copy/construct bypasses. A predecessor is additionally validated as `ConventionalState`; a valid enhanced state is not a valid predecessor for this engine. First review requires both predecessor fields absent; later input requires both present, as enforced by the shared contract.

Chronology, assignment, owner, provenance and acceptance authorization remain service responsibilities. The pure calculation does not decide whether work can be accepted and does not invoke the disconnected research chronology/predecessor helpers.

## 5. Binary Mapping

Correct maps to q4; Incorrect maps to q2, using the frozen configuration's binary ratings. There are no Hard/Easy grades or response-time/pronunciation transformations. The input boundary rejects response duration, interruption evidence, instructional difficulty, pronunciation, transport/receipt timing, participant identity and client condition fields.

## 6. Exact Arithmetic

Every answer updates EF using:

```text
EF_new = max(1.3, EF_old + 0.1 - (5-q) * (0.08 + (5-q) * 0.02))
```

All fractional operands are constructed as Decimal strings. q4 contributes exactly zero; q2 contributes exactly -0.32. A local 28-digit Decimal context encloses shared contract checks and calculation, isolating them from the caller's numeric precision. All valid EF and bounded interval products fit exactly within that precision; ceiling is explicit `ROUND_CEILING`. No binary float participates in scheduler arithmetic.

The test suite sets the caller's precision to 2 with ROUND_DOWN and confirms the same result, with caller context/flags preserved. Large counters use integer operations; reachability validation terminates at the interval cap. A `10**1000` repetition/lapse case completes without a loop proportional to the supplied counter.

The formula's coefficients implement the pinned formula literal. Ratings, initial memory, EF floor, first intervals, reset/increment rules, interval bounds and day length are derived from the reviewed configuration document. Exact vectors and digest tests bind the implementation to that document.

## 7. Correct Transition

After updating EF, previous repetition 0 produces interval 1; previous repetition 1 produces interval 6; later repetitions produce `ceil(previous_interval_days * EF_new)`. Repetitions increment once and lapses remain unchanged. The interval is bounded only after the transition calculation.

The first four Correct intervals are **1, 6, 15, 38 days**, all with EF 2.5 and zero lapses. The fourth result proves ceiling of 37.5 rather than truncation or rounding-to-nearest.

## 8. Incorrect Transition

Incorrect updates EF first, sets repetitions to zero and interval to 1, and increments lapses once. Consecutive Incorrect EF values are **2.18, 1.86, 1.54, 1.3, 1.3**. The floor applies after calculation. A lapse from a capped prior state returns a single one-day result and resets repetitions correctly.

The pure engine returns one result. It inserts no learning queue, remedial repetition or second schedule and performs no persistence.

## 9. Post-Lapse Behavior

After the first lapse, EF remains 2.18 across Correct answers and the lapse count remains 1. Correct results resume at repetitions 1, 2, 3 with intervals **1, 6, 14 days**, including exact ceiling of 13.08.

After repeated lapses reach EF 1.3, three subsequent Correct answers produce interval 8 (`ceil(6 * 1.3)`), while retaining the lapse count. Tests cover both post-lapse progression and floor behavior.

## 10. Interval / Due Contract

`interval_seconds = interval_days * 86400`. Due is anchored exactly to the input's normalized UTC interaction instant plus those elapsed seconds. No current time, receipt time, local midnight, calendar-day boundary or transport instant enters the calculation. Non-midnight microseconds are preserved. An offset input around a calendar/DST boundary is normalized by the existing input contract and produces the expected UTC elapsed-time result.

The maximum is **36500 days / 3153600000 seconds**. Consecutive Correct answers reach the cap and remain there while counters continue incrementing. Each accepted result is checked through `validate_research_result()`.

For a UTC instant whose due sum is unrepresentable, the engine uses the existing result validator's `due_anchor` rejection behavior. The overflow handler supplies a representable candidate only to that validator; its existing overflow check necessarily rejects it. No candidate timestamp is returned, persisted, clamped or substituted as a valid due. A regression asserts a Pydantic ValidationError of type `due_anchor` at UTC `datetime.max`.

This does not fix the separate D11B extreme-offset normalization or stored-predecessor overflow defects.

## 11. State Envelope

Every result contains the exact application-owned five-key envelope:

```text
schema_version: 1
scheduler_type: conventional_srs
algorithm_version: sm2-binary-v1
config_version: sm2-binary-config-v1
memory: repetition_count, ease_factor, interval_days, lapse_count
```

The transient initial memory exists only as local scalar values and is immediately advanced by the captured answer. No zero-interval transient state is returned. No due/last_review, learner identity, response-time/difficulty/pronunciation feature, provider state or debug metadata is added to memory.

Shared validators reject unsupported identity/version, malformed or unreachable SM-2 memory, bool counters, out-of-bound EF/intervals, and incompatible enhanced/development state. Input revalidation also rejects a deliberately corrupted frozen-model copy.

## 12. Purity / Immutability

The class is stateless (`__slots__ = ()`). Identical inputs produce identical results, including after an intervening unrelated call. Each result owns a new envelope/memory. The original input and predecessor dumps remain unchanged, and frozen-memory mutation is rejected.

The engine imports no database/session, environment/settings, network, clock or random provider. Configuration is read from the reviewed Python literal at module load, verified, detached and recursively frozen. Scheduling consults that snapshot only. Tests forbid clock, environment helper, network, database connection and random calls while executing the real engine, and verify its observable result. Source self-audit also found no clock/environment/database/network access or float arithmetic.

The 50 pure tests override only the parent database setup/reset fixtures within their own test module. They run successfully without a PostgreSQL connection. PostgreSQL-dependent closure/JSON checks are in the separate review test module and use the reviewed isolated test harness.

## 13. Exact Test Vectors

All twelve required literal vectors pass:

| Vector | Answer/history | Repetitions | EF | Days | Lapses |
| --- | --- | --- | --- | --- | --- |
| 1 | First Correct | 1 | 2.5 | 1 | 0 |
| 2 | Second Correct | 2 | 2.5 | 6 | 0 |
| 3 | Third Correct | 3 | 2.5 | 15 | 0 |
| 4 | Fourth Correct | 4 | 2.5 | 38 | 0 |
| 5 | First Incorrect | 0 | 2.18 | 1 | 1 |
| 6 | Second Incorrect | 0 | 1.86 | 1 | 2 |
| 7 | Third Incorrect | 0 | 1.54 | 1 | 3 |
| 8 | Fourth Incorrect | 0 | 1.3 | 1 | 4 |
| 9 | Further Incorrect | 0 | 1.3 | 1 | 5 |
| 10 | Correct after first lapse | 1 | 2.18 | 1 | 1 |
| 11 | Second Correct after lapse | 2 | 2.18 | 6 | 1 |
| 12 | Third Correct after lapse | 3 | 2.18 | 14 | 1 |

Tests use literal expected states, not an expected result calculated by the engine or its helpers. Sequential history uses distinct later interaction instants. Tests also assert whole-day seconds and the exact interaction-anchored due.

## 14. Boundary Tests

Coverage includes exact ceiling, full saturation sequence `1,6,15,38,95,238,595,1488,3720,9300,23250,36500,36500`, a lapse after the cap, EF floor, enormous counters, immutable copies, repeated/interleaved calls, non-midnight offset UTC anchors, due overflow rejection, shared validation interaction, forbidden extra features, and numeric JSON reconstruction.

EF stays Decimal internally. The existing D11B serializer emits EF as a JSON number; no new serialization schema was introduced. All five reachable EF values round-trip through Pydantic JSON and shared decoding, preserving exact Decimal memory and the next transition.

Five additional tests pass the actual state through FastAPI's `jsonable_encoder`, standard JSON serialization, PostgreSQL `SELECT CAST(:state AS JSON)`, driver decoding and D11B state validation. They assert numeric EF, exact Decimal equality and identical subsequent scheduling. These checks perform no research-evidence inserts; the accepted-chain counts remain zero.

## 15. Configuration Binding

The engine selects only `sm2-binary-config-v1` from `config_v1.CONFIGURATIONS`, verifies its literal SHA-256 against the pinned digest and the seed record, and validates document/record identity through `ResearchSchedulerIdentity`. A mismatched document or identity fails module initialization.

Pinned digest:

```text
3bd486d1183d84a869a2470f0a97a13ecabc44365eb9fe8e158014fd1ef2a0d9
```

The parsed document becomes recursively immutable mappings/tuples. There is no constructor configuration override or research-condition selector. A test temporarily changes the in-memory seed dictionary after engine initialization and verifies the already bound engine remains deterministic; the test restores that temporary change and never edits the seed file. Identity, starting EF, floor and cap behavior are checked against the frozen document, alongside the literal algorithm vectors.

## 16. Research Routing Closure

**CLOSED.** No acceptance/resolver/router/sync source or registry was edited. The sole connected scheduler construction remains the D11B explicit development resolver. `BinarySm2Scheduler` is available only through explicit import and pure invocation.

Two new integration cases first execute the real pure SM-2 engine, then submit new allocated-owner work through the online shared service and sync service. Both return **503 `D11_ROUTING_DISABLED`**, with zero accepted attempts, schedules, ledgers, pointers or canonical research events. The existing D11B replay/routing/concurrency tests also pass with the engine present, preserving original accepted replay before new-work authority checks.

Any allocation graph used by tests is explicitly isolated fixture data in `fluentt_test`; this milestone provisions no formal cohort or application-facing research content.

## 17. Regression Results

| Check | Observed result |
| --- | --- |
| Initial pure-engine red run | 50 expected failures: engine module absent |
| Initial routing red run | 2 expected failures: engine module absent |
| New pure-engine focused run | **50 passed, 2 warnings in 0.12s**; no database fixture needed |
| Existing research-contract focused run | **47 passed, 2 warnings in 10.89s** |
| D11C routing/JSON plus D11B acceptance focused run | **30 passed, 2 warnings in 9.16s** (7 new + 23 existing) |
| Full backend suite | **325 passed, 2 warnings in 101.69s (0:01:41)**; exit 0 |
| Ruff `app tests scripts` | **All checks passed!** |
| Formatting, the three new Python files | **3 files already formatted** |
| Static Python compilation | **94 files PASS**, in memory, covering app/tests/scripts/alembic |
| `git diff --check` | **PASS**; final report structure/whitespace also checked |

Focused verification order followed the brief: new pure tests, existing research contracts, then closed-routing/acceptance checks, followed by the full suite. Database-backed runs use `C:\Users\user\AppData\Local\Temp\fluentt-d11b-run.py`, which enforces a `_test` database and private schema search_path. The observed target is `fluentt_test`, schema `d11b_21ec17a1c5`. No production/D10 database was used.

Pytest used `-q -p no:cacheprovider --tb=short`; Python used `-B` and Ruff used `--no-cache`. The two existing warnings are Starlette/httpx TestClient and AnyIO BlockingPortal deprecations. The first lint check found one import-separation issue in a new test; it was corrected and the final lint/format checks pass. No pre-existing test or source was modified to obtain green results.

Self-audit reviewed the new source against float arithmetic, acceptance wiring, development changes, hidden time/environment reads, mutable method configuration, excluded features, remedial schedules, interval boundaries and predecessor mutation. No unexpected coupling was found.

## 18. Known Deferred Issues

The independent D11B review gates remain unchanged:

- **M-01:** extreme research UTC normalization and predecessor due overflow. **SAFE TO DEFER UNTIL BEFORE RESEARCH ACCEPTANCE INTEGRATION**. D11C does not connect the affected acceptance helpers. The pure engine's due-overflow rejection is not a claim that M-01 is fixed.
- **M-02:** database-wide D9 trigger-count assertion. Deferred under the current dedicated schema test layout; fix before shared multi-schema/parallel database verification.
- **M-03:** pre-existing development extreme due overflow. `DevelopmentScheduler` remains unchanged; no resolution is claimed.

No formal clock tolerance, enrollment policy, FSRS transition or research acceptance integration was introduced to bypass these gates.

## 19. Git Status

Branch remains `main`; HEAD remains `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`. Nothing is staged, committed or pushed. The D11B tracked diff remains the original eight files, 237 insertions and 193 deletions. Its existing untracked implementation and all prior documents remain present.

D11C adds only:

```text
?? backend/app/scheduling/sm2.py
?? backend/tests/reviews/test_d11c_routing.py
?? backend/tests/scheduling/test_sm2.py
?? docs/development/d11c-binary-sm2-implementation-review.md
```

Git's normal short status may group the new test file as `?? backend/tests/scheduling/`; the file list above expands that directory. The final SHA-256 comparison found zero changed or missing files among the 243 pre-existing tracked/untracked files. The four listed additions are the only changes attributable to D11C. All existing development evidence/specification documents, including the D11B independent report, remain byte-identical.

## 20. Recommendation

Review the pure engine and its deterministic fixtures independently before any later integration. Research routing remains CLOSED. Preserve the M-01/M-02/M-03 gates; this milestone does not authorize research acceptance, formal enrollment or FSRS implementation. No commit or push was made.

**D11C READY FOR CODE REVIEW**
