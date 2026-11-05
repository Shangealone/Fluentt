# Evidence still required for a live format-aware model

The public development model predicts observed session-recall proportions. It must not be relabeled `future-recall-probability-v1` merely to pass app readiness checks.

Before preparing a live model, establish permission for a separate development cohort with actual multiple-choice and typed-recall encounters. No recordings, production answers or formal intervention outcomes are collected by this training task. Participant consent/guardian/site requirements, access controls and retention must be approved before collection; the current study-workflow blocker remains intact.

Required evidence includes:

- Coded participant identity and development split ownership; no ordinary user identifiers in research tables or training exports.
- Stable vocabulary ID, content version, language and word/semantic mapping; permitted embedding artifacts with hashes and attribution if used.
- Actual observed question format, question presentation timestamp, finalized objective response and correctness, with immutable provenance. Self-reported Again/Hard/Good/Easy is a separate variable, not a fabricated objective label.
- Item/practice availability, earlier finalized same-pool history and its exact cutoff; distinguish true first encounters from truncated histories. Same-time and after-cutoff encounters cannot appear as past history.
- Actual future encounter time, format and independently observed outcome. Target horizon must be explicitly defined in days and match the baseline scheduling horizon requested at inference. Unobserved or withdrawn follow-up is missing, not failure or a synthetic positive.
- Participant-disjoint development/calibration/test allocation, all normalization/mappings fit within training, and a documented OOV policy. Formal intervention outcomes cannot become a development/calibration set without a separately approved design.

Validation must address actual language/format/history coverage, causal input fidelity, future-horizon calibration, simple and appropriate baselines, learner-cluster uncertainty, inference coverage/latency and final scheduling divergence. Prespecify readiness criteria before held-out evaluation. Predictive performance alone does not establish a vocabulary-retention treatment benefit.

The appropriate next product/research decision is to obtain a permitted format-aware development dataset or approve an explicitly limited public-data demonstration contract. A contract change would need a versioned scheduler/model decision and truthful learner/research labeling; this task does not make that change.
