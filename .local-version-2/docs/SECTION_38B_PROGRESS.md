# Section 38B — Persistent progress and approval gates

Last updated: 2026-10-21 (Asia/Manila). Current task: **Prompt 08 - Verification and confirmed defect fixes complete; live research BLOCKED**. Baseline commit: `6e2d7167e7f36e79172852d73c267a5dc84e13e5`, branch `codex/personal-learning-voice-updates`.

Authority: the user's exact Prompt 08 permits independent verification and minimal confirmed research defect fixes only. Participant execution, methodology/model/instrument approvals and data release remain missing/blocked. Personal/mobile files, pure schedulers and ordinary classroom behavior remain unchanged. One unavoidable shared reviews-router guard is default-off for non-research requests and regression-tested. No commit/push/deploy or application/production data mutation. Current evidence: [SECTION_38B_FINAL_REPORT.md](SECTION_38B_FINAL_REPORT.md); per-prompt results below remain historical records.

## Prompt 01 checklist

- [x] Inspect Git status and preserve pre-existing `output/personal-learning/`, `output/personal-reference/`.
- [x] Read handoff, development plan, Section 36–39 reports, research documentation, instructions and actual source; distinguish reports from evidence.
- [x] Locate Next.js, Expo classroom/personal/research boundaries, FastAPI modules, PostgreSQL models/migrations, schedulers and tests.
- [x] Search repository for approved Chapter 3, ethics/permission and instrument artifacts. None independently approved found; record this limitation, not approval.
- [x] Create capability coverage matrix with EXISTING / PARTIAL / MISSING / BLOCKED status and actual paths.
- [x] Inventory existing shared dependencies that could affect Personal Learning; record unchanged behavior, protected paths and baseline fingerprint.
- [x] Define proposed explicit study/class/cohort/participant/protocol/allocation/configuration identifiers, keeping research learning contexts free of ordinary user/class identifiers.
- [x] Identify missing methodology and institutional/participant decisions without selecting research rules.
- [x] Run existing client baseline: 84 total, 82 passed, 2 existing failures; record exact assertions without fixing them.
- [x] Run mobile/admin typecheck and lint: passed; mobile 29 existing warnings, admin no lint findings.
- [x] Record isolated backend baseline: 244 tests, 243 passed, 1 existing schema-assertion failure; 2 dependency warnings. Initial sandbox TestClient stall was interrupted before the host-permitted retry; no application database was used.
- [x] Produce `docs/SECTION_38B_01_AUDIT.md` and this persistent checklist.
- [x] Closeout integrity: the protected 146-file SHA-256 exactly matches baseline; `git diff --name-only` is empty. Only these two new documentation files and the two pre-existing untracked output directories appear in Git status. HEAD remains `6e2d716`.
- [x] Prompt 01 complete as an audit, with methodology/activation gates and three existing baseline test discrepancies recorded. **STOP; no Prompt 02 implementation.**

## Evidence and current blockers

| Gate | Current status | Evidence / acceptance condition |
| --- | --- | --- |
| Designated Research Classroom | EXISTING foundation | Explicit private `classroom_bindings` in `models/research_classrooms.py`, separate server mutation and exact class-scoped manager permission. No automatic conversion or participant authorization. |
| Classroom-only backend access | PARTIAL | `modules/research/service.py:274,348` accepts personal/school students; `experiment_service.py:886` lacks class scope. Need explicit live designated-class + consent + participant/protocol authorization and negative tests, without changing Personal Learning. |
| Approved Chapter 3/instruments/clearance | BLOCKED | No independent approved artifact found. Provide versioned provenance, consent/guardian/assent policy and actual applicable institutional/site approvals before activation. |
| Allocation/algorithm | PARTIAL / BLOCKED | Two conditions in `models/research.py`; hardcoded 15/arm and client seed in research services. Approve design and concealment; prove quota/replay concurrency. FIFAKT remains simulated; no trained-model claim. |
| Instruments/assessment/timers/calendar | PARTIAL / MISSING / BLOCKED | `experiment_service.py` has placeholders and unenforced duration/prerequisite/delay rules. Runner hardcodes 45000 ms. Need approved instruments, real server timing and windows, weekday/timezone/missed-session rules. |
| Pronunciation outcome | BLOCKED | Fixed 88% in research submit code is not measured evidence. Keep research evaluation unavailable until approved valid execution exists; personal live Voice must remain unchanged. |
| Questionnaires | MISSING / BLOCKED | Need validated instruments/scales, licensing, timing, capture/scoring/export policy; no assumed Likert schema. |
| Research review isolation | PARTIAL | Shared `spaced_repetition/service.py` ignores explicit study in participant lookup and resolves non-null class IDs as classroom context. Propose separate research-only service using pinned unmodified adapters; no global/personal scheduler changes. |
| Analytics/exports | PARTIAL | `analytics_service.py`, Next `/research` and BFF exist. Need coded classroom/protocol/event-time allocation provenance, approved populations/missingness/privacy, explicit operator grant policy. |
| Baseline disagreements | OPEN | `scripts/enrollment.test.mjs:101`, `scripts/progress.test.mjs:49`, and `services/api/tests/test_schema.py:66` (old exact column list lacks existing `learning_experience`). Preserve and record until separately authorized resolution. They are not evidence that classroom research is implemented. |

Full findings, source references, proposed envelope and reproducible commands: [SECTION_38B_01_AUDIT.md](SECTION_38B_01_AUDIT.md).

## Later implementation dependency checklist — NOT authorized yet

The historical proposed client paths below remain unimplemented. Actual backend paths and completed acceptance checks are recorded in the Prompt 02 section below.

1. [x] Receive exact Prompt 02. Preserve the three audit baseline failures; leave missing approved-artifact and activation dependencies blocked.
2. [ ] Finish approved enrollment/withdrawal/cardinality policy. Prompt 02 implements only private opt-in configuration; historical proposed backend `app/modules/research/{classroom_context,classroom_schemas,classroom_service,classroom_router}.py`; optional additive `app/models/research_classrooms.py`. Preserve `LearningContext` research null student/class checks and frozen 0001–0016. Prompt 02 now adds `0017_research_classrooms` (70 domain tables); frozen 0001–0016 remain unchanged.
3. [ ] Approve live authorization/transaction/lock/replay contracts; prove personal, ordinary/other class, other study, removed/withdrawn/incomplete-consent users cannot enter new research execution.
4. [ ] Approve opt-in routes: proposed mobile `src/app/research-classrooms/[classId]/...`, `features/research-classrooms/`, `services/api/research-classrooms.ts`; admin `src/app/research/classrooms/` and fixed research BFF additions. Existing shared route registration or a designated-class link requires backward-compatibility tests; no personal UI/provider/controller rewrite.
5. [ ] Consent and frozen allocation/instruments before intervention. Actual server timers/calendar/delayed windows before assessment execution. Separate approved research review orchestration before logging. No state reuse from ordinary/personal contexts.
6. [ ] Approved questionnaires and valid model/scoring evidence before corresponding outcomes. No placeholder human results, constant pronunciation awards or simulated-model validity claim.
7. [ ] Research-only analytics and exports after primary provenance exists; approved coded allowlists, event-time condition, missing-data and small-cell policy, access/audit.
8. [ ] Real PostgreSQL tests only in generated disposable test databases, never a normal/production database. No native/provider/end-to-end claim from mocks.

## Acceptance checks for every future authorized slice

- [ ] Exact research designation is opt-in; no designation gives existing ordinary behavior.
- [ ] Every request resolves study + coded research classroom + participant + protocol + allocation + pinned algorithm configuration server-side. Class membership or invitation code never substitutes for consent.
- [ ] Existing private identity mapping and research null-identity context constraints remain intact; no public research-to-user/class bridge or personal-state backfill.
- [ ] Personal routes, navigation, learning activities, algorithms/parameters, scheduling, state and records remain unchanged. Normal class assignments/capture/results/progress remain behaviorally unchanged.
- [ ] Shared edits, only when unavoidable and authorized, are minimal/default-off, documented and covered by positive/negative regression tests. Freeze algorithms/registry and personal UI code.
- [ ] No client-selected algorithm/seed/condition, bypassable UI timer, fabricated duration, implicit grading/consent or unsupported model output becomes research evidence.
- [ ] No extra test failures versus the recorded baseline; known failures are explicitly retained rather than silently repaired in personal modules.
- [ ] Update this checklist with actual changed paths, dependency/approval state and measured checks, and stop at that prompt's boundary.

## Protected baseline integrity

146 tracked files from `apps/mobile/src`, `services/api/app/modules/spaced_repetition`, and `services/api/app/models`; sorted path + TAB + file SHA-256 entries joined by LF (UTF-8), aggregate SHA-256:

`dc91ff34290d846acde675ee0c737f9e3070c19a1a5086ef98fc52e57e9119bc`

Full provenance and commands are in the audit. This is a source-integrity check, not proof about uninspected live database rows.

Prompt 01 historical closeout: digest recomputed after documentation creation and matched exactly. No tracked source, Personal Learning code, existing test, scheduler, package, model or migration changed. No application database operation, commit, push or deployment was performed. Prompt 02 was subsequently authorized by its exact user prompt; see the new closeout below. The independent methodology/permission gates remain unresolved.


## Prompt 02 implementation and acceptance

- [x] Read audit/progress, existing architecture/decision/database/migration/auth/class/research contracts and methodology inventory. No approved Chapter 3/permission artifact was supplied or found; do not infer approval from old reports.
- [x] Add `services/api/app/models/research_classrooms.py`: seven private additive tables; reuse existing study, pseudonym, consent, allocation, instrument and scheduler/model version identities.
- [x] Add frozen migration `services/api/migrations/versions/0017_research_classrooms.py`: exact same-study FKs, draft/frozen-history guards, immutable event/allocation context, independent-clearance ledger, PUBLIC revocation and retained-record downgrade refusal. Source head 0017, 70 domain tables; no application database migration.
- [x] Add `services/api/app/modules/research/classroom_{schemas,service,router}.py`. Actual namespace `/api/v1/admin/research-classrooms` handles manager-owned configuration/history/designation/state; `/api/v1/me/research-classrooms/classes/{class_id}` is a separate metadata-only mobile overview.
- [x] Normal is the default without an explicit server-written binding. Personal roles cannot use the overview or bind as research participants; current membership/owner/class and exact per-class grants are enforced. Every mobile overview reports execution unavailable and participation unauthorized.
- [x] Store proposed dates/weekdays/IANA timezone/window/timer/due/allocation/consent/instrument configuration with immutable revisions. Require an explicit proposed target count because the reused root requires it; no sample size or research duration is inferred/defaulted.
- [x] Gate READY/ACTIVE on complete settings and independently recorded protocol/ethics/site/instrument/condition clearance. No HTTP verification toggle/writer exists; no real ledger entry was inserted. Missing valid model artifact evidence blocks dependent conditions.
- [x] Use existing live admin User/session/permission/CSRF/Origin transaction; exact manager/class authorization, UUID request/body replay, If-Match, bounded paging, owner NOWAIT checks and safe audit. Frozen conditions are not edited; late retries do not reverse later states.
- [x] Minimal shared changes only: model registration, API registration and one marker-specific legacy auto-authoring exclusion. No Personal Learning, normal classroom service, shared scheduler, frontend, package or frozen migration change.
- [x] Add `services/api/tests/test_research_classrooms.py` and `services/api/tests/integration/test_research_classrooms_postgresql.py`; extend only the existing additive-table schema assertion. Keep its known personal-column failure.
- [x] Verify fresh UUID PostgreSQL migrations, empty additive downgrade/upgrade, occupied downgrade refusal, private constraints, RBAC/cross-class/study/version boundaries, state/revocation gates, concurrent retries and untouched personal table snapshots. Only synthetic fixtures; never actual approval/consent or model outcomes.
- [x] Reproduce existing backend baseline: 243 pass / 1 known failure, 2 dependency warnings. Reproduce client baseline: 82 pass / 2 known failures. No additional baseline discrepancy was repaired or hidden.
- [x] Ruff passes over all seven new Python files. The exact original 146-file fingerprint matches after removing only the additive registry import, using PowerShell Sort-Object; all other 145 protected files remain unchanged. No mobile/admin/shared scheduler/frozen migration Git diff.
- [x] Final combined run: **51 passed, 0 failed/skipped**, 2 existing dependency warnings, 59.20 s: 16 new pure + 11 new research PostgreSQL + 24 existing classroom/enrollment/capture/progress PostgreSQL checks. Fresh migration and empty additive roundtrip use only generated UUID databases.
- [x] Create `docs/SECTION_38B_02_REPORT.md`; update this checklist, `docs/DECISIONS.md`, `docs/DATABASE_SCHEMA.md` and `docs/MIGRATIONS.md` with actual source head and approval/runtime limitations.
- [x] Preserve pre-existing untracked audit/output artifacts and unrelated work; no commit, push, deployment or normal/production data mutation.

### Remaining gates before real research execution

- [ ] Independently approved Chapter 3/protocol/instruments and applicable ethics/site/institution permission, including actual consent/guardian/assent and data retention/withdrawal rules.
- [ ] Reviewed real operator grant/verification process and non-owner runtime DB permissions. Runtime must have SELECT-only clearance access; PUBLIC revocation alone does not constrain owners. No verifier workflow/grant deployment is claimed.
- [ ] Approved classroom enrollment/consent and allocation workflow; stored pending/authorized fields are not a substitute for fresh live authorization. No participant-facing execution endpoint exists in this slice.
- [ ] Approved server calendar/timers, assessment execution, separate research review logging and valid algorithm/model implementation. Personal scheduling/progress must remain untouched.
- [ ] Approved questionnaire, analytic/export populations and privacy rules. Legacy research APIs remain outside the new execution contract and are not globally certified by these tests.
- [x] Exact authoritative Prompt 03 received; its administrator setup implementation is recorded below. Later execution still needs its own exact prompt.

Detailed endpoint, file, migration, test-command and blocker evidence: [SECTION_38B_02_REPORT.md](SECTION_38B_02_REPORT.md).

Prompt 02 closeout: **foundation complete; real activation and execution blocked on the gates above.** Report and persistent checklist updated; no further features started. Stop for the exact next prompt.


## Prompt 03 - Administrator research setup

- [x] Read Prompt 01/02 audit/report/progress, existing admin routes/design/authentication contracts, and installed Next.js route/custom-server/testing guides. Preserve the existing working tree and Personal Learning boundary.
- [x] Integrate Overview, Classroom setup and Revision history into the existing `/research` page and one current administrator navigation link. No parallel page. New workflow never auto-loads legacy demo analytics/results/exports.
- [x] Create explicit manager-owned DRAFT identity with proposed target, English/Tagalog and protocol version. Configure immutable draft revisions; keep identity/frozen protocol restrictions from Prompt 02.
- [x] Add manager-authorized, paginated choices for specifically permitted matching-language active classrooms, exact same-study locked instruments, and actual versioned scheduler configuration references. No seeding or private instrument/identity exposure.
- [x] Add optional typed `administrator_setup` JSON proposals for intervention weeks, daily availability, named phase windows, review policy and attempt limit. Three weeks is a placeholder/proposal; weekdays are not preselected; no approved schedule or attempt policy is inferred. No new table/migration or execution writer.
- [x] Canonical serialization omits absent proposals so older Prompt 02 request fingerprints continue to match. No existing records are rewritten.
- [x] Expose supported SM-2 configurations only; report installed simulated ESR as unavailable irrespective of database model labels. Add research-only readiness blockers for unsupported identities. Preserve all shared scheduler/algorithm/model files.
- [x] Show genuine server state, revision history/fingerprint, blockers and validation/empty/error states. Participant enrollment and outcomes are N/A. Independent permission references do not grant approval; activation is blocked while unresolved.
- [x] Extend only the existing BFF with a fixed research-classroom sub-contract: live research privileges, exact path/query/method allowlist, same-Origin/CSRF/UUID retry/If-Match, bounded JSON, dedicated cookies, no-store and no demo fallback. No browser storage/auth bypass.
- [x] Confirm unsaved navigation; preserve uncertain mutation identity/body/revision in memory and lock editing until exact retry/reconciliation. Reject late protected continuations after visibility/generation changes and clear protected study data on session/access loss.
- [x] Add 10 contract/native-form/navigation/proxy tests and 4 real Next.js/headless Chrome fixture workflows. Browser tests use a separately generated source-copy workspace and synthetic backend; preserve the existing port-3000 development server. Inspect desktop and 390px screenshots with no horizontal overflow.
- [x] Final Python run: **67 passed, 0 failed/skipped**, 2 existing dependency warnings, 63.77 s. Includes 12 new pure setup + 4 new setup PostgreSQL + 27 Prompt 02 + 24 ordinary classroom/enrollment/capture/progress checks, only generated UUID databases.
- [x] Preserve exact baseline discrepancies: **243/244 backend**, **82/84 client**, with the same one personal-column assertion and two personal onboarding/history assertions. No new baseline failure is concealed or repaired in personal code.
- [x] Ruff passes over the three extended research modules and two new Python test files. Original 146-file protected fingerprint matches after removing only the prior registry import. Personal/mobile and shared scheduler Git diffs are empty.
- [x] Administrator typecheck, lint and production build passed. The final build retried successfully with host execution after sandbox EPERM on a generated prerender directory; no live server was stopped and no source permission workaround was added.
- [x] Create `docs/SECTION_38B_03_REPORT.md`; update this checklist and `docs/DECISIONS.md` with exact file/dependency/verification/blocker evidence. Preserve all unrelated entry changes and existing output folders.
- [x] No real participant data/approval/model outcome, application database mutation, commit, push or deployment. No consent flow, questionnaire collection, student assessments, daily scheduler or algorithm treatment.

### Prompt 03 remaining dependencies

- [ ] Approved Chapter 3, phase/timer/attempt/review policies and instrument/consent/ethics/site/institution evidence; UI declarations and proposed three-week/weekday settings cannot substitute.
- [ ] Independently verified clearance/operator process, non-owner runtime grants and deployed admin auth/TLS prerequisites. Application databases must be at reviewed 0017 before serving the namespace; this prompt does not migrate them.
- [ ] Real ESR implementation/model validation before enabling that treatment. Existing simulated adapter remains unavailable.
- [ ] Exact authoritative next prompt before any participant workflow or execution logic. **STOP after Prompt 03.**

Actual paths and commands: [SECTION_38B_03_REPORT.md](SECTION_38B_03_REPORT.md). Visual test evidence is in `output/research-setup/`; all studies/classes shown there are synthetic browser fixtures, not participant results.

Prompt 03 closeout: administrator setup complete within its configuration-only boundary. All final checks above are recorded; independent approvals, runtime grants and real execution remain blocked/deferred. Stop for the next exact prompt.

## Prompt 04 - Clarification received (implementation pending)

- [x] Receive the authoritative participant enrollment/consent prompt. Its research-only isolation and no assessment/treatment boundary remain in force.
- [x] User explicitly confirms that study-information/data-use consent materials and minor/guardian permission rules are not available yet. Live consent/enrollment remains blocked; no invented materials or approval.
- [x] Record the user's reported total of 30 students and requested 50:50 SM-2/ESR balance: planned capacity 15 per condition, conditional on eligibility and voluntary permission. This is not an API-derived participant count, actual enrollment or automatic allocation.
- [ ] Approved allocation method and concealment, handling of fewer participants, withdrawals and replacements. A 50:50 target alone does not resolve these rules.
- [ ] Implement and verify research-only status, opt-out, withdrawal safeguards and protected roster without enabling unapproved enrollment/allocation. No Prompt 04 features or tests have been implemented by this clarification.
- [ ] Produce the Prompt 04 implementation report with exact checks and remaining blockers when that work is completed. The Prompt 03 verification results above do not verify Prompt 04.

This clarification changes only this checklist and `docs/DECISIONS.md`; no application configuration, student records, Personal Learning source or database has changed.

## Prompt 05 - Classroom assessments and timers (draft-only fallback)

- [x] Read reports 01-03, current progress/decisions, existing research instrument/assignment/capture/grading contracts and installed Next.js form guidance. `SECTION_38B_04_REPORT.md` does not exist; Prompt 04 has clarification only, not an implemented participant boundary. Do not invent its completion.
- [x] Confirm no independently approved assessment blueprint/instruments, scoring/difficulty/comparability rules, attempt/feedback/timeout policies or delayed follow-up interval were supplied. User-confirmed missing consent/minor materials and planned 30 students / 15 per condition remain separate blockers.
- [x] Reuse existing immutable protocol JSON and exact same-study frozen `ResearchAssessment` references. Add optional `assessment_delivery_draft`; no new table/migration, copied question bank, response format or grading implementation.
- [x] Provide distinct pre-test, immediate post-test and delayed retention draft stages; validate each mapped instrument kind/version and reject reused/cross-study references. One declared blueprint/difficulty/scoring plan applies to all conditions, with no executable per-group overrides.
- [x] Store only explicit proposed attempts, timeout/feedback policy references and positive delayed-follow-up interval anchored to immediate post-test completion. Opening/closing windows and timer limits reuse existing pinned assessment references. No inferred duration, interval, attempt cap or auto-submit rule.
- [x] Retain DRAFT-only edit, immutable revisions, shared content locks, manager/RBAC/Origin/CSRF checks, UUID/body retries, If-Match, bounded JSON and no-store. Omit absent additive draft fields from canonical request data so older retry fingerprints remain unchanged.
- [x] Return server `assessment_publication.status=BLOCKED` and execution false, even for fully populated draft declarations. Add a blocked status only within designated-class metadata. Normal class responses remain unchanged.
- [x] Add accessible administrator assessment draft controls and publication status to the existing Research Management form/overview. Publication control is disabled and no backend publish route exists. No student/mobile navigation or learning source changes.
- [x] Add an exact marker-specific guard preventing managed Research Classrooms from using the legacy assessment list/detail/start/submit runner. Ordinary/legacy unmarked behavior is preserved and covered by its existing 13 controlled-experiment tests.
- [x] Final backend run: **98 passed, 0 failed/skipped**, two existing dependency warnings, 86.10 s. Includes 13 new pure draft tests, 5 new disposable PostgreSQL draft/mobile-HTTP tests, prior setup/classroom research tests, legacy experiment tests and ordinary classroom/enrollment/capture/progress regressions. No real participant/permission/model fixture was used.
- [x] Administrator contracts/native-form/BFF: **13 passed**, including 3 new assessment draft checks. Actual Next.js/headless Chrome: **5 passed**, including the new draft save/history/blocked-publication workflow. Screenshots inspected; 390px viewport has no horizontal overflow.
- [x] Administrator typecheck, lint and production build passed. Mobile typecheck/lint passed, retaining 29 existing warnings. Python Ruff lint and selected formatting checks passed for the draft modules/tests; the legacy experiment module retains the exact same 8 Ruff code/message findings as HEAD.
- [x] Entry-to-exit SHA-256 comparison: all **162 tracked protected files** (mobile source, shared scheduler, existing models, frozen tracked migrations) unchanged. Frozen additive 0017 was not edited; source head remains 0017, 70 domain tables.
- [x] Preserve earlier unrelated working-tree modifications and prior output directories. PostgreSQL tests use generated UUID databases only. Browser checks use a separate synthetic backend/source-copy workspace and temporary browser; no application database or existing dev server change.
- [x] Create `docs/SECTION_38B_05_REPORT.md`; update decisions and this checklist with actual scope, changed files, checks and limitations. **STOP after Prompt 05's draft-only fallback.**

### Prompt 05 live delivery dependencies - all remain BLOCKED

- [ ] Implement and verify Prompt 04's approved voluntary participant authorization/withdrawal boundary; supply approved study-information, data-use and applicable minor/guardian rules. No checked toggle substitutes for them.
- [ ] Approved versioned assessment blueprint/content, difficulty/equivalence, scoring and feedback policies; map existing bank revisions through a reviewed research publication contract without changing normal assignment capture/grading semantics.
- [ ] Approved timers, attempts, timeout/auto-submit/late/missed-test/network recovery and follow-up rules. Only then implement server-persisted starts/deadlines, real responses/grades/duration/status and restart/background recovery.
- [ ] Future measured timer/resume/expiry/clock-manipulation/comparability tests. Current denied-request tests are not proof of a working timed assessment runner; no native assessment UI execution was tested.

Details and exact commands: [SECTION_38B_05_REPORT.md](SECTION_38B_05_REPORT.md). No features beyond this safe fallback are implied by these checked items.

## Prompt 06 - SM-2 vs ESR sessions: verification and BLOCKED outcome

- [x] Read reports 01-03/05 and progress/decisions, actual scheduler reports 28-31, scheduler/model/features/service/router/schema code and existing tests. Prompt 04 implementation/report is still missing; its recorded clarification is not participant authorization.
- [x] Verify actual registry: `sm2`, `fsrs6`, `fifakt`. Registration is not approved treatment readiness. SM-2 has a deterministic tested implementation; ESR defaults to `SimulatedFIFAKTModel` / `fifakt-simulated-v1` and always reports simulated. No trained/calibrated model or approved ESR methodology was found.
- [x] Compare SM-2 with Wozniak's primary reference. Installed ROUND_HALF_UP and updated-EF interval calculation differ from the published round-up/update-order procedure. Two read-only synthetic probes reproduce the differences; retain the Personal Learning algorithm unchanged and flag research-control version approval as unresolved.
- [x] Audit equal-pool/versioned instructions/access prerequisites, exact allocation/configuration pinning, private context isolation, review evidence, client-supplied timing and replay boundaries. Existing generic research review endpoints are not a verified designated-class treatment boundary. Do not enable or reuse them as one.
- [x] Preserve proposed three-week/weekday settings as inert draft configuration only. No approved weekend adjustment, missed/late policy, reminders or measurement rules were supplied; none selected or executed.
- [x] Run existing Python suites: **100 passed, 0 failed/skipped**, 3.62 s. Includes 46 scheduler/reference-simulation checks plus 54 existing research configuration/draft/legacy experiment checks. These do not validate real ESR or an approved human treatment.
- [x] Run existing client suites: **37 passed, 0 failed/skipped**, 4.56 s. Covers reviews adapter, personal practice/live pronunciation and research setup/blocked-publication contracts. One existing Node module-type warning retained.
- [x] No new tests, features, algorithm changes, models, migrations, UI/navigation, state/event writers or reminder schedule. No application/disposable database or human data access in this slice; unit-service fixtures are mocks and pure calculations only.
- [x] Create `docs/SECTION_38B_06_REPORT.md`; update this checklist and `docs/DECISIONS.md`. Compare all 559 entry tracked/unignored non-output files: only these two existing documentation files change, plus the new report. Preserve all prior unrelated changes/output.
- [x] **STOP with live treatment integration BLOCKED.** Verification outcomes are scheduler mechanics, an SM-2 reference mismatch and confirmed simulated ESR; no treatment outcomes or human observations were generated.

### Prompt 06 unresolved acceptance criteria

- [ ] Approved ESR definition, actual inference artifact/provenance/configuration, reproducible independent reference vectors and validity evidence. No FSRS-6/SM-2 substitution or relabeling; approved failure/deviation behavior required.
- [ ] Approved research SM-2 control definition/version, including rating mapping, rounding, update order and within-day repetition behavior. Preserve all existing Personal Learning/shared algorithms.
- [ ] Prompt 04 voluntary authorization/withdrawal and approved allocation, common frozen vocabulary/materials/instructions and assessment blueprint. Planned 30 / 15:15 does not satisfy these gates.
- [ ] Approved intervention dates/timezone/weekdays/windows, one explicit weekend rule for both arms, raw-vs-adjusted due-date provenance, missed/late/holiday/end-of-study policy and reminders.
- [ ] Approved review measurement protocol separating subjective rating, objective correctness, response latency, foreground active time and workload. No invented idle thresholds or client duration presented as verified study time.
- [ ] Separate research-only execution service and authorization/versioned state/event contract; exact retry ownership/body checks; pinned algorithm condition and content eligibility. Reuse unmodified pure adapters only after all prior gates pass.
- [ ] Real PostgreSQL/concurrency/isolation plus timezone/weekend/DST/missed-window/retry/group-switch/equal-content and native/session recovery tests when that execution exists. Current pure/mock test passes are not those acceptance results.

Evidence, reference probe values, measurement gaps and exact commands: [SECTION_38B_06_REPORT.md](SECTION_38B_06_REPORT.md).

## Prompt 07 - Questionnaires and analytics: safe availability and disclosure boundary

- [x] Read prior reports 01-03/05/06, progress/decisions and actual research/admin/auth/analytics/export contracts; note missing Prompt 04 report/participant workflow. No approved final questionnaire or statistical/privacy plan supplied/found.
- [x] Keep questionnaire UNPUBLISHED with collection false and instrument/response count null. No invented ISO/IEC 25010 items, scales, validation claim, response storage or live submission.
- [x] Add `reporting_schemas.py`: technical availability contract `research-reporting-readiness-v1`, 18 requested reporting areas with null values, n, denominators, observation windows and instrument/algorithm/metric versions. No private observation queries; zero is never substituted for missing eligibility/measurement.
- [x] Add Monitoring within the existing admin Research Management page. Display N/A/UNPUBLISHED/BLOCKED, actual parent protocol/configuration provenance and explicitly planned dates. No fake charts, observed/model predictions, gains, effects or pronunciation values.
- [x] Add fixed managed export gate with live research.read + explicit research.export and exact manager ownership. All authorized datasets still return 409, no CSV/attachment. Default roles gain no permission. BFF filters exact GET dataset queries, requires live privileges and rejects unexpected CSV/formula payloads instead of forwarding them.
- [x] Refuse managed-root legacy aggregate/CSV/codebook, participant/group/result and identity-revelation paths before disclosure; omit managed roots from old count-producing study list. Preserve unmarked legacy calculations and ordinary classroom/Personal Learning behavior. No approved small-cell or retain-all policy inferred.
- [x] Add 14 pure and 5 PostgreSQL reporting tests with explicitly synthetic unapproved QA records; verify null/denominator semantics, forbidden observation-query isolation, permission/ownership denial, no questionnaire routes, blocked CSV/private identity and unchanged learning snapshots.
- [x] Final combined Python run: **140 passed, 0 failed/skipped**, 2 existing dependency warnings, 91.92 s; real database checks only in generated disposable UUID databases. Includes prior research, ordinary classroom/enrollment/capture/progress regressions.
- [x] Administrator contracts/native form/BFF: **16 passed**. Personal practice/live pronunciation/reviews: **24 passed**, one existing Node module-type warning. Actual isolated Next/headless browser: **6 passed**, with Monitoring screenshots inspected at 1440px/390px and no horizontal overflow.
- [x] Administrator typecheck/lint/build passed; build host retry resolved sandbox-generated prerender EPERM without source permission changes or deployment. Targeted Ruff/format checks pass; existing legacy router/service findings retained, not fixed in unrelated code.
- [x] Preserve all 218 checked protected files byte-for-byte: mobile/Personal Learning, shared algorithms/scheduler, models/migrations, normal classroom/enrollment/assignments/grading/progress. No schema/head change (0017, 70 tables), dependency change, application database access, real consent/outcome, commit/push or deployment.
- [x] Create `docs/SECTION_38B_07_REPORT.md` and `docs/RESEARCH_EXPORT_DATA_DICTIONARY.md`; update decisions and this checklist with actual implemented availability fields, changed files, measured checks and blocked work. **STOP after Prompt 07.**

### Prompt 07 not completed because approved inputs/upstream execution are absent

- [ ] Approved final questionnaire, version/license, questions/scales, availability/validation/scoring/partial/missing/attempt/duplicate/withdrawal rules and participant authorization. No publication or submission flow enabled.
- [ ] Approved statistical/comparability plan and real eligible assessments/reviews/measurements before positive participant-flow/adherence/results/accuracy/workload/duration/distribution/missing-data aggregates or paired measures.
- [ ] Approved disclosure/small-cell/withdrawal/retention/access/audit policy and scoped population before releasing any pseudonymous observations. No guessed threshold, normalized maximum or inferred denominator.
- [ ] Actual thesis CSV/schema/serializer with proper formula/quote/newline protection and eligible-row provenance; current safety is refusal, not a claimed finished export encoder. Positive aggregate/questionnaire/CSV acceptance tests await those contracts.

Exact evidence and field semantics: [SECTION_38B_07_REPORT.md](SECTION_38B_07_REPORT.md), [RESEARCH_EXPORT_DATA_DICTIONARY.md](RESEARCH_EXPORT_DATA_DICTIONARY.md). Null availability is not a research finding or an observed count of zero.

## Prompt 08 - Final verification and minimal confirmed fixes

- [x] Read prior 38B reports/source and independently search approval evidence; retain the absent Prompt 04 report and user-confirmed missing consent/minor materials as blockers. Do not equate older completion reports with research readiness.
- [x] Reproduce defects before fixes in generated UUID PostgreSQL: 3 failures / 1 pass showed managed placeholder consent/detail exposure and generic review-context creation through an invalid legacy link.
- [x] Add research-only `execution_guard.py`; deny managed legacy detail/consent/eligibility/enrollment/allocation and generic research reviews. Preserve historical withdrawal code. No approval, policy, intervention, human event or algorithm invented.
- [x] Record the sole unavoidable shared source exception: `spaced_repetition/router.py`, one import/two pre-dispatch checks. Non-research requests immediately delegate without research queries; pure DB-bomb tests and real personal/ordinary HTTP regressions pass.
- [x] Negative integration chain verifies normal mode -> authorized draft/designation -> unresolved READY refusal -> no participation -> blocked legacy enrollment/allocation/test start -> absent questionnaire -> authorized blocked export -> null monitoring. This is refusal evidence, not a genuine completed human study.
- [x] Full non-PostgreSQL pytest: **728 passed, 1 existing failure, 199 deselected**, 39.77 s; selected disposable PostgreSQL research/ordinary/personal/migration checks: **55 passed**, 94.83 s. Expanded new final-verification file rerun: **4 passed**, 8.35 s; new pure guard file: **5 passed**, 1.21 s. Repeated tests are not additional unique cases. Two existing dependency deprecations retained.
- [x] Client regression/setup selection: **98 passed / 2 existing failures** out of 100, 6.59 s. All three pre-38B backend/client assertion disagreements remain documented, without personal behavior/test changes to hide them.
- [x] Admin typecheck/lint/build passed. Actual isolated Next.js/Chrome research UI: **6 passed**, 25.32 s; keyboard/native labels/status and responsive review at 1440/390px, no narrow overflow/page errors. Synthetic backend/browser evidence is separate from real FastAPI DB checks. Initial concurrent build/browser conflict was corrected by sequential reruns; failed invocations are documented.
- [x] Mobile typecheck/lint passed (29 existing warnings, zero errors); Expo Android/iOS/web JS export passed. No native binary/device/microphone/real-model/provider test claimed. No mobile source/dependency changed.
- [x] Targeted new/foundation/shared-dispatch Ruff checks and three new Python format checks pass. Existing legacy router/service findings are explicitly retained and are not a global lint pass.
- [x] Entry snapshot: 589 tracked/unignored files. Preserve previous dirty source and all evidence outputs. Of 227 protected entry files, 226 byte-identical; only shared review dispatch differs as documented. All mobile, pure algorithms/services, models and frozen migrations unchanged in this prompt. Original 146-file digest reconstructs exactly with the stated registry/router substitutions; it is not today's unchanged router digest.
- [x] Source head remains `0017_research_classrooms`, 70 tables. No application/production database access/migration, real approvals/participants/outcomes, commit, push or deployment. Use synthetic fixtures and generated disposable UUID DBs only.
- [x] Create `docs/SECTION_38B_FINAL_REPORT.md`; correct `PROJECT_HANDOFF.md`; update decisions and this checklist. Preserve existing reports and export dictionary; save new screenshots under `output/research-final-qa`.
- [x] **STOP after Prompt 08 verification. NOT READY FOR HUMAN DATA COLLECTION.**

### Final unresolved acceptance criteria

- [ ] Independently approved Chapter 3/protocol and applicable institutional/site/ethics permission; verified operator clearance and least-privilege deployed auth/TLS/runtime grants.
- [ ] Approved study-information/data-use/privacy/consent, minor/guardian/assent and withdrawal policy; implemented Prompt 04 voluntary participant/roster boundary and approved auditable allocation. Proposed 30 / 15:15 remains planning only.
- [ ] Approved comparable instruments/content/scoring/feedback/timers/attempts/timeout/recovery/late rules and independently anchored delayed follow-up; genuine managed assessment runner and positive acceptance tests.
- [ ] Real approved ESR artifact/reference evidence, approved SM-2 variant, isolated treatment/state/history and approved timezone/weekend/missed-review/measurement rules; positive calendar/replay/group/content/device checks.
- [ ] Approved questionnaire, statistical/comparability and privacy/disclosure/retention/export plan; actual eligible collection, denominators/projections and safe positive CSV serialization/tests. Current N/A/refusal is not a completed analytics/export system.

Exact commands, routes, baseline comparisons, every changed file, real-versus-mock boundaries and institutional/participant requirements: [SECTION_38B_FINAL_REPORT.md](SECTION_38B_FINAL_REPORT.md). No next implementation or live study is authorized by this checklist.
