# D11-T1 Research Time-Boundary Hardening Review

## 1. Status

**D11-T1 READY FOR INDEPENDENT REVIEW.** Known M-01 and M-04 reproductions now fail through controlled application-owned boundaries. All focused/full checks pass as recorded below. Independent review is the next gate. Research acceptance remains CLOSED.

No datetime clamping/reanchoring, server-time substitution, interval reduction, retry or development fallback was introduced. Ordinary representable scheduler results remain exact. M-02/M-03 remain OPEN/deferred.

## 2. Baseline

2026-10-17 (Asia/Manila), repository `F:\FLUENTT`, branch `main`, HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`. Initial index empty; git diff --check passed. Reviewed D11B/D11C/D11D work was present and retained without reset/cleanup.

Captured SHA-256 for all **257 existing tracked/untracked files** before editing. D11-T1 changes exactly three existing source files:

- `backend/app/scheduling/research_contracts.py`: controlled UTC normalization and shared result-error construction.
- `backend/app/reviews/acceptance.py`: disconnected chronology/predecessor representability error mapping.
- `backend/app/scheduling/fsrs6.py`: transition OverflowError mapped to shared result validation.

New files, left untracked:

- `backend/tests/scheduling/test_research_time_boundaries.py`: 40 targeted cases.
- `docs/development/d11-t1-research-time-boundary-hardening-review.md`: this report.

The other **254 pre-existing files** remain byte-identical, including prior reports/evidence, SM-2 implementation/tests, FSRS tests/fixture/capture script, configuration, migrations/models/authority schema, dependencies/lock, mobile, pronunciation and manuscript. Existing implementation files are themselves untracked from earlier milestones; ordinary git diff statistics therefore do not enumerate these edits. Hash comparisons protect the complete starting worktree.

## 3. M-01 Reproduction

Before any production fix, the new test module ran against the reviewed implementation: **16 failures / 20 passes**, with targeted raw OverflowError traces. No stored evidence was changed.

| Required path | Fixed reproduction | Before correction |
| --- | --- | --- |
| A: UTC normalization underflow | year 1 minimum with UTC+08 | astimezone(UTC) raises raw OverflowError |
| B: UTC normalization overflow | year 9999 maximum with UTC-08 | astimezone(UTC) raises raw OverflowError |
| Mathematical input normalization | both instants through incoming and prior ResearchSchedulerInput fields | raw OverflowError in `_utc` |
| Reconstruction/result normalization | unrepresentable prior_due input | raw OverflowError in the same shared `_utc`; result field covered after correction too |
| C: chronology incoming | both impossible offset instants, prior absent | raw OverflowError at incoming conversion |
| D: chronology stored prior | ordinary incoming with each impossible offset predecessor | raw OverflowError at prior conversion |
| E: predecessor due addition | UTC datetime.max plus 86400 or 3153600000 seconds | raw OverflowError before integrity classification |

Predecessor reproduction uses explicit fixed identity/configuration/state facts and a configuration-only reader, without an evidence writer/database connection. Snapshots prove attempt/schedule/condition facts are unchanged after rejection. Separate real service regressions verify development atomicity and closed allocated-owner acceptance.

## 4. M-04 Reproduction

Real installed `fsrs==6.3.2` was used, not a fabricated overflow response. First and subsequent Good/Again at UTC datetime.max each reached `Scheduler.review_card`, then raised raw OverflowError at installed scheduler.py's `card.due = review_datetime + next_interval`, before adapter result validation. The new spy calls the real superclass transition and records exactly one invocation with the original interaction and duration None.

Lower boundary: empty steps and the locked minimum positive day interval cannot schedule due before the current UTC interaction. First Good/Again at UTC datetime.min successfully return min+2/min+1 days. There is no equivalent negative-interval library due underflow path under the locked method. Impossible lower offset-to-UTC conversion is independently exercised under M-01; no date adjustment is made to avoid it.

## 5. UTC Normalization Fix

`research_contracts._utc` catches only OverflowError from the explicit `value.astimezone(UTC)` expression, then raises ValueError with the original exception as cause. The surrounding Pydantic contract converts this into its declared ValidationError with the correct field location and `value_error` type.

Input current/prior interactions, reconstruction prior_due and ResearchSchedulerResult due all use this shared type. Tests assert exact locations/types rather than accepting an arbitrary exception. No timestamp/epoch workaround, assumed timezone, manual year alteration or clamping. Safe UTC minimum/maximum and the closest safe +08/-08 local instants still normalize to the same exact values.

## 6. Chronology Error Mapping

`validate_research_chronology` retains its previous decision order and exact ordinary behavior. Each conversion is guarded separately:

| Case | Controlled result |
| --- | --- |
| Incoming normalization is unrepresentable | HTTP 422 `D11_TIME_INVALID` |
| Stored/prior normalization is unrepresentable | HTTP 500 `D11_STATE_CORRUPT` |
| Incoming is naive | unchanged HTTP 422 `D11_TIMEZONE_REQUIRED` |
| Stored/prior is naive | unchanged HTTP 500 `D11_STATE_CORRUPT` |
| Incoming equals/is earlier than prior | unchanged HTTP 409 `D11_STALE_INTERACTION` |

`D11_TIME_INVALID` already exists in normative D11A section 18's approved error taxonomy (422 client provenance). No new service error code or future-skew tolerance was invented. Current/prior normalization changes local variables only; no stored object or timestamp is modified. The helper remains disconnected from research acceptance.

## 7. Predecessor Due Validation

Existing range/whole-day interval checks execute first, preserving short-circuit rejection of malformed intervals. The same prior interaction + timedelta(seconds=stored interval) expression is now in a narrow OverflowError guard; failure becomes HTTP 500 `D11_STATE_CORRUPT`, retaining its cause. Representable due still must equal the stored due exactly; other identity/configuration/memory/answer validation is unchanged.

Both one-day and 36500-day overflow cases are controlled, with unchanged snapshots. Minimum-safe and maximum-safe one-day predecessors still return the same enhanced state. The helper only reads the configuration and predecessor facts; no persistence/current-pointer behavior changed or new caller was connected.

## 8. FSRS Overflow Mapping

Only the existing actual `scheduler.review_card(...)` expression is wrapped. OverflowError becomes the existing application result error: Pydantic ValidationError titled ResearchSchedulerResult, location `due_at`, type `due_anchor`. The shared `due_anchor_validation_error` builder extracts the already-existing error construction from validate_research_result; existing mismatch/overflow semantics are preserved.

On library overflow there is no returned due, so the error uses input None rather than fabricating a replacement date/state. Original exception remains the cause. This is scheduler-result domain failure, not client-time HTTP classification, learner Incorrect, provider category or retry instruction. The one actual transition still uses explicit interaction time, duration None, frozen parameters and fuzz=False.

Self-audit reviewed all five newly added OverflowError handlers: one UTC conversion, two chronology conversions, one predecessor addition and one real FSRS transition. There is no new broad Exception/BaseException catch. FSRS's guard surrounds calculation only: an arithmetic representation failure cannot produce an accepted result; unrelated ValueError and RuntimeError are explicitly tested to propagate unchanged. No filesystem/database/network work or scheduler retry occurs inside that boundary. Existing numeric-memory overflow and shared-result due-overflow guards were not broadened.

Neither package code, mathematics, rating mapping, configuration nor reconstruction fields changed. Later successful-result validation still checks Review/null, finite memory, identity/time, whole-day duration, cap and exact recomputed due. No synthetic successful result is constructed on error.

## 9. SM-2 Boundary Verification

BinarySm2Scheduler required **no change**. First Correct/Incorrect at UTC maximum already produce the same controlled `due_at` / `due_anchor` ValidationError. Its input UTC normalization now benefits from the corrected shared model, independently of the unchanged owned Decimal context.

One-day results at UTC minimum and maximum minus one day remain exact. Existing SM-2 suite confirms 1/6/15/38, EF 2.18/1.86/1.54/1.3, post-lapse 1/6/14, the 36500 cap and Decimal-context correction. SM-2 source/test hashes are unchanged. This is distinct from DevelopmentScheduler's deferred M-03, which was not modified.

## 10. Extreme Test Matrix

Final focused file contains **40 passing cases**:

| Required coverage | Test behavior |
| --- | --- |
| Minimum positive-offset / maximum negative-offset incoming | exact field-local ValidationError and HTTP 422 D11_TIME_INVALID |
| Same instants in prior mathematical input | exact prior_interaction_at_utc validation location |
| Context/result due UTC normalization | exact prior_due_at_utc / due_at validation locations |
| Chronology stored offset extremes | HTTP 500 D11_STATE_CORRUPT |
| Predecessor due addition | 1 and 36500 days beyond UTC max -> integrity error; unchanged inputs |
| Shared result due addition overflow | existing due_anchor ValidationError retained |
| FSRS first upper boundary | real Good/Again transitions -> result ValidationError; one call, no mutation |
| FSRS subsequent upper boundary | real Good/Again transitions -> same result error |
| SM-2 upper boundary | Correct/Incorrect -> existing controlled result error |
| UTC minimum / maximum-safe valid values | exact success and original anchored due |
| Nearest representable offset instants | local min+8h at +08 -> UTC min; local max-8h at -08 -> UTC max |
| Exact first FSRS upper due boundary | Good at max-2 days / Again at max-1 day -> exact max due |
| Subsequent FSRS maximum-safe anchor | both answers remain anchored with bounded whole days |
| Maximum FSRS cap at date boundary | full 36500 days / 3153600000 seconds lands exactly on max; +1 microsecond rejects instead of clamping/reducing |
| Existing naive/equal/stale codes and ordinary offset dates | unchanged classification/normalization |
| Unrelated library failures | ValueError/RuntimeError propagate as the original exceptions |

All datetimes are fixed and explicit. No current clock/random input. Exact error assertions reject any targeted raw OverflowError/OSError/unwrapped ValueError in place of the required category. Private `_utc` raises ValueError only for Pydantic to wrap, as intended.

## 11. Ordinary Scheduler Regression

Existing research-contract, SM-2 and FSRS tests passed after correction. No test expectation or golden fixture was edited. FSRS first Good remains 2 days, first Again 1 day; mixed intervals remain 2/1/2/7/1/1/1/4, with all full-precision state/due fixtures passing. SM-2 literal and Decimal isolation tests also pass.

Direct capture utility ran with **--check only**, reproducing all 16 families / 39 literal transitions. Fixture bytes, capture script and configuration retain their starting hashes. Shared result due-anchor arithmetic remains unchanged; only its existing error construction was extracted for the adapter to reuse.

## 12. Routing Closure

**CLOSED.** Production search still finds pure engine classes only in their own modules and research chronology/predecessor helpers only at their definitions. No new production caller or dynamic resolver/activation flag. Existing development authority resolver and shared acceptance orchestration are unchanged.

Fresh D11B/D11C/D11D routing/acceptance tests: **32 passed**. Real allocated-owner online/shared and sync work still returns 503 `D11_ROUTING_DISABLED`, with zero attempts/schedules/accepted events/pointers/research events. Historical replay, development acceptance, learner serialization and rollback-after-staging tests pass. New pure/disconnected helper tests cannot mutate DB evidence and preserve input snapshots. The existing D9 chain tests are included in the full suite.

## 13. Regression Results

| Check | Actual result |
| --- | --- |
| RED, before any production fix | **16 failed / 20 passed**, all 16 targeted raw OverflowError traces reproduced |
| Initial GREEN boundary suite | **36 passed**, 2 existing warnings in 0.11s |
| Final boundary suite, four additional exact-edge cases | **40 passed**, 2 existing warnings in 0.12s |
| Contracts + SM-2 + FSRS plus initial 36 boundary cases | **224 passed**, 2 existing warnings in 12.05s (47 + 62 + 79 + 36) |
| FSRS direct capture CHECK | **PASS**, no fixture rewrite |
| D11B acceptance + D11C routing + D11D routing | **32 passed**, 2 existing warnings in 11.07s |
| Full backend pytest | **458 passed**, 2 existing warnings in 81.83s (0:01:21); exit 0 |
| Ruff app/tests/scripts | **All checks passed!** |
| Static in-memory Python compilation | **99 files PASS** |
| uv lock --check --offline | **PASS**, 49 packages in 3ms; manifest/lock unchanged |
| Final whitespace/file-integrity checks | **PASS**: exactly 3 authorized existing source changes, 254 protected files unchanged; 2 authorized new files |

Python uses -B; pytest uses -q -p no:cacheprovider --tb=short; Ruff uses --no-cache; compile() is in memory without bytecode output. Database-backed suites use the inspected `_test`-guarded helper with `fluentt_test` / `d11b_21ec17a1c5`, no public search-path fallback. No production/D10 database is used. Two warnings are the pre-existing Starlette/httpx TestClient and AnyIO BlockingPortal deprecations; no unrelated dependency change was made.

## 14. Remaining M-02/M-03

- **M-01: CLOSED by this correction**, pending independent review: known UTC normalization, chronology and predecessor due-overflow paths now have controlled error categories.
- **M-04: CLOSED by this correction**, pending independent review: known real FSRS due overflow no longer escapes the adapter as raw OverflowError.
- **M-02: OPEN / deferred**, unchanged global D9 trigger-count isolation limitation. Fix before shared multi-schema/parallel database verification.
- **M-03: OPEN / deferred**, unchanged old DevelopmentScheduler extreme due overflow. Separate development error-boundary hardening remains required before claiming that support.

Prior historical reports/verdicts were preserved, not edited to close findings retrospectively. Neither correction authorizes research acceptance/enrollment; all remaining formal gates and separate integration authorization still apply.

## 15. Git Status

Branch main, HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`, empty index. D11-T1 source/test/report changes are exactly those listed in section 2. All three source paths were already untracked under the reviewed D11 work; this does not mean they are newly introduced by T1. The new boundary test and this report also remain untracked. All pre-existing tracked modifications and other untracked files remain present.

No staging, commit, push, cleanup/reset, migration, dependency/configuration change, mobile/pronunciation/manuscript work or accepted D10 evidence mutation. Complete final short status and hash comparison are recorded below after verification.

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
?? docs/development/p01-pronunciation-preimplementation-audit.md
?? docs/development/p02-pronunciation-architecture-scoring-spec.md
?? docs/development/p02f-pronunciation-feasibility-report.md
```

Final hash comparison: exactly the three permitted source edits and the two new paths listed in section 2. All other 254 baseline files match. `git diff --check` passes; separate report structure/trailing-whitespace checks include this untracked report, which ordinary git diff does not inspect.

## 16. Recommendation

Submit only this scoped correction and its focused regression coverage for independent review. Retain CLOSED research routing and OPEN/deferred M-02/M-03. No further implementation/integration or staging/commit/push is authorized by this report.

**D11-T1 READY FOR INDEPENDENT REVIEW**
