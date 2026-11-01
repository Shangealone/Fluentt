# Stage 3 — Independent validation feasibility

Date: 2026-10-30. **Overall: PARTIAL. Infrastructure preservation PASS; independent Tagalog phone-recognition and pronunciation-accuracy evaluation BLOCKED.** Further evaluation is technically feasible if appropriate reference/audio rights and independent annotations are obtained. Student-facing Tagalog pronunciation ratings remain disabled.

No source code, production endpoint, Voice UI, backend settings, model weights, scheduler or learning/research behavior changed. No model training, checkpoint/corpus download, recording collection, participant recruitment, external messaging, database write, commit, push or deployment occurred. Small public metadata, license documents and a 262,068-byte author-hosted research paper were inspected. Stage 3 added this report and a decision note; diagnostic evidence is ignored local storage.

## 1. Verified implementation and evidence

Read `TAGALOG_ALLOSAURUS_PILOT.md` and `TAGALOG_ALLOSAURUS_STAGE2.md`; inspected the actual Stage 1 harness, Stage 2 decoder/patch, benchmark, metrics, tests and saved resource/prediction artifacts. Reviewed current Git status and existing speech architecture. Pre-existing working changes were preserved.

The isolated Stage 2 fix is still exactly the one-statement indentation correction: update the previous CTC frame label on every frame, including blank. An AST comparison confirmed the derived decoder body matches the installed original with only that correction. The original installed file still hashes to `5f690d4d699bb2bbe9b04012ea65878299d413ea7574e3a870b94518e4722e82`.

Verification performed in Stage 3:

- All saved Stage 2 evidence hashes matched `services/api/private-data/allosaurus-stage2/evidence-hashes.json`.
- Re-decoded six saved acoustic logit matrices: three items from each of the two Stage 2 runs. Both original and corrected outputs reproduced exactly; logit hashes matched and `postprocessed_phones` remained NULL. No acoustic model was loaded for this check.
- Twelve diagnostic tests passed in 0.316 s, including all 3,280 CTC paths over blank/a/b through length seven. `a–blank–a` remains `a a`; adjacent repeated frames remain one emission.
- Protected source/configuration hashes matched the Stage 3 baseline after work. This includes Stage 2 tools, English/MMS speech files, pronunciation modules, Voice components and ignored `.env`.

Supporting paths: `services/api/ml/allosaurus_stage2/{decoder.py,decoder_fix.patch,benchmark.py,metrics.py,tests/test_diagnostics.py}`. Current verification results: ignored `services/api/private-data/allosaurus-stage3/verification.json`. The real-audio predictions in Stage 2 remain model hypotheses, not independent gold labels. Reproducing them establishes preservation, not correctness against human speech.

## 2. Resource eligibility audit

A suitable cohort needs all of the following: matching audio and observed-phone annotations; documented human review independent of Allosaurus output; permission for the intended evaluation; interpretable phone inventory; stable versions/audio hashes; usable speaker identities for disjoint sampling; and a population relevant to the claimed scope. Sentence prompts, G2P output and unreviewed forced alignments do not satisfy these requirements.

### A. Aquino et al. — strongest spoken-speech lead, not cleared

Publisher/authors: Angelina Aquino, Joshua Lijandro Tsang, Crisron Rudolf Lucas and Franz de Leon. [Project repository](https://github.com/AngelAquino/g2p-asr), [author-hosted conference paper](https://github.com/AngelAquino/g2p-asr/blob/895c4b9beb9c9763ea9a23b529666d57a5cd8e3b/ismac2019.pdf), DOI [10.1109/ISMAC.2019.8836168](https://doi.org/10.1109/ISMAC.2019.8836168). Repository revision: `895c4b9beb9c9763ea9a23b529666d57a5cd8e3b`.

The paper reports Tagalog material from the UP DSP ISIP corpus: **10 coded speakers, about 3 h 5 min**. Age, gender, dialect balance and total utterance count were not established from the inspected source. Phone labels began with G2P assistance and were manually corrected/verified by UP Linguistics representatives. Annotation quality, observed-realization conventions and inter-annotator agreement still need inspection. The published split allocates approximately 80/20 of utterances; do not assume it is speaker-disjoint.

The repository distinguishes gold `testref` CSV/LOG from generated `test` and `adapt` outputs. Verified Tagalog test-reference CSV count: **one in `_small`, two in `_large`**, with overlapping filenames; these are file counts, not three independent speakers or utterance totals. The tree contains no audio files and no license document. Citation instructions do not grant data reuse. **Eligibility BLOCKED** pending written reuse terms, matching audio, annotation documentation and inventory mapping. No reference labels were imported into the PER tool. These annotations are a genuine lead; the finding is not that human Tagalog phone annotations do not exist.

### B. UP-DSP Philippine Languages Database — accessible registry, annotation scope unresolved

Publisher/steward: UP EEEI Digital Signal Processing Laboratory. [Official registry entry](https://mozilladatacollective.com/datasets/cmmxhw46c00tqnw07xyr94zjk), [corpus paper](https://aclanthology.org/2024.sigul-1.32.pdf).

The registry describes WAV/LOG material across ten Philippine languages, over 454 hours and a **45.63 GB** release. The paper describes more than 340,000 recordings from more than 1,000 speakers across languages, with read/spontaneous speech, varied regions/ages/genders and many young adults. Those are collection-wide figures, not counts of independently phone-annotated Tagalog samples. The exact cleared Filipino phone-label subset and learner population were not verified.

The card declares CC BY-NC 4.0 but additionally states research-only use and no sharing/redistribution without written consent. Clarify the operative terms with the steward. Ordinary WAV/LOG text pairs are not sufficient phone gold. **Eligibility BLOCKED for this evaluation** until a matching expert-annotated subset and its rights are identified. Nothing from the 45.63 GB corpus was downloaded.

### C. Tiny Tagalog singing dataset — human-corrected labels, unsuitable primary validation population

Publisher: UtaUtaUtau. [Repository and description](https://github.com/UtaUtaUtau/tiny-tagalog-dataset), [dataset license](https://github.com/UtaUtaUtau/tiny-tagalog-dataset/blob/ca452e63032acf01936a932401760d0710e19222/LICENSE-DATASET), [v1.0.0 release](https://github.com/UtaUtaUtau/tiny-tagalog-dataset/releases/tag/v1.0.0). Revision: `ca452e63032acf01936a932401760d0710e19222`.

Publisher reports one masculine singing voice, **38 min 56 s**, 19 listed source recording groups; segmented-clip count, speaker age/dialect and learner status are not verified. SOFA-initialized labels were corrected by hand, using a USAP-related phone system rather than directly interchangeable IPA. Dataset terms are CC BY-NC 4.0; supporting code is MIT. Release assets are 120,855,528 and 120,481,625 bytes, **not downloaded**.

Compression/denoising, singing durations, one voice, unverified annotator protocol and song-related underlying rights limit applicability. A future permitted singing-domain exploratory test may be possible after mapping/rights review, but it cannot establish learner spoken-Tagalog reliability, speaker uncertainty or pronunciation-error feedback. **Not selected as a suitable FLUENTT assessment-validation cohort.** This is not a claim that its labels lack all value or are Allosaurus-generated.

### D. VoxAngeles — audited annotations, no verified Tagalog release subset

Publisher: Chodroff and collaborators. [Official repository](https://github.com/pacscilab/voxangeles), [publisher paper](https://aclanthology.org/2024.lrec-main.1114/). Audited release described as 95 languages/21 families, CC BY-NC 4.0. Speaker and utterance counts for an available Tagalog subset are unverified because no such audited archive was identified at inspected revision `e30c638a8a2c22e576f871f0e2044780d56eab82`.

The original UCLA metadata contains a Tagalog entry among 314 languages. That does not establish Tagalog inclusion in the audited 95-language release. **Eligibility BLOCKED** pending confirmation of an actual matching Tagalog audio/annotation subset, its population and permission. No audio was downloaded.

### E. FLEURS — usable audio for future annotation, not existing phone gold

Publisher: Google/FLEURS contributors. [Dataset card](https://huggingface.co/datasets/google/fleurs), `fil_ph`; license CC BY 4.0. Existing local operational tests use two full test recordings, IDs 1869 and 1930, from revision `fdd74f7cdf01fc7641ab3072b6a38d364b3667f6`; the 0.6 s excerpt is not an independent third recording. These are read-speech audio/text examples, not pronunciation-rated learner samples. Total independently phone-annotated Tagalog items verified here: **zero**. Relevant per-speaker demographics and an eligible phone-label population are not established by the two clips.

The text and audio can support a later permitted, model-blind annotation effort, but **existing labels are ineligible as phone ground truth**. No ASR transcript or dictionary conversion was used to fill the missing gold. KWF, grammar references, WikiPron and Epitran remain candidate sources for intended lexical pronunciation, not observed-speech annotations.

## 3. Cohort and accuracy decision

**No suitable legally cleared matching independent phone cohort was verified.** A frozen human-reference evaluation cohort was therefore not created. `cohort-decision.json` records the eligibility decision and NULL metrics. No real PER tool run was made against invented references.

| Requested accuracy result | Stage 3 outcome |
|---|---|
| Substitutions / deletions / insertions | Unavailable — no eligible reference alignment |
| Total reference phones | Unavailable, not zero-as-a-score-denominator |
| Micro / per-utterance PER | BLOCKED |
| Per-speaker PER | BLOCKED |
| Confidence intervals / subgroup differences | BLOCKED |
| Human pronunciation-error or rating validity | BLOCKED separately from PER |

The existing `nfc-token-unit-edit-v1` implementation passed its synthetic arithmetic/regression checks. Those results are not human phone accuracy. PER measures agreement with a specified phone transcription; it alone does not measure intelligibility, acceptable accent, pedagogical value or academic grading validity.

If an eligible set becomes available, freeze before inference: source revision and license, audio hashes, speaker/session IDs, observed-phone annotation version, consent/use scope, exclusions, segmentation, original tiers and explicit inventory conversion. Use no Allosaurus-derived gold. Keep calibration and testing speakers disjoint; fix tie rules and any broad-phone mappings before opening the test results. Keep unsupported contrasts visible rather than silently normalizing them away.

Run the unchanged PER tool on the approved frozen manifest; aggregate S/D/I and reference phones per speaker and globally. Report both micro PER and speaker distribution, and bootstrap **speakers** (with all their utterances), e.g. 2,000 resamples with a fixed seed and 95% intervals. Phone counts do not replace independent speakers. With too few speakers or instances, report uncertainty as inadequate and avoid population claims. Original/reference transcription conventions and adjudication can change PER and must accompany the results.

## 4. Proposed independent expert-annotation study — design only

**No recordings or ratings were collected in this stage.** Obtain institutional ethics approval and data-owner permission before a later study. A rights-cleared existing audio subset may be annotated first; recruiting FLUENTT users or recording new speech requires a separate approved protocol. Keep this work separate from ordinary classroom records, research allocation and FSRS/FIFAKT treatment.

Suggested initial feasibility pilot: **12 adult speakers × 10 utterances = 120 clips**, balancing native accepted-variety controls and learners where feasible. Reserve six speakers for annotation/rubric calibration and six for a locked pilot test, with both populations represented. This is a proposed feasibility sample, not an adequately powered efficacy study. Existing already-inspected clips must not become the sole supposedly unseen test population.

For a later confirmatory study, plan at least 30 independent test speakers and roughly 20 short utterances each, plus separate calibration speakers; calculate the final size from pilot between-speaker variance, desired confidence-interval width and subgroup coverage. Thirty speakers is a planning floor, not a guarantee. Do not pretend hundreds of phones from one voice provide hundreds of independent observations. Rare contrast/error categories need adequate *speakers* as well as at least the Stage 2 provisional 50 relevant instances. Children or unrepresented dialects require their own approved population/sample design; adult results cannot be generalized automatically.

Consent should explicitly cover local recording/annotation, purpose, voluntary participation without grade consequences, compensation if any, storage/access/retention, withdrawal limits after anonymized aggregation and a separate optional public-release permission. Voice can identify a person even when filenames are coded. Use coded speaker IDs, separately secured identity linkage and restricted annotator access. Start with adults; future minors require appropriate guardian permission/assent and safeguards. Do not make research consent a condition of using learning features.

Annotation instructions:

1. Use two independent native Tagalog transcribers with IPA training, plus a third qualified adjudicator; record variety and expertise. Train on calibration material only. Hide Allosaurus/MMS outputs, predicted confidence and experimental-group labels.
2. Preserve the intended sentence/meaning and source in one tier, and transcribe **what was heard** in a separate observed-phone tier. Do not repair observed speech to dictionary/G2P expectations. Record uncertainty, unintelligible spans, clipping/noise and partial speech instead of guessing phones.
3. Freeze broad/narrow conventions, segmentation, affricates, rhotics, vowel variants and glottal-stop policy. Use original audio for review; do not judge only denoised or altered copies. A trained reviewer must approve inventory conversion from any source symbol system to IPA.
4. Keep stress, syllable boundaries, timing and non-speech events on separate retained tiers. Stress is not an Allosaurus output and must not enter its segmental rating or be inferred from a length mark. Explicitly document the segmental PER projection; retain the original human tiers.
5. Annotate clips independently in randomized order. Include approximately 15% blinded repeats for intrarater consistency. Compute agreement before adjudication, retain both originals and publish adjudication rules. Do not present consensus-only labels as evidence of high agreement.
6. Only in a separately approved pronunciation-feedback validation layer, have experts label reference-versus-observed differences and their intelligibility impact, accepting legitimate variants. Model-versus-observed disagreement is a recognizer error candidate; reference-versus-observed disagreement is not automatically a learner error. Human error/rating evidence is distinct from phone transcription.

Agreement measures: pairwise normalized phone edit distance using the maximum sequence length as a symmetric denominator; phone/confusion counts and uncertain-span coverage; repeated-clip consistency; and, for defined categorical error labels on agreed units, weighted kappa/appropriate categorical agreement. If overall ordinal ratings are later collected, report an explicitly specified absolute-agreement ICC with confidence intervals. Do not compute kappa directly on misaligned variable-length token lists.

Proposed calibration gates, to preregister before confirmatory testing: median pairwise phone edit disagreement ≤0.10 with reviewed difficult categories; no scored phone lacks a reference mapping; rating ICC ≥0.75 if ratings are used. These are project targets, not established Tagalog norms. If agreement is poor, revise instructions using calibration samples and collect a fresh locked evaluation; do not tune thresholds after test results. Retain Stage 2's provisional phone-recognition gates as hypotheses, not achieved claims. No gate authorizes a student rating without separate pronunciation-label validation and licensing clearance.

## 5. Checkpoint rights reassessment

Authoritative material checked: [Allosaurus repository/license](https://github.com/xinjli/allosaurus/blob/d9f1adaf47d3b3765b41f4177da62a051516d636/LICENSE), [official release](https://github.com/xinjli/allosaurus/releases/tag/v1.0), package/source notices and Stage 1 archive manifest. Repository revision remained `d9f1adaf47d3b3765b41f4177da62a051516d636`; release metadata still has an empty body. The cached archive has no separate checkpoint LICENSE/NOTICE/README. No new rightsholder grant was verified.

GPL-3.0 software terms and the upstream documentation's intended local-model use are relevant evidence, but they do not independently settle rights for packaging the separately released checkpoint or all training-derived assets. The isolated corrected code retains its GPL notice/license; that does not relicense the whole app or clear weight/data rights. Third-party converted-model GPL tags are not an additional grant from the original rights holder.

**Redistribution/deployment clearance remains BLOCKED.** Request an explicit weight license, applicable conditions and attribution from the rights holder before distributing weights or installers. No contact was sent or response invented. Stage 3 did not load/download/convert/redistribute the checkpoint. MMS remains subject to its separate CC BY-NC 4.0 restriction. This is a documented engineering-rights audit, not legal certification.

## 6. Memory preflight and sequential safety

Direct Stage 3 measurement: **15.8645 GiB usable RAM, 5.9928 GiB available** at initial inspection. At the actual MMS preflight, available RAM was **6,627,688,448 bytes, approximately 6.17 GiB**. The existing requirement remains **8,589,934,592 bytes (8 GiB)** in `services/api/ml/mms/artifacts.py`.

The unchanged diagnostic supervisor returned `blocked_preflight` with `worker_started: false`. **No MMS inference occurred in Stage 3.** No memory gate was lowered, no applications were closed to force a pass and no large models were held simultaneously. Re-decoding saved logits required no acoustic model. Current result: safe gate behavior PASS, real MMS sequential revalidation BLOCKED by memory. More than 8 GiB must remain at the actual loader check after imports, not merely before launching Python.

Historical logs inspected, not rerun as new measurements:

- Stage 1 `sequential-mms.metrics.json`: first MMS load refused after imports reduced free memory below the threshold.
- Stage 1 `sequential-mms-retry.metrics.json`: later actual serial run succeeded with adequate headroom; measured MMS peak about 4.0811 GiB, minimum available 4.0745 GiB, followed by successful Allosaurus reload.
- Stage 2 `sequential-mms/resources.json`: refused at about 5.75 GiB available.
- Stage 2 Allosaurus paired-decoder runs: approximately 430–431 MiB sampled peak RSS; these remain historical operational measurements, not Stage 3 model latency results.

## 7. Stress limitation

The Stage 3 inventory inspection again found **no primary/secondary stress units**. Stress prediction remains unsupported; vowel duration/length symbols, text tuldik, word matching and MMS transcription must not be presented as acoustic stress predictions. Stress cannot contribute to a Tagalog pronunciation rating. Manual stress annotations in a future study would be a distinct human tier requiring a separately validated acoustic method for automated assessment.

## 8. Actual checks and retained evidence

| Check | Current result |
|---|---|
| Decoder/audio/metric diagnostic tests | 12 passed, 0.316 s; 3,280 CTC paths included |
| Re-decoding saved acoustic output | 6/6 raw and corrected predictions reproduced; no model load |
| Stage 2 evidence hashes | No mismatches |
| Relevant backend speech regressions | 115 passed in 6.10 s, upload-limit test included |
| Mobile speech/pronunciation regressions | 34 passed, 0 failed/skipped; about 2.643 s |
| Pilot dependency consistency | `pip check` passed; no new ML packages installed |
| Independent recognition/pronunciation metrics | BLOCKED; no eligible cohort |
| MMS live inference | Not started; insufficient free RAM |

Backend tests used local socket access because Stage 2 identified Windows asyncio socket-pair initialization restrictions in the restricted runner. No test was silently excluded or stalled test counted as a pass in this stage. These regression tests use synthetic fixtures/doubles and shared audio-decoding checks; they are not human speech-accuracy results. No new database integration, native microphone or student-facing end-to-end scoring validation was claimed.

Commands from repository root:

```powershell
services/api/private-data/allosaurus-pilot/.venv/Scripts/python.exe -X utf8 -m unittest discover -s services/api/ml/allosaurus_stage2/tests -v
services/api/private-data/allosaurus-pilot/.venv/Scripts/python.exe -m pip check
services/api/private-data/allosaurus-pilot/.venv/Scripts/python.exe -X utf8 services/api/ml/allosaurus_stage2/monitor.py mms --pilot services/api/private-data/allosaurus-pilot --output services/api/private-data/allosaurus-stage3/mms-preflight
node --test scripts/wavlm.test.cjs scripts/pronunciation.test.mjs scripts/live-pronunciation.test.cjs
```

The evidence output folder already exists; use a fresh folder to repeat the preflight. Backend command, working directory `services/api`, with local socket access:

```powershell
private-data/api-runtime/.venv/Scripts/python.exe -m pytest tests/test_mms.py tests/test_wavlm.py tests/test_pronunciation.py tests/test_pronunciation_assessment.py tests/test_speech_recognition.py tests/test_speech_audio_runtime.py tests/test_whole_phrase.py -q --tb=short -o faulthandler_timeout=30
```

Ignored evidence root: `services/api/private-data/allosaurus-stage3/`:

- `verification.json`: saved-logit re-decoding and stress-unit checks.
- `memory.json`, `mms-preflight/resources.json`: actual current resources/gate outcome.
- `cohort-decision.json`: ineligibility decision, no frozen cohort and NULL accuracy metrics.
- `regression-results.json`: recorded summaries from actual tool executions, not full captured console logs.
- Resource trees, release metadata, license text and author paper/text: audit provenance; no corpus/checkpoint data added.
- `baseline.json`: protected-file hashes; `evidence-hashes.json`: final local audit-artifact hashes.

## 9. Decisions and rollout prerequisites

| Area | Outcome |
|---|---|
| Decoder fix/raw evidence preserved | PASS |
| Regression behavior within tested scope | PASS |
| Independent validation resource search | PARTIAL: credible annotated resource identified, permissions/audio unresolved |
| Frozen cohort and real PER/S/D/I/per-speaker uncertainty | BLOCKED |
| Expert-annotation study feasibility | PARTIAL: proposed protocol, no ethics approval/collection or results |
| Checkpoint redistribution rights | BLOCKED |
| Current MMS gate behavior | PASS; live inference recheck BLOCKED by memory |
| Stress prediction | Unsupported, excluded from ratings |
| Student-facing Tagalog pronunciation rating | Remains disabled |

**Recommendation:** proceed only with rights clarification and a separately approved independent annotation/evaluation study. The most direct path is to obtain the Aquino/UP matching audio, labels, population metadata and written permissions, then audit inventory and annotation conventions. Alternatively, build a model-blind expert-annotated subset of legally cleared speech under institutional approval. Freeze the cohort and analysis before running the existing PER tool, and validate learner error feedback separately. No scoring rollout is justified by current evidence.

Changed files in this stage: this report and an appended `docs/DECISIONS.md` note only. Local ignored audit artifacts are retained for reproducibility. English WavLM, Tagalog MMS, Voice UI, backend settings, FSRS-6, FIFAKT and Personal/Class Learning behavior were preserved.
