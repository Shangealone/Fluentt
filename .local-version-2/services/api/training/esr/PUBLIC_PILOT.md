# Public-data CPU pilot

This is a small **FIFAKT-derived Duolingo engineering pilot**, not a faithful paper reproduction, full-corpus benchmark, calibrated future-recall model, or live Fluentt study provider. All data and checkpoints stay outside Git under `private-data/esr-training/` on F:. No application dependencies, database records, scheduler configuration or activation guards are changed.

## Source and permitted use

- Data: Settles and Meeder (2016), *A Trainable Spaced Repetition Model for Language Learning*, ACL, pp. 1848–1858. Publisher DOI: <https://doi.org/10.7910/DVN/N8XJME>.
- The publisher metadata specifies **CC BY-NC 4.0**. Use for the documented noncommercial research purpose with attribution; code licensing does not override data terms.
- File ID 3091087, 379,004,009 compressed bytes; publisher MD5 `0a1cae5eb7ad4b0bd9c0de91d74fcced`. The downloader verifies metadata, size, gzip content and checksum, and records SHA-256. It never executes downloaded content.
- Architecture reference: Ma et al. (2023), *Each Encounter Counts: Modeling Language Learning and Forgetting*, LAK, pp. 79–88; [author source pinned at a03e248](https://github.com/BoxuanMa/FIFAKT/tree/a03e248141fc32a96dc6fda3bb6ae52be621bb9a). Retain `UPSTREAM_FIFAKT_LICENSE.txt` with related material.

## Deliberate pilot adaptations

The model uses word and lexeme embeddings, an LSTM, candidate-to-history attention, the last historical state, and six numeric features. This follows the Duolingo architecture idea with independently written bounded code, rather than running the upstream scripts unchanged.

- Random, trainable 32-dimensional word and 16-dimensional lexeme embeddings; hidden state 32; reduced 64/16 output head. No pretrained semantic vectors. This is a resource-scaled ablation, not the paper's parameterization.
- Explicit batch-first recurrence and packed lengths. Attention sees only the supplied historical sequence, with padding masked before softmax. Candidate labels are separate loss targets and never model inputs.
- Numeric features: word length, `log1p` prior correct count, `log1p` prior seen count, observed same-word gap, publisher-provided item-review gap, and observed previous-encounter gap. Gaps are in days. Only training records fit normalization.
- English records only, from a bounded first-500,000-row source prefix. Retain at most the first 1,500 encountered English learners and 64 events per learner. This is not random or representative sampling of the full corpus.
- Sort each retained history by timestamp and source-row tie-break. For every candidate, exclude all history at the same or later timestamp. Retain at most 16 earlier encounters and at most eight eligible examples per learner.
- Assign whole learners to fixed salted-hash train/validation/test buckets (80/10/10). Word/item mappings use training records only; padding is 0, unknown is 1. The salt is public reproducibility metadata, not an anonymization guarantee. No learner identifiers are printed or included in checkpoint mappings/reports.
- The target is the dataset's observed **session recall proportion**, used as a soft BCE target. Do not turn it into invented individual correctness or question-format labels. Session outcomes do not enter the candidate's numeric features.
- Two CPU threads, batch 16, up to 100 steps, a cooperative 120-second optimization budget, a 3 GiB peak-process-memory check, and a supervisor's five-minute hard deadline. Evaluate at most 512 validation examples. Select by validation MAE; never evaluate the reserved test examples in this pilot.

## Run on this PC

Use the existing isolated CPU environment described in `CPU_SMOKE_README.md`. It uses Torch 2.8.0+cpu. The pilot uses standard-library CSV/gzip processing and Torch; no new dependencies or GPU packages are installed. A NumPy initialization warning is expected because NumPy is absent and unused.

From `F:\FLUENTT\.local-version-2`:

```powershell
& '.\private-data\esr-training\.venv\Scripts\python.exe' 'services/api/training/esr/download_public_data.py'
& '.\private-data\esr-training\.venv\Scripts\python.exe' 'services/api/training/esr/public_pilot_tests.py'
& '.\private-data\esr-training\.venv\Scripts\python.exe' 'services/api/training/esr/run_public_pilot.py'
```

The downloader reuses an existing corpus only after integrity verification. The launcher directs temporary files to F:, removes a stale report, runs the worker in a separate process and captures its local log. Outputs are `private-data/esr-training/public-pilot/report.json`, `run.log` and `public-pilot-not-study-ready.pt`. Loading uses `weights_only=True` for the locally generated state dictionary; no external checkpoint is loaded. The checkpoint contains mappings, scaler tensors, architecture and `research_ready=false`.

## Meaning of results

The five synthetic engineering checks establish batch/learner independence, exclusion of the candidate response, rejection of present/future history, padding invariance and finite gradient updates. They do not measure accuracy. The real-data run additionally verifies prediction equality after checkpoint save/reload and records consumed source/checkpoint hashes.

Validation MAE/MSE are errors against recall proportions, not accuracy percentages, learner grades, or retention gains. Compare against the constant training-mean baseline. Do not tune repeatedly against the reserved test set. Larger, representative experiments, pretrained-semantic comparisons, actual-format development data, future-horizon calibration, and the participant workflow remain necessary before the planned Fluentt intervention.
