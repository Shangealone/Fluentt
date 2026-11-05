# ESR integration specification
2026-11-05. Offline shadow implementation PASS; live integration BLOCKED.

Existing FSRS-6 code remains unchanged. vocabulary_review/scheduler.py computes baseline memory and interval B. Existing proposed interval policy:

factor = clamp(minimum_factor, maximum_factor, 1 + sensitivity * (p - reference_probability)).

For Again, cap factor at 1. Proposed interval = clamp(1,maximum_interval_days,ROUND_HALF_UP(B * factor)); apply the same allowed-weekday/excluded-date calendar to both schedules. Preserve baseline Difficulty/Stability/retrievability state exactly. Calendar displacement is reported separately from the raw integer interval. This is an explicit proposed heuristic: lower predicted recall shortens practice, higher recall may lengthen it. Neither linear response nor numerical bounds are proven optimal. Freeze parameters/version before any approved study; no new defaults or tuning were applied.

New vocabulary_review/shadow.py compares two pure decisions with applied=false. It requires scope-consistent strictly earlier typed history, an actual supported format/candidate, provider contract/version and exact approved artifact hash. History is sorted deterministically; out-of-scope/future/naive-time data reject inference. Sparse history, wrong artifact, unavailable/incompatible provider, exception and nonfinite/out-of-range probability preserve exact baseline interval/due date. Candidate mapping/feature validation remains the future provider's responsibility; this helper cannot certify it.

Provider output retains probability, failure reason, model version/hash; decision retains policy version, baseline/proposed interval/due, unchanged memory and elapsed time. The horizon passed to the provider is the baseline integer interval. FSRS pre-review retrievability and a next-encounter forecast have different temporal meanings; do not interpret their difference as equal-target calibration. Future provider/calendar-horizon semantics require explicit validation.

No router, application startup hook, repository, enrollment, allocation or DB write consumes shadow results. This makes it suitable for isolated developer comparisons, not covert classroom monitoring. Existing study_workflow_unavailable and provider guards remain. Development checkpoint is incompatible and deliberately rejected. Legacy simulated stability fusion is not adopted.
