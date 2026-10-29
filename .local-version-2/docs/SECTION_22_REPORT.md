# Section 22 — Assessment Results and Feedback

Completed 2026-10-19 within the explicitly approved ordinary-classroom release scope. Backend APIs and Expo student/instructor screens use real persisted Section 21 evaluations and exact Section 20 submission references. No grading job, score override, academic invalidation, research release or answer-key disclosure is added. Section 23 has not started; no commit/push was performed.

## Accepted decisions and inspection

Reviewed the original handoff and subsequent accepted roadmap/reports, especially Sections 20–21, GRADING.md, ASSIGNMENTS.md, identity/enrollment/classroom security, models/migrations, actual session/navigation/client/widget implementation and Git changes. The original handoff remains historical through Section 05; subsequent reports define the later implemented contracts. Existing captures are deliberately unscored, and evaluations are immutable administrator-only computation records. Neither COMPLETE nor a stored answer key previously authorized release. There is no automatic processing queue, academic invalidation/adjudication field or instructor-written feedback workflow.

The user explicitly approved:

1. Owning-instructor release of an existing COMPLETE ordinary-classroom evaluation, including earlier Section 20 captures, labeled **equal-point objective evaluation**, not original examination grade. Grading execution stays administrator-only; nothing runs or releases automatically. Manual/unsupported results stay withheld and all-Flashcard evaluations have no denominator.
2. Live current membership/ownership checks on every read. Students get submission/evaluation/withheld status only before release; after release they get exact totals, per-item correctness/points, pinned public fronts and their own original responses. Expected answers, private rubrics/explanations and Flashcard backs remain hidden. Instructor inspection excludes unrelated/former/ineligible members and research data.
3. One permanently pinned immutable run per attempt, explicit confirmed release/withdraw/re-release of that same run, freshness/replay protection and retained history. No replacing the run, changing scores, adding instructor-written feedback or inventing research/academic invalidation policy.

Existing uncommitted work, original handoff, accepted reports and frozen migrations were preserved. No production administrator, curriculum, learner progress or grade was seeded.

## Implemented APIs and behavior

All paths below follow `/api/v1` and existing mobile Bearer/HTTPS/throttling/no-store conventions.

| Method | Path | Scope |
|---|---|---|
| GET | `/assignments/{assignment_id}/result` | School student's own result under live eligible membership/class/owner; real no-attempt/in-progress states. |
| GET | `/assignments/{assignment_id}/results` | Owner's paginated finalized submissions from current eligible members. |
| GET | `/assignments/results/{attempt_id}` | Owner's safe evaluation/response detail; optional selected run before first release, then pinned run only. |
| GET | `/assignments/results/{attempt_id}/evaluations` | Owner's paginated sealed evaluation identities/statuses for this eligible attempt. |
| POST | `/assignments/results/{attempt_id}/release` | Confirmed visibility change `{run_id,released,confirm:true}` with UUID Idempotency-Key and If-Match. |

Lists retain bounded limit/offset and stable timestamp/UUID ordering. The state contract distinguishes not-submitted/in-progress, submitted awaiting evaluation, awaiting manual review/unsupported, withheld, released and not-applicable. No nonexistent processing job is implied. COMPLETE totals are exact decimal strings without percentages/letters or client arithmetic. Review-required totals remain absent, rather than substituting automatic subtotals. Flashcards remain subjective and not objectively scored.

Released item review pins result ID, assignment-question ID, exact question-revision and original response ID. It does not substitute newer content or normalize original Unicode/whitespace. No-answer items remain explicit. Malformed historical response bodies are retained in storage but omitted from widgets, with response identity distinguishing unavailable evidence from an unanswered item. Structural missing/incompatible evidence fails safely. Retirement preserves the exact historical front/version and is not treated as academic invalidation.

Student pre-release DTOs have no scores, review items, evaluation identity or pinned-run ID. Released DTOs expose only approved review. Owner DTOs permit inspection before release, including actual unresolved item states without a fabricated final score. No result operation queries QuestionAnswerKey, changes StudentResponse/AssignmentAttempt grading fields, invokes evaluation or accesses research_private.

## Mobile workflow and accessibility

- Student: My Classes → Published assignments → Results. Refresh verifies current access/status. The assignment/submission remains accessible through its existing route. After release, previous/next navigation presents one original answer at a time through the existing ten method widgets in disabled review mode. Flashcards show the front and original recall only, without a reveal action/back.
- Instructor: owned class → Assignments → Results and release on a published assignment → submitted current student. Inspect a persisted evaluation, select an existing run before pinning, confirm release or withdrawal, and re-release only the retained run. After a successful change the parent detail/selector reloads so newly pinned history is authoritative.
- Existing Screen/header/Button patterns provide responsive wrapping, scrolling, text scaling, keyboard support and accessible controls. Review text distinguishes read-only historical responses from unfinished unscored preview interactions; the authoring/practice defaults remain unchanged.
- Loading/empty/error/retry and explicit refresh reuse Picker. Focus/unmount/session boundaries clear protected content and reject late completions. Current 401 uses existing SessionController invalidation; 403/404 hides protected review. Unknown write outcomes hide scores/review and retain the exact request for retry until reconciliation. Stale requests require refresh. Back navigation warns about pending visibility decisions; no insecure local answer/token persistence is introduced.

The result interfaces do not implement student response changes, grader execution, expected-answer review, free-form instructor comments, overrides, appeals, instructor analytics or result notifications.

## Security, persistence and concurrency

Additive **0011_result_release** adds one table, `assessment_result_releases`, increasing the domain total from 62 to 63. Each immutable event stores attempt, run/version, instructor, UUID request identity, consecutive sequence, visibility and timestamps. Actor/request and attempt/sequence uniqueness prevent duplicate/reordered history. PostgreSQL guards serialize on the attempt, require the exact sealed COMPLETE ordinary-classroom run and owner context, freeze the first run ID, enforce alternating visibility and reject all event UPDATE/DELETE. PUBLIC access is revoked; occupied downgrade refuses instead of deleting history. Frozen 0001–0010 and prior captures/evaluations remain unchanged.

Owner operations authenticate and lock instructor/session, owned class, shared content boundary, current eligible student/membership and finalized attempt in one transaction. Student user locks use shared NOWAIT after the owner: an in-flight student→owner wait produces retryable 409 rather than an inverse blocking wait. Rows are refreshed after lock waits. Student result reads reuse student_context, so owner locking serializes disclosure with withdrawal. Live membership loss, class deactivation and expired/revoked sessions deny subsequent operations without deleting work.

First release pins its selected run. Newer engine evaluations do not silently replace it. Same-key/body retries return current authorized visibility without another event/audit; conflicting reuse/stale writes fail. In particular, retrying an old successful release after a later withdrawal cannot resurrect visibility. A transactional failure rolls back the visibility event and safe audit together. Audits record decision/event/attempt/run identity and sequence, never keys, responses, score values or credentials. Withdrawal removes subsequent server access; it cannot retract information already viewed.

The known local developer database was backed up to ignored `private-data/verification/section22-before.dump`, then normally upgraded from 0010 to 0011. All **62 prior table row counts remained unchanged**, the new ledger is empty and `alembic check` reported **No new upgrade operations detected**. No developer database downgrade/reset/stamp or data backfill occurred. Disposable tests created/dropped only their own generated UUID databases.

## Verification evidence

| Check | Actual result |
|---|---|
| Initial focused result PostgreSQL/schema checks after fixture corrections | **16 passed**, 0 skipped, 21.73 s. |
| Final full backend `pytest -q --tb=short` with live disposable PostgreSQL | **624 passed**, 0 failed/skipped, 162.15 s. Includes all eight new result integration cases and the new frozen-DDL/schema check. |
| Initial targeted real component/typed-client tests | **41 passed**, 0 failed/skipped. |
| Final relevant client/component regressions | **129 passed**, 0 failed/skipped, 2.21 s; all ten methods, session/navigation, enrollment/class/assignment/capture and result behavior. |
| Mobile TypeScript `npm run typecheck` | Passed. |
| Mobile ESLint `npm run lint` | Passed. |
| Ruff check and format check | Passed; 130 checked Python files formatted, including new migration. |
| Python compileall app/migrations | Passed. No separate Python static type checker is configured. |
| Expo web export | Passed: `apps/mobile/dist/section22-web`. |
| Expo Android/Hermes export | Passed: `apps/mobile/dist/section22-android`. Export is not installation/device execution. |
| Local guarded backup/forward migration and Alembic drift check | Passed, prior counts preserved, new ledger empty, no new upgrade operations. |

PostgreSQL result coverage exercises successful real grading/release across all ten methods, zero scores, raw text preservation, receipt immutability, status-only pre-release reads, no private keys/backs, current ownership/membership, anonymous/wrong roles, leaving/rejoining/class deactivation/session revocation, pending/manual/unsupported/N/A behavior, stale/invalid requests, exact-run selection, retirement, first-run pinning across newer evaluations, cross-attempt run rejection, immutable DB history, rollback, concurrent identical retries, conflicting request reuse, audit counts and the student-lock NOWAIT case. Earlier identity/admin/class/enrollment/content/attempt/grading regressions all passed in the full suite.

Component/HTTP-contract tests exercise confirmation/cancel, identical retry payload/key/freshness, visibility withdrawal, protected-state hiding on 401/403/404, late completion after unmount, Back warning behavior, selector refresh, decimal-string validation, route separation, disabled answer review and Flashcard-back exclusion. Existing components execute with synthetic props/mocked HTTP; these are not runtime seeded content or authentication bypasses.

Early verification found fixture UUID-vs-string assumptions and a wrapped TestClient settings lookup, plus duplicate optional review props and a stray Flashcard prop during adapter editing. These were corrected; no integrity check or test was disabled. A local migration helper first lacked PYTHONPATH and stopped before database access; the configured retry succeeded. The final backend/client/typecheck/lint/export checks above passed. Dependency deprecation/module-type warnings remain informational.

## Limitations and open prerequisites

- Physical Android/iOS execution, native screen-reader/text-scaling/orientation/keyboard behavior and full real-device session/Back flows remain **unverified**. SSR/handler tests and successful exports do not establish these.
- No live authenticated browser/device results walkthrough was performed. Native SecureStore remains required; web is the existing navigation preview with account creation blocked. No insecure browser credential fallback was added for testing.
- Real administrator OIDC/MFA/provider and production TLS remain **unconfigured/unverified**, as previously requested. A real grading administrator/provider and eligible published content/submissions are needed to populate results through normal use; empty/awaiting states are intentional until then.
- Production least-privilege runtime grants, distributed throttling, trusted proxies and deployment verification remain existing prerequisites. No claim of academic/psychometric verification is made.
- Manual adjudication, unsupported-schema remediation, score replacement/regrading release rules, formal academic invalidation, expected-answer/explanation/rubric disclosure, instructor-written feedback, notifications and controlled-research feedback timing remain unimplemented/unapproved. Previously seen results cannot be made unseen by withdrawal.
- Next.js source/contracts did not change, so its build/browser harness was not redundantly rerun. The previous default Turbopack readiness issue and tested Webpack fallback remain historical environment findings, not a Section 22 pass claim.

## Every changed file

Against the pre-section SHA256 baseline: **26 existing files changed, 13 new files including this report, 313 prior files unchanged, zero removed**. The mobile lockfile SHA256 remains `92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6`; original handoff SHA256 remains `EFBA6D1FA5B51D4FD0695553E0BBA19E857E30C37F3D09E00C6249EC45F39F71`. Frozen migrations and prior section reports are unchanged. Ignored logs, exports, backup and verification helpers remain local artifacts.

```text
AGENTS.md
README.md
apps/mobile/src/app/_layout.tsx
apps/mobile/src/app/assessment-results.tsx
apps/mobile/src/app/assignment-results.tsx
apps/mobile/src/app/assignments.tsx
apps/mobile/src/app/published-assignments.tsx
apps/mobile/src/features/assignments/CaptureQuestion.tsx
apps/mobile/src/features/assignments/ResultDetails.tsx
apps/mobile/src/features/questions/ArrangementQuestion.tsx
apps/mobile/src/features/questions/ChoiceQuestion.tsx
apps/mobile/src/features/questions/MatchingQuestion.tsx
apps/mobile/src/features/questions/MultiSelectionQuestion.tsx
apps/mobile/src/features/questions/TextQuestion.tsx
apps/mobile/src/services/api/results.ts
apps/mobile/src/session/provider.tsx
apps/mobile/src/session/routing.ts
docs/API_DESIGN.md
docs/ARCHITECTURE.md
docs/ASSIGNMENTS.md
docs/DATABASE_SCHEMA.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/GRADING.md
docs/MIGRATIONS.md
docs/RESULTS_AND_FEEDBACK.md
docs/SECTION_22_REPORT.md
scripts/choice-components.test.cjs
scripts/results.test.mjs
services/api/app/api/v1/router.py
services/api/app/models/__init__.py
services/api/app/models/result_release.py
services/api/app/modules/assignments/results.py
services/api/app/modules/assignments/results_router.py
services/api/app/modules/assignments/results_schemas.py
services/api/migrations/versions/0011_result_release.py
services/api/scripts/document_schema.py
services/api/tests/integration/test_results_postgresql.py
services/api/tests/test_schema.py
```

## Section 23 readiness

**Ready to proceed to Section 23 after your acceptance and its authoritative prompt.** There is no remaining Section 22 implementation blocker within the approved scope. Carry forward immutable capture/evaluation/run pinning, current-member access, separate administrator grading, always-hidden private keys and the recorded native/provider/deployment limitations. Review the actual next prompt before adding new permissions, scoring representations, feedback/release exceptions, analytics or research behavior; none is inferred from the provisional roadmap. Stop for approval before Section 23.
