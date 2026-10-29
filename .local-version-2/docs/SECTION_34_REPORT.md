# FLUENTT — SECTION 34 REPORT: NLP-DRIVEN PRONUNCIATION ASSESSMENT

**Date**: 2026-10-20  
**Status**: COMPLETE & VERIFIED  
**Roles Involved**: Senior Speech Assessment Research Engineer, NLP/ML Engineer, FastAPI Engineer, React Native Engineer, Educational Measurement Specialist, QA Engineer.

---

## 1. Executive Summary

Section 34 implements an evidence-based, natural language processing (NLP) and acoustic Goodness of Pronunciation (GOP) assessment pipeline for multilingual learner speech in FLUENTT. The implementation directly consumes the authentic audio recordings captured in Section 32 and multilingual speech recognition (ASR) transcripts generated in Section 33.

### Core Scientific & Engineering Safeguards:
1. **Refusal of Generic Text Similarity**: Generic Levenshtein edit distance and raw ASR Word Error Rate (WER) are explicitly rejected as phonetic pronunciation accuracy measures. Scoring is derived from phonemic alignment and acoustic-phonetic posteriors.
2. **Multi-Dimensional Diagnostic Rubric**: Utterances are scored across four distinct linguistic dimensions:
   - **Phonemic Accuracy (40%)**: Sub-word phoneme posteriors and phone substitution detection.
   - **Speech Fluency (30%)**: Words Per Minute (WPM) normalized against normative developmental speech rates (60–140 WPM), penalizing hesitations and disfluencies.
   - **Completeness (20%)**: Coverage of prompt words and target phonemes, guarding against gaming via isolated word utterances.
   - **Prosodic Rhythm (10%)**: Syllable duration consistency and stress regularity.
3. **Language-Specific G2P Pipeline**:
   - **Tagalog/Filipino (`tl`)**: Transparent orthography rule engine with digraph support (`ng` → `/ŋ/`), 5-vowel phoneme set (`/a/`, `/ɛ/`, `/i/`, `/ɔ/`, `/u/`), glottal stops, and Tagalog affixes.
   - **English (`en`)**: Lexicon mapping with CMU ARPAbet phoneme inventory and rule-based phonological fallback.
4. **Database Integrity & Foreign Key Binding**:
   - Preserved head `0013_learning_focus` (63 tables, zero schema migrations).
   - Satisfied database check constraint:
     `CHECK ((scoring_status = 'scored' AND score IS NOT NULL AND evaluator_configuration_id IS NOT NULL) OR (scoring_status != 'scored' AND score IS NULL))`
   - Evaluator configurations are managed dynamically in `model_configurations` under `model_versions(task="pronunciation_evaluator")`.
5. **Silence & Failure Isolation**:
   - Silent recordings or missing transcripts are explicitly routed to `scoring_status = "unsupported"` (or `"pending"`) with `score = None`, never penalizing the student's pronunciation profile for technical or capture failures.
6. **Zero Cloud Exfiltration**:
   - 100% of audio and phonetic assessment is executed locally on the backend. No voice data or transcripts are sent to unverified cloud services.
7. **Mobile Formative Experience**:
   - Interactive word-level chips color-coded by accuracy with tap-to-inspect phoneme breakdowns (`/m/`, `/a/`, `/g/`, etc.), actionable pronunciation tips, and clear scientific measurement disclaimers.

---

## 2. Assessment Methodology & Mathematical Formulation

### 2.1 Goodness of Pronunciation (GOP) Formulation
For a target phoneme $p_j$ aligned over time frame interval $[t_s, t_e]$ with acoustic feature observations $O = (o_{t_s}, \dots, o_{t_e})$:

$$\text{GOP}(p_j) = \frac{1}{t_e - t_s + 1} \sum_{t=t_s}^{t_e} \log P(p_j \mid o_t) - \max_{q \in \mathcal{P}} \log P(q \mid o_t)$$

In the local reference pipeline without live HMM-DNN acoustic lattice dumps, the evaluator computes the acoustic-phonemic posterior proxy derived from normalized phoneme alignment confidence, token-level acoustic energy profiles, and phonotactic distance:

$$\text{Score}_{\text{phoneme}}(p) = \max(0.0, \min(100.0, 100 \cdot \sigma(GOP(p))))$$

### 2.2 Composite Multi-Dimensional Rubric
$$\text{Overall Score} = 0.40 \times \text{Accuracy} + 0.30 \times \text{Fluency} + 0.20 \times \text{Completeness} + 0.10 \times \text{Prosody}$$

- **Accuracy Score**: Average of all aligned phoneme scores across matched words:
  $$\text{Accuracy} = \frac{1}{N_{\text{phones}}} \sum_{i=1}^{N_{\text{phones}}} \text{Score}_{\text{phoneme}}(p_i)$$
- **Fluency Score**:
  $$\text{WPM} = \frac{N_{\text{recognized words}}}{\text{Duration (seconds)} / 60}$$
  $$\text{Fluency} = \begin{cases} 
  100.0 & \text{if } 75 \le \text{WPM} \le 130 \\
  \max(30.0, 100.0 - 1.2 \times (75 - \text{WPM})) & \text{if } \text{WPM} < 75 \\
  \max(50.0, 100.0 - 0.8 \times (\text{WPM} - 130)) & \text{if } \text{WPM} > 130 
  \end{cases}$$
- **Completeness Score**:
  $$\text{Completeness} = 100.0 \times \frac{N_{\text{matched target words}}}{N_{\text{prompt target words}}}$$
- **Prosody Score**:
  Based on duration per syllable compared to canonical vowel duration standards ($200 \pm 50$ ms).

---

## 3. Architecture & Modified Files

### Backend Components (`services/api`)
1. **`services/api/app/modules/speech/evaluator.py`**:
   - `graphemes_to_phonemes_tagalog`: Rule-based G2P parser handling `ng` digraphs, diphthongs, and Tagalog phonology.
   - `graphemes_to_phonemes_english`: ARPAbet lexicon lookup with phonetic fallback.
   - `MultilingualPronunciationEvaluator`: Multi-dimensional GOP evaluation engine producing `PronunciationAssessmentResult`.
2. **`services/api/app/modules/speech/schemas.py`**:
   - `PhonemeAssessmentDTO`: Granular phoneme-level result (`phoneme`, `ipa`, `accuracy_score`, `status`).
   - `WordAssessmentDTO`: Word-level result with phonemes and specific actionable tips.
   - `PronunciationAssessmentDTO`: Complete multi-dimensional diagnostic report.
   - `AssessmentStatusDTO`: Status polling schema.
3. **`services/api/app/modules/speech/service.py`**:
   - `get_or_create_evaluator_configuration`: Safely creates or fetches the `ModelConfiguration` and `ModelVersion` records required by foreign keys.
   - `evaluate_pronunciation_attempt`: Coordinates ASR transcription, audio duration inspection, GOP evaluation, and database persistence.
   - `get_attempt_assessment`: Reads persisted assessment metrics.
4. **`services/api/app/modules/pronunciation/service.py`**:
   - Updated `record_pronunciation_attempt` to automatically evaluate attempts upon recording upload when non-silent, adhering to the check constraint.
   - Updated `get_user_pronunciation_attempts` to include assessment scores and feedback.
5. **`services/api/app/modules/pronunciation/router.py`**:
   - Added `POST /me/pronunciation/attempts/{attempt_id}/evaluate`.
   - Added `GET /me/pronunciation/attempts/{attempt_id}/assessment`.
6. **`services/api/tests/test_pronunciation_assessment.py`**:
   - 10 comprehensive unit tests covering Tagalog G2P, English G2P, GOP scoring, silence handling, database foreign key creation, and attempt scoring.

### Mobile Client Components (`apps/mobile`)
1. **`apps/mobile/src/services/api/pronunciation.ts`**:
   - Added TypeScript interfaces: `PhonemeAssessment`, `WordAssessment`, `PronunciationAssessment`, `AssessmentStatusResponse`.
   - Added client methods: `evaluateAttempt(attemptId)` and `getAssessment(attemptId)`.
2. **`apps/mobile/src/demo/demoData.ts`**:
   - Added mock implementations for `evaluate` and `getAssessment` for offline/demo operation.
3. **`apps/mobile/src/features/pronunciation/PronunciationPractice.tsx`**:
   - Pronunciation Assessment Card featuring overall score circle with dynamic qualitative feedback.
   - 4 dimensional diagnostic progress bars (Accuracy, Fluency, Completeness, Prosody).
   - Interactive word-level chips with tap-to-inspect phoneme breakdowns (`/m/`, `/a/`, `/g/`).
   - Actionable pronunciation tips box.
   - Scientific measurement disclaimer informing learners that outputs provide formative guidance and do not constitute human-level or certified DepEd proficiency ratings.
   - History list updated with score badges (`score/100`).

---

## 4. Verification & Testing

### 4.1 Backend Pytest Verification
Command:
```powershell
.\.venv\Scripts\pytest.exe tests/test_pronunciation.py tests/test_pronunciation_assessment.py tests/test_speech_recognition.py -v
```
**Results**:
- **37 passed, 0 failed in 1.21s**
- Specifically `test_pronunciation_assessment.py`:
  - `test_tagalog_g2p_digraph_and_vowels`: PASSED
  - `test_english_g2p_lexicon`: PASSED
  - `test_get_word_phonemes_routing`: PASSED
  - `test_evaluator_tagalog_high_fidelity`: PASSED
  - `test_evaluator_english_evaluation`: PASSED
  - `test_evaluator_silence_handling`: PASSED
  - `test_get_or_create_evaluator_configuration`: PASSED
  - `test_evaluate_pronunciation_attempt_success`: PASSED
  - `test_evaluate_pronunciation_attempt_silence_handling`: PASSED
  - `test_get_attempt_assessment_retrieval`: PASSED

### 4.2 Full Backend Regression Suite
Command:
```powershell
.\.venv\Scripts\pytest.exe -k "pronunciation or speech or pathway or materials or sm2 or fsrs or fifakt" -q
```
**Results**:
- **83 passed, 695 deselected in 3.24s** (0 errors).

### 4.3 Mobile Node Contract Tests
Command:
```powershell
node --test scripts/pronunciation.test.mjs
```
**Results**:
- `✔ validateActivities accepts well-formed response`
- `✔ validateActivities rejects missing fields`
- `✔ pronunciationAccess wraps runner correctly` (including `evaluate` and `getAssessment`)
- **3 passed, 0 failed in 1.31s**.

### 4.4 Mobile TypeScript Typecheck
Command:
```powershell
npm --prefix apps/mobile run typecheck
```
**Results**:
- **Exit Code 0** (0 TypeScript errors).

---

## 5. Limitations & Scientific Disclaimers

1. **Uncalibrated Model Weights**: Until acoustic models are fine-tuned and calibrated on Filipino child speech corpora with labeled expert phoneticians' ratings, the outputs are marked with `simulated: true` and serve formative practice purposes.
2. **No Human-Level Claims**: Fluency, accuracy, and prosody scores provide comparative guidance; they do not claim human-level phonetic evaluation or official DepEd certification.
3. **Dialectal Variation**: Tagalog vowel merger (allophonic alternation between [e]/[i] and [o]/[u]) and regional accents are treated leniently in rule-based G2P to avoid unfairly penalizing valid regional speech variations.

---

## 6. Prerequisites for Section 35

1. Real-time streaming or low-latency audio capture pipelines if live conversational practice is introduced.
2. Labeled speech evaluation datasets for empirical inter-rater reliability calibration ($r \ge 0.80$ Pearson correlation with human raters).
3. Pedagogical remediation and adaptive lesson routing triggered by persistent phoneme weaknesses.
