# Section 38B Prompt 05 - Classroom assessment draft support

Date: 2026-10-21, Asia/Manila. Repository: `C:/Users/Shan Gealone/Desktop/Backup/Fluentt`. Branch `codex/personal-learning-voice-updates`, baseline commit `6e2d7167e7f36e79172852d73c267a5dc84e13e5`.

## Outcome and prerequisites

**Implemented the prompt's safe draft-only fallback. Assessment publication is BLOCKED. No live timed assessment runner is claimed.**

Reports 01-03, progress/decisions, handoff/development/research documentation and actual existing models/services were inspected. `docs/SECTION_38B_04_REPORT.md` is absent: Prompt 04 produced clarification only; participant status/consent/withdrawal/allocation/roster implementation is still pending. This report does not invent its completion. The user confirmed that study-information/data-use consent materials and minor/guardian permission rules do not yet exist, and requested a planned 30 students with equal 15/15 capacity. Those numbers are not actual consented enrollment or an approved allocation method.

No independently approved Chapter 3 assessment instruments/blueprint, timing/attempt/timeout/auto-submit/feedback/scoring rules or delayed follow-up interval were supplied or found in the repository. Historical placeholder instruments, fixed duration/scoring values and old reports are not approved evidence. Therefore live delivery tasks 2-7 and student execution UI cannot safely be completed. The explicit fallback authorizes draft support while those dependencies remain blocked.

## Existing contracts reused

| Contract / actual path | Decision |
| --- | --- |
| `services/api/app/modules/research/classroom_{schemas,service,router}.py` | Reuse manager-owned draft configuration, live explicit permissions, session transaction, Origin/CSRF, If-Match, UUID retry receipts, bounded payloads and no-store. No new namespace or publish endpoint. |
| `services/api/app/models/research_classrooms.py` and frozen `migrations/versions/0017_research_classrooms.py` | Reuse immutable private protocol revisions, same-study frozen assessment references and event history. Store additive planning JSON; no schema migration or rewrite. Source head remains 0017, 70 domain tables. |
| `services/api/app/models/research.py::ResearchAssessment` | Pin the exact existing same-study instrument ID/version and validate kind. Locked means immutable storage, not institutional approval. Never copy its private instrument snapshot into planning DTOs. |
| `services/api/app/modules/questions/`, `app/models/assessments.py::{QuestionRevision,QuestionAnswerKey}` | Existing ten-method bank and immutable revision/private-key contracts remain authoritative. Draft support adds no separate item schema or authored questions/keys. |
| `services/api/app/modules/assignments/{capture,capture_schemas,publication}.py` (`publication.student_context`) | Existing ordinary unscored-capture-v1 start/save/submit and live class/member ownership remain unchanged. Distribution-only publications forbid configured timers; they cannot be silently repurposed. Future approved research delivery needs a reviewed versioned integration. |
| `services/api/app/modules/grading/` and `docs/GRADING.md` | Existing objective-exact-v1 grading overlay remains unchanged; no new normalization, scoring engine, grade writer or feedback policy is introduced. |
| `apps/admin/src/components/research-{manager,protocol-form}.tsx` | Extend the current Research Management overview/setup, session cleanup, uncertain-save exact retry and retained history. No parallel application/page. |
| `apps/mobile/src`, personal services/models and shared `spaced_repetition` | Entirely unchanged. No practice or questionnaire countdowns, new student navigation, scheduler changes or personal records. |

## Implemented behavior

`ProtocolConfiguration.assessment_delivery_draft` is optional. Absent plans are omitted from canonical stored request data to preserve prior Prompt 02/03 idempotency fingerprints. Old stored configurations and receipts remain readable; nothing is backfilled. Removing a draft affects only a newly saved revision. Previous versions stay retained.

The plan stores a version, common blueprint/difficulty/scoring policy references, three named stage drafts, and an optional explicit delayed-follow-up policy/positive interval. Stage names map to existing kinds:

| Draft stage | Existing instrument kind |
| --- | --- |
| `pre_test` | `pre_test` |
| `immediate_post_test` | `post_test` |
| `delayed_retention_test` | `delayed_retention` |

Each stage may remain unresolved while drafting. An entered instrument must occur in that protocol's frozen assessment references and match its exact study/version/kind. Distinct stages cannot reuse one instrument identity. Opening/closing windows and timer proposals reuse the existing assessment references rather than a conflicting second clock configuration. Maximum attempts are explicit positive strict integers; timeout/submission and feedback are versioned proposed references. The optional follow-up interval must be positive and declare `immediate_post_test_completion` as its proposed anchor. No interval or timeout behavior is inferred. Arbitrary new stages, per-group top-level overrides, answer/grade fields and approval booleans are rejected.

The one shared plan has no executable condition-specific content/scoring settings. This is structural planning, **not measured group equivalence, approved content, a published assessment or actual scoring**. Declared policy parameters are retained as inert JSON and are never executed.

Server `StudyOverview.assessment_publication` always reports `status=BLOCKED`, `execution_available=false`, mandatory unavailable/approval blockers, and missing draft fields. A complete-looking plan, synthetic clearance label or study configuration state cannot enable publication. Existing designated-class metadata also reports blocked assessment publication; ordinary classes retain the exact normal response with an empty study list. No new publish endpoint or client clock authority exists.

The administrator overview and setup show publication BLOCKED and a disabled publication control. The existing setup form supports all three stages, common policy references, explicit caps and follow-up interval. Fields are labeled, draft edits are disabled outside DRAFT, history stays inspectable, and existing exact-request recovery and session/access cleanup remain intact. No Expo assessment cards/runner are added while the participant boundary and approved publication contract are absent.

One minimal opt-in legacy change guards `_resolve_participant_for_user` in `research/experiment_service.py`: the exact `research-classrooms-v1` study marker is refused with HTTP 409 `research_assessment_publication_blocked` before instrument/list/start/resume/submit materialization. This prevents bypass through the older placeholder/timer/scoring path. Unmarked legacy studies retain existing behavior. The earlier infrastructure auto-authoring exclusion is preserved. This does not certify or repair unrelated legacy research functionality.

## Verification actually run

| Check | Actual result |
| --- | --- |
| Combined Python unit + real disposable PostgreSQL | **98 passed**, no failures/skips, 2 existing dependency deprecation warnings, 86.10 s. |
| New draft Python checks included above | 13 pure validation/serialization tests and 5 PostgreSQL HTTP/persistence/authorization tests. |
| Other Python checks included above | Prior research classroom/setup checks, 13 legacy controlled-experiment checks, and ordinary class/enrollment/response-capture/progress regressions. |
| `node --test scripts/research-setup.test.cjs` | **13 passed**; 3 new draft/blocked-publication form/contract checks plus prior BFF/RBAC/navigation checks. |
| Actual Next.js + isolated headless Chrome | **5 passed**; existing four workflows plus draft stage-cap save/history/blocked-publication behavior. 28.94 s. |
| Administrator `npm run typecheck`, `npm run lint`, `npm run build` | Passed, including production prerender/build. |
| Mobile `npm run typecheck`, `npm run lint` | Passed; 0 errors, same 29 existing lint warnings. No mobile source changes. |
| Ruff lint and selected formatting | Passed over the new/extended research draft schemas/services/tests. The legacy experiment module retains 8 existing Ruff findings; HEAD/current code/message sets are identical. No unrelated lint cleanup. |
| Entry/exit protected-file SHA-256 comparison | **162 of 162 unchanged**: tracked mobile source, shared scheduler, existing models and tracked frozen migrations. The additive 0017 migration was not edited. |

PostgreSQL tests cover draft revision persistence, immutable history, exact retry after an unknown network result, stale revision/body conflicts, cross-study/version/kind rejection, complete declarations remaining blocked, no result creation, unauthorized managers/mobile credentials, designated classroom metadata, no-store and direct legacy instrument/start/repeated-start/submit denial under differing client clock headers. Existing classroom tests cover live membership, owner/session/class access and all ten ordinary capture methods; existing personal-state snapshot regression passes.

**Denied start/submit requests are not tests of a working timer.** Server-authoritative expiry/resume/attempt caps, automatic timeout/late submissions, actual elapsed duration, actual grades, delayed interval execution, equivalent scoring across groups and native restart/background behavior are unimplemented and unverified. No native assessment UI test or real human outcome is claimed. Earlier baseline discrepancies (one personal schema-column assertion and two personal routing/history assertions) remain documented in reports 01-03; those complete baseline suites were not rerun or repaired in this slice.

The initial sandbox PostgreSQL run failed on local socket permission (54 unit passes, 43 fixture errors and one fixture-driven failure). The host-permitted rerun above passed all 98. Initial browser setup was denied a dependency junction; only its verified generated UUID source-copy directory was cleaned up, and the host-permitted browser rerun passed. Neither infrastructure issue was described as a passing test. No approval review rejected an action.

### Reproducible commands

From `services/api`:

```powershell
.venv/Scripts/python.exe -m pytest -q -x tests/test_research_assessment_drafts.py tests/test_research_setup.py tests/test_research_classrooms.py tests/test_controlled_experiment.py tests/integration/test_research_assessment_drafts_postgresql.py tests/integration/test_research_setup_postgresql.py tests/integration/test_research_classrooms_postgresql.py tests/integration/test_classrooms_postgresql.py tests/integration/test_enrollment_postgresql.py tests/integration/test_response_capture_postgresql.py tests/integration/test_progress_postgresql.py --tb=short
```

The existing disposable fixture was given `FLUENTT_TEST_DATABASE_URL` privately in-process: verify the configured host is localhost/127.0.0.1 and port 55432, replace the database name with maintenance `postgres`, then create/migrate/drop only fixture-generated `fluentt_test_<UUID>` databases. No connection to the configured application database was made and no credentials were printed. Missing PostgreSQL configuration skips those tests; SQLite is not substituted.

From repository root:

```powershell
node --test scripts/research-setup.test.cjs
$env:FLUENTT_PLAYWRIGHT_MODULE='C:/Users/Shan Gealone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node --test scripts/research-admin-web.test.cjs
```

The browser test copies actual source/config into its own generated `.next/research-test-<UUID>` workspace, excludes application environment files, uses an explicit synthetic HTTP backend and temporary headless browser, and cleans only its generated workspace after unlinking its dependency junction. The existing developer server was not stopped. Visual QA inspected `output/research-assessments/prompt05-overview.png` and `prompt05-setup-narrow.png`; the latter is a 390px administrator website viewport, not the Expo app. No horizontal overflow was detected. Prior Prompt 03 screenshot artifacts were preserved.

## Every file changed in this slice

Extended existing Prompt 02/03 implementation files (their earlier uncommitted changes are preserved):

- `services/api/app/modules/research/classroom_schemas.py`
- `services/api/app/modules/research/classroom_service.py`
- `services/api/app/modules/research/experiment_service.py`
- `services/api/tests/test_research_setup.py` (additive-field canonicalization expectation)
- `apps/admin/src/services/research-classroom-contract.ts`
- `apps/admin/src/components/research-protocol-form.tsx`
- `apps/admin/src/components/research-manager.tsx`
- `scripts/research-setup.test.cjs`
- `scripts/research-admin-web.test.cjs`
- `docs/DECISIONS.md`
- `docs/SECTION_38B_PROGRESS.md`

New files:

- `services/api/app/modules/research/assessment_draft_service.py`
- `services/api/tests/test_research_assessment_drafts.py`
- `services/api/tests/integration/test_research_assessment_drafts_postgresql.py`
- `apps/admin/src/components/research-assessment-status.tsx`
- `docs/SECTION_38B_05_REPORT.md`
- `output/research-assessments/prompt05-overview.png`
- `output/research-assessments/prompt05-setup-narrow.png`

No package, Expo source/navigation, question bank, assignment/capture/grading service, shared algorithm, model or migration change. All unrelated entry Git modifications and personal/reference outputs remain retained. No commit, push, deployment, application migration, real student data, actual consent/approval or production operation.

## Stop boundary and required future work

The fallback is complete; live assessment delivery remains BLOCKED. Supply approved instruments/blueprint, scoring/difficulty/group-equivalence rules, feedback, stage windows/attempt limits, timeout/auto-submit/late/missed/network recovery rules and the delayed follow-up anchor/interval. Complete and verify the research-only participant authorization and withdrawal boundary from Prompt 04 first. Confirm operator clearance/runtime privilege/auth deployment prerequisites without pretending a checkbox grants permission.

After those prerequisites and an authoritative next scope, integrate existing bank revisions and grading through a versioned research publication/capture contract, persist server start/deadline/response/elapsed/finalization evidence, enforce live permissions and consent at every operation, and test real timers, clock manipulation, expiry, retries, restart/background recovery and group comparability. Preserve ordinary unscored capture and personal practice behavior. **STOP after Prompt 05; no later execution, scheduler treatment, questionnaire timer or analytics work is implemented.**
