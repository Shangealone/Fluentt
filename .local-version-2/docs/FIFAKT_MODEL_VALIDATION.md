# FIFAKT model validation
2026-11-05. Preliminary development evidence PARTIAL; deployment BLOCKED.

Reverified six artifact hashes, seven executed-source snapshots, saved metric arithmetic and paired learner bootstrap using verify_development_run.py. Safe weights_only loading, strict parameter shapes, contiguous mapping IDs, finite weights/scaler and repeated synthetic-input equality passed. Checkpoint SHA-256: 2d0f81cd16c83c094b82e8d65e3f56c6a4affe3edcd7810a14affc4d640a84e5. It remains research_ready=false, observed-session-recall-proportion-v2. No new training, held-out model selection or real-test inference occurred in this audit.

The historical frozen run used Python 3.12.10/Torch 2.11 CPU, three seeds of 800 steps, training/calibration/selection/test learner separation. Final cohort: 3,211 examples/416 learners. Full evidence and caveats: ESR_DEVELOPMENT_VALIDATION.md and ESR_DEVELOPMENT_VALIDATION_RESULTS.json.

| Predictor | MAE | RMSE | Soft-target log loss | Binned descriptive gap |
|---|---:|---:|---:|---:|
| Calibrated development model | .152486 | .254287 | .332808 | .021264 |
| Raw model | .147394 | .255486 | .339373 | .028691 |
| Constant baseline | .163767 | .254148 | .331957 | .005002 |
| Lexeme mean | .161169 | .258861 | .414171 | .021374 |

Paired learner-bootstrap MAE differences: constant -.011281 [95% -.012419,-.010238]; lexeme mean -.008683 [-.010986,-.006386], 500 fixed-seed replicates. MAE criterion passed, but constant RMSE/log loss/reliability were better. Calibration improved log loss while worsening MAE. Do not retune using these disclosed outcomes.

Soft-target cross entropy is an appropriate loss against observed proportions; it is not binary individual-outcome log-loss validation. ROC AUC was NOT calculated because thresholding proportions would invent binary labels. MAE/RMSE are proportion errors, not accuracy percentages. The binned gap is descriptive, not proof of calibrated future recall. Full-paper fidelity, format/horizon/local-population validation remain BLOCKED. No FSRS recall-rating labels were fabricated for a comparison.
