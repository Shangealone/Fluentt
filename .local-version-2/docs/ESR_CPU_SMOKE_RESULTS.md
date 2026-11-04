# Isolated ESR CPU engineering results

The user approved proceeding with the bounded CPU smoke test after the training-data/environment audit. The isolated environment and harness are implemented. This is an engineering adaptation with synthetic fixtures, not a faithful FIFAKT reproduction or a validated treatment model.

## Verified outcome

- Seven engineering tests passed: zero-count/new-history handling; other-learner and batch-order independence; exclusion of current/future answers; padding invariance; invalid-input rejection; real finite gradient updates; weights-only save/reload equality.
- A bounded synthetic run completed twelve optimization steps on eight histories of twelve encounters using two CPU threads. No dataset was downloaded or used.
- Final recorded optimization time: **0.138 seconds**. Total wall-clock time including imports, checks and evidence preparation: **7.985 seconds**. An earlier cold run took approximately 16.37 seconds total. These timings do not estimate full-corpus training cost.
- Windows peak process working set: **248,647,680 bytes**, approximately **237.13 MiB**, including native allocations. This is process memory, not total machine usage or GPU memory.
- Predictions were exactly equal after saving and reloading the locally generated state dictionary with explicit `weights_only=True`.
- The final source hashes were captured externally before the run and compared with the report and files afterward; checkpoint hash verified too.
- Ruff passed for the three new Python harness files. Eighteen existing pure ESR/bundle/research-guard checks passed in the unchanged API environment. This is not a full application or database acceptance run.
- The API environment still has no Torch installed. Its dependencies, app behavior and study activation guards were not changed by this task.

## Environment and evidence

Training environment: ignored `private-data/esr-training/.venv/`, Python 3.12.14 and official PyTorch **2.8.0+cpu**. Dependencies and download cache remain on F:. Exact dependency pins are in `services/api/training/esr/requirements-cpu-smoke.txt`; the original install report retains wheel URLs and hashes locally. No GPU packages or NumPy were required for this harness. Torch emits a NumPy initialization warning; operations exercised here do not use NumPy.

Implementation and invocation: `services/api/training/esr/CPU_SMOKE_README.md`. The model, tests, runner and adaptation notes are in that same directory. Original upstream audit files remain pristine.

Ignored result directory: `private-data/esr-training/results/` contains the test log, installed versions, JSON evidence and `synthetic-smoke-only.pt`. The JSON explicitly records synthetic-only, no real-data training, no faithful-paper reproduction and no research readiness. The checkpoint is never registered with the application or advertised as FIFAKT treatment.

The bounded input dimensions, batch-first recurrence, past-only features, packed sequences, masked attention and label-free candidate interface are detailed in `SMOKE_ADAPTATIONS.md`. No pretrained semantic embeddings, language transfer, real-world format effects or calibration were established.

## Review and remaining limits

Independent source review found no critical or important issues within this synthetic-only scope. Two minor automation improvements remain deferred: automatic before/after source-change detection inside the runner, and hard process deadlines. Source consistency was checked externally for the final run. Current time budgets are cooperative checks between phases/steps; a blocked native call or subprocess could exceed them.

The current checkout was retained to preserve unrelated progress, accepting reduced change isolation. Work ran inline with one independent final review rather than per-task reviewers. CPU 2.8.0 is a tested engineering runtime, not a claim about the paper's original dependencies. Synthetic inputs were used deliberately; the cost is that learned accuracy remains unknown. No commit or push was performed.

## Next stage

Prepare the real-data baseline pipeline: a deliberate public-corpus download with recorded terms/checksums, schema and language/count inspection, explicit preprocessing/split contracts, and a documented adaptation from upstream. The synthetic harness does not repair or reproduce the upstream CSV pipeline by itself.

The later Fluentt format-aware adaptation still requires permitted development encounters with real format labels, target-safe future-recall validation and calibration. Study consent/enrollment, withdrawal and pool-linked assessments remain separate unfinished work. Formal ESR activation stays blocked.
