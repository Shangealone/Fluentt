# ESR training data and environment audit

Date: 2026-11-02, Asia/Manila

## Outcome

Public-data baseline reproduction is a feasible **development candidate**, subject to correcting the inspected source and running a bounded smoke test. There is not yet enough evidence to train and enable the intended format-aware Fluentt treatment. Do not install or run the upstream training scripts unchanged.

This audit retrieved public source and dataset metadata, inspected the local computer, and parsed nine upstream Python files without executing them. It did not download learner records, embeddings or weights; install dependencies; train a model; change the API environment; or touch participant records. No GPU benchmark or dataset-content audit was performed.

## Evidence retained

Source pinned to `a03e248141fc32a96dc6fda3bb6ae52be621bb9a`. Eleven files were retained: nine Python files, README and LICENSE. Each has a SHA-256 entry. The pinned recursive tree contains 23 files and no `.pt`, `.pth`, `.ckpt` or `.safetensors` files. It also contains no requirements/lock/environment manifest. This does not rule out a checkpoint published elsewhere.

Local evidence is under ignored `private-data/esr-training-audit-20261102/`: source manifest, original source, recursive tree, static import/syntax report and dataset metadata. Upstream files were not modified. Retain their MIT copyright/license notice if code is incorporated.

Primary references:

- [Pinned author repository](https://github.com/BoxuanMa/FIFAKT/tree/a03e248141fc32a96dc6fda3bb6ae52be621bb9a)
- [Duolingo preprocessing](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Duolingo/generate_dkt_features.py)
- [Duolingo trainer](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Duolingo/train.py)
- [Duolingo model](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Duolingo/models.py)
- [Tagetomo model](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Tagetomo/models.py)
- [Dataset landing page](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/N8XJME), [metadata API](https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:10.7910/DVN/N8XJME)
- [fastText vectors and terms](https://fasttext.cc/docs/en/crawl-vectors.html)
- [PyTorch installation guidance](https://pytorch.org/get-started/locally/) and [CUDA architecture change notice](https://dev-discuss.pytorch.org/t/cuda-toolkit-version-and-architecture-support-update-maxwell-and-pascal-architecture-support-removed-in-cuda-12-8-and-12-9-builds/3128)

## Data and transfer feasibility

| Resource | Verified evidence | Decision |
|---|---|---|
| Public Duolingo learning traces | Metadata describes about 13 million learning traces. File ID 3091087, `settles.acl16.learning_traces.13m.csv.gz`, 379,004,009 bytes, publisher MD5 `0a1cae5eb7ad4b0bd9c0de91d74fcced`. Metadata terms state CC BY-NC 4.0. | Candidate for noncommercial research reproduction with required attribution and documented intended use. Download and content validation have not occurred. A publisher MD5 is provenance/integrity information, not a model hash or security endorsement. |
| Duolingo model input | Inspected preprocessing consumes recall proportion, timestamp, elapsed interval, coded learner/item, language/lexeme and history/session counts. It has no explicit question-format input. | Do not invent multiple-choice/typed-recall labels or interpret this baseline as a trained format-aware Fluentt model. Confirm actual language coverage after a permitted content scan; no Tagalog coverage has been established. |
| Tagetomo | Author README identifies the data as private to Obunsha. The model uses a 13-category format encoding. | No access or permission established. Numeric categories must not be mapped to Fluentt formats by position. |
| fastText Common Crawl vectors | Author embedding code expects 300-dimensional binary fastText vectors. Distributor lists CC BY-SA 3.0 for these vectors. | Separate terms from the MIT source and Duolingo dataset. Record the exact language artifact, hash, attribution and intended distribution before use. No vectors downloaded. |
| Fluentt development encounters | No approved format-aware development dataset or trained checkpoint was provided. | This remains an external data requirement. Do not substitute formal intervention outcomes, ordinary classroom answers or fabricated observations. |

The available public data can support investigating the baseline. It does not establish transfer to younger Fluentt learners, both languages, two formats, or calibrated recall at a requested future horizon. These require development evidence distinct from the formal intervention.

## Source issues to resolve before reproduction

These are static findings, not claims of executed training failures:

1. **Missing parser initialization:** `Duolingo/generate_dkt_features.py` calls `parser.add_argument` without defining `parser` in the file. A clean script invocation cannot rely on an interactive variable.
2. **CSV/path mismatch:** `duolingo_en.py` exports an index column; the embedding script expects that indexed layout, while the feature generator unpacks twelve fields. Trainer/preprocessor/embedding defaults also use different English/all-language names and directories. Replace implicit defaults with an explicit, validated stage manifest.
3. **Non-finite count features:** feature preprocessing takes `log(count)` directly. Any zero count produces a non-finite value. First measure actual occurrences; a repaired transform must be documented and consistently applied in training and inference, rather than silently changing the original experiment.
4. **Fixed split size:** preprocessing assumes 5,014,790 lines. It must not be reused as the length of an arbitrary sample or full corpus. Recompute documented cutoffs and prove evaluation masks exclude training targets. Upstream suffix-based sequence carryover is not participant-disjoint validation.
5. **Batch/time semantics:** the trainer's DataLoader supplies batch-first tensors and its call site does not transpose them. The model creates an LSTM without `batch_first=True`, while its surrounding attention/slices treat the second axis as time. This appears to recur across batch members instead of each learner's time sequence. Verify with batch-permutation and cross-learner independence tests before choosing a documented repair. Do not claim a faithful reproduction or causal inference from successful tensor execution alone.
6. **Runtime portability:** scripts use CUDA AMP APIs, a batch size of 256, a very large epoch ceiling with early stopping, hardcoded embedding/item dimensions and import-time training setup. Defaulting to CPU does not establish that all operations are CPU-safe. Resolve CPU/GPU paths, finite checks, a strict step budget and argument parsing explicitly.
7. **Inference boundary:** training forward methods accept targets to form historical inputs and compute loss. A production adapter needs separate target-safe prediction, correct history shifts, padding masks and future-timestep features. Changing a held-out response or an unrelated learner must not change the candidate prediction. A current-task probability must not be relabelled as a validated future-recall forecast.

None of these issues was patched in the retained upstream snapshot. Any adaptation must have its own revision and change log.

## Local environment

Observed on 2026-11-02; free memory and disk change over time:

| Item | Observation |
|---|---|
| CPU | AMD Ryzen 5 3600, 6 cores / 12 logical processors |
| RAM | 17,107,681,280 physical bytes, approximately 15.9 GiB; about 3.25 GiB available at inspection |
| GPU | NVIDIA GeForce GT 1030, 2,048 MiB; compute capability 6.1 |
| Driver | 581.80; `nvidia-smi` advertises CUDA 13.0 driver compatibility |
| Storage | Approximately 1.2 GiB free on C: and 34.5 GiB on F: |
| API Python | 3.12.14; Torch not installed in the API environment |

The driver's CUDA version does not prove that a particular PyTorch wheel supports this Pascal GPU. Official PyTorch notices exclude Pascal from CUDA 12.8/12.9 builds starting in release 2.8. Choose a specifically verified compatible build for any GPU test; do not install the latest CUDA wheel blindly. Current web installation pages give mixed release-era details, so resolve the actual wheel/Python/architecture combination before pinning it.

**Practical next step:** a small CPU smoke test in a separate environment on F:, with bounded sequences, batches and steps. It must establish finite loss, a real gradient update, participant independence, causal target handling and save/reload prediction equivalence before any real-data run. Synthetic smoke-test inputs prove engineering behavior only, not learned accuracy. Keep cache/temp paths on F: to avoid filling C:. No trustworthy full-training time estimate exists yet.

The GT 1030 may be considered for a later verified small GPU test; its 2 GiB and shared desktop usage are constraints. Full training suitability requires measured memory/throughput. A larger GPU or hosted environment is an option after measurement, not a purchase or deployment authorized by this audit.

## Dependency and reproduction handoff

Source imports indicate PyTorch, NumPy, pandas, scikit-learn and fastText; the repository does not provide exact original versions. Standard-library imports need no package installation. Do not generate a lock file that pretends untested versions reproduce the paper.

Next bounded engineering task:

1. Create an isolated F: training environment, leaving the API environment unchanged. Resolve and record actual dependency versions for the selected CPU-first runtime.
2. Implement a minimal, documented repaired model/preprocessing harness with the source findings above covered by tests. Retain a pristine upstream snapshot and a patch/adaptation log. Do not silently run the unchanged trainer.
3. Run the bounded synthetic smoke test and record actual duration, peak memory, loss/gradient and causality results. Stop on non-finite values or learner/target leakage.
4. Download the licensed public corpus only as a separate deliberate dataset stage, validate its publisher checksum, compute SHA-256 and inspect schema/count/language/zero-count distributions without printing learner identities.
5. Reproduce a versioned public-data baseline. Acquire permitted format-aware development encounters and validate the Fluentt adaptation before connecting it to ESR.

The original numerical scheduler/calendar choices and formal study approval remain separate. The app's study activation guard stays unchanged. The learner-facing UI remains free of model/provider names.
