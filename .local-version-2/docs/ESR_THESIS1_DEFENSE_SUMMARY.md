# ESR Thesis 1 defense summary
2026-11-05. Current claim: proposed, safely testable ESR prototype with preliminary development evidence; participant intervention BLOCKED.

FLUENTT contains an FSRS-6 scheduler and a proposed bounded interval-fusion layer. A reduced FIFAKT-derived attention/LSTM model was genuinely trained on permitted public Duolingo traces. Its held-out MAE improved over two simple baselines, while the constant baseline slightly outperformed it on RMSE and log loss. This is mixed preliminary evidence, not proof of superiority over FSRS or improved vocabulary retention. The model lacks the formats and future-horizon target required by the intended app predictor.

Completed here: source/checkpoint/data/evaluation audit, dataset alternatives review, immutable saved-metric verification, safe model reload/mapping checks, new write-free offline shadow comparison and regression tests. Conditional further training was not executed because a sufficiently compatible dataset was not established and the prior test outcomes are disclosed.

Proposed mechanism: preserve FSRS memory dynamics, adjust proposed intervals within explicit bounds using a validated future-recall provider, retain provenance and exact FSRS fallback. Synthetic shadow examples demonstrate mechanics only. No student schedules were altered and no live provider was installed.

Testing this task: 147 unit/mock regression tests passed and 4 disposable PostgreSQL tests passed. Initial 7 Tutor failures were missing Groq in the test runtime; pinned Groq 1.7.0/distro/sniffio were installed in an ignored test-only target, then the same full selection passed. The selected API interpreter lacked pip; the existing isolated training installer prepared that target. No shared runtime was modified. Focused Ruff, artifact/hash/arithmetic verification and diff checks passed. Live WavLM/MMS/Groq calls, APK/device acceptance and retention outcomes were not tested; unchanged code plus mocks do not establish current service availability.

Preserved FSRS, vocabulary scheduler/service, Personal Learning, WavLM/MMS, Tutor, UI, migrations and deployment settings. New production-package helper is not routed or wired to a writer. No source credential, large download, training, commit, push or deployment occurred in this task.

Deliverables: FIFAKT_ARCHITECTURE_AUDIT.md, FIFAKT_DATASET_COMPATIBILITY.md, FIFAKT_MODEL_VALIDATION.md, ESR_INTEGRATION_SPECIFICATION.md, ESR_SHADOW_EVALUATION.md, ESR_EXPERIMENT_READINESS.md and this summary. New source: app/modules/vocabulary_review/shadow.py; new tests: tests/test_esr_shadow.py. DECISIONS.md appended. Earlier uncommitted development artifacts are preserved and separate from these changes.

Thesis 2 prerequisites: approve the parallel versus counterbalanced design, obtain permitted format-aware development evidence, build/calibrate the exact target-safe model, validate on a new sealed cohort, finish participant/assessment workflow, run genuine authorized shadow replay, and then execute the approved study. Do not describe proposed integration, synthetic tests or public prediction error as completed learner-effectiveness evidence.
