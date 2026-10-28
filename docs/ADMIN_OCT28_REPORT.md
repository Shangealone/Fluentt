# Administrator implementation — 2026-10-28

This is an incremental extension of the existing Next.js administrator, FastAPI backend and PostgreSQL database. It is a working oversight/configuration increment, **not a completed research execution system**. Existing curriculum, question-bank and research pages are reused. The audit is in [ADMIN_OCT28_AUDIT.md](ADMIN_OCT28_AUDIT.md).

## Delivered and remaining scope

| Module | Result | Limits |
| --- | --- | --- |
| Dashboard | IMPLEMENTED school-count projection and UI | Active school students, instructors, eligible classes, distinct enrolled students and memberships; current snapshot, not attendance/mastery |
| Users | IMPLEMENTED search, role/status filters, pagination, confirmed deactivate/reactivate | School accounts only; explicit grants; unfinished onboarding cannot be activated; no role/username/password editor |
| Account creation | BLOCKED by automatic approval review | Proposed password-accepting admin account-creation endpoint was rejected as expanding the password-free oversight plan. Rejected code was not applied. Existing onboarding remains authoritative; no account was created |
| Class oversight | IMPLEMENTED read-only class and versioned activity metadata | Instructor ownership remains unchanged; no teaching edits, keys, responses or grading; submitted first captures are participation counts |
| Curriculum/questions | REUSED existing versioned authoring/publishing | Existing explicit grants, private-key separation and frozen editions remain; general vocabulary/resource authoring is still partial |
| Algorithms | IMPLEMENTED registered/saved configuration inventory | FSRS-6 runtime identity/default parameters and allowlisted numeric saved parameters; read-only, no config mutation or active-study changes; FIFAKT is simulated |
| Experiment planning | EXTENDED current Research protocol form | Separate versioned FSRS proposal; historical SM-2 roots/identifiers remain intact; always blocked from execution |
| Enrollment/randomization/treatment | BLOCKED | No invented consent or participants; missing approved policies and genuine treatment integration; no new FSRS allocation runner |
| Research tests/schedule/questionnaire | REUSED existing blocked/draft contracts | No live pre/post/retention delivery, timed runner, weekday availability or questionnaire collection is claimed |
| Learning analytics | IMPLEMENTED school operational counts; reused separate personal receipt monitor | No grades, learning gains, attendance, duration, retention or group effects inferred from submissions/receipts |
| Pronunciation analytics | IMPLEMENTED ordinary classroom attempt-status/provenance counts | Personal/research contexts excluded; raw speech/text omitted; verified acoustic score average remains N/A |
| Operational CSV | IMPLEMENTED audited summary download | Explicit export permission; fixed count fields, no individual/research records; dictionary below |
| Research CSV/outcomes | BLOCKED through existing research gates | No fabricated distributions, sample sizes, significance or benchmark-to-live substitution |
| Audit/settings | IMPLEMENTED safe event inventory and configuration readiness | Audit view covers admin authentication/operator/oversight events only; no private metadata; settings are read-only |

## Data/security contracts

Backend prefix `/api/v1/admin/oversight`:

- `GET /summary`, `/users`, `/classes`, `/classwork?class_id=UUID`, `/algorithms`, `/speech`, `/audit`, `/settings`.
- `GET /summary.csv`: requires both `oversight.read` and `oversight.export`; records an export audit in the same authorized transaction.
- `POST /users/{id}/status`: exact JSON `{status: "active"|"disabled", confirm: true}`, Origin, CSRF, If-Match and UUID Idempotency-Key. Live `users.read` and `users.write` are required. Locks the target NOWAIT after the administrator/session locks; stale/missing revision and contested accounts fail safely. Disabling revokes device sessions. Replaying an old committed change returns its retained receipt without undoing a later change. Reactivation does not restore revoked credentials.

All protected operations reuse live administrator User/browser-session authorization and transactional audit. Personal/admin account mutation is denied. No public role management/default permission grants were added. The operator CLI supports `grant-admin-module` / `revoke-admin-module`: `oversight` reader/exporter, `users` reader/editor and `classrooms`, `algorithms`, `speech`, `audit` reader only. Unsupported domain/access combinations fail. No live grant command was executed.

Fixed Next BFF `/api/admin/oversight/...` rejects demo mode (including mixed demo/live cookies), arbitrary paths/queries, cross-origin writes and oversized bodies; forwards only dedicated admin cookies and allowlisted mutation headers; omits Authorization/unrelated cookies; validates envelopes/status receipts; uses no-store for successes and errors. Client lists clear on blur/error and ignore late reads. Unknown mutation outcomes retain the original body/revision/request UUID for safe retry; explicit access revocation clears protected records.

User/class filters escape literal SQL wildcard characters and use bounded pages. Classwork returns all retained versions, explicitly labeled by status/version, with pinned lesson metadata and eligible first finalized capture counts. No answer keys, prompts, responses, private feedback or speculative completion percentages are exposed. Pages use per-request current snapshots and offset paging; concurrent changes can move rows between pages, so they are not a frozen research dataset.

## Intended methodology versus implemented behavior

The new opt-in `methodology_draft` records the supplied proposed design: 30 target / 15:15 groups; standalone `fsrs6` versus `fsrs6_fifakt_proposed`; randomized parallel 1:1; one calendar month; Monday–Friday; proposed 300–600 seconds per day; seven-calendar-day retention; local midnight to next midnight exclusive. The displayed closing minute is 23:59; execution would include that entire final minute. Values remain editable planning metadata, never enrollment or approvals.

Validation requires equal group targets summing to the proposal target, valid practice limits and positive bounded intervals. If supplied, weekdays must be Monday–Friday, daily availability must be 00:00–23:59, and the intervention window must match the local calendar-month boundary. Month arithmetic preserves local wall-clock time (including DST), clamping an invalid ending day to month end. An approved protocol must confirm that convention before execution. Missing calendar fields may remain absent in an incomplete draft.

The current research treatment contract still binds `sm2_control` and `esr_experimental`; it has not been converted or relabeled. The FSRS proposal adds explicit blockers `fsrs6_research_treatment_not_integrated`, `trained_fifakt_unavailable`, `methodology_draft_not_execution_authorization`. Old drafts omit the absent new field from fingerprint serialization, preserving replay identity and historical configurations. Tests verify old/new persistence and activation refusal.

No future activity unlock, missed-day completion, seven-day test release or concealed allocation is represented as working. Actual recruitment, 15:15 allocation, exposures, session durations, late/missed records and assessment outcomes remain unavailable. Shared content eligibility does not imply identical personalized repetition exposure. Historical 20-user/five-fold benchmark numbers in the request were not independently verified or inserted into runtime outcomes. No superiority, legal compliance, validated ISO instrument, trained FIFAKT or valid Tagalog acoustic scoring claim is made.

Before live collection: obtain approved protocol/Chapter 3 and applicable institutional/ethics/site authorization; study-information, data-use/privacy/consent and minor/guardian/assent materials; allocation/concealment/withdrawal rules; versioned comparable assessment and questionnaire instruments/scoring; approved follow-up/calendar/missed-day/timer/exposure/time-measurement rules; statistical/disclosure/retention policies; real trained/validated model and research scheduler integration; independently verified clearances and restricted runtime DB grants. OIDC/MFA/TLS/provider integration must be configured and verified. UI references/toggles and synthetic fixtures grant no approval.

## Verification

Final targeted backend command, from `services/api` after setting `FLUENTT_TEST_DATABASE_URL` from local Settings without printing credentials:

```powershell
.venv/Scripts/python.exe -m pytest tests/test_admin_auth.py tests/test_research_classrooms.py tests/test_research_setup.py tests/test_research_methodology_draft.py tests/test_research_execution_guard.py tests/test_research_reporting.py tests/integration/test_admin_postgresql.py tests/integration/test_admin_performance_postgresql.py tests/integration/test_admin_oversight_postgresql.py tests/integration/test_research_setup_postgresql.py tests/integration/test_research_classrooms_postgresql.py -q --tb=line
```

**135 passed**, two existing Authlib/AnyIO deprecation warnings. The shared PostgreSQL fixture created/migrated/dropped only its generated UUID database, with frozen initial-name adapter and cumulative upgrade to head. No application database migration/reset/stamp was performed. Tests cover live permission revocation, anonymous/Bearer denial, normal-school counts, literal search/pagination, personal exclusion, safe speech provenance, numeric parameter redaction, CSRF/Origin/freshness, session revocation, late retry, export audit, proposal validation/calendar arithmetic, historical protocol immutability and activation blockers. No real human/provider/model data was used.

- `node scripts/admin-web.test.mjs`: **14 passed**, real Next server plus explicitly synthetic isolated HTTP backend; fixed paths, cookies, headers, Origin, body limits, bad upstream contracts, permissions, preview isolation, export and existing content routes.
- `node scripts/research-setup.test.cjs`: **18 passed**, actual TS/form/contracts with synthetic fixtures; backward-compatible proposals, research authorization, navigation and unavailable-data states.
- `node scripts/admin-performance.test.cjs`: **7 passed**, client lifecycle/filter/session checks, school list cleanup and identical unknown-outcome status retry.
- `npm run typecheck`, `npm run lint`, `npm run build` in `apps/admin`: passed. Initial restricted build hit filesystem EPERM on prerender output; rerun with filesystem authorization passed. This is a build, not deployed OIDC/browser TLS validation.
- Ruff check of all changed Python implementation/tests: passed. Earlier failed synthetic-test transaction handling and the legacy optional-field fixture were corrected; final suite above is the resulting run.
- Follow-up inspection found that pinned lesson names live inside the retained snapshot's `context` object. Corrected the read projection and added a populated assignment check; the focused oversight PostgreSQL suite then passed **11 tests**. The final responsive stylesheet production build also passed.
- UI review through the running in-app browser: Users and Class oversight navigation, labeled filters, table headings, disabled preview actions, honest empty states and common shell. Screenshot: `output/admin-oct28/users-preview.png`. Preview has no live monitoring; no real privileged account was used. No claim of full accessibility certification or native device testing.
- SHA-256 comparison against the pre-task baseline: **152 tracked mobile files checked, zero changes**. No student/instructor/personal screens, learning algorithms, personal writers, scheduler state or history were modified by this task. Earlier unrelated checkout modifications remain present. Full historical suites were not rerun; older reports are not fresh evidence.

## Routes and running locally

Web: `/dashboard`, `/users`, `/classes`, `/algorithms`, `/analytics`, `/pronunciation-analytics`, `/reports`, `/audit`, `/settings`; existing `/curriculum`, `/questions`, `/research` retained. The eight new pages use one validated dynamic route implementation, not duplicate applications. Preview navigation exposes page layouts without granting live permissions; every new BFF still refuses demo cookies.

No new migration is required: source head stays `0018_personal_history` (71 domain tables). New state uses existing User/session/audit and versioned research-protocol JSON storage. Keep local secrets in ignored configuration. From the repository root, use separate terminals:

```powershell
# Backend terminal
cd services/api
$env:FLUENTT_ADMIN_WEB_ORIGIN = 'http://localhost:3012'
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log

# Administrator terminal
cd apps/admin
$env:FLUENTT_ADMIN_WEB_ORIGIN = 'http://localhost:3012'
npm run dev -- --port 3012
```

Local PostgreSQL must already be configured; `scripts/local-postgres.ps1 start` starts the existing ignored development cluster without migrating it. Live administration additionally requires the existing configured OIDC/MFA provider/operator-provisioned identity and explicit module grants. The running preview is available at `http://localhost:3012/login`; it is not a substitute for real authentication. No production data, commit, push or deployment was changed.

## Exact files changed by this increment

Paths are repository-relative; pre-existing unrelated changes in these or other files were preserved.

- `services/api/app/modules/administration/oversight.py` (new)
- `services/api/app/modules/administration/cli.py`
- `services/api/app/api/v1/router.py`
- `services/api/app/modules/research/classroom_schemas.py`
- `services/api/app/modules/research/classroom_service.py`
- `services/api/tests/integration/test_admin_oversight_postgresql.py` (new)
- `services/api/tests/integration/test_research_setup_postgresql.py`
- `services/api/tests/test_research_methodology_draft.py` (new)
- `services/api/tests/test_research_setup.py`
- `apps/admin/src/app/(oversight)/[section]/page.tsx` (new)
- `apps/admin/src/app/api/admin/oversight/[...segments]/route.ts` (new)
- `apps/admin/src/app/dashboard/page.tsx`
- `apps/admin/src/app/dashboard/error.tsx`
- `apps/admin/src/app/login/page.tsx`
- `apps/admin/src/components/admin-workspace.tsx` (new)
- `apps/admin/src/components/oversight-panel.tsx` (new)
- `apps/admin/src/components/admin-nav.tsx`
- `apps/admin/src/components/admin-icon.tsx` (pre-existing untracked file extended)
- `apps/admin/src/components/performance.module.css` (pre-existing untracked file extended)
- `apps/admin/src/components/research-protocol-form.tsx`
- `apps/admin/src/services/oversight-contract.ts` (new)
- `apps/admin/src/services/research-classroom-contract.ts`
- `scripts/admin-web.test.mjs`
- `scripts/admin-performance.test.cjs` (pre-existing untracked file extended)
- `scripts/research-setup.test.cjs`
- `docs/ADMIN_OCT28_AUDIT.md` (new)
- `docs/ADMIN_OCT28_REPORT.md` (new)
- `docs/ADMIN_OVERSIGHT_DATA_DICTIONARY.md` (new)
- `docs/ADMIN_AUTH.md`
- `docs/DECISIONS.md`
- `PROJECT_HANDOFF.md`
- `output/admin-oct28/users-preview.png` (visual evidence), plus ignored local mobile-hash baseline and preview logs under `private-data`.
