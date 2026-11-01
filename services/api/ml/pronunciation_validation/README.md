# English pronunciation validation Phase 1

Isolated public-data research code. It does not import into or change the API,
score students, train models, change thresholds, or generate fallback predictions.
Current real inference is **BLOCKED by RAM**; no validation metrics were measured.
See repository `docs/ENGLISH_PRONUNCIATION_VALIDATION_PHASE1.md`.

Attribution: **SpeechOcean762**, Junbo Zhang and colleagues, SpeechOcean Ltd. and
Xiaomi, 2021. Original source https://github.com/jimbozhang/speechocean762,
revision `613968e3b0b789fc33936fb5eba1973176ba7d11`. OpenSLR SLR101 declares
CC BY 4.0: https://www.openslr.org/101/ and
https://creativecommons.org/licenses/by/4.0/. Keep credit, source/license links
and modification notices. Here original audio is unmodified; pilot selection,
manifest and analysis are newly derived. Nothing implies publisher endorsement.
Hub Apache-2.0 metadata is not used to relicense the original recordings/labels.

From `services/api`, using the existing installed environments:

```powershell
# Optional reproduction of public acquisition into a NEW directory (~34 MB).
./ml/wavlm/.venv/Scripts/python.exe -m ml.pronunciation_validation.acquire --output private-data/english-validation-reproduction
# Existing acquired source can be reused; prepare a NEW run directory.
./ml/wavlm/.venv/Scripts/python.exe -m ml.pronunciation_validation.evaluate prepare --folder private-data/english-validation-phase1 --output private-data/english-validation-phase1/run-v2
./ml/wavlm/.venv/Scripts/python.exe -m ml.pronunciation_validation.evaluate run --folder private-data/english-validation-phase1 --output private-data/english-validation-phase1/run-v2
./private-data/api-runtime/.venv/Scripts/python.exe -m pytest ml/pronunciation_validation/test_evaluate.py -q --tb=short
```

Do not execute the private `child` mode manually: `run` supplies resource
supervision. It refuses overlapping detected large speech processes and requires
5 GiB available before starting, before imports and immediately before loading.
Emergency shutdown applies below 1.5 GiB available, above 6.5 GiB child-tree RSS,
after 90 seconds initialization / 45 seconds per sample / 600 seconds total.
Only supervisor-owned children are stopped. Inference uses existing local cache,
offline flags, CPU/two threads, the actual pipeline class and actual worker
decoder. All prepared model hashes/revisions are verified before loading.

`run` refuses overwriting a prior evaluation. Every selected ID remains in
coverage, including failures/not-run rows. No outcome-based replacement occurs.
The primary analysis is association with sentence accuracy, not calibrated grade
agreement. No conversion is fitted; MAE/RMSE are intentionally unset. The planned
strict phone-level endpoint requires a later explicitly reported analysis; this
Phase 1 run produced no phone predictions and evaluates no stress.

Runtime evidence is ignored under `private-data/english-validation-phase1`:
`source/`, `acquisition.json`, `download-plan.json`, `environment.json`, and
`run-v1/{protocol,manifest,evaluation,analysis,resources}.json`, `evaluation.csv`.
No audio, human labels, checkpoint or credentials are added to source control.
Original source extracts were read as text only, never executed. Annotation
independence from WavLM training remains UNVERIFIED even though five human
experts independently produced dataset ratings.
