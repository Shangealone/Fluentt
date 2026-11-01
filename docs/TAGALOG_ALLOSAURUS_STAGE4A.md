# Section 4A — Independent dataset discovery and verification

Date: 2026-10-30. **Independent evaluation: BLOCKED / NO-GO at present.** No candidate was verified to satisfy all requirements for an in-domain Tagalog speech cohort with matched audio, independent human phone annotations and cleared use. There are conditional leads; this is not a finding that no such data exists.

Section 4A is discovery only. No dataset archive, audio or checkpoint was downloaded; no MMS/Allosaurus inference, PER measurement, training, recording collection, external contact or production change occurred. Tagalog pronunciation ratings remain disabled. Section 4B has not begun and requires separate authorization.

## 1. Scope and evidence standard

Read the Stage 1 pilot, Stage 2 and Stage 3 reports; reviewed the actual decoder patch, PER interface, current decisions and Git status. Retained the existing roadmap and all pre-existing working changes. Protected implementation/settings hashes were recorded before work.

Classification applies to the **published release for this evaluation purpose**:

- **ELIGIBLE:** matching audio and observed-phone labels, independently human-produced/corrected through audio review, with usable rights and compatible documented scope.
- **CONDITIONAL:** credible candidate needing specific file inspection, annotation evidence, permission or scope clarification.
- **INELIGIBLE:** inspected release lacks a necessary property. Commissioning new annotations would create a different resource; it does not make the present release eligible.

Publisher descriptions, metadata and small supporting files were inspected. Dataset archives were not opened. Claims about their contents below are explicitly attributed to the publisher where not verified inside the archive. An orthographic transcript, G2P prediction, automatic alignment or model hypothesis cannot substitute for a human observed-phone reference.

## 2. Candidate comparison

| Original resource | Matched material and annotation status | Classification |
|---|---|---|
| UtaUtaUtau, tiny-tagalog-dataset v1.0.0 | Publisher explicitly describes WAV plus HTK mono labels, initially SOFA-generated then hand-corrected; single-voice singing, archive contents not inspected | **CONDITIONAL**, out-of-domain only; not an eligible spoken-learner validation cohort |
| UP-DSP Philippine Languages Database, Mozilla registry | Published WAV/LOG speech/text; a matching independent phone tier in this release has not been verified | **CONDITIONAL** pending expert-label subset and terms |
| Silencio Network, Tagalog / Filipino Spontaneous Speech | Matched audio/human text; word timings explicitly machine-aligned with MMS; no phone field in published schema | **INELIGIBLE** as independent phone gold |
| Aquino et al., g2p-asr | Linguist-corrected gold phone CSV/LOG available; no matching audio or data license in repository | **CONDITIONAL**, strongest in-domain annotation lead |
| Google FLEURS, fil_ph | Matched read audio/text; no independent human phone annotations verified | **INELIGIBLE** as existing phone gold |

No resource is labelled ELIGIBLE on the strength of a title, a license tag alone or “human validated” text.

## 3. Tiny Tagalog singing dataset

Original publisher/source: [UtaUtaUtau/tiny-tagalog-dataset](https://github.com/UtaUtaUtau/tiny-tagalog-dataset), revision `ca452e63032acf01936a932401760d0710e19222`; [release v1.0.0](https://github.com/UtaUtaUtau/tiny-tagalog-dataset/releases/tag/v1.0.0). Repository and release API metadata were checked.

**Confirmed publisher documentation:** one masculine singing voice, 38 min 56 s, 19 source recording groups; age/dialect and segmented-clip count are not established. Audio is 44.1 kHz PCM16 after compression/denoising/dereverberation. Labels began with SOFA and were corrected by hand. Documentation does not establish reviewer qualifications, independent agreement or whether corrections cover observed phone identity as well as boundaries.

Release metadata explicitly distinguishes:

| Asset | Exact compressed size | Publisher-described contents |
|---|---:|---|
| `tiny-tagalog-dataset-unsegmented.7z` | 120,481,625 bytes | Original WAV files with HTK mono labels |
| `tiny-tagalog-dataset-segmented.7z` | 120,855,528 bytes | Segmented WAV files and `.ds` phoneme timing/MIDI data; publisher cautions about timing quality |

These descriptions support a matching-audio/label lead, but filenames, pair coverage, label units and transcription accuracy **were not checked inside either archive**. No archive was downloaded.

Alphabet: USAP-related symbols with coda/non-speech conventions, not direct IPA. The [support dictionary](https://github.com/UtaUtaUtau/tiny-tagalog-dataset/blob/ca452e63032acf01936a932401760d0710e19222/dsdict-fil.yaml) includes `ng`, `ty`, `dy`, `sy`, `q`, `Y`, `W`, `vf` and a `sy → sh` replacement. README distinguishes phonemizer `q` from dataset `cl`. This is evidence that a mapping is needed, not a validated mapping to Allosaurus. In particular, do not guess how closures, glottal stops, coda allophones or non-speech events should become IPA tokens. Confirm HTK time units and `.ds` schema before reading boundaries.

Rights: [LICENSE-DATASET](https://github.com/UtaUtaUtau/tiny-tagalog-dataset/blob/ca452e63032acf01936a932401760d0710e19222/LICENSE-DATASET) explicitly supplies CC BY-NC 4.0; the repository's MIT code license is separate. Dataset downloading/research evaluation and adaptations are covered for qualifying noncommercial use, with attribution/change notices; NC sharing is within the CC grant for rights the licensor controls. Commercial permission requires contacting the publisher. Confirm the rights/consent scope for the recorded performances and underlying song material before redistributing audio or relying on a broad deployment grant. No approval gate was visible for the public release; no separate agreement was accepted.

**Why conditional:** the explicit matching-label release and hand-correction claim merit a bounded future inspection, but the data remain single-voice singing with an unreviewed symbol conversion and annotation protocol. Singing changes duration, vowel quality, timing and articulation. A justified use would be a **singing-domain engineering diagnostic only**, reported separately from spoken speech, with no learner-population or pronunciation-rating claim. It must not replace the roadmap's independent spoken-Tagalog validation.

Storage planning: choose one archive, not both, if later authorized. Expanded size is unknown. Pure 44.1 kHz mono PCM16 for 38:56 would occupy approximately 206 MB before metadata/copies; that is an estimate, not an archive measurement, and stereo would double it. Reserve at least 1 GiB for a small inspection workflow and verify actual expansion limits. No GPU is needed to inspect labels.

## 4. UP-DSP Philippine Languages Database

Original steward: UP EEEI Digital Signal Processing Laboratory. [Mozilla registry entry](https://mozilladatacollective.com/datasets/cmmxhw46c00tqnw07xyr94zjk), release date shown as 2026-03-19; [original corpus paper](https://aclanthology.org/2024.sigul-1.32.pdf).

The paper's Table 2 reports the Filipino subset as **135 speakers, 52,879 utterances, 48:56:36**, including 79 female and 56 male speakers. These are the publication's corpus statistics, not confirmed counts in the current registry archive or a human-phone subset. The wider collection includes read/spontaneous speech and regional/age variation, often young adults. Stored recordings are described as 16 kHz WAV with session LOG text. Spontaneous LOG entries initially held prompt placeholders before transcription, so even textual completeness must be checked per file.

The registry lists a **45.63 GB** `tar.gz` release with WAV/LOG format. It does not identify an independent human phone-label tier, alphabet or approved phonetic-test subset. “Phoneme transcriber” as a potential application is not proof that phone annotations ship with the data. Label identity, human review, matched filenames and exact release counts remain unverified.

Rights evidence on the registry: CC BY-NC 4.0 is declared, while its special constraints additionally say research-only use and no sharing/redistribution without written consent. These statements cannot be treated as a clean unrestricted redistribution grant; ask the steward to clarify the operative terms. Download/evaluation approval, permitted label conversion and redistribution scope should be confirmed for the requested subset. A download button exists, but login/approval/agreement requirements for obtaining it were not tested or accepted. No archive was downloaded.

**Classification: CONDITIONAL.** Request an existing expert-annotated Filipino/Tagalog subset, audio-to-label manifest, annotation manual, sample counts, speaker metadata and clear written evaluation/derivative/sharing terms. The Aquino study below is a concrete lead for such labels, but its files cannot be assumed to be included in this registry release.

Storage: compressed size alone is large; unpacked size is unknown. The PC showed about 97.07 GiB free on C: during this audit. A full download plus extraction/copies could exhaust that space; available disk is not authorization to fetch it. Request a small matched subset rather than the full multilingual corpus. Metadata/label inspection does not require an ML model or GPU.

## 5. Silencio Tagalog / Filipino Spontaneous Speech

Original publisher: Silencio Network. [Dataset](https://huggingface.co/datasets/SilencioNetwork/tagalog-filipino-speech), pinned revision `9fd981c7c51c1406b4a6f93bab35bc090b8ab425`; [card](https://huggingface.co/datasets/SilencioNetwork/tagalog-filipino-speech/blob/9fd981c7c51c1406b4a6f93bab35bc090b8ab425/README.md), [statistics](https://huggingface.co/datasets/SilencioNetwork/tagalog-filipino-speech/blob/9fd981c7c51c1406b4a6f93bab35bc090b8ab425/stats.json), [file metadata](https://huggingface.co/api/datasets/SilencioNetwork/tagalog-filipino-speech?blobs=true).

Metadata reports 90 clips, 16 speakers, 2.03 hours, 48 kHz stereo WAV, spontaneous/device-recorded speech. Speaker statistics report 15 men/one woman, age bands 18–59 and predominantly Manila origins; self-declared proficiency is 15 native/one fluent. These are publisher-reported descriptors, not independently audited acoustic attributes.

The card explicitly separates human transcription from **machine word timings** produced by `wav2vec2_mms`. Published schema has orthographic text and timed `words`; no phone alphabet or phone-label field. Matching audio/text is available, but these labels are not phonetic gold. **Classification: INELIGIBLE** for the present objective.

CC BY-NC 4.0 is declared for noncommercial research/evaluation; attribution is required. The card says commercial-product benchmarking requires a separate license. Its API reports public, ungated access. CC permits NC adaptations/sharing within its scope; retain license and source notices, and clarify consent/withdrawal duties for redistribution. Full provenance is offered to licensees via [publisher contact](https://www.silencio.network/contact). A different existing human-phone tier would require separate verification.

File-size metadata independently lists **seven Parquet shards totalling 1,024,946,571 bytes**; none was downloaded. Decoder examples require `datasets>=4` and FFmpeg, which must not be installed into the working ML environment for this audit. The card has an example using `train`, but the actual published split is `test`; the latter is the verified schema. Most clips exceed the current 30-second diagnostic limit, so any future use needs frozen subsegments, not silent truncation. Storage should allow at least the shard total plus decoded working copies; phone labels cannot be obtained merely by decoding those files.

## 6. Additional credible resources

### Aquino et al. g2p-asr — CONDITIONAL

[Original repository](https://github.com/AngelAquino/g2p-asr), revision `895c4b9beb9c9763ea9a23b529666d57a5cd8e3b`; [author-hosted paper](https://github.com/AngelAquino/g2p-asr/blob/895c4b9beb9c9763ea9a23b529666d57a5cd8e3b/ismac2019.pdf), DOI [10.1109/ISMAC.2019.8836168](https://doi.org/10.1109/ISMAC.2019.8836168).

The publication describes linguist-corrected G2P-assisted phone references for UP ISIP speech, including ten Tagalog speakers and about 3:05 h; age/dialect distribution and utterance total need confirmation. The gold `testref` tier is distinct from generated `test`/`adapt` output. One small-set and two large-set Tagalog test-reference CSVs were previously identified, with overlap; those counts are not utterance counts. Repository inspection again found **zero audio files and no license document**.

The study uses a compiled phone inventory with native/loanword categories; machine-readable symbol conversion to Allosaurus and observed-versus-intended conventions require author confirmation. No license means download visibility is not permission to integrate, modify or redistribute data. Request matched audio/labels and written research/evaluation/adaptation terms from Aquino/Tsang and UP DSP, with annotation details from their Linguistics collaborators. Matching audio size/access terms are unknown. The small public text metadata are a lead, not an authorized frozen cohort.

### FLEURS fil_ph — INELIGIBLE as existing phone gold

[Google/FLEURS original dataset](https://huggingface.co/datasets/google/fleurs), CC BY 4.0. Read Filipino speech with sentence text; existing local tests use only IDs 1869/1930 and an excerpt. Exact independent human-phone population verified: none. The public card does not supply a phone annotation alphabet for these clips. BY terms support credited reuse/adaptation/sharing within their scope, but they do not turn transcripts into phone annotations. Full current subset size/speaker population were not re-audited; neither is needed to reject the missing phone tier. Future human annotation would be a separate activity, not discovery of existing gold.

VoxAngeles was also considered under Stage 3's documented audit: its original-language metadata contains Tagalog, but no matching audited Tagalog release subset was verified. It does not supply a newly eligible alternative in Section 4A. No additional audio was fetched.

## 7. Rights interpretation and evidence boundaries

[CC BY-NC 4.0 legal code](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en) permits noncommercial copying/sharing and adaptations of licensed material, subject to attribution and other conditions; it does not supply rights the licensor lacks or clear privacy/personality rights automatically. A thesis name alone does not decide whether a use is noncommercial. This report distinguishes the dataset's declared grant from unresolved release-specific restrictions and underlying rights. It is not legal certification.

| Candidate | Download / NC research evaluation | Label conversion/modification | Redistribution |
|---|---|---|---|
| Tiny dataset | Declared CC grant; public assets; not exercised | NC adaptations permitted within grant; phonetic mapping still scientifically unverified | Declared NC sharing grant; confirm underlying rights and required notices before shipping audio |
| UP-DSP registry | Research use described; access/terms clarification needed | Not cleared for the sought phone-label subset | Explicit registry restriction requires clarification/written consent |
| Silencio release | NC evaluation described; commercial benchmarking requires license | NC adaptation grant; no existing phone tier to convert | CC conditions plus source/consent provenance review; no corpus sharing performed |
| Aquino gold references | No data grant verified | Not verified | Not verified |
| FLEURS | BY reuse available | BY adaptations available | BY sharing available; attribution/other rights still apply |

Allosaurus weight redistribution remains separately unresolved under the prior reports. A dataset license cannot cure checkpoint rights, and neither rights issue was bypassed. No weights were downloaded or distributed.

## 8. Existing interface compatibility

Static source review and AST comparison confirm the Stage 2 correction is intact: previous-label state updates on blank frames. No decoder/model source changed and no model was imported for discovery.

Existing PER accepts explicit arrays of phone tokens with NFC normalization only, using unit-cost `nfc-token-unit-edit-v1`. It requires human-audio provenance, a model-blind attestation, source/license, annotation protocol, audio hash and speaker ID. These fields are caller attestations, not automatic rights/quality certification. Do not set them merely to bypass validation. Human-corrected labels qualify only after audio-review provenance is established, retaining their machine initialization separately.

Tiny's HTK/USAP and Aquino's corpus alphabet need approved mappings, while PLD/Silencio orthographic LOG/word tokens cannot be supplied as IPA. Preserve original labels and document every mapped/excluded symbol. Allosaurus has unsupported inventory entries and no stress labels; do not remove contrasts silently, invent stress or treat vowel length as stress accuracy. Unreviewed forced alignment is not independent annotation.

## 9. Cohort and Section 4B recommendation

**No best ELIGIBLE candidate exists in the evidence verified here. No evaluation cohort was frozen and no PER/accuracy was measured.**

Priority actions for a separately authorized Section 4B:

1. **Preferred in-domain route:** ask the Aquino/Tsang project authors and UP EEEI DSP steward for an already-existing, small matched gold subset and written permissions. Confirm human review, observed phones, inventory, speaker scope and whether the current registry includes those labels. Request a sample file pair or file listing before a large transfer.
2. **Secondary technical route:** ask UtaUtaUtau to clarify hand-correction scope, original HTK symbol/time conventions, exact pair inventory, reviewer independence and use/redistribution rights. If later authorized, inspect one bounded release/subset in ignored storage. Report any test as singing-domain exploration, never learner spoken-Tagalog validation.
3. Ask Silencio only whether a separately available **existing human phone tier** exists, with a sample schema and license. The present word-level release does not satisfy the objective. Do not order new recordings or assume catalogue scale implies phone annotations.

No messages were sent, no agreement accepted and no new annotation commissioned.

If the preferred route later becomes eligible, a proposed initial engineering cohort is up to **20 short, complete utterances across at least five speakers**, disjoint from any mapping/calibration material. This is a planning specification, not selected sample IDs or an adequately powered confirmatory cohort. Freeze source revision, rights and file hashes first. Among eligible speakers, sort by SHA-256 of UTF-8 `revision + newline + speaker_id`; select the first five with eligible material. Within each, sort by SHA-256 of UTF-8 `revision + newline + speaker_id + newline + sample_id`, then take up to four eligible items under fixed 0.5–30 s bounds. Report fewer samples if insufficient; do not duplicate clips. A one-voice singing set cannot satisfy that speaker design and must remain separate.

Future manifest fields: dataset/release/revision, permission evidence, relative audio/label files and hashes, original/decoded sample properties, segment boundaries, coded speaker/session, original alphabet, mapping policy, original labels, reviewed `reference_phones`, annotation provenance and exclusions. Add `raw_upstream_phones`/`corrected_ctc_phones` only after separately authorized inference; never populate reference phones from those predictions.

Checks before using the unchanged PER tool: one-to-one audio/label pairing; nonempty complete labels; verified boundary units and within-file timing; independent human correction; reviewed alphabet mapping and unsupported-phone accounting; no overlapping duplicate segments across calibration/test; legitimate speaker IDs; exact decoded-audio identity; preserved original references. Only then generate the tool's JSONL rows (`id`, explicit reference/hypothesis tokens, required `annotation` provenance) and run it in the isolated environment. Aggregate per-speaker/corpus S/D/I and phone counts and report uncertainty according to Stage 3. PER alone does not validate pronunciation quality. None of these Section 4B operations occurred now.

## 10. Audit artifacts, outcomes and stopping point

Ignored evidence root: `services/api/private-data/allosaurus-stage4a/` contains pinned publisher cards, schema/statistics, file trees/release metadata, tiny dataset license/support dictionary, `discovery-decision.json` and preservation/evidence hashes. No dataset audio, large archive or checkpoint is present. Public metadata can support future verification but does not constitute annotation access permission.

| Component | Outcome |
|---|---|
| Requested-source discovery | PASS: original cards, provenance and file-size/license evidence inspected |
| Matching phone-reference availability | PARTIAL: explicit HTK-pair release claim found; eligible in-domain data not verified |
| Current independent PER evaluation | BLOCKED / NO-GO |
| Existing decoder/PER interface review | PASS static inspection; no code modification or new runtime accuracy claim |
| Working feature preservation | PASS protected-file hashes; no product changes |
| Section 4B | CONDITIONAL GO for permissions/limited file verification only after separate authorization; not started |

No runtime regression or inference suite was rerun for this documentation-only discovery task. Earlier passing tests remain historical. Only this report and a `docs/DECISIONS.md` note changed; ignored audit evidence was added. English WavLM, Tagalog MMS, Voice UI, backend settings, FSRS-6, FIFAKT and Personal/Class Learning behavior were preserved. Student-facing Tagalog ratings remain disabled.
