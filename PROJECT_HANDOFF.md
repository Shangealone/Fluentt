# FLUENTT Project Handoff

Updated 2026-10-21 (Asia/Manila), Section 38B Prompt 08. Current evidence: [SECTION_38B_FINAL_REPORT.md](docs/SECTION_38B_FINAL_REPORT.md). Earlier Section 36-39 completion claims are historical reports, not proof of approved or executable human research.

Later personal History follow-up (2026-10-21): **Stats → History** now logs personal Learn/Voice/Tutor activity metadata from actual interaction callbacks. Source/local development head is **0018_personal_history, 71 tables**; the verified localhost development DB received its tested cumulative 0016→0018 upgrade with old table counts preserved. Real history is owner-only and durable; demo history starts empty/in-memory. No raw responses/recordings/dialogue, grades, mastery, scheduler or research outcomes are added. Client checks: 65 passed; selected disposable PostgreSQL checks: 11 + 1 passed; full non-PostgreSQL backend: 775 passed / 1 existing failure / 204 deselected. Mobile typecheck/lint (29 existing warnings) and web/iOS/Android JS exports passed. Exact files, local CORS configuration and remaining limitations: [PERSONAL_HISTORY.md](docs/PERSONAL_HISTORY.md). Research remains blocked; the snapshot below predates these later personal changes.

## Section 38B checkout and verification snapshot

- Workspace: `C:/Users/Shan Gealone/Desktop/Backup/Fluentt`.
- Branch: `codex/personal-learning-voice-updates`; HEAD `6e2d7167e7f36e79172852d73c267a5dc84e13e5`. Prior work and Section 38B modifications remain uncommitted. No commit, push, deployment or application database migration occurred during verification.
- Source migration head: `0017_research_classrooms`; registered metadata: 70 domain tables. Fresh migration and isolated 0017 roundtrip/guard tests pass in generated UUID PostgreSQL databases. Application database version/data and deployed grants were not inspected.
- Backend non-PostgreSQL suite: **728 passed, 1 existing failure, 199 deselected**. Selected real PostgreSQL integration: **55 passed**. Client regression/setup suite: **98 passed, 2 existing failures**. The three assertion disagreements are documented in the final report; Personal Learning was not changed to conceal them.
- Admin typecheck, lint and production build passed; isolated actual Next.js/Chrome research UI: **6 passed**. Mobile typecheck passed; lint: 0 errors/29 existing warnings. Expo Android/iOS/web JavaScript exports passed. These are not native binaries, device/provider checks or production certification.

## Research status: NOT READY FOR HUMAN DATA COLLECTION

The classroom-only foundation supports explicit designation, authorized draft configuration, immutable protocol revisions, activation blockers, assessment delivery proposals and monitoring availability. Admin route: `/research`, fixed BFF `/api/admin/research/classrooms/...`. Backend: `/api/v1/admin/research-classrooms`; read-only mobile metadata: `/api/v1/me/research-classrooms/classes/{class_id}`. No new mobile execution screen exists.

Live enrollment/allocation, genuine pre/post/delayed tests, authoritative timers, weekday/weekend treatment, questionnaire collection, observed analytics and thesis CSV release remain **BLOCKED**. Prompt 04 has clarification only; `docs/SECTION_38B_04_REPORT.md` is absent. Planned 30 students / 15:15 SM-2:ESR are a proposal, not an actual authorized cohort.

Managed roots carry `research_contract=research-classrooms-v1`. Placeholder consent/study/eligibility/enrollment/allocation and generic research review routes refuse these roots; managed legacy assessments/disclosure were already blocked. Withdrawal code was not changed. The shared reviews router has one default-off guard: non-research requests make no research query and retain their scheduler calls. All mobile source and pure algorithms remain unchanged.

Before collection, supply independently approved Chapter 3/protocol and applicable ethics/institution/site authorization; study-information/data-use/privacy/consent materials; minor/guardian/assent rules; allocation/concealment/withdrawal policy; versioned assessment/questionnaire instruments and scoring; calendar/timer/follow-up/measurement policies; statistical/disclosure/retention rules. Establish independent clearance verification, non-owner runtime database grants and deployed OIDC/MFA/TLS. UI references and synthetic test-only clearance entries confer no institutional permission.

Registry: `sm2`, `fsrs6`, `fifakt`. ESR currently uses `fifakt-simulated-v1`, with `simulated=true`; no trained/calibrated artifact or approved treatment was verified. SM-2 uses updated ease and half-up interval rounding; approve its research control definition rather than changing Personal Learning. No verified Tagalog pronunciation measurement, human outcome or statistical superiority is claimed.

## Actual repository map and boundaries

| Surface | Paths and responsibility |
| --- | --- |
| Expo student/instructor app | `apps/mobile/src/app`; role/session authority in `src/session`. Personal screens/navigation/state/history and normal classroom flows are protected from Section 38B changes. |
| Next.js administrator | `apps/admin/src/app`, `src/components`, `src/services`; research uses existing navigation, separate browser authentication and explicit permissions. |
| FastAPI | `services/api/app/modules`; classroom/enrollment, curriculum/questions, assignments/capture, grading/results, progress/monitoring, communications and learning services. Only backend accesses database/providers. |
| Research foundation | `research/classroom_{router,schemas,service}.py`, `assessment_draft_service.py`, `reporting_{schemas,service}.py`, `execution_guard.py`; private models in `app/models/research_classrooms.py`. |
| Database | `services/api/app/models`, `app/db/base.py`, immutable `migrations/versions`. Never reset/stamp/downgrade an existing database for QA. |
| Evidence | `docs/SECTION_38B_01_AUDIT.md`, reports 02/03/05/06/07, final report, `SECTION_38B_PROGRESS.md`, `RESEARCH_EXPORT_DATA_DICTIONARY.md`, `DECISIONS.md`. Missing report 04 is not completed work. |

Research learning contexts use coded participants, excluding ordinary user/class identifiers; identity mappings remain private. Class membership does not grant consent. Monitoring returns 18 unavailable metrics with null counts/denominators/windows, not zero-valued observations. Exports refuse disclosure; the dictionary documents availability, not a released CSV schema. Screenshots/API doubles and disposable database records are explicitly synthetic.

## Verification and local use

Exact commands, fixture scope, failures and platform limitations are in the final report. PostgreSQL fixtures create/migrate/drop only generated `fluentt_test_<UUID>` databases through a reviewed maintenance connection. Keep credentials in ignored environment files and out of logs.

From `services/api`: `.venv/Scripts/python.exe -m pytest -m 'not postgresql' -q --tb=short --maxfail=20`. From each client directory: `npm run typecheck`, `npm run lint`; admin additionally `npm run build`. Run the admin build sequentially with browser tests: their synthetic workspace is under `.next`. Selected passes do not establish a passing historical/wildcard suite.

Refer to `README.md` for local development and `docs/MIGRATIONS.md` before any separately authorized application migration. The earlier demo guide is illustrative; do not seed participants or enable placeholder approvals to demonstrate research. Native device/provider and approved positive research execution checks remain outstanding.

**STOP after Prompt 08.** Future implementation requires missing approved inputs and an explicit next scope; this handoff does not authorize live research or deployment.
