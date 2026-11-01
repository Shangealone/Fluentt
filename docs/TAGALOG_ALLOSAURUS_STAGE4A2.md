# Section 4A.2 — Tagalog dataset permission and access clearance

Date: 2026-10-30. **Section 4B decision: NO-GO for model evaluation.** The permission package is prepared, but no requests have been sent, no reply/grant obtained and no eligible independent evaluation cohort established. A separately authorized clarification process remains a conditional next step; Section 4B has not begun. Tagalog pronunciation ratings remain disabled.

## 1. Scope, preservation and evidence

Read the five required reports: `TAGALOG_ALLOSAURUS_PILOT.md`, `TAGALOG_ALLOSAURUS_STAGE2.md`, `TAGALOG_ALLOSAURUS_STAGE3.md`, `TAGALOG_ALLOSAURUS_STAGE4A.md` and `TAGALOG_ALLOSAURUS_STAGE4A1.md`, all under `docs/`. Their findings, URLs, verified contacts and prior draft texts are preserved unchanged.

The two original unsent requests were extracted verbatim from Section 7 of the Stage 4A.1 report into ignored `services/api/private-data/allosaurus-stage4a2/previous-unsent-requests.md`. The updated drafts below retain their scope and add the explicit undergraduate Philippine Computer Science thesis context and request to publish aggregate numerical results. They do not imply permission already exists.

Current authoritative sources reviewed:

- [Tiny original repository](https://github.com/UtaUtaUtau/tiny-tagalog-dataset), pinned `ca452e63032acf01936a932401760d0710e19222`; [dataset license](https://github.com/UtaUtaUtau/tiny-tagalog-dataset/blob/ca452e63032acf01936a932401760d0710e19222/LICENSE-DATASET); [release](https://github.com/UtaUtaUtau/tiny-tagalog-dataset/releases/tag/v1.0.0).
- [UP-DSP registry](https://mozilladatacollective.com/datasets/cmmxhw46c00tqnw07xyr94zjk), [Aquino project](https://github.com/AngelAquino/g2p-asr), [Crisron Rudolf Lucas's official UP contact page](https://eee.upd.edu.ph/about/faculty/crisron-rudolf-lucas/).
- [Allosaurus software license](https://github.com/xinjli/allosaurus/blob/d9f1adaf47d3b3765b41f4177da62a051516d636/LICENSE), as a separate rights question.

Small pinned license/README/release documents were retrieved through their official raw/API URLs when browser-page retrieval returned cache errors. URLs, hashes and retrieval status are in local `source-checks.json`. No dataset/audio/archive/checkpoint payload was fetched in this section. No email, contact form, GitHub issue or other message was submitted.

## 2. Tiny Tagalog: confirmed facts and unanswered questions

Stage 4A.1 verified 19 same-stem WAV/LAB filenames and inspected 9,515 label rows through a small separate label block; it did not inspect audio content. These are structural facts, not measured phone accuracy. The publisher reports SOFA initialization followed by hand correction, a USAP-related alphabet and a single singing voice. Dataset terms declare CC BY-NC 4.0; supporting-code MIT terms are separate.

| Question requiring clearance | Current evidence | Exact missing evidence/request |
|---|---|---|
| Small matching audio accessibility | Public bulk archives and matching names exist | One existing short WAV/LAB pair accessible without bulk download, with file identity/hash |
| WAV/LAB acoustic correspondence | Labels are structurally contiguous; no WAV content inspected | Confirm same recording/segment, boundaries/time units and decoded duration/frame agreement |
| Independent hand correction | Publisher says SOFA then manual correction | SOFA/version, reviewer process, identity versus boundary edits, audio listening, and independence from Allosaurus/WFL predictions |
| Alphabet conversion | Original USAP IPA chart exists | Release-specific `cl`, coda Y/W, SP/AP/exh/vf, repeated-label/note conventions and unsupported affricate policy |
| Download/inspection/processing/evaluation | NC dataset license declaration exists | Clarify exact recording, performance, composition and label rights controlled, any exclusions, retention/consent terms and derived IPA permission |
| Thesis publication | No explicit project-specific response | Confirmation that aggregate numerical phone-recognition results may appear in an undergraduate thesis/public repository without sharing raw data |
| Audio/label redistribution | No full rights clearance | Exact restrictions; redistribution is not requested or planned |
| Checkpoint redistribution | Separate model rights unresolved | Dataset permission cannot grant Allosaurus weight rights; no checkpoints requested |
| Singing-domain inference | Single-voice singing is documented | Any future diagnostic must remain singing-specific; it cannot directly validate ordinary spoken-Tagalog errors or learner feedback |

The declared NC grant is real evidence and is not being relabelled as “no license.” What remains unsettled is the complete rights/annotation scope needed for the proposed use. A filename pair and valid timestamps do not establish human-phone reference correctness or permission for all underlying material.

## 3. UP-DSP/Aquino: unresolved access questions

The original project distinguishes gold `testref` CSV/LOG from generated `test`/`adapt`. Its paper describes linguist correction. The public repository does not provide matching audio or a data license. The UP-DSP registry lists WAV/LOG speech/text with a CC BY-NC declaration and additional research-only/no-sharing constraints. It does not establish that the sought gold-phone subset is included.

Clearance must identify:

1. The custodian and actual availability of matched Filipino/Tagalog recordings and manually verified observed-phone references; small samples before any complete dataset transfer.
2. Phone alphabet, timestamps, segmentation, speaker/session identifiers and human correction/agreement protocol. Written sentence prompts or machine phonetic output are insufficient.
3. Whether existing gold references can lawfully be joined to the audio, including the exact release/version and pairing manifest.
4. Institutional requirements: affiliation verification, adviser/ethics documentation, application, data-use agreement, access controls and retention/deletion obligations. None is assumed completed.
5. Permission for internal academic processing/evaluation, transparent IPA conversion and publication of aggregate results in an undergraduate thesis; identify any embargo/review/citation requirements.
6. Recording/annotation redistribution restrictions and whether a small existing evaluation subset can be supplied instead of the 45.63 GB multilingual release. No bulk data or public data redistribution is requested.

The verified initial email is `crisron.lucas@eee.upd.edu.ph` on the official UP faculty page. Previously documented Rhandley Cajote and Angelina Aquino referral information remains in Stage 4A.1 and the tracker; no guessed address replaces it. Contact identity is not proof that the person controls every requested right.

## 4. Ready-to-send email drafts — NOT SENT

These are finished draft texts for user review/manual sending. No sender name, university affiliation or approval record has been invented. A sender may add their actual name and institution before sending. No CC recipients or attachments are implied.

### A. Tiny Tagalog maintainer

Recipient email: **unspecified; no verified email address found**. Official contact route: [dataset repository](https://github.com/UtaUtaUtau/tiny-tagalog-dataset) / [issues](https://github.com/UtaUtaUtau/tiny-tagalog-dataset/issues). This email-style draft can be used once a legitimate delivery route is chosen; it has not been posted there.

Subject: Small WAV/LAB sample and research-use clarification for FLUENTT thesis

Hello,

FLUENTT is an undergraduate Computer Science thesis project in the Philippines. We are investigating offline phone recognition, not validating student pronunciation grades.

Could you provide one existing short WAV with its hand-corrected LAB file, without a bulk archive download? Please confirm the files match, the time units and symbol conventions, and whether repeated labels reflect rearticulation or sung-note segmentation. Were phone identities and boundaries checked against audio independently of Allosaurus or other recognizer predictions?

Could you clarify permission to inspect, process and evaluate the audio/labels, create transparent IPA conversions, retain a research copy and publish aggregate numerical results in an undergraduate thesis? Please identify rights or exclusions concerning the performance, underlying composition and phonetic labels, and any attribution or redistribution restrictions.

We recognize that singing is out-of-domain for ordinary spoken Tagalog. No training, redistribution of recordings/labels/checkpoints, or student ratings is planned. Thank you.

### B. UP-DSP/Aquino contact

To: `crisron.lucas@eee.upd.edu.ph` — verified on the [official UP faculty page](https://eee.upd.edu.ph/about/faculty/crisron-rudolf-lucas/).

Subject: Small matched Tagalog audio/phone-reference subset for FLUENTT thesis

Hello Professor Lucas,

FLUENTT is an undergraduate Computer Science thesis project in the Philippines. We are investigating independent validation of an offline phone recognizer. Your 2019 Aquino/Tsang/Lucas/de Leon project identifies linguist-corrected Tagalog references.

Could you advise how to access one or two existing short audio/reference pairs initially, rather than the complete corpus? We need the phone alphabet, timing/segmentation conventions and documentation of manual audio review and annotation origin, including independence from Allosaurus predictions.

Please advise the institutional requirements and who can authorize internal academic processing/evaluation, local IPA conversion, research retention and publication of aggregate numerical results in an undergraduate thesis. Are the matching gold references included in the current UP-DSP release? Please specify recording/annotation redistribution restrictions, consent limits and required citations or agreements.

No model training, recording/label/checkpoint redistribution or student scoring is planned. A referral to the appropriate custodian would be appreciated. Thank you.

## 5. Permission tracking

The operational table is [TAGALOG_DATASET_PERMISSION_TRACKER.md](TAGALOG_DATASET_PERMISSION_TRACKER.md). Both requests start **NOT SENT**. No response dates, granted rights, approved subset IDs or agreements are populated.

Keep request status separate from eligibility: SENT is not APPROVED; public download is not complete rights clearance; permission is not proof of independent annotation. Retain actual correspondence and scope before changing tracker states. The two draft bodies above have not been delivered through email, GitHub or a contact form.

## 6. Objective Section 4B gates

All applicable gates must pass for the specifically proposed scope, followed by separate authorization to execute Section 4B. Unknown is not pass.

| Gate | Evidence required to pass | Present status |
|---|---|---|
| G1 — Accessible matched data | Obtain a permitted short audio/reference pair; verify decoded properties, file hashes, segment identity, valid boundaries and timing units. Filename matching alone fails this gate | Both pending |
| G2 — Annotation origin/independence | Dated provenance/manual specifying observed phones, initial tools, human audio review, correction scope and model independence. No Allosaurus-derived gold or fabricated blindness attestation | Both pending |
| G3 — Research/publication rights | Applicable grant or authorized response covers the chosen audio/labels, inspection, processing, evaluation, conversion, retention and aggregate thesis publication; resolve exclusions and institutional requirements | Full scope pending for both; Tiny NC declaration retained as existing evidence |
| G4 — Transparent phone mapping | Versioned original alphabet and reviewed mapping, with explicit repeats, events, coda/glottal handling and unsupported-phone accounting; preserve originals, no hidden contrast removal | Both pending |
| G5 — Reproducible cohort | Frozen source/permission/annotation versions, audio/label hashes, coded speakers/sessions, inclusion/exclusion rules and calibration/test separation; no audio/reference mismatch | No cohort frozen |
| G6 — Domain disclosure | Scope states population/style and limitations; singing only supports an explicitly separate singing-domain diagnostic, not ordinary speech or learner-error validation | Tiny mismatch known; any narrow diagnostic scope still requires explicit approval |
| G7 — Independent model-use clearance | Review applicable existing checkpoint-use conditions separately; no dataset permission treated as weight redistribution permission | Weight redistribution unresolved; not requested or performed |

Keep the Stage 2 decoder and raw/corrected prediction separation intact. No evaluator changes are authorized by this section. A later PER reference must describe human-observed phones, not expected written text, automatic G2P or unreviewed forced alignment. Stress remains unsupported and excluded from pronunciation ratings.

## 7. Why PER and checkpoint rights remain separate

PER counts substitutions, deletions and insertions against a chosen phone transcription. With independent references it measures phone-recognizer agreement under that annotation/inventory policy. It does not establish whether a learner deviated from an accepted target, whether a difference harms intelligibility, or whether model feedback is correct and educationally useful. Those require separate intended-versus-observed references, accepted-variant policy and independent human error/rating evidence. No PER or pronunciation result was measured here.

Allosaurus's code is GPL-3.0. The inspected official checkpoint release/local archive still lacks a separately verified weight grant resolving redistribution. Dataset custodians are not presumed to control Allosaurus rights. No draft requests redistribution of weights, and neither dataset permission nor thesis status supplies it. Maintain the existing local-only boundary and obtain appropriate rightsholder clarification before any model packaging/deployment decision. The working English and MMS licenses/integrations are not replaced by this audit.

## 8. QA, files and final decision

Evidence root, ignored: `services/api/private-data/allosaurus-stage4a2/`:

- `previous-unsent-requests.md`: original Stage 4A.1 request text, extracted without edits.
- `source-checks.json` and small official source snapshots: exact URLs, hashes and retrieval outcomes.
- `baseline.json`: hashes of all five previous reports, 322 application/ML source files and ignored backend `.env` (323 protected files in total).
- `qa.json` and `evidence-hashes.json`: final preservation and artifact checks.

QA verifies that previous reports remain unchanged; both new requests say NOT SENT; the Tiny email address is unspecified; the UP address matches its verified source; no approval or evaluation result is asserted; and protected application/ML/settings bytes remain unchanged. No runtime tests were rerun because this section changes documentation only. Prior passing tests remain historical. No speech model was imported or executed, and no data/checkpoint payload was downloaded.

Files created: `docs/TAGALOG_ALLOSAURUS_STAGE4A2.md`, `docs/TAGALOG_DATASET_PERMISSION_TRACKER.md`. A decision note was appended to `docs/DECISIONS.md`; earlier material and drafts were preserved. No commit, push, deployment or production-data write occurred.

**Decision: NO-GO for Section 4B evaluation now.** The clearance package is ready for user review/manual sending, but access, annotation independence, complete mapping and full permission scope remain unresolved. Conditional future progress means obtaining and documenting those answers—not treating drafted emails as grants. Section 4B requires separate authorization and has not started. Tagalog pronunciation ratings remain disabled; English WavLM, Tagalog MMS, Voice UI, backend settings, FSRS-6, FIFAKT and Personal/Class Learning behavior remain unchanged.
