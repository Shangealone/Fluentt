# Upstream attribution and review

This integration ports the reviewed pipeline from Fluentt version-3 commit
988239e5bfa8f41ec6c67104a6a8466802514a1e. The new worker uses bounded PCM input;
it does not use FFmpeg. Model-score clipping and missing-score defaults were
removed; invalid/incomplete predictions are unavailable at the strict boundary.

The phoneme mapping, scoring-head architecture, forced alignment and scoring assembly in `pipeline.py` adapt `pipeline_v2.py` from Jianshu001 / Jianshu She, https://huggingface.co/Jianshu001/wavlm-phoneme-scorer, revision `19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da`. Reviewed upstream source SHA-256: `510d625c7ae7c3cd836fdbc84ceb3e48f2d4d0d69cb5ca6501aefeb5f8bfcd09`. The model repository metadata declares MIT. No upstream LICENSE/copyright-notice file was present in that revision; the linked source repository license endpoint returned 404. Preserve this attribution and resolve the absent upstream notice before redistributing model/code artifacts. The checkpoint is downloaded into ignored operator cache, never committed here.

Local changes remove unrestricted pickle loading, implicit Hub/NLTK downloads during inference, partial backbone loading, zero-score missing-segment fallback, CLI/batch evaluation and global warning suppression. They add fixed offline artifacts, strict alignment coverage and state loading, PCM WAV input and inference mode. These changes have not been empirically validated against children's or Filipino-accented English speech merely by passing synthetic contract tests.

WavLM backbone: Microsoft's `microsoft/wavlm-large`, pinned revision in prepare.py; upstream model card links the MIT license in Microsoft UniLM. Alignment: Meta `facebook/wav2vec2-xlsr-53-espeak-cv-ft`, metadata Apache-2.0. Both dependencies remain separate from this fine-tuned scorer's license. G2P uses g2p-en (Apache-2.0 per its package/source license), NLTK and its separately downloaded CMU dictionary/tagger resources. FFmpeg redistribution/codec licenses are separate (imageio-ffmpeg's binary includes its own notices). Check each actual installed distribution/resource's license and applicable dataset terms before distribution; no blanket legal clearance is claimed. Do not ship the cache in a phone APK.
