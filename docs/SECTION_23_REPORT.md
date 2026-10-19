# Section 23 — Student Progress Tracking and Learning History

Completed 2026-10-19 (Asia/Manila) within the explicitly approved submission-progress scope. Student dashboard and history views derive real authorized classroom records; personal tracking is explicitly unavailable. No Section 24 instructor monitoring, commit or push was performed.

## Inspection and approved decisions

Read PROJECT_HANDOFF.md completely and reviewed the current development plan, Sections 21–22 reports, architecture/decisions, assignment/result/curriculum/vocabulary and privacy/research boundaries, actual learning models, session/role rules, dashboard/API clients and Git changes. The handoff records the original through-05 milestone; later accepted reports define the implemented state through 22. Followed apps/mobile/AGENTS.md and checked the installed Expo 58 manifest against its [versioned SDK reference](https://docs.expo.dev/versions/v58.0.0/) and Router documentation before reusing navigation hooks.

LearnerProgress and vocabulary/scheduler storage exist, but there is no approved measured personal activity writer, lesson-completion/mastery algorithm or ordinary five-module coverage contract. Published classroom assignment/capture/evaluation/release records provide supported evidence. Section 22 permanently pins the first released run and restricts results to current eligible memberships. These facts prevented inventing completion percentages, personal histories, mastery or new release permissions.

The user approved:

1. **submission-counts-v1**: one count per currently available published assignment, classified not started/in progress/submitted. Final submission counts despite unanswered questions or withheld/manual-review results. Display submitted/available counts without percentages or mastery claims; zero denominator is “No available assignments.” Publication/membership changes can change the denominator.
2. Student ownership/current eligible class access, distinct class/pinned curriculum identity, pending records, real timestamps and class/status/date filtering. Points require the exact released run; no aggregate averages or cross-class grades. Leaving/removal hides a class; eligible rejoining restores retained history.
3. Explicit unavailable personal tracking, no unsupported module/lesson completion/mastery/streak/retention/due-review/pronunciation/research metrics, and no writes to existing progress/scheduler records.

## Metrics and data contracts

| Metric | Implemented meaning |
|---|---|
| available | Published locked distribution-only-v1 assignments in distinct currently eligible classes. Each assignment appears once. |
| not_started | No owned first attempt for that assignment version. A publication timestamp is availability, not learning activity. |
| in_progress | Existing first unscored-capture-v1 attempt still in progress, including empty/partial work or a revealed Flashcard. |
| submitted | Finalized first capture with a real submission timestamp. Not a mastery or academic completion assertion. |
| pending | not_started + in_progress. |
| class_count | Distinct eligible classes in the requested scope, including those with no assignments. |

available = not_started + in_progress + submitted. Global summary spans currently eligible school classes; class filters narrow it. The summary denominator does not change with history date/status filters, which the UI states explicitly. Individual records retain class and assignment/version IDs; no academic records/grades are merged. Raw response completion, item counts, grade averages, curriculum coverage and performance forecasts are not progress formulas here.

Personal summary availability is unavailable with counts/class_count NULL; personal history is an empty unavailable contract. No zero-progress or mastery claim is inferred from preferences, curriculum browsing, component-only practice or legacy completed/metrics fields. Existing LearnerProgress and scheduler rows remain untouched; a PostgreSQL fixture verifies that even a stored synthetic legacy completed row/metrics does not become an approved personal measurement.

History retains the original assignment snapshot's lesson/edition ID/name, grade and subject, and labels learning language separately. Filipino subject and Tagalog language remain distinct. Retirement or a new curriculum edition does not replace the historical IDs or remove an otherwise authorized published assignment.

Submitted results reuse the shared Section 22 lifecycle projection: awaiting administrator evaluation, review-required/unsupported, withheld, released or not-applicable. No processing queue is invented. Only the current released permanently pinned COMPLETE run contributes exact Decimal-string earned/possible points. A newer engine run cannot replace it; withdrawal removes points/run/policy from history. No combined academic grade, expected answers, private keys, explanations, rubrics, card backs, response bodies or per-item correctness appears in history. Existing result navigation separately reauthorizes permitted review.

Current approved captures cannot expire or be academically invalidated: no deadline, expiry/grade conversion or invalidation workflow is added. Unexpected legacy/expired/graded evidence in an eligible source fails safely with 409 rather than being silently converted into a completion bucket. That corruption path was not exercised by relaxing existing PostgreSQL guards; valid source lifecycle and device-session expiry were tested.

## Endpoints and mobile workflows

Paths follow `/api/v1` and existing mobile Bearer authentication, secure transport, bounded throttling, safe envelopes and no-store success/error behavior.

| Method | Path | Purpose |
|---|---|---|
| GET | `/me/progress?class_id=optional-UUID` | Authenticated student's global/eligible-class summary, policy/read time and counts or personal unavailable state. |
| GET | `/me/progress/classes` | Bounded eligible class choices: ID, name, grade and learning language. |
| GET | `/me/learning-history` | Own authorized assignment records, optionally filtered by class_id, status and aware since/before; paginated. |

Lists use limit 1–100/default20 and offset 0–100000 with has_more. History ordering is submitted_at, otherwise persisted attempt.updated_at, otherwise publication locked_at, descending with assignment UUID ascending as tie-break. A start/update/submission timestamp is not fabricated for an unstarted assignment. Last recorded attempt change may include a card reveal; it is not a duration, recall measurement or mastery event.

since is inclusive and before exclusive, both timezone-aware. Mobile YYYY-MM-DD inputs validate calendar dates and convert an inclusive local end date to the next local midnight and then UTC; the next local calendar day preserves daylight-saving semantics. Invalid/naive/reversed filters fail validation. The date-filter field is the same timestamp used for ordering, including publication for pending/unstarted rows. Explicit Apply/Clear actions prevent per-keystroke requests and reset pagination.

Students open the dashboard's **Progress and learning history** link, or My Classes → **View this class learning history**. Dashboard summary supports refresh and clear empty/unavailable/error states. The history screen offers class selection, status/calendar filters, bounded pages, progress/history refresh, original context and existing assignment/result links. A personal learner receives an honest tracking-unavailable view without school filters or fabricated rows.

Existing Screen/LoadState/Picker/Input/Choices/Button patterns provide scrolling, responsive wrapping, accessible labels, text scaling and keyboard/back navigation. Focus loss, scope/route changes, errors and refresh remove prior protected data; late completions are ignored. Existing SessionController.run clears invalid sessions, and no sensitive history/token cache or insecure storage fallback is added. Future-feature copy now acknowledges available classroom assignments/results/submission progress while distinguishing unsupported personal/pronunciation/AI/scheduler features.

## Query integrity and privacy

Only student roles can use the new /me APIs. No user-ID selector, instructor monitoring endpoint or research context parameter is introduced. Role/credential, requested class and every row are authorized by the server. Instructors receive 403; unrelated classes receive generic 404; invalid/revoked/expired sessions receive 401. Personal class-filter requests cannot grant school access. Enrollment eligibility remains active/unended membership with an active/unarchived class and available instructor owner; invitation expiry alone does not remove membership.

The transaction locks the authenticated student/session, discovers candidate memberships, locks distinct owners in UUID order, then classes and eligible memberships, refreshing/revalidating after waits, then takes the shared content boundary. This preserves the existing student→owner→class lock order across multiple classes. Existing instructor result writers retain student NOWAIT semantics. A live lock-wait test holds an owner row, starts a history read, disables that owner before releasing the lock, and verifies no records are disclosed after revalidation.

PostgreSQL COUNT/FILTER computes metrics from one shared assignment/first-attempt query. Distinct eligible class IDs avoid multiplying records by membership history; exact version/student/attempt_number joins avoid retries or other students' attempts inflating counts. Status/date filters and LIMIT/OFFSET precede LATERAL lookups for one current release decision and one pinned/appropriate sealed run. Conditional projection withholds points, policy and run IDs before release. Existing indexes suffice; no N+1 per-record service/API loop is introduced. The 25-record pagination fixture returned 20 then 5 unique rows and observed fewer than 20 SQL statements for a full history request, without querying answers, keys, dormant metrics or private research tables. This is bounded-query evidence, not a production-scale benchmark.

No StudentResponse, QuestionAnswerKey, LearnerProgress, vocabulary/scheduler history, research_private or research-outcome query is used by progress services. Research blinding, consent, cohorts and treatment analysis remain separate. No progress, score, grade or event records are written; existing session last-use/idle renewal remains ordinary authentication behavior.

## Database and compatibility

**No migration, schema/model, dependency or runtime configuration change is needed.** Head remains **0011_result_release**, with **63 domain tables**. Local `alembic check` reported **No new upgrade operations detected** and `alembic current` confirmed that head. No developer database reset, downgrade, backfill, seed or migration was performed. Disposable integration tests created/dropped only their own UUID databases.

Earlier class/enrollment/curriculum/question/capture/grading/result contracts remain in force. Section 22's result-state calculation was extracted into a small shared helper so progress does not invent divergent result states. The result message helper accepts only the two fields needed by history; existing result behavior is preserved. Shared no-cache coverage now includes the new /me/ success and error paths.

## Actual verification

| Check | Result |
|---|---|
| Focused new backend schema/policy/SQL/PostgreSQL cases | **22 passed**, 0 skipped, 22.12 s. |
| Additional actual PostgreSQL lock-wait authorization race | **1 passed**, 6 unrelated cases deselected, 6.06 s. |
| Final full backend suite, live disposable PostgreSQL | **647 passed**, 0 failed/skipped, 194.72 s. Includes all previous 624 and 23 new progress cases. |
| Focused actual components/client/dashboard tests | **59 passed**, 0 failed/skipped. |
| Final relevant client/component regression suite | **138 passed**, 0 failed/skipped, 2.96 s. |
| Mobile TypeScript | `npm run typecheck` passed. |
| Mobile ESLint | `npm run lint` passed. |
| Ruff check and format check | Passed; 136 Python files formatted. |
| Python compileall app | Passed. No standalone Python type checker is configured. |
| Expo web export | Passed: `apps/mobile/dist/section23-web`. |
| Expo Android/Hermes export | Passed: `apps/mobile/dist/section23-android`. |
| Local schema drift/head | No upgrade operations; unchanged 0011_result_release. |

New backend coverage includes empty/unavailable personal/school states; starting/resuming and incomplete finalization; repeated submission without count inflation; new publication denominator changes; withheld/released/withdrawn and newer-but-unpinned evaluations; manual/unsupported and Flashcard no-denominator states; wrong roles/ownership/class filters; expired device credentials; multi-class isolation; leave/rejoin and inactive owner/class behavior; stored unapproved metrics remaining unused; deterministic page boundaries, aware date validation/filtering, query bounds and no private-table reads; retired curriculum followed by a newly published edition; and authorization after an actual lock wait. All prior grading/result/capture/identity/enrollment/content regressions passed in the full suite.

New component/client coverage verifies trusted-count invariants, unavailable versus zero, exact released decimal zero, withheld-score hiding, escaped titles and distinct subject/language/edition context, explicit date/status/class filters and pagination reset, date/calendar boundaries, fixed authenticated request paths, protected student routes, focus/error/blur cleanup and ignored late reads. Actual components execute with synthetic props/mocked HTTP; fixtures are not runtime accounts/content or an authentication bypass.

Initial focused checks found an Enum-typed SQL COALESCE projection rejecting the synthetic not_started label. Casting that read projection to String fixed it without relaxing the stored attempt enum. Cache assertions exposed missing /me/ prefix coverage, now fixed for both successful/error responses. An expiry fixture was corrected to preserve its existing database timestamp constraint, and bulk pagination uses a fixture-only higher request budget rather than changing/disabling runtime throttling. A refresh-hook lint issue was resolved by keyed read remounts; JSX copy was corrected. Final checks passed; no integrity constraint or failing test was disabled. Existing dependency deprecation/module-type warnings remain informational.

## Limits and open policies

- Physical Android/iOS, native secure-session end-to-end, TalkBack/VoiceOver, orientation, text scaling, keyboard and hardware Back behavior remain **unverified on devices**. Component handlers/SSR and exported bundles are not native execution.
- No live authenticated browser/device progress walkthrough was performed. Web retains its native-SecureStore account-creation boundary; no browser credential workaround was added.
- Real OIDC/MFA/provider and production TLS remain unconfigured/unverified as previously requested. Production data must be created through approved workflows; empty/awaiting-result views remain valid until eligible activity and an authorized evaluation/release exist.
- Production-scale load/EXPLAIN profiling, distributed throttling, least-privilege deployed grants, trusted proxies and broader deployment checks remain separate prerequisites. Current PostgreSQL behavior was actually tested, with no skipped integration checks in the final suite.
- No personal activity writer, lesson/module completion denominator, mastery/retention/scheduler measurement, academic invalidation/remediation, aggregate grade representation or research analytics is approved here. Unexpected incompatible evidence fails safely; there is no fabricated expired/invalidated attempt workflow. No academic/DepEd/psychometric verification or learning-effect claim is made.
- Next.js source was unaffected; its build/browser harness was not redundantly rerun. The prior default Turbopack readiness issue remains a historical environment finding, with its earlier tested Webpack fallback; neither is claimed newly verified here.

## Every changed file

Against the Section 23 SHA256 baseline: **18 existing files changed, 15 new files including this report, 334 prior files unchanged, zero removed**. Existing mobile package-lock, original handoff, all prior reports, models and frozen migrations remain unchanged. Lock SHA256 remains `92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6`; handoff SHA256 remains `EFBA6D1FA5B51D4FD0695553E0BBA19E857E30C37F3D09E00C6249EC45F39F71`. Logs/exports/verification snapshots are ignored local artifacts.

```text
AGENTS.md
README.md
apps/mobile/src/app/_layout.tsx
apps/mobile/src/app/learning-history.tsx
apps/mobile/src/app/student.tsx
apps/mobile/src/components/navigation.tsx
apps/mobile/src/features/assignments/ResultDetails.tsx
apps/mobile/src/features/enrollment/MyClasses.tsx
apps/mobile/src/features/progress/HistoryBrowser.tsx
apps/mobile/src/features/progress/ProgressSummary.tsx
apps/mobile/src/features/progress/filters.ts
apps/mobile/src/services/api/progress.ts
apps/mobile/src/session/provider.tsx
apps/mobile/src/session/routing.ts
docs/API_DESIGN.md
docs/ARCHITECTURE.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/PROGRESS.md
docs/SECTION_23_REPORT.md
scripts/choice-components.test.cjs
scripts/dashboard-components.test.cjs
scripts/progress.test.mjs
services/api/app/api/v1/router.py
services/api/app/main.py
services/api/app/modules/assignments/results.py
services/api/app/modules/progress/__init__.py
services/api/app/modules/progress/queries.py
services/api/app/modules/progress/router.py
services/api/app/modules/progress/schemas.py
services/api/app/modules/progress/service.py
services/api/tests/integration/test_progress_postgresql.py
services/api/tests/test_progress.py
```

## Section 24 readiness

**Ready to proceed to Section 24 after your acceptance and its authoritative prompt.** No remaining Section 23 implementation blocker exists within the approved data/metric scope. Section 24 must explicitly define instructor monitoring fields, current/former membership access, assignment/result visibility and any further aggregation; these student-only counts do not grant monitoring or research permissions. Preserve exact version/release identity, submission-versus-mastery distinctions and the native/provider/deployment limitations. Stop for approval before Section 24.
