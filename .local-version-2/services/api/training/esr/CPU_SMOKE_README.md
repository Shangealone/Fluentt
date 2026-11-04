# Isolated CPU engineering check

Run from this folder using the separate Python executable under:

`F:/FLUENTT/.local-version-2/private-data/esr-training/.venv/Scripts/python.exe`

The running API's `.venv` is not used. The separate environment uses Python 3.12.14, pip 25.0.1 and the versions recorded in `requirements-cpu-smoke.txt`. The original install report, including wheel URLs/hashes, is retained in ignored `private-data/esr-training/install-report.json`. Exact installed versions are also saved with results.

Before running in PowerShell, keep temporary files on F: for the current terminal:

```powershell
$env:TEMP = 'F:/FLUENTT/.local-version-2/private-data/esr-training/tmp'
$env:TMP = $env:TEMP
& 'F:/FLUENTT/.local-version-2/private-data/esr-training/.venv/Scripts/python.exe' run_cpu_smoke.py
```

`smoke_tests.py` can be run directly for tests only. `run_cpu_smoke.py` runs those tests, then at most twelve optimization steps on eight synthetic histories of twelve encounters. It records finite loss/gradient updates and saves/reloads only a locally generated state dictionary with `weights_only=True`.

Outputs are under ignored `private-data/esr-training/results/`: test log, installed versions, JSON evidence and `synthetic-smoke-only.pt`. The report records `research_ready=false`, `faithful_paper_reproduction=false`, `real_data_training=false` and `synthetic_only=true`. Never publish or register this checkpoint as FIFAKT treatment. No production model loader consumes it.

Memory is Windows peak process working set, including native allocations; timing is wall-clock. Optimization time covers forward/backward/update, while total time additionally includes imports, tests and evidence preparation. Neither measurement predicts full-corpus training cost. A NumPy initialization warning is expected in this deliberately Torch-only environment; the harness uses Torch and standard-library numeric operations, not NumPy. Real-data preprocessing will need its own tested dependency set.

See `SMOKE_ADAPTATIONS.md` for architecture changes, bounded input semantics and limitations. This harness does not reproduce the upstream CSV pipeline, pretrained semantic vectors or study scoping. Those remain separate work before real-data model development and research activation.
