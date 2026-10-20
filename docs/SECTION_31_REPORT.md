# Section 31 — FIFAKT and Enhanced Spaced Repetition (ESR)

Implemented and verified October 19, 2026. Section 30 is accepted by the supplied Section 31 context. Head remains `0013_learning_focus` with 63 domain tables preserved (reusing `model_versions`, `model_configurations`, `scheduler_configurations`, `vocabulary_review_states`, `vocabulary_review_events`, and `learning_contexts`). No automatic commit or push. **A genuine, reproducible FIFAKT feature extraction pipeline and Enhanced Spaced Repetition (ESR) scheduling engine are integrated through the Section 28 scheduler interface, with independent algorithm identity, persistent per-learner/card state, and verified isolation from SM-2 and FSRS-6.**

---

## 1. FIFAKT Interpretation, Reference Alignment & Model Provenance

### A. Architectural Definition: Hybrid Knowledge-Tracing Scheduler
In the FLUENTT system architecture and research methodology:
- **FIFAKT** stands for **Feature-Informed / Factorized Interaction / Forgetting-Aware Knowledge Tracing**. It models latent learner mastery and retrievability from temporal interaction sequences (elapsed intervals, response durations, recall ratings, consecutive successes, and cumulative lapses).
- **ESR (Enhanced Spaced Repetition)** is the hybrid learning engine combining:
  1. **Memory Foundation**: FSRS-6 Difficulty-Stability-Retrievability (DSR) core dynamics.
  2. **Knowledge Tracing Overlay**: FIFAKT feature-informed retrievability ($\hat{p}$) and mastery predictions.
  3. **ESR Fusion Engine**: Mathematically bounded stability adjustment rule linking knowledge-tracing predictions to interval expansion while strictly enforcing lapse safety invariants.

### B. Scientific Integrity & Model Provenance Notice
Per repository instructions (`AGENTS.md`, `docs/AI_INTEGRATION_PLAN.md`, `docs/DECISIONS.md`, and `PROJECT_HANDOFF.md`):
- **No pre-trained model weights, empirical training datasets, or calibrated hyperparameter checkpoints** currently exist in this repository.
- As required by the Section 31 specification, **no claim is made that FIFAKT has been pre-trained or that empirical retention improvement has been achieved**.
- The model adapter is implemented as an explicitly labeled, approval-dependent reference adapter (`fifakt-simulated-v1`) with:
  - `simulated: True` explicitly recorded on model outputs, `ModelVersion`, `ModelConfiguration`, and in `VocabularyReviewEvent.simulated`.
  - Outputs are deterministic, bounded, and reproduce cognitive decay dynamics without making false claims of DepEd endorsement, clinical calibration, or empirical accuracy.

---

## 2. Knowledge Tracing Feature Extraction Pipeline

Implemented in [`services/api/app/modules/spaced_repetition/fifakt_features.py`](file:///C:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/app/modules/spaced_repetition/fifakt_features.py):

### A. Feature Vector Specification (`FIFAKTFeatureVector`)
- `vocabulary_item_id: UUID`: Stable card/term reference.
- `content_version: int`: Version of curriculum item (default 1).
- `total_reviews: int`: Cumulative prior review interactions ($N \ge 0$).
- `total_lapses: int`: Cumulative lapses where rating was `'again'` ($L \ge 0$).
- `consecutive_successes: int`: Unbroken sequence of successful recalls preceding this interaction.
- `prior_success_rate: float`: Historical accuracy $\frac{N - L}{N} \in [0.0, 1.0]$.
- `elapsed_seconds: float`: Wall-clock seconds since immediate prior review.
- `avg_response_duration_ms: float`: Historical mean response latency.
- `current_response_duration_ms: int`: Latency of current response ($0 \le \text{ms} \le 300,000$).
- `last_rating: ReviewRating | None`: Immediate prior recall rating.
- `current_rating: ReviewRating`: Submitted rating (`again`, `hard`, `good`, `easy`).
- `card_difficulty: float`: Baseline difficulty $D \in [1.0, 10.0]$.
- `card_stability: float`: Baseline memory stability $S \ge 0.001$.

### B. Strict Future-Data Leakage Prevention
`extract_features_from_event_history(events, as_of, ...)` strictly filters out any event where `reviewed_at >= as_of`. Events occurring at or after the evaluation point are inaccessible, ensuring zero lookahead leakage during feature extraction. Events are deterministically sorted by `(reviewed_at, state_revision)`.

---

## 3. Enhanced Spaced Repetition (ESR) Mathematical Formulation

Implemented in [`services/api/app/modules/spaced_repetition/fifakt.py`](file:///C:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/app/modules/spaced_repetition/fifakt.py):

### A. Baseline Memory State (FSRS-6 Core)
Base difficulty $D_{\text{base}}$ and base stability $S_{\text{base}}$ are calculated using canonical FSRS-6 formulas:
- Power forgetting curve retrievability:
  $$R_{\text{fsrs}}(t, S) = \left(1.0 + \text{factor} \cdot \frac{t}{S}\right)^{-0.1542}$$

### B. FIFAKT Inference Output
The model evaluates features and predicts:
- $\hat{p} = \text{predicted\_retrievability} \in [0.01, 0.99]$
- Latent mastery $m \in [0.01, 0.99]$
- Uncertainty $u \in [0.05, 1.00]$

### C. ESR Stability Fusion Rule
1. **Retrievability Discrepancy**:
   $$\Delta = \hat{p} - R_{\text{fsrs}}$$
2. **Raw Multiplier**:
   $$\alpha = 1.0 + \kappa \cdot \Delta \quad (\kappa = 0.50)$$
3. **Safety Clamping**:
   $$\alpha_{\text{clamped}} = \text{clamp}(0.80, 1.25, \alpha)$$
4. **Lapse Invariant**:
   If rating is `'again'` (grade 1 lapse):
   $$\alpha_{\text{eff}} = \min(1.0, \alpha_{\text{clamped}})$$
   $$S_{\text{esr}} = \max(0.001, S_{\text{base}} \cdot \alpha_{\text{eff}})$$
   $$\text{Interval} = 1\text{ day (strict reset)}$$
   *(Ensures a lapse NEVER expands stability, preserving educational safety).*
5. **Successful Recall**:
   For ratings `'hard'`, `'good'`, `'easy'`:
   $$S_{\text{esr}} = \max(0.001, \min(36500.0, S_{\text{base}} \cdot \alpha_{\text{clamped}}))$$
   $$I = \text{round\_half\_up}(S_{\text{esr}})$$

### D. Safe Degradation / Fallback
If model inference throws an exception or fails, ESR catches the error and safely sets $\alpha = 1.0$ ($S_{\text{esr}} = S_{\text{base}}$), recording `fallback_to_base: True` in the decision state without crashing or corrupting card progress.

---

## 4. System Integration & State Isolation

1. **Algorithm Registry (`registry.py`)**:
   - `ESRScheduler` is registered under `algorithm="fifakt"`, `implementation_version="fifakt-esr-v1"`, `configuration_version=1`.
   - `registry.list_available()` returns `["fifakt", "fsrs6", "sm2"]`.
   - Case-insensitive lookups (`registry.is_available("FIFAKT")`) supported.
2. **Database & Entity Linkage (`service.py`)**:
   - `SchedulerConfiguration` created with `algorithm="fifakt"`.
   - Automatically links `ModelVersion` (`task="knowledge_tracing"`, `model_name="fifakt"`, `version="fifakt-simulated-v1"`, `simulated=True`) and `ModelConfiguration` via `model_configuration_id`.
   - `VocabularyReviewEvent.simulated` is set to `True` for FIFAKT events.
3. **State Isolation**:
   - Cross-algorithm mutation is rejected: cards reviewed under `sm2` or `fsrs6` cannot be updated under `fifakt` without `409 algorithm_conflict`.
   - Monotonic timestamps enforced: out-of-order reviews raise `422 out_of_order_review`.
   - Duplicate submissions replay idempotently (`"status": "replayed"`).
4. **Mobile Client Integration**:
   - Verified via `apps/mobile/src/services/api/reviews.ts` (`dueReviews('fifakt')`, `submitReview(..., 'fifakt')`).
   - Covered in Node client test suite.

---

## 5. Verification Evidence

| Test Suite / Verification Area | Result | Details |
|---|---|---|
| FIFAKT & ESR Tests ([`test_fifakt.py`](file:///C:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/tests/test_fifakt.py)) | **16 passed, 0 failed** | Feature extraction, chronological sorting, strict future-data leakage prevention, missing-data handling, model inference bounds, uncertainty decay, ESR fusion adjustment bounds $[0.80, 1.25]$, lapse invariant ($\alpha_{\text{eff}} \le 1.0$, interval $= 1\text{d}$), safe fallback on error, registry coexistence, and service-level state isolation. |
| FSRS-6 Tests ([`test_fsrs6.py`](file:///C:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/tests/test_fsrs6.py)) | **12 passed, 0 failed** | FSRS-6 DSR model calculations unchanged and green. |
| SM-2 Tests ([`test_sm2.py`](file:///C:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/tests/test_sm2.py)) | **14 passed, 0 failed** | SM-2 baseline unchanged and green. |
| Spaced Repetition Foundation Tests ([`test_spaced_repetition_foundation.py`](file:///C:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/tests/test_spaced_repetition_foundation.py)) | **4 passed, 0 failed** | Shared scheduler interfaces and schemas green. |
| Curriculum & Pathway Tests ([`test_materials_and_notifications.py`](file:///C:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/tests/test_materials_and_notifications.py), [`test_pathway.py`](file:///C:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/tests/test_pathway.py)) | **4 passed, 0 failed** | Full backward compatibility and zero regressions across earlier sections. |
| **Total Backend Pytest Suite** | **50 passed, 0 failed** | Complete clean run across Sections 23, 26, 27, 28, 29, 30, and 31. |
| Node Client Test Suite (`scripts/reviews.test.mjs`) | **3 passed, 0 failed** | Client testing `reviewsAccess` handling `fifakt`, `fsrs6`, and `sm2`. |
| Mobile TypeScript Check (`npm run typecheck`) | **0 errors, clean exit** | Full mobile TypeScript codebase compiles cleanly. |
| Database Head Integrity | **63 tables preserved** | Head remains `0013_learning_focus`. Zero schema drift. |

---

## 6. Modified and Created Files

- **Created:**
  - `services/api/app/modules/spaced_repetition/fifakt_features.py`: Feature extraction pipeline with leakage guards and sequence sorting.
  - `services/api/app/modules/spaced_repetition/fifakt_model.py`: Typed inference contracts and `SimulatedFIFAKTModel`.
  - `services/api/app/modules/spaced_repetition/fifakt.py`: `calculate_fifakt_esr` and `ESRScheduler(BaseScheduler)`.
  - `services/api/tests/test_fifakt.py`: 16 comprehensive unit and integration tests.
  - `docs/SECTION_31_REPORT.md`: This report.
- **Modified:**
  - `services/api/app/modules/spaced_repetition/__init__.py`: Exported FIFAKT and ESR components.
  - `services/api/app/modules/spaced_repetition/registry.py`: Registered `fifakt` scheduler in `register_default_schedulers`.
  - `services/api/app/modules/spaced_repetition/service.py`: Linked `ModelVersion`/`ModelConfiguration` and recorded `simulated` flag on `VocabularyReviewEvent`.
  - `services/api/tests/test_sm2.py`: Updated registry checks to reflect `fifakt` availability.
  - `services/api/tests/test_fsrs6.py`: Updated registry checks to reflect `fifakt` availability.
  - `scripts/reviews.test.mjs`: Added client tests for `fifakt` review submission and due queries.
  - `docs/VOCABULARY.md`: Updated scheduler boundary documentation with Section 31 status.
  - `docs/AI_INTEGRATION_PLAN.md`: Updated Section 31 implementation status.

---

## 7. Limitations & Section 32 Prerequisites

1. **Empirical Model Calibration**: No neural weights or calibrated parameters exist in the repository; `fifakt-simulated-v1` operates as an uncalibrated reference adapter. Empirical model training requires an approved dataset and training pipeline in future research milestones.
2. **Speech & Audio Pronunciation**: Pronunciation modeling remains strictly isolated from flashcard memory stability and vocabulary retrievability.
3. **Research Consent & Experimental Allocations**: Real participant randomization (`sm2_control` vs `esr_experimental`) requires formal IRB consent/assent protocol activation in dedicated research sections.
