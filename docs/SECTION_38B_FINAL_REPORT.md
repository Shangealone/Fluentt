# Section 38B Prompt 08 - Final integration, QA and verification

Date: 2026-10-21, Asia/Manila. Workspace: `C:/Users/Shan Gealone/Desktop/Backup/Fluentt`. Branch: `codex/personal-learning-voice-updates`; HEAD: `6e2d7167e7f36e79172852d73c267a5dc84e13e5`.

**NOT READY FOR HUMAN RESEARCH DATA COLLECTION.** Verification and two targeted safeguards are complete within Prompt 08. Configuration, isolation and refusal paths work under the checks below. The requested positive participant-to-export study cannot run: upstream consent, instruments, treatment, timing, questionnaire and analysis approvals/implementation remain absent. Passing denial tests is not evidence of a completed experiment, valid model or superior algorithm.

## Evidence and disposition

Read the handoff, development plan, architecture/decisions, Section 36-39 and 38B reports 01/02/03/05/06/07, progress checklist, research/export dictionary, actual auth/class/assignment/grading/scheduler/model/migration code and tests. `SECTION_38B_04_REPORT.md` is absent; Prompt 04 has only a clarification. Repository searches found no separately approved Chapter 3, consent/privacy, minor-permission, final questionnaire, instrument or statistical-plan artifacts. No external document repository was searched and absence is not permission.

The user confirmed that consent/data-use materials and minor/guardian rules are not available. Thirty students and a proposed equal 15:15 split remain planning inputs, not enrollment, consent, allocation-method approval or observed sample sizes. No real participants, approvals, outcomes or model functionality were fabricated. No application/production database was queried or migrated; no commit/push/deployment occurred.

| Capability | Final status | Independently checked evidence / remaining gap |
| --- | --- | --- |
| Explicit Research Classrooms and private study context | IMPLEMENTED foundation | Separate server-authorized study/class binding, normal default, coded identity constraints; private migration and class access tests. Designation does not authorize participation. |
| Admin study setup / version history | IMPLEMENTED configuration only | Current `/research`, exact manager/RBAC/class grants, Origin/CSRF, UUID/body retries, If-Match, immutable versions, paginated lists/choices, state and clearance gates. Proposed settings execute no intervention. |
| Voluntary enrollment, consent, minors and withdrawal | PARTIAL storage / live workflow BLOCKED | Existing private tables and constraints; no approved managed participant workflow. Legacy placeholder paths now refuse managed roots. Existing withdrawal code retained, not certified as an approved managed withdrawal process. |
| Two-condition allocation | BLOCKED | Planned 50:50 ratio is not a reproducible approved allocation/concealment/quota/replacement policy. No live managed allocation; no 30-person cohort created. |
| Pre / immediate post / delayed tests | PARTIAL drafts / publication BLOCKED | Three versioned draft stages and pinned same-study references, comparability declarations; no approved published instruments, genuine responses or measured outcomes. |
| Authoritative timers / attempts / restart recovery | BLOCKED | No managed attempt runner, persisted deadlines, timeout/auto-submit or late policy. Denied legacy starts do not prove any timer behavior. |
| SM-2 versus ESR | BLOCKED | SM-2 deterministic repository variant exists; control definition unresolved. Installed ESR uses simulated model, not approved trained/calibrated inference. |
| Weekdays, timezone, weekends, missed reviews | PARTIAL configuration / execution BLOCKED | Validation and proposed dates/timezone/weekdays exist; no approved common adjustment or missed/holiday/end-of-study rule and no research-only treatment runner. |
| Research reviews / genuine latency / active study time | BLOCKED | No approved context-specific writer or measurement protocol. New guard blocks managed access to generic research reviews; no raw/adjusted due dates or measured workload invented. |
| Questionnaires | UNPUBLISHED / BLOCKED | No approved items/scales/version or managed publication/submission route; response count stays null. |
| Monitoring and denominators | IMPLEMENTED availability / observations BLOCKED | Real authorized configuration provenance; 18 null-only availability entries, N/A for values/n/denominators/windows; no personal or normal-class aggregation. |
| Thesis exports / statistical measures | BLOCKED | Live explicit export permission + exact manager; authorized requests still return 409 JSON, no CSV. No inferential pipeline or significance claims. Dictionary describes availability, not a released dataset schema. |
| Personal / non-research regression | VERIFIED within stated scope | Mobile and pure algorithm files unchanged; default-off shared guard, existing client checks, disposable normal-class/personal checks and state snapshots. Existing baseline discrepancies retained. |

## Confirmed defects and minimal fixes

New disposable-DB checks were run before remediation: **3 failed, 1 passed**, 8.61 s, two dependency warnings. They demonstrated two concrete isolation defects:

1. A managed draft study could be opened through legacy student detail/consent routes; consent-document returned a placeholder affirmation and unsupported permanent-retention language. Add `execution_guard.assert_no_managed_execution` at legacy detail, consent-document, eligibility, enrollment and allocation entry points. Managed requests now return 409 `research_classroom_execution_blocked`; no consent record can be created by sending an affirmation boolean. Existing withdrawal functions remain untouched.
2. An explicitly synthetic invalid legacy participant link (enrolled label, eligibility pending, no consent) could call generic research due reviews and create a research learning context. Add the guard before generic due/event service dispatch. Research requests referencing a managed study, designated class, or ambiguous managed identity link are refused before context/state/event work. The legacy resolver does not reliably select the requested study, so an ambiguous managed link must fail closed even without supplied IDs.

The only unavoidable shared source edit is `services/api/app/modules/spaced_repetition/router.py`: one import and two guard calls. Non-research requests return from the guard immediately, without research queries or altered parameters/service calls. Pure tests use a database double that raises on any query to enforce this; real PostgreSQL tests preserve personal/ordinary due contracts. No scheduler calculation, default, state/history schema, personal screen, navigation or record was changed.

Four integration tests now cover: managed placeholder consent denial; independent study/class and implicit-link review denial without consent/context writes; the unapproved configuration-to-export refusal chain; existing personal/ordinary empty due behavior with no review-event additions. Five pure guard cases cover default-off and unmarked legacy delegation. Enhanced denial checks also prove a managed legacy link does not block that user's personal due request. These deliberately invalid fixture records are denial inputs, not claimed authorizations or study observations.

No architectural rewrite or research rule was introduced. `scripts/research-admin-web.test.cjs` gains optional screenshot output/prefix settings, retaining previous defaults, to preserve earlier evidence images.

## Integrated flow actually verified

Disposable synthetic HTTP/database tests exercise real auth/session transactions and migration guards: normal class metadata; authorized study draft with proposed target 30; explicit class binding; unresolved READY refusal; designated metadata with execution false; blocked legacy detail/eligibility/consent/enrollment/allocation; managed assessment start refusal; absent questionnaire submission; permission/ownership-checked blocked exports; null monitoring with no participant creation in that chain.

The existing integration suites additionally exercise concurrent identical retries/stale writers, live admin/session/grant revocation, cross-manager/class/student denial, cross-study references, immutable history, unsupported model labels, disclosure/identity bypass denial and unchanged learning snapshots. Their synthetic clearance fixtures are isolated test-only database entries; they are not real institutional approval and were not used to present a completed positive study.

Browser tests run the actual copied Next.js application, BFF, form and navigation against an **explicitly synthetic HTTP API double**, not the FastAPI backend. They verify draft creation/binding, configuration/history, exact uncertain-save retry, blocked activation/publication/export, null monitoring, readonly privileges and session clearing. Therefore browser+FastAPI evidence is complementary, not a claimed single real admin-provider/native end-to-end session.

**Unproven/unavailable:** genuine voluntary participant flow, guardian verification, positive allocation, answer/score integrity of managed submissions, timer/clock-manipulation/expiry/resume/background recovery, independent delayed interval, weekday/weekend/DST scheduling, missed/late review treatment, review offline/reconnection, equal-content executed treatment, positive questionnaire duplicates/withdrawal, positive aggregates/CSV formula encoding. Those implementations or approved policies do not exist. Generic UI retry tests prove only configuration-request recovery, not participant offline recovery. No time gates were bypassed to simulate these capabilities.

## Commands and actual results

Commands are from the repository root unless a working directory is specified. No test is called passing merely because its source exists.

| Check | Result |
| --- | --- |
| Full non-PostgreSQL pytest selection, `services/api` | **728 passed, 1 failed, 199 deselected**, 39.77 s; two existing dependency deprecations. Failure is the recorded old personal-profile column assertion below. |
| Selected disposable PostgreSQL integration, ten files below | **55 passed**, 94.83 s, zero failed/skipped; two dependency warnings. Fresh source-head migrations run through real PostgreSQL fixtures; includes owned empty 0017 downgrade/upgrade and occupied downgrade refusal. |
| Expanded new final-verification integration file, after adding independent ID/affirmation checks | **4 passed**, 8.35 s; two dependency warnings. This repeats four of the 55 tests, not four additional unique cases. |
| New pure guard file | **5 passed**, 1.21 s; also included in the broad unit selection. |
| Node regression plus research setup, thirteen files below | **100 total: 98 passed, 2 existing failures**, 6.59 s. Existing module-type warnings retained. Research setup's 16 tests pass; personal practice/live pronunciation/reviews' 24 tests pass. |
| Actual isolated Next.js/Chrome research browser suite | **6 passed**, 25.32 s, zero page errors; 1440px and 390px screenshots reviewed, narrow viewport no horizontal overflow. |
| Admin `npm run typecheck`, `npm run lint`, `npm run build` | All final commands exit 0; Next.js 16.4.2 production build completes. No deployment. |
| Mobile `npm run typecheck`, `npm run lint` | Exit 0; lint retains **29 warnings, zero errors**. |
| Expo export for Android/iOS/web | Exit 0; all three JS bundles/assets exported to generated temporary directory. This is not native compilation or device execution. |
| Targeted Ruff check and format | New guard/tests, research foundation/draft/reporting modules and shared reviews router pass lint; the three new Python files pass format check. Legacy router/service lint remains separately noted below. |
| Source metadata/migration/runtime inspection | `alembic heads`: **0017_research_classrooms**; registry import: **70 tables**; runtime ESR identity remains simulated. Read-only OpenAPI inspection confirms routes below, without a DB connection. |

Backend commands, working directory `services/api`:

```powershell
.venv/Scripts/python.exe -m pytest -m 'not postgresql' -q --tb=short --maxfail=20
.venv/Scripts/python.exe -m pytest tests/test_research_execution_guard.py -q --tb=short
.venv/Scripts/python.exe -m alembic heads
.venv/Scripts/python.exe -m ruff check app/modules/research/execution_guard.py app/modules/research/classroom_router.py app/modules/research/classroom_schemas.py app/modules/research/classroom_service.py app/modules/research/assessment_draft_service.py app/modules/research/reporting_schemas.py app/modules/research/reporting_service.py app/modules/spaced_repetition/router.py tests/test_research_execution_guard.py tests/integration/test_research_final_verification_postgresql.py
.venv/Scripts/python.exe -m ruff format --check app/modules/research/execution_guard.py tests/test_research_execution_guard.py tests/integration/test_research_final_verification_postgresql.py
```

Exact disposable integration launcher (same command rerun with only the final-verification file for the expanded checks):

```powershell
@'
import os,pytest
from dotenv import dotenv_values
from sqlalchemy.engine import make_url
url=make_url(dotenv_values('.env')['FLUENTT_DATABASE_URL'])
assert url.host in ('localhost','127.0.0.1') and url.port==55432
os.environ['FLUENTT_TEST_DATABASE_URL']=url.set(database='postgres').render_as_string(hide_password=False)
raise SystemExit(pytest.main(['tests/integration/test_research_final_verification_postgresql.py','tests/integration/test_research_reporting_postgresql.py','tests/integration/test_research_setup_postgresql.py','tests/integration/test_research_classrooms_postgresql.py','tests/integration/test_research_assessment_drafts_postgresql.py','tests/integration/test_classrooms_postgresql.py','tests/integration/test_enrollment_postgresql.py','tests/integration/test_response_capture_postgresql.py','tests/integration/test_progress_postgresql.py','tests/integration/test_personal_practice_postgresql.py','-q','--tb=short']))
'@ | .venv/Scripts/python.exe -
```

The URL is held in memory, never printed. The maintenance connection creates/drops only fixture-generated `fluentt_test_<UUID>` databases. `tests/integration/conftest.py` uses the fresh-empty naming adapter, real PostgreSQL, and finally cleanup; no SQLite substitution, unknown DB reset/stamp or application migration. Database fixtures are synthetic. This selected suite does not claim all 199 PostgreSQL-marked tests were executed.

Client commands:

```powershell
node --test scripts/research.test.mjs scripts/reviews.test.mjs scripts/classes.test.mjs scripts/enrollment.test.mjs scripts/assignments.test.mjs scripts/capture.test.mjs scripts/results.test.mjs scripts/progress.test.mjs scripts/onboarding.test.mjs scripts/dashboard-components.test.cjs scripts/personal-practice.test.cjs scripts/live-pronunciation.test.cjs scripts/research-setup.test.cjs
$env:FLUENTT_PLAYWRIGHT_MODULE='C:/Users/Shan Gealone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:FLUENTT_RESEARCH_QA_OUTPUT='output/research-final-qa'
$env:FLUENTT_RESEARCH_QA_PREFIX='prompt08'
node scripts/research-admin-web.test.cjs
```

Run `npm run typecheck`, `npm run lint` in both `apps/admin` and `apps/mobile`, and `npm run build` in `apps/admin`. Actual Expo command, from `apps/mobile`:

```powershell
$env:CI='1'; $env:EXPO_NO_TELEMETRY='1'; $env:EXPO_OFFLINE='1'
$taskExpoOutput=Join-Path $env:TEMP ('fluentt-38b08-expo-' + [guid]::NewGuid())
node node_modules/expo/bin/cli export --platform all --no-bytecode --max-workers 2 --output-dir $taskExpoOutput
```

Result directory ended in `fluentt-38b08-expo-64b2d359-b6ee-464b-ac8d-70c21a4704ff`. ADB, emulator and Java commands and native Android/iOS source directories were unavailable; no native binary/device/microphone/model/provider check is claimed. Expo installed CLI help and official SDK documentation were inspected before export.

Execution limitation corrected: initially starting admin build and browser verification concurrently caused EBUSY/ENOENT because the build cleans `.next`, which contains the synthetic source-copy test workspace. Both failed invocations are not passes. After stopping, sequential build and browser reruns passed as recorded. Existing servers were not stopped. No source workaround or deployment was needed. Offline inspection snippets were corrected to import Base from `app.db.base` and unwrap the CORS middleware before accessing OpenAPI; those earlier inspection errors were not product/test failures.

### Preserved baseline failures and lint limits

- `tests/test_schema.py::test_learning_focus_is_additive_and_retains_grade_history`: old exact column list omits existing `learning_experience` (line 73). The separately authorized prior metadata-count update remains retained; this personal assertion was not changed.
- `scripts/enrollment.test.mjs:101`: fixture expects `/learning-focus`, current personal onboarding returns `/language`.
- `scripts/progress.test.mjs:49`: old personal fixture lacks experience while expecting `learning-history` access.

All three were recorded before Section 38B. The full unit and expanded client runs reproduce them; research guards did not introduce them. Targeted checks are green, but the repository-wide verification is **not all green**. Do not change personal behavior/assertions in this scope to report a clean suite.

Legacy research `router.py` retains the same two Ruff findings as HEAD: unused `Header`, undefined `select` in the old unmarked allocation handler. `service.py` retains 43 findings (41 F401, one F811, one F841). No global lint-clean claim is made; the managed guard returns before the old allocation defect. Unmarked legacy research is not certified for human execution. Existing Starlette/Authlib dependency warnings and mobile lint findings are retained.

## Personal / ordinary-class integrity evidence

Entry snapshot contained **589 tracked/unignored files**, including prior dirty work and output artifacts. SHA-256 comparison records only the Prompt 08 files listed below as changed/added; earlier source and evidence files remain retained. Among **227 entry files** under all `apps/mobile`, models, migrations, shared scheduler and ordinary classroom/enrollment/assignments/grading/progress/monitoring/communications boundaries, **226 remain byte-identical**. The one exception is the documented default-off shared reviews router. No mobile file, manifest, algorithm/service/state/history model or frozen migration changed in this prompt.

For comparison with Prompt 01, the original 146-file digest reconstructs exactly after substituting the entry reviews-router hash and removing only the prior additive model-registry import: `dc91ff34290d846acde675ee0c737f9e3070c19a1a5086ef98fc52e57e9119bc`. This is a reconstruction of the old baseline, **not** a claim that today's router matches it. Git HEAD content comparison across 162 tracked protected files (including 0001-0016 migrations), normalizing line endings, finds only that router and the prior additive model-registry import as exceptions. Additive 0017 and all earlier uncommitted research files are preserved from entry.

Actual regression evidence includes normal class creation/enrollment/capture/progress, personal-practice PostgreSQL access, the same user's personal versus ordinary due contracts, default-off no-query tests and reporting snapshots of learner profiles/contexts/progress/review states/events. Production records/history were not inspected; byte equality and selected synthetic regressions cannot prove every runtime path, existing DB integrity or live deployment. The three known baseline discrepancies remain limitations.

## Actual route inventory and version context

| Surface | Route / scope |
| --- | --- |
| Admin UI | `/research`, existing Research Management navigation; Overview, Classroom setup, Monitoring, Revision history. No duplicate admin page. |
| Admin fixed same-origin BFF | `/api/admin/research/classrooms/studies`; `/{scope_id}`; `/{scope_id}/protocols`, `/classrooms`, `/state`, `/choices`, `/exports` with fixed method/query allowlists and live browser permissions. |
| Backend configuration | `/api/v1/admin/research-classrooms/studies` GET/POST; `/{scope_id}` GET; `/{scope_id}/protocols` GET/POST; `/{scope_id}/classrooms` GET/POST; `/{scope_id}/state` POST; `/choices` GET (`classrooms`, `conditions`, `instruments`); `/exports` GET (`participants`, `assessments`, `reviews`, `questionnaires`), disclosure always blocked. |
| Student class metadata | GET `/api/v1/me/research-classrooms/classes/{class_id}`; live school membership/owner checks, normal vs designated mode, execution/participation false. This is an API, not a newly installed mobile route. |
| Existing Expo class routes | `/student`, `/class-details`, `/published-assignments`, `/assignment-attempt`, `/assessment-results`, `/learning-history`; instructor routes `/instructor`, `/instructor-monitoring`. Source unchanged. |
| Existing legacy research | Expo `/research`, `ResearchParticipationView.tsx`; backend `/api/v1/me/research`. No classroom-specific approved participant UI. Managed detail/consent/eligibility/enrollment/allocation now denied; managed assessment runner already denied. Historical withdrawal code remains. |
| Shared reviews | GET `/api/v1/me/reviews/due`, POST `/api/v1/me/reviews/events`; managed research now denied, non-research delegates unchanged. |

Scope UUID, underlying study UUID, classroom binding, private coded participant/enrollment, immutable protocol ID/version, condition/scheduler configuration and event request identity are distinct. Class/user identifiers do not enter research learning contexts; private mappings resolve them only behind authorization. A protocol label, proposed participant count, model DB flag or UI checkbox is not clearance or a measured metric version.

## Models, privacy, dictionary and scientific limits

Independent runtime inspection reports `fifakt-esr-v1`, model `fifakt-simulated-v1`, `simulated=true`, base algorithm `fsrs6`. No real trained FIFAKT artifact, integrated approved ESR treatment or measured prediction is verified. Read-only synthetic SM-2 probes reproduce 33 days for interval 14/EF 2.36/good and 14 days for interval 6/EF 2.50/hard. Installed half-up rounding/updated-EF multiplication differ from the numbered original [SM-2 reference](https://super-memory.com/english/ol/sm2.htm), which specifies upward rounding and interval calculation before ease modification. Shared algorithms remain untouched; approve a versioned research control instead of silently changing personal schedules.

`RESEARCH_EXPORT_DATA_DICTIONARY.md` matches the actual null-only `research-reporting-readiness-v1` response: unavailable value/n/denominator/window/instrument/algorithm/metric versions, questionnaire UNPUBLISHED, export BLOCKED. Parent configuration provenance is genuine; planned dates are not observation windows. No valid denominator is inferred from target 30, class membership or test fixtures. No approved comparable scores exist to calculate gains/retention; no inferential plan, significance, superiority or human outcomes were generated.

Managed overview never queries personal/ordinary progress, responses or raw audio for metrics; export and legacy disclosure/identity attempts refuse managed data even with synthetic planted observations. No identifying or raw voice dataset is released. Formula/quote/newline payload refusal tests show **no disclosure**, not a finished safe CSV serializer. Small-cell suppression, retention, withdrawal erasure/continued use and access/audit procedures need approval before positive reporting/export. PUBLIC revocation alone does not constrain a DB schema owner; independently verified non-owner runtime grants and operator-only clearance insertion remain deployment prerequisites, not provisioned facts.

Accessibility review covers native form labels/legends, accessible button/region names, keyboard focus/Tab movement, disabled publication/activation/export, visible text statuses rather than color-only results, and manually inspected desktop/narrow screenshots. No horizontal overflow at 390px; no browser page errors. This is a limited review, not WCAG certification, screen-reader/contrast/zoom coverage or native assistive-technology validation.

## Every file changed by Prompt 08

Existing files extended/revised, preserving prior uncommitted content where applicable:

- `services/api/app/modules/research/router.py`
- `services/api/app/modules/research/service.py`
- `services/api/app/modules/spaced_repetition/router.py` - sole shared behavior-dispatch exception, default-off outside research.
- `scripts/research-admin-web.test.cjs` - optional separate evidence destination.
- `PROJECT_HANDOFF.md` - replaces inaccurate current branch/head/count/readiness claims with verified state.
- `docs/SECTION_38B_PROGRESS.md`
- `docs/DECISIONS.md`

New files:

- `services/api/app/modules/research/execution_guard.py`
- `services/api/tests/test_research_execution_guard.py`
- `services/api/tests/integration/test_research_final_verification_postgresql.py`
- `docs/SECTION_38B_FINAL_REPORT.md`
- `output/research-final-qa/prompt08-monitoring-desktop.png`
- `output/research-final-qa/prompt08-monitoring-narrow.png`

No dependency, schema/table/migration, admin product UI, mobile/Personal Learning file, pure algorithm or ordinary classroom module change. Prior reports/dictionary and output folders remain unchanged. Final entry-to-exit inventory: 595 tracked/unignored files, seven existing files changed and six files added as listed; no entry file removed, 582 entry files byte-identical. `git diff --check` passes (only Git line-ending notices).

## Outstanding authorization and acceptance before collection

1. Supply independently approved Chapter 3/protocol and actual applicable institutional/site/ethics requirements/evidence. Define responsible investigators and approved dates; proposed three weeks/Mon-Fri/30 participants are not permission.
2. Approve study information, data-use/privacy and voluntary consent/decline/withdrawal materials; determine age/minor policy and any guardian permission plus assent/verifier requirements. Implement and verify Prompt 04's managed participant boundary and private roster without auto-enrollment.
3. Approve allocation method/unit/concealment, reproducibility, quota balance, fewer participants, withdrawals/replacements and locked condition changes. A 15:15 target cannot decide these rules.
4. Approve common content, blueprint/instruments/versions/licensing/difficulty/scoring/feedback and test comparability. Approve server timers, attempts, timeout/late/missed/auto-submit/network recovery and independently anchored delayed follow-up interval; implement and test the actual runner.
5. Supply approved ESR/model artifact/definition/reference vectors and research SM-2 control version. Approve common availability, timezone/weekend/holiday/raw-vs-adjusted due-date, missed-review and measurement rules; implement isolated treatment/history and actual reference/time/replay tests.
6. Approve questionnaire instrument/scales/version/administration, duplicates/partial/missing/withdrawal rules, statistical/comparability plan and retention/disclosure/small-cell/export-access policies. Implement positive eligible collection/projections/export serialization with real provenance and synthetic acceptance tests before any human data.
7. Verify independent clearance process, least-privilege runtime/grants, real admin OIDC/MFA/TLS, target device/session/offline/timing checks and any genuine model/provider validation. Resolve baseline discrepancies separately if a globally clean release is required.

**STOP after verification.** These are unresolved prerequisites, not approvals or an instruction to collect data. No research completion or statistical superiority is claimed.
