# Stage 1 — Allosaurus local feasibility pilot

Date: 2026-10-30. **Decision: PARTIAL.** Actual standalone `uni2005` Tagalog phone recognition succeeded in three processes on two existing legally reusable public recordings. CPU and memory costs were small. A sequential Allosaurus→MMS→Allosaurus test also succeeded after an earlier MMS memory-gate refusal. However, a verified decoder defect, incomplete inventory support, apparent recognition errors, unresolved checkpoint redistribution terms and tight MMS startup headroom prevent an unconditional readiness decision.

**Tagalog pronunciation ratings remain disabled. No Stage 2 or Stage 3 implementation was performed.** No Voice UI, backend production pipeline, scheduler, learning feature, allocation, database data or runtime setting was changed. No commit, push or deployment occurred.

## 1. Inspection and preservation

Read `TAGALOG_PRONUNCIATION_FEASIBILITY.md`, repository instructions, existing architecture/decisions and speech verification documentation. Inspected the WavLM/MMS model loaders, worker management and memory gates, preparation/attribution files, pronunciation modules and the current Voice architecture. Existing unrelated working changes were present and retained.

The API was already running. Process inspection found no WavLM or MMS model workers before testing. The pilot never started English WavLM and never loaded two speech models simultaneously. The existing shared worker lock and 5 GiB English / 8 GiB MMS cold-load gates were not modified.

Working-ML distribution names/versions were snapshotted before installation and compared afterward: unchanged. SHA-256 checks of the working pronunciation modules, WavLM/MMS Python pipeline files, WavLM dependency lock and ignored backend `.env` found no changed bytes. No secrets were printed. Only this report is newly eligible for Git from this task; all pilot software, weights, recordings and diagnostic outputs are ignored.

## 2. PC and dependency verification

Initial direct Windows measurement:

| Item | Observed |
|---|---|
| Usable physical RAM | 15.864 GiB |
| Available RAM | 8.117 GiB, variable during testing |
| Free C: disk | 97.93 GiB |
| Processor | Previously inspected i5-10400, 6 cores / 12 logical processors; pilot observed 12 logical processors |
| ML runtime | Windows x64, Python 3.12.10 |
| Accelerator used | CPU only; `torch.cuda.is_available()` false |

A new virtual environment lives under ignored `services/api/private-data/allosaurus-pilot/.venv`. Pilot dependencies install into that prefix. To avoid downloading/copying another large PyTorch runtime, a `.pth` references the existing pinned ML site-packages for read-only numeric/runtime dependencies. This is an **isolated installation overlay, not a fully hermetic environment**: it depends on the unchanged working PyTorch/NumPy installation. It is never imported by the API. A future reproducible deployment needs an independently locked environment rather than this convenience overlay.

| Package | Tested version | Location / result |
|---|---|---|
| allosaurus | 1.0.2 | Pilot prefix; imports and real inference passed |
| torch / torchaudio | 2.11.0+cpu | Existing numeric runtime reused; torchaudio not used by Allosaurus |
| numpy | 2.2.6 | Existing runtime reused |
| scipy | 1.18.1 | Pilot prefix |
| resampy | 0.4.3 | Pilot prefix; import passed; the 8 kHz tests did not exercise its resampling path |
| panphon | 0.22.2 | Pilot prefix; import and FeatureTable construction for /ŋ/ passed |
| editdistance | 0.8.1 | Pilot prefix |
| numba / llvmlite | 0.68.1 / 0.50.0 | Pilot prefix |
| pandas | 3.1.0 | Pilot prefix |
| unicodecsv / munkres | 0.14.1 / 3.0.0 | Pilot prefix |

`pip check` passed after installation. Numeric packages were not upgraded. `transformers` remains 4.57.6 in the working ML environment.

The first wheel-only resolution failed because `unicodecsv` has no applicable wheel. Its 10,267-byte source archive, SHA-256 `018c08037d48649a0412063ff4eda26eaa81eff1546dbffa51fa5293276ff7fc`, was inspected, including setup and imported Python-3 CSV wrapper, before a local wheel build. All other newly installed dependencies used wheels. Resolver output was pinned into ignored `constraints.txt`; exact metadata/URLs/hashes are in `resolution.json`. The reviewed source build fixed a packaging availability issue; no model code or security setting was relaxed.

## 3. Checkpoint source, integrity and license

Sources: [official Allosaurus repository](https://github.com/xinjli/allosaurus), [PyPI 1.0.2](https://pypi.org/project/allosaurus/1.0.2/), [official v1.0 release](https://github.com/xinjli/allosaurus/releases/tag/v1.0).

| Artifact | Verified local result |
|---|---|
| Allosaurus wheel | 52,088 bytes; SHA-256 `70f2bc3f8258be5538bed2e5066d1fa248005bc4a36599e1606f953fc9abfc0a`; matched PyPI metadata |
| Model URL | `https://github.com/xinjli/allosaurus/releases/download/v1.0/uni2005.tar.gz` |
| Archive size | 41,497,736 bytes, matching official release metadata and HTTP Content-Length |
| Archive SHA-256 | `7dc4f20802012f64ac07deb04ade263f199c839521e58eae83c99d79028fc4de` |
| Expanded data | 2,193 archive members, 45,724,269 bytes of file content |
| `model.pt` | 44,899,250 bytes; SHA-256 `552751ac877abcba22481a9d022c82b22f97b0254b72bd4e312cd744ed291cbe` |

The release API supplied no independent digest. The calculated archive hash identifies the retrieved bytes; it is not a publisher-signed authenticity attestation. All extracted file hashes were recorded locally. Extraction rejected traversal, absolute paths, links and non-file/non-directory members. Model data were copied into the pilot package's ignored `pretrained/uni2005` folder to avoid the upstream alternative-path downloader behavior. Inference explicitly selected `uni2005`, disabled implicit model downloads, and set `TORCH_FORCE_WEIGHTS_ONLY_LOAD=1`. Current safe PyTorch loading succeeded without unrestricted pickle fallback or remote Python.

The [software license](https://github.com/xinjli/allosaurus/blob/master/LICENSE) and wheel license identify GPL-3.0. **No LICENSE, NOTICE or README was present in the checkpoint archive, and the release body contained no separate weight terms.** The upstream software documents using its official pretrained models, but this pilot does not establish independent checkpoint redistribution rights. Local technical evaluation is not deployment or redistribution clearance. Keep weights out of Git/installers; obtain an explicit checkpoint license statement before redistribution or deployment review. GPL source/notices and combined-work obligations also require attention if distributing the software; an isolated process alone is not a blanket licensing exemption.

MMS retains its [CC BY-NC 4.0 restriction](https://huggingface.co/facebook/mms-1b-all). Existing English attribution/redistribution caveats remain unchanged.

## 4. Test recordings and preprocessing

Reused two already-downloaded public [Google FLEURS](https://huggingface.co/datasets/google/fleurs) `fil_ph` test recordings. License: CC BY 4.0; attribution: Google/FLEURS and its contributors. Original dataset revision: `fdd74f7cdf01fc7641ab3072b6a38d364b3667f6`. No new corpus download, student recordings or research participant data were used. Original bytes matched the earlier saved manifest hashes before processing.

| ID | Duration | Original WAV SHA-256 |
|---|---:|---|
| 1869 | 24.42 s | `cc95bc3a3164b2ac6f2fdb6898619993c2acd957558e8bb3e50fc8c92e02a824` |
| 1930 | 12.30 s | `87b24e3717f94b157d76e136af5522ef05d9bb9322e90c7d81a73aeb8030fcd5` |

FFmpeg converted each to mono, little-endian PCM16 at 8 kHz, matching `uni2005/pm_config.json`: 8 kHz, 40 MFCC/filterbank features, high-frequency limit 3,800 Hz. This checkpoint does not use the full 16 kHz bandwidth of MMS. Separate 16 kHz PCM copies were prepared for the sequential MMS preflight; the model itself was not changed. Converted hashes are retained in ignored `samples.json`.

Settings: CPU, two intra-op threads, one inter-op thread, inference mode/evaluation mode, fixed seeds, `lang_id='tgl'`, `approximate=False`, default `emit=1.0`, top-1 decoding. Universal `ipa` and top-3 timestamp diagnostics were also executed, without altering the Tagalog outputs.

## 5. Actual Tagalog output

These are **real model predictions**, not expected IPA, human annotations or pronunciation scores. All three independent process runs produced identical top-1 sequences.

### FLEURS 1869

Reference transcript:

> ang mahahaba nitong mga panga ay may 70 na mga matutulis na ngipin kasama na ang ekstrang hanay sa itaas ng bunganga nito nangangahulugan na walang matatakasan ang sinuman na makasalubong nito

Actual `tgl` phones:

```text
ʔ a n m a x a b ɛ n j i iː j t̪ ʊ m uː b a ŋ m a p a n a j m a j t̪ p k j iː t̪ ʊ o m b uː l e m b a ŋ ɛ ɾ m a t o t̪ o j l j iː s m ɪ n ɪ ŋ n j i j iː p j i j m iː k a s a m a n a s a n x a n a s ɪ j i t̪ ɪ a s l a m b o a ŋ a m j i t̪ o l e ŋ a n l a x o j l u ɡ a n j a o j l a ŋ m a t̪ a t a x a s a m s i iː n u m a n a m a x a s a l u b u n uː j i t̪ o
```

### FLEURS 1930

Reference transcript:

> anim na bihag kabilang ang mga bata at matatanda ang maagang pinakawalan gayon din ang mga pilipinong potograpo

Actual `tgl` phones:

```text
ʔ a n i ŋ l a b i h a k a b i l a ŋ ʔ a m a ŋ ʔ a b a t a t̪ m a t̪ ɪ p a n d a ŋ m a k a ŋ t̪ i n ɪ x a ɡ w a l a n k a i e n t i n a u m o b i l i p i n o ŋ f w o t o k ɾ a p o
```

Qualitative inspection suggests several recognition problems. The opening of “anim na” appears as `ʔ a n i ŋ l a`; “matatanda” contains a suspicious `p` in its approximate position; the first clip repeatedly predicts `x` where the written words suggest an /h/-related target. Conversely, recognizable stretches such as `k a s a m a` occur. These are engineering observations against the transcript, **not adjudicated phonetic error labels**: exact word-phone boundaries, acceptable variants and the actual acoustic realizations require a trained listener. No PER or pronunciation accuracy was calculated.

Top-3 timestamp excerpt from 1930:

```text
1.620 0.045 ʔ (0.884) <blk> (0.103) h (0.009)
1.650 0.045 a (0.957) ʔ (0.013) <blk> (0.011)
1.800 0.045 n (0.693) ɲ (0.151) l (0.111)
1.830 0.045 i (0.678) iː (0.235) e (0.051)
1.890 0.045 ŋ (0.325) iː (0.153) <blk> (0.124)
```

These probabilities are uncalibrated acoustic emissions; 0.045 s is an emission window, not a reliable full-phone duration. Universal decoding also ran successfully but emitted many additional non-Tagalog categories; it was not used to substitute a more favorable answer. Its full output is retained in the ignored diagnostics.

## 6. Inventory and decoder defects

The downloaded inventory explicitly contains ISO `tgl`, Glottocode `taga1270`, dialect `NA`. It lists 46 nonblank units:

```text
a aː b c d d̠ d̪ e eː e̞ f h i iː j k l m n n̪ o oː o̞ p r s t t̠ t̪ u uː v w x ŋ ə ɛ ɟ ɡ ɪ ɲ ɾ ʃ ʊ ʒ ʔ
```

The model has 230 units including blank. **`d̠` and `t̠` are absent from its global acoustic units**, leaving 44 directly representable listed Tagalog phones when approximation is disabled. No primary/secondary stress symbol exists. /ʔ/ is available, but merely emitting it does not demonstrate correct lexical glottal-stop assessment. Some loanword affricates also need a reviewed inventory strategy. Length-marked vowels are not substitutes for stress. No phonetic approximation was enabled to conceal missing units.

The checkpoint's listed training-corpus identifiers include English, German, Italian, Kazakh, Russian, Spanish, Turkish, Vietnamese, Mandarin, Javanese and French sources; no Tagalog corpus is identified there. A Tagalog inventory is therefore not evidence of Tagalog-specific supervised pronunciation validation.

**Verified synthetic regression:** a three-frame logit sequence whose top labels are `a`, blank, `a` decodes to `a`, rather than the two emissions `a a` expected after ordinary CTC blank removal. Source inspection explains this: `cur_max_arg` updates only on a nonblank emission and is not reset by the intervening blank. This can omit repeated phones, including repetitions across word boundaries. The regression ran three times with the same failure. It is separate from genuine recorded-audio inference. No fix was applied to the package or application; a reviewed correction and regression tests are prerequisites before phone-error comparison.

The inventory index also names a `taga1270.json` profile that is absent from the archive; the phone-list text file exists and inference does not require that profile. Do not claim the missing profile supplies provenance or dialect validation.

## 7. Measured runtime and resource use

Monitoring sampled process-tree working-set RSS, available physical RAM and CPU times every approximately 100 ms. Peaks may miss shorter spikes. Two fresh processes used the same prepared data and filesystem cache; these are process-cold starts, not reboot/cold-disk benchmarks. API/background apps stayed running.

| Metric | Run 1 | Run 2 |
|---|---:|---:|
| Initial Torch/NumPy import phase | 3,166 ms | 3,105 ms |
| `read_recognizer` + eval loading | 169 ms | 90 ms |
| Clip 1869 inference | 590 ms | 544 ms |
| Clip 1930 inference, model reused | 304 ms | 268 ms |
| 1869 real-time factor | 0.0242 | 0.0223 |
| 1930 real-time factor | 0.0248 | 0.0218 |
| Whole monitored process wall time | 7.051 s | 6.852 s |
| Sampled peak process-tree RSS | 404,824,064 bytes (386.1 MiB) | 407,138,304 bytes (388.3 MiB) |
| Available RAM before start | 8.0849 GiB | 8.1046 GiB |
| Minimum available RAM | 7.7331 GiB | 7.7452 GiB |
| Available RAM after exit | 8.0978 GiB | 8.1048 GiB |
| Sampled cumulative process-tree CPU | 7.594 CPU-seconds | 7.594 CPU-seconds |
| Average CPU, one logical core = 100% | 107.69% | 110.82% |
| Peak sampled CPU, same convention | 216.91% | 216.80% |

On 12 logical processors, average whole-host-equivalent CPU is approximately 8.97% / 9.24%; peak equivalents about 18.08% / 18.07%. These are the pilot's CPU usage, not total PC utilization. CPU-seconds count work across cores and can exceed elapsed time. Total wall time includes package imports, four actual recognizer calls (two Tagalog, one universal, one timestamp/top-3) and the synthetic decoder probe. The import row covers Torch/NumPy; subsequent Allosaurus/dependency imports are included in whole-process time, not in the model-load row.

Safety controls: at least 4 GiB available before Allosaurus imports, an existing-model-worker check, 3 GiB Allosaurus process-tree RSS ceiling, emergency exit below 1.5 GiB system available RAM, and a 180-second deadline. None fired during the three successful Allosaurus runs. These are local pilot controls, not a new production capacity promise or a change to existing model gates.

## 8. Sequential loading experiment

Actual sequence: **Allosaurus run 1 exits → failed MMS preflight exits → Allosaurus run 2 exits → successful MMS retry exits → Allosaurus run 3 exits**. No overlap and no user speech request was interrupted.

The first MMS process began with 8.1047 GiB free. After Torch import, the existing `Transcriber.load()` correctly raised `ValueError('insufficient_memory')` at its unchanged 8 GiB check. Minimum available RAM was 7.9158 GiB; peak process-tree RSS was 214,888,448 bytes (about 205 MiB), consistent with stopping before MMS weights loaded. It exited after 3.587 seconds; available RAM recovered to 8.0942 GiB. That attempt performed no MMS inference.

After free RAM measurably recovered, one retry started at 8.2059 GiB available and passed the same unchanged MMS gate. The existing offline MMS pipeline loaded its pinned `tgl` adapter and genuinely transcribed clip 1930. This was a direct diagnostic call to the unchanged pipeline, not an API/student submission. The diagnostic returned a transcript and no pronunciation score; confidence remained NULL and explicitly uncalibrated.

| Successful MMS retry metric | Actual result |
|---|---:|
| Torch/NumPy import phase | 3,047 ms |
| Existing `Transcriber.load()` | 29,356 ms, including artifact verification and Transformers imports |
| Clip 1930 transcription | 8,475 ms |
| Whole monitored process | 42.136 s |
| Peak process-tree RSS | 4,382,035,968 bytes (4.0811 GiB) |
| Minimum system available RAM | 4.0745 GiB |
| Available RAM after exit | 8.1053 GiB |
| Process-tree CPU | 35.500 CPU-seconds; average 84.25%, sampled peak 216.87%, one core = 100% |
| Exit / safety stop | 0 / none |

Actual MMS transcript, retained verbatim including recognition errors:

```text
a6im na bihag kabilang ang mga bata at matatanda ang maagang pinakawalan gayundin ang mga pilipinong potograpo
```

Allosaurus run 3 then succeeded with identical phone predictions: model load 115 ms, inference 538 / 271 ms, sampled peak 407,273,472 bytes (0.3793 GiB), minimum system available 7.7831 GiB and 8.1623 GiB available after exit. Its initial Torch/NumPy imports took 4,480 ms; whole process took 10.492 s; CPU totaled 7.422 CPU-seconds (average 70.74%, sampled peak 216.67%, one core = 100%). Background/system timing variability explains why model load and total process time must be reported separately.

**One complete sequential model switch and process-exit memory recovery are demonstrated.** MMS headroom remains tight: more than 8 GiB must remain at its actual load check, after imports. Approximately 8.5–9 GiB before launching gives a practical import buffer, not a guarantee. Recheck actual memory for every cold load and never lower the threshold. Loading MMS and Allosaurus together was neither needed nor attempted. This is evidence for sequential feasibility, not high-concurrency deployment capacity.

## 9. Reproduction and retained evidence

Ignored evidence is under `services/api/private-data/allosaurus-pilot/`: official metadata, reviewed source archive/wheel, `constraints.txt`, `resolution.json`, `installed-environment.json`, safe-extraction manifest, per-file model hashes, sample hashes, standalone harness/supervisor and per-run JSON/stdout/stderr. It contains public test audio and weights; do not commit it.

From the repository root, after preparing the same reviewed pilot overlay and artifacts:

```powershell
services/api/private-data/allosaurus-pilot/.venv/Scripts/python.exe -m pip check
services/api/ml/wavlm/.venv/Scripts/python.exe -X utf8 services/api/private-data/allosaurus-pilot/monitor.py allosaurus run1
services/api/ml/wavlm/.venv/Scripts/python.exe -X utf8 services/api/private-data/allosaurus-pilot/monitor.py mms sequential-mms
services/api/ml/wavlm/.venv/Scripts/python.exe -X utf8 services/api/private-data/allosaurus-pilot/monitor.py allosaurus run2
services/api/ml/wavlm/.venv/Scripts/python.exe -X utf8 services/api/private-data/allosaurus-pilot/monitor.py mms sequential-mms-retry
services/api/ml/wavlm/.venv/Scripts/python.exe -X utf8 services/api/private-data/allosaurus-pilot/monitor.py allosaurus run3
```

The initial supervisor successfully saved run 1 data, then its console display hit Windows CP1252 IPA encoding. The saved UTF-8 result was read successfully, and subsequent invocations used `-X utf8`. This display failure did not invalidate the worker's exit-0 inference. The supervisor's own exit code can be zero even when a worker fails; the recorded `exit_code`, stop reason and stderr must be checked. The first MMS worker's recorded exit code is 1; the later successful retry is 0. A source-profile inspection also encountered the absent JSON noted above; it did not affect inference.

No application regression suite was rerun because application files were unchanged. Actual checks here were dependency consistency/imports, safe checkpoint loading, three real recorded-audio Allosaurus runs and one successful MMS transcription, inventory inspection, a synthetic decoder regression, bounded resource sampling, sequential MMS preflight and preservation/hash checks. This is not held-out pronunciation validation, a microphone/API workflow test, or evidence of a validated academic grade.

## 10. Stage 2 recommendation

**Conditional go for a separately authorized offline comparison investigation; no go for student-facing ratings.** Standalone recognition and memory feasibility pass for these two clips. Before trusting comparisons, resolve/review the repeated-phone decoder behavior, explicitly handle unsupported phones, build human-reviewed context/stress/glottal reference entries, and manually annotate a small independent phone reference set. Recognition errors must be measured against humans rather than assigned to learners.

Checkpoint redistribution/deployment terms still need explicit clarification. The sequential test passed once with sufficient headroom, while the earlier refusal demonstrates the need to retain resource gates. Human-rated learner data and the calibration/validation protocol in the feasibility report remain necessary before any pronunciation rating. Neither English WavLM nor Tagalog MMS needs replacement. Stage 2 and Stage 3 remain unimplemented.
