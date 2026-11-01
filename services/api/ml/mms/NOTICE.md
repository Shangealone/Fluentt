# MMS attribution and use boundary

Meta / Facebook AI, Vineel Pratap et al., **Scaling Speech Technology to 1,000+ Languages** (2023).
Model: [facebook/mms-1b-all](https://huggingface.co/facebook/mms-1b-all), pinned
`3d33597edbdaaba14a8e858e2c8caa76e3cec0cd`, Tagalog adapter `tgl`.

The upstream model card declares **CC-BY-NC-4.0**. Preserve attribution, the
[license link](https://creativecommons.org/licenses/by-nc/4.0/) and applicable
notices; use must meet its noncommercial restriction. A thesis label alone does
not determine whether a deployment qualifies. The explicit operator setting is
an acknowledgement, not a grant of additional rights. No deployment was performed.

This integration uses the published data artifacts with the installed Transformers
implementation. It downloads no model-repository Python and runs no remote inference.
Only the selected adapter is prepared; checkpoints are ignored local cache files.
No weights or recordings are redistributed in this repository.

MMS is an ASR model. It does not supply calibrated pronunciation accuracy,
phoneme error labels, stress scores, or calibrated utterance confidence here.
FLUENTT adds versioned text comparison, strict result validation, local temporary
audio handling, a bounded offline worker and resource/license gates. These changes
do not make the model a validated pronunciation assessor.

The shared pinned Python stack retains its own third-party licenses, including
Transformers, PyTorch, FFmpeg and the English pipeline's dependencies. See the
existing WavLM NOTICE and local setup report. No blanket distribution clearance
is claimed for that complete stack.
