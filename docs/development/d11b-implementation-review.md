# D11B ESR Persistence & Serialized Acceptance Implementation Review

## Executive Summary

PASS — D11B READY FOR CODE REVIEW. Fresh read-only review found no Critical/Important issues and one nonblocking UTC-boundary validation issue, deferred before research integration. Final resumed full regression: 268 passed, 2 existing warnings (133.40s). This milestone adds persistence, validation and serialized acceptance scaffolding. Formal research scheduling remains closed: an enrolled owner receives 503 `D11_ROUTING_DISABLED`; no SM-2/FSRS transition engine is executable. No dependency, mobile, pronunciation or manuscript changes.

## Baseline

`main`, HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; no tracked/staged edits at start. Six existing evidence/spec artifacts protected by SHA-256. User explicitly selected this checkout/branch and prohibited commits/pushes; work proceeds in place.

Start SHA-256 values, independently rechecked unchanged after implementation:

| Protected untracked artifact (`docs/development/`) | SHA-256 |
| --- | --- |
| d10-timing-fix-review-bundle.txt | `52d8bcbdac46b294828c2c687401eb577f5714630de2e9de26f809b448a787c2` |
| d11-esr-preimplementation-audit.md | `85e101ca11b799a8f0c2965d546571ffbceb3f80d90aba3e6cdaf510288b5c26` |
| d11a-scheduler-contracts-spec.md | `5e4f3869fde26b4cc2fda7ab3a097c1005e4cfef89695f2b8c8413550907e1b9` |
| p01-pronunciation-preimplementation-audit.md | `e0ad69a496f828fb788b182e23b063e12989b7b13b531f331a85b5c66e9a75c0` |
| p02-pronunciation-architecture-scoring-spec.md | `89554623a1eb8712cac3905da8d350606a8da026855bdd15cbded4b34c44011b` |
| p02f-pronunciation-feasibility-report.md | `bbbb210c38e9dcac9afc6116268242877ed68addadb701708fbfc25ba4ebae2a` |

Execution ledger (user's two-phase plan; authority: D11A):

- B-1 persistence/contracts: complete. Initial full run exposed two fixture failures, corrected without changing production contracts.
- B-1 focused and full backend gate: PASS. Focused contracts/persistence/D9/content migration: 106 passed (29.54s). Full `pytest -q --tb=short`: 243 passed, two existing dependency deprecations (73.06s). B-2 starts only after this green result.
- B-2 serialization/routing: PASS. Focused D11B 95 passed (25.07s); full post-B-2 suite 268 passed (103.17s).
- Final review: PASS for D11B readiness; one fresh reviewer inspected tracked and untracked backend files, no Critical/Important issues. The same review resumed after a usage-limit interruption; no second review was dispatched. Final resumed regression: PASS, 268 tests (133.40s), two existing warnings. Lint/static/whitespace/evidence hashes also rechecked PASS on 2026-10-17.
- Ruling: use the requested main checkout and this review document as the progress ledger; no additional tracked plan/worktree or commits. The user's explicit workspace/change boundary takes precedence over skill defaults. Cost if wrong: local changes share the requested checkout; independent review must assess the working tree.
- Ruling: PostgreSQL test role lacks CREATEDB but can create schemas. Use a fresh private `d11b_*` schema inside the existing `fluentt_test`, with search_path excluding public, instead of creating a database. The harness verifies both names; no D10 database is used. Migration/concurrency tests still exercise real PostgreSQL. Cost if wrong: schema isolation could miss database-wide behavior; a discovered limitation must be reported rather than bypassing isolation.
- Ruling: the D5 migration regression must first downgrade the empty later D11 authority schema inside its rollbackable savepoint, then restore it after D5 upgrade. This respects actual FK dependency order without editing historical migrations or changing its legacy-preservation assertions; if wrong, the isolated migration test fails.
- Ruling: explicit development authority uses the existing server `APP_ENV` (`development` or `testing`) and requires no research allocation for that owner. Any test/formal enrollment closes development work for the whole owner, rather than guessing at mixed account semantics. Cost if wrong: mixed-use accounts are unavailable until separately designed; use isolated development accounts.
- Ruling: move the existing D7 race rendezvous from inside the injected scheduler to before acceptance, as D11A explicitly requires. A barrier inside the now-serialized calculation would deadlock the test. Existing D7 result/count assertions are retained; additional races observe real PostgreSQL blocking and fresh predecessors. Cost if wrong: a weaker original race harness could hide concurrency regressions; the controlled PostgreSQL wait/fresh-state tests are the backstop.
- Final: minor (deferred): extreme aware datetime boundaries can overflow UTC normalization in `research_contracts._utc` and `acceptance.validate_research_chronology`. Both the reviewer and implementer independently confirmed `datetime.min` at UTC+08 and `datetime.max` at UTC-08 raise bare OverflowError. These helpers are disconnected from development acceptance; correct their controlled validation/error mapping before research integration. No D11B runtime scheduling impact or accepted evidence mutation.
- Final: Ruling: research transitions, counter causality, pinned FSRS integration and numeric goldens remain D11C/D11D work — no research engine exists in D11B — cost if wrong: unsupported algorithm claims; formal activation remains closed.
- Final: Ruling: cohort provisioning/randomization, balance, final vocabulary and complete enrollment/freeze workflows remain deferred — D11B seeds no participant authority — cost if wrong: invalid study enrollment; provision nothing until separately approved.
- Final: Ruling: formal clock tolerance, period enforcement, research session-item constraints and research eligibility/activation remain deferred — the formal route always fails closed — cost if wrong: invalid research timing/session behavior; these are activation gates, not enabled defaults.
- Final: Ruling: sealing complete protocol aggregates against later additions and coordinating live provisioning/downgrade are deferred to the provisioning/deployment workflow — D11B supplies immutable records and integrity bindings, with no provisioning endpoint — cost if wrong: prematurely opened provisioning could change an aggregate after freeze; keep provisioning/activation closed until coordinated.
- Final: Ruling: legacy canonical-link backfills and a future research error envelope/raw-state ingestion boundary remain out of scope — preserve historical unknowns and the existing wire contract — cost if wrong: misclassified future ingestion faults; future integration must supply its boundary without rewriting history.
- Final: Ruling: retain the requested unstaged checkout/report with no merge/commit/push — the user already selected this outcome, overriding the finishing skill's integration menu — cost if wrong: work remains local pending independent human review.

## Files Changed

Modified tracked files (8):

- `backend/alembic/env.py`: register authority metadata.
- `backend/app/database/session.py`: register authority models.
- `backend/app/reviews/models.py`: BIGINT and nullable owner/identity-bound assignment provenance.
- `backend/app/reviews/service.py`: preflight/explicit READ COMMITTED acceptance, learner lock, replay recheck, explicit authority; preserve evidence construction.
- `backend/tests/conftest.py`: apply real D11 migration to pre-existing isolated test schemas.
- `backend/tests/content/test_provenance_migration.py`: remove/restore later D11 dependencies within the D5 test's savepoint.
- `backend/tests/research_helpers.py`: test-only frozen-authority fixture cleanup, restricted to `*_test` databases.
- `backend/tests/reviews/test_due_review.py`: race rendezvous before acceptance/lock.

New backend files (11):

- `backend/alembic/versions/d11b00000001_scheduler_persistence.py`
- `backend/app/research_authority/__init__.py`
- `backend/app/research_authority/config_v1.py`
- `backend/app/research_authority/schema_v1.py`
- `backend/app/research_authority/integrity_v1.py`
- `backend/app/research_authority/models.py`
- `backend/app/reviews/acceptance.py`
- `backend/app/scheduling/research_contracts.py`
- `backend/tests/reviews/test_d11b_persistence.py`
- `backend/tests/reviews/test_research_contracts.py`
- `backend/tests/reviews/test_d11b_acceptance.py`

New report: this file, intentionally UNTRACKED. Existing six untracked artifacts are excluded from this implementation inventory.

## BIGINT Migration

PASS. Revision `d11b00000001`, parent `d9c0de000001`, widens `review_schedules.interval_seconds` without updating historical records. The model uses BigInteger. A new storage-only fixture stores 3,153,600,000 seconds, while the existing accepted 600-second development chain and pointer remain unchanged. Downgrade refuses values outside INTEGER and refuses populated research authority. Upgrade preflights unsupported pre-existing research labels, rather than manufacturing assignment provenance. Historical migrations are untouched.

## Scheduler Contract / State Validators

PASS with the deferred UTC-boundary limitation below. Strict application-owned identity/input/result/state contracts reject extras, bool counters, unknown identities/configurations, nonfinite and unreachable memory. Inputs have exactly four fields; results have exactly eight fields. Research state has exactly five envelope keys. EF validation uses Decimal; FSRS memory is limited to Review/null step/stability/difficulty. Result checks whole days, exact seconds, matching identity/memory and interaction-anchored representable due time. Frozen nested models isolate validated state from input dictionaries. No engine/third-party Card import or transition entry point.

## Frozen Configuration Persistence

PASS. `scheduler_configurations` stores the exact two canonical D11A documents, identity tuples and frozen SHA-256 bindings. Tests independently decode/recanonicalize the stored documents and reproduce the literal D11A digests. Database checks bind the canonical bytes/digest and supported identity; UPDATE/DELETE/TRUNCATE guards prevent silent mutation. Versioned schema/config/DDL modules are frozen migration dependencies, not mutable aliases.

## Research Authority Persistence

PASS. Additive protocol, A/B sets, exact release/item/revision membership, participant allocation and per-set condition tables. Composite foreign keys bind owner/allocation/protocol/set/config identity. A protocol/logical-item primary key makes A/B membership disjoint; an insert trigger verifies actual immutable release manifest membership. Mapping groups 1/2 enforce the specified opposite A/B algorithms. `period_order` independently records both exact set UUIDs once. All six authority tables reject UPDATE/DELETE/TRUNCATE. Only configurations are seeded: no production protocol, sets, cohort or randomization is provisioned.

## Attempt Assignment Provenance

PASS. Nullable `review_attempts.research_assignment_id` points to the immutable participant-set condition. Composite FK binds assignment, owner, scheduler type and algorithm. A conditional check requires assignment for research labels and leaves historical/development values NULL; exact release/item/revision membership is checked on insert. Wrong user/set/config fixtures are rejected by PostgreSQL. No backfill/relabeling of history.

## Explicit Development Routing

PASS. New work resolves authority under the learner lock. Only explicit server development/testing environment plus an unenrolled owner permits dev-0.1. Any research allocation (test or formal), unsupported environment or non-test injection returns 503 `D11_ROUTING_DISABLED`. Injection is restricted to DevelopmentScheduler subclasses in testing, and its output identity is checked before staging evidence. No research activation flag, client scheduler selector or mobile field exists.

## Acceptance Transaction Boundary

PASS. Accepted lookup is first. Exact immutable content and owner/session identity resolve in preflight; only session creation may commit there. Scalar provenance crosses the boundary; rollback ends any preflight/refresh autobegin before the explicit acceptance transaction. Under READ COMMITTED: user lock, fresh replay lookup, authority, fresh predecessor, session revalidation, development calculation and one atomic D9 chain. Persistence helper stages only; no nested commits. Database refresh inside the transaction retains historical response timestamp representation; commit releases the lock. Unrelated pending session writes are rejected rather than committed by preflight.

## Learner Locking

PASS. `SELECT users.id ... FOR UPDATE`, solely for the authenticated owner, before predecessor/history reads and calculation. Lock is held until the acceptance transaction commits/rolls back. An absent item pointer still has the user row lock. Real PostgreSQL tests observe the second connection's `pg_blocking_pids`; different learners remain concurrent. No network call, global/distributed lock or second learner lock is introduced.

## Replay / Idempotency

PASS. Owner/event lookup before content, assignment, strict state/time checks or scheduler entry. The same lookup repeats immediately after obtaining the learner lock. Accepted replay returns the original linked chain, leaves current pointer unchanged and never recalculates. Invalid linked accepted evidence fails as integrity, never as new work. Only SQLSTATE 23505 for `uq_user_client_event_id` may enter winner recovery; unrelated unique violations propagate after rollback. Serialization/deadlock/lock timeout conditions map to retryable 503 `D11_TRANSACTION_RETRY`, without an engine retry loop.

## Predecessor / Chronology Infrastructure

PASS. Fresh current pointer/schedule/linked attempt/accepted ledger loading validates owner/item/identity and distinguishes genuine first item from absent pointer with history, dangling/malformed current chain and partial history. Development state remains descriptive dev-0.1 JSON. A separate future research predecessor validator checks assignment/config digest, envelope/memory identity, answer/SM-2 repetition consistency, whole-day interval and due anchor. The pure chronology helper normalizes aware instants and requires strict increase (equal/earlier -> 409 `D11_STALE_INTERACTION`, naive -> 422 `D11_TIMEZONE_REQUIRED`). A separate future-clock policy hook fails 503 when absent; no formal numeric tolerance is invented. Research helpers are not activated by acceptance.

## Legacy Compatibility

PASS in the full backend suite. Development Correct -> 86400, Incorrect -> 600; no research envelope, chronology backfill, historical conversion or new blanket session uniqueness. Existing D7 backdated later acceptance behavior is retained. D8 timing and content provenance construction are preserved. D9 immutable guards and canonical item-attempt events remain active.

## Sync / Offline Compatibility

PASS in shared-path regressions. Online and sync still call the same per-event service. Original queued development facts, timing metadata and accepted identities are preserved; lost-ack replay produces no extra schedule or pointer regression. No mobile queue/storage or payload serializer is changed, and no condition/audio field is added. Existing online/sync canonical metadata tests assert first response equals replay.

## Migration Verification

PASS in real PostgreSQL private schema `d11b_21ec17a1c5` inside `fluentt_test`, search_path excluding public. Tests exercise the actual new migration downgrade/upgrade in savepoints over accepted development evidence, comparing all five chain tables and pointer. D9 row immutability remains active; D5/D7/D8/D9 regression migrations remain unchanged. Additional disposable-schema smoke test: full Alembic base -> head, D11 downgrade -> `d9c0de000001`, re-upgrade -> head all PASS; verified BIGINT, 2 configurations, 0 protocols. That smoke schema was removed afterward. No migration is applied to D10/device/development databases.

## Concurrency Verification

PASS. Eight controlled wait/recheck races cover duplicate/distinct events, existing/absent first pointer, same/different items for one learner. Duplicate loser returns exactly the winner's attempt/schedule with one total scheduler entry. Distinct same-item loser loads the newly committed predecessor; a different item independently starts with no predecessor after waiting on the same learner lock. Separate learners proceed while one scheduler is held. Injected failure after flushing the final event restores all chain counts and pointer; SQLSTATE failures and unrelated uniqueness have explicit rollback/error tests. These are development acceptance scaffolding tests, not SM-2/FSRS transition-concurrency claims.

## Full Regression Results

PASS. Baseline: 173 passed (48.65s). B-1 gate: 243 passed (73.06s). Focused D11B: 95 passed (25.07s); focused B-2/D7/D9/sync: 90 passed (28.46s). Full post-B-2 `pytest -q --tb=short`: 268 passed, 2 warnings in 103.17s. Final fresh rerun on 2026-10-17 using the same isolated schema: **268 passed, 2 warnings in 133.40s (0:02:13)**, exit 0. Two existing dependency warnings: Starlette/httpx deprecation and anyio BlockingPortal alias deprecation.

Backend commands run from `backend`, with a temporary external harness directing both DATABASE_URL and TEST_DATABASE_URL only to the private `*_test` schema:

- `pytest -q tests/reviews/test_d11b_acceptance.py tests/reviews/test_d11b_persistence.py tests/reviews/test_research_contracts.py --tb=short`
- `pytest -q --tb=short`
- `ruff check app tests scripts`: PASS, All checks passed (exit 0).
- Static compilation without writing bytecode: PASS, 83 Python files.

Dedicated type checker: NOT RUN; none is configured in repository backend dependencies. Mobile tests: NOT RUN, source and wire contract unchanged, backend online/sync regressions cover compatibility. Fresh lint including the new migration: PASS. Static compilation: PASS, 83 files, no bytecode written. Git whitespace check: PASS. Existing LF/CRLF advisory messages are not whitespace errors.

## Remaining D11C/D11D Work

Pure SM-2/FSRS transitions, pinned FSRS integration/runtime goldens and separately approved activation remain DEFERRED. No formal accounts/content are provisioned here.

## Known Limitations

DEFERRED: research transition engines/output goldens, engine transition/counter causality checks, clean enrollment/provisioning workflow with the same learner-lock discipline, approved formal vocabulary/equivalence, frozen clock policy and formal deployment activation. Future research scheduling is intentionally unavailable. No claim of participant-time/FSRS behavior is made.

Test isolation uses a private PostgreSQL schema rather than a new database because the existing role cannot CREATEDB; native D10 evidence is not a test target. Backend tests require installed Python 3.13 virtual environment and PostgreSQL.

Fresh independent read-only review: no Critical/Important issues. One independently reproduced minor remains DEFERRED: out-of-UTC-range aware instants at datetime min/max escape normalization as OverflowError. Convert those into controlled contract validation errors and incoming/stored D11 time errors before connecting the research helpers. Current development acceptance does not invoke them. No claim that these helpers already handle every extreme UTC conversion is made.

## Git Status

`main`; HEAD remains `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`. No staging, commit or push. Eight tracked backend files modified; eleven new backend files and this report untracked. The prior six untracked artifacts remain present and byte-identical; final SHA-256 checks against the start values PASS. No mobile, pronunciation, manuscript, manifests, dependencies, lockfiles or historical migration modifications. No D10 device/database evidence was used as a test target.

Final `git status --short`:

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
?? docs/development/p01-pronunciation-preimplementation-audit.md
?? docs/development/p02-pronunciation-architecture-scoring-spec.md
?? docs/development/p02f-pronunciation-feasibility-report.md
```

## Recommendation

**D11B READY FOR CODE REVIEW**

No blocking D11B issue remains. Keep formal research routing CLOSED. The one deferred minor must be addressed before connecting the research helpers. D11C/D11D engines, numeric goldens, provisioning/content approval and formal policy/activation gates require separately authorized work. All changes remain local and unstaged; this report remains untracked.
