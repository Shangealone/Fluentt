# ESR shadow evaluation
2026-11-05. Synthetic engineering PASS; genuine held-out scheduling comparison BLOCKED.

Executable pure helper: services/api/app/modules/vocabulary_review/shadow.py. Tests: services/api/tests/test_esr_shadow.py. Saved synthetic trace: private-data/esr-shadow/synthetic-only.json. No actual learner schedule, review, account or DB event was changed.

| Explicitly synthetic case | Baseline days | Proposed days | Reason |
|---|---:|---:|---|
| Fake provider p=.1 | 8 | 6 | accepted synthetic input |
| Fake provider p=1 | 8 | 8 | accepted synthetic input; integer rounding |
| No model | 8 | 8 | model_unavailable |
| Wrong artifact | 8 | 8 | artifact_mismatch |

These are test fixtures, not trained-model predictions or effects on retention. Two of four constructed cases fall back; this is not an operational fallback estimate. Raw elapsed_ms is saved per case but fake-call latency is not real model latency. Both schedules/provenance are stored separately in the offline trace; applied=false throughout.

No genuine public-data shadow run was manufactured: the verified corpus lacks FLUENTT recall ratings, mappings and requested-format/horizon outcomes. Its model probabilities cannot be passed into the live-contract slot. Real model latency and genuine fallback frequency under the correct contract remain BLOCKED. No artificial ratings or invented study records were introduced. Future authorized replay needs compatible event evidence, approved configuration, model manifest and an output sink restricted to coded offline study data.
