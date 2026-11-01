# Allosaurus Stage 2 — isolated decoder and evaluation audit

Date: 2026-10-30. **Overall: PARTIAL. Decoder correction PASS; pronunciation-feedback reliability BLOCKED by missing usable independent phone annotations.** No student pronunciation ratings or production integration were enabled. No checkpoint was downloaded or redistributed. Stage 1 recordings and already-prepared local weights were reused.

## Acceptance criteria frozen before the final run

These are engineering/research gates, not achieved results or standardized pronunciation thresholds.

1. Decoder: exact agreement with independent CTC collapse (merge adjacent equal labels, then remove blanks) on every path over blank/a/b through length 7; regression coverage for blank-separated repetition, adjacent repeats, empty paths, all blanks and short paths. No synthetic duplication from a continuously emitted phone. Raw upstream output must remain reproducible.
2. Audio harness: accept only complete mono PCM16 8 kHz WAV, 0.5–30 seconds, bounded input; reject malformed/truncated/wrong-format, too-short, excessive-duration and zero/near-silent input before inference. These are diagnostic input limits, not a claim of speech detection. A real 0.6-second speech excerpt must execute without a crash; semantic or phonetic accuracy is not assumed.
3. Provenance: preserve original acoustic logits, unmodified upstream predictions, corrected CTC predictions, audio/model/code hashes and decoder identity separately; no spelling-derived replacement phones or hidden postprocessing.
4. Metrics: deterministic unit-cost phone-token Levenshtein alignment; report substitutions/deletions/insertions, reference count and micro PER. Use match, substitution, deletion, insertion tie priority. Empty references are invalid. Unicode-normalize tokens to NFC without folding phone contrasts; never split IPA into characters. Synthetic metric tests must pass. Real PER requires independently annotated, legally usable, matching audio references; absence means BLOCKED, not a generated gold reference.
5. Real recognition reliability gate: with an adequate independent, speaker-disjoint human-phone set, provisional micro PER ≤0.20, speaker-bootstrap upper 95% bound ≤0.25, and glottal-stop error precision ≥0.80 with at least 50 supported instances. These proposed targets must be reconsidered in a separately designed pilot before confirmatory data collection; no small convenience sample can establish this gate. Passing phone recognition alone never validates learner pronunciation feedback or a rating.
6. Runtime: no overlapping speech-model processes; retain existing MMS 8 GiB gate. Allosaurus process-tree sampled RSS <1 GiB, each diagnostic real-clip acoustic/decode time below clip duration, no emergency memory stop (1.5 GiB free floor), existing memory gates unchanged. Sequential MMS success is conditional on sufficient measured headroom; otherwise record a safe block.
7. Preservation: unchanged English/MMS code, Voice UI, backend settings and learning/research behavior; relevant existing speech regression tests pass or actual failures are reported. No checkpoint download or redistribution. Existing local checkpoint hashes must verify before loading; no automatic downloads or unsafe pickle fallback.

## 1. Inspection and scope

Read the Stage 1 report, actual installed Allosaurus source, Stage 1 harness/supervisor, sample/model manifests and saved `run1`, `run2`, `run3` results. All three Stage 1 synthetic `a–blank–a` tests saved `a`, confirming the report against its evidence. Checked current Git status, architecture/decisions, existing speech modules, workers, tests and mobile architecture. Preserved the substantial pre-existing working changes.

This implementation is under `services/api/ml/allosaurus_stage2/` and has no API registration, Voice UI import or backend configuration change. It uses the separate Stage 1 dependency overlay and its existing numeric runtime. The installed original decoder remains byte-for-byte unchanged. Protected-file hashes covering English/MMS code, pronunciation modules, Voice components and `.env` were recorded before work and matched afterward. Working learning/scheduler/research behavior was not modified. No commits, pushes, deployments, participant collection or database writes occurred.

## 2. Defect, smallest fix and deterministic verification

The original installed decoder SHA-256 is `5f690d4d699bb2bbe9b04012ea65878299d413ea7574e3a870b94518e4722e82`. It updates `cur_max_arg` only inside the nonblank-emission condition. A blank therefore fails to reset the previous frame label. The next occurrence of the same phone is incorrectly suppressed.

`decoder.py` is an isolated GPL-attributed copy of the upstream 1.0.2 decoder. The only substantive change is dedenting one assignment; `decoder_fix.patch` records that exact change:

```diff
 if arg_max != cur_max_arg and arg_max != 0:
     emit_frame_idx.append(i)
-    cur_max_arg = arg_max
+cur_max_arg = arg_max
```

This updates the label after every frame. It is CTC decoding, not a text-level phone-duplication heuristic. All other probability, masking, top-k and timestamp behavior is retained. GPL attribution, source URL, modification description and complete license accompany the copy. The original package and its weights were not patched.

| Frame top labels | Original | Corrected | Independent CTC oracle |
|---|---|---|---|
| a, blank, a | a | a a | a a |
| a, a, a | a | a | a |
| a, blank, blank, a | a | a a | a a |
| a, b, a | a b a | a b a | a b a |
| blanks only / empty | empty | empty | empty |

All **3,280** paths over blank/a/b through length seven matched a separate oracle that groups all adjacent labels before removing blanks. Timestamp/top-k tests preserved the two actual emission positions. This establishes decoder correctness for those paths, not Tagalog phone recognition accuracy. Acoustic fragmentation can still produce excess repeated emissions; the fix does not prove every resulting repetition corresponds to a distinct spoken segment.

## 3. Audio safety and preservation of predictions

`audio.py` is a diagnostic validator, independent of production audio code. It bounds bytes/frames, requires complete mono PCM16 8 kHz WAV, accepts 0.5–30 s, and rejects wrong formats, truncated/malformed input and zero/near-silent signals (RMS below 32 PCM16 units). This threshold is a conservative input gate, not a trained speech detector; noise or music could pass. Unsupported audio is rejected rather than silently converted by this harness.

Synthetic regression coverage includes 0/.1/.499/30.1-second invalid durations, .5/.6/1/30-second valid boundaries, zero and near-silence, wrong rate/channel/sample width, malformed headers and truncated payloads. A real 0.6-second excerpt from an existing public recording also executed. Silence/invalid-input tests are synthetic validation tests; they are not actual learner speech or proof of VAD quality.

`benchmark.py` computes one acoustic logit matrix per recording and supplies independent copies to both decoders, avoiding in-place masking contamination. It saves the original unmodified logits and frame-label paths as non-pickle NumPy arrays in ignored evidence storage. Results separately retain:

- `raw_upstream_phones`: the unchanged decoder output, matching Stage 1 on both full clips.
- `corrected_ctc_phones`: the corrected decoder output on those identical logits.
- `postprocessed_phones`: NULL. No dictionary/G2P substitution, stress insertion, spelling-based phone replacement or additional postprocessing occurs.
- Audio, model, decoder and logit hashes, duration, timings and decoder-policy identity.

Fresh output folders are required so previous evidence is not overwritten. All artifacts remain ignored and separate from application history. Neither sequence is a human reference or a pronunciation rating.

## 4. Genuine recorded-audio results

Reused Google FLEURS `fil_ph` test IDs 1869 and 1930, revision `fdd74f7cdf01fc7641ab3072b6a38d364b3667f6`, CC BY 4.0; source and original hashes are in the Stage 1 report and sample manifest. No additional audio corpus was downloaded. Both full raw sequences exactly matched the saved Stage 1 predictions. Two Stage 2 processes produced identical raw and corrected sequences.

| Recording | Duration | Raw phones | Corrected phones | All corrected emissions agree with CTC frame oracle |
|---|---:|---:|---:|---|
| 1869 | 24.42 s | 171 | 178 | Yes |
| 1930 | 12.30 s | 88 | 92 | Yes |
| 1930 excerpt, original 2.0–2.6 s | 0.60 s | 4 | 4 | Yes |

Seven/four additional blank-separated emissions are **decoder differences, not measured insertion errors against gold**. Corrected clip 1930, retained verbatim:

```text
ʔ a n i ŋ l a b i h a k a b i l a ŋ ʔ a m a ŋ ʔ a b a t a a t̪ m a t̪ ɪ p a n d a a ŋ m a a k a ŋ t̪ i n ɪ x a ɡ w a l a n k a i e n t i n a u m o o b i l i p i n o ŋ f w o t o k ɾ a p o
```

Its transcript starts “anim na bihag …”; the suspicious `ŋ l` at the end of its approximate opening remains. The approximate “matatanda” region still includes `p`. The short excerpt outputs `p i x a` with both decoders. These are candidate recognition discrepancies, not adjudicated learner errors. The test recordings have no independently verified learner pronunciation-error labels. The fix cannot resolve acoustic/model confusions, word-boundary ambiguity, accepted variants or missing reference stress.

The full raw/corrected sequences, unmodified logits and frame paths are in `final-before-mms/predictions.json` and `final-after-mms/predictions.json` under ignored `services/api/private-data/allosaurus-stage2/`. Stage 1's original evidence remains intact.

## 5. Phone references and independent evaluation search

| Resource | Verified evidence and suitability | Remaining restriction |
|---|---|---|
| [KWF dictionary](https://kwfdiksiyonaryo.ph/) and [Tagalog Reference Grammar](https://www.ucpress.edu/books/tagalog-reference-grammar/epub-pdf) | Authoritative meaning/tuldik and scholarly phonology references for a manually reviewed curriculum lexicon | Not matching acoustic phone annotations; no bulk dictionary redistribution license verified. |
| [Epitran Tagalog mapping](https://github.com/dmort27/epitran/blob/master/epitran/data/map/tgl-Latn.csv) and [WikiPron](https://github.com/CUNY-CL/wikipron) | Candidate G2P/lexical phones; previous audit verified WikiPron's exported Tagalog files omit primary stress | Generated/lexical pronunciations are not independent observed-speech gold. MIT code versus Wiktionary data licensing remain distinct. |
| [Aquino et al., g2p-asr](https://github.com/AngelAquino/g2p-asr), repository revision `895c4b9beb9c9763ea9a23b529666d57a5cd8e3b` | README explicitly distinguishes `testref` gold phonetic transcriptions from G2P `test` and system `adapt` outputs; Tagalog reference CSV/LOG files are present | Recursive tree found no license and no audio files. Annotation method/rights and matching audio must be obtained from authors. Public GitHub access/citation instruction is not reuse permission. No files were incorporated as evaluation gold. |
| [UP-DSP Philippine Languages Database](https://mozilladatacollective.com/datasets/cmmxhw46c00tqnw07xyr94zjk) | Steward UP EEEI DSP; official card identifies WAV/LOG, 45.63 GB and CC BY-NC 4.0 | Card additionally states research-only/no redistribution without written consent; clarify applicable terms. Card does not establish independently rated learner pronunciation. Not downloaded. |
| [VoxAngeles](https://github.com/pacscilab/voxangeles) and [publisher paper](https://aclanthology.org/2024.lrec-main.1114/) | Audited phonetic labels/alignments for 95 languages; paper specifies CC BY-NC 4.0 | At repository revision `e30c638a8a2c22e576f871f0e2044780d56eab82`, the original 314-language metadata includes Tagalog but no Tagalog audited audio archive/label path was found. Original-language metadata is not proof of an available audited Tagalog subset. No audio downloaded. |
| [FLEURS](https://huggingface.co/datasets/google/fleurs) | Legally reusable existing audio and transcripts; good operational inference check | Human text transcription is not human phonetic annotation or pronunciation-error rating. |

**Independent real-audio PER remains BLOCKED.** No matching, independently annotated and legally usable Tagalog phone-reference set was verified during this audit. This is a finding about verified availability, not proof that no such set exists. The Aquino project is a more specific lead than ordinary ASR corpora, but cannot yet be treated as integration-ready data. No recognizer output or G2P sequence was promoted to gold.

For an approved future annotation effort, qualified native Tagalog annotators should listen independently of model output, record broad observed phones with an explicit inventory, separately mark stress/glottal evidence, document accepted variants and adjudicate disagreements. Reference pronunciation versus observed realization must be separate fields. Speaker-disjoint testing, consent, reuse rights and annotation reliability are required. Phone differences alone cannot identify whether the model, reference or learner is responsible.

## 6. Reproducible PER framework

`metrics.py` implements version `nfc-token-unit-edit-v1`, unit-cost phone-token Levenshtein distance with deterministic tie priority: match/substitution, deletion, insertion. It preserves IPA segments such as `t͡ʃ`, `ŋ` and `aː` as tokens, normalizes NFC only, and reports S/D/I counts, reference phone count, per-utterance PER and corpus micro PER:

```text
PER = (substitutions + deletions + insertions) / reference_phone_count
micro PER = sum(errors) / sum(reference_phone_count)
```

Do not average utterance PERs to obtain micro PER. PER can exceed 1 with insertions; it is not converted into a pronunciation percentage. Empty hypotheses count deletions; empty references are rejected. Tied alignments can have different S/D/I compositions, so retain the policy version when comparing systems. No feature-weighted or dialect-equivalence mapping is hidden in this baseline.

Evaluation JSONL schema, one record per matching recording:

```json
{
  "id": "unique-recording-id",
  "reference_phones": ["explicit", "IPA", "tokens"],
  "hypothesis_phones": ["explicit", "IPA", "tokens"],
  "annotation": {
    "kind": "human_audio_transcription",
    "model_blind": true,
    "source_url": "reference-source-and-version",
    "license": "verified-terms",
    "annotator_protocol": "protocol-and-review-record",
    "audio_sha256": "matching-audio-hash",
    "speaker_id": "coded-speaker"
  }
}
```

The strings above are schema placeholders, not IPA or a dataset. Metadata fields are required caller attestations, not automatic proof of independence or permission; an external reviewer must verify them against audio, reference sources and annotation records. Do not label a human pronunciation dictionary entry as observed-audio transcription. Matched audio identity and inventory compatibility must be reviewed before running a real benchmark.

Reproduction once a permitted reviewed reference file exists:

```powershell
services/api/private-data/allosaurus-pilot/.venv/Scripts/python.exe services/api/ml/allosaurus_stage2/metrics.py approved-independent-references.jsonl --output services/api/private-data/allosaurus-stage2/phone-evaluation.json
```

Synthetic checks verified exact/substitution/deletion/insertion cases, tie behavior, NFC multi-code-point tokens, micro aggregation and rejection of missing/G2P references. A synthetic aggregation example with one deletion across four reference phones produced micro PER 0.25. This is arithmetic testing only. An empty independent-reference CLI run deliberately failed with `ValueError: No independent annotated evaluation rows`, creating no score file. **No real Tagalog PER, S/D/I accuracy estimate, human rating correlation or feedback precision is claimed.**

## 7. Stress and inventory

No stress predictor was added. The locally verified global model units have no primary/secondary stress labels. Length-marked vowel output does not establish stress. The Tagalog inventory still lists `d̠` and `t̠` absent from the model's global units; approximation remains disabled. /ʔ/ availability does not validate glottal-error feedback. Scoring stress, unsupported phones or accepted-variant differences remains unavailable pending references and independent evidence.

## 8. Checkpoint rights

Authoritative sources checked: [Allosaurus source/license](https://github.com/xinjli/allosaurus), [PyPI release](https://pypi.org/project/allosaurus/1.0.2/) and [official model release](https://github.com/xinjli/allosaurus/releases/tag/v1.0), plus the Stage 1 archive manifest. The repository still identifies GPL-3.0 software. No separate checkpoint license/notice exists in the inspected local archive, and the official release metadata contains no separate grant. The retrieved all-state upstream issue listing did not provide a checkpoint-specific clarification.

**Checkpoint redistribution clearance: BLOCKED.** No author contact/message was sent. Ask the rights holder for an explicit weight license and required attribution before packaging/deployment; no response is invented. No new checkpoint download or redistribution occurred. The benchmark verifies the existing local checkpoint and all prepared files before loading and disables implicit downloads. Weight-only safe loading is forced. GPL notices for the isolated derived code do not clear model/data rights or relicense the whole app.

## 9. Runtime and MMS sequential recheck

Initial available RAM was 6.252 GiB; benchmark start values later varied. Stage 1's machine is unchanged (approximately 15.864 GiB usable physical RAM, CPU-only pinned PyTorch). The two measured Stage 2 processes used the same existing checkpoint and recordings. This is a convenience microbenchmark with warm filesystem caches, not population/deployment capacity testing.

| Measurement | Before MMS preflight | After blocked MMS preflight |
|---|---:|---:|
| Checkpoint load | 90.826 ms | 92.675 ms |
| Startup through load, including imports/integrity verification | 14,403 ms | 7,277 ms |
| 1869 acoustic inference | 514.371 ms | 608.017 ms |
| 1869 corrected decode | 10.674 ms | 14.139 ms |
| 1930 acoustic inference | 274.147 ms | 282.256 ms |
| 1930 corrected decode | 6.088 ms | 6.245 ms |
| 0.6 s excerpt acoustic inference | 30.998 ms | 23.011 ms |
| Excerpt corrected decode | 0.869 ms | 0.816 ms |
| Whole monitored process | 16.280 s | 9.152 s |
| Sampled peak process-tree RSS | 430.84 MiB | 430.37 MiB |
| Available before / minimum / after | 5.9273 / 5.3673 / 5.7437 GiB | 5.7591 / 5.3519 / 5.7948 GiB |
| Sampled CPU work | 9.172 CPU-s | 9.234 CPU-s |
| Average CPU, one core = 100% | 56.34% | 100.90% |

Sampling interval was approximately 100 ms; shorter peaks may be missed. Two Torch intra-op threads and one inter-op thread were used. All clips passed the frozen sub-real-time/under-1-GiB diagnostic gate. Startup includes conservative file verification and import overhead; it must not be described as 90 ms end-to-end startup. Corrected decoding was about 0.8–14.1 ms and did not retrain or rerun the network.

The serial order was Allosaurus → MMS preflight → Allosaurus. At the MMS check only **6,171,041,792 bytes (about 5.75 GiB)** were available versus 8,589,934,592 required. It safely refused before starting a model worker; no MMS inference or Stage 2 full model-switch success is claimed. Stage 1's earlier complete switch remains historical evidence, not a new result. No memory threshold was lowered, no apps were closed to force a pass and no large models overlapped. Current full MMS switching is **BLOCKED by free RAM**; the standalone corrected Allosaurus reload passed.

## 10. Regression results and the stalled test

| Check | Actual result |
|---|---|
| New isolated unittest suite | 12 passed in final 0.325 s; includes exhaustive 3,280-path check |
| Pilot `pip check` | Passed; no new packages installed in Stage 2 |
| Existing speech backend regressions | 115 passed in 6.18 s |
| Existing mobile speech/pronunciation Node tests | 34 passed, zero skipped/failed |
| Ruff on new authored audio/metrics/benchmark/monitor/tests | Passed; upstream-derived decoder retained separately |
| Protected file/config/upstream decoder hashes | Unchanged |
| Human-phone recognition acceptance gate | BLOCKED, no eligible independent reference set |

The first complete backend run stalled. A diagnostic traceback showed `socket.accept → socket._fallback_socketpair → asyncio._make_self_pipe` while creating the Windows event loop, before any HTTP upload request. The other 114 tests passed with that test temporarily deselected. With local socket access, the isolated upload-limit test passed in 1.17 s; then the unchanged full 115-test suite passed. The stalled owned processes were stopped, the running API was preserved and the endpoint/test source was not changed. This was an environment restriction, not a passing test until the successful reruns. A Node module-type warning was nonfatal; no unrelated manifest edit was made to silence it.

Commands from repository root unless a working directory is noted:

```powershell
services/api/private-data/allosaurus-pilot/.venv/Scripts/python.exe -X utf8 -m unittest discover -s services/api/ml/allosaurus_stage2/tests -v
services/api/private-data/allosaurus-pilot/.venv/Scripts/python.exe -X utf8 services/api/ml/allosaurus_stage2/monitor.py allosaurus --pilot services/api/private-data/allosaurus-pilot --output services/api/private-data/allosaurus-stage2/final-before-mms
services/api/private-data/allosaurus-pilot/.venv/Scripts/python.exe -X utf8 services/api/ml/allosaurus_stage2/monitor.py mms --pilot services/api/private-data/allosaurus-pilot --output services/api/private-data/allosaurus-stage2/sequential-mms
services/api/private-data/allosaurus-pilot/.venv/Scripts/python.exe -X utf8 services/api/ml/allosaurus_stage2/monitor.py allosaurus --pilot services/api/private-data/allosaurus-pilot --output services/api/private-data/allosaurus-stage2/final-after-mms
node --test scripts/wavlm.test.cjs scripts/pronunciation.test.mjs scripts/live-pronunciation.test.cjs
```

The three evidence-folder names above already exist and are intentionally protected from overwrite; use fresh names for future runs. The MMS command exits 2 on a blocked preflight. Backend command, working directory `services/api`, with local socket access:

```powershell
private-data/api-runtime/.venv/Scripts/python.exe -m pytest tests/test_mms.py tests/test_wavlm.py tests/test_pronunciation.py tests/test_pronunciation_assessment.py tests/test_speech_recognition.py tests/test_speech_audio_runtime.py tests/test_whole_phrase.py -q --tb=short -o faulthandler_timeout=30
```

Database integration, new microphone/UI end-to-end assessment and academic validation were not run in Stage 2; no database/UI behavior was changed. Tests using synthetic doubles are not model accuracy evidence.

## 11. Component decisions and next steps

| Component | Decision | Evidence / next requirement |
|---|---|---|
| Original decoder | FAIL | Reproduced blank-separated repeat suppression. |
| Isolated corrected decoder | PASS | Exhaustive deterministic paths plus real frame-oracle agreement. |
| Input validation and short execution | PASS within declared scope | Synthetic negative/boundary cases and actual 0.6 s excerpt; no VAD accuracy claim. |
| Raw/corrected provenance | PASS | Same acoustic logits, separately saved outputs/hashes, no postprocessing. |
| PER implementation | PASS arithmetic; real evaluation BLOCKED | Deterministic S/D/I/micro tests; missing eligible matching human labels. |
| Recognition sufficient for learner feedback | BLOCKED / not established | Qualitative errors remain; no human-phone or learner-error validation. |
| Stress analysis | BLOCKED / unsupported | No model stress labels or validated acoustic stress method. |
| Local Allosaurus resources | PASS for tested clips | Under 431 MiB sampled RSS; inference below clip durations. |
| Current full MMS sequential cycle | BLOCKED | 5.75 GiB available at 8 GiB preflight. |
| Checkpoint redistribution/deployment rights | BLOCKED | No explicit separate weight grant verified. |
| Preservation/regression behavior | PASS for checks run | Protected hashes, 115 backend tests and 34 Node tests. |

Next work should obtain permitted matching audio/gold phonetic labels (contact the Aquino/UP owners or conduct an approved independent annotation pilot), resolve weight rights, and evaluate the frozen corrected decoder against human phones before considering feedback. Stress and dialect/reference policies need explicit human review. More free RAM is needed for a new full sequential MMS test. Even a satisfactory PER would not validate a learner pronunciation grade; that requires separate independent pronunciation-error/rating evidence.

Files added: `docs/TAGALOG_ALLOSAURUS_STAGE2.md`; `services/api/ml/allosaurus_stage2/{NOTICE.md,LICENSE,decoder.py,decoder_fix.patch,audio.py,metrics.py,benchmark.py,monitor.py,tests/test_diagnostics.py}`. Decisions were appended to `docs/DECISIONS.md`. Local evidence/scripts under ignored `services/api/private-data/allosaurus-stage2/` are not product features or redistribution artifacts. **Tagalog ratings remain disabled. No Stage 3 implementation was performed.**
