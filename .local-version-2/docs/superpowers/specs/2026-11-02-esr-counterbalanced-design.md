# FSRS-6 + FIFAKT ESR: counterbalanced design and feasibility

Date: 2026-11-02
Status: design specification approved by the user on 2026-11-02, with implementation requested. The original discussion below is retained as provenance. Response-handling defaults are implemented in the review foundation; exact numerical configuration, trained-model evidence and formal study approvals remain separate requirements. See `docs/ESR_IMPLEMENTATION.md` for implementation status and blockers; approval of this design does not authorize participant intervention.

## Confirmed study arrangement

The user selected a counterbalanced within-learner comparison. Each learner practices both vocabulary sets during the same intervention period. Scheduler-to-set mapping is reversed between allocation groups:

| Allocation group | Vocabulary set A | Vocabulary set B |
| --- | --- | --- |
| Mapping 1 | FSRS-6 | ESR (FSRS-6 + FIFAKT) |
| Mapping 2 | ESR (FSRS-6 + FIFAKT) | FSRS-6 |

There is no scheduler switch between intervention periods. These allocation groups are mapping groups, not one control-only group and one experimental-only group. Each learner contributes observations under both schedulers. Existing planning mentions 30 learners; this is a planned recruitment target, not actual enrollment evidence. Allocation balance, randomization/concealment, and any stratification must be specified before recruitment.

The supplied PDF's scope is the starting reference. Revise its Chapter 3 parallel-group paragraphs, independent-group analysis, group-specific model-development language, and every other conflicting passage to match this decision. The original PDF has not been edited.

## Separation and fair comparison

- Pin two disjoint vocabulary pools with versioned item identities, equivalent learning aims, assessment design, and documented difficulty/context matching. Counterbalancing mitigates set effects; it does not prove equivalence.
- Freeze each learner's scheduler-to-pool mapping. The server resolves the assigned scheduler; learners do not select a study algorithm.
- Isolate memory states, review events, and model interaction histories by study, participant, pool, assigned condition, item/version, and configuration version. Do not reset or overwrite historical SM-2 records.
- Proposed policy: FIFAKT receives history from its own assigned pool only. Sharing the FSRS pool's interactions with FIFAKT would introduce a different treatment and requires explicit protocol approval.
- Personal Learning and ordinary assignments remain separate. Relevant outside exposure may be documented under the approved protocol, without importing those events into experimental scheduler states.
- Give both conditions comparable interfaces, supporting features, activity access, and scheduled study opportunities. Define total session duration, per-condition opportunity limits, and presentation-order counterbalancing so one pool does not always receive the learner's freshest attention. Personalized due lists need not be identical.
- Baseline, immediate, and delayed assessments must retain pool/item provenance. Analysis must account for repeated observations from the same learner and set/mapping effects. The PDF's two-independent-groups analysis cannot simply be reused. Final statistical methods require the research team's approval.

## Verified upstream FIFAKT source

Inspected the authors' public repository at commit `a03e248141fc32a96dc6fda3bb6ae52be621bb9a` on 2026-11-02:

- [Author repository](https://github.com/BoxuanMa/FIFAKT).
- [MIT license](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/LICENSE): retain the copyright and license notice when incorporating substantial code.
- [Duolingo model](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Duolingo/models.py): PyTorch LSTM, item/word embeddings, attention, sequence inputs, and next-interaction prediction/loss machinery.
- [Duolingo training](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Duolingo/train.py): consumes preprocessed arrays and optional embedding arrays, trains models, and contains checkpoint-save logic.
- [Duolingo preprocessing](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Duolingo/generate_dkt_features.py): consumes learner/time/lexeme/language/history/session fields, constructs item and sequence timing features, word lengths and encoded sequences.
- [Tagetomo model](https://github.com/BoxuanMa/FIFAKT/blob/a03e248141fc32a96dc6fda3bb6ae52be621bb9a/FIFAKT/Tagetomo/models.py): explicit 13-way question-format encoding combined with word embeddings and interaction/timing inputs. These categories must not be equated with Fluentt's ten answer methods by numeric position.

The recursive repository listing at this commit contains source files, README, and LICENSE; it contains no pretrained weight/checkpoint files. This finding does not establish that no checkpoint is available elsewhere. No upstream code was installed or executed.

The README identifies Duolingo data as downloadable and Tagetomo data as private to Obunsha. The paper is Ma et al. (2023), *Each Encounter Counts: Modeling Language Learning and Forgetting*, DOI [10.1145/3576050.3576062](https://doi.org/10.1145/3576050.3576062). The publisher page could not be retrieved in this review, so code-level findings above are grounded in inspected author source rather than an unexamined publisher PDF.

## Public training-data feasibility

The author-linked [Duolingo dataset](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/N8XJME) is titled *Replication Data for: A Trainable Spaced Repetition Model for Language Learning*. Its public metadata describes 13 million traces and a released, unrestricted 379,004,009-byte gzip CSV. Published terms state CC BY-NC 4.0. Metadata was read through the repository's linked dataset API; no learner records were downloaded.

The code's MIT license and the dataset's noncommercial terms are separate. Any training, redistribution, or deployment use needs a documented fit with applicable data/embedding terms; publication of source code alone does not settle that.

The Duolingo preprocessing schema contains recall proportions, timestamps, item identifiers, language/lexeme fields, and historical/session seen/correct counts. It does not supply the Tagetomo variant's explicit question-format categories. Consequently:

1. Public-data reproduction can establish a working upstream baseline and preprocessing/inference pipeline.
2. It does not by itself establish format-aware transfer to Fluentt, English/Tagalog coverage, or calibration for younger Fluentt learners.
3. A faithful format-aware adaptation needs compatible permitted data, a documented encoding, and separate development validation. Do not invent format labels or treat an unknown-format token as evidence that the format effect was trained.
4. Keep development/calibration data separate from formal intervention outcomes. The current experimental sample is not assumed sufficient to train FIFAKT from scratch.

Upstream source is research code, not a drop-in service. It contains dataset-specific dimensions and preprocessing assumptions. The inspected preprocessing applies logarithms to raw history counts and uses hardcoded split sizes; adaptation needs explicit finite-value, ordering, count-boundary, and train/development/test checks. The training forward path accepts targets and masks to calculate losses. Production prediction requires a separate target-safe inference adapter with causal-history verification; do not send the held-out target answer to obtain its own prediction.

## Proposed development approach

Recommended route for review: reproduce the public-data baseline in an isolated development environment, then assess a documented format-aware Fluentt adaptation using permitted development data before enabling ESR in a formal study.

Alternative: obtain a compatible licensed pretrained checkpoint and its full preprocessing/vocabulary mappings, then validate transfer and calibration. A checkpoint without mappings and provenance is insufficient. Training only on the formal study participants is not the proposed route.

Both routes require an artifact manifest: upstream commit, adaptations, architecture, dependencies, embedding source/license/hash, dataset provenance/splits, vocabulary/format encoders, checkpoint hash, calibration method, prediction horizon, minimum-history threshold, and reproducible evaluation results. Parameter training is distinct from updating a learner's inference history.

## Proposed scheduling contract

1. Compute the FSRS-6 baseline decision from that condition's committed history using a pinned configuration.
2. Build only permitted causal FIFAKT history and identify the candidate item, question format, and prediction time/horizon.
3. If the model passes artifact/input/history/output acceptance checks, apply a bounded, versioned interval adjustment. Retain baseline FSRS memory dynamics separately rather than silently reusing the installed simulation's stability-fusion state.
4. If prediction is unavailable or invalid, retain the exact baseline proposal, record the fallback reason, and apply the same calendar policy as the control.
5. Store raw intervals, raw due dates, calendar-adjusted due dates, model output, factor, input-history cutoff, versions, replay identity, and final committed state revision.

The adjustment function, reference, bounds, retention target, rounding, interval limits, calendar, and sparse-history policy are not finalized here. The PDF's four-day/0.75 example and the simulation's 0.80-1.25 bounds are not adopted as approved parameters. A current-response prediction must not be treated as calibrated future recall without evidence.

## Confirmed review flow and remaining measurement rules

On 2026-11-02, the user selected: **answer a checkable question first, then rate recall difficulty**. Keep the objectively checked vocabulary response and the four-way recall self-rating as separate evidence. Both scheduling conditions receive the same response/rating flow. FIFAKT correctness labels come from the approved objective task; FSRS input comes from an explicitly approved rating policy. Do not convert a subjective rating directly into objective correctness or derive hard/good/easy merely from response speed.

The intended sequence is question presentation, response commitment/checking, then recall-difficulty rating. The precise feedback/reveal timing, whether ratings can be skipped, handling of interrupted reviews, and handling of disagreements between correctness and self-rating remain to be specified. Preserve both observations; do not silently rewrite an incorrect answer as correct because the learner chose easy, or invent a rating because an answer was correct. No review write or scheduling transition is authorized merely by this document update.

On 2026-11-02, the user selected **multiple choice and typed word recall** as the initial review formats. Both conditions offer both formats. Keep the vocabulary item/version separate from its format-specific prompt/version so encounters with the same word can be related without conflating different questions or answer keys. Record the actual format for each encounter; do not infer it from the learner's rating.

Ordinary Flashcard backs, assessment keys, and research answers retain their existing access boundaries. This decision does not authorize repurposing ordinary assignment responses as experimental events.

## Proposed response-handling defaults for review

These defaults are recommendations, not additional user decisions or implemented behavior. They can be reviewed together rather than resolving each minor interaction separately.

| Area | Proposed rule |
| --- | --- |
| Multiple choice | One explicitly authored correct option; submit a stable option ID against the pinned prompt version. Validate distractors and avoid duplicate visible choices. Do not disclose the correct option before the learner commits the answer. |
| Typed recall | Match against explicitly authored accepted forms using a versioned review-only policy: Unicode NFC, outer-whitespace trimming, and case-insensitive matching. Preserve accents and internal whitespace; no fuzzy spelling, inferred synonyms, or automatic translation. Retain the original response and matched-form identity. This proposal does not change existing Identification grading. |
| Feedback | After committing the response, show factual correct/incorrect feedback and the permitted answer, then ask how difficult recall felt before seeing the answer. Record feedback exposure and rating time separately from initial response time. Apply the same sequence under both schedulers. |
| Rating | Preserve the learner's raw again/hard/good/easy selection independently from objective correctness. Suggested effective scheduler policy: an incorrect response maps to again; a correct response uses the selected rating. Retain the raw rating, effective scheduler rating, and mapping-policy version, including disagreements. This mapping requires explicit approval before use. |
| Unfinished reviews | Empty text/no selected option is unfinished, not an incorrect response. A committed response awaiting its rating remains a partial review. Do not fabricate a rating or update the schedule until the review is deliberately finalized. Reconnect/retry must preserve the committed response and exposure state rather than letting the learner replace it after seeing feedback. |
| Formats across conditions | Use a prespecified, comparable mix and order policy in both pools; record prompt/version and format on every encounter. Do not let condition identity silently select easier formats or use format changes to disguise scheduler effects. Exact mix/order remains to be specified in the frozen protocol. |

Correctness labels must reflect these explicitly approved response rules. Typed spelling/recognition demands differ, so a shared vocabulary identity does not make the two formats interchangeable measurements. Model adaptation and research analysis must preserve format information.

## Readiness and remaining decisions

Confirmed: counterbalanced mapping, both pools in the same intervention period, FSRS-6 baseline, FIFAKT-assisted ESR as the proposed comparison, checkable response followed by recall-difficulty rating with separate correctness/rating evidence, and initial multiple-choice plus typed-word-recall formats in both conditions.

Pending design approval: model-development route; proposed response-handling defaults above (including normalization and effective-rating mapping); pool construction/equivalence; session opportunity and within-session order; history isolation policy; language scope; exact scheduler/calendar and model settings; consent and allocation workflow; final analysis plan and feasibility thresholds.

Before formal study execution, prove causal inference, item/version provenance, context isolation, retry/concurrency safety, exact baseline fallback, and comparable calendar processing. Measure non-fallback coverage and final due-date divergence, including early sessions, against prespecified readiness criteria. Neither a working model nor differing intervals establishes a retention advantage.

Application code, database schema, scheduler behavior, participant records, and research execution guards were not changed in this step. No tests, training, dataset download, or participant intervention were performed.
