# Parallel-group implementation

2026-11-05. Inactive foundation implemented; overall PARTIAL for complete participant operation. No real participants, production migration, commit, push or deployment. Prior uncommitted research/model work preserved.


## Implemented

New experiment identity esr-parallel-foundation-v1 is distinct from esr-counterbalanced-v1 and legacy sm2_control/esr_experimental groups. No old allocation, model, FSRS calculation or class record was relabeled. New SQL-backed draft preparation, immutable allocation slots, calendar/assessment metadata and administrative audit events live in app/modules/parallel_study and app/models/parallel_study.py.

FLUENTT_PARALLEL_RESEARCH_ENABLED defaults false in Settings/template. This flag enables ADMINISTRATIVE PREPARATION ONLY, not enrollment or treatment. No activation or participant submission endpoint exists. Both live control and experimental scheduling return blocked from the selector; experimental offline requests also block rather than report a baseline fallback as delivered hybrid. Offline control returns the existing calculate_fsrs6 result unchanged. Personal contexts are rejected.

Admin POST /api/v1/admin/parallel-studies creates an immutable draft using UUID Idempotency-Key, exact body fingerprint, real browser session, Origin/CSRF, research.read/manage and explicit research.classroom.<class-id>.manage. Active owner/class, language-matched published pool are revalidated. GET /{id} requires research.read and that class's read grant. POST /{id}/allocations revalidates governance/identity/consent; natural protocol/participant identity makes replay safe. There is NO public enrollment, clearance, activation, correction or scoring writer. Runtime DB least privilege and operator approval provisioning remain prerequisites.

GET /api/v1/me/parallel-study/status returns only inactive status to authenticated school students/instructors, never peers/conditions/model settings. Personal role is rejected. Mobile notices reuse secure SessionController.run and focus cleanup; they do not offer study actions. Instructor home and school vocabulary directory show availability/error states separately from ordinary classes. Admin /parallel-study has a research-permission-checked, no-store server read by known protocol ID; displays dates, stored counts and blockers, with no group comparisons/export. Local preview does not grant research access.

Legacy execution guards recognize the new type. Legacy SM-2 infrastructure refuses new parallel studies; legacy enrollment rejects an enrolled parallel identity, while new allocation rejects enrolled participation in other studies. Class joining is unchanged and never randomizes anyone. No ResearchParticipant/identity/consent writer was added. Cross-mechanism enrollment must remain closed until an approved transactional enrollment workflow is implemented and fully tested; database owners must not manually improvise real participant provisioning.

## Source changed in this task

Backend: app/core/config.py, app/api/v1/router.py, app/models/__init__.py, app/models/parallel_study.py; app/modules/parallel_study/{__init__,policy,schemas,service,router}.py; app/modules/research/{execution_guard,experiment_service,service}.py; .env.example; migrations/versions/0026_parallel_foundation.py; tests/test_parallel_study.py; tests/integration/test_parallel_study_postgresql.py.

Mobile: src/services/api/vocabulary.ts; src/features/research/ParallelPreparationNotice.tsx; src/features/vocabulary/VocabularyScreen.tsx; src/features/dashboard/InstructorHome.tsx; tests/parallel-status.test.mjs. Admin: src/app/parallel-study/page.tsx; src/components/admin-nav.tsx. Documentation: six PARALLEL_GROUP reports and appended DECISIONS.md entry. Existing model-development files already present before this task are not new implementation claims.

## Acceptance decisions

| Criterion | Status | Evidence |
|---|---|---|
| Distinct independently testable structure | PASS | new contract/five tables/gated services |
| Exact 15/15 target | PASS synthetic | concurrent 30 distinct + duplicate requests; exactly 15 per condition |
| Preserve historical records | PASS tested scope | additive-only migration; old ESR table survives downgrade; existing workflow tests |
| Class scheduler selection architecture | PASS offline; BLOCKED live | explicit context and condition; no active caller/writer |
| Protect live FIFAKT | PASS | no activation path or provider loader |
| Personal Learning unchanged | PASS scope | no personal screen/algorithm changes; role/context rejection |
| Calendar | PASS metadata/pure policy; BLOCKED execution | weekday/month/window tests; no active activity writer |
| Assessments | BLOCKED beyond metadata | no approved instruments/rubric/capture/retake policy; no fake scores |
| Authorization | PASS exercised paths | explicit class grants, real admin, CSRF, default-off, school-only status |
| Tests/regression | PASS automated scope | see test report; device/external availability UNVERIFIED |
| No production enrollment/deployment | PASS | only generated UUID databases used |

Not a full live study release. Daily participant opportunity execution/missingness ledger, instructor assignment publication for the new contract, assessment capture/scoring and approved participant enrollment/withdrawal remain BLOCKED. The inherited general classroom/assessment systems remain separate, not silently used as research evidence.
