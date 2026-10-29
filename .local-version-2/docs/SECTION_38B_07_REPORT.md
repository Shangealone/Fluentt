# Section 38B Prompt 07 - Questionnaire/reporting availability and disclosure safeguards

Date: 2026-10-21, Asia/Manila. Checkout `C:/Users/Shan Gealone/Desktop/Backup/Fluentt`, branch `codex/personal-learning-voice-updates`, baseline HEAD `6e2d7167e7f36e79172852d73c267a5dc84e13e5`.

## Outcome and limits

Implemented safe administrator Monitoring/readiness and managed-study disclosure guards. **Questionnaires remain UNPUBLISHED; live questionnaire collection, observation aggregation and thesis CSV exports remain BLOCKED.** This is not completion of an approved questionnaire/statistical workflow or release of real research findings.

Reports 01-03/05/06, progress/decisions, existing Section 38/research documentation and actual research/auth/admin/BFF/analytics/export models/services/tests were inspected. `SECTION_38B_04_REPORT.md` is absent; Prompt 04 has clarification only, not a completed consent/withdrawal/allocation boundary. Prompt 05 implements draft assessment planning only. Prompt 06 blocks real treatment because ESR is simulated and methodology unresolved. There is therefore no verified eligible collection pipeline from Prompts 02-06 to aggregate or export. Existing stored rows, historical reports or an approved-looking database label do not establish eligibility.

No exact approved questionnaire/questions/scales/licensing/statistical plan, consent/minor materials, small-cell disclosure policy or permitted withdrawal/retention policy was supplied or found. The user-confirmed planned 30 students / 15 per condition is a target, not an observed sample size or denominator. No ISO/IEC 25010 questions, research permissions, participants, validated scores, significance or scientific outcomes were invented. No actual application/production data was queried or modified.

## Implemented contracts and current administrator UI

- `services/api/app/modules/research/reporting_schemas.py` defines `research-reporting-readiness-v1`. `StudyOverview.reporting` is generated as a safe default for current configuration reads and older retained receipts. It contains UNPUBLISHED questionnaire status, no collection, null questionnaire instrument/response count, false observed-results/inferential availability, blocked exports, prerequisite reasons and 18 unavailable reporting areas.
- Every area's value, sample size, denominator, observation window and instrument/algorithm/metric version are **null**. The null-only schema rejects invented numbers. No participant/assessment/review/identity/personal observation query is needed. Source values are not aggregated and then hidden: they are never read by readiness.
- `apps/admin/src/components/research-reporting-panel.tsx` extends the **current Research Management page** with a Monitoring tab. It displays N/A and explicit sample-size/denominator/window/version unavailability, genuine parent protocol/configuration provenance and configured dates clearly labeled as proposals. No fabricated chart/count, prediction, score, recall accuracy, gain or effect is displayed. The export control is disabled, and no questionnaire response form is rendered.
- Reporting areas include participant flow, assignment/review adherence, pre/immediate/delayed completion, assessment results, recall accuracy, review count/workload, active/observed study duration, pronunciation, questionnaire responses/distributions, missing data, learning gain and retention. These are availability labels, not implemented numerical calculations.
- Existing administrator User/browser-session checks, exact manager ownership, read permission, no-store, visibility/session generation cleanup and data clearing remain authoritative. The new panel derives entirely from the protected study state; it adds no storage, automatic legacy analytics request or independent participant cache.
- No new questionnaire instrument, scale, publication/capture/submission/duplicate/withdrawal workflow, response table or migration is added while the approved instrument and participant policies are absent. Existing questionnaire-window proposals remain inert. No mobile/Personal Learning file or navigation change.

Full implemented JSON fields, null meanings, metric keys and future dataset limits are in [RESEARCH_EXPORT_DATA_DICTIONARY.md](RESEARCH_EXPORT_DATA_DICTIONARY.md). This local dictionary describes the actual availability contract; it is not the older legacy codebook or an approved statistical plan.

## Export and legacy-path authorization

New fixed endpoint:

```text
GET /api/v1/admin/research-classrooms/studies/{scope_id}/exports?dataset=participants|assessments|reviews|questionnaires
```

`reporting_service.blocked_export` uses the existing real `administration.service.resolve_session` transaction. It requires live explicit `research.read` plus the new separately granted `research.export`, validates exact manager ownership, then returns 409 `research_export_blocked`. No runtime/default grants are added. Unauthorized requests return 401/403/404 as appropriate. Unsupported dataset names are rejected by the typed route. No CSV/attachment, pseudonym or raw observation is returned, even to a permitted manager.

The existing fixed BFF is extended only for this GET contract. It rejects unsupported/duplicate/raw-voice queries, rechecks live permissions, accepts only bounded JSON from the backend and returns no-store. A mistaken upstream CSV/formula response fails closed with 503 rather than becoming a file. No export button calls the endpoint while unavailable.

Marker-specific guards protect `research-classrooms-v1` roots from the old reporting paths:

- Legacy analytics, participant/group/results lists, CSV exports and codebook HTTP paths first use a real live research-read authorization callback. For managed roots, exact manager ownership is checked; export/codebook requests additionally need explicit export permission; then disclosure is refused before legacy computations or serializers run.
- Pure legacy participant-flow/assessment/engagement calculations and all three legacy CSV entry points also refuse managed roots before observation queries. Existing unmarked calculation/export behavior remains delegated to the original code and covered by its existing synthetic unit suites. This is not certification or repair of unrelated legacy runtime auth/analytics behavior.
- The legacy study list skips managed roots before participant-count projection, preserving the separate owner-scoped readiness namespace. Managed identity revelation is refused inside its existing live manage/CSRF transaction before private identity-link/user lookup. All these checks are opt-in to the exact managed root marker; ordinary classroom endpoints are untouched.
- A historical N<5 warning, latest-group join, rating-based accuracy, fixed pronunciation result, hardcoded maximum or consent-row presence is not used as an approved disclosure/analysis policy. No gain, retention or inferential result is computed in the new managed workflow.

CSV safety here is **blocked disclosure**, not a newly claimed CSV encoder. No positive raw dataset export was implemented. The dictionary identifies the required future pseudonymous/event-time versioned allowlist, null/missing semantics, proper CSV quoting/formula tests and exclusions, all pending approved collection and disclosure rules. Raw voice, personal data, private keys and ordinary classroom/personal events never enter readiness or new exports.

## Requirement disposition

| Prompt requirement | Actual result |
| --- | --- |
| 1. Versioned approved questionnaire collection | **BLOCKED**: no approved final instrument, participant authorization or withdrawal procedure; no invented question/scale or submission workflow. |
| 2. Research-only questionnaire/status/count | Safe status implemented in the manager-owned managed-research view: UNPUBLISHED, collection false, instrument/count null. No student collection access, publication route or assumed count. |
| 3-4. Genuine monitoring with denominators/provenance | Availability view implemented. All observation values/n/denominators/windows/metric versions N/A; actual parent configuration provenance retained. No real aggregate or denominator computation claimed. |
| 5. Gains/retention/inference | **BLOCKED** on approved comparable scales/statistical plan and genuine outcomes. No significance, effect or normalized gain fabricated. |
| 6. Thesis exports/dictionary/formula safety | Dictionary and explicit permission/ownership/blocked-export gate implemented. Actual pseudonymous raw CSV release/encoder **BLOCKED**, not an empty fabricated dataset. |
| 7-8. Consent/context/privacy/withdrawal isolation | No observation collection or disclosure authorized; forbidden observation queries are tested. Legacy managed reporting/identity bypasses are refused. No guessed small-cell/retain-all policy. Positive eligible-row filtering remains dependent on approved workflow. |
| 9. QA | Real tests verify unavailable values, denied disclosures, RBAC/ownership, no protected-row reads, no new questionnaire routes, state isolation and unchanged ordinary/client flows. Positive questionnaire capture, eligible aggregates, denominators and released CSV tests remain blocked until those features have approved contracts. |

## Verification actually run

| Check | Result |
| --- | --- |
| Combined Python unit + generated disposable PostgreSQL | **140 passed**, 0 failed/skipped, 2 existing dependency deprecation warnings, 91.92 s. |
| New reporting tests included above | **14 pure + 5 PostgreSQL**. Pure checks enforce null-only contracts and deny managed legacy aggregates/exports before data queries. PostgreSQL tests plant explicitly synthetic unapproved pending records/identity/attempts, reject private observation SELECTs during readiness, verify no-store/permissions/manager ownership/legacy guards, no CSV/identity disclosure and unchanged learning-table snapshots. No human permission or outcome fixture is claimed. |
| Other backend coverage included above | Existing legacy research participant/experiment/analytics and Section 38B configuration/assessment drafts plus real ordinary classroom/enrollment/all-ten response capture/progress regressions. |
| Administrator contract/native-form/BFF | **16 passed**, including 3 new reporting/null/blocked-export/formula-payload checks. |
| Personal practice/live pronunciation/reviews client | **24 passed**, 0 failed/skipped; one existing Node module-type warning. |
| Real isolated Next.js/headless Chrome | **6 passed**, 28.24 s. New Monitoring workflow verifies UNPUBLISHED/N/A/disabled export, no legacy analytics/CSV/questionnaire requests and no horizontal overflow at 390px; existing save/retry/history/access-revocation workflows pass. |
| Administrator typecheck/lint/production build | Passed. Initial sandbox build failed on EPERM creating a generated prerender directory; the authorized host retry passed. No source permission workaround or deployment. |
| Ruff on new/extended draft/reporting modules/tests | Passed; four new reporting files also pass formatting. Legacy analytics has 0 findings; legacy router retains 2, service retains 43 (same diagnostics apart from shifted line references). Unrelated cleanup not performed. |
| Source integrity | Entry inventory: 560 tracked/unignored non-output files. All **218 protected files** checked across mobile/Personal Learning, shared scheduler, models, migrations, normal classroom/enrollment/assignments/grading/progress remain byte-identical. Exact changed-file list below; prior unrelated edits/outputs retained. |

PostgreSQL uses only the existing fixture's generated `fluentt_test_<UUID>` databases. The configured local URL was read privately, checked for localhost/127.0.0.1:55432, changed to maintenance `postgres` before connection and passed in-process. No connection to the named application database, credentials in logs, real participants/consent, application migration or production data operation.

The browser test copies actual source/config to a generated `.next/research-test-<UUID>` workspace, excludes application environment files, uses a synthetic HTTP backend and temporary headless browser, then removes only its verified workspace after unlinking the dependency junction. Existing developer server and previous screenshot artifacts remain intact. Visual QA inspected:

- `output/research-reporting/prompt07-monitoring-desktop.png`
- `output/research-reporting/prompt07-monitoring-narrow.png` (390px admin website viewport; not Expo/native execution).

No new mobile source, native device, actual approved questionnaire, real observation aggregation, inference or downloadable thesis CSV was tested. Earlier baseline discrepancies from reports 01-03 remain preserved; complete broad baseline suites and unrelated mobile lint/build were not rerun for this slice.

### Exact test commands

From `services/api`, using the private disposable-maintenance environment described above:

```powershell
.venv/Scripts/python.exe -m pytest -q -x tests/test_research_reporting.py tests/test_research_analytics.py tests/test_research_participants.py tests/test_controlled_experiment.py tests/test_research_classrooms.py tests/test_research_setup.py tests/test_research_assessment_drafts.py tests/integration/test_research_reporting_postgresql.py tests/integration/test_research_setup_postgresql.py tests/integration/test_research_classrooms_postgresql.py tests/integration/test_research_assessment_drafts_postgresql.py tests/integration/test_classrooms_postgresql.py tests/integration/test_enrollment_postgresql.py tests/integration/test_response_capture_postgresql.py tests/integration/test_progress_postgresql.py --tb=short
```

From repository root:

```powershell
node --test scripts/research-setup.test.cjs
node --test scripts/reviews.test.mjs scripts/personal-practice.test.cjs scripts/live-pronunciation.test.cjs
$env:FLUENTT_PLAYWRIGHT_MODULE='C:/Users/Shan Gealone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node --test scripts/research-admin-web.test.cjs
```

Administrator checks from `apps/admin`: `npm run typecheck`, `npm run lint`, `npm run build`. No tests were reported passing merely because they were written, and no approval review rejected an action.

## Every changed file in this slice

Extended prior implementation files, preserving their earlier uncommitted work:

- `services/api/app/modules/research/classroom_schemas.py`
- `services/api/app/modules/research/classroom_router.py`
- `services/api/app/modules/research/analytics_service.py`
- `services/api/app/modules/research/router.py`
- `services/api/app/modules/research/service.py`
- `apps/admin/src/components/research-manager.tsx`
- `apps/admin/src/services/research-classroom-contract.ts`
- `apps/admin/src/services/research-routing.ts`
- `apps/admin/src/services/research-proxy.ts`
- `scripts/research-setup.test.cjs`
- `scripts/research-admin-web.test.cjs`
- `docs/DECISIONS.md`
- `docs/SECTION_38B_PROGRESS.md`

New files:

- `services/api/app/modules/research/reporting_schemas.py`
- `services/api/app/modules/research/reporting_service.py`
- `services/api/tests/test_research_reporting.py`
- `services/api/tests/integration/test_research_reporting_postgresql.py`
- `apps/admin/src/services/research-reporting-contract.ts`
- `apps/admin/src/components/research-reporting-panel.tsx`
- `docs/SECTION_38B_07_REPORT.md`
- `docs/RESEARCH_EXPORT_DATA_DICTIONARY.md`
- The two screenshots listed above.

No package/dependency, model/table/migration, Personal Learning/mobile/navigation, ordinary classroom, assignment/capture/grading/progress or shared algorithm change. Source head remains 0017, 70 domain tables. No commit, push or deployment.

## Remaining blockers and stop

Supply the final approved questionnaire/items/scales/version/license and administration/scoring/missing-response rules; approved Chapter 3 statistical/comparability plan; applicable study-information/consent/minor permissions; allowed post-withdrawal usage/retention, small-cell suppression and export access/audit/disclosure rules. Complete the approved participant boundary and genuine assessment/treatment collection first. Registry simulation and planned 15/15 allocation do not satisfy these requirements.

Only then implement versioned publication and withdrawal-aware, idempotent eligible questionnaire capture; positive scoped observation projections/denominators; permitted descriptive/comparable paired measures; and a reviewed pseudonymous raw export serializer with formula/quoting protections and positive/negative fixtures. No data should be inferred from the current null availability fields. **STOP after Prompt 07's safe readiness/disclosure implementation; collection, analysis and thesis data release remain BLOCKED.**
