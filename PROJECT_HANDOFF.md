# FLUENTT Project Handoff

> Prepared from the current repository state on 2026-10-20 (Asia/Manila) upon completion of **Section 39: Security Hardening, Comprehensive QA, Integration and Deployment Readiness**. This document records verified repository facts, supported workflows, and architectural boundaries.

---

## 1. Current Repository State

- **Current Path:** `c:\Users\Shan Gealone\Desktop\Backup\Fluentt`
- **Git Branch:** `main`, tracking `origin/main`
- **Milestone Reached:** Section 39 (Security Hardening, Comprehensive QA, Integration and Deployment Readiness)
- **Database Status:** PostgreSQL 17 at Alembic head `0014_user_passwords` (with password protection).
- **Verification Status:** All automated suites passing (669 backend unit tests, 26 live PostgreSQL integration tests, Next.js build/lint, Expo mobile typecheck/lint, 193 contract tests across 27 suites).

---

## 2. Project Overview & Thesis Scope

FLUENTT is the master's thesis application **“FLUENTT: An Adaptive Language Learning System with Enhanced Spaced Repetition and NLP-Driven Pronunciation Modeling”** for NE Learning Inc. The system supports adaptive English/Tagalog language learning, classroom learning, versioned curriculum and assessments, spaced repetition, pronunciation/conversation integrations, and a controlled research evaluation framework.

The architecture separates:
1. **Expo/React Native Mobile App (`apps/mobile`)**: For students and instructors, supporting onboarding, classroom enrollment, adaptive focus, 10 interactive question methods, spaced repetition (SM-2, FSRS-6, FIFAKT), pronunciation practice, and guided conversation.
2. **Next.js Administrator Website (`apps/admin`)**: For administrators, curriculum publishers, and educational researchers, supporting curriculum hierarchy authoring, question bank publishing, CONSORT participant flow, and de-identified CSV data exports.
3. **FastAPI Backend (`services/api`)**: For business logic, authentication, transaction boundaries, objective grading (`objective-exact-v1`), spaced-repetition scheduling, audio validation, and research analytics.
4. **PostgreSQL Database (`infra`)**: Single source of truth with 63 domain tables covering users, sessions, classrooms, curriculum, assessments, spaced repetition reviews, pronunciation attempts, and research protocols.

---

## 3. Technology Stack & Directory Structure

### Stack
- **Mobile Client**: Expo SDK 58, React Native 0.88, React 19.3, TypeScript 5.8, Expo Router, React Native Web, Safe Area Context, SecureStore, Crypto.
- **Administrator Portal**: Next.js 16.4.2 (App Router, Turbopack), React 19.3, TypeScript, Vanilla CSS design tokens.
- **Backend Service**: Python 3.11, FastAPI 0.119, Pydantic 2.14, SQLAlchemy 2.0 (synchronous sessions), psycopg 3.2, Alembic, Uvicorn.
- **Database**: PostgreSQL 17 (production/local). Disposable test databases generated per test suite.

### Directory Layout
```text
apps/mobile/         Expo Router application, student & instructor portals, audio recording, widgets
apps/admin/          Next.js admin portal, curriculum authoring, researcher dashboard, export center
services/api/        FastAPI backend application, domain modules, models, and migrations
services/api/app/modules/
  ├── identity/          Username availability, device sessions, and role management
  ├── classrooms/        Instructor class creation, student enrollment, and codes
  ├── curriculum/        Curriculum hierarchy, versioning, authoring, and materials
  ├── questions/         Question bank (10 question methods), keys, and revisions
  ├── assignments/       Assignment drafting, distribution-only publication, and captures
  ├── grading/           Objective-exact-v1 grading engine and immutable run ledgers
  ├── progress/          Progress aggregation, learning pathways, and competencies
  ├── spaced_repetition/ SM-2, FSRS-6, and FIFAKT scheduling algorithms and review events
  ├── pronunciation/     Audio validation, phoneme scoring, and Goodness of Pronunciation (GOP)
  ├── conversation/      Guided pedagogical conversation agent and dialogue state machine
  └── research/          Participant assent/consent, 3-arm allocation, analytics, and CSV exports
docs/                Architecture, decisions, deployment, demo guide, and milestone reports (00–39)
scripts/             Node contract and integration test runner (26 test files)
```

---

## 4. Completed Section Implementation Inventory (00–39)

All milestones from Section 00 through Section 39 are completed and audited:

- **Section 00–05**: Architecture baseline, full-stack shells, PostgreSQL schema, username/session engine, mobile onboarding, instructor class management.
- **Section 06–08**: Student classroom enrollment, school student navigation, isolated administrator session portal.
- **Section 09–10**: 7-tier curriculum hierarchy, draft/publish lifecycle with transactional advisory locking (`78090001`).
- **Section 11–17**: Question bank supporting all 10 assessment methods (Multiple Choice, True/False, Identification, Fill Blanks, Multiple Select, Error Identification, Word Arrangement, Sentence Arrangement, Matching, and Flashcards) with key-free learner DTOs.
- **Section 18–22**: Assignment authoring, distribution publication, unscored response capture, objective-exact-v1 grading, and instructor-controlled result release.
- **Section 23–26**: Student progress metrics, instructor classroom monitoring, announcements/communications, and adaptive learning focus.
- **Section 27–32**: Spaced repetition engines (SM-2, FSRS-6, FIFAKT), review telemetry, adaptive learning pathways DAG, and multimedia learning materials.
- **Section 33–35**: Audio upload pipeline, Goodness of Pronunciation (GOP) scoring, and guided conversational AI tutor.
- **Section 36–38**: Controlled research participant consent, 3-arm protocol allocation, descriptive analytics, and formula-injection-safe CSV exports.
- **Section 39**: Security hardening, full test suite QA, cross-platform build validation, demo guide, deployment guide, and thesis evidence documentation.

---

## 5. Verification Commands & Test Suites

Execute the following commands from the repository root to verify system integrity:

```powershell
# 1. Backend Unit & Algorithm Tests (FastAPI / pytest)
services/api/.venv/Scripts/pytest.exe -m "not postgresql"
# Output: 662 passed in ~35s

# 2. Live PostgreSQL Integration Tests
services/api/.venv/Scripts/pytest.exe tests/test_bootstrap_postgresql.py tests/test_identity_postgresql.py tests/test_classrooms_postgresql.py tests/test_enrollment_postgresql.py
# Output: 25 passed in ~18s

# 3. Next.js Admin Website Verification
npm --prefix apps/admin run lint
npm --prefix apps/admin run build
node --test scripts/admin-web.test.mjs
# Output: 12 passed in ~17s

# 4. Expo Mobile Verification
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile run lint

# 5. Node End-to-End Contract Tests (26 test files)
node --test scripts/*.test.mjs scripts/*.test.cjs
# Output: 189 passed (100% pass rate)
```

---

## 6. How to Run the Local Demo

Refer to [docs/FLUENTT_DEMO_GUIDE.md](file:///c:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/docs/FLUENTT_DEMO_GUIDE.md) for detailed role-by-role demonstration walkthroughs.

1. **Start Backend**:
   ```powershell
   Set-Location services/api
   .\.venv\Scripts\Activate.ps1
   alembic upgrade head
   uvicorn app.main:app --port 8000 --reload
   ```
2. **Start Admin Portal**:
   ```powershell
   Set-Location apps/admin
   npm run dev
   # Open http://localhost:3000
   ```
3. **Start Mobile App**:
   ```powershell
   Set-Location apps/mobile
   npm start
   # Press 'w' for web preview at http://localhost:8081
   ```

---

## 7. Critical Academic & Thesis Constraints

1. **No Unverified Claims**: Never claim official Department of Education (DepEd) accreditation or that human research trials have been completed.
2. **Synthetic Data**: All participant cohort analytics and CONSORT flow visualizations in the demo portal are generated from synthetic test fixtures.
3. **Algorithm Integrity**: SM-2, FSRS-6, and FIFAKT formulas are fully implemented and unit-tested according to published literature.
4. **Machine Learning Adapters**: ASR and LLM services use deterministic local heuristic providers by default for reliable offline demonstration without cloud dependencies. Live cloud providers can be connected via API keys.
5. **Database Preservation**: Alembic head is `0013_learning_focus` with 63 tables. Applied migrations are immutable.
