# Wav2Vec2 recognition worker

This private Linux/Python 3.12 worker accepts bounded foreground PCM from the
authenticated API. It is an English candidate adapter, not a validated ASR
deployment. No model files are included or downloaded at startup/inference.

The selectively ported checkpoint is `facebook/wav2vec2-lv-60-espeak-cv-ft`.
It emits phonemes. `ctc_decoder.py` performs acoustic prefix-beam decoding;
`word_decoder.py` estimates words using CMUdict/wordfreq without receiving the
practice prompt. No pronunciation score is generated here. A future trained
word-CTC or Tagalog checkpoint needs its own reviewed decoder/validation contract.

## Artifact directory

Supply a trusted, independently prepared local directory containing:

- `config.json`, `preprocessor_config.json`, `vocab.json` and the tokenizer files
  required by the selected checkpoint;
- model weights in safetensors or a restricted `weights_only=True` compatible
  PyTorch state file (including every shard when applicable);
- `manifest.json` with `model_id`, the exact immutable `model_revision`, and
  `files`, a map from **every other relative file path** to its SHA-256 digest.

Example manifest shape (replace the illustrative digest with the actual hash):

```json
{"model_id":"facebook/wav2vec2-lv-60-espeak-cv-ft","model_revision":"EXACT_CHECKPOINT_COMMIT","files":{"config.json":"ACTUAL_SHA256","preprocessor_config.json":"ACTUAL_SHA256","vocab.json":"ACTUAL_SHA256","model.safetensors":"ACTUAL_SHA256"}}
```

Additional files must also be listed. Paths outside the directory, symlinks,
missing files and checksum mismatches fail closed. The mount must be read-only.
The checksum manifest identifies the supplied artifact; it does not establish
that the model is accurate or approved for learners.

## Private service setup

`requirements.lock` is hash-locked for Linux/Python 3.12, resolved from
`requirements.in`; it is separate from both the API and WavLM environments.
The ML stack has not been installed or exercised by the transport unit checks.
Build the optional image using `speech-workers/wav2vec2/Dockerfile` only on the
chosen model server. Model runtimes/weights belong on that server, never in an APK.

The optional `docker-compose.speech.yml` requires `SPEECH_SERVICE_TOKEN`,
`WAV2VEC2_MODEL_DIR`, and `WAVLM_MODEL_DIR`. It publishes no worker ports and uses
an internal network. Attach the API service to that network (or use an equivalent
private service route). API local development settings are:

```dotenv
SPEECH_RECOGNITION_URL=http://wav2vec2:8001
SPEECH_SERVICE_TOKEN=YOUR_PRIVATE_SERVICE_TOKEN
SPEECH_INTERNAL_QA_USER_IDS=["AUTHENTICATED_USERS_ID_UUID"]
SPEECH_RECOGNITION_ENABLED=false
SPEECH_ASSESSMENT_ENABLED=false
```

Production worker connections require HTTPS. Only a server-configured user UUID
can receive the real candidate output in the visibly labeled internal test mode.
The worker always reports `unvalidated_model_prediction`; setting a learner flag
cannot make this candidate validated. `fil` is unavailable.

Set the Android app's `EXPO_PUBLIC_API_URL` to the API's reachable address.
`localhost` on a phone means that phone; the emulator default `10.0.2.2` is not a
physical-phone server address. Development may use a reachable private HTTP API;
release speech requests require HTTPS. The API then calls the private model workers.

`GET /health/capabilities` and `POST /v1/recognize` require
`Authorization: Bearer <service-token>`. The API supplies raw little-endian mono
PCM16 plus actual rate (8–48 kHz); the worker resamples to 16 kHz for inference.
One inference runs at a time; extra work receives 503 immediately. Audio,
transcripts and outputs are not stored or logged. See `NOTICE.md` for provenance.

Before field use, configure actual artifacts and verify real output, peak RAM,
latency, failure/back-pressure behavior and 30 simultaneous learner sessions.
Recognition quality must be evaluated independently for each language.
