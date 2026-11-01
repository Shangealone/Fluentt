# Draft human English pronunciation rubric — short fixed read-aloud

**Research draft; no student grades or automatic scale conversion.** Expert/adviser review, rater orientation and pilot agreement are required. Target is **segmental pronunciation accuracy of the intended sentence**, with intelligibility recorded as a separate dimension. This is closer to the model's expected-phone quality than a composite fluency/prosody score, but still not identical to its mean of learned phone predictions.

## Before rating

Give raters the fixed written prompt and the preapproved baseline/variant register. Present anonymized audio in randomized order. Raters are blind to WavLM scores, speaker identity beyond needed variety notes, each other's ratings, and experimental allocation. They may replay to a fixed maximum set in the manual, e.g. three listens, recording when used. Check capture quality and prompt correspondence **before** assigning a score. Silence, corrupted or cut-off audio, severe noise masking the relevant segment, and wrong prompt are `UNSCORABLE` with reason, not 0 pronunciation. A clear, usable attempt that omits much of the requested sentence receives the completion code below plus a segmental score only for what is audibly produced; report coverage separately. Do not interpret missing words as mispronounced phones.

## Segmental accuracy, integer 0–10

Rate audible target consonants/vowels and word recognizability using the entire usable phrase; count persistent, meaning-changing substitutions and omissions more heavily than minor variation. Use the anchors, then choose an integer within the band. No mechanical count-to-score formula is asserted; raters must note the evidence for scores 0–6 and all disputed variants.

| Score | Observable anchor |
|---|---|
| **9–10** | Nearly all target words and segments are recognizable; no clear segmental errors or only an isolated minor deviation that does not obscure a word. 10 requires no observed segmental error in the reviewed usable phrase. Accepted variants retain full credit. |
| **7–8** | Most words readily recognizable; a few clear segmental substitutions/omissions/insertions, or several minor deviations, without materially obstructing phrase understanding. |
| **5–6** | Phrase generally understandable from audio, but multiple words show clear segmental differences and some require effort to identify. |
| **3–4** | Frequent or severe differences make several words hard to recognize; only parts of the intended phrase are reliably intelligible. |
| **0–2** | Usable speech is present, yet very few attempted words are recognizable against the prompt. 0 is reserved for an attempted audible reading with essentially no recognizable target segments; silence is `UNSCORABLE`. |

This deliberately avoids the original dataset's “heavy accent” penalty: an approved, intelligible variety is not itself an error. It also avoids equating human 0–10 with model 0–100 / 10. The word-count/phone-count relationship is recorded descriptively, not converted to a score formula.

## Decision rules and separate observations

- **Substitution:** mark target/observed phones only when perceptually clear; annotate uncertain quality rather than infer an error from WavLM or spelling. **Omission/insertion:** identify the affected spoken word and position; distinguish segment deletion from an accepted reduction. Preserve evidence and variant ID. Do not count the same acoustic event twice.
- **Unclear segment:** mark `UNCERTAIN` and explain whether masking/noise or phonetic ambiguity is responsible. If the recording does not permit a reliable phrase judgment, `UNSCORABLE`. Do not guess a low score.
- **Accepted variant:** check the frozen register before rating; transcribe what is heard and record the variant ID. Rhoticity, stress and vowel quality require context and reviewer approval. A ratable unfamiliar variant is flagged for adjudication *without* showing a model prediction; do not relabel only because it would improve correlation.
- **Self-correction:** rate the final complete intended production if clear; note first attempt and self-correction separately. If multiple competing readings prevent a clear final phrase, flag for adjudication. **Incomplete sentence:** record attempted/target word coverage and missing words separately; score segmental accuracy only on attempted audible content, with insufficient content `UNSCORABLE` when no meaningful phone evidence exists. An insertion or changed word is recorded as prompt deviation, not necessarily a phone error.
- **Noise/clipping:** use `UNSCORABLE` when material obscuration occurs; otherwise record capture issue and rate only audible evidence. Noisy audio is not proof of poor pronunciation. **Wrong prompt:** code `PROMPT_MISMATCH`, no pronunciation score for the target sentence.
- **Intelligibility:** separately rate 0–4 without seeing the target text if feasible, using an independent listener or masked prompt. Anchor 0 none recognizable, 1 isolated words, 2 general topic/partial phrase, 3 most words, 4 full phrase without context. A rater who sees the prompt cannot validly claim a blind intelligibility rating. **Completeness** is a separate target/attempted word count, not a pronunciation score. Record optional stress/prosody observations separately; WavLM strips stress and has no validated stress score.

### Calibration examples, not recorded evidence

For the *hypothetical* prompt “Please open the red box”: a clear accepted non-rhotic pronunciation of “red” is not automatically penalized; a clear “bed” for “red” is a substitution to discuss; saying only “Please open” is incomplete, with coverage recorded separately; an empty recording is `UNSCORABLE`. These are instructions, not observed dataset labels or approved variants for FLUENTT.

## Rater workflow

Two qualified raters independently enter score, quality/prompt/coverage codes, uncertain words, segment evidence and variant IDs. On development examples only, discuss anchor disagreements and update the manual before freezing. On untouched recordings, retain both original ratings, report exact and within-one-point agreement, weighted κ for ordinal ratings, and a two-way absolute-agreement ICC only if its assumptions are reasonable; a small pilot may yield unstable intervals. Adjudication is separate, documented and blinded to model outputs. The primary human target is a predeclared average of two valid ratings only if agreement supports combining them; otherwise keep separate rater results and declare the primary target unresolved.

The [SpeechOcean762 paper's manual metrics](https://arxiv.org/html/2104.01378) inform the anchors but are not this rubric's validation. It distinguishes phone goodness, word stress, sentence accuracy, fluency, completeness and prosody.
