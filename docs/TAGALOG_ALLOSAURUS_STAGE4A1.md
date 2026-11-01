# Section 4A.1 — Dataset clearance and annotation verification

Date: 2026-10-30. **Decision: NO-GO for independent evaluation; Stage 4A's status is preserved.** New evidence verifies Tiny Tagalog archive filenames and actual phone-label structure without a large download. It does not clear all annotation, acoustic-match, rights or domain prerequisites. No candidate satisfies every eligibility condition yet.

No application/evaluator/model changes, Allosaurus/MMS inference, training, checkpoint downloads, new recordings, participant collection, PER measurement or external messages occurred. Section 4B has not started. Tagalog pronunciation ratings remain disabled. All pre-existing working changes were preserved.

## 1. Work and evidence boundaries

Read all four required project reports and the established decisions. Reviewed the actual isolated decoder patch and `services/api/ml/allosaurus_stage2/metrics.py`. This task used static text/metadata inspection and a small, bounded archive-label inspection under the publisher's declared noncommercial dataset terms. No audio payload was downloaded or listened to.

Evidence is retained under ignored `services/api/private-data/allosaurus-stage4a1/`. Public sources are linked below. Publisher statements, directly inspected contents and unresolved assumptions are distinguished explicitly. Structural annotation counts below are not reference accuracy or a measured PER.

## 2. Tiny Tagalog: original sources and small-sample access

Original publisher: UtaUtaUtau. [Dataset repository](https://github.com/UtaUtaUtau/tiny-tagalog-dataset), revision `ca452e63032acf01936a932401760d0710e19222`; [v1.0.0 release](https://github.com/UtaUtaUtau/tiny-tagalog-dataset/releases/tag/v1.0.0), [release API](https://api.github.com/repos/UtaUtaUtau/tiny-tagalog-dataset/releases/tags/v1.0.0).

Publisher documentation identifies a single masculine singing voice, 38:56 total, 19 recording groups, 44.1 kHz PCM16 and compression/denoising/dereverberation. It states SOFA initialized the labels and all labels were hand-corrected. Neither the claim's review scope nor acoustic accuracy has been independently established here. The stated processing chain is not a rights-transfer document.

The current repository tree contains no separately downloadable WAV/LAB/DS/TextGrid example. All public release metadata list two dataset archives: unsegmented 120,481,625 bytes and segmented 120,855,528 bytes. The other `wfl` release is a 1,337,761,762-byte model archive and was not fetched or used. No individually released matched sample pair was found in the inspected repository/releases.

### Bounded archive inspection actually performed

HTTP byte ranges were supported. Every response used for the probes was 206 with checked byte counts/ranges; full-body responses were not accepted. Using the documented [7z format](https://github.com/ip7z/7zip/blob/main/DOC/7zFormat.txt) and Python's standard LZMA decoder:

| Retrieved part of unsegmented archive | Exact bytes |
|---|---:|
| Start header | 32 |
| Encoded next header | 37 |
| Compressed file-index metadata | 638 |
| Separate compressed label block | 55,489 |
| Total archive bytes fetched | **56,196** |

The compressed index expanded to 2,106 bytes with matching metadata CRC. It lists **19 matching filename stems**, `TGL_core_001` through `TGL_core_019`, each with `.wav` and `.lab`. The index describes two packed streams: a 55,489-byte label stream and a 120,425,429-byte audio stream. The latter was **not fetched**. The label stream expanded to 215,221 bytes; all 19 extracted label members matched their archive CRCs, and SHA-256 hashes were recorded.

This advances the evidence from a release-description claim to actual matching-name and label-content verification. It does not establish that the audio is readable, acoustically aligned or correctly transcribed. A CRC confirms consistency with the archive metadata, not human annotation quality or cryptographic publisher authenticity.

**Small matched sample conclusion:** labels can be inspected without a large download, and matching audio names exist. A complete, genuinely small matched **audio-content plus label** sample was not obtained or acoustically checked. Byte-range support alone does not prove that arbitrary compressed audio members can be extracted independently. No selective audio extractor was implemented. An existing rights-cleared, separately provided short WAV/LAB pair is the most direct next step; do not infer legal clearance or sample validity from archive accessibility.

Supporting local evidence: `tiny-range-probe.json`, `tiny-next-header-probe.json`, `tiny-file-index-inspection.json`, `tiny-stream-layout.json`, `tiny-file-members.json`, `tiny-label-inspection.json`, and ignored `inspected-labels/`. No full `.7z` archive or WAV is present in this task's evidence folder.

## 3. Actual label format, repeats and boundaries

Direct inspection found 19 UTF-8-compatible `.lab` files with **9,515 nonempty records**, each containing three whitespace-separated fields: integer start, integer end and one label symbol. There are **30 distinct symbols**. Every file starts at zero; no negative/zero durations, overlaps or gaps were found in these integer intervals.

The endpoint totals divided by 10,000,000 yield 2,336.5529408 seconds, consistent with the publisher's rounded duration. The values are consistent with conventional HTK 100 ns units. However, WAV headers and exact decoded frame counts were not inspected, so this is a consistency inference rather than a verified audio/label boundary match. Do not blindly commit a unit conversion into the evaluator.

There are **74 adjacent repeated-label pairs** with touching boundaries. Their symbols are `a`, `o`, `n`, `s`, `t`, `i`, `k`, `l`, `m`, `ng`, `AP` and `u`. These labels must not be deduplicated to improve model agreement. Conversely, their presence does not prove each represents a separate acoustic phone; tied sung notes, rearticulation and annotation conventions require clarification and audio review. It is a different question from the repaired CTC blank-reset defect.

Publisher-described nonstandard/event symbols and inspected counts:

| Symbol | Publisher meaning | Rows inspected | Evaluation implication |
|---|---|---:|---|
| SP | Pure silence | 219 | Retain as a separate event; a future explicit segmental policy must decide exclusion |
| AP | Breathing | 531 | Not automatically a phone or CTC blank |
| exh | Breathy release | 57 | Requires treatment separate from arbitrary phone deletion |
| vf | Vocal fry | 181 | Phonation/event semantics need review |
| cl | Dataset replacement related to USAP q | 43 | Must confirm each label's intended glottal/closure meaning against audio |
| Y / W | Coda-marked variants in USAP | 103 / 37 | Do not silently discard syllable-position information |
| dy / ty | Affricate symbols | 7 / 3 | Current Allosaurus `tgl` output inventory lacks their documented IPA affricates |

Counts describe the released labels only. No human pronunciation-error rate, model error count, intelligibility result or acoustic judgment was calculated. Raw label files remain in ignored storage; no song transcript is reproduced as evaluation gold.

## 4. Alphabet documentation and unchanged PER interface

The author's [USAP specification](https://github.com/UtaUtaUtau/USAP/blob/84a08ce81e5a2faeda8ae282f7b93543e6a76927/PHONEMES.md) and [English description](https://github.com/UtaUtaUtau/USAP/blob/84a08ce81e5a2faeda8ae282f7b93543e6a76927/README.en.md) are accessible through the original repository/API, despite browser-tool cache failures. Revision: `84a08ce81e5a2faeda8ae282f7b93543e6a76927`. These provide a documented starting point rather than an invented alphabet.

| USAP symbol | Documented IPA correspondence |
|---|---|
| ng | ŋ |
| g | ɡ |
| r | ɾ |
| y | j |
| sy | ʃ |
| dy | dʒ |
| ty | tʃ |
| q | ʔ |

The specification permits uppercase Y/W as coda markers. Tiny's supporting dictionary and README add release-specific conventions, including `cl` in the dataset versus `q` in the phonemizer. A formal release-to-USAP-to-IPA mapping is **not yet approved**. The alphabet docs are declared CC0; their separate WikiPron-derived dictionary is described as CC BY-SA 4.0. Neither grants rights to the singing audio, and the dictionary is not observed-speech gold.

Existing PER consumes explicit IPA-token arrays with NFC normalization only; it does not parse HTK timestamps or convert USAP. It preserves repeated tokens. `ng` must not become two IPA characters, and affricates must remain deliberate segment tokens. Allosaurus's `tgl` mask does not expose `dʒ`/`tʃ`, although universal acoustic units include affricate categories. No mode switch, substitution to a supposedly similar phone, or scoring exclusion was implemented to conceal that mismatch.

The evaluator's `human_audio_transcription` and `model_blind` attestations require evidence. A SOFA initialization plus “hand corrected” statement cannot automatically be converted into proof of observed-phone identity review or Allosaurus blindness. Preserve machine initialization, human changes, event tiers, repeats and mapping provenance if a later reference set is approved. Stress prediction remains unsupported and must not contribute to pronunciation ratings.

## 5. Independence, domain and rights clearance

### Independence and scientific suitability

Confirmed: the publisher attributes initial labels to SOFA, followed by manual correction; no Allosaurus use is identified in that description. Not confirmed: exact SOFA/checkpoint/version, label-generation text/dictionary, who corrected labels, whether identity versus timing was corrected, audio-listening protocol, independence from Allosaurus/WFL outputs, and agreement/adjudication records.

Absence of an Allosaurus mention is not proof of independence. Structurally consistent labels can still reflect expected lyrics rather than observed realizations. **Reference-phone suitability remains conditional** until those points and a small audio sample are checked.

These are singing recordings, out-of-domain for ordinary Tagalog speech. A later limited singing-domain recognizer diagnostic would need explicit scope and separate reporting. It would not validate learner speech, pronunciation-error detection, accepted spoken variants, stress scoring or a student rating. One voice also cannot support speaker-population uncertainty claims.

### Rights, separated by object

| Object | Verified evidence | Unresolved scope |
|---|---|---|
| Repository/supporting code | [MIT LICENSE](https://github.com/UtaUtaUtau/tiny-tagalog-dataset/blob/ca452e63032acf01936a932401760d0710e19222/LICENSE), copyright 2026 UtaUtaUtau | Does not license audio or compositions |
| Dataset label/audio release | [LICENSE-DATASET](https://github.com/UtaUtaUtau/tiny-tagalog-dataset/blob/ca452e63032acf01936a932401760d0710e19222/LICENSE-DATASET) and README declare CC BY-NC 4.0 | Grant covers rights the licensor controls; no separate chain-of-title/annotation contributor documentation verified |
| Performance and sound recording | Publisher describes own recording/processing and offers the release under dataset terms | Performer/processor permissions and exact rights controlled are not independently documented |
| Underlying songs/compositions | README names existing third-party songs/artists | No composer/publisher permissions or license exclusions verified; do not presume the dataset's CC declaration clears all composition rights |
| Converted labels and redistribution | [CC BY-NC legal code](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en) permits qualifying NC adaptations/sharing within its scope and conditions | Retain attribution/change notices; underlying rights/privacy limitations remain. No redistribution clearance for all objects was established |

The small label inspection used the publisher's declared NC research grant; it is not a certificate of complete rights for all components. No audio was fetched, no labels/audio were redistributed, and no statutory exception was assumed to authorize deployment. Ask for explicit clarification of internal research evaluation, label conversion, retention and any permitted redistribution. **Complete rights clearance remains unresolved.**

## 6. UP-DSP/Aquino documentation and legitimate access routes

Original research sources remain the [Aquino/Tsang/Lucas/de Leon repository](https://github.com/AngelAquino/g2p-asr) at `895c4b9beb9c9763ea9a23b529666d57a5cd8e3b`, its author-hosted 2019 paper, the [author's publication page](https://angelaquino.github.io/publication/2019-08-19-g2p-asr), and [UP-DSP's official registry](https://mozilladatacollective.com/datasets/cmmxhw46c00tqnw07xyr94zjk).

The research paper describes linguist-corrected Tagalog phone references for UP ISIP speech. The repository distinguishes gold `testref` CSV/LOG from generated `test`/`adapt`. Current recursive inspection again found no audio and no license file. The registry offers WAV/LOG text/speech but does not establish that those specific independent gold phone annotations accompany it. Its CC BY-NC declaration and additional research-only/no-sharing constraints need clarification for the desired subset. No bulk download or access agreement was attempted.

Verified contact/access routes:

| Contact | Public authoritative evidence | Appropriate request |
|---|---|---|
| Crisron Rudolf Lucas | [UP faculty page](https://eee.upd.edu.ph/about/faculty/crisron-rudolf-lucas/) lists `crisron.lucas@eee.upd.edu.ph` | Coauthor route for annotation protocol, matched subset and correct rights contact |
| Rhandley Cajote / UP DSP | [Official lab page](https://eee.upd.edu.ph/research/research-laboratories/digital-signal-processing-laboratory/) and [faculty page](https://eee.upd.edu.ph/about/faculty/rhandley-cajote/) list the lab/head and `rhandley.cajote@eee.upd.edu.ph` | Corpus stewardship/access and current data-use agreement |
| Angelina Aquino | [Author publication page](https://angelaquino.github.io/publication/2019-08-19-g2p-asr) lists `angelina.aquino@cdu.edu.au` | Original project/referral; address is publicly listed, delivery/current authority not tested |
| UtaUtaUtau | [Original dataset repository](https://github.com/UtaUtaUtau/tiny-tagalog-dataset); repository API confirms issues enabled | Dataset sample/protocol/rights clarification; no private email guessed |

These routes do not establish that each person can grant every right or that access will be approved. No contact was made and no permission was granted during this task.

## 7. Prepared requests — NOT SENT

These are drafts for the user to review/send later, not messages already delivered or legal agreements.

### Tiny Tagalog draft

Intended route: UtaUtaUtau through the original repository's contact/issues route.

Subject: Existing small WAV/LAB sample and annotation-rights clarification

Hello, we are developing FLUENTT for a noncommercial thesis. Could you share an existing short WAV plus hand-corrected HTK LAB pair for offline phone-recognizer evaluation, without downloading the full archive?

Please confirm the timestamp units; `cl`, Y/W and non-speech conventions; and whether repeated vowel/phone labels represent rearticulation or note segmentation. Which SOFA version initialized the labels, and were both phone identities and boundaries checked against audio independently of Allosaurus or other recognition outputs?

Could you clarify permission for internal research evaluation and derived IPA labels, and which rights you control for the recording, performance, song/composition and phonetic labels? Please identify any exclusions or additional permissions. We do not plan training, student pronunciation ratings or redistribution. We understand singing cannot establish ordinary spoken-Tagalog pronunciation quality. Thank you.

### UP-DSP/Aquino draft

Intended initial recipient: Crisron Rudolf Lucas (`crisron.lucas@eee.upd.edu.ph`); the verified UP DSP steward is a referral route, not an automatically copied recipient.

Subject: Access to a small matched Tagalog audio/gold-phone subset

Hello Professor Lucas, we are developing FLUENTT for a noncommercial thesis and investigating independent validation of a phone recognizer. Your 2019 Aquino/Tsang/Lucas/de Leon project identifies gold Tagalog phone references. Could you advise how to obtain a small existing matched audio/reference subset and the applicable written research-use terms?

We need the phone inventory, timestamp conventions, speaker/session IDs, and details of linguist review: observed realization versus intended pronunciation, correction scope, and any agreement/adjudication records. Are these labels included in the current UP-DSP release, and who can authorize evaluation, local IPA conversion and retention?

We will not train models, redistribute recordings/labels or activate student grades. Please specify consent/access restrictions and whether a small sample pair can be supplied before a bulk transfer. A referral to the appropriate custodian would also help. Thank you.

## 8. Eligibility checklist, ranking and Section 4B recommendation

| Required condition | Tiny Tagalog | UP-DSP/Aquino |
|---|---|---|
| Accessible matching-name inventory | PASS: 19 WAV/LAB stems in archive metadata | PARTIAL: gold files known, audio pairing/access unresolved |
| Actually inspected small matched audio and phone sample | NOT VERIFIED: label payload only | NOT VERIFIED |
| Independent observed-phone human annotations | CONDITIONAL: reported correction, protocol unverified | CONDITIONAL: linguist correction reported; matching protocol/access incomplete |
| Clear rights for proposed use and derived references | CONDITIONAL: NC grant declared, full rights scope unresolved | CONDITIONAL: data permissions/registry terms need clarification |
| Complete documented, approved Allosaurus mapping | NOT MET: base USAP table found, release exceptions/events/repeats and affricates unresolved | NOT MET: approved corpus-to-model mapping absent |
| In-domain ordinary learner speech | NO: single-voice singing | Potentially relevant spoken corpus; learner population not established |
| All conditions satisfied | **NO** | **NO** |

Ranking: **UP-DSP/Aquino first for the scientific objective**, because it is a spoken-Tagalog annotation lead; **Tiny first only for a narrow format/sample clarification**, with singing results segregated from learner validation. Neither is ready for independent PER evaluation.

**Recommendation: preserve NO-GO for Section 4B evaluation. CONDITIONAL GO only for separately authorized permission/sample clarification.** Before any later run, obtain an actually matched rights-cleared short audio/reference pair, verify the human-label protocol, freeze the event/repeat/inventory mapping and confirm scope. No evaluator edit is necessary or authorized at this point; do not assert model-blind provenance merely to pass its metadata checks. Stress remains unsupported and ratings remain disabled.

## 9. Preservation, artifacts and stopping point

Only this report and an appended `docs/DECISIONS.md` note were changed. Ignored audit metadata and the small inspected label block/files were retained, not added to product source. Evidence root: `services/api/private-data/allosaurus-stage4a1/`:

- Official repository trees/release metadata and copied small license/specification documents.
- Archive range/header/index records and parsed member/stream layout.
- `tiny-label-inspection.json`: structural results and per-file hashes; `inspected-labels/`: original inspected labels.
- `eligibility.json`: NO-GO decision, no audio content inspected, no PER/model execution.
- `baseline.json` and `evidence-hashes.json`: protected-file and audit-artifact verification.

No model/runtime regression suite was rerun for this documentation/label-inspection task. Earlier tests remain historical, not new accuracy evidence. No speech model was imported or run. English WavLM, Tagalog MMS, Voice UI, backend settings, FSRS-6, FIFAKT and Personal/Class Learning behavior were preserved. No drafts were sent. **Section 4A.1 ends here; Section 4B has not started.**
