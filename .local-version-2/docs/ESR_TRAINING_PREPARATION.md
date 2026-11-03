# FIFAKT training preparation

Updated: 2026-11-02

The user confirmed that no checkpoint is available and selected preparation for training as the next step. No training run, dataset download or model-validity claim has been made.

Follow-up audit completed 2026-11-02: see `ESR_TRAINING_DATA_ENVIRONMENT_AUDIT.md` for verified source/data metadata, hardware constraints and preprocessing/tensor-layout findings. Public source text and metadata were retrieved; learner records, weights and embeddings were not downloaded. The next bounded step is an isolated CPU-first smoke-test harness, not an unchanged upstream training run.

Subsequent CPU step completed: see `ESR_CPU_SMOKE_RESULTS.md`. An isolated Torch CPU environment passed seven synthetic engineering checks and a twelve-step optimization run, with source/checkpoint integrity verified. No real-data training or study-ready model was produced. The next stage is the documented public-data baseline pipeline.

## Development route

1. Reproduce the authors' public-data baseline in a separate development environment, pinned to upstream commit `a03e248141fc32a96dc6fda3bb6ae52be621bb9a`. Retain the MIT notice for incorporated source. Inspect its preprocessing, dependencies and loss/mask handling before executing it; do not install research-code dependencies into the running API environment.
2. Document the permitted data and embedding use. The author-linked public Duolingo data was identified as CC BY-NC 4.0 in the design audit. Its records do not establish Fluentt's multiple-choice/typed-recall format labels. Never fabricate those labels. Private Tagetomo data cannot be assumed available.
3. Establish a reproducible baseline before a Fluentt adaptation. Then obtain permitted development data with the actual two formats and appropriate vocabulary/language coverage. Public baseline reproduction alone is not evidence of a format-aware Fluentt model.
4. Adapt and evaluate the future-recall target and causal feature contract below. Preserve an untouched test set. Calibrate on development data, not on formal intervention outcomes.
5. Package the checkpoint, mappings and manifest; verify file hashes with the preparation tool. Only a later, validated inference adapter may be connected to the API.

## Contract to train and validate

- Candidate identity: actual vocabulary ID and content version, vocabulary/semantic encoder mappings, and the **next scheduled question format**.
- History: only the same participant/study/pool/configuration; finalized reviews strictly before presentation of the current question. Include observed format and objective correctness. Never use another pool, personal practice, ordinary assignments or the held-out target response.
- Timing: explicit UTC ordering and elapsed time units; deterministic handling for equal timestamps and zero counts. The server's response elapsed time includes network delay; do not silently equate it with an upstream task-duration feature.
- Target: future objective recall probability at the requested baseline interval in days, for the next format. A present-answer classifier is insufficient. The current scheduling implementation excludes the just-answered encounter; the adapter must match that input contract, or a separately approved/versioned change is needed.
- Output: one finite probability in [0,1], with documented calibration, language/format/OOV coverage, minimum-history rule and inference failure behavior.
- Review ratings remain distinct from objective correctness. Training labels must not be synthesized from Again/Hard/Good/Easy. Scheduling evidence retains both the raw rating and its versioned effective mapping.

## Split and evaluation requirements

Record participant-disjoint development/calibration/test partitions where the approved generalization question requires them; maintain chronological target separation within each sequence. Fit encoders, imputers, scalers and calibration on their permitted training/development partitions only. Report the actual evaluation population and uncertainty, coverage by language/format/history length, calibration, invalid-output rate, inference latency, fallback coverage and final due-date divergence. Do not invent readiness thresholds or claim improved retention from interval differences.

The planned formal-study sample is not automatically a suitable model-training cohort. Development and intervention data need documented separation and permission.

## Bundle contents

Use a local directory outside Git for private datasets and large weights. The checked-in `services/api/training/esr/manifest.example.json` is deliberately **untrained** and incomplete. Copy it locally and fill in actual evidence; do not replace nulls with guessed values.

The bundle should contain:

- Safely loadable checkpoint format and architecture/configuration, plus framework/runtime versions.
- Item/vocabulary, word/semantic and explicit format mappings with unknown-token policies.
- Preprocessing implementation and its version, feature/time definitions and target-horizon contract.
- Dataset/embedding provenance, licenses, split description and evaluation/calibration reports.
- SHA-256 for every consumed file, the upstream commit and adaptations, random seeds and reproducible run command.

Run `python training/esr/check_bundle.py <bundle-directory>` from `services/api` after preparing the bundle. The checker reads only the manifest and named files; it does not unpickle weights, download data, train a model or grant readiness. Passing file-integrity checks does not prove model fidelity, privacy compliance or scientific validity.

## Still needed before training execution

The permitted format-aware development-data source and exact data access terms must be established. Then choose the isolated runtime and compute budget from the inspected upstream requirements and available hardware. Check CUDA/framework compatibility at that time. No dependency versions, training hyperparameters or performance thresholds are invented in this preparation checkpoint.

After those inputs are available: implement the reproducible baseline pipeline, run it, diagnose finite-value/split issues, add the validated format-aware adaptation and future-horizon calibration, and build the API adapter. Formal study activation also remains blocked by the unfinished participant workflow described in `ESR_IMPLEMENTATION.md`.
