# D11-T1 Independent Research Time-Boundary Review

Review date: 2026-10-17 (Asia/Manila). Repository `F:\FLUENTT`; branch `main`; HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`.

## 1. Verdict

**D11-T1 CODE REVIEW BLOCKED — predecessor due validation uses local datetime arithmetic before UTC normalization (C-01).**

**CRITICAL: 1; IMPORTANT: 0 additional; MINOR: 0 new.** C-01 has two independently reproduced consequences: a valid, exactly representable UTC due relationship is incorrectly classified as corrupt when the same predecessor instant is expressed at UTC+08; conversely, a stored interaction whose UTC instant is unrepresentable can pass predecessor validation when local arithmetic moves its due into range.

Original UTC-only M-01 reproductions and M-04 transition overflows are now controlled, and all supplied tests pass. M-04 can close. M-01/T1 cannot fully close until C-01 is corrected and covered. Research routing remains CLOSED; no accepted evidence corruption or live research activation is claimed. No implementation fix was made in this review.

## 2. Scope

Read complete current research_contracts.py, acceptance.py, fsrs6.py and all 40 boundary cases; surrounding SM-2/development source, SM-2/FSRS tests, installed FSRS due calculation, error builder, routing/service/sync paths, D11A time/error contracts and historical M-01/M-04 reports. Untracked implementation files were inspected directly rather than relying on git diff alone.

Baseline confirmed expected branch/HEAD, no staged changes, clean git diff --check and the existing reviewed D11B/C/D work. Tracked diff versus HEAD remains ten files, 252 insertions/193 deletions; these are pre-existing changes, not changes made by this review. T1's three source paths were already untracked in earlier milestones; its new boundary test and implementation report are present. No additional migration/model/dependency/mobile/pronunciation/manuscript path appeared in the observed T1 inventory.

Captured hashes for **259 existing tracked/untracked files** at review start. All remain unchanged after review, including source/tests/dependencies/prior reports/configuration/fixtures. Only this new review report was created. No clean/reset, staging, commit, push, fixture regeneration or third-party edit.

The implementation report's historical 257-file pre-T1 hash inventory was not available as a durable artifact in this review session. Accordingly, this review does not assert a newly recomputed historical 254-file comparison. It independently verifies the current source, observed inventory, contracts/goldens and complete review-start/end integrity; historical scope statements remain distinguishable from those fresh checks.

## 3. M-01 UTC Normalization

**PASS for the shared model boundary.** `_utc` catches only OverflowError around value.astimezone(UTC), raises ValueError with the original cause, and lets Pydantic wrap it as a field-local ValidationError. No timezone assumption, timestamp()/epoch workaround, date component rewrite, clamp or current clock.

Independent fixed aware probes used local datetime.min at +08 and datetime.max at -08. All eight model cases are controlled: each instant through incoming interaction, prior interaction, reconstruction prior_due and result due. Exact locations are interaction_at_utc, prior_interaction_at_utc, prior_due_at_utc and due_at; error type value_error. No targeted raw OverflowError escaped these models.

The closest representable local values, min+8 hours at +08 and max-8 hours at -08, normalize exactly to UTC min/max. This part of M-01 is corrected; C-01 is in the separate raw predecessor validation path.

## 4. Chronology Mapping

**PASS.** Independent probes confirm:

| Situation | Exact result |
| --- | --- |
| Incoming aware instant cannot normalize to UTC | 422 D11_TIME_INVALID |
| Stored/prior aware instant cannot normalize to UTC | 500 D11_STATE_CORRUPT |
| Incoming naive | 422 D11_TIMEZONE_REQUIRED |
| Stored/prior naive | 500 D11_STATE_CORRUPT |
| Incoming equal/earlier | 409 D11_STALE_INTERACTION |

Incoming and prior conversion guards are distinct and preserve exception causes; stored normalization errors are not relabeled as client input. Ordinary offsets and exact UTC endpoints remain correct. D11_TIME_INVALID is approved by D11A section 18; no new skew tolerance or clock policy was introduced. The helper changes local variables, not stored facts, and remains disconnected from acceptance routing.

## 5. Predecessor Due Arithmetic

**PARTIAL / BLOCKING C-01.** Interval range and divisibility checks precede addition. For UTC datetime.max plus either 1 or 36500 days, the narrow addition handler correctly returns 500 D11_STATE_CORRUPT with OverflowError as cause. Supplied UTC safe-edge predecessor tests pass, and independent read-only probes confirmed both original overflow paths.

However, acceptance.py:230 adds seconds directly to a.client_interaction_at without first checking/normalizing the stored instant to UTC. Python performs this addition in that datetime's local representation. The handler therefore checks the wrong representability domain near an endpoint.

Independent reproduction used actual in-memory ReviewAttempt, ReviewSchedule, ParticipantSetCondition and SchedulerConfiguration ORM objects, fixed UUIDs, the frozen enhanced configuration, and valid first-Again memory `{state: Review, step: null, stability: 0.212, difficulty: 6.4133}`. A config-only reader supplied the existing db.get result; the actual production validation function performed all identity/configuration/state/due checks. No database connection, evidence writer or supplied test helper was used.

| Stored interaction | Interval / stored due | Expected | Actual |
| --- | --- | --- | --- |
| 9999-12-30T23:59:59.999999+00:00 | 86400 sec / UTC datetime.max | Valid | Valid control |
| 9999-12-31T07:59:59.999999+08:00, the same instant | Same interval / same due | Same valid state | 500 D11_STATE_CORRUPT, caused by local-date OverflowError |
| 0001-01-01T00:00:00+08:00, whose UTC instant is outside the domain | 86400 sec / 0001-01-01T16:00:00+00:00 | 500 D11_STATE_CORRUPT for impossible stored interaction | Accepted enhanced state |

For the second row, explicit UTC normalization plus 86400 seconds equals exact UTC datetime.max. For the third row, independent normalization raises OverflowError, yet local addition moves forward to a representable due and allows validation to return. Predecessor snapshots remain unchanged in both forms; this is a validation/calculation-domain defect, not a mutation claim.

## 6. Shared Result Validation

**PASS.** Existing result validation first validates the complete result, then calculates the same current UTC interaction + interval seconds. Due-addition overflow still yields a ResearchSchedulerResult ValidationError at due_at, type due_anchor. Ordinary due mismatch has the same category, as it did before T1; the previous implementation did not promise a separate code for these two cases.

The extracted builder preserves title, location, custom type and message, and includes the supplied due as diagnostic input. Independent probes verified both existing mismatch/overflow categories and the builder with None. It returns an exception object, not a result; None cannot become a successful due/state. FSRS supplies None because no Card/due was returned. Exception strings do not enter authoritative state.

## 7. M-04 FSRS Overflow

**PASS / CLOSED.** Installed distribution is exactly fsrs 6.3.2. Real first Good/Again and subsequent Good/Again at UTC max now raise the application ResearchSchedulerResult ValidationError, location due_at/type due_anchor, with original library OverflowError chained.

Independent spy calls the real Scheduler superclass, counts one transition per answer and inspects explicit review_datetime and review_duration=None. Exactly four calls for the four overflow cases; no retry, alternate timestamp/interval, fake successful state or result. Original reconstructed Card remains unchanged even when the library raises, and application input/prior/context snapshots remain unchanged.

Only OverflowError from the actual transition expression is caught. Independent ValueError, RuntimeError and an existing Pydantic ValidationError injected at that boundary propagate as the original objects; none is rewritten as overflow. Successful-result state/due checks remain outside that try. Package code/configuration/mathematics are unchanged by the reviewed correction.

## 8. Exact Safe Boundaries

**PASS for models, chronology and engines; FAIL for the raw predecessor UTC+08 equivalent in C-01.** Independent real-library checks confirm:

- At UTC min: first Good returns min+2 days and first Again returns min+1 day. Locked positive intervals have no equivalent negative due-underflow path; no synthetic negative interval was used.
- First Good at max-2 days and Again at max-1 day succeed with due exactly max.
- Moving either first-review anchor +1 microsecond produces controlled due_anchor failure, retaining microseconds rather than rounding/reducing.
- A valid high-stability Review state at max-36500 days returns the full cap: 36500 days, 3153600000 seconds, due exactly max. Anchor +1 microsecond rejects controlled.
- Nearest representable +/-08 offset instants retain exact UTC endpoints through shared models/chronology.

These successes do not waive the C-01 predecessor representation inconsistency. D11A section 10 requires UTC normalization before comparison/calculation, a study day of exactly 86400 seconds, and no local-time/calendar anchor.

## 9. SM-2 Regression

**PASS.** No SM-2 correction is needed for the targeted upper result boundary: Correct/Incorrect at UTC max retain due_anchor ValidationError. Current source still encloses validation/math/result work in its complete owned Decimal context and uses exact arithmetic, ceiling and the 36500 cap. The T1 edits are in shared UTC/error handling, not SM-2 transition logic.

Fresh 62-case suite verifies 1/6/15/38, lapse EF 2.18/1.86/1.54/1.3, post-lapse 1/6/14, ceiling/cap and hostile caller context independence, together with its rational oracle and preservation checks. Safe one-day endpoints remain exact.

DevelopmentScheduler is separate. It is byte-identical to HEAD (`git diff --quiet HEAD -- ...` exits 0), and a read-only direct probe confirms its old max-date OverflowError still reproduces. That is expressly excluded M-03, not a new T1 failure.

## 10. Exception-Scope Audit

**PASS for handler scope, with C-01's arithmetic-domain defect.** Five newly added OverflowError handlers surround only: shared UTC conversion, incoming chronology conversion, prior chronology conversion, predecessor addition and the actual FSRS transition. New handlers chain their original exceptions. Existing numeric conversion/shared result/SM-2 guards retain their purpose.

No new broad Exception/BaseException catch, generic ValueError/RuntimeError swallow, package patch or hidden retry. The predecessor problem is not the breadth of the catch: it classifies overflow before establishing that the underlying instant is valid UTC and that the addition occurs in UTC. A narrow handler around the wrong domain is still incorrect.

## 11. Test Quality

The 40 cases meaningfully execute production paths: actual aware offsets go unsanitized to shared models/chronology; FSRS spies invoke real library transitions; error assertions check specific types/locations/codes; safe tests check exact endpoints. No generic Exception assertion. Pure fixtures override inherited database setup/cleanup only. Config-reader test doubles isolate an existing read dependency while preserving the real validation body.

Coverage gap causing C-01: predecessor fixtures use UTC interactions exclusively. Offset edge tests cover shared input/chronology, not validate_research_predecessor. Thus neither a UTC-equivalent safe stored interaction at +08 nor an unrepresentable stored interaction followed by a representable local due is tested. This gap is part of C-01, not a second separately counted finding.

Independent AST negative controls removed only the new OverflowError handlers in disposable in-memory copies. They reproduced **12 raw overflows**: two shared-input normalizations, four chronology incoming/prior conversions, two UTC predecessor additions, and four real FSRS transitions. This demonstrates that the original RED scenarios are non-vacuous without restoring source files or patching installed code. These are reconstructed old-operation controls, not a claim to have checked out a historical untracked revision.

## 12. Scheduler Golden Regression

**PASS.** Fresh contract/SM-2/FSRS suite: 188 passed (47 + 62 + 79). FSRS Good remains 2 days, stability 2.3065/difficulty 2.118103970459016; Again remains 1 day, stability 0.212/difficulty 6.4133. Mixed intervals remain 2/1/2/7/1/1/1/4, with full numerical state/due JSON checks passing. No fixture expectation was changed to accommodate a result.

Capture ran --check only and reproduced all fixture data. Fixture bytes remain identical to review start: SHA-256 `2cbbd54c5a2545fb3781df90fd3a7bdeef03dcfd51b0caddb1035a584cce1af6`. No golden regeneration. Ordinary scheduler pass does not establish correctness of untested raw predecessor timezone representations.

## 13. Routing Closure

**PASS: CLOSED.** Production searches still find pure SM-2/FSRS classes only in their own modules and research chronology/predecessor helpers at their definitions; no new acceptance/dispatcher connection. record_review_attempt resolves development authority for new work, after accepted replay checks; sync invokes the shared service. Allocated-owner service tests use the real resolver and still return 503 D11_ROUTING_DISABLED with zero attempts/schedules/ledger/current-pointer/research-event writes.

Fresh acceptance/routing regression: 32 passed. Historical replay, development behavior, learner serialization and rollback checks remain green. All independent boundary probes were in memory and made no accepted evidence writes; all failure snapshots checked remained unchanged. C-01 is a blocked future integration/helper defect, not evidence of an active research persistence path.

## 14. Regression Results

| Review execution | Observed result |
| --- | --- |
| Supplied boundary suite | **40 passed, 2 warnings in 0.13s** |
| Research contracts / SM-2 / FSRS | **188 passed, 2 warnings in 11.06s** |
| Fixture utility CHECK only | **PASS**, no rewrite |
| D11B acceptance / D11C routing / D11D routing | **32 passed, 2 warnings in 19.61s** |
| Full backend pytest | **458 passed, 2 warnings in 77.56s (0:01:17)**; exit 0 |
| Ruff app/tests/scripts | **All checks passed!** |
| Static in-memory compilation | **99 Python files PASS** |
| uv lock --check --offline | **PASS**, 49 packages in 1ms |
| Independent shared normalization / chronology / builder probes | PASS, 8 model-field cases plus exact service categories/error-builder checks |
| Independent real FSRS overflow / safe/cap/+1us probes | PASS, four real overflow calls, original Cards/input/context preserved |
| Unrelated boundary exceptions | PASS, ValueError/RuntimeError/ValidationError identities preserved |
| Original-operation AST negative controls | **12 expected raw overflows reproduced** |
| Independent predecessor UTC-overflow controls | +1/+36500 UTC cases controlled as intended |
| Independent predecessor normalization oracle | **FAIL: C-01**, valid equivalent rejected / impossible stored UTC interaction accepted |
| Deferred development M-03 check | Original raw OverflowError remains; expressly excluded |
| Final git diff / report structure / file integrity | PASS; all 259 existing files unchanged, only this report added |

Python -B, pytest -q -p no:cacheprovider --tb=short, Ruff --no-cache and in-memory compile() avoid repository caches/bytecode. Database-backed runs use the inspected `_test`-guarded helper, database fluentt_test / schema d11b_21ec17a1c5 with no public search-path fallback, never accepted D10 evidence. The two warnings are existing Starlette/httpx and AnyIO BlockingPortal deprecations.

Initial sandbox Python spawning was blocked before tests executed; authorized execution outside that restriction completed. An independent ORM probe initially needed content-model registration, and a development probe had a shell-quoting error; corrected disposable probes produced the results above without repository edits. None is presented as an application regression or concealed test failure. Passing supplied tests do not override the independent C-01 failure.

## 15. Findings

### C-01 — CRITICAL: predecessor due validation uses local representation before validating normalized UTC

- **File/symbol:** `backend/app/reviews/acceptance.py:229-234`, validate_research_predecessor(), specifically the addition at line 230.
- **Trigger:** a fully identity/configuration/state-bound predecessor with interval 86400 seconds and either (a) `9999-12-31T07:59:59.999999+08:00` plus stored due UTC max, or (b) `0001-01-01T00:00:00+08:00` plus stored due `0001-01-01T16:00:00+00:00`. Use valid first-Again enhanced memory and fixed matching owner/item/assignment/attempt facts. Neither probe trusts a client scheduler/ID or bypasses model/config binding.
- **Expected:** (a) normalized interaction is `9999-12-30T23:59:59.999999Z`; adding exactly one day yields representable UTC max, so validation returns the same state as the UTC control. (b) stored interaction has no representable UTC instant, so fail 500 D11_STATE_CORRUPT before applying the interval.
- **Actual:** (a) local date addition crosses into year 10000 and is relabeled 500 D11_STATE_CORRUPT; the UTC control succeeds. (b) local date addition produces a representable due, equality passes and the helper returns EnhancedState despite impossible predecessor UTC. Both were reproduced independently with actual in-memory ORM objects and the real function, and snapshots remain unchanged.
- **Root cause:** the function validates interval shape but does not establish UTC representability of the authoritative stored interaction before doing calendar arithmetic on it. Catching OverflowError alone cannot distinguish local representation overflow from an actually unrepresentable UTC due, and a successful local addition cannot validate its starting instant. D11A sections 4/10/12 require UTC instants and UTC calculation.
- **Impact:** incorrect integrity classification of valid accepted facts and incomplete validation of impossible stored time. The underlying normalization assumption predates T1, but the hardening still does not meet its safe-boundary/integrity objective. Classified CRITICAL under this review brief's explicit wrong-classification/safe-boundary rule; research routing is closed and no production evidence corruption or active exploitation is claimed.
- **Recommended fix scope:** within the disconnected predecessor validator, validate timezone and normalize the stored interaction to representable UTC before adding the unchanged interval. Map impossible stored normalization/addition to D11_STATE_CORRUPT and retain exact comparison against the authoritative due instant. Do not mutate the stored object, clamp, reanchor or change scheduler math/config. Add regression cases for UTC versus +08 equivalent safe predecessor, impossible lower stored UTC with locally representable due, and safe/unsafe cap relationships. Keep all routing closed. **No fix was made during review.**

There are no separately counted IMPORTANT or new MINOR findings. Missing predecessor representation tests belong to C-01. Existing M-02/M-03 remain distinct deferred findings.

## 16. M-01/M-04 Disposition

- **M-01: NOT FULLY CLOSED / BLOCKED by C-01.** Shared UTC normalization, chronology and original UTC predecessor addition reproductions are controlled. Raw predecessor representability remains inconsistent for valid/nonvalid offset representations, so T1 cannot claim complete closure or pass.
- **M-04: CLOSED.** First/subsequent Good/Again real due overflows map to controlled result validation, one transition, no retry/clamp/fake state, and exact safe boundaries remain correct.

This records current review evidence without changing historical reports. M-04 closure does not override the overall blocked verdict.

## 17. Remaining M-02/M-03

- **M-02: OPEN / DEFERRED.** Global D9 trigger-count isolation remains a dedicated-layout limitation; fix before shared multi-schema/parallel database verification.
- **M-03: OPEN / DEFERRED.** Old DevelopmentScheduler extreme due overflow remains unchanged and independently reproducible; explicitly outside T1. It is not counted as a new T1 defect.

Do not activate research scheduling, formal enrollment/provisioning or accepted research-chain persistence. Their separate gates remain in force regardless of the pure engine and M-04 results.

## 18. Git Status

Branch main; HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`; index empty. Existing D11B/C/D/T1 dirty/untracked work remains present. All **259 pre-existing files are byte-identical to the review-start baseline**; sole new path:

```text
?? docs/development/d11-t1-independent-code-review.md
```

Complete short status:

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
?? docs/development/p01-pronunciation-preimplementation-audit.md
?? docs/development/p02-pronunciation-architecture-scoring-spec.md
?? docs/development/p02f-pronunciation-feasibility-report.md
```

Hash protection includes collapsed untracked directories. No implementation/test/dependency/prior-report/fixture change during review; no staging, commit or push. Final git diff --check and separate untracked report structure/whitespace checks pass.

## 19. Recommendation

Do not accept full T1/M-01 closure yet. Correct only C-01's predecessor normalization/arithmetic boundary in a separately authorized correction, add the missing offset predecessor regressions, and obtain re-review. Retain M-04 closure, CLOSED research routing, and OPEN/deferred M-02/M-03. No implementation change or additional milestone was executed here.

**D11-T1 CODE REVIEW BLOCKED — predecessor UTC normalization/representability is incomplete (C-01).**
