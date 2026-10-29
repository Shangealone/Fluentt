# Section 38B Prompt 06 - SM-2 vs ESR treatment verification

Date: 2026-10-21, Asia/Manila. Repository: `C:/Users/Shan Gealone/Desktop/Backup/Fluentt`. Branch: `codex/personal-learning-voice-updates`. HEAD: `6e2d7167e7f36e79172852d73c267a5dc84e13e5`.

## Outcome

**Live SM-2 versus ESR Research Classroom treatment integration is BLOCKED.** Prompt 06 explicitly requires this outcome if ESR/FIFAKT is incomplete or methodology undefined. The installed ESR adapter is simulated, no approved treatment/model evidence was supplied, and consent/allocation/content/calendar/measurement prerequisites remain unresolved. No live session, review event, participant allocation, outcome, reminder or adjusted due date was created. No claim of zero existing database records is made: no database was queried.

This slice performs read-only verification, runs existing tests and changes only this report, the persistent progress checklist and decisions. All prior uncommitted implementation/artifacts are preserved. Personal Learning and ordinary classroom code, navigation, algorithms, schedules, configuration and records are untouched. No commit, push, deployment, migration or application/production data operation occurred.

## Sources inspected and approval status

Read reports `SECTION_38B_01_AUDIT.md`, `SECTION_38B_02_REPORT.md`, `SECTION_38B_03_REPORT.md`, `SECTION_38B_05_REPORT.md`, the persistent progress/decisions, repository instructions/architecture, and actual Sections 28-31 reports and scheduler/model/service/schema/test sources. `SECTION_38B_04_REPORT.md` does not exist. Prompt 04 has clarification only, not a verified voluntary enrollment/withdrawal/allocation implementation. Do not infer that it is complete from later prompt numbering.

The user explicitly reported that study-information/data-use and minor/guardian permission materials do not exist yet, and requested 30 students split equally (planned 15/15, conditional on eligibility and voluntary participation). This is not permission, actual consented enrollment, an allocation method, an approved vocabulary blueprint or an approved treatment definition. No approved Chapter 3/model/training/clearance materials were supplied. Repository filename searches found no unignored `.pt`, `.pth`, `.onnx`, `.ckpt` or `.safetensors` model artifacts; this does not inventory external/private storage. The model source itself explicitly identifies the adapter as untrained/uncalibrated simulation.

Historical Sections 28-31 describe mechanics and earlier table/head/test totals. They are not current approval or database evidence. Source remains at the retained additive head 0017 with 70 model tables from prior slices; this task neither applies nor changes migrations.

## Actual algorithm verification

| Component | Verified source and behavior | Research readiness |
| --- | --- | --- |
| SM-2 | `services/api/app/modules/spaced_repetition/sm2.py`; `SM2Scheduler`, `sm2-classic-v1`. Actual deterministic interval/EF/repetition/lapse calculations, app four-rating mapping, tested initial 1/6-day progression and internal rounding/replay/isolation behavior. | Implemented variant; exact reference/control-definition approval unresolved (see below). No shared change. |
| FSRS-6 | `spaced_repetition/fsrs6.py`; independently registered `fsrs6`. Its existing tests pass. | Separate algorithm, not a substitute for the requested approved ESR arm. |
| ESR wrapper | `spaced_repetition/fifakt.py:278,295,300`; `ESRScheduler` defaults to `SimulatedFIFAKTModel`, identity and state report simulated, `is_simulated` always true. It combines FSRS-6 calculations with a heuristic simulated inference/fusion path. | BLOCKED for real approved ESR treatment. Registration and deterministic simulation are insufficient. |
| FIFAKT inference | `spaced_repetition/fifakt_model.py:71`; default version `fifakt-simulated-v1`. Bounded hand-coded mastery/latency/decay heuristics; no supplied trained weights, calibration, external validity or approved scientific specification. | BLOCKED. No fabricated model or scientific outcome. |
| Registry | `spaced_repetition/registry.py::register_default_schedulers`; actual list `['fifakt', 'fsrs6', 'sm2']`. | Lists installed adapters, not approved research treatments. |
| Existing managed-research gate | `research/classroom_service.py::blockers,setup_choices`; supported SM-2 configurations selectable, installed FIFAKT unavailable and adds `condition_implementation_simulated` irrespective of model labels. | Retained unchanged. A database `simulated=false` label cannot certify the installed code. |

### SM-2 reference difference: tested implementation is not exact equivalence

Wozniak's original numbered SM-2 procedure calculates the next interval with the existing EF, rounds fractional intervals upward, and then updates EF after the response. The installed scheduler multiplies by the newly updated EF (`sm2.py:134,155`) and uses Decimal ROUND_HALF_UP (`sm2.py:69,156`). These are observable variant differences, even though the existing internal tests pass. [Primary SM-2 algorithm reference](https://super-memory.com/english/ol/sm2.htm).

Two read-only synthetic calculations were actually executed at fixed timestamp `2026-10-21T04:00:00Z`:

| Probe | Prior state and rating | Installed result | Reference-procedure comparison |
| --- | --- | --- | --- |
| Rounding | repetitions=3, interval=14 days, EF=2.36, `good` | 33 days, next EF=2.36 | ceil(14 * 2.36) = 34 days |
| Update order | repetitions=2, interval=6 days, EF=2.50, `hard` | 14 days, next EF=2.36 | ceil(6 * existing 2.50) = 15 days before EF update |

These are discrepancy probes, not participant records, failed hidden tests or efficacy measurements. Existing tests explicitly encode this repository's updated-EF/half-up variant. They do not establish exact conformity with the primary reference. The application four-rating mapping and within-day repetition policy also need an approved research-control definition. Preserve the shared implementation and its records. If the study requires a different control, approve and reference-test a separate versioned research adapter rather than silently patching Personal Learning.

## Requirement coverage and blockers

| Prompt requirement | Verified current state / disposition |
| --- | --- |
| 1. Real, approved and reference-tested arms | SM-2 mechanics exist but control version needs reference decision; ESR remains a simulation. **BLOCKED**; no paired treatment enabled. |
| 2. Same vocabulary/materials/blueprint/instructions/access | No approved common frozen pool/material manifest or comparability procedure supplied. Prompt 05 has a common draft assessment policy, not published instruments. **BLOCKED**; no invented pool or equal-exposure claim. |
| 3. Isolated research state/history | Existing `LearningContext` enforces null ordinary user/class IDs for research and has a participant scope; new private protocol/binding/enrollment/event records exist. Generic review routing lacks the required full managed-research boundary. **PARTIAL / execution BLOCKED**. No personal/ordinary state reuse. |
| 4. Three weeks, weekdays, asynchronous availability | `classroom_schemas.py` already stores proposed duration, study dates, IANA timezone, eligible weekdays and availability. They are draft declarations; three weeks/Monday-Friday are not approved defaults. **Execution BLOCKED**. |
| 5. Single weekend rule and three timestamps | No approved rule or separate raw algorithm due/adjusted availability/actual occurrence persistence contract. **BLOCKED**; neither move-to-Monday, discard, early review nor raw-date overwrite chosen. |
| 6. Reviews, correctness, timings, workload | Existing event fields store rating/client duration/state deltas, but genuine response/active time and objective correctness have no approved instrumentation. **PARTIAL / collection BLOCKED**. No fabricated metrics. |
| 7. Replays, authorization, condition/content isolation | Existing UUID event uniqueness and per-state configuration guards cover mechanics, not a complete research protocol. Study/configuration/item/permission gaps below must be closed before execution. **BLOCKED**. |
| 8. Honest due/completed/missed states and reminders | No approved calendar/status/reminder semantics. No student session/card/reminder UI added. Existing normal/personal review screens untouched. **BLOCKED**. |
| 9. Schedule/weekend/timezone/retry/isolation/regression tests | Existing 100 Python and 37 client checks pass. No working research calendar, equal-pool executor or real ESR exists to validate; new treatment acceptance tests remain **BLOCKED**, not passing by assumption. |

## Why the existing generic review API cannot be the research runner

These are source-audit findings, not reports of observed human-data incidents. No endpoint was exercised against application data.

- `services/api/app/modules/spaced_repetition/service.py:78,122,318` resolves research identity by user without an exact study filter. The input schema has optional `study_id`, but this service does not use it for context authorization. It does not validate the new designated classroom, protocol/enrollment, latest consent/withdrawal, study state/window or current class/owner eligibility.
- `get_or_create_learning_context` takes the classroom branch whenever `class_id` is supplied, before the research branch. Passing a class ID does not safely bind a research context and must not be used as a shortcut.
- Group mapping selects an algorithm name, then uses the global registry's scheduler/configuration identity. It does not instantiate the exact group-pinned configuration and parameters as a treatment contract. Default registry registration is not a validated allocation.
- Item intake checks that a `VocabularyItem` exists; it does not prove membership in an approved common pool/version or research access to that item. The ESR scheduler interface also does not pass the actual item/version to its pure function, which defaults those arguments. Future feature extraction must bind real content provenance explicitly.
- Replay lookup (`service.py:154`) uses global event UUID without proving exact request body/context ownership before returning its receipt. Existing mock replay tests do not prove cross-user/concurrent research event integrity.
- `reviewed_at` and `response_duration_ms` come from the client and are persisted as supplied. A stored number does not establish genuine study latency or foreground active time. `answer_result` stores a subjective rating, not a scored response.
- `VocabularyReviewState.due_at` is the current algorithm due date. Existing events retain raw intervals and state snapshots, but there is no approved adjusted availability/missed-window/active-time ledger. A generic overdue duration is not the research missed/late policy.

The new managed study roots remain draft and no managed participation is activated. Nonetheless, these gaps remain release blockers: an execution-available=false DTO is not proof that legacy generic endpoints enforce a research boundary for independently inserted or legacy-linked participants. Do not enable managed participants or treat the generic service as approved. No global/shared scheduler/router behavior is changed in this blocked verification slice.

## Measurement and calendar decisions required before implementation

The following are evidence boundaries and required protocol decisions, not newly approved measurement rules:

| Evidence | Required definition / currently unavailable rule |
| --- | --- |
| Rating vs correctness | Retain self-reported `again/hard/good/easy` separately. Do not infer objective correct/incorrect from a rating. Objective recall needs an approved task/answer/scoring source and version. |
| Algorithm state | Pin participant/study/protocol/allocation/configuration/content identities; preserve adapter-specific repetitions/lapses only where supported. Do not map incomparable state fields into invented common mastery scores. |
| Raw due vs availability | Preserve the unmodified adapter output independently of the policy-adjusted opening date and actual review occurrence. Record the approved policy version; weekend/holiday/end-window behavior and local timezone/DST rule are unresolved. Apply the same approved availability rule to both groups. |
| Response latency | Protocol must specify presentation/response boundaries, interruptions, foreground state and clock provenance. Client monotonic timing and server receipt timestamps measure different things; do not label network latency or a user-supplied number as verified cognitive response time. |
| Active study time | Requires approved foreground/idle/background/reconnect/parallel-device accounting and exclusion rules. No arbitrary idle cutoff, daily 15-minute default or sum of ratings' response durations. |
| Missed/late reviews | Need approved due/adjusted-window/grace/holiday/withdrawal/end-of-study definitions. Do not count every weekend raw due date as missed or erase raw scheduling evidence. |
| Workload | Protocol must distinguish eligible/due/shown/reviewed/repeated items and count actual events/exposures. Equal pool/access does not imply equal algorithm-selected workload or equal recall outcomes. |
| Reminders | Need approved channels, content, consent, timing/timezone and suppression rules. No messages, notification jobs or outside communications sent. |

## Actual verification and limits

From `services/api`:

```powershell
.venv/Scripts/python.exe -m pytest -q tests/test_spaced_repetition_foundation.py tests/test_sm2.py tests/test_fsrs6.py tests/test_fifakt.py tests/test_research_classrooms.py tests/test_research_setup.py tests/test_research_assessment_drafts.py tests/test_controlled_experiment.py --tb=short
```

**100 passed, 0 failed/skipped, 3.62 s.** Includes foundation 4, SM-2 14, FSRS-6 12, FIFAKT/reference-simulation 16 (46 scheduler checks total), and 54 existing research configuration/draft/legacy experiment checks. Service persistence/replay fixtures here are mocks, not PostgreSQL concurrency evidence. No new tests or expected values were invented to certify research readiness. No database, human participant, trained model or external provider was used.

From repository root:

```powershell
node --test scripts/reviews.test.mjs scripts/personal-practice.test.cjs scripts/live-pronunciation.test.cjs scripts/research-setup.test.cjs
```

**37 passed, 0 failed/skipped, 4.56 s.** Reviews API contracts 3, Personal Learning practice 14, live pronunciation 7, administrator research setup/blocked-publication contracts 13. One existing Node `MODULE_TYPELESS_PACKAGE_JSON` warning retained; no package/personal manifest change. These are component/adapter contract tests, not native microphone/device execution or human treatment outcomes.

Reference probes were run with the existing `calculate_sm2` and `registry` in an isolated Python process, with fixed synthetic dictionaries/timestamps and `math.ceil(previous_interval * previous_ease)` for the numbered reference comparison. Actual output is recorded above. Registry/model inspection reported `fifakt-esr-v1`, `is_simulated=true`, identity `simulated=true`, default model `fifakt-simulated-v1`, model `is_simulated=true`.

No PostgreSQL migrations/integration tests, server/browser/native UI, typecheck/build or broad baseline suites were rerun for a documentation-only change. Prompt 05's prior 98 backend/13 contract/5 browser checks and static checks remain historical evidence, not new Prompt 06 results. Earlier three baseline discrepancies are preserved, not repaired here. Weekend/timezone/missed-window/group-comparability acceptance tests were not claimed: the approved rule and execution system do not exist.

## Integrity and changed files

Entry SHA-256 inventory covered 559 tracked/unignored non-output files, including all existing uncommitted research additions, mobile/personal source, shared schedulers, models and migrations. Only these existing documentation files changed, plus the new report:

- `docs/SECTION_38B_PROGRESS.md`
- `docs/DECISIONS.md`
- `docs/SECTION_38B_06_REPORT.md` (new)

All application/test/configuration files remain byte-identical to this prompt's entry inventory. Existing output directories were not written. Test runner caches are not application records. HEAD/branch and all previous unrelated Git modifications remain preserved. No algorithm, production/test expectation, mobile navigation, research/classroom state, application database, package or migration change.

## Stop and prerequisites to unblock

1. Supply approved ESR methodology, trained/validated artifact and provenance, exact configuration and independent reference evidence; approve failure/fallback handling as a study deviation rather than silently treating base FSRS-6 as ESR.
2. Resolve and approve the research SM-2 variant/version without altering Personal Learning. Require genuine independent reference vectors for the chosen definition.
3. Finish the approved voluntary participant/withdrawal/allocation boundary; supply common frozen vocabulary/material/instruction/assessment manifests and applicable approvals.
4. Approve dates/timezone/windows/weekdays, weekend/holiday/missed/late/end-of-study policy, reminders and measurement definitions. Proposed three weeks/Monday-Friday and planned 15/15 do not settle those choices.
5. Under an authorized execution scope, implement a separate research service with live designated-class/study/participant/protocol/consent/allocation authorization; isolated versioned state/events; exact pinned pure-adapter configuration; original due/adjusted availability/actual occurrence evidence and exact replay protection. Preserve research null ordinary-identity constraints and all normal/personal contracts.
6. Then verify real PostgreSQL concurrency and privacy, reference schedules, weekend/timezone/DST and missed windows, content equality, retries, group switching, session/device recovery and Personal Learning regression before any live study.

**STOP after Prompt 06's BLOCKED finding. No real treatment integration or human treatment outcomes are represented as complete.**
