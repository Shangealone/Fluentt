The CTC prefix-beam decoder and English phoneme lexicon decoder are selectively
ported from BlackKaiser1121/FLUENTT commit
8fce873f41b9b016523c7556ec06c786b3571ccc, branch codex/wav2vec2-local-speech.
The candidate checkpoint is facebook/wav2vec2-lv-60-espeak-cv-ft. It emits
phonemes; the English words are dictionary estimates, not validated ASR.
CMUdict and wordfreq resources retain their own package/data licenses.
No model or data assets are redistributed in this integration.
