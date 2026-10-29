# Section 29 — SM-2 Spaced Repetition Algorithm

Implemented and verified October 19, 2026. Section 28 is accepted by the supplied Section 29 context. Head remains `0013_learning_focus` with 63 domain tables preserved (reusing `vocabulary_items`, `vocabulary_review_states`, `vocabulary_review_events`, and `scheduler_configurations`). No automatic commit or push. **A deterministic, unit-testable SM-2 scheduling engine is implemented, registered in the algorithm registry, and integrated with persistent review event recording and due-review lookups.**

---

## 1. Algorithmic Foundation & Equations

Implemented Dr. Piotr Wozniak's classic SuperMemo 2 (SM-2) algorithm (1987) with pure mathematical functions separated from database and API orchestration.

### A. Review Quality Scale Mapping

The 4-point learner self-report recall ratings from Section 17 (`again`, `hard`, `good`, `easy`) map deterministically to the classic SM-2 6-point quality scale $q \in \{0, 1, 2, 3, 4, 5\}$:

| Application Rating | SM-2 Quality $q$ | Standard Interpretation | Repetition Effect | $\Delta EF$ Formula | Resulting $\Delta EF$ |
|---|---|---|---|---|---|
| `again` | **1** | Complete blackout / incorrect recall (Lapse) | Reset $n = 0, I = 1$ | $0.1 - (4) \times (0.08 + 4 \times 0.02)$ | **-0.54** |
| `hard` | **3** | Correct response recalled with serious difficulty | Progress $n \ge 1$ | $0.1 - (2) \times (0.08 + 2 \times 0.02)$ | **-0.14** |
| `good` | **4** | Correct response recalled after hesitation | Progress $n \ge 1$ | $0.1 - (1) \times (0.08 + 1 \times 0.02)$ | **0.00** |
| `easy` | **5** | Perfect recall without hesitation | Progress $n \ge 1$ | $0.1 - (0) \times (0.08 + 0 \times 0.02)$ | **+0.10** |

*Note: Ratings $q < 3$ (`again`) trigger an immediate lapse, whereas $q \ge 3$ (`hard`, `good`, `easy`) represent successful repetitions.*

### B. Easiness Factor (EF) Update Formula

$$EF' = \max\left(1.30, EF + \left(0.10 - (5 - q) \times (0.08 + (5 - q) \times 0.02)\right)\right)$$

- **Initial Easiness Factor**: $EF_0 = 2.50$
- **Easiness Factor Floor**: $EF_{\min} = 1.30$ (strictly enforced; multiple lapses or hard reviews cannot drop $EF$ below this lower bound).

### C. Repetition and Interval Progression

For review count $n$ and interval $I$:

1. **Lapse Condition ($q < 3$, i.e., `again`)**:
   $$n' = 0$$
   $$I' = 1\text{ day}$$
   $$\text{lapses}' = \text{lapses} + 1$$

2. **Passing Condition ($q \ge 3$, i.e., `hard`, `good`, `easy`)**:
   $$\text{lapses}' = \text{lapses}$$
   - If $n = 0$: $n' = 1,\; I' = 1\text{ day}$
   - If $n = 1$: $n' = 2,\; I' = 6\text{ days}$
   - If $n \ge 2$:
     $$n' = n + 1$$
     $$I' = \max\left(1, \text{round}_{\text{half\_up}}(I \times EF')\right)$$

3. **Deterministic Rounding**:
   - Uses exact Python `Decimal.quantize(..., rounding=ROUND_HALF_UP)` to avoid platform floating-point differences and banker's rounding ambiguities.
   - Conversion: 1 day = 86,400 seconds.

4. **Due Date Calculation**:
   $$\text{due\_at} = \text{reviewed\_at} + \Delta t(I'\text{ days})$$
   (Timezone-aware UTC arithmetic throughout).

---

## 2. State Transition Examples

### Example 1: Standard Success Progression (`good`, $q=4$)
- Initial: $n = 0, I = 1, EF = 2.50$
- Review 1 (`good`): $n = 1, I = 1, EF = 2.50, \text{due} = +1\text{d}$
- Review 2 (`good`): $n = 2, I = 6, EF = 2.50, \text{due} = +6\text{d}$
- Review 3 (`good`): $n = 3, I = \text{round}(6 \times 2.5) = 15, EF = 2.50, \text{due} = +15\text{d}$
- Review 4 (`good`): $n = 4, I = \text{round}(15 \times 2.5) = 38, EF = 2.50, \text{due} = +38\text{d}$
- Review 5 (`good`): $n = 5, I = \text{round}(38 \times 2.5) = 95, EF = 2.50, \text{due} = +95\text{d}$

### Example 2: Mastery Progression (`easy`, $q=5$)
- Initial: $n = 0, I = 1, EF = 2.50$
- Review 1 (`easy`): $n = 1, I = 1, EF = 2.60, \text{due} = +1\text{d}$
- Review 2 (`easy`): $n = 2, I = 6, EF = 2.70, \text{due} = +6\text{d}$
- Review 3 (`easy`): $n = 3, I = \text{round}(6 \times 2.80) = 17, EF = 2.80, \text{due} = +17\text{d}$

### Example 3: Lapse & Recovery
- Card at $n = 3, I = 15, EF = 2.50$:
- Review 4 (`again`): $n = 0, I = 1, EF = 2.50 - 0.54 = 1.96, \text{lapses} = 1, \text{due} = +1\text{d}$
- Review 5 (`good`): $n = 1, I = 1, EF = 1.96, \text{due} = +1\text{d}$
- Review 6 (`good`): $n = 2, I = 6, EF = 1.96, \text{due} = +6\text{d}$
- Review 7 (`good`): $n = 3, I = \text{round}(6 \times 1.96) = 12, EF = 1.96, \text{due} = +12\text{d}$

---

## 3. Application Integration & Security

1. **Registry Integration**:
   - `SM2Scheduler` is registered in `registry` under `algorithm="sm2"`, `implementation_version="sm2-classic-v1"`, `configuration_version=1`.
   - `registry.list_available()` returns `["sm2"]`.
   - Future algorithms (`fsrs6`, `fifakt`) remain explicitly unavailable (`503 algorithm_unavailable`).
2. **State & Event Persistence**:
   - Persists state in `VocabularyReviewState` and immutable audit history in `VocabularyReviewEvent`.
   - Idempotent deduplication on `event_key`: duplicate submissions return `{"status": "replayed", ...}` without double scheduling.
   - Monotonic review timestamps: rejects review events with `reviewed_at < state_row.last_reviewed_at` (`422 out_of_order_review`).
   - Cross-algorithm isolation: cards scheduled under one configuration cannot be overwritten by another algorithm (`409 algorithm_conflict`).
   - Due review retrieval: `get_due_reviews` filters strictly by `due_at <= now` and `SchedulerConfiguration.algorithm == algorithm_name`.
3. **Mobile Client Integration**:
   - Created typed client service in `apps/mobile/src/services/api/reviews.ts` with session authentication wrappers and safe runtime validation.

---

## 4. Verification Evidence

| Check / Test Suite | Result | Details |
|---|---|---|
| Backend Pytest (`test_sm2.py`) | **14 passed, 0 failed** | Validates SM-2 progression, EF delta, EF floor (1.30), lapse reset, recovery, ROUND_HALF_UP rounding, corrupted state sanitation, registry checks, idempotency, timestamp validation, and algorithm conflict guards. |
| Foundation & Spaced Repetition Tests | **18 passed, 0 failed** | Foundation and SM-2 tests fully green. |
| Backend Pytest Regression (Sections 23, 26, 27, 28, 29) | **38 passed, 0 failed** | Zero regressions across progress, pathways, materials, notifications, foundation, and SM-2. |
| Node Client Tests (`scripts/reviews.test.mjs`, etc.) | **22 passed, 0 failed** | Validates mobile reviews API, validation, error handling, and existing client suites. |
| Mobile TypeScript Check (`npm run typecheck`) | **0 errors, clean exit** | Full mobile app typechecks cleanly. |
| Database Head Integrity | **63 tables preserved** | Head remains `0013_learning_focus`. Zero schema alterations or drift. |

---

## 5. Modified and Created Files

- **Created:**
  - `services/api/app/modules/spaced_repetition/__init__.py`: Package initialization exporting SM-2 abstractions.
  - `services/api/app/modules/spaced_repetition/sm2.py`: Pure SM-2 calculation engine (`calculate_sm2`) and `SM2Scheduler(BaseScheduler)`.
  - `services/api/tests/test_sm2.py`: Comprehensive test suite for SM-2 logic and persistence.
  - `apps/mobile/src/services/api/reviews.ts`: Mobile typed API service for reviews and due items.
  - `scripts/reviews.test.mjs`: Node test suite for mobile review client API.
  - `docs/SECTION_29_REPORT.md`: This comprehensive implementation report.
- **Modified:**
  - `services/api/app/modules/spaced_repetition/registry.py`: Registered default `sm2` scheduler.
  - `services/api/app/modules/spaced_repetition/service.py`: Added timestamp ordering validation, algorithm conflict prevention, and algorithm-scoped due review queries.
  - `docs/VOCABULARY.md`: Updated with SM-2 documentation.

---

## 6. Limitations & Section 30 Prerequisites

1. **Future Schedulers**: FSRS-6 and FIFAKT/ESR remain strictly unimplemented and isolated.
2. **Audio/Pronunciation & NLP**: Pronunciation modeling and conversational AI are separate from vocabulary review ratings.
3. **Research Randomization**: Experimental allocation and study groups remain separate from general practice.
4. **Offline Sync**: Authoritative scheduling calculations remain strictly server-side.
