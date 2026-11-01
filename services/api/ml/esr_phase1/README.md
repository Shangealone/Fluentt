# ESR Phase 1 isolated feasibility harness

This directory is not imported by the application or registered as a scheduler.
It contains no trained FIFAKT model. All candidate predictions are SIMULATED.
See `docs/ESR_PHASE1_FEASIBILITY.md` at repository root for findings and limitations.

The candidate is exactly `I_FSRS * clip(1 + .5*(pK-pF), .75, 1.25)`.
Both probabilities must describe the same event from frozen pre-response inputs;
the base FSRS interval follows the response. Memory stability is never modified.
Invalid/unavailable predictions retain the identical valid base proposal.
Exception/timeout tests inject failures; the harness does not implement a hard
deadline around a hung external predictor.

From `services/api`, using the existing local Python environment:

```powershell
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest ml/esr_phase1/tests -q --tb=short
./private-data/api-runtime/.venv/Scripts/python.exe -m ml.esr_phase1.simulate --output-dir private-data/esr-phase1/reproduction-v1
```

The output directory must not exist. No overwrite is performed. The finite grid
contains 1,680 snapshots projected onto five calendar policies (8,400 rows).
Only the unrestricted elapsed-day engine reflects current scheduling; weekday,
instructor and missed-day policies are explicit hypothetical sensitivity cases.
The harness imports only existing pure FSRS/calendar functions, never a database.

The original run used `ml/esr_phase1/results/run-v1`; its full outputs were moved
to ignored `private-data/esr-phase1/run-v1` to avoid adding 15.6 MB of generated
logs to source control. `results/summary-v1.json` is an exact compact copy of its
summary. Full outputs include CSV, replayable decision JSONL and SHA-256 manifest.
Source hashes identify the prototype, simulator and unchanged FSRS implementation.
The summary records successful arithmetic/calendar replay of all 8,400 decisions.
These are schedule comparisons, not retention outcomes or model validation.
