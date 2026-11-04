# ESR readiness audit

Date: 2026-11-02

Follow-up: the user subsequently selected concurrent counterbalanced vocabulary pools: each learner uses both schedulers during the same period, with scheduler-to-pool assignments reversed between allocation groups. This resolves the design choice flagged below; the PDF still needs corresponding revisions. See `docs/superpowers/specs/2026-11-02-esr-counterbalanced-design.md` for the confirmed mapping, upstream FIFAKT feasibility findings, and remaining design decisions.

## Purpose and evidence limits

Source inspection for the proposed FSRS-6 + FIFAKT Enhanced Spaced Repetition mechanism in the user's `C:/Users/user/Downloads/FLUENTT.pdf` (117 PDF pages). Relevant printed pages: 12-13, 54-55, 69-70, 87-88, and 111-113.

This audit inspected current application source, models, existing tests, and documentation. It did not run tests, connect to the database, count production records, validate model accuracy, change application behavior, or enroll/allocate participants. Existing uncommitted application changes were preserved. Code presence does not establish deployment or research readiness.

## Finding

Fluentt has reusable scheduling and storage foundations, but does not yet implement the PDF's research-ready ESR workflow. The installed FIFAKT provider is an explicitly simulated heuristic. Research condition identifiers and configuration still use an SM-2 control. Publishing curriculum editions does not establish a vocabulary-review pool or initialize learner review schedules.

## Existing foundation and gaps

| Area | Evidence in current source | Gap against the PDF |
| --- | --- | --- |
| FSRS-6 | `services/api/app/modules/spaced_repetition/fsrs6.py`: 21 weights, DSR calculations, four recall ratings, same-day calculations, interval and state output | Reusable candidate baseline. Independent reference alignment and the exact frozen research configuration still need verification. Do not rely on old documents claiming a 17-parameter model. |
| FIFAKT | `spaced_repetition/fifakt_model.py`: `SimulatedFIFAKTModel`, `fifakt-simulated-v1`, deterministic heuristic, `is_simulated=True` | No trained, calibrated FIFAKT inference is established by this adapter. An actual implementation/checkpoint, data provenance, input contract, and validation are required. |
| Hybrid | `spaced_repetition/fifakt.py`: adjusts FSRS-derived stability with a clamped multiplier; adjusted stability is persisted | The PDF proposes adjusting the baseline interval. Persistently changing stability affects subsequent reviews and is not equivalent to adjusting only the current interval. This requires an explicit versioned choice. |
| Features | `spaced_repetition/fifakt_features.py`: per-card aggregates, rating, duration, elapsed time, difficulty/stability; historical extraction excludes events at/after its cutoff | Current inference receives an aggregate vector, not the full format-aware interaction sequence described in the PDF. No question-format field is present in this feature vector. |
| Real item identity | Pure ESR function accepts vocabulary ID/version, but defaults to a random UUID and version 1; `BaseScheduler.compute_next_review` does not carry those arguments | Pass actual pinned item/version and study context into inference. A generated UUID cannot establish content provenance. |
| Vocabulary | `models/learning.py`: `VocabularyItem` has lesson, language, term, meaning, version, lock | Need an approved vocabulary authoring/import and publication/pool association. Search found no `VocabularyItem(...)` creation in application modules. Database contents were not inspected. |
| Flashcards | `docs/VOCABULARY.md`: QuestionRevision cue/private back, subjective recall, separate VocabularyItem identity | No approved revision-to-vocabulary association. Classroom flashcard responses must not silently become review events or objective correctness. |
| State and events | `models/learning.py`: context-scoped state, scheduler configuration, due date, revision, event UUID, duration and state/interval snapshots | Useful storage foundation; need exact study/class/condition/pool provenance and decision diagnostics, plus verified concurrent replay handling. |
| Due retrieval | `spaced_repetition/service.py:get_due_reviews` reads existing due state rows | There is no new-item queue in this function. A learner with no initialized state has no due items here. Returned `total_due` is the limited batch length, not an unbounded total. |
| Mobile | `apps/mobile/src/services/api/reviews.ts` defines due/event access, defaulting to `sm2` | Search found no consumers outside this API module and no dedicated review/vocabulary route under `src/app`. An actual learner review flow remains to be connected. |
| Research control | `models/research.py:ResearchGroup` allows `sm2_control` / `esr_experimental`; research services resolve control to `sm2` | The PDF requires standalone FSRS-6 versus FSRS-6 + FIFAKT. This needs a versioned migration and configuration path, preserving historical SM-2 records. |
| Research readiness | `research/classroom_service.py` rejects simulated ESR and offers only recognized SM-2 configurations as selectable | Existing blockers accurately reflect the unavailable treatment, but the supported control must be revised for the new protocol. |
| Execution guard | `research/execution_guard.py` blocks managed Research Classroom participation/reviews | Keep this guard until the new workflow is approved and implemented. Registered algorithms are not evidence of permission to execute a study. |
| Personal history | Separate `personal_history` module and personal activity records | Saved activity entries do not supply the item-level rated/timed review history required for scheduling or training. |

Paths abbreviated as `spaced_repetition/...` and `research/...` above are beneath `services/api/app/modules/`.

## Material differences in the installed hybrid

The current simulated rule is:

```text
reference = current FSRS retrievability
factor = clamp(0.80, 1.25, 1 + 0.50 * (simulated_prediction - reference))
adjusted_stability = baseline_stability * factor
interval = FSRS interval formula(adjusted_stability)
```

The adjusted stability becomes the next persisted memory state. Lapses have additional handling, including a one-day interval. These constants and behavior are existing simulation choices, not parameters approved by the supplied PDF.

The PDF instead leaves the reference probability, transformation, adjustment strength, bounds, rounding, and prediction horizon to development and a frozen specification. Its four-days-times-0.75 example is illustrative only. Copying that example into production would not finish the design.

Inference exceptions currently set a fallback flag and use the FSRS reference. The audit did not establish exact fallback equivalence for every state/rating; that requires comparison against the standalone baseline. The model output's own fallback/uncertainty metadata is not used as an acceptance gate by the inspected fusion logic. Sparse-history fallback is not implemented as a minimum-history gate there.

## Research and content boundaries to establish

1. **Resolve the protocol contradiction.** Printed page 13 describes counterbalanced exposure to both conditions; printed pages 69-70 describe independent parallel groups. Neither should be silently selected by a code change. Existing two-group storage does not settle the scientific decision.
2. **Define review evidence.** The PDF describes correctness and interaction time. Existing review input is subjective `again/hard/good/easy` plus client-supplied time/duration. Decide whether study reviews use self-ratings, objectively checked recall, or an approved mapping. Preserve raw evidence and distinguish it from scores or grades.
3. **Pin an eligible vocabulary pool.** Bind vocabulary item/version to approved lesson/material provenance and the study's common pool. General question-bank publication and ordinary lesson reading are separate activities.
4. **Scope experimental histories explicitly.** Personal and classroom contexts already exist, and research contexts use coded participant IDs. However the legacy research resolver chooses a user link/latest assignment without an explicit study restriction. The context model alone does not prove multi-study/class/condition isolation. The router's managed-study guard is therefore important.
5. **Use server-authoritative access and time.** Review intake currently checks vocabulary existence but does not establish its membership in an authorized published pool. Harden role/class/owner/consent eligibility, timestamp validation, event ownership/body identity, duplicate concurrency, and initial-state races before real participant use. These are source-review gaps, not results of security or concurrency testing.
6. **Define the study calendar.** The inspected scheduler adds whole-day timedeltas. The shared approved weekday rule, timezone, rounding, holidays, missed sessions, and raw-versus-final due dates need explicit implementation.

## Model preparation still required

- Identify the original FIFAKT implementation, its license, exact architecture, checkpoint or reproducible training process, and version/hash.
- Identify permitted training/development data separately from experimental outcomes. Do not assume 15 experimental learners supply an adequate training dataset.
- Map input format, language/item features, timing, labels, and unseen learner/item handling to Fluentt's real records.
- Define whether prediction concerns the next interaction or recall at a specified future horizon. Do not substitute one for the other without calibration evidence.
- Specify minimum history, initialization, state update versus parameter retraining, invalid output handling, uncertainty acceptance, and exact fallback conditions.
- Select and freeze the adjustment rule with development data before formal recruitment. Retain provenance for every model and configuration.

## Decision logging required by the PDF

For each review, retain or reproducibly derive: coded participant and study/class/condition, content/pool version, event/retry identity, input history cutoff, scheduler/configuration version, model/checkpoint version, FSRS baseline interval, prediction and reference, factor, adjusted interval, raw due date, calendar-adjusted due date, fallback status/reason, and committed state revision.

Existing previous/resulting state JSON and configuration references provide part of this foundation. They are not yet a complete, enforced research decision record.

Before formal use, quantify non-fallback coverage, effective due-date divergence after calendar/rounding, adjustment magnitude, time to first usable prediction, and fallback reasons. Define readiness criteria before evaluating the pilot. Technical divergence does not establish improved retention.

## Suggested order after the audit

1. Resolve the parallel-group/counterbalanced protocol and review-evidence decisions; record FSRS-6 as the new control without rewriting SM-2 history.
2. Establish the vocabulary pool and model/data feasibility, including a real FIFAKT implementation and its input/prediction contract.
3. Specify the versioned hybrid, fallback, study isolation, calendar, replay, and decision-log contracts.
4. Implement and verify the isolated backend pipeline, then connect a dedicated learner review presentation.
5. Run a technical feasibility pilot and freeze the evaluated configuration before formal participant recruitment.

This is a readiness map, not approval to activate the study or a claim that an implementation has passed checks.

## Documentation reconciliation

`docs/SECTION_39_REPORT.md` and `docs/THESIS_TECHNICAL_EVIDENCE.md` contain older claims about a 17-parameter FSRS-6, fully verified FIFAKT, and three-arm allocation. Those claims conflict with inspected source and/or this PDF. Later `SECTION_38B_06_REPORT.md` and `SECTION_38B_FINAL_REPORT.md` already identify simulated ESR and research readiness gaps. Preserve historical reports, but use this dated audit and current source when preparing the new specification; do not reuse old verification claims as evidence.

Existing test files identified include `test_fsrs6.py`, `test_fifakt.py`, and the research execution-guard/setup suites; the FIFAKT suite's imports and stated scope were inspected. Tests were not run during this audit. Simulation/unit mechanics are distinct from trained-model validity, PostgreSQL concurrency, and human retention outcomes.
