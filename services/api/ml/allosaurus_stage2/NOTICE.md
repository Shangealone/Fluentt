# Isolated Allosaurus Stage 2 diagnostics

This folder is a research tool, not a production speech endpoint. No module here
is imported by the FLUENTT API or Voice UI. It contains no checkpoint or recording.

`decoder.py` adapts Xinjian Li / Allosaurus 1.0.2's
[`allosaurus/lm/decoder.py`](https://github.com/xinjli/allosaurus/blob/d9f1adaf47d3b3765b41f4177da62a051516d636/allosaurus/lm/decoder.py).
The original installed wheel file SHA-256 is
`5f690d4d699bb2bbe9b04012ea65878299d413ea7574e3a870b94518e4722e82`.
The substantive change is one indentation level: update `cur_max_arg` on every
frame, including blank frames. See `decoder_fix.patch`. The original installed
decoder is preserved and is evaluated separately on identical acoustic logits.

The derived decoder is GPL-3.0; the upstream license is retained in `LICENSE`.
Other files in this isolated tool are supplied under GPL-3.0 as well. This notice
does not relicense the rest of FLUENTT, datasets, or model weights. Weight-specific
redistribution rights remain unresolved. No download command is supplied here.

Use only already-prepared, locally verified artifacts. Outputs distinguish
`raw_upstream_phones` from `corrected_ctc_phones`; `postprocessed_phones` remains
NULL. Neither output is a pronunciation rating or human reference.
