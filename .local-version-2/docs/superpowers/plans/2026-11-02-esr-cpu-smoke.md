# ESR isolated CPU smoke-test implementation plan

**Goal:** demonstrate a bounded, target-safe learning calculation before spending resources on real training.

**Spec:** `docs/ESR_TRAINING_DATA_ENVIRONMENT_AUDIT.md`, approved next step by the user.

**Architecture:** isolated F: virtual environment; a small batch-first LSTM/attention adaptation with strictly historical encounters and separate candidate features. Tests use only synthetic arrays, with loss labels kept outside prediction. This is a documented engineering adaptation, not faithful paper reproduction, a real FIFAKT checkpoint, or treatment inference.

**Stack:** Python 3.12, official PyTorch CPU 2.8.0 wheel, standard-library unittest. No API dependency changes; no datasets, embeddings or remote services.

- [x] Create separate ignored training environment and record installed versions.
- [x] Write failing tests for finite zero-count preprocessing, invalid inputs, learner isolation/batch permutation, causal prefix/future exclusion, padding behavior, gradient updates and weights-only save/reload.
- [x] Implement bounded encounter preprocessing and explicitly batch-first, past-only model. Record adaptations from the pristine upstream source.
- [x] Run all tests, bounded optimization smoke run, and record timing/memory and runtime/source hashes.
- [x] Independent final source review, document limitations and next real-data stage. No critical or important findings within scope.

## Rulings

- Ruling: keep work in the current checkout and runtime/data files in ignored private-data — existing unrelated progress is preserved; cost if wrong is less change isolation.
- Ruling: CPU-only PyTorch 2.8.0 is a reproducible engineering-test runtime, not the unknown original paper environment — verified official CPU installation route; cost if wrong is a later environment adjustment.
- Ruling: use synthetic engineering fixtures rather than inventing real format-labelled data — tests can establish causal computation only; learned accuracy remains unknown.
- Ruling: execute inline with one independent final source review — already authorized next step; cost if wrong is fewer independent per-task reviews.

No commit, push, real learner data, formal study activation or model-accuracy claim is included.

## Execution ledger

2026-11-02: created isolated F: environment. Official CPU wheel installed successfully; API Torch presence remains false. Tests first failed because smoke_model did not exist, then all seven passed after implementation. A premature import while Torch was still installing failed; no repair or application change was made from that incomplete-install result.

2026-11-02: first bounded run passed all seven tests and twelve real synthetic optimization steps. Recorded approximately 0.135 seconds optimization, 16.37 seconds total and 248,705,024 bytes peak process working set. Results are engineering evidence only. Final source review pending; rerun after any source changes for matching hashes.

Final: independent esr_cpu_smoke_review found no important issues within synthetic-only scope. Final rerun: 7/7 tests, twelve optimization steps, 0.138 seconds optimization, 7.985 seconds total, 248,647,680 bytes peak working set. Source hashes captured externally before the run match the final report/files; checkpoint hash verified. API environment Torch absent; 18 existing pure ESR checks passed unchanged.

Final: minor (deferred): automated pre/post source-change detection inside the runner; final-run verification was performed externally.

Final: minor (deferred): hard process deadlines; existing time budgets are cooperative.
