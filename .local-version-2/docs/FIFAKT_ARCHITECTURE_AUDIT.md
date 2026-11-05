# FIFAKT architecture audit
2026-11-05. Overall PARTIAL; live use BLOCKED.

Read VERSION5_COMBINATION.md and ESR_DEVELOPMENT_VALIDATION.md, then inspected actual FSRS, model/preprocessing, checkpoint, mappings, review service, inference contract, schemas, migration and tests. Existing uncommitted development work was preserved.

| Component | Verified implementation | Status |
|---|---|---|
| FSRS | spaced_repetition/fsrs6.py, existing Difficulty/Stability/power-law retrievability and interval calculation | PASS implementation regression; no new scientific verification |
| Development model | training/esr/public_pilot_model.py: 32/16 learned embeddings, batch-first LSTM hidden 32, masked candidate attention, last hidden state, six numeric features | PARTIAL FIFAKT-derived |
| Temporal/history features | development_data.py and public_pilot_worker.batch: strictly earlier same-learner history, counts, observed gaps, training-only mappings/scaler | PASS engineering |
| Format/semantic fidelity | no format embedding; no pretrained semantic vectors; target is session proportion | BLOCKED for intended FLUENTT provider |
| Live predictor | vocabulary_review/inference.py requires future-recall-probability-v1; no default trained provider | BLOCKED |
| Legacy prototype | spaced_repetition/fifakt.py uses simulated model and changes stability | Not the proposed study implementation |
| Study interval fusion | vocabulary_review/scheduler.py preserves baseline memory, changes proposed interval only | PASS tested mechanism; effectiveness unvalidated |

Reference: [authors' source](https://github.com/BoxuanMa/FIFAKT/tree/a03e248141fc32a96dc6fda3bb6ae52be621bb9a). Reduced implementation must retain its FIFAKT-derived label. Safe checkpoint/hash/mapping/finite-weight and synthetic-repeatability checks passed; evidence private-data/esr-shadow/checkpoint-check.json. Original architecture, source and observed dependencies are documented in ESR_DEVELOPMENT_VALIDATION.md.

Database: seven research_private.esr_* tables from migration 0021; head 0025. Service retains immutable answer/decision evidence, per-configuration histories and replay identity. No migration or data change here. No new inference HTTP endpoint or checkpoint loader was installed in the app. Metadata readiness alone cannot establish fidelity/calibration.
