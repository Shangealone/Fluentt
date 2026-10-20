# FLUENTT — SECTION 37 REPORT: CONTROLLED RESEARCH EXPERIMENT

## 1. Executive Summary

Section 37 establishes the controlled experimental infrastructure for the FLUENTT learning system, bridging participant management (Section 36), versioned spaced repetition schedulers (SM-2, FSRS-6, ESR/FIFAKT from Sections 28–31), acoustic pronunciation scoring (Section 34), and assessment measurement.

Real consenting participants can now participate in controlled learning conditions with reproducible group allocation, treatment enforcement, participant blinding, prerequisite progression gating, single-attempt assessment controls, and an immutable, tamper-evident audit trail.

---

## 2. Requirement Gate & Methodology Mapping

All experimental features strictly adhere to the approved thesis Chapter 3 methodology:

| Methodology Requirement | Approved Specification | Section 37 Implementation Status |
| :--- | :--- | :--- |
| **Comparison Groups** | Control: `sm2_control` (Classic SM-2)<br>Experimental: `esr_experimental` (Enhanced Spaced Repetition / FIFAKT) | Implemented via `ResearchGroup` bindings to `SchedulerConfiguration` (`sm2-thesis-v1.0` and `fifakt-hybrid-v1.0`). |
| **Study Design** | Two-arm randomized between-subject controlled trial | Implemented with permuted block randomization (block size 4, 1:1 balance ratio). |
| **Target Sample Size** | 15 participants per group (30 total per study) | Enforced via pre-allocation capacity checks (`target_size = 15`, error 422 if quota exceeded). |
| **Reproducibility** | Seeded deterministic allocation recording | Implemented with pseudo-random seed / hash recorded in `allocation_metadata` and immutable `ResearchEvent`. |
| **Participant Blinding** | Double-blind participant projection | Participant endpoints return `condition_blinded = "standard_research_track"`; algorithm identities are strictly withheld. |
| **Protocol Deviations** | Append-only supersedes chain with audit justification | Guarded by database trigger `fluentt_append_only()`. Reassignments insert a new row with `assignment_number = prev + 1` and `supersedes_id = prev.id`. |
| **Assessment Battery** | 5 kinds: `pre_test`, `learning_level` 1–5, `post_test`, `delayed_retention`, `pronunciation` | Seeded per study language (Tagalog & English); progression gated by sequential milestone completion. |
| **Single-Attempt Policy** | Exactly 1 completed attempt per assessment instrument | Enforced in `start_participant_assessment`; re-takes rejected with error 422 (`single_attempt_exceeded`). |
| **Key Stripping** | Zero answer keys or rubrics leaked to clients | `expected_answer`, variations, and rubrics stripped from all student presentation DTOs. |
| **Scheduler Routing** | Automatic group routing for research practice | `get_or_create_learning_context` and `record_review_event` automatically route `context_type == "research"` to the participant's assigned scheduler. |

---

## 3. Architecture and Schema Preservation

### 3.1 Migration Head & Database Tables
- **Migration Head**: `0013_learning_focus` (strictly preserved, zero migrations added or needed).
- **Table Count**: 63 tables across `public` and `research_private` schemas.
- **Triggers Respected**:
  - `fluentt_append_only()` on `research_group_assignments`: prohibits SQL `UPDATE` and `DELETE`.
  - `fluentt_guard_locked_parent()` on `research_groups`, `research_levels`, and `research_assessments`: locks protocol modifications once a parent study is marked locked.

### 3.2 Key Contracts & Endpoints

#### Student / Participant Endpoints:
- `GET /me/research/studies/{study_id}/experiment`: Returns blinded experiment status, current curriculum level, completed milestones, and next target activity.
- `POST /me/research/studies/{study_id}/allocate`: Idempotently allocates an enrolled participant to an experimental condition using permuted block randomization.
- `GET /me/research/studies/{study_id}/assessments`: Returns all study assessments with progression unlock status and completed scores.
- `GET /me/research/studies/{study_id}/assessments/{assessment_id}`: Returns key-stripped assessment details for taking.
- `POST /me/research/studies/{study_id}/assessments/{assessment_id}/start`: Idempotently initiates or resumes a single assessment attempt.
- `POST /me/research/studies/{study_id}/assessments/{assessment_id}/submit`: Submits answers, scores objective items and pronunciation GOP, and commits result to audit log.

#### Researcher / Administrator Endpoints (`research.read` / `research.manage`):
- `GET /admin/research/studies/{study_id}/groups`: Returns unblinded group allocation summaries and enrolled participant counts.
- `POST /admin/research/studies/{study_id}/reassign`: Records an authorized protocol deviation reassignment with mandatory justification and audit logging.
- `GET /admin/research/studies/{study_id}/results`: Returns unblinded participant assessment results for scientific analysis.

---

## 4. Verification & Testing

### 4.1 Pytest Unit Test Suite (`services/api/tests/test_controlled_experiment.py`)
13 tests verifying all Section 37 invariants:
- `test_ensure_experiment_infrastructure_seeds_groups_levels_assessments`: Verifies automatic seeding of 2 groups, 5 levels, and 9 assessments.
- `test_permuted_block_randomization_balanced_allocation`: Verifies exact 1:1 balance across consecutive 4-participant blocks.
- `test_allocation_reproducibility_with_seed`: Verifies identical allocation sequence under deterministic seeds.
- `test_allocation_target_cap_enforcement_at_15`: Verifies error 422 (`study_quota_exhausted`) when 15 participants per group are reached.
- `test_allocation_rejects_withdrawn_participant`: Verifies error 422 (`participant_withdrawn`) on withdrawn users.
- `test_allocation_idempotent_duplicate_returns_existing`: Verifies repeated allocation calls return identical assignment records.
- `test_participant_blinding_never_reveals_sm2_or_esr_condition`: Verifies participant endpoints only return `"standard_research_track"`.
- `test_admin_protocol_deviation_reassignment_supersedes_chain`: Verifies append-only supersedes chain with audit logging.
- `test_assessment_prerequisite_progression_gating`: Verifies milestone gating (Level 1 locked until Pre-Test completed).
- `test_assessment_strips_expected_answers_from_participant`: Verifies zero answer keys in participant presentation payloads.
- `test_assessment_start_and_single_attempt_enforcement`: Verifies single-attempt policy and rejection of retakes.
- `test_pronunciation_assessment_gop_scoring`: Verifies acoustic Goodness-of-Pronunciation overlay evaluation.
- `test_research_context_reviews_routed_to_assigned_scheduler`: Verifies reviews with `context_type == "research"` route to the participant's assigned scheduler.

**Result**: 13 passed in 1.24s.

### 4.2 Pytest Regression Suite
Ran 85 tests covering participant management, conversational AI, speech recognition, pronunciation scoring, and objective grading:
- `test_research_participants.py`: 8 passed
- `test_conversation_practice.py`: 10 passed
- `test_pronunciation.py`: 12 passed
- `test_grading.py`: 55 passed

**Result**: 85 passed in 1.94s.

### 4.3 Node Integration Test Suite (`scripts/research.test.mjs`)
Ran 9 tests covering client validation, research access methods, participant blinding invariants, and key stripping:
**Result**: 9 passed in 14.1ms.

### 4.4 TypeScript Type Check (`apps/mobile`)
Ran `npm run typecheck` (`tsc --noEmit`) in `apps/mobile`:
**Result**: Clean compilation with 0 errors.

### 4.5 Live PostgreSQL Database Verification
Connected directly to development PostgreSQL database (`127.0.0.1:55432/fluentt_local`):
- Successfully seeded and verified 2 studies (`FLUENTT-EXP-TAG-2026` and `FLUENTT-EXP-ENG-2026`).
- Verified 2 groups (`sm2_control`, `esr_experimental`), 5 levels, and 9 assessments for both studies.
- Confirmed database migration head: `0013_learning_focus (head)` with 63 domain tables intact.

---

## 5. Modified and Created Files

| File | Change Description |
| :--- | :--- |
| `services/api/app/modules/research/schemas.py` | Added Section 37 schemas for blinded experiment status, group allocation, protocol deviations, assessment instruments, attempt lifecycle, and scoring receipts. |
| `services/api/app/modules/research/experiment_service.py` | Implemented complete experiment engine: infrastructure seeding, permuted block randomization, target caps, blinding, protocol deviations, assessment progression, objective & GOP scoring, and admin reporting. |
| `services/api/app/modules/research/service.py` | Updated study seeder to trigger experiment infrastructure and re-exported Section 37 service functions. |
| `services/api/app/modules/research/router.py` | Registered student experiment endpoints (`/experiment`, `/allocate`, `/assessments`, `/start`, `/submit`) and admin endpoints (`/groups`, `/reassign`, `/results`). |
| `services/api/app/modules/spaced_repetition/service.py` | Added `context_type == "research"` resolution in `get_or_create_learning_context`, `record_review_event`, and `get_due_reviews` to automatically route practice to assigned group scheduler. |
| `services/api/tests/test_controlled_experiment.py` | Created 13 unit tests for allocation balance, reproducibility, target caps, blinding, supersedes chains, progression gating, key stripping, single-attempt policy, GOP scoring, and scheduler routing. |
| `apps/mobile/src/services/api/research.ts` | Added Section 37 TypeScript interfaces, DTOs, and API client methods. |
| `apps/mobile/src/demo/demoData.ts` | Added Section 37 mock implementations to `createDemoResearchApi` for mobile demo mode. |
| `apps/mobile/src/features/research/ResearchParticipationView.tsx` | Enhanced mobile UI with blinded condition track badge, next milestone banner, assessment battery list, and active assessment runner with scoring receipt. |
| `scripts/research.test.mjs` | Added Node integration tests for Section 37 client methods, blinding preservation, and key stripping. |
| `docs/RESEARCH.md` | Documented Section 37 comparison groups, permuted block randomization, blinding invariants, single-attempt policies, and scheduler routing. |
| `docs/SECTION_37_REPORT.md` | Created this comprehensive Section 37 deliverable report. |

---

## 6. Limitations & Section 38 Prerequisites

1. **No Participant Recruitment**: Real human recruitment, marketing, or external enrollment campaigns are not performed in this section.
2. **No Fabricated Results**: All experimental data structures are initialized empty or tested via deterministic synthetic fixtures; no artificial student outcomes or study results are fabricated.
3. **No Automated Statistical Claims**: No statistical significance (e.g. p-values, t-tests, ANOVA) or educational superiority claims are asserted; research analytics and export pipelines are reserved for Section 38.
4. **IRB / Ethics Clearance**: Software consent recording does not substitute for independent Institutional Review Board (IRB) or Research Ethics Committee (REC) approval.
5. **Section 38 Prerequisites**: Section 38 (Research Analytics and Data Export) requires the immutable assessment attempts and group assignment records established in Section 37 to compute de-identified group aggregates, learning curve trajectory modeling, and thesis-compliant data export formats.

---

## 7. STOP

Section 37 is complete. No git commit or push has been performed. Stopping before Section 38 per project instructions.
