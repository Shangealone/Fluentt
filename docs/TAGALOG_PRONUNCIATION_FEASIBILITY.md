# Tagalog pronunciation assessment: feasibility audit

Audit date: 2026-10-30. Scope: read-only repository/environment inspection and public-source research. No model installation, model download, application change, inference, participant recruitment or validation experiment was performed in this audit. Two small public WikiPron text files were examined in memory; no corpus was added to Git. This report is the only new file produced by this task. Existing unrelated changes were preserved.

**Decision:** proceed with reference preparation and a separately authorized research prototype. Do not enable student-facing Tagalog pronunciation ratings yet. Allosaurus is a plausible phone-recognition component, not an established Tagalog pronunciation assessor. Adequate independently human-rated Tagalog learner speech was not verified in this search. Reference coverage, runtime compatibility, licensing of the checkpoint, and independent evaluation remain gates.

## 1. Existing FLUENTT implementation

Inspected repository instructions, architecture/decisions, bilingual Voice documentation and local verification records; pronunciation router/services/contracts/runtimes, workers/preparation scripts, mobile pronunciation components and existing speech-test definitions. Existing dirty files were retained. Relevant locations:

- `services/api/app/modules/pronunciation/`: authenticated routing, consent/context/history boundaries, WavLM and MMS contracts/services, shared serialized worker management and text normalization.
- `services/api/ml/wavlm/` and `services/api/ml/mms/`: pinned offline preparation and inference workers.
- `apps/mobile/src/app/pronunciation.tsx`, `features/pronunciation/WavLMPractice.tsx`, `LocalRecordingPractice.tsx`: existing language selection and recording/result presentation.
- `docs/BILINGUAL_VOICE.md`, `BILINGUAL_VOICE_VALIDATION.md`, `MMS_LOCAL_VERIFICATION.md`, `WAVLM_LOCAL_SETUP.md`: earlier verification evidence and limitations.

English routes to WavLM predictions; Tagalog routes to MMS transcription/reference comparison with a NULL pronunciation score. No Allosaurus integration or installed package was found. Research collection remains separately restricted. This audit did not verify a live authenticated microphone submission or rerun either existing model.

Existing model revisions, retained unchanged:

| Component | Identifier | Revision |
|---|---|---|
| English scorer | Jianshu001/wavlm-phoneme-scorer | `19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da` |
| English backbone | microsoft/wavlm-large | `c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c` |
| English alignment | facebook/wav2vec2-xlsr-53-espeak-cv-ft | `2c733782da5604684829819a5eb744c193fe9398` |
| Tagalog ASR | facebook/mms-1b-all, adapter tgl | `3d33597edbdaaba14a8e858e2c8caa76e3cec0cd` |

## 2. Reference resources

URLs below identify the exact resource inspected or its publisher landing page. Public access is not itself permission to copy or redistribute.

| Resource and publisher | Variety / coverage / format | License and integration decision |
|---|---|---|
| [KWF Diksiyonaryo ng Wikang Filipino](https://kwfdiksiyonaryo.ph/), Komisyon sa Wikang Filipino | Filipino dictionary, accented headwords and meanings, searchable HTML; bulk size/export and IPA coverage not established | Copyright notice; no explicit open bulk-reuse license verified. Preferred authority for checking meaning and tuldik. Seek permission before embedding substantial dictionary material. Not a ready IPA lexicon. |
| [Tagalog Reference Grammar](https://www.ucpress.edu/books/tagalog-reference-grammar/epub-pdf), Paul Schachter and Fe T. Otanes, University of California Press, originally 1972 | Tagalog description; pronunciation chapter; book/PDF/ePub. Scholarly reference, not an exhaustive machine lexicon or modern dialect survey | No open software-data license verified. Consult/cite for phonology and train reviewers; do not bundle book content. |
| [KWF Manwal sa Masinop na Pagsulat](https://kwf.gov.ph/wp-content/uploads/MMP_Full.pdf), KWF | Filipino writing conventions, including tuldik; PDF. Orthographic guidance rather than phone-level acoustic annotations | Open reuse permission not verified. Direct retrieval was intermittent/403 during audit; retain as an official reference to obtain and review, not a claim of successfully extracted machine data. |
| [Epitran](https://github.com/dmort27/epitran), Mortensen and contributors | `tgl-Latn` and `tgl-Latn-red`; CSV mappings plus contextual rules; Tagalog Latin script. Generates candidate IPA, not sense-resolved pronunciations | MIT repository license. Suitable as a reviewed draft generator; package is not installed here. No claim of G2P accuracy on FLUENTT content. |
| [WikiPron Tagalog broad TSV](https://github.com/CUNY-CL/wikipron/blob/d282e848a211ea31cfd730f0ced8bc8cdab9e83d/data/scrape/tsv/tgl_latn_broad.tsv) and [narrow TSV](https://github.com/CUNY-CL/wikipron/blob/d282e848a211ea31cfd730f0ced8bc8cdab9e83d/data/scrape/tsv/tgl_latn_narrow.tsv), CUNY-CL extraction of Wiktionary | Tagalog, mixed entry provenance/variants, UTF-8 word–space-separated-phone pairs. Broad: 28,295 rows / 678,167 bytes; narrow: 33,062 / 977,454. Rows are pronunciation pairs, not unique vocabulary counts | WikiPron code Apache-2.0 does not relicense dictionary data. Follow [Wiktionary text licensing](https://en.wiktionary.org/wiki/Wiktionary:Copyrights), including CC BY-SA/GFDL and attribution/provenance. Suitable as candidate entries after review, not gold labels. |
| [TDR dataset](https://huggingface.co/datasets/tdr-research-team/tdr-dataset), TDR Research Team | Contemporary Tagalog news; 40 homographs, 10,065 source articles, 48,478 annotated occurrences; diacritized text and benchmark JSONL | Card says mixed rights/research purposes; underlying news copyright retained. Helpful evidence for contextual tuldik ambiguity. Not openly cleared reference audio, pronunciation labels or unrestricted product data. |
| [Tl-PH-Tagalog.ogg](https://commons.wikimedia.org/wiki/File:Tl-PH-Tagalog.ogg), Icqgirl / Wikimedia Commons | One Manila speaker saying “Tagalog”; Ogg Vorbis, 1.1 s, about 14 KB | File page explicitly releases recording to public domain. A verified example of reusable reference audio, not coverage of FLUENTT sentences. Other Commons clips require individual license and speaker checks. |

WikiPron snapshot hashes calculated from downloaded text bytes:

- Broad SHA-256: `8a33adfa8462c34b911e33f8c473bef5a9c10c6d8cbf02a60d06b4321fe966cf`.
- Narrow SHA-256: `101d02cab732d3f79f39da0b9b003d15c94c2ff2768accc04a3dc0d369cfc60f`.
- Neither file contained U+02C8 primary-stress marks. Broad contained 9,129 rows with /ʔ/; narrow 10,930. These are representation counts, not accuracy measurements. Missing stress cannot be reconstructed reliably from these exports alone.

## 3. Speech and evaluation datasets

| Candidate / publisher / URL | Coverage, format and rights | Appropriate use and missing evidence |
|---|---|---|
| [FLEURS](https://huggingface.co/datasets/google/fleurs), Google; `fil_ph` | Filipino (Philippines), read speech/transcripts and speaker metadata; 16 kHz audio, original audio/metadata and current Parquet distribution; CC BY 4.0 | Best immediately identifiable open ASR/reference-audio candidate. Human transcription does not mean pronunciation-error rating. Clip-level manual phone annotation could support recognizer evaluation; learner-error ratings must be added independently. Confirm exact split sizes before any further download. |
| [Philippine Languages Database paper](https://aclanthology.org/2024.sigul-1.32.pdf), UP Diliman collaborators / ISIP project | Multilingual corpus including Filipino, over 454 hours across languages, read/spontaneous domains. Paper describes speech resources, not an openly verified downloadable pronunciation-rating benchmark | Promising institutional contact for speech and phonetic resources. Exact accessible Filipino subset, export format, consent scope and data license require confirmation. The paper's CC BY-NC notice is not proof that the underlying recordings have that license. |
| [TAGCO paper link](https://www.ijstr.org/final-print/mar2020/Tagco-A-Tagalog-Speech-Corpus.pdf), Mesa et al. | Described as native Tagalog read speech with word transcription and word-to-phoneme lexicon | Bibliographic lead only: current paper URL redirected to a journal landing page. Corpus files, counts, IPA conventions and integration license could not be verified. Contact authors; do not depend on it yet. No verified learner pronunciation ratings. |
| [MATERIAL Tagalog-English Language Pack](https://catalog.ldc.upenn.edu/LDC2026S05), Linguistic Data Consortium | Tagalog North/Central/South regions; speech/text language pack under LDC access terms. Exact required subfiles/size not audited | Restricted-license comparison/contact option, not an open reference asset. No verified learner-error ratings; no purchase or download proposed. |

FLEURS is the verified openly licensed audio option; a purpose-built consented reference recording set is preferable for the exact teaching items. Common Voice, older Filipino/Bisaya corpora and Babel are further leads, not resources cleared by this audit. Search results mentioning Tagalog speakers in English assessment datasets do not establish Tagalog-language pronunciation labels.

**Dataset finding:** no adequate, publicly licensed, independently pronunciation-rated Tagalog learner corpus was verified. This does not establish that none exists. Native read speech, forced alignments, validated transcripts, text diacritics, and ASR WER cannot substitute for human learner-error annotations.

## 4. Phone representations and expected sequences

Use a documented contemporary Tagalog/Filipino target variety and permit reviewed regional variants. An initial inventory to have a linguist confirm includes five vowel categories /a e i o u/ and core consonants /p b t d k ɡ ʔ m n ŋ s h l ɾ w j/. Loanword categories, affricates, palatal consonants and contextual realizations need item-specific policy; this is a review checklist, not a newly validated inventory.

The inspected [Epitran mapping](https://raw.githubusercontent.com/dmort27/epitran/master/epitran/data/map/tgl-Latn.csv) explicitly handles `ng → ŋ`, `r → ɾ`, loanword letters and affricates. Its [post-rule](https://raw.githubusercontent.com/dmort27/epitran/master/epitran/data/post/tgl-Latn.txt) inserts /ʔ/ before word-initial vowels. Those rules do not resolve all lexical stress or final glottal stops. A deterministic initial-glottal rule also needs contextual review for connected speech.

Preserve syllables, stress and final glottal stops in references even if the first recognizer cannot assess them. Written unaccented words can be ambiguous by meaning. Inflection and sentence context can change the applicable form; vowel reduction, rhotics, loanword realization and glottal realization must not automatically become learner errors. Do not equate broad phonemic transcription with narrow phonetic output.

Reference creation process:

1. Export only the actually authorized teaching text and stable item/version identifiers. Preserve original display strings separately from pronunciation-analysis text. Start with the existing three Tagalog seed sentences: “Magandang umaga sa inyong lahat.”, “Ang wika ay salamin ng kultura ng isang bansa.”, and “Salamat sa iyong tulong at paggabay.” Verify actual deployed activity versions before using them.
2. Resolve each word's intended meaning in context using KWF and a qualified native reviewer. Retain tuldik, syllabification and final-glottal decisions; ambiguous items remain unavailable.
3. Use licensed WikiPron/Epitran candidates, then independently review every expected sequence. Record per-entry source URL/revision, license, lemma, inflected form, sense, dialect, accepted variants, reviewer and date. Do not copy an unlicensed dictionary wholesale.
4. Have two native reviewers, including one with phonetics training, approve the references. Record a small consented set of natural isolated words and full sentences from multiple speakers. These human references must not be generated by Allosaurus itself.
5. Version and freeze the lexicon, IPA-token mapping and variants before evaluation. Unknown words and unsupported sounds cause abstention. Do not infer a teaching-word pronunciation from MMS's recognized text.

## 5. Allosaurus: compatibility and limitations

[Allosaurus upstream](https://github.com/xinjli/allosaurus) was inspected at `d9f1adaf47d3b3765b41f4177da62a051516d636`. [PyPI](https://pypi.org/project/allosaurus/) publishes 1.0.2 (2021). The `uni2005` [release archive](https://github.com/xinjli/allosaurus/releases/download/v1.0/uni2005.tar.gz) metadata reports **41,497,736 bytes (39.58 MiB compressed)**. It was not downloaded. Expanded size, manifest/hash, exact installed `tgl` phone list, supported suprasegmentals, memory and latency remain unverified.

The inspected [inventory implementation](https://github.com/xinjli/allosaurus/blob/d9f1adaf47d3b3765b41f4177da62a051516d636/allosaurus/lm/inventory.py) selects/masks language inventories. “2,000+ languages” is not evidence of supervised Tagalog pronunciation-assessment validation. After approved preparation, explicitly enumerate `tgl` and universal `ipa` units, compare every reference phone, and audit approximation mappings. Do not silently map unsupported contrasts away. Stress detection is not established; leave stress scoring unavailable unless demonstrated independently.

The [decoder source](https://github.com/xinjli/allosaurus/blob/d9f1adaf47d3b3765b41f4177da62a051516d636/allosaurus/lm/decoder.py) supports top-k phone outputs with per-emission probabilities and timestamps. These probabilities are not calibrated correctness probabilities. Timestamps are emission-window locations/durations, not verified complete phoneme boundaries. Insertion/deletion behavior, including repeated phones across blanks, needs explicit tests before interpreting errors.

Local ML environment: Python **3.12.10**, torch/torchaudio **2.11.0+cpu**, transformers **4.57.6**, NumPy **2.2.6**. Allosaurus, SciPy, resampy, panphon, editdistance and numba/llvmlite were absent. Allosaurus dependencies are unbounded; its generic Python-3 wheel is not proof of compatibility with this stack. Windows wheels/builds and transitive dependencies need a clean resolver/import test. No compatibility installation or inference was executed here.

Use a separate experimental environment/process rather than changing the working MMS/WavLM environment. Pin resolved packages after review. Its [model loader](https://github.com/xinjli/allosaurus/blob/d9f1adaf47d3b3765b41f4177da62a051516d636/allosaurus/am/utils.py) uses `torch.load`; verify checkpoint compatibility with current safe-loading behavior rather than disabling safeguards. Its downloader auto-fetches/extracts archives: future preparation should instead pin `uni2005`, hash verified bytes, reject unsafe archive paths, inspect licenses and use an ignored offline cache. No remote Python execution or implicit runtime download is needed.

## 6. Proposed comparison and calibrated rating

This is a design proposal, not implemented behavior or measured results.

1. Reuse backend consent, authentication, duration/upload limits and decoding. Create validated mono PCM input; reject empty, silent, clipped, excessively short or unsupported recordings. Keep raw audio temporary under existing cleanup rules.
2. Run MMS as the separate transcription branch. Recognized text and WER remain text measures. Run Allosaurus for acoustic phone hypotheses with fixed model/settings and `tgl` inventory; use universal output only as an audit comparison. Do not bias the allowed phones to the expected answer to hide errors.
3. Normalize Unicode and tokenize IPA segments with combining marks/tie bars intact. Define reviewed broad-equivalence mappings; never compare IPA character by character or collapse contrasts such as /n/ versus /ŋ/.
4. Align observed phones to the frozen accepted reference variants using dynamic-programming edit alignment. Start with transparent substitution/deletion/insertion counts; evaluate a PanPhon articulatory-feature-weighted alternative against human annotations. Choose variants and costs on calibration data and freeze them. Handle word boundaries with reviewed reference word-phone spans; abstain where alignment is ambiguous.
5. Record phone error rate `(S + D + I) / reference_phone_count` as a recognizer/comparison diagnostic. Do not label `100 × (1 − PER)` pronunciation accuracy. Similarity can reflect recognition errors. Per-emission probabilities/top-k alternatives can support uncertainty, not automatic trust.
6. Only after human calibration, fit a simple interpretable ordinal mapping to the agreed human rubric. Separate segmental feedback from stress/glottal assessment and intelligibility. Unsupported dimensions remain unavailable. Offer bounded, uncertainty-labelled feedback and “unable to assess” instead of a guessed number.

## 7. Independent rating and validation plan

Seek existing labels from UP/other corpus owners first, including permissions and rater guidelines. If inadequate, obtain the institution's required ethics approval before recruiting; this task authorizes no collection. Keep this pilot separate from classroom grading, study assignments and FSRS/FIFAKT treatment.

Proposed initial feasibility pilot: **24 adult speakers × 20 short items = 480 recordings**, including native accepted-variant controls and learners with naturally occurring pronunciation differences. Use 12 speakers for calibration and 12 entirely different speakers for locked testing; balance proficiency/variety and keep speakers, sessions and duplicate audio disjoint. Include an unseen-word-family subset to expose lexical overfitting. This small pilot is not sufficient population-wide validation; plan a larger test from observed variance and confidence intervals.

Use three independent native Tagalog raters, at least one trained in phonetics. Obtain explicit recording/assessment consent, optional separate reuse/release consent, coded IDs, retention/deletion terms and voluntary withdrawal provisions. Avoid minors initially; future minor participation requires the appropriate assent/guardian process. Do not publish identifiable voice by default.

Raters receive human-reviewed references and accepted variants, never model predictions. Rate recordings in randomized blinded order, with 15% duplicate clips for intrarater consistency. Mark noise/unintelligible recordings unrateable. Retain original independent ratings; adjudicate phone labels only after agreement is measured.

Suggested separate 0–4 scales: segmental production and intelligibility; annotate stress and glottal errors separately when applicable. Anchors: 4 = acceptable target/accepted variant; 3 = minor differences with little intelligibility effect; 2 = several differences/repeated listening needed; 1 = substantial difficulty; 0 = speech cannot convey the target because of pronunciation. Wrong content, silence and technical failure are distinct statuses, not automatically “0 pronunciation.” Train raters with examples and revise vague anchors before freezing the rubric.

Proposed preregistered gates below are project targets, not established standards or achieved results:

| Area | Measurement / proposed gate |
|---|---|
| Reference integrity | 100% enabled teaching items reviewed; all scored contrasts represented; unsupported items abstain. |
| Human reliability | Report appropriate absolute-agreement ICC and ordinal weighted kappa; provisional ICC ≥0.75 before model validation. Low agreement requires rubric/reference revision. |
| Phone recognition | Human-phone-reference PER, per-phone confusion and /ʔ/ precision/recall, separated by native/learner and dialect. Set the acceptable PER after pilot analysis, before locked testing; report both unweighted and weighted alignment. |
| Error feedback | Provisional error precision ≥0.80 and recall ≥0.70 on sufficiently represented error classes; native accepted-variant false-alarm rate ≤0.10. Report uncertainty and rare-class counts. |
| Overall rating | Provisional held-out Spearman correlation ≥0.70 and MAE ≤0.5 on the 0–4 scale; require 95% correlation interval lower bound >0.50 in an adequately powered confirmatory test. Correlation alone is insufficient. |
| Fairness / uncertainty | Speaker-clustered bootstrap confidence intervals; subgroup MAE/false alarms, coverage-versus-error under abstention; no claims for unrepresented ages/dialects. |
| Runtime / safety | Measure cold/warm latency, p50/p95, process-tree peak RSS and system free minimum with API/UI running; freeze memory/concurrency limits from measurements before enabling. Silence, invalid audio, unsupported references, cleanup and failure paths must pass. |

If a gate fails or uncertainty is too wide, collect/review more data or narrow scope; do not adjust thresholds after seeing test results. Calibration and held-out evaluation must remain separate. WER/CER assess MMS only. Human phone labels assess recognizer/alignment behavior. Human ratings assess pronunciation feedback/rating validity.

## 8. RAM, runtime and deployment rights

Direct Windows measurement during this audit: **15.864 GiB usable physical RAM, 5.488 GiB available**, Intel i5-10400 (6 cores/12 threads), AMD Radeon RX 6600, **97.81 GiB free on C:**. The installed PyTorch stack is CPU-only; the AMD GPU is not automatically usable by its CUDA path. Allosaurus's small archive does not predict process RSS or latency. No Allosaurus benchmark exists yet.

Existing local records—not rerun in this audit—report MMS peak process RSS about **4.68 GiB**, initialization about **18.0 s**, and **7.7–17.8 s** inference for three particular public FLEURS clips. The three-clip WER/CER diagnostic is not held-out pronunciation validation. English also needs substantial headroom; existing cold-load gates remain **5 GiB English / 8 GiB MMS**. Current available RAM is below MMS's cold-load gate. Retain serialization/idle model release and do not assume all three models can remain resident. A practical future benchmark should sequence MMS and Allosaurus or measure the additional overlap explicitly. A 32 GiB machine would offer more headroom, but is not a demonstrated requirement or latency guarantee.

Allosaurus [software license](https://github.com/xinjli/allosaurus/blob/d9f1adaf47d3b3765b41f4177da62a051516d636/LICENSE) is GPL-3.0. Under its terms, internal execution and merely interacting over a network differ from conveying a copy; distributing a combined covered program can require GPL licensing and Corresponding Source. A subprocess boundary alone does not establish that a proprietary distribution is permissible. Noncommercial thesis use is not an exemption. Confirm checkpoint-specific licensing/notices inside the release or with its author; repository GPL metadata alone is insufficient evidence of every weight/data right. This is a conditional engineering assessment, not deployment clearance.

[MMS model terms](https://huggingface.co/facebook/mms-1b-all) are **CC BY-NC 4.0**: retain attribution and the existing noncommercial restriction; commercial use requires an appropriate alternative or permission. Do not treat all software, model weights and dictionary/audio assets as one permissively licensed bundle. Preserve the English NOTICE's unresolved redistribution caveats. Inventory licenses and intended distribution with the institution before deployment.

## 9. Implementation sequence for a later authorized task

1. Obtain/reference-review the exact teaching lexicon, accepted variants and consented human reference recordings; resolve reuse rights.
2. Prepare isolated Allosaurus dependencies and the reported 39.58 MiB model only after download/dependency review; record immutable hash, units, license and compatibility results.
3. Run real audio through Allosaurus, audit phones/timestamps/repeated-phone decoding, measure resources and compare with manual labels. Keep all existing gates and speech pipelines intact.
4. Prototype comparison as internal diagnostics with abstention and no student pronunciation percentage. Test reference coverage, language routing, phone tokenization, silence, invalid audio, model failure and cleanup.
5. Execute the approved independent rating protocol, calibrate on calibration speakers, freeze configuration, and evaluate on untouched speakers/items.
6. Enable limited student feedback only if licensing, resource and validation gates pass. Reuse current consent/session/history boundaries and identical treatment across experimental groups. Do not alter schedules, algorithms, allocation, English scoring or Tagalog ASR.

**Actual outcomes of this task:** source and environment inspection, lexicon representation counts/hashes and a feasibility design. No Allosaurus inference, phone-accuracy result, human-rating agreement, successful compatibility test or Tagalog pronunciation validation is claimed. Missing independent labels must be addressed before a defensible student-facing rating can be enabled.
