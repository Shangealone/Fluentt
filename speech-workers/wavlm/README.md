# WavLM pronunciation worker

This private Linux/Python 3.12 worker adapts the English WavLM phoneme scorer from
`origin/version-3` commit `988239e5bfa8f41ec6c67104a6a8466802514a1e`.
It requires a finished recording and an exact server-resolved reference phrase.
It is independent of ASR and does not score transcript similarity.

No weights are included, downloaded, or trained by this integration. Predictions
remain `unvalidated_model_prediction`, available only to server-allowlisted
internal QA users with a visible label. Learner flags remain false. Tagalog is
unavailable until a separately trained/validated artifact and adapter are approved.

## Required trusted artifact layout

```text
manifest.json
scorer/wavlm_finetuned.pt
backbone/config.json
backbone/preprocessor_config.json
alignment/config.json
alignment/preprocessor_config.json
alignment/vocab.json
alignment/<pinned model weights and tokenizer resources>
nltk_data/corpora/cmudict.zip
nltk_data/taggers/averaged_perceptron_tagger.zip
nltk_data/taggers/averaged_perceptron_tagger_eng/<pinned tagger files>
```

The manifest format is the same as [the Wav2Vec2 worker](../wav2vec2/README.md):
exact model identity/revision and SHA-256 for every other relative file. Supply
complete offline resources from a trusted export. The adapted pipeline checks
NLTK resources before importing G2P; inference never downloads missing resources.

The candidate scorer identity is `Jianshu001/wavlm-phoneme-scorer`, revision
`19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da`; backbone revision
`c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c`; alignment revision
`2c733782da5604684829819a5eb744c193fe9398`.
The existing head/checkpoint contract must match any future trained export.
See [NOTICE.md](NOTICE.md) for upstream attribution and the unresolved upstream
notice that must be addressed before redistribution.

## Runtime and transport

`requirements.lock` is independently hash-locked for Linux/Python 3.12. The optional
Dockerfile uses CPU inference and a read-only model mount; it has not been built
as part of the code/transport checks. Use the Compose setup described in the
Wav2Vec2 README and set the API's `SPEECH_ASSESSMENT_URL=http://wavlm:8002` in local
development, or a private HTTPS URL in production.

At least 4 GiB free RAM is required before model initialization. This is an
initial guard, not proof of peak-memory safety. One inference runs at a time and
there is no waiting queue. Busy or missing models return 503.

The worker accepts mono PCM16, resamples safely to 16 kHz, and creates one bounded
temporary WAV because the adapted scorer accepts a path. The request directory is
removed on success and exception; container `/tmp` is a bounded memory filesystem.
No recording, transcript, score, or speech event is persisted. No review/SRS,
progress, or research ledger is modified.

The adapter preserves actual finite scores. Out-of-range/non-finite output,
missing phonemes, inconsistent error counts, incomplete reference coverage or
failed alignment produce unavailable. The original candidate's score clipping
and missing-score defaults are not used to repair results.

Real inference, Android capture and up-to-30-user load checks require configured
artifacts and the intended server/device. Passing synthetic boundary checks does
not validate scores against independent human pronunciation ratings.
