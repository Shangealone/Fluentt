# English pronunciation validation Phase 1 — SpeechOcean762

Date: **2026-10-31**. Overall **PARTIAL: dataset and evaluation preparation
completed; new real inference and validation BLOCKED by available RAM.** This is
not an independent external-validation PASS. Prior Section 8 genuine execution
is historical evidence, not a substitute for this frozen cohort's predictions.

## 1. Research question and separate outcomes

Question: do the unchanged FLUENTT English scorer's predictions associate with
independently human-rated pronunciation on a small public SpeechOcean762 pilot?
Even a successful association would not establish calibration, speaking
improvement, academic grading validity or transfer to Filipino learners.

| Requested status | Actual outcome |
|---|---|
| Dataset acquisition | **PASS** — 30 original recordings, 10 test speakers, matched expert annotations, integrity verified |
| Dataset independence from model development | **UNVERIFIED** — no public training corpus identity/utterance/speaker manifest establishes exclusion |
| Score comparability | **PARTIAL** — aggregate phone quality versus holistic sentence accuracy permits exploratory association, not calibrated numerical equivalence |
| Real WavLM inference, this phase | **BLOCKED** — 4.358 GiB available, below unchanged 5 GiB gate; no model loaded |
| Preliminary validation | **BLOCKED** — 0/30 scored, no correlations or errors estimated |
| Local Filipino learner validation | **NOT PERFORMED** |

Read Voice Sections 6–8, local pipeline/runtime/contracts, benchmark, preparation
script and notice, and relevant regression tests. Preserved every earlier report,
existing experimental result and unrelated working-tree change.

## 2. Exact scorer and existing procedure

Existing implementation: `services/api/ml/wavlm/pipeline.py`,
`worker.py`, `benchmark.py`, `prepare.py`; runtime/DTOs:
`services/api/app/modules/pronunciation/wavlm_runtime.py`, `wavlm_contract.py`.

| Artifact | Pinned identifier / revision |
|---|---|
| Actual learned scorer | `Jianshu001/wavlm-phoneme-scorer` / `19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da` |
| WavLM backbone configuration | `microsoft/wavlm-large` / `c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c` |
| CTC alignment | `facebook/wav2vec2-xlsr-53-espeak-cv-ft` / `2c733782da5604684829819a5eb744c193fe9398` |
| Prepared scorer bytes | SHA-256 `7b9485b679d9a1219ac7dbef197b5185ec16e7909632b082b1f0576a963e0040` |

This phase streamed and verified **all 16 prepared artifact hashes, totaling
2,550,095,935 bytes**, without loading tensors. No model was downloaded or
replaced. The evaluator imports the actual local `PronunciationAssessorV2` and
`worker.decode`; it does not instantiate a generic untrained backbone as a scorer.
Code/revision/cache hashes are recorded when an inference child successfully loads.

The worker decodes using existing FFmpeg to 16 kHz mono signed 16-bit WAV;
duration must be 0.5–30 seconds and normalized waveform standard deviation at
least .0005. It validates real decoded frame count. Reference text is required.
G2P uses prepared English resources and strips ARPABET stress digits. Expected
phones map to CTC symbols for Viterbi forced alignment; unmapped/empty/incomplete
alignment is rejected. A successful alignment is not proof of correct speech.

The trained WavLM-Large state and phone-scoring MLP use pooled segment features,
phone embedding, GOP and frame count. The regression head is clipped to 0–100;
a separate sigmoid output is `pherr_prob`. Phone scores round to one decimal;
word score is their mean; overall score is the mean over all phones, not an equal
mean of word scores. Existing error flags use **0.70**; no threshold was tuned.
GOP/error probability, score and human accuracy are different quantities. Neither
overall score nor error rate is a calibrated probability of good pronunciation.
There is no independently evaluated sentence fluency/prosody/completeness/stress
head. Existing uncertain/unvalidated API semantics remain unchanged.

The [pinned model card](https://huggingface.co/Jianshu001/wavlm-phoneme-scorer/blob/19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da/README.md)
describes children's English training with professional phone labels and audio-file
splits. Its published model metrics are author-reported, not reproduced here.
The [pinned training source](https://huggingface.co/Jianshu001/wavlm-phoneme-scorer/blob/19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da/finetune_wavlm.py)
was read as text only: it refers to local evaluation spreadsheets/audio directories,
not a public corpus/sample/speaker manifest. The linked Voice-correction branch
returned 404. A different training-set size or absence of the name SpeechOcean762
does not prove no derivatives, speakers or recordings overlap. Independence remains
**UNVERIFIED**, including backbone/alignment exposure. No overlap was positively
detected; no claim of disjointness is made.

## 3. Dataset provenance, human labels and rights

Authoritative [OpenSLR SLR101](https://www.openslr.org/101/) declares **CC BY 4.0**
and points to the [original repository](https://github.com/jimbozhang/speechocean762).
Original revision acquired: **`613968e3b0b789fc33936fb5eba1973176ba7d11`**.
OpenSLR advertises a 520 MB archive; that archive was not acquired.

The [dataset paper](https://arxiv.org/abs/2104.01378) describes 5,000 English
utterances from 250 Mandarin-native speakers, half children, with five independent
expert raters. This is external Mandarin-accented English material, not a Filipino
learner validation sample. The original test/train files each contain 2,500 IDs and
125 speakers; local inspection found **zero shared sample IDs or speaker IDs**.
These split checks do not establish disjointness from WavLM development.

Original `resource/scores.json` and `scores-detail.json` each have 5,000 entries.
The latter provides the five experts' raw scores. For all 30 selected utterances,
the sentence accuracy in the processed labels matches the median of the five raw
accuracy ratings, text matches both files and `test/text`, and speaker/audio path
matches `utt2spk`/`wav.scp`. Sentence accuracy has native scale 0–10; phone goodness
0–2, with word-level ARPABET phones and corresponding human scores. Dataset phone
labels rate expected phones; they are not time-aligned human acoustic boundaries
or raw recognizer outputs. Other rating dimensions were not merged into accuracy.

Both inspected Hub copies declare Apache-2.0:

| Candidate | Inspected revision | Decision |
|---|---|---|
| [seba3y mirror](https://huggingface.co/datasets/seba3y/speechocean762) | `7efb28ce7c4db45338b91afa0d25d0c4f7c62121` | Not used for audio/labels; inconsistent license metadata |
| [mispeech representation linked by publisher](https://huggingface.co/datasets/mispeech/speechocean762) | `06385584fad212b26134c656fdd3ccf9f093f33e` | Not used for new acquisition; same discrepancy |

**Resolution for this acquisition:** use the original revision and OpenSLR's
CC BY 4.0 terms, not mirror Apache metadata. No assertion is made that the mirror
maintainers have corrected or clarified their metadata. Original GitHub tree
contains no separately identified LICENSE file; the dataset publisher's OpenSLR
notice and original source provenance support this bounded public research use.
Retain attribution to Zhang et al./SpeechOcean/Xiaomi, source and
[license link](https://creativecommons.org/licenses/by/4.0/), and modification
notices. Original recordings are unchanged; selection/manifests/analysis are
derived. No endorsement or broad production legal clearance is implied.

Model rights remain separate: pinned scorer metadata declares MIT but its missing
copyright/license notice remains unresolved as documented in `ml/wavlm/NOTICE.md`.
Dataset permission does not clear checkpoint redistribution or deployment.
No recording, expert-label archive or checkpoint is added to Git.

## 4. Frozen selection and bounded acquisition

Checked local caches first: three previously exercised SpeechOcean clips existed.
They were not reused as this pilot's model outputs. This cohort was selected from
the original public test split without inspecting model performance or filtering
on human quality. **Seed 20261031**, Python's seeded sampling over sorted speaker
IDs: select ten speakers, then three sorted sampled utterances per speaker.

Selected speakers: `0093, 0112, 1030, 1050, 1061, 1186, 1465, 2438, 5432, 6902`.
Their documented ages are 6, 6, 27, 8, 7, 23, 8, 21, 11 and 12; five female/five
male. This chance balance was not engineered to maximize results. No Filipino
accent or broader demographic conclusions are supported.

Before retrieval, saved original revision, paths, Git-blob sizes and budget plan.
Metadata/annotations: **29,739,970 bytes**; selected audio: **3,806,952 bytes**;
dataset total **33,546,922 bytes**, plus small source/API metadata. This is well
below the authorized **314,572,800-byte (300 MiB)** cap. No full archive, Parquet
shard, model or training dataset download occurred. HTTP reads were size-bounded;
downloaded original files matched Git-blob SHA-1 and recorded SHA-256.

All **30/30** audio files passed format/duration/non-silence checks: 16 kHz mono
PCM16, 2.41–7.00 seconds, 118.926 seconds total. No sample was replaced. There
are zero duplicate selected audio hashes and zero duplicate selected reference
texts. Full-corpus acoustic/sentence duplicate analysis and matching against
private model-training recordings were not possible; split identity checks do
not exclude every near-duplicate risk. Manifest freezes ID, speaker, source
revision, audio hash/path, reference/hash, expert/aggregate labels and audio status.

## 5. Predeclared scoring compatibility and analysis

`run-v1/protocol.json` was written before any inference attempt. Primary endpoint:
unchanged model overall mean-phone score against official sentence **accuracy**,
using Pearson and tie-aware Spearman association. Correlation does not require
an artificial common range. No calibration subset, fitted score conversion,
threshold optimization or favorable-outcome sample selection exists.

**MAE/RMSE remain unset.** Multiplying human accuracy by ten matches range, not
necessarily meaning. An averaged phone regressor and a holistic ordinal expert
rubric are only partially comparable; reporting calibrated score agreement would
overstate evidence. If predictions later support a strict phone endpoint, require
matching word and stress-stripped phone identities at every position and report
excluded/variant phones separately; never transfer labels using speculative
alignment. That secondary endpoint was not executed or validated here.

The prepared association analysis uses 2,000 paired speaker-cluster bootstrap
draws, fixed seed, percentile intervals, only with at least eight scored speakers.
Ten selected speakers still imply unstable pilot uncertainty. No p-values,
passing accuracy threshold or target-population validation is manufactured.

## 6. Actual resource check and execution outcome

Existing CPU Torch runtime: Python **3.12.10**, Torch **2.11.0+cpu**,
Transformers **4.57.6**, NumPy **2.2.6**, psutil **7.2.2**, g2p-en **2.1.0**,
imageio-ffmpeg **0.6.0**. Exact environment/artifact manifest saved separately.
The installed Torch build is CPU-only; GPU inference was not attempted.
Current CPU CIM lookup was denied by this execution context; prior Section 8
identified an i5-10400/12 logical processors, not remeasured here.

| Measurement at actual run preflight | Value |
|---|---:|
| Installed physical RAM | 17,034,371,072 bytes / 15.8645 GiB |
| Available RAM | 4,679,245,824 bytes / approximately 4.358 GiB |
| Required available before WavLM | 5,368,709,120 bytes / 5 GiB |
| Free disk | 106,467,049,472 bytes / approximately 99.155 GiB |
| Detected other large speech-model processes | 0 |
| Model loaded / recordings inferred | **false / 0** |
| Initialization / inference latency / inference peak RAM | **Not measured; no load occurred** |

The production runtime and benchmark now both require **5 GiB available**, with
comments explaining prior approximately 4 GiB standalone usage plus host headroom.
Earlier 4 GiB discussions are historical, not authorization to lower today's gate.
Section 8's prior measured peaks do not establish available capacity today.
The diagnostic refused loading, did not close other apps and did not load MMS.
No repeated force-load or warm-load workaround occurred.

Every selected recording is in `evaluation.csv`/JSON with its actual human label,
blank/null model score, `status=not_run`, `reason=insufficient_memory`.
**Coverage is 0/30**, reflecting blocked execution, not 0% pronunciation accuracy.
Pearson, Spearman, MAE, RMSE and confidence intervals are **not estimated**.
No disagreement, ceiling-effect, accent or audio-sensitivity finding can be
inferred without model outputs. No comparison plot was generated from fake points.

The isolated executable uses actual local scoring/decoding, offline cache and
hash verification. Its supervisor preserves the 5 GiB gate, checks for overlap,
and has bounded initialization/sample/job deadlines and emergency memory stops.
The real inference branch remains **unexecuted in this phase**; passing synthetic
tests does not certify it or supersede the need for a real safe run.

## 7. QA commands and actual results

From `services/api`:

```powershell
./ml/wavlm/.venv/Scripts/python.exe -m ml.pronunciation_validation.evaluate prepare --folder private-data/english-validation-phase1 --output private-data/english-validation-phase1/run-v1
./ml/wavlm/.venv/Scripts/python.exe -m ml.pronunciation_validation.evaluate run --folder private-data/english-validation-phase1 --output private-data/english-validation-phase1/run-v1
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest ml/pronunciation_validation/test_evaluate.py -q --tb=short
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest tests/test_voice_safety.py tests/test_pronunciation.py tests/test_speech_recognition.py tests/test_pronunciation_assessment.py tests/test_wavlm.py tests/test_mms.py tests/test_whole_phrase.py tests/test_speech_audio_runtime.py tests/test_conversation_practice.py -q --tb=short -o faulthandler_timeout=30
./private-data/api-runtime/.venv/Scripts/python.exe -m compileall -q ml/pronunciation_validation
```

| Fresh check | Actual result |
|---|---|
| Isolated research-code tests | **23 passed**, 0 failed, 5.14 s (final run) |
| Relevant existing Voice tests | **162 passed**, 0 failed, 7.65 s |
| Total unique selected tests | **185 passed, 0 failed**; earlier smaller/repeated runs not added again |
| Python compilation | PASS |
| Native device, PostgreSQL integration, model-accuracy evaluation | NOT RUN; no claim |

Synthetic tests verify deterministic speaker-balanced selection, split leakage
rejection, exact sample matching, corruption/hash/label rejection, no invented
correlations for constant/missing outputs, failed/not-run denominator retention,
tied ranks, known analytic associations, cluster resampling and download bounds.
Their fake audio/scores are fixtures, not human evaluation or real model inference.
The added low-memory test initially failed because the lightweight API test
environment lacks psutil; the actual ML environment has it. Corrected the test
to inject its explicit synthetic resource provider rather than adding a backend
dependency. Final 23-case run passed; this intermediate fixture failure is not
hidden or counted as an inference result. The test proves a simulated low-memory
condition cannot launch a model process.

The first restricted Voice suite stalled at the upload-limit test after 85
completed cases. It is recorded as **incomplete**, not a PASS or a proven product
failure. A bounded 90-second rerun in the approved execution context completed
the entire suite, including that test; no source fix was required. The exact
root cause of the first wait was not established. The original identified pytest
process was stopped afterward; no unrelated process was stopped. Final full log:
`services/api/private-data/english-validation-phase1/voice-tests.txt`.

## 8. Artifacts, preservation and limits

Added source/documentation files:

- `docs/ENGLISH_PRONUNCIATION_VALIDATION_PHASE1.md`
- `services/api/ml/pronunciation_validation/__init__.py`
- `services/api/ml/pronunciation_validation/acquire.py`
- `services/api/ml/pronunciation_validation/evaluate.py`
- `services/api/ml/pronunciation_validation/test_evaluate.py`
- `services/api/ml/pronunciation_validation/README.md`

Appended only the phase-boundary note in `docs/DECISIONS.md`.
Ignored local evidence root:
`services/api/private-data/english-validation-phase1/` contains source files/audio,
`acquisition.json`, `download-plan.json`, official tree and small Hub API/training
source text, `environment.json`, baseline/environment hashes, test log and
`run-v1/protocol.json`, `manifest.json`, `evaluation.csv`, `evaluation.json`,
`analysis.json`, `resources.json`. Source/audio hashes are included. No credentials
are needed in these public-data outputs. Reproduction commands and acquisition
script are in the isolated README; outputs refuse overwrite.

No production source, Voice UI/API behavior, language settings, Tagalog scoring,
English thresholds, model cache contents, dependency environment, Personal/Class
Learning, FSRS-6/FIFAKT/ESR, assignment, allocation, migration or database was
changed. No model training/fine-tuning, participant recording, commit, push or
deployment occurred. Final baseline/hash checks are recorded below.

Final verification compared **732** pre-existing tracked/unignored file hashes:
only the documented `docs/DECISIONS.md` append differs; all other baseline bytes
match. Backend ignored `.env` hash matches. Exactly the six added files listed
above are new. All 16 existing model-artifact hashes passed verification. The
ignored evidence snapshot has `artifact-sha256.json` covering 57 files (source,
audio, manifests and diagnostics). `git diff --check` found no whitespace errors;
Git emitted only an unrelated existing LF/CRLF advisory. Application-source search
found no imports/references to `pronunciation_validation`. Thus neither the
prototype nor its downloader is wired into student or production paths.

## 9. Requirements before preliminary and local validation

1. Free enough host memory for the **unchanged 5 GiB available gate** plus
   operating margin; retain API/host headroom and sequential model loading. Then
   use a new run directory with the same frozen cohort/protocol, not a selected
   subset of favorable predictions. Current load lacked about .642 GiB just to
   meet the gate; capacity fluctuates, so that difference is not a guarantee.
2. Obtain the scorer author's corpus/sample/speaker provenance or explicitly retain
   independence UNVERIFIED. This Phase 1 does not establish independent external
   validation even if a later correlation is positive.
3. Execute and inspect real predictions/failures, coverage and speaker-aware
   uncertainty; determine whether sentence association or a separately specified
   compatible phone endpoint is informative. Do not retune on this frozen test set.
4. Before Thesis 2, approve local consent/retention and a Filipino-learner held-out
   study, independent trained raters, rubric, agreement analysis, calibration/test
   separation and performance/failure/fairness acceptance criteria. Resolve model
   deployment/redistribution rights separately. Do not turn exploratory score bands
   into academic grades.

**Conclusion:** the existing scorer has prior functional real-inference evidence,
but this phase adds **no empirical model–human validation result**. It establishes
a legally sourced, matched, frozen small pilot and tested analysis preparation.
Student-facing English remains explicitly unvalidated; Tagalog pronunciation
ratings remain disabled. Stop after Phase 1.
