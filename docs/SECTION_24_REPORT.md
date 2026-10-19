# Section 24 — Instructor Performance Monitoring

Implemented 2026-10-19 (Asia/Manila) within the three explicitly approved monitoring policies. Read-only instructor monitoring reuses real classroom, publication, capture, grading and release records. No Section 25 implementation, commit or push.

## Inspection and approved scope

Reviewed the preserved original PROJECT_HANDOFF.md, current development plan, Section 23 report/progress contracts, prior assignment/grading/result/enrollment/curriculum/security documentation, relevant models/services, mobile routing/session/client/UI conventions and Git changes. The original handoff describes the through-05 milestone; later accepted section reports and approved policy replies define the current implementation. Followed repository/mobile instructions and the installed Expo 58 documentation checked during the preceding section; the installed stack/dependencies remain unchanged.

The user approved: current eligible school memberships in owned active classes only; submission-counts-v1 denominators A×S/class, A/student, S/assignment, without mastery percentages; and one-version released-assignment-mean-v1 with identical engine/policy/maximum, exact Decimal arithmetic and a single ROUND_HALF_UP rounding to two places. Missing/withheld/manual/N/A outcomes are excluded from the mean but displayed as cohort/state counts. Personal/research/former/disabled activity is excluded; eligible rejoin restores retained evidence. Section 22's separately authorized instructor prerelease review/release remains unchanged.

## Implemented behavior

- Instructor dashboard and class details link to protected /instructor-monitoring. Search owned active classes, inspect current students or published assignments, open individual class histories and assignment cohorts, filter by pinned lesson/edition, search usernames/titles, filter detailed submission states, page and refresh.
- Class overview returns A published assignments, S current students and A×S real submission opportunities. Not started/in progress/submitted and submitted outcome states remain distinct. Final incomplete or withheld work counts submitted, never mastered. Empty cohorts/assignment sets state that no denominator is available.
- Student detail reuses the safe original-context history projection; assignment detail shows current-member statuses and released points. Submitted links enter the existing authorized Section 22 result-review workflow; in-progress rows never route instructors into student response capture.
- Assignment summaries compute the approved mean only over released pinned COMPLETE runs of that exact assignment version. Empty results return unavailable; mixed engine/policy/max groups return not_comparable; valid zero points remain visible. No cross-assignment/class grade, ranking, percentage, predictive indicator or curriculum coverage is added.
- Current-member/owner checks, fixed source contracts, no-store success/error responses and session-generation/focus cleanup protect rows and headers. No answer keys, private feedback/rubrics, Flashcard backs, response bodies, research telemetry or dormant progress/scheduler records are exposed.

INSTRUCTOR_MONITORING.md records complete formulas, comparison/exclusion rules, API fields, ordering, privacy, user flows and limitations. Relevant architecture/API/plan/decision/progress/README/AGENTS documentation is updated. Historical sections remain historical.

## APIs and persistence

Seven read-only GET paths follow /api/v1:

1. /instructor/monitoring/classes
2. /classes/{class_id}/monitoring
3. /classes/{class_id}/monitoring/contexts
4. /classes/{class_id}/monitoring/students
5. /classes/{class_id}/monitoring/students/{student_id}
6. /classes/{class_id}/monitoring/assignments
7. /classes/{class_id}/monitoring/assignments/{assignment_id}

Existing mobile Bearer/session/transport/throttle conventions apply. Bounded limit 1–100/default20 and offset 0–100000, escaped literal q up to 200 characters, optional lesson/edition UUIDs, detail status and context kind use strict query models. Stable timestamp/name/UUID order and has_more support paging. Search/status/page filters narrow rows, not summary cohorts; curriculum filters narrow assignment scope. No mobile /me access is granted to instructors.

One transaction locks/revalidates authenticated owner/session and owned active class, takes the shared content boundary, then locks current student Users FOR SHARE NOWAIT and refreshes state before revalidating/locking memberships. A busy student returns retryable 409, avoiding inversion against student→owner operations. Current membership protects all retained work and released points. Noninstructors=403, unavailable/unrelated objects=404, invalid session=401, malformed filters=422. Existing safe database errors and rollback remain authoritative.

Shared progress helpers now supply submission counts, published/first-attempt queries and history conversion. Grouped actual attempts derive counts without constructing the class-wide A×S matrix; only one assignment's paginated outcomes join that assignment with the current roster. Shared LATERAL result projection pins visibility/run identity and conditionally includes released points/engine/policy. Aggregation uses SQL COUNT/SUM/grouping and Decimal division/rounding. No N+1 item API loop or new analytics store.

No migration, model change, permission grant, dependency or new environment setting. Alembic current is 0011_result_release; read-only check reports no new upgrade operations; model registry remains 63 tables. Frozen migrations and existing production-like data are preserved. Tests create/drop only generated UUID disposable databases; they never reset the configured developer database.

## Verification

| Check | Actual result |
|---|---|
| First focused monitoring + progress run | 16 passed, including live PostgreSQL. |
| Corrected/expanded targeted checks | 3 passed, 6 deselected; full final suite includes all monitoring tests. |
| Full backend pytest | **661 passed, 0 failed, 0 skipped**, 247.38 seconds; live generated disposable PostgreSQL databases. |
| Full client/component regression (18 scripts) | **144 passed, 0 failed, 0 skipped**. |
| Mobile TypeScript and ESLint | Passed, exit 0. |
| Ruff lint and formatting | Passed; 144 files already formatted. |
| Python compileall app/tests/scripts | Passed. |
| Expo web production export | Passed; ignored section24-export-web artifact. |
| Expo Android production export | Passed; ignored section24-export-android artifact. |
| Alembic current/check, model registry | 0011_result_release (head); no new upgrade operations; 63 tables. |

Logs/exports are in ignored private-data/verification/section24-* artifacts. No credentials or fixture content were added to source documentation.

Focused evidence covers not-started/start/final/retry counts; multiple-member denominators; current membership, disabled/left/rejoin behavior; owner/role/object isolation; literal search and curriculum scope; withheld/released/withdrawn scores; exact run pinning; comparable versus mixed-engine cohorts; manual-review/N/A exclusions; empty classes; 22-member roster and assignment pagination with unique IDs; retained retired curriculum; fewer than 20 SQL statements for a monitored assignment page without key/response/research/dormant-progress queries; NOWAIT student contention returning 409 and succeeding after release; revoked session/no-store behavior. Existing session expiry and Sections 20–23 regressions remain in the final backend suite.

Client/component tests exercise encoded read-only authenticated requests, 401 propagation, route roles, denominator/mean validation including decimal zero, accessible summary/search/filter labels, released/incomparable displays, instructor history actions, empty-page headers and loading/error/unmounted late-response protection. Existing onboarding/classes/enrollment and all ten method/capture/result/progress tests are included.

An intermediate extended backend run had two missing-import test-fixture failures. Imports were corrected; the affected tests and newly added review/N/A checks then passed. No failing implementation check is being treated as a pass. Existing Starlette/Authlib deprecation and Node typeless-module warnings remain nonfailing dependency/tool warnings.

## Limitations and Section 25 prerequisites

- Physical Android/iOS, native SecureStore end-to-end walkthrough, TalkBack/VoiceOver, orientation/text scaling/keyboard/hardware Back behavior remain unverified on devices. Component tests and exports are not native execution. No insecure web-session workaround was added.
- No live authenticated browser/native monitoring walkthrough; web remains a native-SecureStore navigation preview. Real OIDC/MFA/provider and deployed TLS/cookie behavior remain unconfigured/unverified as previously requested.
- Production-scale load/EXPLAIN, very large cohort locking/ID materialization, contention frequency, distributed throttling, deployment least privilege and representative device performance remain to be validated. Bounded query/page fixtures do not establish production performance.
- Next.js and administrator source are unaffected; their build/browser harness was not redundantly rerun. The previously reported default Turbopack readiness issue and earlier Webpack fallback remain historical findings, not newly verified here.
- No personal writer, curriculum completion/mastery, cross-assignment grade, score override, notification/messaging, AI, adaptive scheduler or research analytics/policy is added. Incompatible legacy/expired evidence fails closed rather than inventing a status conversion.

**Ready for Section 25 after your acceptance and its exact prompt.** No remaining implementation blocker exists within the approved Section 24 scope. A later section must define any new metrics, activity writer, access expansion or outcome semantics explicitly and preserve immutable pins, current-member privacy and released-only aggregates. Native/provider/deployment limitations remain visible verification prerequisites. Stop before Section 25.

## Every changed file

Against the Section 24 SHA256 baseline: **19 existing files changed, 14 new files including this report, 348 prior files unchanged, zero removed**. Mobile package-lock, original handoff, prior section reports, models and frozen migrations remain unchanged. Lock SHA256: `92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6`; handoff SHA256: `EFBA6D1FA5B51D4FD0695553E0BBA19E857E30C37F3D09E00C6249EC45F39F71`. All unrelated existing tracked/untracked work is retained.

```text
AGENTS.md
README.md
apps/mobile/src/app/_layout.tsx
apps/mobile/src/app/class-details.tsx
apps/mobile/src/app/instructor-monitoring.tsx
apps/mobile/src/app/instructor.tsx
apps/mobile/src/features/assignments/AssignmentEditor.tsx
apps/mobile/src/features/monitoring/MonitoringBrowser.tsx
apps/mobile/src/features/progress/HistoryBrowser.tsx
apps/mobile/src/services/api/monitoring.ts
apps/mobile/src/session/provider.tsx
apps/mobile/src/session/routing.ts
docs/API_DESIGN.md
docs/ARCHITECTURE.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/INSTRUCTOR_MONITORING.md
docs/PROGRESS.md
docs/SECTION_24_REPORT.md
scripts/choice-components.test.cjs
scripts/monitoring.test.mjs
services/api/app/api/v1/router.py
services/api/app/main.py
services/api/app/modules/monitoring/__init__.py
services/api/app/modules/monitoring/metrics.py
services/api/app/modules/monitoring/router.py
services/api/app/modules/monitoring/schemas.py
services/api/app/modules/monitoring/service.py
services/api/app/modules/progress/metrics.py
services/api/app/modules/progress/queries.py
services/api/app/modules/progress/service.py
services/api/tests/integration/test_monitoring_postgresql.py
services/api/tests/test_monitoring_metrics.py
```
