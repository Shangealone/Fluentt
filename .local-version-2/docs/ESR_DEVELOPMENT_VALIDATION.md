# FIFAKT-derived model development and held-out evaluation

Date: 2026-11-05, Asia/Manila. **Overall PARTIAL; application deployment BLOCKED.**

A genuine, reduced-size FIFAKT-derived development model was trained and tested on a frozen public-data cohort on this PC. It passed the prespecified paired-MAE criterion against two simple baselines, but evidence is mixed across metrics. This does not validate a FLUENTT future-recall predictor, reproduce the original paper, or activate the study.

## Scope, source, and permissions

Work is in `versions/fluentt-version5-combined/.local-version-2` on branch `codex/version5-wavlm-integration`, after merge commit `942a2a7`. No production application, model provider, scheduling policy, database, participant, experimental allocation or Voice code was modified. No training checkpoint/data is committed or redistributed. No new commit or push was made for this task.

- Architecture reference: [Ma et al., Each Encounter Counts: Modeling Language Learning and Forgetting](https://github.com/BoxuanMa/FIFAKT), LAK 2023, pp. 79–88. Reverified [pinned author README](https://raw.githubusercontent.com/BoxuanMa/FIFAKT/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/README.md) and [MIT license](https://raw.githubusercontent.com/BoxuanMa/FIFAKT/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/LICENSE), copyright 2022 Boxuan Ma. Copies/hashes are retained in ignored `private-data/esr-training/upstream-evidence/`. Existing UPSTREAM_FIFAKT_LICENSE.txt is preserved.
- Data: [Settles and Meeder (2016), A Trainable Spaced Repetition Model for Language Learning](https://doi.org/10.7910/DVN/N8XJME). Publisher API: https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:10.7910/DVN/N8XJME . Saved terms explicitly link CC BY-NC 4.0; the single file is unrestricted in that metadata. MIT code does not override dataset terms. No commercial/deployed-weight rights clearance is inferred.
- Downloaded 379,004,009 compressed bytes in 107.182 seconds including verification. Publisher MD5 `0a1cae5eb7ad4b0bd9c0de91d74fcced`; SHA-256 `26cf9b33f2e9b2e8aa9a8f262a017b30699ca2f625c56a12ce699d4ea7076873` matched the historical report. Saved publisher metadata and provenance stay with the local data.
- Earlier F:/FLUENTT training environment/data/checkpoint described by version 5 were not present here. They were not assumed available or reused silently. No FLUENTT learner records were used.

## Environment and resource evidence

Observed total physical RAM: **15.864 GiB**, 12 logical CPUs. Available RAM at initial inspection: **5.263 GiB**; immediately before supervised training: **6,021,226,496 bytes (5.608 GiB)**. More than 77 GiB was free on C: at inspection. Model execution used CPU only, two Torch threads, no WavLM or MMS weights.

Created `private-data/esr-training/.venv` using Python **3.12.10**, Torch **2.11.0+cpu**, psutil **7.2.2**. API and speech environments were not modified. Initial combined install failed because psutil is absent from the PyTorch index; resolved by using the official PyTorch index for Torch and PyPI for psutil. `pip check` passed. Torch's unused NumPy initialization warning is recorded; this pipeline uses Torch/standard-library arithmetic and does not require NumPy.

Exact observed dependency pins, including the official Windows CPU wheel URL/hash, are in `services/api/training/esr/requirements-development-windows-py312.txt`. They are not claimed to match the paper's original environment.

## Frozen protocol and partitions

Protocol written before fitting/evaluation: `services/api/training/esr/DEVELOPMENT_VALIDATION.md`; executed protocol SHA-256 `40ce68e67dd95735a904b7d14737a276db6a5b87cd78ecfc12da8be29c464e0c`.

Scanned the first **2,000,000** source rows, including **783,086 English rows**. Retention caps were 6,000 learners, 96 encounters per learner, 24 strictly earlier encounters per history, and eight last eligible examples per learner. **504,209 English rows** were excluded by declared bounds. This is a prefix cohort, not representative full-corpus sampling.

| Partition | Learners with examples | Examples |
| --- | ---: | ---: |
| Training | 2,963 | 22,725 |
| Calibration | 419 | 3,252 |
| Validation/model selection | 434 | 3,343 |
| Final test | 416 | 3,211 |

The historical pilot's salted learner hash was retained. Buckets 0–6 train, 7 calibrate, 8 select, 9 test. Historical validation/test learners did not move into training. Calibration bucket 7 belonged to the historical pilot's training partition, so it is not independent of prior architecture exploration. The historical report states bucket 9 was reserved and unevaluated; this task ran final-test inference once after selection/calibration. Observed overlap across the four new learner partitions was zero. Cohort hashes are saved in `cohort.json` and the aggregate JSON companion.

Only training records fit word/item mappings and numeric standardization. The candidate response is never an input. Same/later-time encounters are excluded. The public target is **observed session recall proportion**, not a fabricated individual answer, question format or requested future-horizon outcome.

## Actual training and artifact

Reused the reviewed reduced `PublicPilotModel`: learned word/item embeddings 32/16, LSTM hidden size 32, masked candidate attention, output head 64/16. No pretrained semantic embeddings, Tagalog examples or FLUENTT question-format encodings were introduced.

Three fixed seeds each completed **800 real Adam updates** (2,400 total), batch 32, learning rate .001, gradient norm clip 1, finite/nonzero gradient checks. Each seed's checkpoint was selected by all-validation MAE every 100 steps; seed **20261106** won that criterion. Subsequent calibration used bucket 7 only: positive temperature **2.1324708461761475**, intercept **1.2144138813018799**, lowering calibration BCE from **0.2847037911** to **0.2816822529**. These choices were written to `selection-frozen.json` before final-test inference.

- Worker wall time including preprocessing/imports/training/evaluation: **221.886 seconds**; supervisor wall time **222.661 seconds**.
- Worker CPU time: **425.016 seconds**, approximately 1.92 core-equivalents over its wall time; this is process CPU accounting, not a host-wide utilization measurement.
- Actual worker peak working set: **540,962,816 bytes (515.902 MiB)**, measured inside the Torch process. No low-memory bypass occurred.
- Checkpoint: `private-data/esr-training/development-v2-20261105/fifakt-derived-development-not-study-ready.pt`, **512,437 bytes**, SHA-256 **2d0f81cd16c83c094b82e8d65e3f56c6a4affe3edcd7810a14affc4d640a84e5**.
- Safe `weights_only=True` reload, strict state load and exact prediction equality on a calibration subset: PASS.

The checkpoint packages weights, architecture, word/item mappings, normalization and calibration. Its contract is `observed-session-recall-proportion-v2`, with `research_ready=false`. It does not satisfy or impersonate `future-recall-probability-v1`.

## Held-out results

All **3,211** final-test examples produced finite matched predictions.

| Predictor | MAE | RMSE | Soft-target BCE | Descriptive binned reliability gap |
| --- | ---: | ---: | ---: | ---: |
| Selected model after calibration | 0.152486 | 0.254287 | 0.332808 | 0.021264 |
| Same model before calibration (diagnostic only) | 0.147394 | 0.255486 | 0.339373 | 0.028691 |
| Constant training-mean baseline | 0.163767 | 0.254148 | 0.331957 | 0.005002 |
| Training-only lexeme-mean baseline | 0.161169 | 0.258861 | 0.414171 | 0.021374 |

Paired model-minus-baseline MAE, 500 fixed-seed learner-cluster bootstrap replicates across 416 test learners:

- Constant baseline: **−0.011281**, 95% percentile interval **[−0.012419, −0.010238]**.
- Lexeme-mean baseline: **−0.008683**, interval **[−0.010986, −0.006386]**.

This meets the narrowly prespecified MAE criterion (both intervals below zero). The constant predictor has slightly better RMSE/BCE and substantially smaller binned gap. Calibration improved test BCE relative to the raw model while increasing MAE. These outcomes were retained; no transform was selected or refitted using test results. No claim of broad predictive superiority, classification accuracy, full reproduction or retention improvement follows. The reliability gap describes session proportions and is not proof of calibrated individual future recall.

Test unknown-word fraction **0.004360**; unknown-item fraction **0.007163**. Per-learner metrics and matched predictions are retained privately with hashed cohort keys, not printed raw user IDs. Hashed keys are coded data, not a guarantee of anonymity. No AUC was calculated by inventing binary labels, and no FSRS comparison was manufactured from absent subjective ratings.

## Verification and discovered issues

- New engineering tests: **11 passed**; existing pilot causality/gradient tests: **5 passed**. Synthetic fixtures establish implementation behavior only.
- Backend scheduler/bundle/boundary regressions: **42 passed**. New boundary test rejects this observed-session contract even if falsely presented with ready=true.
- Artifact verification: **6 manifest files and 7 executed-source snapshots passed hashes**. Saved metric/cluster-bootstrap arithmetic was recomputed without model inference and matched the report.
- Focused Ruff: PASS; `pip check`: PASS; `git diff --check`: PASS. No mobile source changed, so the prior combined mobile/admin checks were not repeated as evidence of new device behavior.
- No device tests, real FLUENTT study evaluation, application provider activation, new deployment or validated retention result occurred.

The first supervisor measured a Windows venv **redirector**, yielding an unusable 4,284,416-byte external peak; do not cite that as training memory. Actual worker self-measurement above is valid and its internal 3 GiB guard remained active. After the run, the supervisor was fixed to measure and terminate only its own process tree, covering the real child worker. A test spawned, measured and stopped owned child processes successfully. The original external hard-deadline behavior was therefore not fully effective for Windows child processes; this run completed voluntarily well below its limit. There was no forced model rerun or held-out retuning after discovery.

Executed sources/protocol were snapshotted before cleanup and match the report hashes under `private-data/esr-training/executed-sources-v2/`. Current worker adds an explicit selection initializer and an import-timing lint annotation without changing the numerical method; current supervisor contains the process-tree repair. The original run is reproducible from its archived executed sources. Its original report, selection and predictions were not rewritten after seeing outcomes.

## Reproduction and outputs

From the combined redesigned app folder in PowerShell:

```powershell
py -3.12 -m venv private-data/esr-training/.venv
& private-data/esr-training/.venv/Scripts/python.exe -m pip install -r services/api/training/esr/requirements-development-windows-py312.txt
& private-data/esr-training/.venv/Scripts/python.exe -m pip check
& private-data/esr-training/.venv/Scripts/python.exe services/api/training/esr/download_public_data.py
& private-data/esr-training/.venv/Scripts/python.exe services/api/training/esr/development_validation_tests.py
& private-data/esr-training/.venv/Scripts/python.exe services/api/training/esr/public_pilot_tests.py
# For a separately authorized reproduction, use a NEW ignored output directory.
# Do not use the disclosed test results for another model-selection round.
& private-data/esr-training/.venv/Scripts/python.exe services/api/training/esr/run_development_validation.py --output private-data/esr-training/NEW-REPRODUCTION-DIRECTORY
# Verify this historical run against the exact executed source snapshot:
& private-data/esr-training/.venv/Scripts/python.exe services/api/training/esr/verify_development_run.py private-data/esr-training/development-v2-20261105 --sources private-data/esr-training/executed-sources-v2
```

The runtime dependency lock is Windows x64/Python 3.12 specific; do not use its wheel on another platform. Portable training code needs a separately verified runtime there.

Machine-readable aggregates: `docs/ESR_DEVELOPMENT_VALIDATION_RESULTS.json`. Private run folder contains report, cohort hashes, selection, manifest, checkpoint, predictions, learner metrics, log and supervisor record. Package-install reports, requirements freeze, source/license evidence and executed code snapshots are in adjacent ignored training directories. Checkpoint and dataset paths were confirmed ignored by Git.

Exact new source files: `services/api/training/esr/DEVELOPMENT_VALIDATION.md`, `FLUENTT_DATA_REQUIREMENTS.md`, `development_data.py`, `development_metrics.py`, `development_worker.py`, `development_validation_tests.py`, `run_development_validation.py`, `verify_development_run.py`, `requirements-development-windows-py312.txt`; `services/api/tests/test_esr_development_boundary.py`. Documentation changes: this report, aggregate JSON companion, and appended DECISIONS.md entry. Existing pilot/model/API sources remain unchanged.

## Required next step

**Public development predictive criterion: PASS. Overall scientific/deployment readiness: PARTIAL/BLOCKED.** A permitted format-aware development dataset, actual future-horizon labels/calibration, relevant learner/language validation, and completed consent/enrollment/withdrawal/assessment workflow remain necessary before connecting a provider to live ESR. Requirements are documented in FLUENTT_DATA_REQUIREMENTS.md. No approval or empirical evidence for those missing inputs was invented.
