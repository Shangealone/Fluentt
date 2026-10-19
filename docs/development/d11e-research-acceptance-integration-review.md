# D11E Research Assignment and Acceptance Integration Review

## 1. Status

**D11E READY FOR CODE REVIEW.** Test-authority research acceptance is integrated through the existing D11B persistence model. Formal/live routing remains closed. No migration, mobile wire change, commit, or push was made.

## 2. Baseline

- Branch: `main`
- HEAD: `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`
- The index was empty at the start of D11E. The worktree already contained D10 and D11B/C/D/T1 implementation and evidence files from earlier milestones; those existing changes were preserved.
- No D11E implementation or report file existed at the start.

## 3. Existing Authority Model

D11B already provides immutable `ResearchProtocol` records with `mode` values `test` and `formal`, frozen participant allocations, two set-condition mappings, exact release/item/revision membership, immutable scheduler configurations, and `ReviewAttempt.research_assignment_id` provenance. PostgreSQL guards prevent changes to frozen authority and validate attempt membership. That schema represents the required D11E assignment/provenance chain, so D11E added no migration.

## 4. Files Changed

- `backend/app/reviews/acceptance.py` — test-only authority resolution, frozen mapping/config validation, exact dispatch, and assignment-time validation.
- `backend/app/reviews/service.py` — shared online/sync research acceptance branch and atomic persistence.
- `backend/tests/reviews/test_d11e_acceptance.py` — focused D11E integration, rollback, replay, engine-isolation, and concurrency coverage.
- `backend/tests/reviews/test_d11b_persistence.py` and `backend/tests/reviews/test_due_review.py` — optional test-fixture identity, freeze-time, mode, and policy inputs.
- `backend/tests/reviews/test_d11b_acceptance.py`, `test_d11c_routing.py`, and `test_d11d_routing.py` — closed-routing expectations now distinguish an absent test clock policy (`D11_CLOCK_POLICY_UNAVAILABLE`).
- This review report.

No D11E changes were made to migrations, scheduler engines, mobile code, dependencies, or lockfiles.

## 5. Research Routing Gate

Development routing remains available only when the learner has no research allocation. Research routing requires `APP_ENV=testing`, a frozen protocol whose authoritative `mode` is `test`, a complete two-set allocation, exact item/revision/release membership, and the explicit `test-no-future-v1` clock-policy reference. Test assignments without that policy fail with `503 D11_CLOCK_POLICY_UNAVAILABLE`. Any `formal` allocation fails with `503 D11_ROUTING_DISABLED`; there is no formal policy or environment override that opens it.

The test policy admits no future interaction time (`interaction_at <= captured backend_now`); it introduces no positive skew allowance or grace period.

## 6. Assignment Resolution

Assignment lookup occurs after the second replay check and learner lock. It binds authenticated owner, protocol/version, exact content release, logical item, and revision to one condition. Ambiguous mappings and incomplete set/condition mappings fail closed. Mapping group 1 assigns Enhanced to Set A and Conventional to Set B; group 2 reverses that mapping. Stored period order is validated separately and does not select the scheduler. The incoming interaction must not predate protocol approval/freeze or allocation freeze.

## 7. Scheduler Dispatch

Only the assignment’s exact `(scheduler_type, algorithm_version, state_schema_version, config_version)` tuple selects an engine:

- `("conventional_srs", "sm2-binary-v1", 1, "sm2-binary-config-v1")` → `BinarySm2Scheduler`
- `("enhanced_srs", "fluentt-esr-fsrs6-binary-v1", 1, "fsrs6-binary-r90-config-v1")` → `EnhancedFsrsScheduler`

Configuration identity and SHA-256 are checked against the frozen configuration. Unknown identities fail closed; no development fallback exists on the research branch.

## 8. Conventional Integration

Literal integration assertions passed: first Correct produces 86,400 seconds / one day; subsequent Correct from the authoritative predecessor produces six days; first Incorrect produces one day with EF `2.18`, repetition count `0`, and lapse count `1`. Attempts retain the selected condition ID.

## 9. Enhanced Integration

Pinned first Correct integration output passed: Review/null, stability `2.3065`, difficulty `2.118103970459016`, interval two days. First Incorrect passed with stability `0.212`, difficulty `6.4133`, interval one day. Subsequent reconstruction was observed to use the stored predecessor state, linked interaction time, and current schedule due date despite client-supplied selector/predecessor fields.

## 10. Predecessor Reconstruction

The current pointer and linked attempt/schedule are read after the learner lock. Existing D11B integrity checks validate owner, assignment, scheduler identity, configuration, state envelope, interval, and interaction-anchored due. Conventional state cannot seed Enhanced, or vice versa. Enhanced reconstruction receives server-derived user/item IDs and predecessor due; the conventional engine receives only the reviewed mathematical input.

## 11. Idempotency

Replay remains first before provenance, assignment, chronology, due listing, or scheduler work, then is rechecked after the learner lock. Replay returns the linked original attempt/schedule. Online and sync share `record_review_attempt`; duplicate sync events add no attempt, schedule, accepted event, research event, or pointer transition.

## 12. Concurrency

The integration test uses two PostgreSQL sessions and the actual `SELECT users.id ... FOR UPDATE` path. It confirms through `pg_blocking_pids` that the second backend is blocked by the first, then verifies that the second predecessor read sees the first committed schedule. Both conventional transitions commit in chronological order, and the current pointer references the second schedule.

## 13. Immutable Evidence Chain

One transaction stages one `ReviewAttempt`, one `ReviewSchedule`, one `AcceptedClientEvent`, the linked `REVIEW_ANSWERED` and `REVIEW_SCHEDULED` rows, and the current-pointer update. Research event payloads remain exactly `{"scope":"item_attempt"}`. Failure injection after scheduler calculation, attempt, schedule, accepted event, research-event staging, and pointer staging rolls back the complete chain.

## 14. Assignment Provenance

The accepted attempt stores the existing `research_assignment_id` reference. Its immutable condition resolves the allocation, protocol, set, assigned scheduler identity, and configuration digest. Historical development attempts retain null assignment provenance and are not relabeled or backfilled.

## 15. Offline Sync

The mobile request shape is unchanged. Online and sync acceptance resolve the same assignment on the server; the test compares identical authoritative scheduler output despite different response-time evidence and an extra pronunciation field. Sync replay is idempotent.

## 16. Formal Routing Closure

A `formal` participant authority with incomplete conditions still returns `503 D11_ROUTING_DISABLED` and produces zero accepted-chain writes. Test mode without its explicit policy also fails closed. No formal Set A/B content or live enrollment was activated.

## 17. Failure Atomicity

All six staged failure points leave zero attempt, schedule, accepted-event, pointer, or research-event rows. A cross-condition predecessor state fails with `D11_STATE_IDENTITY_UNSUPPORTED`. A mutated scheduler state is rejected by contract validation before persistence. No scheduler failure is caught and redirected to development.

## 18. Mobile Contract

No mobile files changed. `ReviewAttemptCreate` has no scheduler condition selector. Extra client fields cannot affect dispatch; the assigned conventional condition remained conventional when the request supplied Enhanced selectors. `ResearchSchedulerInput` contains only correctness, UTC interaction, prior state, and prior interaction. `response_time_ms` remains persisted evidence and does not enter either research engine; pronunciation fields are absent from the acceptance/scheduler path. Existing eligibility listing continues to omit a future-due schedule; no new grace or acceptance-time due rule was invented.

## 19. Regression Results

- D11E focused integration: **25 passed**.
- Time boundaries, research contracts, SM-2, and FSRS: **238 passed**.
- Existing D11B acceptance plus D11C/D11D routing: **32 passed**.
- Full backend suite: **493 passed** (`pytest -q --tb=short`, isolated `fluentt_test` schema).
- FSRS capture `--check`: **PASS**, pinned direct-library golden reproduction.
- Ruff: **PASS**, all checks passed.
- Static Python compilation: **PASS**, 100 Python files compiled in memory.
- `uv lock --check --offline`: **PASS**, 49 packages resolved; lockfile unchanged.
- `git diff --check`: **PASS** (Git emitted only existing LF-to-CRLF working-copy warnings).

Pytest displayed two Starlette/httpx deprecation warnings; there were no test failures.

## 20. Deferred M-02/M-03

M-02 remains deferred; tests continue using the existing dedicated-schema runner. No shared/parallel multi-schema topology was introduced. M-03 remains deferred; `DevelopmentScheduler` extreme-date behavior was not changed.

## 21. Git Status

- Branch and HEAD remain the baseline values above; `main` is not ahead/behind `origin/main`.
- No files were staged. No commit or push was made.
- The worktree retains pre-existing D10/D11/P01/P02 files and changes, plus the D11E files listed in section 4. The new report and D11E integration test are untracked.
- No migration file was added by D11E.

## 22. Recommendation

**D11E READY FOR CODE REVIEW.** This approves only the test-authority acceptance integration for independent source review. Formal/live research remains closed; D11 overall readiness and M-02/M-03 status are unchanged.
