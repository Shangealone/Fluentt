# Track 1 FSRS-6 control workflow validation

2026-11-05. Real existing scheduler used in synthetic PostgreSQL execution; not a learning-effect validation.

Adapter: app/modules/parallel_study/workflow_engine.py calls the unchanged app/modules/spaced_repetition/fsrs6.py calculate_fsrs6(current_state, effective_rating, server_review_time, revision=...). No SM-2 route, retraining, interval approximation or scoring fallback. Scheduler identity fsrs-6-reference-v1/configuration 1 and its existing weights/retention/max interval are frozen in test setup. A changed identity fails closed before another control calculation.

Memory key: immutable allocation + vocabulary item UUID + content version. New states start empty/due at first opportunity. Protocol and row locks serialize updates; each successful review advances one revision. Attempt outcomes preserve the response, correctness, raw recall rating, effective rating, content version, previous/resulting intervals, due time and scheduler configuration. The existing returned retrievability is recorded explicitly as FSRS pre-review retrievability, not observed recall or a FIFAKT prediction.

A deterministic PostgreSQL journey compares the first stored state/due/revision directly with calculate_fsrs6 at the identical timestamp/rating. A second-review test starts from retained prior state and verifies the next exact decision; a wrong objective answer plus subjective easy must use effective again while retaining both values. Replayed finalization does not reschedule. Frozen/final database guards and concurrent submissions prevent duplicate application.

Experimental assignments can receive assessments but cannot start learning activities, mutate their memory, or obtain falsely labeled FSRS-plus-FIFAKT treatment. Legacy/counterbalanced and Personal memory tables and all scheduler calculations are unchanged.

Existing pure FSRS/FIFAKT/research-boundary regressions and new transactional workflow tests were executed; exact counts/commands are in CLASS_LEARNING_TEST_RESULTS.md. These establish implementation behavior only, not academic effectiveness, optimal parameters, equivalence of assessment forms or validated FIFAKT readiness.
