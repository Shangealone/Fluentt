# Section 30 — FSRS-6 Integration

Implemented and verified October 19, 2026. Section 29 is accepted by the supplied Section 30 context. Head remains `0013_learning_focus` with 63 domain tables preserved (reusing `vocabulary_items`, `vocabulary_review_states`, `vocabulary_review_events`, and `scheduler_configurations`). No automatic commit or push. **A genuine, reproducible FSRS-6 scheduling engine is integrated through the Section 28 scheduler interface, with independent algorithm identity, persistent per-learner/card state, and verified isolation from SM-2.**

---

## 1. Algorithm Specification & Mathematical Alignment

Implemented the approved open-spaced-repetition Free Spaced Repetition Scheduler Version 6 (**FSRS-6**) specification, separating pure DSR (Difficulty, Stability, Retrievability) calculations from database persistence and API orchestration.

### A. Ratings & Quality Mapping

The application's 4-point recall scale maps to FSRS grades $G \in \{1, 2, 3, 4\}$:

| Application Rating | FSRS Grade $G$ | Memory Impact | Target State Transition |
|---|---|---|---|
| `again` | **1** | Memory lapse | $\to$ `learning` (first review) or `relearning` |
| `hard` | **2** | Recalled with difficulty | $\to$ `review` (applies Hard penalty $w_{15} = 0.6014$) |
| `good` | **3** | Successful recall | $\to$ `review` (standard stability expansion) |
| `easy` | **4** | Effortless recall | $\to$ `review` (applies Easy bonus $w_{16} = 1.8729$) |

### B. Canonical 21-Element Parameter Weights ($w_0$ to $w_{20}$)

```python
FSRS6_DEFAULT_PARAMETERS = (
    0.212,   # w[0]:  S0(Again)
    1.2931,  # w[1]:  S0(Hard)
    2.3065,  # w[2]:  S0(Good)
    8.2956,  # w[3]:  S0(Easy)
    6.4133,  # w[4]:  D0 baseline
    0.8334,  # w[5]:  D0 grade scale
    3.0194,  # w[6]:  Delta D scale (linear damping)
    0.001,   # w[7]:  D mean-reversion pull toward D0(4)
    1.8722,  # w[8]:  S recall base multiplier exponent
    0.1666,  # w[9]:  S recall stability decay exponent
    0.796,   # w[10]: S recall retrievability factor exponent
    1.4835,  # w[11]: S forget base scale
    0.0614,  # w[12]: S forget difficulty exponent
    0.2629,  # w[13]: S forget stability exponent
    1.6483,  # w[14]: S forget retrievability factor exponent
    0.6014,  # w[15]: S recall Hard multiplier (< 1.0)
    1.8729,  # w[16]: S recall Easy multiplier (> 1.0)
    0.5425,  # w[17]: Same-day review base scale
    0.0912,  # w[18]: Same-day review grade shift
    0.0658,  # w[19]: Same-day review stability decay exponent
    0.1542,  # w[20]: Forgetting curve decay parameter
)
```

### C. Core Equations

1. **Initial Memory State (First Review)**:
   - Initial Stability:
     $$S_0(G) = w_{G-1}$$
   - Initial Difficulty:
     $$D_0(G) = \text{clamp}(1.0, 10.0, w_4 - e^{w_5 \cdot (G - 1)} + 1.0)$$

2. **Forgetting Curve & Retrievability $R(t, S)$**:
   $$decay = -w_{20} = -0.1542$$
   $$factor = 0.9^{1 / decay} - 1 = 0.9^{-1 / w_{20}} - 1 \approx 0.9774$$
   $$R(t, S) = \left(1.0 + factor \cdot \frac{t}{S}\right)^{decay}$$
   *(Guarantees $R(0, S) = 1.0$ and $R(S, S) = 0.90$ exactly).*

3. **Difficulty Update**:
   $$\Delta D = -w_6 \cdot (G - 3)$$
   $$D' = D + \Delta D \cdot \frac{10.0 - D}{9.0}$$
   $$D'' = w_7 \cdot D_0(4) + (1.0 - w_7) \cdot D'$$
   $$D_{\text{new}} = \text{clamp}(1.0, 10.0, D'')$$

4. **Stability Update**:
   - **Same-Day Review ($t < 1.0$ days)**:
     $$S' = S \cdot e^{w_{17} \cdot (G - 3 + w_{18})} \cdot S^{-w_{19}}$$
     $$S_{\text{new}} = \max(S, S') \text{ if } G \ge 2 \text{ else } \min(S, \max(0.001, S'))$$
   - **Standard Recall ($t \ge 1.0$ days, $G \ge 2$)**:
     $$hard\_factor = w_{15} \text{ if } G == 2 \text{ else } 1.0$$
     $$easy\_factor = w_{16} \text{ if } G == 4 \text{ else } 1.0$$
     $$SInc = 1.0 + e^{w_8} \cdot (11.0 - D) \cdot S^{-w_9} \cdot \left(e^{w_{10} \cdot (1.0 - R)} - 1.0\right) \cdot hard\_factor \cdot easy\_factor$$
     $$S_{\text{new}} = \max(S, S \cdot SInc)$$
   - **Standard Lapse ($t \ge 1.0$ days, $G == 1$, `again`)**:
     $$S'_f = w_{11} \cdot D^{-w_{12}} \cdot \left((S + 1.0)^{w_{13}} - 1.0\right) \cdot e^{w_{14} \cdot (1.0 - R)}$$
     $$S_{\text{new}} = \min(S, \max(0.001, S'_f))$$

5. **Interval Calculation**:
   $$I(r, S) = \frac{S}{factor} \cdot \left(r^{1 / decay} - 1.0\right)$$
   For target desired retention $r = 0.90$, $I = S$.
   Bounded by maximum interval (36,500 days) and rounded to integer days via `ROUND_HALF_UP`. Lapses default to 1 day.

---

## 2. Card States and State Transition Lifecycle

- `new`: Card unstudied ($S=\text{None}, D=\text{None}$).
  - Rating `again` $\to$ transitions to `learning`, $S_0 = 0.212$, $I = 1\text{d}$.
  - Rating $\ge \text{hard}$ $\to$ transitions to `review`, $S_0 = w_{G-1}$, $I = \text{round}(S_0)\text{d}$.
- `review`: Card under active spaced repetition.
  - Rating $\ge \text{hard}$ $\to$ remains in `review`, $S$ expands via $S'_r$.
  - Rating `again` $\to$ transitions to `relearning`, $S$ drops via $S'_f$, $I = 1\text{d}$, lapses += 1.
- `relearning`: Card recovering from lapse.
  - Rating `again` $\to$ remains in `relearning`.
  - Rating $\ge \text{hard}$ $\to$ returns to `review`, repetitions = 1.

---

## 3. System Integration & State Isolation

1. **Algorithm Registry (`registry.py`)**:
   - `FSRS6Scheduler` is registered under `algorithm="fsrs6"`, `implementation_version="fsrs-6-reference-v1"`, `configuration_version=1`.
   - `registry.list_available()` returns `["fsrs6", "sm2"]`. Both algorithms operate independently.
   - FIFAKT remains strictly unregistered and unavailable (`503 algorithm_unavailable`).
2. **Persistence Isolation**:
   - Independent `SchedulerConfiguration` record created with full 21 weights.
   - Cards scheduled under SM-2 cannot be mutated or overwritten by FSRS-6 without explicit conflict error (`409 algorithm_conflict`).
   - Duplicate review submissions safely replay without state inflation.
   - Out-of-order review timestamps are rejected (`422 out_of_order_review`).
3. **Mobile Client Integration**:
   - Supported in `apps/mobile/src/services/api/reviews.ts` (`dueReviews('fsrs6')`, `submitReview(..., 'fsrs6')`).

---

## 4. Verification Evidence

| Test Suite / Check | Result | Details |
|---|---|---|
| FSRS-6 Unit & Service Tests ([`test_fsrs6.py`](file:///C:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/tests/test_fsrs6.py)) | **12 passed, 0 failed** | Tests DSR model equations, initial ratings (Again, Hard, Good, Easy), retrievability at $t=S$ equals 0.90, recall stability growth, Hard penalty, Easy bonus, lapse and relearning transition, same-day reviews, out-of-order validation, and SM-2 state isolation. |
| SM-2 Tests ([`test_sm2.py`](file:///C:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/tests/test_sm2.py)) | **14 passed, 0 failed** | SM-2 baseline unchanged and green. |
| Spaced Repetition Foundation Tests ([`test_spaced_repetition_foundation.py`](file:///C:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/tests/test_spaced_repetition_foundation.py)) | **4 passed, 0 failed** | Interfaces and event schemas green. |
| Backend Pytest Regression (Sections 23, 26, 27, 28, 29, 30) | **50 passed, 0 failed** | Full backward compatibility and zero regressions across all sections. |
| Node Client Test Suites (`node --test`) | **22 passed, 0 failed** | Client tests passing including `reviews.test.mjs`, `materials.test.mjs`, `pathways.test.mjs`, `progress.test.mjs`, and `communications.test.mjs`. |
| Mobile TypeScript Check (`npm run typecheck`) | **0 errors, clean exit** | Full mobile application typechecks cleanly. |
| Database Head Integrity | **63 tables preserved** | Head remains `0013_learning_focus`. Zero schema drift. |

---

## 5. Modified and Created Files

- **Created:**
  - `services/api/app/modules/spaced_repetition/fsrs6.py`: Pure calculation functions and `FSRS6Scheduler(BaseScheduler)`.
  - `services/api/tests/test_fsrs6.py`: Test suite for FSRS-6 equations, transitions, and isolation.
  - `docs/SECTION_30_REPORT.md`: This report.
- **Modified:**
  - `services/api/app/modules/spaced_repetition/registry.py`: Registered `fsrs6` scheduler in `register_default_schedulers`.
  - `services/api/app/modules/spaced_repetition/__init__.py`: Exported FSRS-6 abstractions.
  - `services/api/tests/test_sm2.py`: Updated registry checks to reflect FSRS-6 availability while keeping FIFAKT deferred.
  - `scripts/reviews.test.mjs`: Added client tests for FSRS-6 queries.
  - `docs/VOCABULARY.md`: Updated scheduler boundary documentation with Section 30 status.
  - `docs/AI_INTEGRATION_PLAN.md`: Updated Section 30 status.

---

## 6. Limitations & Section 31 Prerequisites

1. **Future ESR / FIFAKT**: FIFAKT integration and knowledge-tracing fusion remain strictly deferred to Section 31.
2. **Audio/Pronunciation**: Tagalog pronunciation modeling remains separate from flashcard memory stability.
3. **Parameter Optimization**: Personalized parameter fitting from large review histories requires Section 31/research tooling; default 21 parameters remain active.
