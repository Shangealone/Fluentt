# D11B Independent Code Review

Review date: 2026-10-17 (Asia/Manila). Repository: `F:\FLUENTT`. Review target: the existing uncommitted D11B implementation on `main`, HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`.

## 1. Verdict

**D11B INDEPENDENT CODE REVIEW PASS**

Zero CRITICAL findings; zero IMPORTANT findings. Two MINOR findings concern new D11B helpers/test isolation. A third MINOR finding documents unchanged development timestamp behavior discovered while checking all timestamp arithmetic. None prevents D11C pure Binary SM-2 calculation and fixtures. Their limits and explicit gates appear in sections 22-24.

The research UTC boundary issue is **SAFE TO DEFER UNTIL BEFORE RESEARCH ACCEPTANCE INTEGRATION**. This disposition does not waive it or permit wiring the affected helpers into acceptance without correction. Research routing remains closed. This verdict approves the persistence/contracts foundation for separately authorized D11C work; it does not approve formal enrollment, research acceptance, or deployment.

## 2. Review Scope

The actual source was inspected independently against `docs/development/d11a-scheduler-contracts-spec.md`, with `d11-esr-preimplementation-audit.md` as supporting context. The implementation report was read as background, and its conclusions were checked against source and execution.

All eight modified tracked files were inspected in full: `backend/alembic/env.py`, `backend/app/database/session.py`, `backend/app/reviews/models.py`, `backend/app/reviews/service.py`, `backend/tests/conftest.py`, `backend/tests/content/test_provenance_migration.py`, `backend/tests/research_helpers.py`, and `backend/tests/reviews/test_due_review.py`.

All eleven new implementation files were inspected in full: `backend/alembic/versions/d11b00000001_scheduler_persistence.py`; `backend/app/research_authority/{__init__,config_v1,schema_v1,integrity_v1,models}.py`; `backend/app/reviews/acceptance.py`; `backend/app/scheduling/research_contracts.py`; and `backend/tests/reviews/{test_d11b_acceptance,test_d11b_persistence,test_research_contracts}.py`.

Surrounding authentication dependencies, review routers/schemas/eligibility, released-content provenance, development scheduler/types, sync service/router/models, research logging, D5/D9 guards, and the external private-schema test wrapper were inspected as necessary. No implementation, test, migration, or existing document was edited during this review.

## 3. BIGINT Migration

**PASS.** `ReviewSchedule.interval_seconds` is mapped as `BigInteger` in `backend/app/reviews/models.py:190`. The new revision `d11b00000001` depends directly on `d9c0de000001`; earlier migrations have no working-tree changes. `36500 * 86400 = 3153600000`, exceeding PostgreSQL INTEGER maximum and fitting BIGINT.

`upgrade()` alters the column type, creates additive frozen authority tables, and adds a nullable assignment reference with constraints. It contains no UPDATE/backfill or application-level rescheduling of historical rows. Its preflight refuses existing research labels that lack the new frozen provenance. Development rows retain NULL assignment. A PostgreSQL migration round-trip test compares complete existing attempt, schedule, current-pointer, accepted-ledger and research-event rows before/after; the capacity test stores the cap and checks D9 immutability. The type change is not a promise of zero physical PostgreSQL storage work; the reviewed guarantee is preservation of evidence values and identities.

`downgrade()` checks both INTEGER bounds before casting and refuses populated research protocols or assigned research attempts. It removes dependent constraints/triggers before tables and functions, then downcasts. It neither truncates out-of-range intervals nor silently destroys populated research authority. Seed-only configuration records may be removed during a safe scaffold downgrade. D9 guards remain installed; see M-02 for the test's namespace limitation.

## 4. Scheduler Contracts

**PASS, with M-01's boundary gate.** `ResearchSchedulerInput` has exactly four mathematical fields: `correct`, `interaction_at_utc`, `prior_state`, and `prior_interaction_at_utc`. It contains no response duration, instructional difficulty, pronunciation, network feature, or server receipt instant. `StrictBool` rejects numeric/string substitutes. Prior state and prior interaction must both exist or both be absent.

Research state envelopes contain exactly `schema_version`, `scheduler_type`, `algorithm_version`, `config_version`, and `memory`. Extra keys are forbidden. Literal identities and the supported identity registry reject unknown/cross-bound versions. The eight-field result binds its identity to the envelope and enforces whole-day seconds plus SM-2 interval consistency. `validate_research_result()` checks the interaction-anchored due instant; overflow in that addition becomes a Pydantic `ValidationError` with `due_anchor`.

Models are frozen, nested memory is frozen, and decoding dictionaries does not mutate the caller's original dictionaries. These contracts are distinct from the preserved development context and dev JSON state.

## 5. State Validation

**PASS.** `Sm2Memory.reachable()` validates snapshots; no response transition engine exists. Counters use strict nonnegative integers; days use strict integers 1..36500; bools/floats/strings cannot substitute. EF is finite and bounded 1.3..2.5. Its lapse-linked values are calculated with `Decimal`: 2.5, 2.18, 1.86, 1.54, then the 1.3 floor. Transient zero-repetition/zero-lapse memory cannot be persisted. Reachable first/second/later intervals and cap behavior are checked with exact decimal ceiling.

The reachability loop stops once the 36500-day cap is reached, even for enormous repetition counts. Lapse handling branches at four instead of iterating over every lapse. Large-counter probes and existing tests support bounded work; the validator does not run a loop proportional to the supplied repetition/lapse count after saturation.

`FsrsMemory` accepts exactly Review state, null step, finite positive stability, and finite difficulty 1..10. It rejects coercive numeric strings/bools, extra Card keys, due/last_review/card_id, and Learning/Relearning snapshots. Conversion of an unrepresentably large numeric value is caught. No fsrs dependency/import or FSRS transition implementation was found.

## 6. Frozen Configurations

**PASS.** Both literal documents in `config_v1.CONFIGURATIONS` were independently compared with D11A's normative JSON blocks. Canonicalization used sorted keys, compact separators, ASCII escaping, then UTF-8 SHA-256. Both documents and digests matched:

| Configuration | Independently reproduced SHA-256 |
| --- | --- |
| `sm2-binary-config-v1` | `3bd486d1183d84a869a2470f0a97a13ecabc44365eb9fe8e158014fd1ef2a0d9` |
| `fsrs6-binary-r90-config-v1` | `4e4c56a9f928cae5581e5d577de413b17c9d581185482db423a98551f6575e4f` |

The database checks the document's digest and exact supported identity/digest tuple. Composite foreign keys bind protocol and condition configuration identities. Frozen row/statement triggers reject UPDATE, DELETE and TRUNCATE. There is no mutable alias/default selecting a research configuration at acceptance. The module's ordinary Python dictionaries are seed literals, not an accepted runtime authority; changing a literal without the locked digest fails database checks.

## 7. Research Authority Schema

**PASS for D11B scaffolding.** `schema_v1.tables()` defines `scheduler_configurations`, `research_protocols`, `research_sets`, `research_set_memberships`, `participant_allocations`, and `participant_set_conditions`.

Composite protocol/set foreign keys prevent a set from being bound to another protocol/version. Membership binds logical item and exact immutable revision; its insert trigger checks that revision/item inside the exact released manifest, including active language/lesson/revision. The membership primary key `(protocol_id, protocol_version, vocabulary_item_id)` prevents the same logical item appearing in both A/B sets of one protocol version, even with different revisions/releases.

Allocations are unique per owner/protocol/version. Mapping group is constrained to 1 or 2. A separate two-element `period_order` must identify both distinct sets belonging to that protocol. Conditions are unique per allocation/set; their composite foreign key binds allocation, owner and protocol. The mapping trigger enforces group 1: A enhanced/B conventional, and group 2: A conventional/B enhanced. Configuration/type/algorithm/schema/digest are bound together.

Hostile combinations are rejected through composite FKs, uniqueness, CHECKs, and insert triggers: another owner's condition, another protocol's set, wrong scheduler configuration, revision absent from the chosen release, duplicate A/B logical item, or duplicate participant/set condition. PostgreSQL persistence tests exercise those boundaries.

All six table types reject ordinary UPDATE/DELETE/TRUNCATE. Insert scaffolding is intentionally available for future controlled provisioning; complete cohort totals, eligibility, assignment timing and activation still require the approved provisioning/enrollment service. Row immutability alone does not prove an aggregate is complete. No provisioning endpoint or routing activation exists in D11B.

## 8. Assignment Provenance

**PASS.** `ReviewAttempt.research_assignment_id` is nullable for legacy development evidence. `ck_d11_attempt_assignment` requires it exactly when research labels are used. `fk_d11_attempt_condition` binds assignment ID, attempt owner, scheduler type and algorithm version as one tuple. `fluentt_d11_attempt_valid()` checks exact assigned set membership, item, revision and release at insertion.

These constraints avoid the independent-valid-FK trap where two individually valid rows belong to different owners. The migration performs no backfill. Development remains `development/dev-0.1` with NULL assignment and its existing state semantics. Storage-only research fixtures do not demonstrate executable research acceptance.

## 9. Explicit Development Routing

**PASS.** The sole production-source `DevelopmentScheduler()` construction is `acceptance.resolve_development_authority()` at `backend/app/reviews/acceptance.py:163`.

The resolver first rejects any participant allocation for the authenticated owner, including test protocols. It permits development only for explicit server environments `development` or `testing`. Unsupported environments and enrolled owners receive 503 `D11_ROUTING_DISABLED`. Client payloads provide no authoritative scheduler/config selection. Test injection requires `testing` and a `DevelopmentScheduler` instance; the service separately rejects any returned identity other than `development/dev-0.1`.

There is no `scheduler or DevelopmentScheduler()` fallback. Historical accepted replay occurs before this resolver, so a later enrollment or disabled environment does not invalidate accepted UUID replay.

## 10. Acceptance Transaction

**PASS.** Traced API-to-service order:

1. Router authentication supplies the server owner.
2. Owner/event accepted replay lookup runs before new-work validation.
3. Immutable content provenance is resolved.
4. Owner-scoped session preflight resolves or creates the session.
5. Scalar item/revision/difficulty/session identities are copied, then `db.rollback()` ends preflight reads/autobegin.
6. An explicit `with db.begin()` transaction sets READ COMMITTED before database work.
7. Authenticated user row is locked with FOR UPDATE.
8. Replay is checked again.
9. Explicit development authority is resolved.
10. Current predecessor/history is freshly loaded and validated.
11. Owner/session/client-session identity is rechecked under the lock.
12. Development calculation and output identity check run.
13. One accepted evidence chain is staged/flushed/refreshed.
14. Context exit commits the whole acceptance while retaining the learner lock through commit.

The existing session helper can commit and refresh only during preflight. No called acceptance/persistence/logging helper commits after the learner lock. The final return inside the context still executes the transaction context manager's commit before returning to the caller. Failed writes roll back; retryable SQLSTATEs are mapped after rollback.

Preflight ORM state is not used as mutable predecessor authority. Immutable content travels as scalars; current pointer, attempt, schedule and ledger reads use fresh SQL/populate_existing. Session ownership is revalidated under lock. Unrelated pending writes are rejected before preflight can commit them.

## 11. Learner Locking

**PASS.** `acquire_learner_lock()` selects the authenticated `users.id` with `.with_for_update()`. PostgreSQL compilation yields `SELECT users.id FROM users WHERE users.id = %(id_1)s::UUID FOR UPDATE`.

The user row exists independently of item pointers, so first reviews with no current pointer are protected. The key is owner alone: different items for one learner serialize; different learners progress concurrently. Lock acquisition precedes pointer/predecessor reads and calculation. There is one learner lock per acceptance, held through the accepted-chain commit. No provider/network call runs while locked. Single-owner acquisition avoids a second-user lock-order cycle; retryable database lock/serialization/deadlock failures return 503.

## 12. Replay / Idempotency

**PASS.** `accepted_result()` scopes lookup to `(user_id, client_event_id)`. It verifies linked attempt/schedule owner, item and scheduler identity, returning the original linked schedule rather than the current/latest pointer. Replay precedes provenance revalidation, assignment, chronology, state decoding and scheduler invocation.

The post-lock lookup closes the duplicate race after a waiter observes the winner's commit under READ COMMITTED. The 23505 recovery path recognizes only `uq_user_client_event_id`, then requires an actual owner/event accepted winner. Arbitrary unique/integrity failures are not converted to replay. Replaying old work performs no pointer transition or new event emission.

## 13. Predecessor Integrity

**PASS for connected development acceptance.** `load_current_predecessor()` permits first review only when no pointer and no attempt/schedule history exist. With a pointer it validates the linked schedule, attempt, accepted ledger, owner and logical item, and looks for earlier partial attempt chains that a valid latest pointer could conceal.

Missing pointers with history, dangling/mismatched links, absent ledger/schedule and cross-owner/item chains fail closed as `D11_CURRENT_CHAIN_INVALID`. Development refuses a non-development predecessor identity instead of decoding or regenerating research state. `validate_research_predecessor()` additionally validates bound assignment/config digest/state identity, whole-day interval, due anchor and SM-2 memory/answer consistency for future integration; its timestamp addition requires M-01 before connection to acceptance.

## 14. Chronology / UTC Handling

Normal disconnected research chronology requires an aware incoming instant, converts to UTC, and requires strict increase over prior interaction. Equal/earlier instants raise 409 `D11_STALE_INTERACTION`; naive incoming time raises 422 `D11_TIMEZONE_REQUIRED`; naive stored predecessor time is an integrity error. No server-receipt reanchoring occurs. No numeric future tolerance was invented: missing future policy fails closed.

Independent probes reproduced bare `OverflowError` for `datetime.min` at UTC+08 and `datetime.max` at UTC-08 in `_utc()`, `ResearchSchedulerInput`, and both incoming/prior normalization in `validate_research_chronology()`. An otherwise identity-valid enhanced predecessor anchored at UTC `datetime.max` also overflows at `validate_research_predecessor()`'s interval addition. These are M-01.

`validate_research_result()` already catches due-addition overflow and raises the consistent `ValidationError` (`due_anchor`), which was separately reproduced. An unrepresentable offset supplied directly to a result's UTC field still reaches `_utc()` and belongs to M-01.

The unchanged `DevelopmentScheduler.schedule()` also overflows when adding the normal correct-answer interval to UTC `datetime.max`. This is pre-existing M-03; the connected service calculates before persistence inside the explicit transaction, so failure commits no accepted chain. No D11 chronology/skew policy was retroactively applied to development.

## 15. Atomic Evidence Chain

**PASS.** `_persist_development_acceptance()` stages one attempt, one schedule, one accepted ledger, one current-pointer upsert, one REVIEW_ANSWERED and one REVIEW_SCHEDULED. Attempt and schedule are flushed in FK order; ledger uniqueness is flushed before pointer advance. The caller owns the transaction and final flush/commit.

Canonical event payload stays exactly `{"scope":"item_attempt"}`. It contains no dumped authority/configuration data. Failure injection after the final event is staged/flushed proves rollback of the complete chain and restoration of the previous current pointer. Existing D5/D9 application-write immutability boundaries remain; no superuser/DBA impossibility is claimed.

## 16. Sync / Offline Compatibility

**PASS.** `sync_review_events()` calls the same `record_review_attempt()` per event. There is no second acceptance implementation. Eligible queued development work continues to produce development schedules; enrolled owners fail closed for new work. UUID replay still returns the original result and cannot move a current pointer backward.

The backend reads the submitted event without rewriting queue payloads. Response duration, interaction instant, timing evidence and other existing review metadata reach the same persistence path. Mobile is not required to supply a scheduler/condition selector. No mobile edits, speech/audio queue, or new pronunciation acceptance path appeared.

## 17. Concurrency Tests

**PASS: substantive PostgreSQL evidence.** The eight parameterized race combinations cover duplicate/distinct UUIDs, existing/absent pointer, and same/different logical item. Each worker uses its own SQLAlchemy Session/connection; backend PIDs are captured. While worker one holds the learner lock in calculation, an independent observer confirms worker two is actually blocked by that PostgreSQL PID using `pg_blocking_pids`.

The tests assert predecessor loading has not occurred for the waiter, then release the winner and assert duplicate replay avoids a second scheduler call; distinct same-item work sees the newly committed schedule; distinct different-item work sees its own absent predecessor. Chain counts are asserted. A separate test proves a different learner completes while the first learner remains blocked. Rollback tests check history and pointer restoration, including SQLSTATE retry cases and unrelated integrity errors.

The changed D7 barrier now rendezvouses before service acceptance. Leaving it inside the scheduler would deadlock the test because the first scheduler holds the user lock. That older barrier alone would not prove database waiting, but the new controlled PostgreSQL tests do. The observer does not mock out FOR UPDATE or serialize the second request before it reaches the database.

## 18. Test Isolation

The reviewed external wrapper is `C:\Users\user\AppData\Local\Temp\fluentt-d11b-run.py`. It validates the database name ends in `_test` before creating/using a schema or invoking pytest. It validates the schema name, sets both test/application URLs, sets search_path to the private schema only, and verifies `current_schema()`. Executed verification targeted `fluentt_test`, schema `d11b_21ec17a1c5`; it did not target the D10 evidence database.

The fixture reset rechecks the `_test` boundary, disables only the listed test-schema truncate guards during reset, truncates the isolated graph, then reenables guards inside a transaction. Frozen configurations survive reset. Savepoint-based destructive migration/fixture probes roll back. The private schema is retained for repeatable test runs rather than dropped by the wrapper. Tests execute actual PostgreSQL migration operations, constraints and lock behavior.

The D5 test now removes later additive D11 dependencies before exercising the D5 downgrade/upgrade, then reinstalls D11, all under its savepoint. That is legitimate migration dependency setup; no historical D5 migration changed.

Scope limitation: the safe wrapper is the execution boundary. Directly invoking pytest with an arbitrary externally supplied URL is not equivalently protected before session-level schema setup; use the reviewed wrapper for these checks. Schema isolation also does not isolate database-global catalogs/roles/extensions. M-02 records a concrete database-wide trigger-count assumption.

## 19. Security / Ownership

**PASS within the application/database integrity boundary.** Routers use authenticated server user identity. Replay, sessions, current pointers and predecessor chains are owner scoped. Composite authority/attempt FKs bind owner and scheduler identity together, and assignment membership is checked at insertion. Replaying another user's UUID cannot retrieve that user's result. Session fallback still resolves under the authenticated owner and checks client-session identity.

Client fields never grant scheduler/config/assignment authority. Test injection is unavailable outside testing, and injected research-labelled output is rejected. Ordinary application DML cannot update/delete/truncate frozen evidence; privileged DBA trigger disabling is outside this claim. Test-only maintenance is guarded and is not imported into a production request path.

## 20. Research-Routing Closure

**PASS: CLOSED.** Searches across production source find research labels only in configuration, schema/provenance constraints and strict contracts/validators. The connected service resolves only development, and checks the output identity before persistence. No Binary SM-2 or FSRS transition engine, fsrs dependency, enrollment route, activation flag or default research selection exists.

Both formal and test allocation records close development for new work with 503 while research execution is disabled. Historical replay remains available. Direct storage-only test fixtures are not a research scheduler route. Future D11C must remain pure and explicitly tested; adding an engine must not implicitly activate acceptance.

## 21. Regression Results

| Check | Observed result |
| --- | --- |
| Focused D11B acceptance/persistence/contracts tests | **95 passed, 2 warnings in 55.87s** |
| Full backend suite | **268 passed, 2 warnings in 120.10s (0:02:00)**; exit 0 |
| Ruff, `app tests scripts` | **All checks passed!**; exit 0 |
| Static Python compilation | **91 files PASS**, covering `app`, `tests`, `scripts`, and `alembic`; compiled in memory without bytecode output |
| Independent D11A configuration-document/digest comparison | Both exact documents and SHA-256 values PASS |
| UTC/representability probes | M-01/M-03 reproduced; result due-overflow mapped to `ValidationError` as intended |
| Migration trigger-count probe | Unrelated same-name temporary trigger changes global count 4 to 5 while private-schema count stays 4; probe rolled back |
| `git diff --check` | PASS; no whitespace errors |

Focused execution used `pytest -q -p no:cacheprovider tests/reviews/test_d11b_acceptance.py tests/reviews/test_d11b_persistence.py tests/reviews/test_research_contracts.py --tb=short`. Full execution used `pytest -q -p no:cacheprovider --tb=short`, through the reviewed private-schema wrapper and backend virtual environment. Disabling pytest's cache avoids review-generated repository cache writes and does not omit tests. Python ran with `-B`; Ruff used `--no-cache`.

The two warnings concern Starlette TestClient/httpx and the deprecated AnyIO BlockingPortal alias. No test failed. On resuming verification, the previous process handle was unavailable; the full suite was rerun to obtain a complete final result. An initial sandboxed rerun could not connect to localhost PostgreSQL (permission denied) before pytest started; the approved rerun outside that network restriction produced the result above. An early ad hoc ORM SQL-compilation probe lacked normal model registration; re-running with application model registration succeeded. These were execution/probe setup limitations, not suppressed test failures.

## 22. Findings

### M-01 — MINOR: extreme research timestamp failures escape the declared validation boundary

- **Files/symbols:** `backend/app/scheduling/research_contracts.py:58`, `_utc()`/`UtcDatetime`; `backend/app/reviews/acceptance.py:238`, `validate_research_chronology()`; and `backend/app/reviews/acceptance.py:175`, `validate_research_predecessor()`, especially its due-anchor addition at line 227.
- **Explanation/scenario:** normalization of year-1 positive-offset or year-9999 negative-offset datetimes requires a UTC value outside Python's representable range. `astimezone()` raises bare `OverflowError`. Incoming and stored-prior chronology both expose it. Separately, adding a valid whole-day interval to a stored UTC maximum-date predecessor overflows before the due-anchor integrity error is raised. Pure probes reproduced each path without changing stored evidence.
- **Why it matters:** future integration would yield an uncontrolled exception instead of a declared input-validation or stored-state-integrity error. Existing ordinary-date tests do not cover the extremes. It does not select the wrong engine or commit corrupt evidence, and the research helpers have no connected acceptance caller.
- **Recommended fix scope:** catch representability failures at UTC conversion and predecessor due addition; turn contract failures into Pydantic validation errors, incoming chronology failures into an approved time-invalid response, and stored-prior failures into `D11_STATE_CORRUPT`. Add min/max-offset tests for both incoming and prior fields plus due-addition boundary cases. Preserve anchors; do not clamp or reanchor time.
- **Gate:** **SAFE TO DEFER UNTIL BEFORE RESEARCH ACCEPTANCE INTEGRATION**. D11C normal-range pure-engine fixtures may proceed; acceptance integration and boundary support require this fix and focused tests first.

### M-02 — MINOR: the new migration preservation test counts D9 triggers across all schemas

- **File/symbol:** `backend/tests/reviews/test_d11b_persistence.py:254`, `test_real_migration_round_trip_preserves_existing_rows_and_pointer()`.
- **Explanation/scenario:** its `pg_trigger` query filters only `tgname='d9_immutable_row'` and asserts exactly four, without joining namespace/table identity. An unrelated same-name temporary trigger in the same test database makes the global count five while the reviewed private schema still has its correct four. This was reproduced under a rolled-back transaction. Existing D9 tests have an analogous assumption.
- **Why it matters:** the test can falsely fail when an otherwise isolated test schema shares a database with another D9 schema or unrelated trigger. The green run proves preservation in the current dedicated layout; it does not prove the assertion is safe for arbitrary multi-schema CI. This is a test portability/isolation problem, not a production integrity bypass or false acceptance.
- **Recommended fix scope:** join `pg_trigger`, `pg_class`, and `pg_namespace` and scope to the intended schema/tables, preferably checking the exact guarded table set. Coordinate the analogous pre-existing D9 assertion separately. Add a focused test/probe with an unrelated same-name trigger when making that change.
- **Gate:** defer while database-backed verification retains its dedicated single-D9-schema assumption. Fix before parallel/multi-schema database CI. Pure D11C scheduler fixtures do not require PostgreSQL or this catalog assertion.

### M-03 — MINOR, pre-existing: development due addition lacks representability error mapping

- **File/symbol:** unchanged `backend/app/scheduling/development.py:40`, `DevelopmentScheduler.schedule()`; connected call in `backend/app/reviews/service.py:148`.
- **Explanation/scenario:** an otherwise parsed development request with an interaction instant at UTC `datetime.max` reaches the normal 86400-second correct-answer addition and raises `OverflowError`. A pure scheduler probe reproduced it. This arithmetic predates the D11B diff.
- **Why it matters:** the caller receives an uncontrolled server failure for an extreme timestamp. Calculation occurs before accepted writes inside the transaction, so no attempt/schedule/ledger/pointer/event chain is committed. It neither changes historical evidence nor introduces research chronology into development.
- **Recommended fix scope:** a separately scoped development input/error-boundary hardening change with max-date tests and a deliberate compatible error policy. Preserve the 86400/600 rules and existing D8 anchor semantics. No date clamping, server-time substitution, or silent interval change.
- **Gate:** safe to defer for D11C pure research-engine development. Do not infer extreme-date support from this review. Address before claiming such support or expanding development time-validation behavior; research acceptance independently requires M-01 and representable result due instants.

### N-01 — NOTE: frozen-row scaffolding is not formal enrollment authority

- **Files/symbols:** `backend/app/research_authority/schema_v1.py`, `tables()`/protocol/allocation/condition tables; `backend/app/reviews/acceptance.py`, `resolve_development_authority()`.
- **Explanation/scenario:** the schema permits immutable rows to be inserted for controlled fixtures/provisioning. Creating those rows alone cannot prove approved cohort totals, complete paired assignments, clean formal history/queue, freeze-before-interaction timing, or an approved clock/period procedure.
- **Why it matters/recommended scope:** future enrollment/activation must validate and freeze the complete aggregate under the learner lock and preserve the formal gates in D11A. D11B correctly rejects all new allocated-owner work, so this is future integration work rather than an active acceptance defect. Do not enable routing merely because the tables exist.

## 23. Required Fixes Before D11C

No CRITICAL/IMPORTANT fix blocks separately authorized D11C pure Binary SM-2 implementation. Keep that milestone limited to the locked four-field input, exact arithmetic, immutable output/state, explicit isolated fixtures and normal representable instants. Engine presence must not activate online/sync research acceptance.

M-01 must be fixed and regression-tested before research acceptance integration. M-02 must be fixed before verification changes to a shared multi-schema layout. M-03 is pre-existing and does not need to be folded into the D11C algorithm change; its independent hardening gate remains explicit.

## 24. Deferred Issues

The UTC-boundary issue is **SAFE TO DEFER UNTIL BEFORE RESEARCH ACCEPTANCE INTEGRATION**. It is recorded as a real defect, not waived. Result addition already rejects unrepresentable due instants; the unguarded normalization/predecessor paths need the same controlled boundary.

The global trigger-count assertion is deferred only under the current dedicated test layout. The pre-existing development date extreme remains a bounded error-handling limitation with atomic rollback. Formal clock tolerance, complete cohort provisioning, period procedures, assignment freeze validation and research activation remain later D11A gates. No tolerance, transition engine, enrollment behavior or formal acceptance policy was invented during review.

## 25. Git Status

Branch: `main`. HEAD: `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`. No staged changes. The following implementation/docs status was present before review; the independent report is the sole newly created file:

```text
 M backend/alembic/env.py
 M backend/app/database/session.py
 M backend/app/reviews/models.py
 M backend/app/reviews/service.py
 M backend/tests/conftest.py
 M backend/tests/content/test_provenance_migration.py
 M backend/tests/research_helpers.py
 M backend/tests/reviews/test_due_review.py
?? backend/alembic/versions/d11b00000001_scheduler_persistence.py
?? backend/app/research_authority/
?? backend/app/reviews/acceptance.py
?? backend/app/scheduling/research_contracts.py
?? backend/tests/reviews/test_d11b_acceptance.py
?? backend/tests/reviews/test_d11b_persistence.py
?? backend/tests/reviews/test_research_contracts.py
?? docs/development/d10-timing-fix-review-bundle.txt
?? docs/development/d11-esr-preimplementation-audit.md
?? docs/development/d11a-scheduler-contracts-spec.md
?? docs/development/d11b-implementation-review.md
?? docs/development/d11b-independent-code-review.md
?? docs/development/p01-pronunciation-preimplementation-audit.md
?? docs/development/p02-pronunciation-architecture-scoring-spec.md
?? docs/development/p02f-pronunciation-feasibility-report.md
```

The tracked diff remains eight files, 237 insertions and 193 deletions. No mobile, pronunciation, manuscript, dependency, lockfile, historical migration or existing evidence/specification document changed during review. The final SHA-256 comparison for all 242 pre-existing tracked/untracked files against the captured finalization baseline found zero changed or missing files; the new untracked report is the only added path. No staging, commit or push occurred.

## 26. Recommendation

Use D11B as the foundation for separately authorized D11C pure Binary SM-2 work, preserving closed research routing and the explicit gates above. Do not treat this review as formal research acceptance approval or permission to fix findings in this task.

**D11B INDEPENDENT CODE REVIEW PASS**
