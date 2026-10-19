# D11E Independent Research Acceptance Integration Review

## 1. Verdict

**D11E CODE REVIEW BLOCKED — nested scheduler result validation permits invalid memory to be committed.**

Reviewed on 2026-10-18. New findings: **0 CRITICAL, 1 IMPORTANT (I-01), 0 MINOR**. The required checked-in suites pass, including all 493 backend tests. Independent adversarial probes produce **65 passes and 2 failing rejection assertions**: both research conditions accept invalid nested memory and persist a complete immutable chain. Passing normal engine tests does not satisfy D11A's complete pre-insert result-validation requirement.

Test-only routing, formal closure, server assignment, normal engine outputs, replay, serialization and transaction rollback are independently verified below. This verdict does not authorize formal/live collection or any later implementation milestone.

## 2. Scope

Branch `main`; HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; index empty at start. The existing dirty worktree contains prior D10/D11/P01/P02 artifacts and remains intact.

Inspected actual production acceptance/service, request/response and sync code; all six authority tables, constraints and PostgreSQL guards; provenance/persistence; both pure engines and shared contracts; all 25 D11E cases; related fixtures/regressions; D11A and the authoritative D11B, D11C-F1, D11D and T1-F1 review evidence. Untracked implementation files were read directly.

D11E uses the D11B migration/schema. No additional D11E migration or mobile selector is present. The existing dependency/lock delta from HEAD belongs to the already-reviewed pinned FSRS foundation; D11E adds no imports requiring another dependency. The engine, research contract, development engine and golden hashes agree with the prior T1-F1 review. Existing frozen configuration definitions and their locked digests agree with D11A/D11B/D11D.

Review-start hashes were captured for **264 pre-existing tracked/untracked non-ignored files**. Relevant entries:

| File | Review-start SHA-256 |
| --- | --- |
| `backend/app/reviews/acceptance.py` | `9d67f292d9a7187afff1e3ff0790c6e7ec58c24d9b8db572d3223b9e80eb1680` |
| `backend/app/reviews/service.py` | `4b3ad5f9360f67ea8847c8b2f0eefe4508a4a13d39eb4b6644345e7dbf491514` |
| `backend/tests/reviews/test_d11e_acceptance.py` | `833afba0c95b7490edc913aa08c10b542547bc14317bc22fb74f4be6c7274e84` |
| `backend/app/research_authority/schema_v1.py` | `935bd723c615fa2151fb2a4005e7551235c2032810249ac6734a4a1b9ae2936c` |
| `backend/app/research_authority/integrity_v1.py` | `151124513409f2f2868d0a90aa9d5c5cf2e1fce0256aa486ff06b063002cb305` |
| `backend/app/research_authority/config_v1.py` | `b3af792ef3bc623ea4f2575d963574df094f08b45156653972e0d36e02f1a670` |
| `backend/app/scheduling/research_contracts.py` | `a23adf8856e9f4d10950dcbd409bb9800a384fb0019567e9986c607d3b97b781` |
| `backend/app/scheduling/sm2.py` | `02491e6e347e9fa3cf4c01dad17899b998475e453bd89b414269a3b10ceed48d` |
| `backend/app/scheduling/fsrs6.py` | `ae55c25605ed748e8341d69f00a484921988db921477e58f82b12b3920272f52` |
| `backend/app/scheduling/development.py` | `6a175fe574e33f8409a8e2b9952f5acfefe98dcbeae4f892e4feda63cfa9ca0c` |
| `backend/tests/scheduling/fixtures/fsrs6_6_3_2_goldens.json` | `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6` |
| `backend/pyproject.toml` | `1052e4282cb0bb8a0161e91997c53ff900385d0f8a1634378c9a6b40ea2a8006` |
| `backend/uv.lock` | `19142dde9e25413c7ad7de31071173b5088984c09acb475cc0c3b31ac7a55eca` |
| `docs/development/d11a-scheduler-contracts-spec.md` | `5e4f3869fde26b4cc2fda7ab3a097c1005e4cfef89695f2b8c8413550907e1b9` |

Only the new requested review report is created in the repository. Temporary independent probes reside outside it at `C:\Users\user\AppData\Local\Temp\test_fluentt_d11er_probes.py`; no checked-in test, fixture or prior report was edited. All database runs used the reviewed guarded wrapper and `fluentt_test` / private schema `d11b_21ec17a1c5`, sequentially. No D10 database, app, SQLite or learner credentials were accessed.

## 3. Authority Model

**PASS.** D11E reuses `ResearchProtocol`, `ResearchSet`, `ResearchSetMembership`, `ParticipantAllocation`, `ParticipantSetCondition` and `SchedulerConfiguration`. Protocol mode is database-constrained to test/formal; sets to A/B; group to 1/2. Composite foreign keys bind protocol/version, set, owner/allocation, configuration identity/digest, and accepted attempt assignment/type/version.

Configuration documents have database SHA-256 and supported-identity checks. Insert guards enforce exact released revision membership, exact period-order set identities, condition/config mapping and attempt/content membership. Frozen authority UPDATE/DELETE and TRUNCATE guards remain installed; D9 evidence immutability remains present.

As the D11B review already limits, immutable rows alone are not a complete enrollment/provisioning authority: INSERT scaffolding and aggregate-completeness questions remain formal activation work. D11E explicitly verifies completeness on resolution and keeps formal closed; it does not claim to close that provisioning gate.

## 4. Research Routing Gate

**PASS.** Production engine searches find construction only in `acceptance.resolve_research_engine`, after assignment resolution in shared acceptance. No alternate endpoint or sync dispatch activates an engine.

| Owner authority | New-work outcome |
| --- | --- |
| No research allocation, explicit development/testing environment | Existing development/dev-0.1 path |
| Complete frozen test allocation + exact APP_ENV=testing + explicit supported policy | Assigned research engine |
| Missing/inconsistent test mapping, membership or config | Fail closed; no dev fallback |
| Missing/unknown test clock policy | 503 D11_CLOCK_POLICY_UNAVAILABLE |
| Any formal allocation, including alongside other allocations | 503 D11_ROUTING_DISABLED |
| Nonexact testing environment | 503 D11_ROUTING_DISABLED |
| Unknown protocol mode | DB CHECK rejects storage; resolver also rejects every mode other than test |

Independent direct acceptance probes rejected `development`, `production`, `Testing`, `test` and the empty string. Settings default to development, not testing. No truthy parsing or alternative enable flag exists.

## 5. Test Clock Policy

**PASS, TEST ONLY.** D11A section 10 expressly permits controlled non-formal fixture policies; D11B already stores a clock-policy reference. D11E recognizes only `test-no-future-v1` after the exact testing/test gate.

One aware backend instant is captured per new acceptance. The exact rule is `interaction_at <= backend_now`, without positive tolerance. Independent probes for both engines accepted equality, rejected **one microsecond** in the future with 422 D11_FUTURE_INTERACTION, and counted one clock capture. Stored interaction/due retained the original anchor.

Missing and unknown policy references both independently returned 503 D11_CLOCK_POLICY_UNAVAILABLE with zero evidence. Approval/protocol-freeze/allocation-freeze times are validated in UTC; incoming work before any freeze is rejected. Formal numeric skew tolerance remains deferred and cannot be enabled by this test policy.

## 6. Transaction Ordering

**PASS for execution order; result-validation completeness FAILS under I-01.** Actual order is:

1. Owner/event accepted replay.
2. Exact immutable content and owner/session preflight.
3. End preflight reads; begin explicit READ COMMITTED transaction.
4. Real learner row FOR UPDATE.
5. Second fresh accepted replay.
6. Resolve server research assignment/configuration.
7. Fresh current pointer, schedule, linked attempt/ledger and history-integrity read.
8. Revalidate session, prohibit new same-session/item work, validate predecessor and chronology/freeze/clock.
9. Exact adapter selection and one calculation.
10. Call result validator and compare assignment identity.
11. Stage attempt, schedule, accepted ledger; flush ledger uniqueness.
12. Advance pointer; append canonical event pair; commit.

No scheduler call precedes the lock or post-lock replay. Fresh reads use populate_existing. The existing session-creation commit is confined to preflight and may survive a rejected attempt, as D11A explicitly permits; it is not accepted evidence. No acceptance helper commits under the lock.

## 7. Replay / Idempotency

**PASS.** Both replay checks scope owner plus original client_event_id and return the original linked attempt/schedule, not the current schedule. Replay does not decode/recalculate a later state.

Checked-in tests make assignment/engine resolution forbidden during replay and change current request provenance/time; original accepted output still returns. Independent tests accepted via sync, advanced the predecessor, disabled routing through APP_ENV=production, then replayed through online and sync. Whole evidence-table count/hash snapshots remained unchanged for both conditions.

Independent same-UUID concurrency probes forced two sessions past initial preflight. PostgreSQL blocking was observed; the loser returned the winner after the post-lock replay without reading a predecessor or invoking another calculation. No duplicate evidence or pointer movement.

## 8. Assignment Resolution

**PASS.** The authenticated owner and exact protocol/version/release/item/revision membership choose one immutable condition. All owner allocations are considered; ambiguity is rejected. Both A/B sets and both conditions must exist, mapping group must be valid, and period order must contain precisely the two set IDs.

| Mapping group | Set A | Set B |
| --- | --- | --- |
| 1 | Enhanced | Conventional |
| 2 | Conventional | Enhanced |

Independent tests exercised all four combinations with Correct and Incorrect while period order was reversed. Malicious client condition/set/assignment/scheduler fields had no influence. No four-sequence design, allocation counts or formal period windows are invented.

Unassigned valid content fails before dispatch. Independent probes published another real release with the same revision, and another with a changed revision, for both groups; all returned 400 D11_ITEM_NOT_ASSIGNED without evidence. A temporary harness initially changed inherited word content_version accidentally; that assertion exposed a probe setup error. Pinning the original lesson version produced the intended same-revision control, after which all four cases passed. No repository file was changed to achieve this.

## 9. Scheduler Dispatch

**PASS.** Exact server tuples select the already-reviewed adapters:

- Conventional: `conventional_srs / sm2-binary-v1 / 1 / sm2-binary-config-v1`.
- Enhanced: `enhanced_srs / fluentt-esr-fsrs6-binary-v1 / 1 / fsrs6-binary-r90-config-v1`.

Resolver agreement includes condition identity, stored configuration identity, frozen digest and SHA-256 of canonical_document. Locked document digests are respectively `3bd486d1183d84a869a2470f0a97a13ecabc44365eb9fe8e158014fd1ef2a0d9` and `4e4c56a9f928cae5581e5d577de413b17c9d581185482db423a98551f6575e4f`.

Independent fault probes changed loaded configuration type, algorithm, digest or document without editing stored authority. Every case failed with D11_ASSIGNMENT_CONTRADICTION before engine resolution. Unknown dispatch identity returned 503 D11_ENGINE_UNAVAILABLE with both engine constructors forbidden. No alternate research/default/development engine is used after failure.

## 10. Conventional Integration

**PASS for valid engine outputs.** Real BinarySm2Scheduler, one call per accepted event, opposite engine construction forbidden:

- First Correct: repetitions 1, EF 2.5, interval 1 day, lapses 0.
- Second Correct: interval 6 days from the current stored predecessor.
- First Incorrect: repetitions 0, EF 2.18, interval 1 day, lapses 1.

Seconds and interaction-anchored due agree. Each accepted attempt references the server-selected condition. Real concurrent distinct events independently prove the 1-day to 6-day sequence. Existing decimal-context determinism and pure SM-2 regressions pass. I-01 concerns the acceptance validator's handling of a deliberately malformed returned object, not an observed incorrect ordinary SM-2 calculation.

## 11. Enhanced Integration

**PASS for valid engine outputs.** Real EnhancedFsrsScheduler, opposite engine forbidden:

- First Correct: Review/null, stability 2.3065, difficulty 2.118103970459016, 2 days.
- First Incorrect: Review/null, stability 0.212, difficulty 6.4133, 1 day.

All four group/set mappings execute the assigned engine exactly once. Subsequent reviewed reconstruction and pure FSRS/time-boundary tests pass. Installed pinned direct-library goldens reproduce in check-only mode; no fixture was regenerated. `review_duration=None` is explicit. I-01 independently demonstrates missing defense against malformed returned enhanced memory.

## 12. Predecessor Reconstruction

**PASS.** Current pointer, schedule and linked ReviewAttempt are reread after acquiring the learner lock. Stored state, prior interaction and prior due come from that same chain. Enhanced context gets server owner UUID/item UUID and current stored due; request-supplied predecessor state/due/card/identity fields do not enter the input.

Reviewed T1 helpers remain reused: incoming distinct-event interaction must be strictly greater than the current linked interaction; stale/equal is 409 D11_STALE_INTERACTION. Invalid stored state/time is D11_STATE_CORRUPT, and unsupported envelope identity is D11_STATE_IDENTITY_UNSUPPORTED. UTC normalization and due-addition representability corrections remain intact.

Independent complete predecessor fixtures tested both cross-condition directions. Both rejected with 500 D11_STATE_IDENTITY_UNSUPPORTED before scheduler resolution, with complete stored evidence snapshots unchanged. No cross-state coercion or first-review fallback occurred.

**Due acceptance policy:** record_review_attempt has no separate new-work requirement that interaction be at/after current due. It enforces chronology and the other listed authority checks. Independent tests accepted a new-session interaction one second after the prior interaction but before its due in both conditions. Listing separately omits future-due items. D11A does not establish an additional acceptance-time due rule or grace; the implementation report accurately distinguishes this. Early FSRS capability is not taken as formal policy approval.

## 13. Evidence / Provenance

**PASS for valid accepted chains; I-01 shows the same chain can contain invalid memory.** Persisted-row tests assert exactly one attempt, one schedule, one owner/event ledger, one REVIEW_ANSWERED, one REVIEW_SCHEDULED and one current-pointer transition per event. Event payloads remain exactly `{"scope":"item_attempt"}`.

The non-null research_assignment_id resolves immutably through condition, allocation, protocol, set and exact configuration/digest. Content release/revision and event identity remain on the accepted attempt; foreign keys and insert guards reinforce ownership/membership. Existing historical development attempts retain null provenance, labels and state. There is no relabeling/backfill path.

New offline work captured before authority freeze is rejected by the same incoming-time rule. An already accepted development UUID returns its unchanged historical result first. No queued event gains authority from a client scheduler label.

## 14. Atomicity

**PASS for raised failures; FAIL for invalid-result rejection under I-01.** The six checked-in failure stages were inspected. Independent probes went further by starting with an existing accepted pointer in each condition, then injecting failures after real calculation, attempt flush, schedule flush, ledger flush, research-event flush and actual pointer SQL. All **12** comparisons preserved counts and SHA-256 of complete rows across attempt/schedule/ledger/pointer/event tables.

Actual first and subsequent engine due overflows in both conditions produced due_anchor ValidationError with zero new evidence and no pointer movement. Cross-condition state failures similarly wrote nothing. Exceptions unwind the one acceptance transaction; only specific ledger uniqueness reconciles a winner, and specific concurrency SQLSTATEs map to retryable failure. No retry/fallback reruns calculation.

The malformed nested results in I-01 raise no validation error; a whole invalid chain commits. This is a result-validation failure, not evidence that a thrown-error rollback is non-atomic. The implementation report's unqualified assertion that mutated scheduler state is rejected is too broad.

## 15. Online / Sync

**PASS for shared routing and normal outputs.** sync_review_events delegates each event to record_review_attempt and adapts the returned stored result. There is no second research acceptance algorithm. The checked-in equivalent online/sync test compares assigned scheduler, state and interval despite different response-time evidence. Independent equivalent-fact probes additionally compare exact due. Cross-transport replay returns original chains unchanged.

Atomicity is per event, consistent with the existing sync contract. The shared I-01 boundary affects both transports; it is not transport-specific.

## 16. Concurrency

**PASS.** Reviewed checked-in conventional test uses independent PostgreSQL sessions, the actual learner row lock and pg_blocking_pids, not a substitute lock.

Independent probes repeated distinct-event and same-UUID races for **both conventional and enhanced**. Wrapper instrumentation calls the real acquire_learner_lock. An independent observer connection sees B blocked by A. After A commits, B's fresh predecessor read is A's schedule; both distinct events commit and the pointer ends at B. Duplicate B returns A via post-lock replay and does not enter predecessor loading. Counts are (2,2,2,1,4) for distinct events and (1,1,1,1,2) for duplicates. No lost update, divergent predecessor or duplicate pointer.

## 17. Formal Routing Closure

**PASS, conclusively closed for the reviewed shared path.** The supplied formal case uses an incomplete allocation and alone would be a weak activation test. Independent probes construct otherwise complete formal authority with valid frozen protocol/allocation, both sets/conditions, supported configs, valid released items and explicit clock policy.

Both groups, through direct shared acceptance and sync, return **503 D11_ROUTING_DISABLED**, preserving zero accepted-chain writes. APP_ENV remains testing in these probes, proving that formal mode itself closes the gate before completeness or engine calculation. No hidden override or complete-formal bypass was found. Formal content/enrollment, clock tolerance and study-period decisions remain unapproved.

## 18. Mobile Contract / Excluded Inputs

**PASS.** ReviewAttemptCreate contains no scheduler_type, algorithm_version, condition or research_assignment_id selector. Response scheduler labels are read-only output. Existing extra-field ignore semantics are preserved; malicious fields cannot influence routing, assignment, prior state or reconstruction.

ResearchSchedulerInput has exactly correct, interaction_at_utc, prior_state and prior_interaction_at_utc. No response time, interruption evidence, item difficulty, pronunciation or transport-delay mathematical feature enters either adapter. Independent paired accepts changed response_time_ms from 0 to 3,600,000 and pronunciation fields from 0 to 100; state, identity, interval and due remained identical in both conditions. Response time stayed separately persisted evidence. No mobile edit, request selector or pronunciation integration is required or present.

## 19. Test Quality

The 25 focused cases use real assignment resolution and real engines for normal integration. Literal initial memory/interval assertions are useful independent oracles. The lock test does invoke real PostgreSQL blocking, and failure tests stage real rows/SQL. The supplied formal test's incomplete fixture was independently supplemented as described above.

**Substantive weakness (part of I-01):** test_mutated_scheduler_result_is_revalidated_before_persistence changes only conventional memory.interval_days to 6 while result.interval_days remains 1. The outer consistent validator catches that redundant-field disagreement even when nested field/domain validation never runs. Thus this green test does not prove complete returned-memory validation. It misses negative FSRS stability, invalid SM-2 EF and similarly bypassed nested strict constraints.

The external 67-case suite exercises complete formal authority, policy absence/unknown, exact environment spelling, four group/set mappings with both answers, excluded inputs/due equality, replay after advancement/disablement, real blocking/post-lock replay, all six rollback stages with prior evidence, actual due overflow, both malformed nested outputs, both cross-condition states, alternate release/revision, exact clock limits, mutated loaded config facts, unknown dispatch and early acceptance. **65 pass; the 2 rejection assertions exposing I-01 fail.** No failing product behavior was edited or suppressed.

## 20. Regression Results

All results below are freshly executed for this review, not copied from the implementation report.

| Check | Result |
| --- | --- |
| D11E focused integration | 25 passed, 2 warnings in 9.03s; exit 0 |
| Research time boundaries + contracts + SM-2 + FSRS | 238 passed, 2 warnings in 11.18s; exit 0 |
| Pinned FSRS capture --check only | Pinned direct-library golden reproduction: PASS; exit 0 |
| D11B acceptance + D11C/D11D routing | 32 passed, 2 warnings in 9.62s; exit 0 |
| Full backend pytest | **493 passed, 2 warnings in 113.87s (0:01:53)**; exit 0 |
| Independent external probes | **2 failed, 65 passed, 2 warnings in 24.73s**; exit 1; both failures are I-01 reproductions |
| Ruff app tests scripts, --no-cache | All checks passed!; exit 0 |
| Static in-memory compile, app/tests/scripts/alembic | 100 Python files passed; exit 0 |
| uv lock --check --offline | Resolved 49 packages in 0.98ms; exit 0 |
| git diff --check | PASS; exit 0; existing LF-to-CRLF advisory warnings only |
| File integrity | All 264 pre-existing non-ignored files unchanged; only this new report added |

Execution used backend virtualenv Python with -B and the pre-reviewed `C:\Users\user\AppData\Local\Temp\fluentt-d11b-run.py` wrapper. Pytest options were `-q --tb=short -p no:cacheprovider`; external probes additionally used -s. Focused file groups were exactly those requested. Full pytest used no test-path restriction. No database runs overlapped.

The two warnings are existing Starlette/httpx TestClient and AnyIO BlockingPortal deprecations. Golden utility ran only --check; static compilation used compile() in memory. No bytecode/cache generation was requested. The guarded runner validates *_test and the intended private search_path with no public fallback. D10 evidence was never used.

## 21. Findings

### I-01 — IMPORTANT: model-instance trust bypasses complete pre-insert result validation

**Locations:** `backend/app/reviews/service.py:205` consumes the adapter result through `validate_research_result`; `backend/app/scheduling/research_contracts.py:80` omits instance revalidation; `research_contracts.py:240` calls ResearchSchedulerResult.model_validate(value); `backend/app/reviews/service.py:432` serializes the trusted nested state into immutable storage. Test gap: `backend/tests/reviews/test_d11e_acceptance.py:442`.

**Root cause:** strict/frozen/extra-forbid Pydantic configuration does not cause existing model instances and their referenced nested models to be fully reconstructed/field-validated. The installed Pydantic config documents default revalidate_instances=never; model_copy(update=...) explicitly skips validation. The outer after validator reruns identity/interval agreement, but does not recheck every nested numeric field or SM-2 reachable-memory validator. These unchanged shared contracts were safe only insofar as trusted pure engines built valid outputs; D11E now claims an independent acceptance-side validation barrier that they do not provide.

**Independent reproduction:** wrap the real assigned adapter, calculate once normally, keep all identities, interval, seconds and due unchanged, and replace only returned nested memory via model_copy. Submit through the actual shared acceptance service with complete frozen TEST authority. No database row is manually edited.

```python
valid = real_engine.schedule(*args)
memory = valid.scheduler_state.memory.model_copy(update=bad_memory)
state = valid.scheduler_state.model_copy(update={"memory": memory})
return valid.model_copy(update={"scheduler_state": state})
```

Observed committed rows:

| Condition / injected field | Persisted invalid value | Attempts / schedules / ledgers / pointers / canonical events |
| --- | --- | --- |
| Enhanced: bad_memory={"stability": -1.0} | stability -1.0 | 1 / 1 / 1 / 1 / 2 |
| Conventional: bad_memory={"ease_factor": Decimal("9")} | ease_factor 9.0, lapses 0 | 1 / 1 / 1 / 1 / 2 |

Both probes expected controlled rejection with zero writes and instead returned accepted results. They fail consistently in the isolated PG schema. The expected domains are stability > 0, and SM-2 EF in [1.3,2.5] with EF=2.5 for zero lapses. Normal engine outputs are independently correct; this is fault-injected adapter-output handling, not evidence that a client directly controls memory or that production evidence has already been corrupted.

**Impact:** violates D11A section 5 item 5 and transaction step L: strict envelope/memory validation must succeed before any accepted insert. A faulty adapter/wrapper can commit invalid immutable experimental memory; the later predecessor decoder would treat that stored state as corrupt. The checked-in mutation test catches only one outer consistency mismatch, creating an unjustified claim of complete revalidation.

**Required correction scope (not implemented here):** make the acceptance result boundary validate the complete result/envelope/memory, including existing model instances and nested values, without adding a second engine transition or changing time/config math. Add rejection cases for both algorithms and relevant invalid strict/domain/reachability values, asserting complete evidence/pointer snapshots unchanged for first and subsequent work. Keep ordinary outputs, replay and both transports unchanged. Re-review the correction before accepting D11E.

**Severity rationale:** IMPORTANT integrity/contract gap at the new integration boundary. No formal activation, client selector bypass, wrong real-engine dispatch, observed concurrency divergence or surviving partial transaction was found, so it is not classified as a CRITICAL exploit of those gates.

### Notes, not new defects

- Formal/live collection remains closed and needs its separately approved protocol/enrollment/time decisions.
- Listing due eligibility is not an acceptance-time due rule; the implementation report describes this accurately.
- The narrower implementation claim that a mutated scheduler state is always rejected is disproved by I-01. Preserve that historical report; this independent report records the correction to its conclusion.
- Prior M-01/M-04 research-time corrections remain verified; this review neither reopens nor silently broadens them.

## 22. M-02 / M-03

**M-02 OPEN / DEFERRED.** Verification used the existing dedicated private-schema topology, with no parallel multi-schema database testing. The real concurrency probes have multiple connections to the same guarded schema; they do not create a new schema topology. The known global D9 trigger-count portability limitation still needs correction before shared/multi-schema parallel CI.

**M-03 OPEN / DEFERRED.** DevelopmentScheduler extreme-date overflow behavior is unchanged and is not counted as a D11E finding. The research branch never falls back to it. Its source hash agrees with the prior review. M-01 and M-04 remain closed by the reviewed T1/F1 work.

## 23. Git Status

Final branch/head remain `main` / `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; index empty. Local status reports `main...origin/main` without ahead/behind markers; no network push/fetch was performed. Tracked diff remains the review-start 10 files, 460 insertions, 192 deletions.

All **264** pre-existing visible files are byte-identical to the review-start SHA-256 manifest, including collapsed untracked authority/scheduling directories. Only this new review report is added. No application source, tests, migrations, fixtures, dependency/lock files or previous reports changed during this review. No staging, commit or push.

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
?? docs/development/d11e-independent-code-review.md
?? docs/development/d11e-research-acceptance-integration-review.md
?? docs/development/p01-pronunciation-preimplementation-audit.md
?? docs/development/p02-pronunciation-architecture-scoring-spec.md
?? docs/development/p02f-pronunciation-feasibility-report.md
```

## 24. Recommendation

Block D11E acceptance approval on I-01. Correct the complete result-validation boundary under a separate authorized implementation task, add adversarial regression cases for both engines, and rerun independent review. Preserve all passing authority/replay/concurrency/time contracts and keep formal/live collection closed. No fixes were made during this review.

**D11E CODE REVIEW BLOCKED — nested scheduler result validation permits invalid memory to be committed.**
