# FLUENTT — Section 36 Report: Research Participant Management

## 1. Executive Summary

Section 36 establishes a secure, versioned research-participant registration, informed-consent verification, pseudonymous code generation, and voluntary/administrative withdrawal lifecycle for the FLUENTT platform. All research operations are strictly decoupled from ordinary student accounts, classrooms, and educational grading records.

Crucially, this implementation makes no claims of institutional ethics review board (IRB / ERC) approval, nor does it fabricate participant counts or experimental allocations. Consent tracking records document versions and affirmations at the software level while explicitly displaying notices that software consent does not constitute ethics clearance.

---

## 2. Participant Lifecycle and Architecture

### 2.1 Lifecycle State Machine
```
[Unenrolled Student]
       │
       ▼ (Browse Active Studies)
[Protocol & Consent Review]
       │
       ├─ (Ineligible: Duplicate / Withdrawn / Capacity / Non-Student) ──► Rejection
       ▼ (Affirm Consent with Versioned Protocol)
[Enrolled Participant] ◄─── Atomic Registration:
       │                      • Pseudonymous Code Generated (P-TAG-XXXXXX / P-ENG-XXXXXX)
       │                      • Public ResearchParticipant Created
       │                      • Identity Link in research_private
       │                      • Append-Only Consent Record (status='granted')
       │                      • Dedicated Research LearningContext (student_id=NULL)
       │                      • ResearchEvent & AuditLog Recorded
       │
       ▼ (Voluntary or Administrative Withdrawal)
[Withdrawn Participant]
       │
       ▼
[Research Halted; Historical Data Retained per Policy research-retention-v1]
```

### 2.2 Strict Decoupling and Schema Isolation
1. **Public vs. Private Schema Separation**:
   - `public.research_participants` stores only pseudonymous participant codes (`P-TAG-XXXXXX`), enrollment statuses, and lifecycle timestamps. It contains **no foreign keys to `users`**.
   - `research_private.research_identity_links` stores the sensitive mapping between `user_id` and `participant_id`. PUBLIC access is revoked at the database level, and application-level access requires the privileged `research.manage` permission with mandatory audit logging.
2. **Append-Only Consent Auditing**:
   - `research_private.research_consent_records` is protected by the PostgreSQL database trigger `fluentt_append_only()`, which strictly blocks `UPDATE` and `DELETE` operations.
   - Lifecycle transitions (such as voluntary withdrawal) are recorded by appending a new record with `status = 'withdrawn'`.
3. **Constraint-Enforced Context Scope**:
   - Database constraint `ck_learning_contexts_context_scope` requires that for research contexts:
     `kind = 'research' AND student_id IS NULL AND class_id IS NULL AND participant_id IS NOT NULL`.
   - Experimental activity cannot be conflated with classroom or student progress tracking.
4. **No Re-Enrollment**:
   - Once a participant withdraws from a study, re-enrollment is strictly prohibited to preserve experimental integrity and prevent contaminated baseline measurements.

---

## 3. Data Retention and Ethics Policies

### 3.1 Software Consent Notice
All consent endpoints and UI views prominently present the required disclosure:
> *"Software consent recording within FLUENTT establishes informed-consent affirmation for the specified protocol version, but does not itself constitute institutional ethics review board (IRB / ERC) approval. Protocols must obtain independent institutional clearance prior to participant recruitment."*

### 3.2 Data Retention Policy (`research-retention-v1`)
In accordance with approved thesis methodology Chapter 3:
- Voluntary or administrative withdrawal halts future experimental sessions immediately.
- Historical learning events, assessment records, and audit logs collected prior to withdrawal remain permanently preserved in pseudonymized form for scientific reproducibility.
- No classroom students are silently converted to research participants, and educational classroom records remain completely uncoupled from research analytics.

---

## 4. Modified and Newly Created Files

### Backend (`services/api`)
- `services/api/app/modules/research/schemas.py`: Pydantic DTOs for studies, consent documents, eligibility, enrollment, withdrawal, participant status, admin views, and identity reveal audits.
- `services/api/app/modules/research/service.py`: Domain service implementing study seeding, cryptographic pseudonym generation, eligibility verification, atomic enrollment, append-only consent recording, voluntary/admin withdrawal, and identity revelation auditing.
- `services/api/app/modules/research/router.py`: FastAPI endpoints for student research interactions (`/me/research/*`) and administrator research operations (`/admin/research/*`).
- `services/api/app/api/v1/router.py`: Route registration for `research_student_router` and `research_admin_router`.
- `services/api/tests/test_research_participants.py`: 12 comprehensive unit and integration tests for participant management and privacy boundaries.

### Mobile Application (`apps/mobile`)
- `apps/mobile/src/services/api/research.ts`: Typed API client with response validators for studies, consent documents, enrollment receipts, and withdrawal receipts.
- `apps/mobile/src/demo/demoData.ts`: Demo research studies and mock API client.
- `apps/mobile/src/session/provider.tsx`: Injected `research: ResearchAccess` into the central session context.
- `apps/mobile/src/components/navigation.tsx` & `apps/mobile/src/app/student.tsx`: Voluntary research navigation button and dashboard card for student profiles (instructors strictly excluded).
- `apps/mobile/src/app/research.tsx`: Research screen route in Expo Router.
- `apps/mobile/src/features/research/ResearchParticipationView.tsx`: Full interactive UI featuring study browsing, protocol consent document review, explicit affirmation, pseudonymous code display, and voluntary withdrawal.
- `scripts/research.test.mjs`: Node contract test suite verifying client validations and authentication.

### Documentation
- `docs/RESEARCH.md`: Research data flow, schema separation, pseudonymization, and retention documentation.
- `docs/SECTION_36_REPORT.md`: This comprehensive section report.

---

## 5. Verification and Test Results

### 5.1 Pytest Suite (`services/api`)
```
tests/test_research_participants.py::test_seed_research_studies_creates_tagalog_and_english PASSED [  8%]
tests/test_research_participants.py::test_get_available_studies_metadata PASSED [ 16%]
tests/test_research_participants.py::test_get_consent_document_and_ethics_disclaimer PASSED [ 25%]
tests/test_research_participants.py::test_check_participant_eligibility_valid_and_invalid PASSED [ 33%]
tests/test_research_participants.py::test_generate_pseudonymous_participant_code_format PASSED [ 41%]
tests/test_research_participants.py::test_enroll_participant_consent_validation_failures PASSED [ 50%]
tests/test_research_participants.py::test_enroll_participant_atomic_creation_and_privacy_isolation PASSED [ 58%]
tests/test_research_participants.py::test_duplicate_enrollment_prevention PASSED [ 66%]
tests/test_research_participants.py::test_voluntary_withdrawal_and_re_enrollment_prohibition PASSED [ 75%]
tests/test_research_participants.py::test_admin_participant_view_and_identity_reveal PASSED [ 83%]
tests/test_research_participants.py::test_admin_create_and_lock_study PASSED [ 91%]
tests/test_research_participants.py::test_admin_withdraw_participant PASSED [100%]

============================= 12 passed in 1.95s ==============================
```

### 5.2 Regression Verification (`services/api`)
```
tests/test_conversation_practice.py + tests/test_pronunciation.py + tests/test_grading.py
============================= 73 passed in 2.98s ==============================
```

### 5.3 Live PostgreSQL Database Verification
Tested directly against local PostgreSQL (`127.0.0.1:55432/fluentt_local`):
- Verified initial study seeding of `FLUENTT-EXP-TAG-2026` and `FLUENTT-EXP-ENG-2026`.
- Verified insertion into `research_participants` with pseudonymous code.
- Verified identity link insertion into `research_private.research_identity_links`.
- Verified database trigger `fluentt_append_only()` blocking `UPDATE` on `research_private.research_consent_records`.
- Verified successful voluntary withdrawal inserting a new consent row with `status = 'withdrawn'`.
- Verified constraint `ck_learning_contexts_context_scope` blocking research contexts with non-NULL `student_id`.

### 5.4 Mobile Client Contract Tests (`scripts/research.test.mjs`)
```
✔ validateStudiesResponse accepts well-formed response (2.4294ms)
✔ validateStudiesResponse rejects malformed response (0.7752ms)
✔ validateConsentDocument accepts and validates consent details (0.2721ms)
✔ validateConsentDocument rejects missing ethics or retention statement (0.2202ms)
✔ validateEnrollmentReceipt validates pseudonymous code and status (0.4999ms)
✔ validateWithdrawalReceipt confirms withdrawn status and retention notice (0.314ms)
✔ researchAccess wraps runner and invokes operations with authentication (0.2747ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
```

### 5.5 TypeScript Typecheck Validation
- `apps/mobile`: `npx tsc --noEmit` passed with 0 errors (Exit code 0).
- `apps/admin`: `npm run typecheck` passed with 0 errors (Exit code 0).

---

## 6. Actual Limitations

1. **Controlled Experiments & Group Allocation**: Section 36 strictly limits scope to participant registration and lifecycle. No control vs. treatment group allocation (`sm2_control` vs `esr_experimental`) or assessment battery assignment was performed (reserved for Section 37).
2. **No Institutional Ethics Clearance**: The software manages consent documentation and affirmation state, but institutional IRB approval from an accredited ethics review board is required prior to real-world deployment.
3. **Database Migration Head**: The database head remains frozen at `0013_learning_focus` across all 63 domain tables; all required research tables (`research_studies`, `research_participants`, `research_private.research_identity_links`, `research_private.research_consent_records`, `learning_contexts`, `research_events`) were already established in early foundation migrations and were preserved without schema changes.

---

## 7. Section 37 Prerequisites

Section 37 will introduce **Controlled Experiments and Group Allocation**. Prerequisites now satisfied:
- [x] Versioned research studies with locked protocols (`fluentt_guard_study_protocol`).
- [x] Pseudonymous participant identifiers (`P-TAG-XXXXXX`, `P-ENG-XXXXXX`) decoupled from login users.
- [x] Dedicated research `LearningContext` with NULL student and class references.
- [x] Append-only consent verification and voluntary withdrawal lifecycle.
- [x] Restricted administrative identity revelation with audit logging.
- [x] Mobile consent review and participation status interface.
