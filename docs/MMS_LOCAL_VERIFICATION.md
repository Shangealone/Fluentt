# Tagalog MMS local activation — 2026-10-30

## Result

The user freed memory. Windows reported 15.864 GiB total and **8.190 GiB available**
at the start, with 104.77 GiB disk space. The unchanged 8 GiB MMS startup gate now
passed. The pinned model, `tgl` adapter and all seven offline artifacts are prepared
and verified. **Real Tagalog inference and the actual backend worker both succeeded.**
Local backend MMS is enabled for this noncommercial demonstration. English remains
enabled. The browser demo still has no live authenticated model connection.
Tagalog produces transcription and reference-word comparison, with NULL confidence
and NULL pronunciation score. No phoneme scorer, academic grade or validated
Tagalog pronunciation percentage was added.

## Pinned files and download verification

- Model: `facebook/mms-1b-all`, revision `3d33597edbdaaba14a8e858e2c8caa76e3cec0cd`.
- Language adapter: `tgl`; CPU float32, existing reviewed Python 3.12 runtime.
- Model safetensors: 3,859,521,128 bytes, SHA-256
  `0f1d95ce43d27e03d5d8dd56c697c805460f967c793dd2cbec2e8e8012deda98`.
- Adapter safetensors: 9,059,872 bytes, SHA-256
  `7d6fd2d28c774d78a88f1e702d67930ac07002a3bfcabe8f1a952a9bc4e35655`.

The initial standard preparation downloaded the config/tokenizer/vocab files but
stalled before transferring weights. A 1 KiB HTTP range probe returned 206 and
real bytes. A local diagnostic then fetched bounded 16 MiB ranges, four at a time,
checking Content-Range and lengths, and matched the complete weights/adapter hashes
against the official pinned Hugging Face metadata. No remote Python was executed.
The complete seven-file manifest was generated and hash-verified again. Everything
is in ignored model storage; no weights/cache or recordings are committed.

The model card's CC-BY-NC-4.0 restriction remains authoritative. The ignored local
noncommercial acknowledgement was enabled for this test/demo, not for a commercial
deployment. Preserve the attribution in `services/api/ml/mms/NOTICE.md`.

## Genuine public-audio ASR diagnostic

Dataset: `google/fleurs`, `fil_ph`, `test`, original revision
`fdd74f7cdf01fc7641ab3072b6a38d364b3667f6`. The preview endpoints failed with a
Parquet scan-size limit; the original pinned TSV and the first 16 MiB of its test
archive provided three eligible complete recordings. Selection was the first
three archive members passing the existing decoded 0.5–30 second bounds. Sample
IDs: 1869, 1930, 1830. Original float WAV audio was normalized through the shared
local FFmpeg decoder. No student/private recording or participant data was used.

| Metric | Observed result |
|---|---:|
| Successful actual clips | 3 / 3 |
| Model initialization | 17,985 ms |
| Per-clip decoding/inference | 17,848 / 7,680 / 13,275 ms |
| Sampled peak process RSS | 5,024,628,736 bytes, about 4.68 GiB |
| Lowest available system RAM | 3,913,293,824 bytes, about 3.64 GiB |
| Word edits / reference words | 7 / 67 |
| WER | 0.1044776, about 10.45% |
| Character edits / reference characters | 13 / 429 |
| CER | 0.0303030, about 3.03% |

WER/CER use the versioned NFC/casefold/punctuation normalization; CER includes
normalized spaces. These are **ASR error metrics**, not learner pronunciation
scores. The sample is tiny and checkpoint training overlap was not independently
verified; it does not establish population accuracy, accent fairness, classroom
efficacy, calibrated confidence or academic validity. A full corpus evaluation
and independent human-rated pronunciation data remain separate work.

Audio hashes, exact test texts and aggregate reports are in ignored local
verification storage. They are not application history or research outcomes.

## Real backend worker and warm reuse

The API environment called the actual MMS worker on the first public clip twice.
Its strict prediction and reference comparison contracts accepted both results.
First initialization: **15,440 ms**; first inference: **17,078 ms**, complete
transport **42,108 ms** including startup/hash/decoding overhead. Second request:
**0 ms initialization**, **16,313 ms inference**, **16,375 ms total**. It reused
the loaded model, recognized 32 words and returned NULL confidence and pronunciation
score. Temporary recordings were owned by the existing bounded transport and
the worker was closed afterward. This is actual local model execution, not a
synthetic fixture or an authenticated end-user microphone test.

## Memory-aware language switching

Both model flags can be enabled while only one language model is resident per
API process. An authenticated supported-language capability check releases the
idle alternate model before measuring RAM. Actual assessments share a nonblocking
model lock: a competing request returns retryable 429, and a selection during
inference reports busy without killing it. Repeated requests in the same language
reuse its worker. Changing language may require a cold start. The 5 GiB English
and 8 GiB MMS startup minimums remain unchanged; selection never assumes that RAM
was released or overrides the measured gate. Multi-process hosting still needs
separate memory budgets for each process.

## Configuration, commands and checks

Only the ignored backend `.env` gained MMS runtime/cache/device/timeout,
noncommercial acknowledgement and enabled values. English settings, database
credentials and other configuration were preserved. The API was restarted on
loopback port 8000; model files remain off the phone. Use an authenticated account
with a reachable backend; browser demo mode cannot upload for genuine assessment.

From the repository root:

```powershell
services/api/ml/wavlm/.venv/Scripts/python services/api/ml/mms/prepare.py --cache models-cache/mms-tgl --acknowledge-noncommercial-license
services/api/ml/wavlm/.venv/Scripts/python private-data/bilingual-validation/prepare_mms_local.py model
services/api/ml/wavlm/.venv/Scripts/python private-data/bilingual-validation/prepare_mms_local.py dataset
services/api/ml/wavlm/.venv/Scripts/python services/api/ml/evaluate_voice.py --language tagalog --cache models-cache/mms-tgl --dataset private-data/bilingual-validation/tagalog.json --output private-data/bilingual-validation/tagalog-result.json
```

The second/third commands are local ignored download diagnostics, not bundled
runtime dependencies. The worker check used `mms_runtime.Runtime.assess` followed
by `mms_contract.Prediction` and `compare` on the same public clip, twice. No real
student account, audio or credentials were fabricated for verification.

Final backend speech regressions: **115 passed**. Disposable PostgreSQL speech
checks: **10 passed**, no skips. Added coverage confirms switching releases idle
weights, refuses to interrupt inference, and rejects concurrent assessment rather
than loading two heavy models. No client UI or dependencies changed in this
follow-up. Earlier typecheck/lint/client results remain in BILINGUAL_VOICE_VALIDATION.md.

Files changed in this follow-up: `wavlm_runtime.py`, `wavlm_service.py`,
`mms_service.py`, `tests/test_mms.py`, this report, `BILINGUAL_VOICE.md`,
`BILINGUAL_VOICE_VALIDATION.md`, `WAVLM_AUDIT.md`, `DECISIONS.md`, and `README.md`.
Ignored local changes are pinned model artifacts/manifest, public corpus samples,
download/evaluation diagnostics and MMS settings. No migration, scheduler,
FSRS/FIFAKT, research treatment, commit, push or production deployment.
