# Section 28 — Spaced Repetition Engine Foundation

Implemented and verified October 19, 2026. Section 27 is accepted by the supplied Section 28 context. Head remains `0013_learning_focus` with 63 domain tables preserved (reusing `vocabulary_items`, `vocabulary_review_states`, `vocabulary_review_events`, and `scheduler_configurations`). No automatic commit or push. **A modular, deterministic spaced-repetition foundation is implemented and verified without implementing specific algorithm formulas.**

---

## 1. Inspection and Architectural Grounding

- Read `PROJECT_HANDOFF.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/VOCABULARY.md`, `docs/SECTION_17_REPORT.md`, `docs/SECTION_26_REPORT.md`, and `docs/SECTION_27_REPORT.md`.
- Grounded in existing persisted domain entities in `services/api/app/models/learning.py` and `research.py`:
  - `VocabularyItem`: Stable vocabulary content units tied to published lessons.
  - `VocabularyReviewState`: Unique combination of `(context_id, vocabulary_item_id)` and `(id, scheduler_configuration_id)` with `ix_vocabulary_review_states_due`.
  - `VocabularyReviewEvent`: Immutable append-only log storing `event_key`, `reviewed_at`, `recall_rating`, `response_duration_ms`, `previous_interval_seconds`, `resulting_interval_seconds`, and state revisions.
  - `SchedulerConfiguration`: Versioned configuration (`algorithm`, `implementation_version`, `configuration_version`, `parameters`).
  - `LearningContext`: Strict separation of `personal`, `classroom`, and `research` contexts (no cross-contamination).
- Enforced strict constraints:
  - **No SM-2, FSRS-6, or FIFAKT formulas in this section**: the foundation establishes interfaces, registry, DTOs, and event intake, keeping algorithms pluggable.
  - **No automated research enrollment**: experimental groups remain strictly gated.
  - Preserved existing 63 tables; zero schema drift or unnecessary migrations.

---

## 2. Objective & Implemented Scope

### A. Core Foundation & Interfaces (`schemas.py`, `registry.py`)
1. **Approved Review Rating Scale**:
   - Strictly mapped to the four approved self-report recall ratings from Section 17 (`again`, `hard`, `good`, `easy`). Rejects arbitrary or unapproved ratings.
2. **Modular Architecture & Algorithm Isolation**:
   - `BaseScheduler` interface: Requires `identity`, `initial_state()`, and `compute_next_review()` contracts.
   - `AlgorithmRegistry`: Dynamic registry supporting multiple algorithm versions (`sm2`, `fsrs6`, `fifakt`) while declaring uninstalled algorithms explicitly unavailable (`503 algorithm_unavailable`).
   - Separation of raw review history (`VocabularyReviewEvent`) from algorithm-specific scheduling states (`VocabularyReviewState`).

### B. Event Ingestion & Due Review Queries (`service.py`, `router.py`)
1. **Event Ingestion**:
   - Replay protection: deduplicates events by `event_key`.
   - Context isolation: resolves or isolates personal vs classroom vs research contexts.
   - State transition: records immutable events and advances state revisions without mutating historical event records.
2. **Endpoints (`/api/v1/me/reviews`)**:
   - `GET /me/reviews/algorithms`: Lists registered/active algorithms and foundation policy version.
   - `GET /me/reviews/due`: Bounded query for due vocabulary items under the active algorithm.
   - `POST /me/reviews/events`: Ingests a new review event and advances state.
   - Protected by `MobileDeviceSession` authentication, throttling, and `Cache-Control: no-store`.

---

## 3. Verification Evidence

| Test Suite / Check | Result | Description |
|---|---|---|
| Backend Pytest (`test_spaced_repetition_foundation.py`) | **4 passed, 0 failed** | Verifies review event schemas, rejection of invalid ratings, algorithm registry isolation, and due batch schemas. |
| Focused Pytest Regression (Sections 23, 26, 27, 28) | **24 passed, 0 failed** | Zero regressions across progress, pathways, materials, notifications, and spaced repetition. |
| Node test suites (`materials`, `pathways`, `progress`, `communications`) | **19 passed, 0 failed** | All client tests green. |
| Database Head Integrity | **63 tables preserved** | Migration head remains `0013_learning_focus`. |

---

## 4. Modified and Created Files

- **Created:**
  - `services/api/app/modules/spaced_repetition/__init__.py`: Package initialization.
  - `services/api/app/modules/spaced_repetition/schemas.py`: Pydantic models for review events, algorithm identity, decisions, and due review batches.
  - `services/api/app/modules/spaced_repetition/registry.py`: Abstract scheduler base class and `AlgorithmRegistry`.
  - `services/api/app/modules/spaced_repetition/service.py`: Context resolution, review event recording, and due review querying.
  - `services/api/app/modules/spaced_repetition/router.py`: API endpoints for algorithms, due reviews, and events.
  - `services/api/tests/test_spaced_repetition_foundation.py`: Unit tests.
  - `docs/SECTION_28_REPORT.md`: This report.
- **Modified:**
  - `services/api/app/api/v1/router.py`: Registered `spaced_repetition_router`.

---

## 5. Limitations & Section 29 Prerequisites

1. **Algorithm Implementations**: Actual calculation formulas for SM-2, FSRS-6, and FIFAKT remain deliberately deferred to their dedicated milestone sections.
2. **Audio/Pronunciation Integration**: Pronunciation and audio metrics are separate from vocabulary recall ratings.
3. **Research Randomization**: Experimental allocation and study groups remain separate from general practice.
