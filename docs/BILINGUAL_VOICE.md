# Bilingual Voice implementation — 2026-10-30

**Current status:** after the user freed 8.19 GiB RAM, MMS was prepared, verified,
tested on real public Tagalog audio and enabled locally. English remains enabled.
Tagalog pronunciation scoring is still unavailable. See [MMS_LOCAL_VERIFICATION.md](MMS_LOCAL_VERIFICATION.md)
for the latest actual ASR metrics, worker checks and activation details.

## Behavior and boundaries

The existing `/pronunciation` screen now offers English/Tagalog filters for both
personal and school students. Selection is local to Voice; it does not rewrite
profile language, Personal/Class Learning schedules, FSRS-6, FIFAKT, assignments,
study allocation or research treatment. The same components and routing serve
both proposed research groups; no group-dependent speech behavior was added.
Existing research-classroom collection remains blocked for both languages.
This is not evidence that research execution or FIFAKT is operational.

| Activity language | Explicit local model option | Result |
|---|---|---|
| English | WavLM | Actual overall/word/phoneme model predictions, with existing uncertainty labels |
| Tagalog | MMS `tgl` | Recognized speech, original reference, normalized word differences; pronunciation score NULL |

Recording, playback, consent, deliberate stop/automatic one-shot submission,
explicit original-request retry, session generation checks and temporary audio
cleanup reuse the existing components. Demo adapters have no live model client
and never advertise real inference. The ordinary school Voice fallback now uses
existing local recording/playback rather than issuing legacy simulated scores;
retained history remains readable without presenting its scores as model evidence.
Legacy records/endpoints are not deleted or rewritten. Personal recognition
highlights remain recognition aids, not pronunciation scores.

## Models and processing

English pins are unchanged:

- `Jianshu001/wavlm-phoneme-scorer`: `19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da`.
- `microsoft/wavlm-large` config: `c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c`.
- `facebook/wav2vec2-xlsr-53-espeak-cv-ft` alignment: `2c733782da5604684829819a5eb744c193fe9398`.
- Existing English G2P/reference validation, upstream phone means, 0.70 model error
  threshold and strict complete-reference result validation remain unchanged.
  The model card declares MIT; the unresolved upstream notice and dependency
  review described in `services/api/ml/wavlm/NOTICE.md` still applies.

Tagalog model: [facebook/mms-1b-all](https://huggingface.co/facebook/mms-1b-all),
revision `3d33597edbdaaba14a8e858e2c8caa76e3cec0cd`, adapter `tgl`.
MMS is ASR; its card declares CC-BY-NC-4.0. See `ml/mms/NOTICE.md` before deployment.
Native Transformers CTC loading is used without remote Python. First load the
unchanged base head, then load the verified local `tgl` adapter/head together;
the tokenizer also selects `tgl`. No blanket mismatch-ignore or random-head
fallback is used. [Transformers MMS documentation](https://huggingface.co/docs/transformers/v4.57.1/model_doc/mms)
describes language adapters; installed 4.57.6 source was also inspected.

Both paths accept bounded final uploads (10 MiB plus bounded multipart overhead),
reuse local FFmpeg to produce mono PCM16 at 16 kHz and require decoded duration
0.5–30 seconds. Decoded sample deviation below 0.0005 is rejected as silence.
This energy check is not a validated voice activity detector: music/noise may
pass it, and ASR may hallucinate. No recognized text yields an explicit error;
invalid/short/long/silent clips, missing resources, deadline and inference errors
produce no fabricated replacement. MIME/client duration and client reference
text are not trusted for inference. Only published versioned server references
are used. MMS receives the waveform, never the expected phrase as a decoding hint.

Tagalog normalization `tagalog-nfc-casefold-punctuation-v1` uses NFC/casefold,
whitespace collapse and punctuation separators while preserving diacritics, ñ,
internal apostrophes/hyphens and distinctions such as ng/nang. Curly apostrophes
are canonicalized. Original strings remain available for display. References
must be Latin script with 1–60 words and at most 500 characters. No translation,
stemming, number expansion, stress inference or synonym credit is added.
Word differences are deterministic text edits, not acoustic error labels.
MMS confidence is NULL/unavailable_uncalibrated; the UI requests manual review
instead of inventing low/high certainty or a pronunciation percentage.

## Backend, history and privacy

Existing authenticated `/api/v1/me/pronunciation` routes accept explicit
`assessment_engine=mms` alongside unchanged `wavlm`/legacy contracts.
Capabilities select the requested engine and validate the language. Wrong-language
uploads fail closed. Both use current student/session/owner/class/membership
authorization and shared content locks, release DB locks during computation,
then revalidate before saving. No experimental-group branch is consulted.
Replay identity covers original bytes, activity/version, context and consent;
conflicting reuse is rejected. Explicit recording consent is engine-versioned.

Reuse `PronunciationAttempt` JSONB and `ModelVersion`/`ModelConfiguration`; no new
table/migration. Current head is `0018_personal_history`. MMS rows use
`scoring_status=unscored`, NULL score/evaluator, a separate ASR configuration and
the `mms-tgl-transcription-comparison-v1` result envelope. English provenance and
history remain unchanged. MMS/English histories are independently paged and
owner/context scoped. Legacy mutation endpoints cannot overwrite either model's
retained result. Raw audio is not saved in these rows; temporary server files
are removed on success, error and deadline. Native cache cleanup remains best
effort; native microphone behavior has not been device-verified in this task.
No transcripts/audio/credentials are put in error logs or safe aggregate reports.

The subprocess transport is lazy and reuses a loaded model for later requests.
A shared nonblocking lock permits one active assessment per API process and releases
idle alternate-language weights on language selection. It does not interrupt active
inference or bypass either memory gate; there is no unbounded request queue.
Workers inherit a minimal environment, run offline and have a
hard deadline. Changing runtime configuration closes/replaces the worker.
No paid speech service, hosted inference, automatic cloud fallback or new training.

## Preparation and activation

Run from the repository root. Existing Python 3.12 CPU ML environment is compatible
with the pinned stack (`pip check` passed). `ml/mms/requirements.lock.txt` reuses
that reviewed lock: torch/torchaudio 2.11.0+cpu, transformers 4.57.6, numpy 2.2.6.
For another PC, follow `WAVLM_LOCAL_SETUP.md`, including the reviewed Distance
wheel build; do not blindly install remote Python/source replacements.

```powershell
services/api/ml/wavlm/.venv/Scripts/python services/api/ml/mms/prepare.py --cache models-cache/mms-tgl --acknowledge-noncommercial-license
```

Preparation downloads only config/processor/tokenizer/vocab plus model.safetensors
and adapter.tgl.safetensors at the pinned revision, records SHA-256 and verifies
the complete seven-file manifest. Runtime verifies all hashes again before load.
It never fetches missing files during a user request. The model/cache and Hub
download copies need several GiB of disk; measured free disk was 102.98 GiB.
Initially available RAM did not meet the startup budget. After the user freed
8.19 GiB, all seven pinned artifacts were downloaded/hash-verified and both real
corpus inference and backend worker reuse succeeded. See MMS_LOCAL_VERIFICATION.md.

In ignored backend `.env`, set the documented MMS Python/cache/device/timeout,
review noncommercial eligibility and set `FLUENTT_PRONUNCIATION_MMS_NONCOMMERCIAL_ACKNOWLEDGED=true`.
Enable `FLUENTT_PRONUNCIATION_MMS_ENABLED=true` only after a real audio evaluation
on a capable backend. Both MMS settings default false. No commercial rights or
production readiness follow from toggling them. English uses its existing separate
`FLUENTT_PRONUNCIATION_WAVLM_*` settings. Its startup gate was increased from 4
to **5 GiB** after the actual live-app resource check below; standalone evaluation
and benchmark commands use the same raised minimum. English was enabled locally
only after the successful final live-resource recheck below. MMS is now also enabled
after its separate successful real-audio checks in MMS_LOCAL_VERIFICATION.md.

MMS requires at least **8 GiB available RAM before loading**, a conservative
engineering budget for its billion-parameter float32 checkpoint and inference
activations, not an empirically measured MMS peak. This PC has 15.864 GiB total,
i5-10400 (6 cores/12 threads) and RX 6600. The installed stack is CPU-only; CUDA
is unavailable. Initial available RAM was 5.49 GiB; explicit MMS preflight later
measured 5,667,532,800 bytes against 8,589,934,592 required and refused before load.
No threshold was lowered. Free sufficient RAM or use a private backend with that
headroom; budget separately for both resident models and app/DB processes. GPU
device support exists but GPU operation, VRAM requirement and latency are untested.
For multi-process deployment each API process duplicates models; use a dedicated
private speech worker/service architecture before scaling beyond this local demo.

## Validation actually performed

Real recorded audio: three public SpeechOcean762 `test` clips, predeclared first
three rows, dataset revision `06385584fad212b26134c656fdd3ccf9f093f33e`.
[Dataset card](https://huggingface.co/datasets/mispeech/speechocean762) declares
Apache-2.0 and human sentence/word/phone annotations. No private/student recording
or participant record was used. Audio/annotations and reports are ignored local
validation files. The scorer's training overlap is UNKNOWN: a `test` split does
not establish independence from this checkpoint's training. Treat this as a
small annotated diagnostic, not held-out validation or Filipino-accent evidence.

All 3 yielded actual overall, 13 word and 43 phoneme predictions. Startup 37,585 ms;
per-clip decode/inference 7,799 / 2,393 / 1,954 ms. Sampled peak RSS 4,354,060,288
bytes (4.055 GiB), minimum host available 1,120,813,056 bytes (1.044 GiB), 100 ms
sampling. These describe one process/run, not certified maximum memory or latency.
Diagnostic absolute errors on a 0–100 scale: overall n=3 MAE 9.3667, word n=13
MAE 9.9231, exactly aligned phone labels n=33 MAE 9.8636. Word annotations were
scaled from 0–10 and phone labels from 0–2; all other phone alignments are excluded,
not repaired. Denominator/coverage and the small sample limit matter. Overall
human accuracy and the model's phone mean are not identical constructs. No AUC,
calibration, sensitivity, fairness, academic grading or research efficacy claimed.

Tagalog: the initial preflight refused loading. After memory was freed, three real
public `fil_ph` test recordings from Google FLEURS all succeeded. WER was 7/67
(10.45%) and CER 13/429 (3.03%); these are small-sample ASR diagnostics, not
pronunciation scores or established general accuracy. Separately, WER/CER unit
tests use synthetic strings. `ml/evaluate_voice.py` computes total-edit/count WER and CER
(including normalized spaces in CER), allows WER >1, reports failures/coverage
and does not convert them into pronunciation scores. Extend evaluation beyond the
three clips on the `fil_ph` test split of [Google FLEURS](https://huggingface.co/datasets/google/fleurs),
with CC-BY-4.0 attribution, pinned revision/audio hashes, explicit split and
checkpoint-overlap review. FLEURS transcriptions are not human pronunciation labels.

```powershell
services/api/ml/wavlm/.venv/Scripts/python services/api/ml/evaluate_voice.py --language english --cache models-cache/wavlm --dataset private-data/bilingual-validation/english.json --output private-data/bilingual-validation/english-result.json
services/api/ml/wavlm/.venv/Scripts/python services/api/ml/evaluate_voice.py --language tagalog --cache models-cache/mms-tgl --dataset private-data/bilingual-validation/tagalog.json --output private-data/bilingual-validation/tagalog-result.json
```

An evaluation manifest contains `dataset`, `revision`, `split`, `training_overlap`,
and `items` with `id`, relative `audio`, exact `text`; English optional annotation
fields are described in the script. Its first Tagalog run exercised only the early
RAM gate; the later actual three-clip run is documented in MMS_LOCAL_VERIFICATION.md.

## Tagalog phoneme investigation

No Tagalog phoneme scorer is implemented. MMS emits grapheme/token CTC posteriors;
aligning those tokens does not turn them into phoneme error probabilities. The
English CMU/G2P phone inventory/scoring head is not a Tagalog pronunciation model.
A defensible future phoneme/GOP approach needs a licensed and reviewed Tagalog
pronunciation lexicon/G2P including lexical stress and glottal-stop variants, a
compatible phone-level acoustic model, reliable forced alignment, and held-out
human-rated learner speech with accepted variation/dialect policy. None of those
complete, validated prerequisites was supplied or verified here. eSpeak NG's
[language inventory](https://github.com/espeak-ng/espeak-ng/blob/master/docs/languages.md)
was investigated but did not establish a usable Tagalog G2P for this deployment.
No rule-based phoneme guesses, TTS similarity or grapheme confidence is exposed as
pronunciation quality. Keep pronunciation_scoring=unavailable until a separately
approved implementation and human-label evaluation justify a versioned contract.

## Tests, remaining work and files

See `BILINGUAL_VOICE_VALIDATION.md` for final checks and file list. Remaining work:
real MMS preparation/inference and corpus WER/CER on adequate hardware; larger
independent annotated English evaluation with documented overlap; real authenticated
microphone/retry/history/device-cleanup testing; deployment/license review. Web
demo mode does not provide an authenticated scoring bypass. No commit, push,
deployment, model training or production-data modification was performed.
## Live-app memory finding and current activation state

After the standalone public-audio check, the real API worker was tested on the
same public clip. Its first failure exposed a Windows-specific dependency bug:
the stripped child environment lacked USERNAME/USER, so PyTorch's getpass lookup
tried importing the Unix-only `pwd` module. Preserve those OS fields, while still
excluding API/database credentials. The corrected actual worker returned 91.9,
6 words and 21 phonemes, initialization 13,645 ms, inference 3,390 ms, total
transport 23,498 ms. This is genuine model output, not an HTTP/student-device test.

A further real-worker run with the API and Metro active reached a sampled worker
tree RSS of 4,013,219,840 bytes and system available memory 721,027,072 bytes
(about 688 MiB). A dedicated 768 MiB emergency monitor killed only the test worker
tree after 21,187 ms. That run did **not** finish and produced no score. The old
4 GiB gate was therefore not sufficient for this demonstration workload. It is
now raised to 5 GiB in API preflight, the benchmark and corpus evaluation command.
This is additional headroom, not a measured universal peak guarantee.

An interim local English enable was reverted immediately after this safety result.
After temporary test processes exited, a final check started with 5,937,471,488
bytes free (5.530 GiB) and the API/Metro running. It passed: actual overall/6-word/
21-phone output, worker initialization 12,863 ms, processing 2,280 ms, monitored
elapsed 22,047 ms, sampled worker-tree peak 4,396,552,192 bytes (4.095 GiB) and
minimum system available 1,641,172,992 bytes (1.529 GiB). No emergency stop.
English was then enabled locally and the loopback API restarted. The worker stays
lazy and will refuse a future cold load below 5 GiB. MMS was initially disabled;
its later actual >=8 GiB evaluation succeeded and it is now enabled locally.
No minimum was lowered. See MMS_LOCAL_VERIFICATION.md for the current state.

