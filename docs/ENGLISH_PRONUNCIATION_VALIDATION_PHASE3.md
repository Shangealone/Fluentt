# English pronunciation validation Phase 3 — scoring diagnostics

Date: **2026-10-31**. **Overall PARTIAL:** diagnostic execution and reproduction
PASS; causal attribution, acoustic alignment validation and training independence
remain unresolved. No scoring change, training, new model inference or calibration
occurred. This report does not replace the original Phase 1–2 baseline.

## 1. Executive findings

- Reproduced original sentence **Pearson 0.421627 / Spearman 0.511326** and the
  same speaker-cluster intervals exactly from saved predictions.
- **No deterministic score-computation or data-join defect was found in this
  30-recording cohort.** This is bounded evidence, not proof that every possible
  input or acoustic alignment is correct.
- Strongest confirmed comparability gaps: the model reports an equal-per-phone
  average, while the human target is a holistic sentence rubric; **37/179 words
  have different expected phone sequences**, and the small sample has limited
  rating variation. These support investigation, not a causal decomposition of
  the moderate correlation.
- All leave-one-speaker-out associations stay positive, but Pearson ranges
  **0.348–0.554**, showing sensitivity to which speakers are included.
- Independence remains **UNVERIFIED**. The next step is a larger, newly sealed
  speaker-disjoint evaluation with a defined reference-variant/label contract,
  not optimization of aggregation against these 30 recordings.

Read both preceding validation reports, the real scoring/decoder/runtime/DTO/UI
code, frozen manifests, raw outputs and provenance. Research baseline was
reproduced before exploratory diagnostics. Original results/labels/reports remain
unchanged. No model or data download occurred; only small primary-source web
pages were consulted for interpretation.

## 2. Provenance and reproduced baseline

Actual scorer: `Jianshu001/wavlm-phoneme-scorer`, revision
`19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da`. Backbone revision
`c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c`; alignment revision
`2c733782da5604684829819a5eb744c193fe9398`. Saved Phase 2 `loaded.json` pins the
actual implementation hashes; current source matches them. The checkpoint hash
remains `7b9485b679d9a1219ac7dbef197b5185ec16e7909632b082b1f0576a963e0040` as
verified in Phase 2; Phase 3 does not reload the checkpoint merely to repeat that
metadata investigation.

Dataset original revision: `613968e3b0b789fc33936fb5eba1973176ba7d11`.
Exactly 30 saved genuine predictions, ten speakers, three recordings each. Sample,
speaker, reference hash/text, human label and model revision joins were rechecked.
Audio SHA-256 values match the frozen manifest. No observation was discarded or
replaced. Dataset attribution/CC BY 4.0 and separate unresolved model licensing
findings remain as documented in Phase 1.

| Original sentence endpoint, 30 recordings / 10 speakers | Estimate | Original 95% speaker-cluster interval |
|---|---:|---:|
| Pearson | 0.421627 | 0.135690–0.751757 |
| Spearman, average ranks for ties | 0.511326 | 0.193038–0.750324 |

Original 2,000-draw bootstrap, seed 20261031, carries all recordings of a sampled
speaker together. It was reproduced, not replaced with an independent-recording
interval. These are wide pilot intervals, not proof of grading validity.
MAE/RMSE remain unset because common calibrated score meaning is unestablished.

## 3. Exact score semantics and code audit

Source paths below are relative to repository root.

`services/api/ml/wavlm/pipeline.py` implements a regression head and a separate
error-logit head using pooled WavLM features, expected-phone embedding, CTC GOP
and frame count. For raw regression prediction `g_i`:

```text
s_i = round_to_1_decimal(clip(g_i, 0, 100))
word_score_j = round_to_1_decimal(mean(s_i for phones in word j))
overall_score = round_to_1_decimal(sum(s_i over all phones) / total_phone_count)
phone_error_i = sigmoid(error_logit_i) >= 0.70
```

Thus each phone has equal weight regardless of duration. Longer words receive
more sentence weight because they contain more phones. This is **phone-count
weighting**, not equal-word weighting, duration weighting or an intelligibility
model. Overall score is calculated directly from phone scores, not rounded word
means. Every returned overall score reproduced this formula; saved word scores
are supplied by the same explicit upstream-style word-mean code. Error flags and
their total agree with the unchanged .70 threshold. GOP and error probability are
not interchangeable with the regression score.

The human endpoint is median expert **sentence accuracy 0–10**, not the average
of human phone goodness **0–2**. The dataset's
[primary paper](https://arxiv.org/html/2104.01378) distinguishes holistic accuracy
from phone averages, and explains that experts vote on canonical pronunciation
variants before rating phones. Therefore changing averaging is not automatically
a bug fix, and an affine scale conversion does not create semantic equivalence.

`services/api/ml/wavlm/worker.py` preserves the numeric scores when building the
backend response. `app/modules/pronunciation/wavlm_contract.py` validates ranges,
complete words, flags/counts and finite values; it adds possible-practice tips,
not a different score. `wavlm_service.py` uses the published reference and saves
the actual result. Mobile `WavLMPractice.tsx` displays `.toFixed(1) / 100` and
possible-difficulty wording; `services/api/wavlm.ts` validates the same contract.
No percentage rescaling, score bonus, transcript-similarity substitution or
round-up floor was found on this English path.

| Edge case | Confirmed behavior / diagnostic limit |
|---|---|
| Silence / invalid duration | Decoder rejects waveform std < .0005 and durations outside .5–30 seconds before assessment. Quiet samples are not automatically absence of speech. |
| Unknown reference phones | Incomplete mapping raises; observed 567 phones contain no unknown phone types. G2P/CTC aliases and phone inventory match the pinned training-source mapping. |
| Missing segments / empty alignment | Complete coverage/token-order checks raise; worker rejects empty/error results instead of exposing a numerical fallback. |
| Repeated phones | CTC requires separating blank states; pure-function probes preserve two repeated targets and reject impossible short paths. No repeated-phone loss was demonstrated. |
| Internal default values | Low-level empty/error dictionaries contain zero sentinels, but worker rejects them. Assembly `.get` defaults exist behind the complete scoring path; no returned missing prediction was observed. They are not evidence of a fabricated score in this cohort. |
| Low confidence | Error-head threshold marks possible difficulty; there is no empirically validated alignment-confidence/abstention threshold. Finite forced coverage alone is not acoustic correctness. |

No production edit is justified as a confirmed scoring defect here. Full DTO
validation is not itself a second independent recomputation of score semantics;
research verification and inspected scoring code supply that evidence.

## 4. Audio and alignment diagnostics

All **30 recordings / ten speakers** are 16 kHz mono PCM16. Phase 2 already
decoded to that format; no source-rate conversion was needed for these original
files. Exact reference sentences and audio hashes match. Observed recording
duration is **2.41–7.00 seconds**, phone count **11–33**. All original inputs
passed the existing non-silence/duration checks.

| Original PCM descriptor, all 30 / 10 speakers | Minimum | Median | Maximum |
|---|---:|---:|---:|
| Waveform standard deviation | .01627 | .04451 | .13438 |
| Absolute peak, normalized full-scale units | .11191 | .40033 | .82407 |
| Exact-zero fraction | .00196 | .00638 | .11232 |
| Fraction with absolute amplitude < .01 | .41413 | .60794 | .71924 |

No sample equals either PCM16 full-scale endpoint: observed full-scale clipping
fraction is zero for every recording. This does not rule out earlier limiting,
noise, reverberation or imperfect recording quality. The .01 descriptor is an
explicit exploratory amplitude summary, **not VAD, a silence label or a new
production threshold**. No SNR or acoustic listening judgment was invented.

Saved raw outputs contain scores, word/phone sequences, GOP, error probabilities
and flags. **Frame boundaries, emission matrices, per-phone frame counts and
unclipped regressions were not retained.** All 567 returned phone positions passed
the pipeline's coverage checks, but actual phone-to-audio boundaries cannot be
independently verified from these logs. A synthetic uniform-emission probe still
admits a complete forced path, illustrating why coverage is insufficient evidence
of reliable alignment; it says nothing about this cohort's actual emissions.

Minimum additional diagnostic evidence, in a later approved bounded run: expected
phone position and variant ID, CTC/backbone start/end frame and frame count,
mapping indices, normalized-audio hash, path/segment likelihood summaries, and
unclipped score. Expert listening/boundary adjudication on a small separate sample
is needed to attribute errors. Do not add raw audio/transcript logging to student
production by default. No new large-model inference was necessary in Phase 3.

## 5. Expected-phone compatibility and exploratory phone comparison

Strict comparison requires the same word, the same number of phone positions and
the same phone sequence after only ARPABET stress-digit removal. No edit-distance
repair, inserted phone, synonym mapping or forced label transfer was used.

- **142/179 words** matched exactly; **37 words** differed across **21 recordings
  and all ten speakers**.
- Exact words supply **418/567 model phone positions**, covering all 30 recordings
  and ten speakers. The other 149 model positions are excluded from this phone
  comparison, not dropped from the original sentence analysis.
- Examples of human canonical → model expected sequences:
  `FOUR: f ao → f ao r`; `PARK: p aa k → p aa r k`;
  `SEVEN: s eh v n → s eh v ah n`; `LAYLA: l ey l aa → l ey l ah`.

These demonstrate reference/dictionary differences, **not learner mistakes** or
wrong audio joins. The dataset's expert-selected canonical sequence can differ
from the pipeline's per-word G2P. The
[paper's variant procedure](https://arxiv.org/html/2104.01378#S3.SS2) supports
treating this as a comparability issue, not automatically penalizing a speaker.
Feeding expert-selected test phones into a future scorer would be privileged
diagnostic conditioning, not proof of an improved runtime G2P system.

| Exploratory matched-phone goodness association | Estimate | 95% speaker-cluster interval |
|---|---:|---:|
| Pearson | 0.505607 | 0.324323–0.641677 |
| Spearman | 0.253001 | 0.117146–0.363610 |

Resampling again uses all selected phone observations of each sampled speaker,
2,000 draws, seed 20261031. These are **post hoc native-scale goodness
associations on a compatibility-selected subset**, not improved sentence
performance or independent phone observations. Human phone ratings of 2 occupy
**350/418 positions (83.7%)**, producing many ties. An averaged human rating of
1 includes accent and is not automatically the same target as a model binary
error flag. No error-label cutpoint, precision/recall/F1, MAE or RMSE was invented.

## 6. Rankings, aggregation influence and observed patterns

Human sentence ratings comprise **4:1, 6:2, 7:6, 8:12, 9:9**; only five unique
values. Model sentence scores have 28 unique one-decimal values, range 72.2–94.3.
No sentence hits the displayed 0/100 boundaries. At phone level, **one score is
0 and 28 are 100** among 567 predictions, consistent with the documented clipping
step; unclipped values are unavailable, so exact saturation mechanisms cannot be
reconstructed. The restricted human range and target/tie structure limit rank
resolution and generalization. They do not alone explain how much correlation
would change on another population.

Largest relative-rank examples use average tied ranks, 1 lowest, 30 highest.
Positive gap means a relatively higher model rank, not a calibrated overestimate:

| Sample / speaker | Human native score | Model native score | Human rank | Model rank | Rank gap |
|---|---:|---:|---:|---:|---:|
| 011860377 / 1186 | 6 | 91.9 | 2.5 | 26 | +23.5 |
| 001120031 / 0112 | 9 | 75.5 | 26 | 4 | -22 |
| 069020175 / 6902 | 8 | 73.8 | 15.5 | 3 | -12.5 |
| 000930050 / 0093 | 9 | 85.9 | 26 | 14 | -12 |
| 010610094 / 1061 | 7 | 87.5 | 6.5 | 18.5 | +12 |
| 024380317 / 2438 | 8 | 91.5 | 15.5 | 25 | +9.5 |

This displayed subset is post hoc: **six recordings / six speakers**; the full CSV
retains all 30 / ten. No reference or score was changed after inspecting examples.
The raw five-expert sentence accuracy ranges span 1–4 native points per utterance,
median 2, a descriptive annotation spread, not an inter-rater reliability estimate.

Fixed exploratory Spearman relationships with **absolute rank gap**, all using
30 recordings / ten speakers: duration **+.073**, phone count **-.306**, waveform
std **+.319**, low-amplitude fraction **-.288**, minimum phone score **+.123**.
These are unadjusted post hoc descriptors with interdependent variables and no
causal interpretation or independent-recording significance tests. They do not
establish that amplitude, length, accent, speaker age or alignment caused error.

Aggregation influence, not alternative-score validation:

- Equal-word mean differs from the current phone mean by up to **7.159 native
  model points** (`011860298`, 14 phones). No correlation was computed to select
  that alternative and it is not proposed as a proven improvement.
- Removing just the lowest-scoring phone shifts the mean by at most **4.911
  points** in these data (`001120013`, 17 phones). This is a diagnostic influence
  calculation, **not permission to discard difficult phones**.
- In general, changing one phone from 0 to 100 changes an unrounded N-phone mean
  by at most `100/N`. Thus length changes influence mechanically; whether the
  rubric should use different weights needs independent evidence.

## 7. Speaker-aware reliability and sensitivity

Each leave-one-speaker-out analysis removes all three recordings, leaving
**27 recordings / nine speakers**. It is sensitivity analysis, not ten independent
validation replications:

| Excluded speaker | Pearson | Spearman |
|---|---:|---:|
| 0093 | .424745 | .539098 |
| 0112 | .554193 | .566834 |
| 1030 | .348465 | .417286 |
| 1050 | .403026 | .495543 |
| 1061 | .418280 | .528585 |
| 1186 | .512561 | .597446 |
| 1465 | .423569 | .524957 |
| 2438 | .393131 | .488533 |
| 5432 | .393884 | .472557 |
| 6902 | .360317 | .456337 |

All are positive; a single excluded speaker does not reverse the observed sign.
Pearson ranges .348–.554 and Spearman .417–.597. Size and strength remain sensitive
to speaker composition, with only ten clusters. The original broad bootstrap
intervals remain the baseline. Speaker-specific CSVs give counts for strict phone
matches and rank gaps; each speaker has three recordings, not enough for reliable
individual accuracy/fairness claims. No unsupported accent/subgroup explanation
was assigned to any identified speaker.

Figures:
[speaker sensitivity](figures/english-pronunciation-phase3/speaker-sensitivity.svg),
[largest rank disagreements](figures/english-pronunciation-phase3/rank-disagreements.svg).
The original Phase 2 score-distribution/scatter figures remain unchanged.

## 8. Independence and attribution boundary

Local Hub metadata, pinned training source, existing notice, Phase 2 checkpoint
metadata and dependency/artifact records still identify no training sample/speaker
manifest. Checkpoint keys are `model_state`, `metrics`, `unfreeze_top_n`, with 517
tensors; author metric values do not prove corpus independence. The training
source references private sentence/word evaluation spreadsheets and audio-file
splits, not a verifiable SpeechOcean exclusion list. The pinned model-card web
endpoint could not be retrieved in this phase; no missing content was invented.

**Training independence stays UNVERIFIED**, not documented overlap or documented
independence. No newly disclosed evidence resolves it. Domain transfer from the
children's training description to these Mandarin-native English learners is a
plausible hypothesis, not an established cause. None of this is independent
external validation or local Filipino-learner validation.

## 9. Prioritized improvement feasibility matrix

Every proposed performance test needs development and test **speakers separated
before tuning**. These 30 recordings have now been diagnosed and cannot serve as
a fresh untouched test set for improvements designed from these findings.

| Priority / proposal | Problem and evidence | Complexity / risks | Additional data and evaluation without leakage |
|---|---|---|---|
| 1 — A: deterministic preprocessing/alignment correction, if confirmed | No score bug demonstrated; missing timing diagnostics prevent acoustic attribution. | Medium: bounded diagnostic instrumentation and expert review; do not call a preference or dictionary variant a bug. | Separate development clips with independently reviewed boundaries, pure regression fixtures, then a fixed new-speaker test. Patch only a reproduced defect in a separately authorized task. |
| 1 — E: larger speaker-disjoint evaluation | Ten clusters, broad intervals, narrow human quality range. Strong reason to expand evidence before changing scoring. | Low/medium analysis, material data/permission/provenance work; larger n cannot fix unverified training overlap automatically. | Freeze new speaker IDs and quality coverage before seeing model outcomes, retain all failures, cluster by speaker. Reserve genuinely untouched evaluation speakers. |
| 1 — reference-variant contract (supports A/F) | 37 words differ between canonical sequences. | Medium/high phonetic review; never infer learner error from dictionary differences or use oracle test variants as a runtime improvement. | Reviewed English variants/dictionary policy on development speakers; document G2P/version and evaluate matching coverage plus real alignment quality on a new cohort. |
| 2 — C: rubric-matched representation | Phone mean and holistic accuracy are not calibrated equivalents. | Medium research/product decision: define phone feedback versus sentence rubric, boundaries and intended educational use; avoid presenting a grade as validated. | Independently rated dimensions with clear instructions and rater agreement; freeze the endpoint, not whatever metric correlates best. |
| 2 — F: phone error-detection evaluation | Phone outputs exist, but goodness/accents/binary flags differ and exact matches are selected. | Medium/high annotation/mapping work; severe label imbalance and nesting; post hoc cutpoints would inflate results. | Define error versus accepted variant before analysis, obtain reviewed phone/error labels and temporal correspondence; calibrate thresholds on development speakers only, test fixed precision/recall/AUC and failure coverage on new speakers. |
| 3 — D: separate-speaker calibration | Score meaning is uncalibrated; range conversion alone is insufficient. | Medium statistical work; calibration cannot repair bad references/alignment. A strictly monotone map cannot improve ordering except induced ties. | Separate development/calibration speakers and an untouched test cohort, matching rubric; preregister mapping and agreement metrics before test. No fit on these 30. |
| 3 — B: alternative aggregation | Phone-count weighting and low-score influence are confirmed; superiority of another rule is unproven. | Medium; severe overfitting risk if searching on this pilot or removing mistakes to increase scores. | Theory/rubric-led limited candidate set, development-only selection, locked test with comparable dimensions and uncertainty. No winning formula selected here. |
| 4 — G: alternative model | Current limitations justify a possible future comparator, not an immediate replacement or a claim another model is better. | High: licensing, hardware, preprocessing and target differences may dominate. | Only after reference/rubric/provenance contracts, benchmark appropriately licensed candidates under identical fixed speaker-disjoint conditions. No download or replacement now. |

Required design decisions before scoring changes: supported English variants and
stress policy; target dimension and rubric; error-label definition; calibration
and abstention strategy; development/test boundaries; intended population and
acceptable failure/uncertainty; author training provenance; consent/retention and
deployment rights. The pilot supplies no validated numerical acceptance threshold.

## 10. Execution, tests, artifacts and preservation

New research files are isolated under `services/api/ml/pronunciation_validation/`:
`diagnose_phase3.py`, `test_phase3.py`, `figures_phase3.py`. Existing scoring,
evaluator, analysis, tests and Phase 1–2 reports are untouched. Added this report,
two SVGs under `docs/figures/english-pronunciation-phase3/`, and only a phase-boundary
append in `docs/DECISIONS.md`.

Commands from `services/api`:

```powershell
./ml/wavlm/.venv/Scripts/python.exe -m ml.pronunciation_validation.diagnose_phase3 --phase2 private-data/english-validation-phase2 --source private-data/english-validation-phase1/source --output private-data/english-validation-phase3
./ml/wavlm/.venv/Scripts/python.exe -m ml.pronunciation_validation.figures_phase3 --diagnostics private-data/english-validation-phase3 --output ../../docs/figures/english-pronunciation-phase3
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest ml/pronunciation_validation/test_evaluate.py ml/pronunciation_validation/test_phase3.py -q --tb=short
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest tests/test_voice_safety.py tests/test_pronunciation.py tests/test_speech_recognition.py tests/test_pronunciation_assessment.py tests/test_wavlm.py tests/test_mms.py tests/test_whole_phrase.py tests/test_speech_audio_runtime.py tests/test_conversation_practice.py -q --tb=short -o faulthandler_timeout=30
./private-data/api-runtime/.venv/Scripts/python.exe -m compileall -q ml/pronunciation_validation
```

From repository root, reproducible isolated pure-function probes:

```powershell
./services/api/ml/wavlm/.venv/Scripts/python.exe services/api/private-data/english-validation-phase3/probe_alignment.py
```

| Fresh check | Actual outcome |
|---|---|
| Existing evaluation tests + nine new diagnostic join/group tests | **32 passed**, 0 failed, 5.25 seconds |
| Existing lightweight Voice regressions | **162 passed**, 0 failed, 3.85 seconds, bounded 90-second launcher |
| Unique pytest total | **194 passed, 0 failed** |
| Separate synthetic alignment probes | **6 PASS**; not added to pytest or real inference counts |
| Saved baseline reproduction | Exact association and bootstrap match |
| Model inference in Phase 3 | **Not rerun**; all acoustic predictions come from Phase 2 |
| Compilation | PASS |

The alignment probes extract only the existing pure function from local source,
without importing Torch or loading models. Tests use synthetic fixtures, not
invented human labels presented as real data. No failed/skipped case is hidden.
No full-project, PostgreSQL or native-device pass is claimed. Resource observation
showed 15.8645 GiB total and approximately 6.379 GiB available; no heavy operation
needed a model preflight or a threshold override.

Ignored evidence: `services/api/private-data/english-validation-phase3/` contains
`baseline-reproduced.json`, `diagnostics.json`, `diagnostic.csv`,
`aggregation-influence.csv`, `strict-phone-pairs.csv`,
`phone-sequence-differences.csv`, `speaker-diagnostics.csv`,
`leave-one-speaker-out.csv`, pure probe helper/results, resource observation,
test log, baseline/Phase 2 hashes and final artifact hashes. Scripts record input
and implementation SHA-256 and refuse overwriting existing diagnostic results.

No WavLM/MMS/API/UI/settings, checkpoint, Personal/Class Learning, FSRS-6/FIFAKT/
ESR, experiment assignment, student record or database changed. Tagalog ratings
remain disabled. No training, commit, push or deployment occurred. Preservation
verification is appended below.

Final verification: of **742** pre-existing tracked/unignored files, only the
documented DECISIONS append changed; exactly the six listed new report/code/figure
files were added. All **21 pre-existing Phase 2 evidence files** match entry hashes,
as do all original acquired source/audio files in the Phase 1 acquisition ledger.
Backend ignored `.env` hash matches. Both SVGs parse as valid XML; Python
compilation passed. `git diff --check` found no whitespace errors, only an unrelated
existing LF/CRLF advisory. No application-source references to the new diagnostic
modules were found (normal search exit 1). The final artifact manifest contains
21 hashes covering local evidence, new scripts/tests and figures.

## 11. Recommendation

The strongest supported explanation is **measurement/reference incompatibility
plus limited pilot evidence**, not a demonstrated arithmetic defect. Actual
acoustic alignment error, score calibration and generalization remain hypotheses
that need independent evidence. Do not assign the entire correlation shortfall
to any one cause.

**Next: define the reference-variant/target contract and run a larger newly sealed,
speaker-disjoint evaluation, with bounded alignment diagnostics on development
clips.** Preserve the existing scorer as baseline. Only then consider a separately
calibrated or rubric-led alternative, tested on new speakers. Controlled Filipino-
learner human validation remains necessary, with approved study/retention scope.
Stop after Phase 3.
