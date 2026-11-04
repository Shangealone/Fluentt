# Administrator monitoring implementation — 2026-11-05

## Scope and status

**Overall status: PARTIAL.** This work extends the existing Next.js administrator application in `apps/admin`. The student/instructor app remains in `apps/mobile`; both use the same FastAPI/PostgreSQL backend. The monitoring dashboard is read-only. A local preview now opens directly on this PC against the backend's configured database. Deployed administrator acceptance remains **BLOCKED** because this checkout has no configured OIDC/MFA provider or provisioned administrator account. No model inference or AI provider call was made for this implementation.

Before this work, `/dashboard` was a curriculum/question/research entry page, and an instant demo administrator cookie could display sample responses. That cookie bypass and its sample content were removed. Existing authorized curriculum, question, and separately permissioned research operations still proxy to the backend. Research Comparison, Reports/CSV navigation, validated FIFAKT effectiveness analytics, and research data are absent from the new monitoring dashboard.

## Data contract

New read endpoints are `/api/v1/admin/monitoring/overview`, `/classes`, `/classes/{id}`, `/users`, `/students/{id}`, `/learn`, `/fsrs`, `/fifakt`, `/pronunciation`, `/pronunciation/{id}`, `/tutor`, and `/status`. Normally they require the existing separate administrator browser session plus an operator-granted `monitoring.read` permission. Each normal read revalidates the session and permission in the existing backend transaction; responses are no-store. `grant-monitoring-read` and `revoke-monitoring-read` are operator CLI actions, never web self-service. No schema migration or database writer was added.

For this PC only, a private token in ignored `services/api/.env` and `apps/admin/.env.local` enables a read-only preview. The backend accepts it only in development, from loopback, on monitoring GET routes. Next.js exposes it only when the request Host is `127.0.0.1:3000` or `localhost:3000`; the token stays server-side. The preview cannot write, provision accounts, access curriculum/question/research APIs, or work in production mode. Anyone who can use this PC's local admin browser while the preview servers are running can view these monitoring records. Stop the servers or remove both local tokens to close this preview.

Queries include active ordinary classrooms with an active instructor and current eligible school membership. Research-bound classes and personal learning contexts are excluded from activity counts. Students/instructors are active account counts; enrollment counts are current memberships, not unique learners. Finalized distribution-only-v1 captures count submissions even if incomplete or awaiting review. They are not completion, mastery, or grades.

WavLM monitoring requires a stored English activity, `scored` attempt, `simulated=false`, and a stored `wavlm` result. It shows model predictions, including word/phone detail; it does not run inference or call the Codespaces service. Tagalog transcript comparison and legacy simulated scores are excluded. Tutor monitoring exposes session metadata only, not conversation text. The status page confirms the current API/database query and labels configured WavLM/Groq settings `configured_not_probed`, not online.

The Learn page is a submission-counts-v1 classroom activity view; its submissions do **not** identify an FSRS or FIFAKT condition. The separate FSRS-6-only page counts only eligible, nonsimulated ordinary-classroom `vocabulary_review_events` stored under `scheduler_configurations.algorithm='fsrs6'`. The separate FSRS-6 + FIFAKT page labels the existing `fifakt-esr-v1` adapter as an untrained, simulated prototype and counts simulation traces only, never real learner outcomes. Research records and personal contexts are excluded. A read-only check of the configured database found **zero review events and zero review states** across all algorithms/contexts on 2026-11-05. No learning effectiveness or model prediction-quality metric is inferred.

## Website

`/dashboard` is the overview. `/monitoring/classes`, `/students`, `/learn`, `/fsrs`, `/fifakt`, `/pronunciation`, `/tutor`, `/users`, and `/status` are responsive server-rendered views. Lists have bounded pagination and search; classes expose their currently valid join code, when one exists. Detail links open class, student, and WavLM records. The FLUENTT mobile palette informed the new desktop sidebar, cards, typography, spacing, and empty/error states. Authorized curriculum and question tools remain reachable from the sidebar. User management is read-only; account changes, class edits, and settings mutations were not added because the existing policies require operator or owner actions.

The administrator website cannot be entered with a student account or a fabricated demo cookie. The temporary local preview opens `/dashboard` directly without sign-in on this PC. For a deployed administrator website, configure the existing OIDC provider with MFA and exact admin web origin, provision a distinct administrator identity via the documented operator CLI, and grant `monitoring.read`. `docs/ADMIN_AUTH.md` documents those prerequisites.

## Verification

- `npm ci` in `apps/admin`: completed (403 packages). Existing npm audit reported 16 moderate dependency findings; dependencies were not broadly upgraded.
- `npm run typecheck` in `apps/admin`: PASS after final edits.
- `npm run lint` in `apps/admin`: PASS after final edits.
- `npm run build` (two attempts): TypeScript and compilation PASS; prerender FAILED with Windows `EPERM` while creating generated `.next/server/app/*` directories (first `/_not-found`, then `/curriculum`). Production build is not verified.
- `python -m compileall` of new backend modules and import of API routes: PASS; 11 monitoring routes registered.
- `python -m pytest -q tests/test_admin_monitoring_surface.py tests/test_monitoring_metrics.py`: 12 PASS, one upstream Authlib deprecation warning. These are synthetic/unit checks, not live database acceptance.
- Selected existing administrator session/auth service tests: 14 PASS, 22 deselected. A broader HTTP TestClient run stalled on the first request in this environment and was stopped; it is **not** counted as passing.
- Browser check of local preview: `/dashboard` loaded actual configured-database counts and `/monitoring/classes` displayed the stored class and join code. `/monitoring/fsrs` showed zero eligible reviews; `/monitoring/fifakt` showed zero simulation traces and no real results. This verifies local reads only; it does not validate all aggregates. No database record was altered. Disposable PostgreSQL tests, real OIDC/MFA, deployed browser access, WavLM availability, and Groq availability: **NOT TESTED**. `FLUENTT_TEST_DATABASE_URL` was not set.

## Remaining work

1. Configure an approved OIDC/MFA provider and provision an administrator. Grant `monitoring.read` only after operational review; then verify real browser login and role denial with a disposable database before deployment.
2. Resolve the Windows `.next` build permission failure and run production build plus laptop-size browser acceptance.
3. Run disposable PostgreSQL tests for counts, membership/research exclusion, WavLM filtering, search/pagination, and access revocation. The query-shape unit checks do not prove data correctness.
4. For broader analytics, connect the intended learner review flow to approved, trustworthy review-event and prediction capture, then validate it. The current mobile Learn screens do not call the review API. Do not derive FSRS retention or learning mastery from submission counts. Define separate authorization before account/class mutations or sensitive transcript access.

No commits, pushes, deployment, model inference, or production data changes were made.

## Changed files

- Backend: `services/api/app/api/v1/router.py`, `services/api/app/core/config.py`, `services/api/app/modules/administration/cli.py`, `monitoring.py`, `monitoring_router.py`, and `services/api/tests/test_admin_monitoring_surface.py`.
- New admin UI: `apps/admin/src/app/monitoring/[section]/page.tsx`, `error.tsx`, `apps/admin/src/components/monitoring-screen.tsx`, `monitoring-account.tsx`, `apps/admin/src/styles/monitoring.css`, and no-store headers in `apps/admin/next.config.ts`.
- Existing admin UI/auth cleanup: `apps/admin/src/app/dashboard/page.tsx`, `globals.css`, `page.tsx`, `login/page.tsx`, `research/page.tsx`, `api/admin/[action]/route.ts`, `api/admin/curriculum/[...segments]/route.ts`, `api/admin/questions/[[...segments]]/route.ts`, `api/admin/research/[[...segments]]/route.ts`, `apps/admin/src/services/admin-server.ts`, `research-proxy.ts`, `apps/admin/src/components/admin-session.tsx`. The unused sample source `apps/admin/src/services/admin-demo.ts` was removed.
- Documentation: `docs/ADMIN_MONITORING_IMPLEMENTATION.md` and the scheduler-label decision in `docs/DECISIONS.md`.
