# Section 38B Prompt 02 — Research backend and database foundation

Date: 2026-10-21 (Asia/Manila). Base: `6e2d7167e7f36e79172852d73c267a5dc84e13e5`, branch `codex/personal-learning-voice-updates`. Authority: the user's exact Prompt 02 and its classroom-only scope guard. Prompt 01 findings remain historical in `SECTION_38B_01_AUDIT.md`.

## Delivered boundary

Separate FastAPI configuration and read-only designation APIs implement `research-classrooms-v1`. A classroom becomes designated only through an authenticated, explicitly authorized server mutation creating a private study/class binding. No binding means normal mode. Designation is metadata, **not participant consent or permission to execute research**. The new mobile overview always returns `execution_available: false` and `participation_authorized: false`; there is no student assessment, recruitment, allocation, scheduler, questionnaire or treatment writer in this slice.

No approved Chapter 3, instrument approval or applicable institutional/site permission artifact was found in the repository or supplied with this prompt. Drafts may contain proposed settings and evidence references. READY/ACTIVE require complete configuration and separate, protocol-revision-specific verification evidence. An HTTP payload cannot mark ethics approved. No actual clearance, participant, allocation, outcome or institution permission was created.

Personal Learning code, navigation, algorithms and storage contracts remain unchanged. No frontend/BFF, dependency, environment configuration or production/developer database was changed. Existing ordinary-class routes still use their existing services. No commit, push or deployment occurred.

## Data model and migration

Source head is now **0017_research_classrooms**, following frozen `0016_learning_experience`; metadata has **70 domain tables** (63 existing plus seven additive private tables). This is a source/disposable-test result, not an assertion that any application database was upgraded.

| Private table | Purpose and constraints |
| --- | --- |
| `research_private.classroom_studies` | One manager-owned wrapper per existing `ResearchStudy`; DRAFT/READY/ACTIVE/PAUSED/COMPLETED, optimistic revision and exact current protocol FK. Immutable study/manager identity; retained history. |
| `research_private.classroom_protocols` | Append-only consecutive configuration revisions, stable protocol identity, SHA-256 fingerprint, bounded validated JSON configuration. Cross-study and current-pointer composite FKs. |
| `research_private.classroom_bindings` | Append-only explicit classroom designation, unique per study wrapper/class. Same-study FK, eligible matching-language class, draft-only insertion. All identifying classroom bridges stay private. |
| `research_private.classroom_enrollments` | Storage bridge to existing coded participants, protocol, binding and optional existing allocation. Pending/authorized/withdrawn; withdrawn terminal and assigned allocation cannot silently change. No HTTP writer in this prompt. |
| `research_private.classroom_assessment_references` | Exact same-study locked instrument/version, pinned window and optional positive timer. Matches its immutable draft configuration. No assessment items or keys exposed. |
| `research_private.classroom_clearances` | Append-only, consecutive verified/revoked evidence per protocol revision and kind, with artifact SHA-256 and verifier reference. No HTTP writer or automatic verifier. No real entries seeded. |
| `research_private.classroom_events` | Immutable UUID/body replay receipts and context: study, coded classroom binding, protocol, optional participant/allocation/condition/scheduler version. Allocation context must agree with the pinned protocol and existing group assignment. |

Reuse existing `ResearchStudy`, `ResearchParticipant`, private `ResearchIdentityLink`/`ResearchConsentRecord`, `ResearchGroup`/`ResearchGroupAssignment`, `ResearchAssessment`, `SchedulerConfiguration` and model-version records. Existing pseudonym and consent tables are not duplicated. Scheduler/model rows are referenced only; no algorithm is executed or scheduler state queried/updated by the new service.

The existing `LearningContext` research constraint remains unchanged: research has participant identity, with ordinary `student_id` and `class_id` NULL. The new private classroom bridge does not put ordinary identities in learning contexts or public research events. An authorized enrollment assertion requires an active school identity, eligible class membership, ACTIVE exact protocol, enrolled participant, matching condition allocation and declared required consent evidence. Pending bindings also reject Personal Learning identities. These storage assertions are not an implemented consent/enrollment workflow or a reusable authorization credential; future execution must revalidate all live evidence and withdrawals in its own transaction.

Migration 0017 contains frozen DDL and invoker-rights guards, not runtime metadata imports or data backfills. Earlier migrations and existing table definitions are unchanged. New tables/functions revoke PUBLIC access. Downgrade refuses any retained record in the seven new tables; an empty additive migration roundtrip is tested only in a separate generated UUID database. The application never migrates at startup.

**Deployment prerequisite:** PUBLIC revocation does not restrict schema owners. Provision and independently verify a non-owner runtime DB role with narrow grants. The clearance ledger must be SELECT-only to the HTTP runtime, with insertion reserved for an independently authorized operator/verifier process; protocols/bindings/references/events need SELECT/INSERT, wrappers need the necessary SELECT/INSERT/UPDATE. No DELETE or clearance-write HTTP capability is needed. No production grants, verifier workflow or real operator permissions were provisioned here. This separation, approved artifact verification and deployed OIDC/MFA/TLS remain blockers to real activation.

## Configuration and lifecycle

Each immutable protocol configuration stores optional draft proposals for study start/end, IANA timezone, distinct ISO weekdays (1 Monday–7 Sunday), versioned due-date policy, consent document/required evidence kinds, allocation unit/policy, existing condition-to-scheduler references and exact assessment instrument/window/timer references. Due-date and allocation parameters are stored policy references; their execution is not implemented. No duration, participant count, weekdays, retention delay, timer or consent-kind list is defaulted as research methodology.

The existing study table requires a positive target count, so the new create contract requires an **explicit proposed** `target_participants`; it does not reuse its legacy default 30 or treat the proposal as approved. Operational bounds (64 KiB configuration, 100 instrument references, 100 class bindings per wrapper, page size 1–100 and offset 0–10,000) limit request/query work, not research sample sizes.

States: DRAFT → READY → ACTIVE; ACTIVE → PAUSED → ACTIVE; READY/ACTIVE/PAUSED → COMPLETED. COMPLETED is terminal. Protocol edits and new designations are allowed only in DRAFT; a changed frozen protocol requires a new study. Pausing/completing remains possible when authorization has been revoked. Readiness/activation checks complete settings, designation, exact locked instrument versions/windows/timers, current per-kind protocol/ethics/site/instrument/condition clearance, current class eligibility/grants and scheduler references. FIFAKT without a nonsimulated artifact remains blocked; storing a version reference does not establish model validity.

Revocation is retained and appears in `activation_blockers`. It prevents subsequent readiness/reactivation. There is no automatic interpretation of institution revocation, data deletion or participant retention policy and no active execution worker to stop. Future research execution must check live state/clearances each time, even if a stored wrapper still says ACTIVE.

Managed existing `ResearchStudy` roots deliberately stay draft and cannot be updated/deleted through legacy operations. A minimal marker-specific guard prevents the legacy experiment GET seeder from authoring groups/instruments for these studies. Unmarked legacy behavior is preserved. This does **not** certify or globally repair the legacy research enrollment, analytics, seeding or simulated scoring paths identified in Prompt 01; they must not be used as the new classroom execution path.

## API and authorization contracts

All paths below are under `/api/v1`. Existing secure-transport, dedicated administrator browser-cookie, live User/browser-session, dashboard permission, Origin and CSRF contracts are reused. Device bearer credentials cannot substitute for administrator authentication. Default provisioning gains no new permissions. A researcher is an existing separate administrator identity with explicit research grants, not a new mobile role or a promoted instructor.

| Endpoint | Contract |
| --- | --- |
| `POST /admin/research-classrooms/studies` | `research.read` + `research.manage`; creates manager-owned unresolved draft; UUID `Idempotency-Key`. |
| `GET /admin/research-classrooms/studies` | `research.read`; only current manager's studies, paginated. |
| `GET /admin/research-classrooms/studies/{scope_id}` | `research.read` plus exact manager ownership; configuration and blockers, no human identity/instrument content. |
| `POST /admin/research-classrooms/studies/{scope_id}/protocols` | Manager, read/manage, UUID retry and exact `If-Match`; immutable new draft revision. |
| `GET /admin/research-classrooms/studies/{scope_id}/protocols` | Manager/read; paginated immutable configuration history. |
| `POST /admin/research-classrooms/studies/{scope_id}/classrooms` | Manager/read/manage **and** `research.classroom.{classUUID}.manage`; live eligible instructor owner/class, matching language, UUID retry, `If-Match`. |
| `GET /admin/research-classrooms/studies/{scope_id}/classrooms` | Manager/read; page before eligibility lookup, hide bindings without the exact class read/manage grant. |
| `POST /admin/research-classrooms/studies/{scope_id}/state` | Manager/read/manage, UUID retry, `If-Match`; READY/ACTIVE also require exact class manage grants and readiness gates. |
| `GET /me/research-classrooms/classes/{class_id}` | Existing live mobile session; owning eligible instructor or active school student with current eligible membership. Metadata-only normal/research mode; Personal Learning and cross-class access denied. Paginated. |

Missing freshness returns 428, stale revisions 412, conflicting retries 409. Retried committed requests return their immutable receipt; a late ACTIVE retry cannot undo a later PAUSED state. No existing resource is silently replaced. Authorization, writes, safe audit and receipt materialization remain in one transaction. Every successful/error response inherits existing `no-store` middleware.

Admin User/session locks serialize same-manager mutations and permission changes. Class checks lock distinct eligible owners in UUID order with FOR SHARE NOWAIT, then classes in UUID order and current membership where needed, refreshing ORM rows after waits. Owner contention returns retryable 409 rather than waiting while another actor is held. Study changes lock their private wrapper; exact content references reuse shared advisory boundary 78090001. No personal state is accessed. These contracts do not grant any legacy research permissions implicitly or add a browser auth bypass.

## Verification

**Final combined result: 51 passed, 0 failed/skipped, 2 existing dependency deprecation warnings, 59.20 s.** This comprises 16 new pure tests, 11 new research PostgreSQL integration tests and 24 existing classroom/enrollment/capture/progress PostgreSQL tests. All database operations used generated disposable UUID databases.

Executed test commands from `services/api` (maintenance URL supplied privately in-process, never logged):

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_research_classrooms.py tests/integration/test_research_classrooms_postgresql.py tests/integration/test_classrooms_postgresql.py tests/integration/test_enrollment_postgresql.py tests/integration/test_response_capture_postgresql.py tests/integration/test_progress_postgresql.py --tb=short
```

`FLUENTT_TEST_DATABASE_URL` was derived in memory from the local configured URL **only after checking localhost/127.0.0.1 and port 55432**, replacing its database with `postgres`. The integration fixture connects to maintenance solely to create/drop its generated `fluentt_test_<UUID>` databases. It never connects to/migrates/downgrades/resets the named application database. The independent empty-roundtrip fixture does the same. Only synthetic test accounts, instruments and explicitly labeled synthetic clearance fixtures are used; they are not actual consent or approvals.

New checks cover strict weekdays/timezones/aware ordered dates/window bounds/timers, forbidden approval booleans, bounded configuration, explicit proposed count, frozen DDL/model match, private composite FKs, same-body concurrent retries, stale writers, history/pagination, state edges, missing/revoked evidence, missing model artifact, role/ownership/class grants, CSRF/Origin, live admin/class-grant revocation, membership loss, cross-class/study/instrument/version/language denial, Personal Learning identity denial, append-only guards, root isolation and retained-data downgrade refusal. A disposable test compares complete profile/context/progress/review-state/event table snapshots before/after configuration, including a nonempty personal profile/context, and confirms no change. This is test-database evidence, not inspection of real learners.

Recorded backend baseline rerun (same selection as Prompt 01): **243 passed, 1 existing failure**, 2 dependency deprecation warnings, 17.56 s. The unchanged failing assertion is `tests/test_schema.py::test_learning_focus_is_additive_and_retains_grade_history`: its old exact column list omits the already-existing `learning_experience`. Only the separate metadata-count/additive-table assertion was extended for 70 tables; this old personal assertion was not repaired.

Recorded client command from repository root:

```powershell
node --test scripts/research.test.mjs scripts/reviews.test.mjs scripts/classes.test.mjs scripts/enrollment.test.mjs scripts/assignments.test.mjs scripts/capture.test.mjs scripts/results.test.mjs scripts/progress.test.mjs scripts/onboarding.test.mjs scripts/dashboard-components.test.cjs scripts/personal-practice.test.cjs scripts/live-pronunciation.test.cjs
```

**82 passed, 2 existing failures** (84 total): `scripts/enrollment.test.mjs:101` expects `/learning-focus` while existing personal routing uses `/language`; `scripts/progress.test.mjs:49` omits existing personal `experience` and expects access. No client assertion/source was changed. Node reports existing module-type warnings. TypeScript/frontend lint were not rerun because no frontend or package file changed; their Prompt 01 results remain historical, not a new claim.

Ruff over the seven new Python files passed. Prior failed development runs caught a duplicate constraint-name issue and incorrect assumptions in newly written tests; corrected before the final verification. There is no claim that every repository suite, native device, provider, real OIDC cookie/TLS deployment or research outcome was verified.

Integrity: all 146 original protected source files reconstruct the Prompt 01 digest exactly after removing **only** the new model-registry import. Using PowerShell `Sort-Object` on relative paths, LF-joined path + TAB + lowercase file SHA-256 gives `dc91ff34290d846acde675ee0c737f9e3070c19a1a5086ef98fc52e57e9119bc`. The other 145 protected files are untouched. All `apps/mobile`, `apps/admin`, shared scheduler files and frozen migrations 0001–0016 have no Git diff. Untracked pre-existing output directories and the Prompt 01 audit are preserved; HEAD remains the base commit.

## Changed files

New implementation/test paths:

- `services/api/app/models/research_classrooms.py`
- `services/api/app/modules/research/classroom_schemas.py`
- `services/api/app/modules/research/classroom_service.py`
- `services/api/app/modules/research/classroom_router.py`
- `services/api/migrations/versions/0017_research_classrooms.py`
- `services/api/tests/test_research_classrooms.py`
- `services/api/tests/integration/test_research_classrooms_postgresql.py`

Minimal existing source/test changes:

- `services/api/app/models/__init__.py` — register additive models only.
- `services/api/app/api/v1/router.py` — register the two separate namespaces only.
- `services/api/app/modules/research/experiment_service.py` — marker-specific exclusion from legacy auto-authoring.
- `services/api/tests/test_schema.py` — expect seven additive tables; preserve the known personal-column failure.

Documentation: this report, `docs/SECTION_38B_PROGRESS.md`, `docs/DECISIONS.md`, `docs/DATABASE_SCHEMA.md`, `docs/MIGRATIONS.md`. The pre-existing untracked `docs/SECTION_38B_01_AUDIT.md` is unchanged.

## Remaining approval and execution blockers

1. Supply independently approved Chapter 3, protocol/instrument artifacts and actual applicable ethics/institution/site authorization. Resolve consent/guardian/assent, retention/withdrawal, allocation/concealment, policy/calendar/timer and instrument-version decisions through those artifacts, not this report or a UI toggle.
2. Approve the real operator verification/provisioning process; establish non-owner runtime grants and independent clearance-writing authority before using real data. No actual role grants or evidence verification have been performed.
3. Implement separately authorized classroom-only enrollment/consent and allocation workflows before any participant execution. Existing legacy recruitment/execution cannot stand in for that authorization boundary.
4. Implement approved server timers/schedules, participant tests, research review logging and algorithm treatment in later prompts. No trained FIFAKT/integrated ESR/valid Tagalog scoring claim is supported by this foundation.
5. Questionnaires, outcome analytics and coded exports remain later scope and depend on approved instruments/populations/privacy rules and real provenance. No fabricated data or metrics were generated.

Prompt 02 stops here. The next work requires the exact Prompt 03 and its scope; no administrator UI or student execution has been started.
