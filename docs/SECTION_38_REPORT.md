# FLUENTT — SECTION 38 REPORT: RESEARCH ANALYTICS AND EXPORTS

**Date**: 2026-10-20  
**Role**: Senior Research Data Engineer, Educational Statistics Engineer, FastAPI/PostgreSQL Architect, Data Privacy Engineer, Next.js Engineer, and QA Engineer  
**Status**: ACCEPTED & COMPLETED (Ready for Review)

---

## 1. Executive Summary & Objective

Section 38 successfully implemented traceable, privacy-guarded research analytics, reproducible descriptive reporting, and de-identified export pipelines based on actual experimental records.

In strict compliance with the approved Chapter 3 statistical analysis plan and institutional research ethics requirements:
- **Descriptive Statistics Only**: The system calculates purely descriptive measures ($N$, Mean, Median, Sample Standard Deviation, Min, Max, and Mean Percentage). Absolutely no inferential hypotheses, $p$-values, confidence intervals, effect sizes (e.g., Cohen's $d$), or speculative causal claims are fabricated.
- **Small-Cell Privacy Protection**: Aggregates or subgroups with $N < 5$ are explicitly flagged (`is_small_cell = true`) and marked with privacy warning badges in dashboards to prevent deductive re-identification.
- **Spreadsheet Formula Injection Defense (CWE-1236)**: Every cell exported to spreadsheet-compatible CSV is sanitized against formula injection (prepended with `'` if starting with `=`, `+`, `-`, `@`, `\t`, `\r`, or `%`, while preserving valid signed numeric literals).
- **Strict Pseudonymization**: Exports exclusively expose randomized pseudonymous codes (`P-TAG-XXXXXX`). Student usernames, full names, emails, raw audio, and identity mapping keys are completely excluded.
- **Audited Researcher Access**: Privileged research routes enforce live `research.read` verification and record immutable `AuditLog` entries (`research.dataset_exported`).

---

## 2. Requirement Gate Checklist

| Requirement | Status | Verification & Evidence |
| :--- | :---: | :--- |
| **Traceable Primary Records** | **PASSED** | Aggregates derived on-demand from primary immutable tables (`research_participants`, `research_group_assignments`, `research_assessment_results`, `vocabulary_review_events`). |
| **CONSORT Participant Flow** | **PASSED** | Computes target, enrolled, allocated (control vs experimental), active in progress, completed post-test, and breakdown of withdrawals by reason. |
| **Instrument Descriptive Metrics** | **PASSED** | Condition-separated outcomes for pre-test, level milestone tests, post-test, delayed retention, and pronunciation assessments. |
| **Paired Within-Subject Learning Gains** | **PASSED** | Paired difference metrics: Absolute gain ($\text{Post} - \text{Pre}$), Hake's normalized gain ($g$), and delayed retention loss ($\text{Post} - \text{Retention}$). |
| **Spaced Repetition Review Telemetry** | **PASSED** | Review event volume, active learners, mean reviews per learner, retention recall accuracy %, mean response duration (ms), and memory lapses. |
| **Small-Cell Privacy Safeguards** | **PASSED** | Flagged when $N < 5$; warning badges rendered in the Next.js researcher dashboard. |
| **Spreadsheet Formula Injection Sanitization** | **PASSED** | All CSV exports sanitized against CWE-1236 formula triggers (`=, +, -, @, \t, \r, %`). Valid signed numbers are preserved. |
| **Data Dictionary & Variable Codebook** | **PASSED** | Comprehensive JSON schema containing variable names, data types, definitions, measurement windows, and missing-data codes (`NA`, `WITHDRAWN`, `EXCLUDED`). |
| **Zero Fabricated Claims** | **PASSED** | Zero unverified $p$-values, effect sizes, or confidence intervals. Explicit scientific integrity notice displayed. |
| **Next.js Researcher Dashboard** | **PASSED** | Modern administrative dashboard with study selector, CONSORT flow cards, comparative outcome tables, paired gain cards, and export center. |
| **Automated Test Coverage** | **PASSED** | 11 comprehensive automated tests authored in `test_research_analytics.py`, plus 98 backend regression tests passing (100%). |
| **Database Schema Preservation** | **PASSED** | Database remains at head `0013_learning_focus` with 63 tables. Zero migration alteration. |

---

## 3. Mathematical Formulas and Statistical Definitions

### 3.1 Sample Statistics
For an observed score sample $X = \{x_1, x_2, \dots, x_n\}$:
1. **Sample Mean**:
   $$\bar{x} = \frac{1}{n} \sum_{i=1}^n x_i$$
2. **Sample Standard Deviation** (unbiased estimator with Bessel's correction, $n > 1$):
   $$s = \sqrt{\frac{1}{n - 1} \sum_{i=1}^n (x_i - \bar{x})^2}$$
   *(For $n \le 1$, $s$ is explicitly `null`)*.
3. **Median**:
   The middle value of the sorted sample (or arithmetic mean of the two central values when $n$ is even).
4. **Mean Percentage**:
   $$\text{Mean \%} = \frac{\bar{x}}{\text{Maximum Possible}} \times 100\%$$

### 3.2 Within-Subject Paired Comparisons
For participant $p$ who completed both assessments:
1. **Absolute Learning Gain**:
   $$\Delta_{\text{abs}} = \text{Score}_{\text{post\_test}} - \text{Score}_{\text{pre\_test}}$$
2. **Hake's Normalized Learning Gain ($g$)**:
   $$g = \frac{\text{Score}_{\text{post\_test}} - \text{Score}_{\text{pre\_test}}}{\text{Maximum Possible} - \text{Score}_{\text{pre\_test}}}$$
   *(If baseline score is equal to maximum possible, $g = 0.0$)*.
3. **Delayed Retention Loss (Decay)**:
   $$\Delta_{\text{decay}} = \text{Score}_{\text{post\_test}} - \text{Score}_{\text{delayed\_retention}}$$

### 3.3 CONSORT Flow Rates
1. **Completion Rate**:
   $$\text{Rate}_{\text{completion}} = \frac{N_{\text{completed\_post\_test}}}{N_{\text{total\_enrolled}}} \times 100\%$$
2. **Dropout Rate**:
   $$\text{Rate}_{\text{dropout}} = \frac{N_{\text{total\_withdrawn}}}{N_{\text{total\_enrolled}}} \times 100\%$$

---

## 4. Export Datasets & Data Dictionary

### 4.1 Export Datasets Overview
All CSV endpoints require `research.read` permission and trigger `AuditLog` events:

1. **Longitudinal Participant Dataset** (`participants.csv`):
   - **Grain**: 1 row per enrolled participant.
   - **Columns**: `participant_code`, `study_code`, `condition`, `enrollment_status`, `enrolled_at`, `withdrawn_at`, `withdrawal_reason`, `pre_test_score`, `level_tests_completed`, `post_test_score`, `delayed_retention_score`, `pronunciation_score`, `absolute_learning_gain`, `normalized_learning_gain`, `retention_loss`.
2. **Assessment Attempts Dataset** (`assessments.csv`):
   - **Grain**: 1 row per completed assessment submission.
   - **Columns**: `result_id`, `participant_code`, `study_code`, `condition`, `assessment_kind`, `assessment_title`, `instrument_version`, `attempt_number`, `status`, `score`, `maximum_score`, `percentage`, `response_duration_ms`, `completed_at`.
3. **Spaced Repetition Review Events Dataset** (`reviews.csv`):
   - **Grain**: 1 row per vocabulary review transaction.
   - **Columns**: `event_id`, `participant_code`, `study_code`, `condition`, `vocabulary_term`, `vocabulary_language`, `recall_rating`, `is_correct`, `response_duration_ms`, `previous_interval_days`, `resulting_interval_days`, `reviewed_at`.

### 4.2 Research Data Dictionary
Accessible via `/admin/research/studies/{study_id}/exports/data-dictionary`:
- **Missing Data Codes**:
  - `NA`: Not applicable (e.g. participant withdrawn before assessment window, or control condition for experimental-only metrics).
  - `WITHDRAWN`: Participant withdrew consent prior to study completion.
  - `EXCLUDED`: Participant excluded per protocol eligibility criteria.
- **Privacy Rules**:
  - Stable pseudonymization unlinked from authentication accounts.
  - Formula injection defense (CWE-1236) sanitizing `=`, `+`, `-`, `@`, `\t`, `\r`, `%`.
  - Small-cell reporting disclosure ($N < 5$).

---

## 5. Modified and Created Files

### Backend Services (`services/api`)
- `app/modules/research/analytics_service.py` *(New)*: Core analytics service implementing formula injection sanitization, descriptive sample statistics, CONSORT participant flow, paired learning gains, review telemetry, CSV export generators, and data dictionary schema.
- `app/modules/research/schemas.py` *(Updated)*: Added `DescriptiveMetricDTO`, `AssessmentComparisonDTO`, `PairedComparisonsDTO`, `EngagementSummaryDTO`, and `StudyAnalyticsSummaryDTO`.
- `app/modules/research/service.py` *(Updated)*: Re-exported Section 38 analytics and export service functions.
- `app/modules/research/router.py` *(Updated)*: Added `/admin/research/studies/{id}/analytics`, `/admin/research/studies/{id}/exports/participants.csv`, `/admin/research/studies/{id}/exports/assessments.csv`, `/admin/research/studies/{id}/exports/reviews.csv`, and `/admin/research/studies/{id}/exports/data-dictionary`.
- `tests/test_research_analytics.py` *(New)*: Comprehensive test suite validating formula injection, statistics, flow, paired differences, engagement, exports, permissions, and audits.

### Frontend Administration (`apps/admin`)
- `src/services/admin-demo.ts` *(Updated)*: Added `"research.read"`, `"research.manage"` to permissions, added `DEMO_RESEARCH_STUDIES`, `DEMO_RESEARCH_ANALYTICS`, and sample CSV datasets. Cleaned up unused imports.
- `src/components/admin-nav.tsx` *(Updated)*: Added `"research"` navigation tab with live permission gating.
- `src/app/dashboard/page.tsx` *(Updated)*: Added Research Analytics card to workspace grid.
- `src/app/api/admin/research/[[...segments]]/route.ts` *(New)*: BFF route handler supporting studies, analytics summaries, CSV file streaming, and data dictionary retrieval.
- `src/components/research-dashboard.tsx` *(New)*: High-aesthetic client dashboard featuring study selector, CONSORT cards, outcome comparison table, paired gain cards, review telemetry, and export center with modal data dictionary viewer.
- `src/app/research/page.tsx` *(New)*: Server-rendered research dashboard page checking `requireAdmin()` and `research.read`.

### Documentation
- `docs/RESEARCH.md` *(Updated)*: Added Section 6 covering descriptive analysis mandates, CONSORT flow, learning gains, review telemetry, export datasets, and CWE-1236 sanitization.
- `docs/SECTION_38_REPORT.md` *(New)*: Full Section 38 closeout report.

---

## 6. Automated Verification Evidence

### 6.1 Backend Analytics & Security Tests
```bash
pytest tests/test_research_analytics.py -v
```
**Output**:
```
tests/test_research_analytics.py::test_formula_injection_sanitization PASSED [  9%]
tests/test_research_analytics.py::test_descriptive_statistics_calculation PASSED [ 18%]
tests/test_research_analytics.py::test_participant_flow_computation PASSED [ 27%]
tests/test_research_analytics.py::test_assessment_metrics_and_paired_learning_gains PASSED [ 36%]
tests/test_research_analytics.py::test_engagement_metrics_from_review_events PASSED [ 45%]
tests/test_research_analytics.py::test_export_participants_longitudinal_csv PASSED [ 54%]
tests/test_research_analytics.py::test_export_assessment_results_csv PASSED [ 63%]
tests/test_research_analytics.py::test_export_review_events_csv PASSED   [ 72%]
tests/test_research_analytics.py::test_data_dictionary_schema_completeness PASSED [ 81%]
tests/test_research_analytics.py::test_admin_permission_gating_raises_on_unauthorized PASSED [ 90%]
tests/test_research_analytics.py::test_get_study_analytics_summary_success PASSED [100%]

============================= 11 passed in 1.05s ==============================
```

### 6.2 Backend Regression Tests
```bash
pytest tests/test_controlled_experiment.py tests/test_research_participants.py tests/test_conversation_practice.py tests/test_pronunciation.py tests/test_grading.py -v
```
**Output**:
```
============================= 98 passed in 2.48s ==============================
```

### 6.3 Next.js Admin App Linting & Typecheck
```bash
npm run lint
```
**Output**:
```
> admin@0.1.0 lint
> eslint
(0 errors, 0 warnings)
```

```bash
npm run build
```
**Output**:
```
▲ Next.js 16.4.2 (Turbopack)
- Environments: .env.local
✓ Compiled successfully in 1096ms
✓ Generating static pages using 11 workers (9/9) in 719ms

Route (app)
├ ƒ /api/admin/research/[[...segments]]
├ ◐ /dashboard
├ ◐ /research
```

---

## 7. Known Limitations & Section 39 Prerequisites

1. **Descriptive Baseline Established**: Section 38 intentionally restricts computational reporting to descriptive metrics ($N$, Mean, Median, SD, gains, and losses). Inferential hypotheses tests (e.g., Welch's two-sample $t$-test, Mann-Whitney $U$, Repeated Measures ANOVA, or linear mixed-effects modeling) require formal protocol approval and hypothesis locking in Section 39.
2. **Small-Cell Aggregation Threshold**: Cells with $N < 5$ are flagged in the UI. For external publication exports, investigators must verify whether IRB policy requires cell suppression or microdata perturbation.
3. **Database Migration Head**: Head remains `0013_learning_focus` with 63 tables.

---

## 8. Completion Confirmation

Section 38: Research Analytics and Exports is completely implemented, verified, documented, and closed.

**STOP**: As required by project instructions, stop before Section 39. No automatic commit or push has been performed.
