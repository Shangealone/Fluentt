# Track 1 Class Learning workflow implementation

2026-11-05. Scope: isolated development/test only. Combined checkout: `C:\Users\shang\Desktop\Fluent\versions\fluentt-version5-combined\.local-version-2`, branch `codex/version5-wavlm-integration`, inherited merge `942a2a7`. Existing uncommitted foundation/model work was preserved. The complete replacement Track 1 prompt is authoritative.

## Status

PARTIAL overall. Backend synthetic enrollment, immutable 15/15 allocation reuse, assessment execution, instructor publication, control reviews and status projections are implemented and exercised in disposable PostgreSQL. Student/instructor/admin interfaces typecheck and have targeted API/proxy tests; physical-device rendering, interrupted-app acceptance and live operation are UNVERIFIED. Real research participation and FIFAKT treatment remain BLOCKED.

## Isolation and architecture

The existing preparation service remains inactive. New execution endpoints require BOTH flags `FLUENTT_PARALLEL_RESEARCH_ENABLED` and `FLUENTT_PARALLEL_TEST_WORKFLOWS_ENABLED`, environment exactly `test`, and a server-queried database name matching `fluentt_test_[0-9a-f]{32}` on loopback PostgreSQL. Flags default false. A copied synthetic clearance also cannot allocate against a non-test database. These guards are not an approval mechanism for real students.

No production database was migrated. Migration `0027_parallel_test_workflows` follows `0026_parallel_foundation`, adding four private tables for frozen development policy, append-only events, resumable/final immutable attempts and per-allocation/item/version FSRS memory. Existing migrations and study allocations are unchanged. PUBLIC privileges are revoked; schema ownership is not itself a least-privilege runtime grant.

Development sequence: authorized preparation → frozen synthetic policy/clearance → explicit synthetic consent/eligibility enrollment → existing allocation service → pretest → instructor-published weekday activities for control → posttest → delayed assessment. Hybrid activities stay blocked, while assessments remain available under the development policy.

## New API routes

All paths below have prefix `/api/v1`; existing session authentication, secure transport, no-store middleware and error contracts apply.

| Method | Path | Authorization |
|---|---|---|
| POST | /admin/parallel-studies/{protocol}/test-workflow | Live research.read/manage plus class.manage, Origin and CSRF |
| POST | /admin/parallel-studies/{protocol}/test-enrollments | Same |
| GET | /admin/parallel-studies/{protocol}/test-monitor | Live research.read plus class.read |
| GET | /me/parallel-test/studies | Own school account links |
| GET | /me/parallel-test/studies/{protocol} | Own participation/current class context |
| POST | /me/parallel-test/studies/{protocol}/withdraw | Own retained participation |
| POST | /me/parallel-test/studies/{protocol}/{assessment-or-activity}/{target}/start | Own eligible participation and server window |
| GET | /me/parallel-test/studies/{protocol}/attempts/{attempt} | Own attempt |
| POST | /me/parallel-test/studies/{protocol}/attempts/{attempt}/{save-or-submit} | Own attempt, full snapshot/revision and UUID identity |
| GET | /instructor/parallel-test/studies | Owned active classes |
| GET | /instructor/parallel-test/{protocol} | Owning instructor |
| POST | /instructor/parallel-test/{protocol}/publish | Owning instructor, explicit UI confirmation |

Administrator fixed same-origin BFF: POST `/api/admin/parallel-test/{id}/{configure|enroll}`. It validates path/Origin/CSRF/content type and bounds the body; it forwards only fixed backend paths through existing administrator cookie authentication.

## Transactions and data separation

Mobile operations hold authenticated User/session → owner/class/membership → protocol → participant/attempt/memory. Admin operations hold live admin authorization and class context before protocol. Enrollment/monitoring use NOWAIT student locks while holding owner/protocol locks; contention returns retryable conflict. Protocol serialization and natural uniqueness prevent duplicate allocation/start/finalization. Final UUID plus exact body safely replays a committed receipt after the window closes; stale revisions and changed retries are rejected.

Public draft cards use the existing key-free vocabulary projection. Raw answers, keys, checking outcomes and memory decisions remain in private server records; final learner receipts expose only totals, scheduler identity string and submission time. Instructor monitoring contains coded participation/task statuses, not answers, keys, grades or individual conditions. No comparison/report/export implementation.

Mobile panel reuses LessonUI, vocabulary session wrapper and focus-scoped cleanup; hidden when feature returns 404. Drafts are explicitly saved; no offline persistence or autosave. Ambiguous requests retain exact UUID/body in memory; reconciliation reloads server state. Access loss leaves the attempt and clears its local state. Unsaved edits are deliberately discarded on exit/blur. This is not offline academic submission.

## Exact Track 1 source/test change inventory

Paths are relative to this checkout. Some foundation files were already untracked/modified before this task; only the listed Track 1 additions are claimed here.

- New: `services/api/app/models/parallel_workflow.py`; `services/api/migrations/versions/0027_parallel_test_workflows.py`.
- New: `services/api/app/modules/parallel_study/workflow_engine.py`, `workflow_service.py`, `workflow_router.py`, `workflow_schemas.py`.
- Modified: `services/api/app/modules/parallel_study/service.py` (copied synthetic-clearance guard only), `app/core/config.py`, `app/models/__init__.py`, `app/api/v1/router.py`, `services/api/.env.example`.
- New: `apps/mobile/src/features/research/ParallelWorkflowPanel.tsx`.
- Modified: `apps/mobile/src/services/api/vocabulary.ts`, `features/vocabulary/VocabularyScreen.tsx`, `features/dashboard/InstructorHome.tsx`.
- New: `apps/admin/src/app/api/admin/parallel-test/[id]/[action]/route.ts`, `apps/admin/src/components/parallel-test-manager.tsx`.
- Extended existing foundation page: `apps/admin/src/app/parallel-study/page.tsx`.
- New tests: `services/api/tests/test_parallel_workflow.py`, `services/api/tests/integration/test_parallel_workflow_postgresql.py`, `apps/mobile/tests/parallel-workflow.test.mjs`, `apps/admin/tests/parallel-workflow-proxy.test.mjs`.
- Documentation: this report, the six companion CLASS/STUDY/RESEARCH/FSRS reports, and appended `docs/DECISIONS.md`.

Existing FSRS/FIFAKT implementation, speech/Tutor/Personal source and frozen migrations 0001–0026 were not edited in Track 1. No real enrollment, production migration, checkpoint training, commit, push or deployment occurred.
