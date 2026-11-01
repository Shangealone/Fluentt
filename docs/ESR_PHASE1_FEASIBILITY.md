# ESR Phase 1 — hybrid scheduler feasibility

Inspection and execution date: 2026-10-31, local Windows/Python 3.12 environment.
Scope: isolated research feasibility only; no live scheduler integration.

## 1. Executive decision

**Overall PARTIAL. Recommendation: MODIFY before any learner deployment.**
The requested heuristic works mechanically in an isolated implementation. **193
targeted tests passed, 0 failed:** 84 new prototype/simulation tests and 109
existing backend tests. Separately, 8,400 synthetic schedule decisions replayed
successfully. No trained FIFAKT inference, learner outcome, or retention benefit
was measured.

The live `fifakt` adapter is a simulated, stability-changing heuristic, not the
requested interval-only formula or the authors' trained network. The managed
research treatment and classroom weekday dispatcher are not integrated. A real
pre-response feature/prediction contract, calibrated compatible model, and
approved actionable-calendar policy remain prerequisites. Immediate training is
not the smallest justified next step.

## 2. Existing implementation verified against source

All paths below are relative to repository root.

| Source / function | Verified behavior |
|---|---|
| `services/api/app/modules/spaced_repetition/fsrs6.py`: `calculate_retrievability`, `calculate_fsrs6`, `calculate_next_interval` | Pure 21-parameter FSRS-6 engine; power-law retrievability, response-dependent D/S update, integer calendar-day intervals. |
| `.../spaced_repetition/service.py`: `record_review_event` | Locks state, checks algorithm/context, rejects older events, computes result, stores previous/resulting state and immutable review event, updates due state. UUID event identity supports retries. |
| Same service: `get_due_reviews` | Returns due timestamps at/before now, ordered and bounded, not a weekday dispatcher. A missing state does not become a due item automatically. |
| `.../spaced_repetition/registry.py`, `router.py` | Registered engines are `sm2`, `fsrs6`, `fifakt`; request defaults remain SM2. Existing research mapping uses `sm2_control` versus `fifakt`, not the proposed FSRS-6 control. |
| `.../spaced_repetition/fifakt.py`: `calculate_fifakt_esr`, `ESRScheduler` | Simulated pK adjusts persisted FSRS stability before interval calculation; sensitivity .50, lower factor .80, upper 1.25; Again-specific cap. Not this proposal's .75 interval floor. |
| `.../spaced_repetition/fifakt_features.py`, `fifakt_model.py` | 13-field aggregate interface and local deterministic mathematical predictor, explicitly simulated; no trained checkpoint loader. |
| `services/api/app/modules/research/classroom_schemas.py` | Methodology draft proposes weekday sessions, one calendar month, short daily duration, delayed retention assessment and two groups. Protocol fields include timezone/weekdays. These are configuration/validation contracts. |
| `.../research/classroom_service.py`, `execution_guard.py` | Explicit blockers include trained FIFAKT unavailable, FSRS-6 research treatment not integrated, and methodology draft not execution authorization. Managed research execution remains blocked. |
| `services/api/app/modules/assignments/publication.py`, `capture.py` | Distribution/capture is separate. Published distribution-only policies do not supply an executable vocabulary due scheduler; captured questions/Flashcard ratings do not automatically write vocabulary review events. |
| `apps/mobile/src/services/api/reviews.ts` | Typed review API adapter exists, defaulting to SM2. Search found no mounted caller of its due/submit functions; this does not establish an end-to-end classroom review host. |

Read architecture, decisions, Sections 28/30/31, research, assignment and AI-plan
documentation as context; source takes precedence over proposed behavior.
Personal, classroom and legacy research contexts share scheduler services. A live
change there would risk Personal Learning and was deliberately not made.

FSRS elapsed time is seconds divided by 86,400, not instructional weekdays. Due
time is response time plus the rounded interval. Rounding uses Decimal half-up,
minimum 1 and maximum 36,500 days; Again produces one day. Same-day reviews have
a separate state-update branch. No class timezone/holiday/instructor window is
applied by the engine. Late reviews use actual elapsed time; no submitted event
means no state update and an overdue item remains due. Catch-up, skipped-school-day
and late-assignment treatment are not approved executable calendar rules here.

## 3. Formula and timing semantics

```text
factor = clip(1 + 0.5 * (pK - pF), 0.75, 1.25)
I_raw = I_FSRS_after_response * factor
I_final = bound(half_up(I_raw), 1, 36500)
```

This is an exploratory research heuristic, not an established FSRS or FIFAKT
equation. pK and pF must refer to the **same learner, item, event and prediction
instant**, using inputs frozen before its observed answer. The completed answer
may update the base FSRS interval, but cannot enter either prediction.

With old stability S, FSRS computes pre-update retrievability from elapsed time.
The returned state's `retrievability` field stores this pre-update value, rounded
to four decimals; it is not automatically a post-answer probability. Recomputing
retrievability from updated stability and a just-reset last-review timestamp would
instead produce elapsed zero/R=1, and would use answer-dependent state. A correct
future implementation must freeze the old-state prediction with its provenance.

The current request already contains rating and response duration when computation
starts. Its old state is available, but no durable pre-answer prediction snapshot
is issued. The simulated KT feature builder uses the current rating/duration and
post-answer base D/S; cold-history duration may substitute current duration. Its
history filter excluding current/later events does not remove these other leakage
paths. The new isolated tests demonstrate current-answer sensitivity without
changing this existing adapter.

The prototype keeps base D/S untouched. It requires explicit aware timestamps,
matched identifiers, valid probabilities and prior-input timing. Its SIMULATED
fixture metadata is a contract demonstration, not proof that production inputs
were collected before an answer.

## 4. Formula verification

`services/api/ml/esr_phase1/prototype.py` implements the exact requested equation
using Decimal arithmetic. `tests/test_prototype.py` covers lower/equal/higher pK,
0/1 and bounds, missing/invalid/nonfinite probabilities, booleans/text, negative,
zero, fractional and huge intervals, half-day rounding, minimum/maximum dates,
same-event alignment, chronology, cold starts, provider failures and replay.

Raw zero is permitted for numerical exploration, then clamps to one scheduled
day; a valid application base proposal must already be an integer 1–36,500 with
consistent due time. Huge raw values are bounded before date arithmetic. The
prototype does not alter production validation. On unsafe predictions it returns
the exact same valid base proposal object, interval and timestamp.

**PASS:** 79 prototype cases plus five simulation tests = **84 passed, 0 failed**.
No automatic empirical coefficient tuning occurred. The .5/.75/1.25 constants
remain unchanged and scientifically unvalidated.

## 5. SYNTHETIC SIMULATION RESULTS

Finite deterministic grid: seven start dates, 2026-11-02 through 11-08; four
scripted histories (cold/recent/mature/lapsed); four current ratings; lateness
0/2/7 days; five SIMULATED pK offsets from pF (-.5/-.1/0/+.1/+.5, clipped to
probability bounds). This gives 1,680 snapshots, each projected onto five policies
= 8,400 rows. Actual pure FSRS produces the base intervals. pF is computed from
old state three seconds before response; pK is invented for sensitivity analysis,
never represented as FIFAKT inference. Cold starts use unchanged FSRS fallback.

Only the unrestricted engine-calendar scenario reflects current elapsed-day
behavior. **Reproducing an existing executable classroom weekday scheduler is
BLOCKED because none was found.** Other projections are explicitly hypothetical:
Asia/Manila, half-open November 2–December 2 calendar-month window, Monday–Friday,
Friday-only instructor availability, and a skipped November 9. The pure existing
`calendar_month_boundary` helper supplies month bounds, but instructor/missed-day
gates are research assumptions, not production policies. No publication or
assignment constraints were silently invented or modified.

Primary analysis includes weekday starts only: **1,200 rows per policy**. Each
has 300 cold-start fallbacks, 720 raw interval changes, and 345 rounded interval
changes; 375 raw changes collapse immediately through rounding.

| Policy | Both actionable | Different actionable day | % of all 1,200 | % of comparable | Both outside window | Availability differs |
|---|---:|---:|---:|---:|---:|---:|
| Engine calendar, no weekday gate | 1,200 | 345 | 28.75% | 28.75% | 0 | 0 |
| SIMULATED month, all days | 893 | 159 | 13.25% | 17.81% | 293 | 14 |
| SIMULATED month, Monday–Friday | 893 | 121 | 10.08% | 13.55% | 293 | 14 |
| SIMULATED month, Friday only | 855 | 28 | 2.33% | 3.27% | 327 | 18 |
| SIMULATED Monday–Friday, skipped Monday | 893 | 117 | 9.75% | 13.10% | 293 | 14 |

Window censoring is explicit: two unavailable dates are not counted as an equal
actionable day, and one available/one unavailable is reported separately. After
rounding, weekday mapping collapses another 38 comparable interval differences
to the same day in the Monday–Friday scenario. Time-of-day divergence is also
logged separately from local-day divergence.

Weekend-start sensitivity includes all 1,680 rows per policy: Monday–Friday
changes 170 actionable days (10.1190% of all; 13.7097% of 1,240 comparable),
420 pairs are both outside and 20 differ in availability. All five policies'
complete counts are in `results/summary-v1.json`.

These differences demonstrate mechanical schedule separation in this grid, not
an educationally meaningful effect. Histories and predictions are uniformly
enumerated assumptions, not a sample of FLUENTT learners. Scripted answers remain
fixed for paired comparisons; this is not a longitudinal counterfactual retention
simulation. Clipping and rounding produce asymmetric results at high pF. Missed
and late cases expose policy sensitivity, not a validated catch-up strategy.

## 6. FIFAKT feature compatibility

AVAILABLE denotes a verified storage/interface field, not proof it is populated
for an approved study. DERIVABLE requires a frozen, authorized history scope.

| Required concept | Status | Verified mapping / gap |
|---|---|---|
| Learner identity | AVAILABLE | Ordinary user and coded research identities exist separately; resolve only under approved research authority. Network input currently lacks sequence-bound learner identity. |
| Vocabulary identity/version | AVAILABLE | Vocabulary item/version storage exists; engine call lacks item ID and simulated wrapper defaults to a new UUID when omitted. |
| English learning language | AVAILABLE | Learning-language context exists; define exact English subset; do not confuse subject, UI language or learner nationality. |
| Duolingo UI language | UNKNOWN | No verified equivalent demographic feature in the local KT interface. |
| Lemma/morphology/lexeme representation | MISSING | Local term IDs are not Duolingo lexeme encodings; approved mapping and versioned vocabulary needed. |
| Word length | DERIVABLE | Define surface/lemma and Unicode unit consistently with training. |
| Word/lexeme embeddings | MISSING | Official source uses 300-dimensional fastText plus learned lexeme embeddings; none wired into local predictor. |
| Review timestamp | AVAILABLE | Immutable event reviewed_at exists; future pre-answer prediction instant must be separately frozen. |
| Elapsed time / repeated-item delta | DERIVABLE | Ordered history and old state; define units, first exposure, and same-time order. |
| Learner-wide delta / sequence | DERIVABLE | Events could support ordering after authorized extraction; current scheduler receives state, not full cross-item sequences. |
| Prior exposure counts | DERIVABLE | Counts of explicit review events only; classroom answers/exposure are not automatically vocabulary events. |
| Prior objective correct counts | MISSING | Self-rated Again/Hard/Good/Easy is not verified binary correctness or session exercise counts. |
| Current binary recall label | MISSING | Requires approved outcome instrumentation/definition; never silently map all passing grades to objective correctness. |
| Fractional session recall target | MISSING | Duolingo p_recall is a lesson/exercise fraction; no equivalent local session numerator/denominator established. |
| Previous answers as sequence inputs | DERIVABLE | Only strictly prior observed responses; current answer excluded from prediction. |
| Format/context features | MISSING | Existing ten question methods are not wired into vocabulary KT; official corpus variants differ. |
| Prior response duration | DERIVABLE | Stored on review events, but not all state aggregates; current duration forbidden for predicting its own response. |
| Padding, masks, categorical vocabularies | MISSING | Must reproduce sequence alignment, embedding indices, unknown-token handling and masks. |
| Unfamiliar learner/item policy | MISSING | No verified production OOV/cold-start calibration; use explicit FSRS fallback until evaluated. |
| Trained weights and calibrator | MISSING | Only simulated local predictor; no public pretrained checkpoint found in inspected local implementation or pinned upstream tree. |
| Frozen pre-response feature record | MISSING | Current request has observed answer; no linked pre-answer snapshot contract. |

**Not training-ready or inference-ready.** Schemas alone do not supply usable
sequences, labels, stable embedding identities or calibrated recall estimates.

## 7. Official-source verification and training prerequisites

Primary sources inspected (2026-10-31):

- [FSRS algorithm](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm): 21-parameter formulation; local implementation is the evidence for exact local rounding and service behavior.
- [FIFAKT authors' repository](https://github.com/BoxuanMa/FIFAKT), pinned commit `a03e248141fc32a96dc6fda3bb6ae52be621bb9a`, MIT repository license. The [paper DOI](https://dl.acm.org/doi/10.1145/3576050.3576062) returned 403; full paper was not independently read.
- Pinned [model](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Duolingo/models.py), [training](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Duolingo/train.py), [feature generation](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Duolingo/generate_dkt_features.py), [English filter](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Duolingo/duolingo_en.py), and [embeddings](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Duolingo/emb.py).
- [Duolingo HLR publisher README](https://github.com/duolingo/halflife-regression/blob/master/README.md) and [original dataset access](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/N8XJME). Dataset was not downloaded; access page was blocked to this browser. Publisher describes approximately 13 million records / 361 MB compressed; this is not a measured local dataset size or rights clearance.

FIFAKT is a recall predictor, not an interval scheduler. Inspected official code
uses an LSTM/attention sequence model, 300-dimensional word vectors, 64-dimensional
learned lexeme embeddings, prior history counts, word size and three elapsed-time
features. Its forward signature includes additional categorical/auxiliary fields,
some unused by the active branch. A user-count constant is not proof of an active
learned user embedding; users still define sequence grouping. The English script
filters `learning_language == 'en'`, not UI language.

The upstream target sequence supplies shifted previous-response context and a
masked prediction target. Reproduce shift/mask alignment before drawing leakage
conclusions. Static concerns requiring independent reproduction include raw log
of history counts without a zero guard, an apparent session-correct/session-seen
copy, and LSTM sequence/batch-axis alignment. These are **not executed upstream
failure results**. Do not run unreviewed remote code or silently repair it here.
Hardcoded dataset length/splits and lexeme dimensions are not portable contracts.

The local 13-field heuristic cannot be substituted for this model. A fraction of
correct exercises within a Duolingo session is not automatically the probability
of one FLUENTT response. Establish the outcome unit, numerator/denominator and
prediction instant first. Repository MIT terms do not independently establish
dataset, embedding, participant-consent or trained-weight redistribution rights.

Training requires a later approved data/license/resource audit, preprocessing
contract, vocabulary/embedding versioning, causality/shape tests and small fixture
reproduction. No training or broad dataset download was justified in this phase.

## 8. Fallback and logging verification

Tests cover missing predictions/weights, unsupported vocabulary/features,
insufficient history, invalid values, out-of-order inputs, timeout and exception.
All retain the unchanged valid FSRS proposal with multiplier one and an explicit
reason; no fabricated prediction is inserted. Timeout is an injected exception,
not a tested cancellation mechanism for a hung model. A future worker needs a
bounded execution deadline and safe lifecycle separately.

Replayable synthetic logs include coded learner/item/event identities, event and
prediction times, condition, pre-response probabilities where valid, base interval,
factor, raw/rounded interval, final actionable timestamp, fallback, heuristic/model
and calibration identifiers, and full calendar/rounding versions and parameters.
All 8,400 records reconstructed the arithmetic/calendar decision exactly. This
does not replay FSRS memory evolution from original learner observations.

For a real authorized study, additionally pin old/new FSRS state or immutable
event references, feature cutoff/provenance/hash, model and weights checksum,
calibrator/version, sequence schema and consent/configuration identity. Use coded
research identities with separately controlled linkage; avoid unnecessary raw
names, answer text or audio. Existing review-state/configuration logs do not yet
provide all these pre-response/model/calendar records. No logging schema changed.

## 9. Methodological risks and validation design

Current disagreement is not a prediction of recall at the *next proposed interval*.
Positive pK-pF could reflect calibration bias, domain shift or target mismatch,
rather than knowledge that justifies a longer delay. Calibrate on the same outcome
unit and population, using calibration data separate from evaluation. For binary
recall report Brier score, log loss, calibration curves and discrimination with
learner-aware uncertainty; for fractional targets define appropriate weighting
and errors first. Never claim AUC or matching mean probabilities proves calibration.

Freeze chronological event ordering and all transformations. Construct history
strictly before each target; train encoders/calibrators on training/calibration
only. Report future-event evaluation for known learners separately from held-out
learner and held-out lexeme transfer. Keep repeated learner/item observations
together when estimating uncertainty; audit train/test content and temporal
overlap, padding and target shifts. Do not fit bounds on the held-out trial.

Interval-only adjustment preserves state semantics but changes implied target
retention. Under the existing default forgetting curve, R(S)=.9 while R(.75S)
is about .918523 and R(1.25S) about .883952, before rounding/calendar gates.
These are analytic model values, not observed learner retention. The old adapter's
persisted stability fusion makes a different claim about memory and is not an
equivalent implementation. Small disagreements often disappear: .05 changes an
interval only 2.5%, frequently less than half a day. Lapse handling, minimum-one-day
floor, large intervals, horizon censoring and equal instructional opportunity need
explicit preregistered policies.

The planned approximately 30 participants/15 per arm is a proposal, not demonstrated
power. Before a retention study, justify sample size, attrition allowance, randomization
unit/class clustering, baseline balance, equivalent material and exposure, delayed
retention instrument and analysis. Keep preliminary HLR/DASH/ACT-R comparisons
separate from the primary learner experiment. Synthetic divergence cannot supply
an effect size, outcome label or generalization claim for that trial.

## 10. Recommendation: MODIFY

Retain this exact candidate as an **unvalidated comparator**, rather than enabling
or silently retuning it. Before rollout:

1. Freeze matched pre-response pK/pF and reject incompatible targets/features.
2. Preserve FSRS D/S; change only a separate interval proposal under a new version.
3. Keep unchanged FSRS fallback for unsupported/cold/OOV/error cases.
4. Approve lapse, rounding, bounds, timezone, weekday, missed-day and window rules.
5. Calibrate predictors independently, then preregister sensitivity/bounds using
   calibration-only evidence. The current constants have no demonstrated optimum.
6. Check actual actionable divergence and equal exposure under the approved rules
   before committing students to a retention experiment.

No alternative coefficients are asserted to be superior. Rejecting all hybrid
research is not warranted; deploying the current adapter as trained ESR is also
not warranted.

## 11. Executed checks and artifacts

Commands below ran from `services/api` using the existing Python environment:

```powershell
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest ml/esr_phase1/tests -q --tb=short
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest tests/test_fsrs6.py tests/test_fifakt.py tests/test_spaced_repetition_foundation.py tests/test_classrooms.py tests/test_assignment_drafts.py tests/test_research_classrooms.py tests/test_research_execution_guard.py tests/test_research_methodology_draft.py -q --tb=short
./private-data/api-runtime/.venv/Scripts/python.exe -m ml.esr_phase1.simulate --output-dir ml/esr_phase1/results/run-v1
```

| Check | Actual result |
|---|---|
| Isolated pytest | 84 PASS, 0 FAIL, 0 skipped, 0.46 s; final repeat 84 PASS in 0.45 s (not added twice) |
| Existing targeted backend pytest | 109 PASS, 0 FAIL, 0 skipped, 8.53 s; two dependency warnings |
| Simulation decision replay | 8,400/8,400 reproduced; not counted as pytest tests |
| Full project, native device, PostgreSQL integration, real FIFAKT | NOT RUN; no coverage claim |

Existing backend tests used local lightweight fixtures; no existing database was
accessed or altered. A Windows local socket permission issue required rerunning
the targeted tests with approved execution permissions; no application fix was
made to obtain a pass.

Full generated run was safely relocated to ignored
`services/api/private-data/esr-phase1/run-v1/`: `schedules.csv` (2,570,393 bytes),
`decision-logs.jsonl` (13,020,869), `summary.json` (7,837), `sha256.json` (274).
The public compact copy is
`services/api/ml/esr_phase1/results/summary-v1.json`. Output directories refuse
overwrite. `README.md` supplies reproduction into a new ignored directory.

Ignored evidence also includes `baseline.json`, `env-hash.txt`,
`existing-tests.txt`, `derived-diagnostics.json`, `upstream-tree.json`,
`upstream-source-evidence.json` and five upstream source-text extracts. Only
59,001 bytes of upstream Python text plus small metadata were fetched; none was
executed. No dataset, embedding or checkpoint was downloaded.

Source SHA-256 pinned in the summary:

```text
fsrs6.py   4df490b4f79c4d7c6c7c5bf237e8975776d9a4b3736f9b15be0965ea92a2b185
prototype  e53a79881d671caed1fe921916ebbcff2d7632dbdfa91b1794be0c4c65f1ffe7
simulate   05dcb74e788ddee41376327c544264c3e46ca26619ec30cf555847b7f045959f
```

Exact phase source/documentation changes:

- Added `docs/ESR_PHASE1_FEASIBILITY.md`.
- Appended phase boundary to `docs/DECISIONS.md`.
- Added `services/api/ml/esr_phase1/__init__.py`, `prototype.py`, `simulate.py`,
  `README.md`, `tests/test_prototype.py`, `tests/test_simulation.py`,
  `results/summary-v1.json`.

The repository already contained unrelated modifications at entry. Baseline
hashes cover 724 pre-existing tracked/unignored files; final verification compares
them, permitting only the documented DECISIONS append. Ignored backend `.env` is
separately hashed. No scheduler import/registration, application source, existing
tests, migration, dependency, setting, allocation or prior research output was
intentionally edited. Final hash/static verification results are recorded below.

Final verification: of the 724 baseline files, only `docs/DECISIONS.md` changed;
all other baseline hashes match. The backend ignored `.env` hash matches. All
three source hashes and all generated-artifact manifest hashes match, and the
compact summary is byte-identical to the full-run summary. Exactly the eight new
unignored files listed above were added. `python -m compileall -q ml/esr_phase1`
passed. `git diff --check` found no whitespace errors (Git emitted an existing
LF/CRLF advisory for unrelated `scripts/wavlm.test.cjs`).
`rg -n esr_phase1 services/api/app apps/mobile apps/admin` returned no matches
(normal search exit 1), confirming no application import of the prototype.

## 12. Next priorities, ordered by dependency

1. Approve a prediction/outcome contract and executable classroom calendar semantics,
   including which real activity constitutes one vocabulary encounter.
2. Reproduce official preprocessing/sequence causality on tiny reviewed fixtures;
   establish English-learning dataset rights, bounded acquisition/storage and
   embeddings/resources in a separate authorized stage.
3. Define versioned local mappings and genuinely pre-answer instrumentation without
   repurposing self-ratings or ordinary classroom records as research evidence.
4. Only then undertake bounded training/reproduction, calibration, OOV/cold-start
   evaluation and independent chronological/learner/item transfer tests.
5. Run shadow scheduling under approved calendars, then seek ethics/protocol/power
   approval before any allocation or learner-facing treatment implementation.

**Smallest next step:** freeze the feature/target/calendar specification and its
causality fixtures. Training FIFAKT immediately would encode unresolved labels and
timing assumptions, so it is not yet justified.

## 13. Scientific and scope boundary

**PASS:** candidate arithmetic, deterministic fallback/replay, bounded synthetic
schedule comparison and selected regressions. **PARTIAL:** schema compatibility
and classroom-calendar feasibility. **BLOCKED:** real trained KT inference,
faithful executable weekday treatment reproduction and retention efficacy.

Nothing here establishes trained FIFAKT, calibrated generalization, improved
vocabulary retention, adequate trial power or academic validation. Live FSRS-6,
Personal/Class Learning, existing assignments/allocations, all database records,
English WavLM, Tagalog MMS, Allosaurus, Voice and prior pronunciation research
remain outside the modifications. No training, commit, push or deployment occurred.
Stop after ESR Phase 1.
