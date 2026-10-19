# D11-T1-F1 Predecessor UTC Arithmetic Correction

## 1. Status

The C-01 correction and focused regressions are implemented. All requested verification passed. The result is ready for independent re-review; this report does not claim independent approval or activate research routing.

## 2. Baseline

The repository was on `main` at `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`. The working tree already contained the D11B/D11C/D11D/T1 work and prior D10/D11 documents as modified or untracked files. The index was empty. This task changed only `backend/app/reviews/acceptance.py` and `backend/tests/scheduling/test_research_time_boundaries.py`, and created this report.

## 3. C-01 Reproduction

Both findings reproduced against the original `validate_research_predecessor()` body before the fix, using the real function and complete config/state/identity fixtures:

- Case A (`9999-12-31T07:59:59.999999+08:00`, interval 86,400, stored due UTC `datetime.max`) returned HTTP 500 `D11_STATE_CORRUPT`, caused by `OverflowError`; the same UTC instant should be valid.
- Case B (`0001-01-01T00:00:00+08:00`, interval 86,400, stored due `0001-01-01T16:00:00Z`) returned a valid `EnhancedState`, even though the interaction has no representable UTC instant.

## 4. Root Cause

The validator added the interval to the stored datetime before establishing that its instant was representable in UTC. Python therefore used the local calendar representation: Case A crossed year 9999 and overflowed, while Case B's local addition succeeded and its due comparison passed.

## 5. UTC-Normalized Predecessor Arithmetic

After the existing identity, configuration, state, and interval checks, the validator now rejects a stored interaction without a usable timezone, converts the aware value to UTC in a local variable, and only then adds the stored interval. Due equality still uses the existing exact datetime comparison. The stored attempt, schedule, interval, state, and configuration are not modified.

## 6. Error Mapping

Naive interaction, UTC-unrepresentable interaction, UTC interval-addition overflow, and due mismatch all map to HTTP 500 `D11_STATE_CORRUPT`. Normalization and addition have separate `OverflowError` handlers. No broad exception handler, clamp, retry, or stored-time repair was added.

## 7. Offset Equivalence Tests

The UTC and +08 representations of the upper safe instant both return the same valid `EnhancedState`. Three fixed ordinary instants were each checked in UTC, +08, and -08 representations (nine validations); each set returned equivalent state. The impossible lower +08 instant now fails with `D11_STATE_CORRUPT`, chained from the UTC-normalization `OverflowError`. Success and failure snapshots verify stored facts remain unchanged.

## 8. Extreme Boundary Tests

- The UTC-safe predecessor at `datetime.max - 1 day` with an exact one-day interval reaches UTC `datetime.max` successfully, both in UTC and the equivalent +08 representation.
- The nearest valid +08 representation of UTC `datetime.min` remains valid with a one-day interval.
- Advancing the upper safe anchor by one microsecond produces a controlled state-corruption error; no rounding or one-microsecond reduction occurs.
- An exact 36,500-day interval ending at UTC `datetime.max` succeeds. Existing one-day and 36,500-day UTC overflow cases at `datetime.max` remain controlled as `D11_STATE_CORRUPT`.

## 9. M-04 Preservation

M-04 remains closed. FSRS library due overflow continues to map to `ResearchSchedulerResult` validation at `due_at` with type `due_anchor`. The complete boundary suite and FSRS suite passed, including first and subsequent Good/Again overflow coverage and the original Card/input immutability checks.

## 10. Scheduler Golden Regression

No scheduler source or expected fixture changed. SM-2 locked vectors remain Correct `1 / 6 / 15 / 38`, Incorrect ease `2.18 / 1.86 / 1.54 / 1.3`, and post-lapse `1 / 6 / 14`. FSRS remains first Good 2 days, first Again 1 day, and mixed `2 / 1 / 2 / 7 / 1 / 1 / 1 / 4`. The capture utility passed in `--check` mode only. Fixture SHA-256 remains `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6`.

## 11. Routing Closure

Research acceptance remains disconnected. The D11B acceptance, D11C routing, and D11D routing suites passed (32 tests); allocated-owner new review requests remain `503 D11_ROUTING_DISABLED` with no accepted-chain writes. Historical replay behavior remains covered by the acceptance suite.

## 12. Regression Results

- New C-01 focused group and retained predecessor overflow checks: **12 passed**.
- Complete `test_research_time_boundaries.py`: **50 passed** (the original 40 cases plus 10 new cases).
- Research contracts, SM-2, and FSRS: **188 passed**.
- D11B acceptance and D11C/D11D routing: **32 passed**.
- Full backend suite: **468 passed**, 2 existing deprecation warnings, in 77.06 seconds.
- Ruff: **passed** (`app`, `tests`, `scripts`).
- In-memory Python compilation: **passed**, 99 files.
- `uv lock --check --offline`: **passed**, 49 packages resolved; no lockfile change.
- `git diff --check`: **passed** (exit 0; Git printed existing LF-to-CRLF notices for four tracked files).

The test runner verified `fluentt_test` with private schema `d11b_21ec17a1c5`; it did not target D10 accepted evidence. The two test warnings are the existing Starlette/httpx TestClient and AnyIO BlockingPortal deprecations.

## 13. Remaining M-02/M-03

M-02 remains open/deferred for global D9 trigger-count isolation in shared multi-schema or parallel database verification. M-03 remains open/deferred for the pre-existing DevelopmentScheduler extreme-date overflow. Neither issue or its implementation was changed in F1.

## 14. Git Status

Branch remains `main`, HEAD remains `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`, and the index is empty. Pre-existing tracked D11 work and untracked D11/D10 documents remain present. The authorized source and test paths were already under untracked D11 directories at baseline; this task added only the report as a new path. Nothing was staged, committed, or pushed.

## 15. Recommendation

**D11-T1-F1 READY FOR INDEPENDENT RE-REVIEW.** C-01 now validates the stored instant in UTC before interval arithmetic. M-04 remains closed, routing remains closed, and M-02/M-03 remain deferred.
