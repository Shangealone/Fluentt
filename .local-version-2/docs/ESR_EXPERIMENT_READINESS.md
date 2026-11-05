# ESR experiment readiness
2026-11-05. Overall BLOCKED for participant activation.

| Requirement | Outcome | Evidence/remaining work |
|---|---|---|
| Compatible validated model inputs | BLOCKED | observed-session contract lacks required formats/horizon |
| Reproducible loading/inference engineering | PASS | safe local reload, hashes, strict shapes/maps, synthetic repeatability |
| Predictive quality relative to baselines | BLOCKED for intended target | public-data results mixed; no validated app-target results |
| Bounded proposals | PASS engineering | shadow and vocabulary policy regressions |
| Deterministic fallback | PASS | unavailable/invalid/sparse/mismatch/exception tests |
| No leakage | PASS bounded development construction; BLOCKED study pipeline | frozen learner splits and causal-input tests; no approved study data |
| FSRS memory preservation | PASS | unchanged baseline source and exact memory-equality tests |
| Regression protection | PASS automated scope | 147 unit/mock regressions, 4 disposable PostgreSQL checks; live devices/providers not reverified |
| Model/policy decision identity | PASS prototype | trace carries model version/hash and existing policy version |
| Participant approvals/full workflow | BLOCKED | consent/enrollment/withdrawal/pool-linked assessments incomplete |
| Experimental design alignment | BLOCKED | existing esr-counterbalanced-v1 differs from new parallel 15/15 arms |

New prompt describes 30 students in parallel 15/15 arms, classroom-only, one calendar month weekdays, 5–10 minutes/day, pretest/immediate posttest/seven-day delayed test. Existing version-5 design assigns both conditions to disjoint pools within participants using counterbalanced mappings. These are different designs. Do not silently repurpose allocations/configurations. Before implementation, adviser/client must approve a new versioned parallel-group protocol, assignment unit/method, comparable vocabulary/tasks/opportunities, dated calendar and holiday handling, fixed stopping rules and missed-session policy, test equivalence and analysis plan. Session duration is a planned burden, not an invented enforcement rule.

Thirty participants is a planned sample, not evidence of statistical power. A justified power/precision analysis, baseline covariates, allocation concealment, contamination safeguards and missing/withdrawn data handling remain necessary. Choose and freeze numerical performance/calibration thresholds using development data and baseline evidence before a fresh final test; do not invent academic thresholds or improve them after seeing outcomes. Separate model development from formal experimental outcomes.

Complete participant protection/guardian/site/ethics requirements, retention/access policy, target-safe model, held-out validation, calendar-horizon contract and genuine offline shadow replay before any operator-controlled activation. No allocations, approvals or participant records were changed.
