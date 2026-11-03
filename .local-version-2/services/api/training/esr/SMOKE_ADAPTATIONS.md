# CPU smoke harness scope and adaptations

This is a small, independently implemented engineering harness informed by the FIFAKT audit at upstream commit `a03e248141fc32a96dc6fda3bb6ae52be621bb9a`. It is not a faithful reproduction, paper benchmark, production inference provider, or trained format-aware Fluentt model. Original source remains unchanged in the ignored audit directory. No upstream weights are loaded.

The harness uses an explicitly batch-first LSTM over **historical** encounters, item embeddings and format indicators, and a masked attention query for the separate future candidate. Labels are supplied only to the external binary loss. There is no target-response field on the candidate.

Deliberate adaptations:

- Two named formats plus a padding value replace unknown private numeric categories. Synthetic labels demonstrate computation only; they do not demonstrate a learned format effect.
- Small, randomly initialized item embeddings replace unavailable pretrained semantic vectors. They are not evidence of semantic transfer or language coverage.
- Packed sequences and masks preserve each learner's history length. New learners have zero historical context. Recurrence never treats batch members as timesteps.
- Six finite features describe strictly prior counts, prior gaps and item counts. Counts use `log1p`. Candidate gaps include the requested positive future horizon. This is a versioned engineering feature set, not a claim that the upstream preprocessed features were reproduced.
- Current/future encounters at or beyond the presentation cutoff are excluded. Naive timestamps, unsupported formats, unordered retained histories, invalid IDs and non-finite horizons are rejected.
- CPU float32 only, deterministic seed, two CPU threads, bounded batches/sequences/steps. No AMP, GPU, implicit data paths, auto-downloads, full-corpus allocation or grid search.
- Save/reload uses a locally created state dictionary and explicit `weights_only=True`; no externally supplied checkpoints are accepted by the smoke runner.

Within a learner, the test fixture assumes one already-isolated pool/configuration. This standalone harness does not authorize or query real study histories. The API's research permissions, history scoping and activation guard remain separate and unchanged.

Acceptance: finite logits/loss/gradients, a nonzero parameter update, permutation/other-learner independence, exclusion of current/future answers, padding invariance and identical weights-only round-trip predictions. These are engineering checks, not accuracy, calibration or retention-improvement tests.

Runtime selection follows the [official CPU installation route](https://pytorch.org/get-started/previous-versions/). Batch-first and packed-sequence behavior follow [PyTorch 2.8 LSTM documentation](https://docs.pytorch.org/docs/2.8/generated/torch.nn.LSTM.html) and [packed sequences](https://docs.pytorch.org/docs/2.8/generated/torch.nn.utils.rnn.pack_padded_sequence.html).
