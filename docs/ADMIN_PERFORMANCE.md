# Administrator monitoring and redesign — 2026-10-27

The existing Next.js `/dashboard` now prioritizes learner activity, with app-matched navy/rose/teal cards, icon navigation, a desktop sidebar and a phone bottom navigation bar. Existing curriculum, question authoring, research and account/session tools remain available according to their existing permissions. Login preview copy now distinguishes sample tools from live monitoring.

## Evidence and scope

`GET /api/v1/admin/performance` is a read projection, not a new analytics/event store. It requires a real administrator browser session, live `dashboard.view` and explicitly operator-granted `performance.read`. Authorization and projection share the existing administrator transaction and user/session locks. There is no mobile credential access, default grant, researcher-role inheritance or new migration. Source migration head remains `0018_personal_history` (71 domain tables).

It queries only `users` and `personal_activity_events`, and includes current active, non-archived `personal_student` profiles. No ordinary classroom attempts, released grades, research participants/events, scheduler state, private responses, dialogue or recordings enter this projection. Existing classroom monitoring remains instructor-owned; research summaries remain in the existing consent-gated Research page. A current personal learner with no saved events is a genuine zero activity row; an inaccessible or unavailable dataset is shown as unavailable, never zero.

The five counts retain `client-reported-activity-v1` semantics:

| Count | Meaning | Does not establish |
| --- | --- | --- |
| learn_question | Saved answer-check receipts | Correct answers, grade, distinct mastered questions |
| learn_lesson | Saved lesson-completion receipts | Curriculum coverage or unique lessons mastered |
| voice_phrase | Saved phrase-completion receipts | Acoustic accuracy or a pronunciation average |
| tutor_reply | Saved accepted learner replies | AI model quality, fluency or score |
| tutor_session | Saved ended scenario sessions | Minimum duration or assessed learning outcome |

The dashboard shows 7/30/90 UTC calendar-day windows, inclusive from midnight on the first day through server `as_of`. Receipt time is server save time, not necessarily the original practice time. No backfill is invented. The timeline shows observed dates and exact counts; days without events have no plotted bar. Current profile count is not a historical active-user measure. “Learners with activity” is the distinct eligible profiles with at least one receipt in the window. Directory search does not change overview denominators.

Username search is literal, case-insensitive and bounded to 100 characters; SQL escapes `%`, `_` and `!`, and binds parameters. Directory paging is 20 in the UI, at most 50 in the API, ordered by canonical username and UUID, with one extra row for `has_more` and offset bounded to 100000. Each read uses a single PostgreSQL statement snapshot; separate page/refresh requests may reflect genuine changes rather than a pinned historical snapshot.

## Operator setup

From `services/api`, after the normal separate administrator provisioning and OIDC/MFA configuration:

```powershell
.\.venv\Scripts\python.exe -m app.modules.administration.cli grant-performance-read --username "ExistingAdmin"
.\.venv\Scripts\python.exe -m app.modules.administration.cli revoke-performance-read --username "ExistingAdmin"
```

These commands use the existing audited operator permission mechanism and do not create or promote mobile accounts. No real account was granted access during implementation. The currently unconfigured live identity-provider setup remains a prerequisite; the existing demo cookie is only a UI preview and the monitoring BFF returns 503 whenever it is present.

The fixed same-origin `GET /api/admin/performance` BFF forwards only administrator cookies and allowlisted filters. It rejects duplicate/unknown filters, invalid bounds, unsupported methods and malformed responses; credentials/provider errors are not sent to the browser. All success/error responses are no-store. The client clears visible records on blur/hidden state, filter changes and errors, aborts pending work, ignores late responses, revalidates on focus and redirects on expired sessions. No protected browser storage is introduced. Static role props never replace server authorization.

## Verification actually run

- Backend: `pytest tests/integration/test_admin_performance_postgresql.py tests/integration/test_admin_postgresql.py tests/test_admin_auth.py tests/integration/test_personal_history_postgresql.py -q --tb=short -x` — **51 passed**, two existing dependency deprecation warnings. The test URL was read from ignored configuration without printing it. Integration fixtures created/migrated/dropped only generated disposable UUID PostgreSQL databases, including fresh migration to head. No application database migration/data edit occurred.
- `node scripts/admin-web.test.mjs` — **13 passed**, using a real local Next server and an explicitly synthetic HTTP backend. Includes no-store, live permission denial/revocation, safe filters, invalid response rejection, cookie allowlisting, unsupported methods and preview isolation alongside existing content/auth regressions.
- `node scripts/admin-performance.test.cjs` — **5 passed**, synthetic React hook/contract checks for zero vs missing counts, no preview/ungranted fetch, filter changes, late requests, blur/refocus, permission errors and expired-session redirection. These are component checks, not real-browser authenticated provider tests.
- `npm run typecheck`, `npm run lint`, `npm run build` in `apps/admin` — passed. Production build includes the new monitoring BFF.
- Targeted Ruff check/format of new backend/test files and changed router/CLI — passed.
- Browser review: actual preview at `http://localhost:3012/dashboard`, desktop and 390×844 viewport. At phone size, document/content widths both 375 CSS pixels (scrollbar-adjusted), no page-wide horizontal overflow; input label present, period toggle updates, bottom navigation visible. Exact screenshots are in `output/admin-performance/`. Temporary viewport override reset after review. This was UI preview, not a live OIDC sign-in or real participant evaluation.

Initial sandbox checks could not retain the local PostgreSQL runtime or reach the local Next test server. After running the same local checks outside the sandbox with authorization, they passed. No production deployment, full application-wide suite, native device evaluation, new hosted AI capability or performance-superiority claim is implied.

## Files changed for this request

- `apps/admin/src/app/dashboard/page.tsx`
- `apps/admin/src/app/login/page.tsx`
- `apps/admin/src/app/globals.css`
- `apps/admin/src/app/api/admin/performance/route.ts` (new)
- `apps/admin/src/components/admin-nav.tsx`
- `apps/admin/src/components/admin-icon.tsx` (new)
- `apps/admin/src/components/performance-monitor.tsx` (new)
- `apps/admin/src/components/performance.module.css` (new)
- `apps/admin/src/services/performance-contract.ts` (new)
- `apps/admin/src/styles/tokens.css`
- `services/api/app/api/v1/router.py`
- `services/api/app/modules/administration/cli.py`
- `services/api/app/modules/administration/performance.py` (new)
- `services/api/tests/integration/test_admin_performance_postgresql.py` (new)
- `scripts/admin-web.test.mjs`
- `scripts/admin-performance.test.cjs` (new)
- `docs/ADMIN_PERFORMANCE.md` (new), `docs/ADMIN_AUTH.md`, `docs/DECISIONS.md`, `PROJECT_HANDOFF.md`

Existing unrelated mobile/APK/free-hosting work was preserved. This administrator task changed no mobile learning files, learning algorithms, history writers, database models or migrations. No commit, push, deployment, operator grant or production data modification was performed.
