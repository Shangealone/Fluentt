# Research reporting and export data dictionary

Date: 2026-10-21, Asia/Manila. Scope: explicitly designated Research Classrooms in Section 38B. **Questionnaires are UNPUBLISHED. Thesis exports are BLOCKED. This is not an approved analysis plan or a released CSV schema.**

## Implemented availability contract

An authorized manager receives `StudyOverview.reporting` from `GET /api/v1/admin/research-classrooms/studies/{scope_id}` (also in that manager's bounded study list). The implementation is `services/api/app/modules/research/reporting_schemas.py`; contract identity is `research-reporting-readiness-v1`. It describes unavailable data; it does not query or aggregate participant, assignment, review, assessment, questionnaire, pronunciation or personal records.

| JSON field | Type / current value | Meaning |
| --- | --- | --- |
| Parent `id`, `study_id`, `protocol_id` | UUID strings | Existing manager-owned research configuration/study/protocol identities. No ordinary user identity or participant roster is returned. |
| Parent `protocol_version`, `configuration_version`, `configuration_fingerprint` | Stored protocol label, positive revision integer, SHA-256 | Genuine configuration provenance. These do not establish ethics, instrument, algorithm or analysis approval. |
| Parent `configuration.starts_at`, `.ends_at`, `.timezone` | Aware date/time strings / IANA label or null | Proposed configured study window/timezone; not an observed measurement window. |
| `reporting.contract_version` | `research-reporting-readiness-v1` | Technical response schema version only, not a scientific metric or instrument version. |
| `reporting.observed_results_available` | false | No authorized observation aggregation is implemented. |
| `reporting.inferential_statistics_available` | false | No approved inferential pipeline or significance outputs. |
| `reporting.export_status` | `BLOCKED` | No participant-level or aggregate thesis dataset is released. |
| `reporting.questionnaire.publication_status` | `UNPUBLISHED` | No approved final questionnaire has been published. |
| `reporting.questionnaire.collection_available` | false | No questionnaire delivery/submission/response collection route is enabled. |
| `reporting.questionnaire.instrument_version` | null | No approved questionnaire version is resolved. Do not substitute the study protocol string. |
| `reporting.questionnaire.response_count` | null | Not an observed zero. Eligible population/disclosure rules and collection are unavailable. |
| `reporting.blockers` | Stable strings listed below | Missing prerequisites, not participant-specific missingness reasons. |
| `reporting.metrics` | 18 unavailable entries | Each entry has a stable key and the fields below. No numerical research metric is emitted. |

Every metric entry has this shape:

| Field | Type / current value | Meaning |
| --- | --- | --- |
| `key` | One of the keys below | Requested reporting area. |
| `status` | `UNAVAILABLE` | No authorized measurement is released. |
| `value` | null | Neither zero, a model prediction nor an estimated result. |
| `sample_size` | null | Number of authorized observed units is unknown/unavailable, not the proposed target. |
| `denominator` | null | No approved eligible population/window denominator is resolved. Never use the planned 30 or 15 per arm. |
| `observation_window` | null | No verified observation interval; configured dates are a separate proposal. |
| `instrument_version` | null | No approved metric-specific observation instrument supplied. |
| `algorithm_version` | null | No approved measured treatment identity supplied; registry/configuration labels are not measurement provenance. |
| `metric_version` | null | No approved calculation/eligibility/missing-data policy implemented for this metric. |
| `reason` | `authorized_measurement_unavailable` | Availability reason, not an individual participant's response/withdrawal code. |

The server schema rejects numbers in the null-only metric fields. The administrator response validator also rejects invented zero counts, target denominators, published questionnaire status and observed/predicted results masquerading as this readiness contract. The UI renders JSON null as **N/A**; JSON itself never substitutes string `N/A`, empty string, zero, `NaN` or infinity.

## Reporting area keys

All areas below currently have null value/sample size/denominator/window/versions. No formula or denominator policy is approved by this dictionary.

| Key | Intended reporting area / unresolved dependency |
| --- | --- |
| `participant_flow` | Approved eligible/consented/allocated/withdrawn/completed definitions, authorization and disclosure rules. |
| `assignment_adherence` | Explicit research-only opportunities and approved completed/eligible denominator; ordinary classroom captures are excluded. |
| `review_adherence` | Approved due/adjusted availability/missed/late/workload definitions and versioned research reviews. |
| `pre_test_completion` | Authorized, versioned pre-test attempts and approved eligible population. |
| `immediate_post_test_completion` | Authorized immediate post-test stage/attempt policy and denominator. |
| `delayed_retention_completion` | Separately approved delayed interval/window and actual attempts; no immediate substitute quiz. |
| `assessment_results` | Comparable approved scales, exact locked instrument/scoring versions and genuine outcomes. |
| `recall_accuracy` | Approved objective recall evidence. Self-reported good/easy ratings are not objective correctness. |
| `review_count` | Eligible research event count with actual provenance and replay/body/ownership exclusion. |
| `workload` | Approved distinct-item/exposure/repetition definitions; no assumed equal workload. |
| `active_study_duration` | Approved foreground/idle/background/multi-device measurement. Client durations are not verified active time. |
| `study_duration` | Approved actual participation/observation interval, not configured intervention weeks. |
| `pronunciation_score` | Validated permitted research-context acoustic measurement. Personal Voice, ASR word coverage, fixed legacy values and simulated predictions are excluded. |
| `questionnaire_responses` | Approved published instrument, eligible respondents, submission/withdrawal/privacy contract. |
| `questionnaire_distributions` | Approved scales, item versions, missing/not-applicable coding and disclosure policy. No invented ISO/IEC 25010 items. |
| `missing_data` | Approved expected population/opportunities and reason definitions; unavailable collection is not a count of missing people. |
| `learning_gain` | Approved comparable paired scales, population and calculation plan. No hardcoded maximum or invented normalization. |
| `retention` | Approved comparable delayed measurement and interval/population policy. No rating-based proxy. |

Current blocker codes:

- `approved_questionnaire_missing`
- `participant_authorization_workflow_missing`
- `approved_statistical_and_comparability_plan_missing`
- `approved_disclosure_and_withdrawal_policy_missing`
- `verified_assessment_and_treatment_collection_unavailable`

These describe repository capabilities/approval prerequisites. They are not evidence that a person declined, withdrew, failed an assessment or produced a missing answer.

## Export endpoint, authorization and current safety

`GET /api/v1/admin/research-classrooms/studies/{scope_id}/exports?dataset=participants|assessments|reviews|questionnaires` requires a live separate administrator session, explicit **research.read and research.export**, and exact manager ownership. No default grant is added. No mobile bearer authorization, classroom invitation code or UI toggle grants access.

Current outcomes: 401 for absent/invalid administrator session; 403 for missing export/read permission; 404 for a foreign/unavailable scope; 422 for an unsupported dataset; authorized owned requests return 409 `research_export_blocked`. No CSV, attachment header, participant identifier, response or raw observation is returned. Responses are no-store. There is no active UI download control or questionnaire publication/submission route.

The current BFF allows only the exact GET dataset names/query, rechecks export/read permissions, rejects duplicates/unknown/raw-voice queries, bounds responses and expects JSON. A mistakenly returned CSV/formula payload is rejected rather than forwarded as a file. The existing managed-study legacy analytics/CSV/codebook routes are also blocked before observation disclosure. The older global codebook and serializer are **not** the contract for Research Classrooms.

Formula protection in this slice is **no dataset disclosure**, not a newly implemented formula-escaping encoder. QA verifies malicious synthetic participant/code payloads cannot reach a response/attachment and unexpected upstream CSV is rejected. Existing legacy sanitizer tests are not certification of robust CSV quoting or whitespace/control-character formula protection. No positive thesis CSV export is claimed.

## Future raw dataset boundary - not implemented or published

Before approving any CSV schema, an approved plan must define population, event-time consent and permitted post-withdrawal handling, exact study/classroom/protocol/condition/configuration scope, observation windows, scale comparability, small-cell suppression/reconstruction controls, retention/access/auditing and data minimization. Unknown policy means disclosure remains blocked; there is no invented N<5 rule or implicit retain-all-withdrawals policy.

Potential sources already in the repository are coded `ResearchParticipant`, private `ResearchClassroomEnrollment`/protocol/event references, immutable `ResearchGroupAssignment`, frozen `ResearchAssessment`/genuine results and research-context review state/events. Their existence alone does not make a row eligible. Prompt 04's authorization workflow, Prompt 05 execution and Prompt 06 real treatment are missing/blocked. Questionnaire items/scales/response storage must be based on the final approved instrument; there is no existing approved response schema to export.

Any future approved raw export must use only pseudonymous participant identifiers, study/protocol/instrument/content/algorithm versions and permitted eligible observations. Ordinary user IDs/usernames, private identity links/consent evidence, ordinary class codes/names, emails, birth dates, guardian identities, raw audio, voice URLs, raw transcripts, private keys/rubrics and unconstrained questionnaire free text are not an approved export allowlist. Pseudonymization is not anonymization. Observation-time allocation must not be relabeled by a later condition assignment.

The future writer must separately verify robust CSV delimiter/quote/newline serialization and spreadsheet formula protection, including leading whitespace/control characters, `=`, `+`, `-`, `@`, malicious quoted fields and text resembling numbers. Only trusted typed finite numerical observations may remain numerical; untrusted text must not become formulas. Raw JSON observations must stay immutable; export encoding must not rewrite source data. Actual approved CSV columns, null/reason encodings and their tests remain unresolved, not selected here.

Once eligible collection and policies exist, missing, unavailable, not-applicable, invalidated, withdrawn-suppressed and zero must be distinguished under the approved schema. This availability contract releases none of those participant-specific categories. Do not infer response distributions, small-cell counts, significance or treatment effects from its nulls.

Implementation and exact test evidence: [SECTION_38B_07_REPORT.md](SECTION_38B_07_REPORT.md). **STOP at unpublished collection and blocked disclosure until the required approved sources and verified workflows exist.**
