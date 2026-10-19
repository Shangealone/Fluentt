# D11-T1-F1 Independent Predecessor UTC Re-Review

## 1. Verdict

**PASS.** C-01 is closed by the F1 correction. There are no code findings; one non-blocking automated coverage note is recorded in section 15. The complete backend suite and all requested focused checks passed.

## 2. Scope

Read the complete `validate_research_predecessor()` body, its chronology boundary, the D11A time contract, the original C-01 review, the F1 correction report, the T1 implementation report, the research contracts, FSRS and SM-2 adapters, all 50 time-boundary cases, and the acceptance/routing tests. Reviewed due comparison semantics, exception scope, routing references, and the unchanged `DevelopmentScheduler`.

The repository was on `main` at `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`. The index was empty. This review creates only this report; no implementation, test, fixture, or existing report was edited.

## 3. Original C-01 Reproduction

The pre-F1 independent review recorded the original production outcomes. A read-only in-memory check of the former local-date expression reproduced both signatures: Case A's local +08 addition raises `OverflowError`; Case B's local +08 addition produces a due equal to the stored UTC instant despite that interaction having no representable UTC value.

Against the current production validator, the UTC control and equivalent +08 Case B both return a valid `EnhancedState`, with equal values and no error. Case C is rejected during UTC normalization as described below.

## 4. UTC-Normalized Arithmetic

The complete function retains identity, configuration, state, and interval validation outside the time handlers. Its time order is:

1. Reject a stored interaction with no usable timezone as `D11_STATE_CORRUPT`.
2. Normalize the stored interaction into a local UTC value; map normalization `OverflowError` to `D11_STATE_CORRUPT`.
3. Add the unchanged interval only to that normalized UTC value; map addition `OverflowError` separately to `D11_STATE_CORRUPT`.
4. Compare the resulting due with the authoritative stored due.

No interval arithmetic uses `a.client_interaction_at` or another raw/local representation. There is no clamp, reanchor, interval change, or scheduler-math change.

## 5. Equivalent Offset Semantics

The UTC upper-safe control (`9999-12-30T23:59:59.999999Z`) and its `+08:00` representation (`9999-12-31T07:59:59.999999+08:00`) both validate against UTC `datetime.max` with an 86,400-second interval and return value-equivalent states.

Independent real-validator probes also used two fixed ordinary instants in UTC, `+08:00`, and `-08:00`, with 1-, 7-, and 36,500-day intervals. All 18 validations returned identical application state. The stored due was represented at alternate offsets in these probes as well; exact same-instant due values were accepted. The result contract's `UtcDatetime` validator normalizes due values before persistence, and the comparison here preserves exact aware-datetime instant equality.

## 6. Impossible Stored UTC Instants

`0001-01-01T00:00:00+08:00` fails with HTTP 500 `D11_STATE_CORRUPT`. The chained cause is the UTC-normalization `OverflowError`. Its otherwise representable local one-day due does not get compared, and the predecessor/assignment snapshots remain unchanged. It is not classified as a client 422.

## 7. Upper Arithmetic Boundaries

UTC `datetime.max` plus either 86,400 or 3,153,600,000 seconds returns controlled HTTP 500 `D11_STATE_CORRUPT`, with the original `OverflowError` chained. There is no raw overflow, interval reduction, or `datetime.max` clamp. The one-microsecond step after the one-day max-safe anchor is also rejected as a controlled overflow.

## 8. Exact 36500-Day Boundary

`datetime.max - timedelta(days=36500)` with interval 3,153,600,000 seconds and stored due exactly `datetime.max` validates. Moving the interaction forward by one microsecond returns controlled `D11_STATE_CORRUPT` with chained `OverflowError`. The exact cap and its adjacent unsafe instant were both exercised against the real validator; neither is rounded or clamped.

## 9. Mutation / Error Mapping

Success and failure probes snapshot the attempt's interaction, schedule interval/due/state, and assignment/configuration facts. Values remain equal afterward. The test suite also snapshots all predecessor fields around the one-day and 36,500-day overflow failures.

Stored naive interaction, impossible UTC normalization, UTC addition overflow, and due mismatch map to HTTP 500 `D11_STATE_CORRUPT`. Separate chronology checks retain: incoming unrepresentable time → 422 `D11_TIME_INVALID`; stored unrepresentable/naive prior → 500 `D11_STATE_CORRUPT`; incoming naive → 422 `D11_TIMEZONE_REQUIRED`; equal/earlier interaction → 409 `D11_STALE_INTERACTION`. No future-clock tolerance was added.

## 10. M-04 Preservation

M-04 remains closed. The real FSRS library's first and subsequent Good/Again due overflows still produce `ResearchSchedulerResult` validation errors at `due_at`, type `due_anchor`. Existing spies assert one library transition, no retry, and no input/Card mutation. Exact safe results remain intact.

## 11. Scheduler Golden Regression

SM-2 remains Correct `1 / 6 / 15 / 38`, Incorrect ease `2.18 / 1.86 / 1.54 / 1.3 / 1.3`, and post-lapse `1 / 6 / 14`. FSRS remains first Good 2 days with stability `2.3065` and difficulty `2.118103970459016`; first Again 1 day with stability `0.212` and difficulty `6.4133`; mixed intervals `2 / 1 / 2 / 7 / 1 / 1 / 1 / 4`.

The capture utility passed in `--check` mode only. Fixture SHA-256 is unchanged at `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6`.

## 12. Routing Closure

Production search finds `BinarySm2Scheduler` and `EnhancedFsrsScheduler` only in their definitions; neither is wired into `record_review_attempt`, `sync_review_events`, or `resolve_development_authority`. Online and sync acceptance still resolve through the development authority boundary. The acceptance and D11C/D11D routing suites passed and assert `503 D11_ROUTING_DISABLED` with zero attempt, schedule, accepted-event, pointer, and research-event counts. Historical replay remains covered by acceptance tests.

## 13. Test Quality

The 10 new F1 boundary test cases call the real `validate_research_predecessor()` function with fixed values and valid config/state/identity fixtures. They cover UTC and equivalent +08 upper-safe values, impossible lower +08 normalization, ordinary UTC/+08/-08 invariance, nearest valid +08 at UTC minimum, the one-day upper overflow edge, and the exact 36,500-day safe cap. The retained predecessor overflow test covers both 86,400 and 3,153,600,000 seconds from UTC `datetime.max`. The config reader is a read-only test double; it does not replace predecessor validation.

The persistent offset-invariance test uses a one-day interval, and the persistent one-microsecond failure is adjacent to the one-day maximum-safe anchor. Independent direct probes extended offset invariance to 1, 7, and 36,500 days, alternate-offset stored dues, and the one-microsecond-over-cap case; all passed. These additional probes are recorded as a non-blocking coverage note below.

## 14. Regression Results

- F1-focused regressions and retained predecessor overflow cases: **12 passed**.
- Complete `test_research_time_boundaries.py`: **50 passed**.
- Research contracts, SM-2, and FSRS suites: **188 passed**.
- D11B acceptance and D11C/D11D routing suites: **32 passed**.
- Full backend suite: **468 passed**, 2 existing deprecation warnings, in 76.08 seconds.
- FSRS fixture capture `--check`: **passed**, no rewrite.
- Ruff: **passed** (`app`, `tests`, `scripts`).
- In-memory Python compilation: **passed**, 99 files.
- `uv lock --check --offline`: **passed**, 49 packages.
- `git diff --check`: **passed**; Git printed existing LF-to-CRLF notices for four tracked files.

Tests used `fluentt_test` with private schema `d11b_21ec17a1c5`, not D10 accepted evidence. The two warnings are the existing Starlette/httpx TestClient and AnyIO BlockingPortal deprecations. One supplemental probe initially asserted that a due mismatch should have an overflow cause; the validator correctly returned `D11_STATE_CORRUPT` without an overflow cause. The probe was corrected to check mismatch and arithmetic overflow separately; all required tests and corrected probes passed.

## 15. Findings

**CRITICAL: 0. IMPORTANT: 0. MINOR: 0. NOTE: 1.** No timezone-representation-dependent predecessor result, impossible UTC acceptance, raw targeted overflow, routing activation, or remaining correctness issue was found.

- **N-01 — non-blocking automated coverage:** the persistent equivalence test uses one interval, and the persistent adjacent-microsecond assertion targets the one-day edge rather than the 36,500-day edge. The direct independent probes exercised multiple intervals and the 36,500-day +1-microsecond boundary successfully. This is a test-maintenance note, not a behavioral finding or a re-review blocker.

## 16. M-01/M-04 Disposition

- **M-01: CLOSED by F1**, independently verified here. Predecessor normalization, UTC arithmetic, overflow classification, and equivalent-offset behavior meet the D11A time contract.
- **M-04: CLOSED**, independently reconfirmed. Real FSRS transition overflow remains a controlled result-domain validation failure.

## 17. Remaining M-02/M-03

- **M-02: OPEN / DEFERRED.** The global D9 trigger-count isolation limitation remains outside F1.
- **M-03: OPEN / DEFERRED.** `DevelopmentScheduler` is unchanged from HEAD and remains outside F1. Its known extreme-date behavior is not counted as a new finding.

## 18. Git Status

Branch `main`; HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; index empty. Existing D11 work remained present throughout. The review-start tree contained 261 visible, non-ignored files and had aggregate SHA-256 `c05c3cb0f44913df4c1c231a7d0d6f088493f1d217b3c296f2ec84a6ed327b12`.

Review-start SHA-256 values for the audited files:

| File | SHA-256 |
| --- | --- |
| `backend/app/reviews/acceptance.py` | `dc0c17c88e49bd53101d89f6bc4aaf6da7ad6c10e3ca3f5a1a1e8bb4f61c5685` |
| `backend/tests/scheduling/test_research_time_boundaries.py` | `f141b9bedc72b18ccf107fe7f1f49f42a8f7b9acd00a0a6b819dd3e340402712` |
| `backend/app/scheduling/research_contracts.py` | `a23adf8856e9f4d10950dcbd409bb9800a384fb0019567e9986c607d3b97b781` |
| `backend/app/scheduling/fsrs6.py` | `ae55c25605ed748e8341d69f00a484921988db921477e58f82b12b3920272f52` |
| `backend/app/scheduling/sm2.py` | `02491e6e347e9fa3cf4c01dad17899b998475e453bd89b414269a3b10ceed48d` |
| `backend/app/scheduling/development.py` | `6a175fe574e33f8409a8e2b9952f5acfefe98dcbeae4f892e4feda63cfa9ca0c` |
| `backend/tests/scheduling/fixtures/fsrs6_6_3_2_goldens.json` | `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6` |
| `docs/development/d11-t1-independent-code-review.md` | `ad15c9122562885e1f1a7b6a0939f7432ddfd216068441fbc49561e886f48651` |
| `docs/development/d11-t1-research-time-boundary-hardening-review.md` | `84676d30f736876b9f3fb2b36a695b94e11d28fa44a17fc5126278e3d9cf6829` |
| `docs/development/d11-t1-f1-predecessor-utc-fix-review.md` | `13da1c9f6fc459b1d970bf44100d1b76a9561ec8fb8b7cc7331b362553418de5` |
| `docs/development/d11a-scheduler-contracts-spec.md` | `5e4f3869fde26b4cc2fda7ab3a097c1005e4cfef89695f2b8c8413550907e1b9` |

After review, the same 261-file tree hash is verified when excluding only this newly created report. No source, test, fixture, prior report, dependency, migration, mobile, pronunciation, or manuscript content changed. Nothing was staged, committed, or pushed.

## 19. Recommendation

**D11-T1-F1 INDEPENDENT RE-REVIEW PASS.** C-01 is closed; M-04 remains closed; routing remains closed; M-02 and M-03 remain open/deferred.
