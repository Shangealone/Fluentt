# English pronunciation validation Phase 2 — frozen pilot execution

Date: **2026-10-31**. **Technical execution PASS; preliminary validation PARTIAL.**
All 30 public recordings from ten speakers produced genuine model outputs.
This is exploratory association evidence, **not independent external validation**,
calibrated grading, or validation for Filipino learners.

## 1. Status and scope

| Area | Verified outcome |
|---|---|
| Frozen cohort/protocol preservation | PASS — byte-identical Phase 1 manifest/protocol, all 30 audio hashes verified |
| Actual WavLM execution | PASS — 30 scored, zero failed, zero not-run; no model doubles |
| Score comparability | PARTIAL — mean-phone quality and holistic sentence accuracy support exploratory association, not calibrated numerical equivalence |
| Dataset independence from model development | **UNVERIFIED** |
| Preliminary validation | **PARTIAL** — positive pilot correlations, small sample and wide speaker-aware uncertainty |
| Local Filipino learner validation | **NOT PERFORMED** |

Read `ENGLISH_PRONUNCIATION_VALIDATION_PHASE1.md`, the actual evaluator, frozen
artifacts, model loader/decoder, contracts, notice and completed tests before
execution. No dataset was recreated or selected again. No calibration, threshold,
reference text or scoring procedure changed. The existing evaluator's `run` mode
processed copied frozen inputs in a new evidence folder, preserving Phase 1.

## 2. Exact data, model and provenance

SpeechOcean762 original revision:
**`613968e3b0b789fc33936fb5eba1973176ba7d11`**. Public test cohort: 30
utterances, ten speakers, three per speaker, selection seed **20261031**.
Speakers: `0093, 0112, 1030, 1050, 1061, 1186, 1465, 2438, 5432, 6902`.
No score-based exclusions or replacements occurred. Dataset credit remains
Zhang et al., SpeechOcean Ltd./Xiaomi, 2021; original
[source](https://github.com/jimbozhang/speechocean762) and
[OpenSLR CC BY 4.0 notice](https://www.openslr.org/101/), rather than conflicting
Hub Apache metadata, govern this acquisition. No new download occurred.

The cohort contains Mandarin-native English learners, including children and
adults. Its expert ratings are independently produced human labels; that does
not establish the model never saw these recordings or speakers.

| Artifact | Exact revision |
|---|---|
| `Jianshu001/wavlm-phoneme-scorer` | `19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da` |
| `microsoft/wavlm-large` backbone configuration | `c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c` |
| `facebook/wav2vec2-xlsr-53-espeak-cv-ft` alignment | `2c733782da5604684829819a5eb744c193fe9398` |

The actual scorer state was loaded from the existing local checkpoint; no generic
backbone substituted for the learned head. All **16 artifact hashes** were verified
before loading and again afterward, totaling **2,550,095,935 bytes**. Scorer
SHA-256: `7b9485b679d9a1219ac7dbef197b5185ec16e7909632b082b1f0576a963e0040`.

Loaded local implementation hashes:

```text
pipeline.py  712fe2b6a8d3f1c71e5bd36e1923e9deab105fa4028d1ff5d8e3b98698bc47e9
worker.py    ee21dd28437d526da5d30708620790c8c6fc62799f3548ebc046a46d88c29d10
cache manifest bc09e881ef2cdabbf8441a2a218d9e34ac56572c649fb651ba91581540b14ca8
cohort manifest 082aadee6123ffeb7e4e5cecd59a17415b1c7415ace0af528072719a825cd716
protocol     b74324cef82d0e8331c01a6ed5db3517881fef2de67c9c9dbeeebc0aa432cb00
```

Inference reused `PronunciationAssessorV2` from `services/api/ml/wavlm/pipeline.py`
and the actual `worker.decode`. Existing FFmpeg produces 16 kHz mono PCM16;
silence/duration validation, English G2P and stress stripping, CTC forced alignment,
WavLM segment pooling and learned scoring heads were preserved. This is the same
underlying pipeline as the backend, executed directly on public test files; it
does not newly test authenticated API persistence or microphone/device capture.

Environment: Python **3.12.10**, Torch **2.11.0+cpu**, Transformers **4.57.6**,
NumPy **2.2.6**, psutil **7.2.2**, g2p-en **2.1.0**, imageio-ffmpeg **0.6.0**.
CPU, two Torch threads, local/offline artifacts; no dependency changes or remote
Python execution. Full versions/hashes are in the phase evidence manifest.

## 3. Hardware preflight and actual execution

| Measurement | Actual observation |
|---|---:|
| Physical RAM | 15.8645 GiB |
| Initial inspection available RAM | 8.0536 GiB |
| Evaluator available RAM before child | 8.0794 GiB |
| Unchanged starting requirement | **5 GiB available** |
| Other detected speech-model workers before/after | **0 / 0** |
| Initialization after imports/hash checks | 7,342 ms |
| Whole supervised job | 103.651 seconds |
| Sampled peak child-process-tree RSS | 4.2600 GiB |
| Lowest sampled system available RAM | 3.7733 GiB |
| Available after scoring child exit | 8.0948 GiB |
| Emergency stop / process exit | None / exit 0 |

The 5 GiB gate passed before spawning, at child startup and immediately before
model loading. It is a starting-capacity requirement, not a requirement that
5 GiB remain unused after the model loads. The unchanged supervisor sampled every
100 ms, with emergency guards at 1.5 GiB remaining and 6.5 GiB child-tree RSS,
90-second initialization, 45-second per-sample and 600-second total deadlines.
No guard triggered or was bypassed. RSS is a sampled working-set observation,
not an exact exclusive-memory maximum. No MMS/Allosaurus model loaded, and no
unrelated application was terminated. Child exit released scoring resources.

## 4. Genuine predictions and processing coverage

**30/30 scored (100% processing coverage), zero failed, zero skipped/not-run.**
Post-run verification matched exact ordered sample/speaker IDs, reference hashes,
raw reference text, selected human labels and model revision. Every overall score
reproduces the rounded mean of actual returned phone scores. Complete outputs
contain **179 word predictions and 567 phone predictions**. The existing .70
error-probability threshold flagged **41 phones**; these are model flags, not
41 independently confirmed pronunciation errors. This pilot does not estimate
phone error detection precision, recall or accuracy.

Processing time includes decode and assessment, excluding model initialization:

| Per recording | Milliseconds |
|---|---:|
| Minimum | 1,303 |
| Median | 1,888.5 |
| Mean | 2,102.7 |
| P95, nearest-rank over 30 observations | 3,374 |
| Maximum | 3,625 |

Total per-sample processing was **63.080 seconds** for **118.926 seconds** of
recorded audio. These short sequential CPU timings are not concurrent-service,
long-audio, Android, or deployment p95 guarantees. No decoding, alignment or
source-integrity failure occurred on this particular cohort.

## 5. Prespecified comparison and actual metrics

Preserved primary endpoint: model overall **mean-phone score (0–100)** versus
official expert **sentence accuracy (0–10)**, the median of five expert accuracy
ratings for each selected utterance. Word/phone outputs and sigmoid error
probability are different endpoints. No fluency, stress, completeness, prosody or
ASR text similarity was substituted for expert accuracy.

No transformation was fitted or applied for association. **MAE/RMSE are not
calculated**: multiplying an ordinal holistic rating by ten does not establish
semantic/calibrated equivalence to an averaged phone regressor. This follows the
frozen Phase 1 protocol, rather than a decision chosen after seeing performance.

| Descriptive statistic | Human sentence accuracy, native 0–10 | Model mean-phone score, native 0–100 |
|---|---:|---:|
| Minimum / maximum | 4 / 9 | 72.2 / 94.3 |
| Mean | 7.8333 | 85.3200 |
| Median | 8 | 86.5 |
| Sample standard deviation | 1.1472 | 6.3733 |

| Prespecified association | Estimate | Speaker-cluster bootstrap percentile 95% interval |
|---|---:|---:|
| Pearson r | **0.421627** | **0.135690–0.751757** |
| Spearman rho, average ranks for ties | **0.511326** | **0.193038–0.750324** |

Uncertainty uses the frozen **2,000 draws, seed 20261031**, resampling ten speakers
with replacement and carrying all their selected recordings together. All 2,000
draws gave defined estimates. It does not treat 30 correlated recordings as 30
independent speakers. Ten clusters still yield unstable pilot uncertainty; no
p-value, statistical-significance claim or numerical acceptance threshold is
introduced. The existing analysis was rerun from saved raw outputs and reproduced
the saved metrics exactly.

### Figures

- [Native-scale model versus expert scatter](figures/english-pronunciation-phase2/model-vs-expert.svg)
- [Separate score distributions](figures/english-pronunciation-phase2/score-distributions.svg)

Both figures use actual observations, native axes, no jitter, conversion,
calibration regression line or identity line. Hover labels in the SVG scatter
identify individual samples. Matplotlib is absent from the existing ML and bundled
Python environments; dependency-free SVG generation avoids modifying either.

## 6. Speaker-level observations and limitations

All ten speakers contributed exactly three successful recordings. Speaker means
are descriptive and not stable proficiency estimates:

| Speaker | Human mean /10 | Model mean /100 |
|---|---:|---:|
| 0093 | 8.33 | 88.23 |
| 0112 | 7.33 | 82.43 |
| 1030 | 9.00 | 91.67 |
| 1050 | 7.33 | 82.23 |
| 1061 | 7.33 | 83.40 |
| 1186 | 7.00 | 86.00 |
| 1465 | 8.33 | 85.07 |
| 2438 | 8.33 | 90.90 |
| 5432 | 8.33 | 88.20 |
| 6902 | 7.00 | 75.07 |

Association does not guarantee agreement for individuals. For example,
`001120013` has human accuracy **4/10**, model **81.8/100**, and three model phone
flags. `011860377` has human accuracy **6/10**, model **91.9/100**, and zero flags.
These are native-scale observations, not calculated calibrated errors. No reference
text or rating was repaired, and no transformation was changed to improve them.
Acoustic listening/adjudication was not performed, so neither example establishes
whether the human rating, model, alignment, variant pronunciation or other context
caused disagreement.

The observed human range lacks ratings 0–3 and 10; model predictions cluster high.
This limits low-quality/silent/near-perfect discrimination conclusions and may
compress apparent quality differences. No score hit 100; a confirmed saturation
mechanism is not inferred. All inputs passed existing audio checks, but no noise,
microphone or accent robustness experiment occurred. Three recordings per speaker
cannot characterize within-speaker performance reliably. Phoneme-level human
matching and phone-level validation metrics were not performed or merged into
the sentence association analysis.

## 7. Training-data independence investigation

Re-examined local Phase 1 Hub metadata/card fields, pinned training-source text,
existing notice, prepared artifacts and actual checkpoint metadata. The checkpoint
has only `model_state`, `metrics`, `unfreeze_top_n`; 517 state tensors, top six
layers unfrozen, and author metric keys. It contains **no dataset/sample/speaker
manifest**. Metadata inspection used reviewed restricted `weights_only=True`, mmap,
after another resource check; no new model was instantiated or inference run.

Pinned [training source](https://huggingface.co/Jianshu001/wavlm-phoneme-scorer/blob/19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da/finetune_wavlm.py)
references local sentence/word evaluation spreadsheets and audio directories and
splits by audio file. It does not supply source corpus identities or a speaker
split/exclusion manifest. The pinned
[model card](https://huggingface.co/Jianshu001/wavlm-phoneme-scorer/blob/19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da/README.md)
and Phase 1 investigation do not establish SpeechOcean exclusion. No new network
access occurred in Phase 2. Previous missing repository/notice findings are
preserved, not represented as newly resolved.

**Independence: UNVERIFIED**, not VERIFIED or OVERLAP DETECTED. Independent human
rating collection and official train/test speaker separation do not prove no
overlap with the scorer/backbone/alignment model's development data. Author
provenance clarification or a demonstrably disjoint cohort is still needed before
calling this independent external validation. Existing model/deployment licensing
questions remain separate and unresolved.

## 8. Commands, tests and reproducibility evidence

Evidence root: `services/api/private-data/english-validation-phase2/` (ignored).
The exact Phase 1 `manifest.json` and `protocol.json` were copied byte-for-byte;
the existing `run` command was invoked without `prepare` or `acquire`:

```powershell
# From services/api:
./ml/wavlm/.venv/Scripts/python.exe -m ml.pronunciation_validation.evaluate run --folder private-data/english-validation-phase1 --output private-data/english-validation-phase2
./ml/wavlm/.venv/Scripts/python.exe -m ml.pronunciation_validation.summarize_phase2 --run private-data/english-validation-phase2 --figures ../../docs/figures/english-pronunciation-phase2
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest ml/pronunciation_validation/test_evaluate.py -q --tb=short
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest tests/test_voice_safety.py tests/test_pronunciation.py tests/test_speech_recognition.py tests/test_pronunciation_assessment.py tests/test_wavlm.py tests/test_mms.py tests/test_whole_phrase.py tests/test_speech_audio_runtime.py tests/test_conversation_practice.py -q --tb=short -o faulthandler_timeout=30
```

| Fresh verification | Actual result |
|---|---|
| Existing isolated research tests | **23 passed, 0 failed**, 5.27 seconds |
| Existing lightweight Voice regressions | **162 passed, 0 failed**, 3.85 seconds, bounded 90-second launcher |
| Unique selected test total | **185 passed, 0 failed** |
| Genuine recordings | **30 scored**, separately from synthetic tests |
| Matched output/score aggregation checks | PASS for all 30; all flags match unchanged .70 rule |
| Saved analysis reproduction | Exact match |
| SVG XML/coordinate specification | Both parse successfully |

No stalled test occurred in this phase; the approved execution context avoided
the earlier restricted-run upload-limit stall. Regression tests use model doubles;
they are distinct from the actual WavLM run. No full-project, native device or
PostgreSQL integration PASS is claimed. No database was accessed.

Important files under the ignored evidence root:

- `evaluation.csv`: matched sample/speaker/reference IDs, expert accuracy, actual
  model score, status and dataset/model revisions.
- `evaluation.json` and `partial-results.json`: complete actual raw word/phone
  outputs, per-sample latency and duration, reasons/statuses.
- `analysis.json`, `speaker-summary.csv`, `postrun-verification.json`: reproduced
  statistics, uncertainty, speaker summaries, coverage and latency observations.
- `initial-preflight.json`, `resources.json`, `post-exit-resources.json`,
  `loaded.json`, `inference-stdout.txt`, `inference-stderr.txt`: actual execution
  evidence. Inference stderr was empty; complete process exit was observed.
- `environment.json`, `checkpoint-metadata.json`, baseline/env hashes and final
  artifact SHA-256 manifest: environment, provenance and preservation evidence.
- `voice-tests.txt`: full bounded regression output.

Do not rerun into this folder: the evaluator refuses overwrite. Future authorized
replication must copy the frozen inputs into a new output folder and keep the
same source-data root. Phase 1 evidence and recordings remain untouched.

## 9. Changes and protected components

New source/documentation artifacts:

- `docs/ENGLISH_PRONUNCIATION_VALIDATION_PHASE2.md`
- `docs/figures/english-pronunciation-phase2/model-vs-expert.svg`
- `docs/figures/english-pronunciation-phase2/score-distributions.svg`
- `services/api/ml/pronunciation_validation/summarize_phase2.py`

Only `docs/DECISIONS.md` receives a phase-boundary append. The new summarizer
checks and visualizes saved results; it does not alter the evaluator, protocol,
scoring, checkpoint or source dataset. It adds no application imports/dependencies.
No production WavLM/MMS/API/UI/settings, Personal/Class Learning, FSRS-6/FIFAKT/
ESR, assignment, allocation, database schema/record or prior report changed. No
download, training, commit, push or deployment occurred. Tagalog pronunciation
ratings remain disabled. Final preservation checks are recorded below.

Final checks: **738** pre-existing tracked/unignored files were compared with
their entry SHA-256 values; only the documented DECISIONS append differs. Exactly
the four new files listed above were added. Backend ignored `.env` matches its
entry hash. Frozen cohort/protocol copies remain byte-identical to Phase 1. No
speech-model process remains. `artifact-sha256.json` records 23 evidence/code/figure
hashes; original model hashes also matched after execution. Python compilation
passed. `git diff --check` found no whitespace errors (only an unrelated existing
LF/CRLF advisory). Application-source search found no research-module imports;
its no-match exit 1 is expected, not a failed regression test.

## 10. Scientific interpretation and next research step

The model runs successfully on this cohort and its aggregate scores have a
positive but imperfect association with expert sentence accuracy, with substantial
uncertainty and visible individual disagreements. This is preliminary evidence
worth investigating, **not evidence that a score is an accurate academic grade**
or that using FLUENTT improves speaking ability.

**Proceed to planning controlled local human validation, not scoring rollout.**
That next study should have approved consent/retention, independently rated
Filipino-learner speech, a fixed rubric and rater-agreement checks, justified
sample/speaker coverage, and separate calibration/test samples. Resolve training
provenance or retain the explicit independence limitation. Preregister dimension-
appropriate performance, failure and fairness criteria before examining final
local test results. No local participants are recruited or recorded in Phase 2.

Stop after Phase 2.
