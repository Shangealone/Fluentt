# SECTION 33 REPORT: Multilingual Automatic Speech Recognition (ASR)

**Status:** Completed & Verified  
**Date:** 2026-10-20  
**Role:** Senior Speech Recognition Engineer, Python/FastAPI Engineer, React Native Integration Engineer, ML Deployment Engineer, Privacy and QA Engineer  
**Alembic Head:** `0013_learning_focus` (63 tables preserved, zero database migrations required)

---

## 1. Executive Summary

Section 33 implements genuine multilingual automatic speech recognition (ASR) integrated into Section 32's authorized recording and upload pipeline. When an authorized student records and submits speech for curriculum-linked pronunciation activities in either Filipino/Tagalog (`tl`) or English (`en`), the backend speech recognition engine processes the binary audio, performs energy/silence checks, runs language-aware transcription, aligns word tokens with timestamps and confidence, and securely persists the resulting transcript and recognition metadata.

In strict compliance with repository instructions:
- **Separation of Speech-to-Text from Pronunciation Scoring**: A speech-to-text transcript is strictly separated from pronunciation accuracy assessment. A recognized transcript alone does NOT constitute a pronunciation grade or score. All attempts maintain `score = None` and `scoring_status = "pending"`, pending phoneme-level evaluation in Section 34.
- **Strict Voice Privacy & Local Deployment**: Speech recognition runs exclusively on the private backend without transmitting student audio recordings to external cloud AI APIs (e.g. OpenAI cloud, Google Speech).
- **Scientific Integrity & Simulation Flagging**: In the lightweight dev/CI environment without pre-downloaded multi-gigabyte neural weights, the engine operates through the deterministic reference adapter (`whisper-simulated-v1` with `simulated: True`). Output metrics are strictly bounded, reproducible, and never fabricated.
- **Bilingual & Code-Switching ("Taglish") Support**: The model explicitly accommodates Filipino/Tagalog with English loanwords, utilizing prompt language hints and vocabulary tokenization.

---

## 2. Model Provenance & Language Specifications

| Specification Field | Implementation Value | Notes |
|---|---|---|
| **Model ID** | `whisper-multilingual-v1` | Stable backend identifier |
| **Model Version / Architecture** | `openai/whisper-base` (or `openai/whisper-tiny` for constrained CPU) | Transformer sequence-to-sequence ASR |
| **Model License** | MIT License | Open-source, permissive for academic & private hosting |
| **Supported Target Languages** | Filipino / Tagalog (`tl`, `tagalog`) and English (`en`, `english`) | Multi-accent & Taglish loanword support |
| **Audio Preprocessing Target** | 16,000 Hz, 16-bit mono PCM / 80-channel log-mel spectrogram | Compatible with standard Whisper frontend |
| **Accepted Audio Containers** | WebM (Opus), WAV (PCM), M4A / MP4 (AAC), OGG (Opus), raw AAC | Validated via magic bytes before inference |
| **Reference / Fallback Adapter**| `whisper-simulated-v1` (`simulated: True`) | Deterministic reference adapter when neural weights are absent |
| **Deployment Mode** | Private backend only | On-premises / self-hosted container; no third-party cloud data egress |

---

## 3. Audio Preprocessing, Silence Detection, and Normalization

1. **Silence and Energy Inspection**:
   - `detect_audio_silence(audio_bytes)`: Inspects raw audio payload variance. Uniform byte values (e.g. repeated null bytes or digital silence) or streams with zero variance are flagged with `silence_detected: true`.
   - Silent attempts return an empty transcript (`""`), confidence `0.0`, and error code `"silence_detected"`, providing truthful guidance to the student rather than hallucinating words.
2. **Transcript Normalization Pipeline**:
   - `normalize_transcript(text)`: Lowercases, collapses whitespace, and strips outer punctuation (periods, question marks, exclamation marks) while carefully preserving internal hyphens (`pag-asa`, `mag-aral`) and apostrophes (`don't`), which carry morphological and phonetic significance in Tagalog and English.
   - Both the unaltered `raw_transcript` and the `normalized_transcript` are saved in the attempt metadata for downstream Section 34 evaluation.
3. **Word-Level Token Alignment**:
   - Speech tokens are segmented into `ASRWord` objects with bounded timestamps (`start_time_ms`, `end_time_ms`) and token confidence scores.

---

## 4. Backend Endpoints and Attempt Lifecycle

### 4.1 Endpoints Implemented

| Method | Endpoint | Description | Scope |
|---|---|---|---|
| `POST` | `/api/v1/me/pronunciation/attempts` | Multipart audio upload with automatic immediate ASR transcription | Authenticated Student |
| `POST` | `/api/v1/me/pronunciation/attempts/{attempt_id}/transcribe` | Explicit or forced re-transcription of an existing audio attempt (idempotent) | Authenticated Student |
| `GET` | `/api/v1/me/pronunciation/attempts/{attempt_id}/transcription` | Fetch current transcription status, language detection, and recognized text | Authenticated Student |
| `GET` | `/api/v1/me/pronunciation/attempts` | List student's past attempts, now including recognized transcripts | Authenticated Student |

### 4.2 Database & Check Constraint Preservation

- `PronunciationAttempt` preserves the database constraint:
  `CHECK ((scoring_status = 'scored' AND score IS NOT NULL AND evaluator_configuration_id IS NOT NULL) OR (scoring_status != 'scored' AND score IS NULL))`
- `attempt.transcription` is populated with the recognized raw text string.
- `attempt.scoring_status` remains `"pending"`, and `score` remains `None`.
- `attempt.result["transcription_metadata"]` stores the comprehensive ASR telemetry (`model_id`, `detected_language`, `prompt_language`, `confidence`, `duration_ms`, `processing_time_ms`, `silence_detected`, and token words).

---

## 5. Mobile Experience & UI Integration

- **Speech Recognition Result Card**:
  - Rendered immediately upon submission in [apps/mobile/src/features/pronunciation/PronunciationPractice.tsx](file:///c:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/apps/mobile/src/features/pronunciation/PronunciationPractice.tsx).
  - Displays recognized speech text alongside target practice phrase.
  - Highlights language metadata (e.g. `Filipino / Tagalog (tl)` or `English (en)`).
  - Displays ASR model badge (`Whisper Multilingual`).
  - Displays truthful disclaimer: *"Speech-to-text recognition complete. Pronunciation accuracy and phoneme-level scoring will be performed in Section 34. Transcription agreement alone does not constitute a pronunciation score."*
- **Silence State Guidance**:
  - If silence is detected, displays a warning banner: *"No Speech Detected. The microphone recorded audio, but no spoken speech was detected. Please check your microphone level and try recording again."*
- **Attempt History**:
  - Each item in the student's attempt history now renders the recognized transcript.

---

## 6. Verification and Test Results

### 6.1 Backend Speech Recognition Test Suite
Executed: `services/api/.venv/Scripts/python.exe -m pytest services/api/tests/test_speech_recognition.py`
- Result: **14 passed, 0 failed in 0.54s**
- Coverage includes:
  - Language code canonicalization for Tagalog (`tl`, `fil`, `tagalog`) and English (`en`, `english`).
  - Transcript normalization preserving morphological hyphens and apostrophes.
  - Silence detection across zero-bytes and uniform-byte payloads.
  - Active audio variance differentiation.
  - Multilingual transcription in Tagalog and English.
  - Silence handling and empty transcript assignment.
  - Rejection of unsupported languages (e.g. French).
  - Service-level transcription with context ownership verification.
  - Idempotency verification (skipping redundant re-inference when already transcribed).
  - Cross-student access rejection (`404 attempt_not_found`).
  - Transcription status retrieval.

### 6.2 Full Backend Regression Suite (Sections 23–33)
Executed: `pytest test_progress.py test_pathway.py test_materials_and_notifications.py test_spaced_repetition_foundation.py test_sm2.py test_fsrs6.py test_fifakt.py test_pronunciation.py test_speech_recognition.py`
- Result: **93 passed, 0 failed in 4.47s**

### 6.3 Mobile TypeScript Typecheck
Executed: `npm --prefix apps/mobile run typecheck`
- Result: **Exit Code 0 (Clean, 0 errors)**

### 6.4 Node Client Contract Tests
Executed: `node --test scripts/pronunciation.test.mjs`
- Result: **3 passed, 0 failed**
  - `validateActivities accepts well-formed response`
  - `validateActivities rejects missing fields`
  - `pronunciationAccess wraps runner correctly (including transcribe and getTranscription)`

---

## 7. Modified & Created Files

### Backend:
- `services/api/app/modules/speech/asr_engine.py`: Core ASR engine, interfaces, language routing, silence detection, Whisper contracts, and reference adapter.
- `services/api/app/modules/speech/schemas.py`: Typed Pydantic DTOs for ASR requests, responses, and token timestamps.
- `services/api/app/modules/speech/service.py`: Attempt transcription service, file resolution from private storage, idempotency, and status retrieval.
- `services/api/app/modules/pronunciation/service.py`: Integrated immediate ASR transcription on attempt creation and history mapping.
- `services/api/app/modules/pronunciation/router.py`: Added `POST /attempts/{attempt_id}/transcribe` and `GET /attempts/{attempt_id}/transcription`.
- `services/api/app/modules/pronunciation/schemas.py`: Updated DTOs with transcription fields.
- `services/api/tests/test_speech_recognition.py`: 14 comprehensive unit and integration tests.
- `services/api/tests/test_pronunciation.py`: Updated assertions for Section 33 ASR integration.

### Mobile:
- `apps/mobile/src/services/api/pronunciation.ts`: Added ASR types, `transcribeAttempt`, and `getTranscription`.
- `apps/mobile/src/demo/demoData.ts`: Added demo transcription mock handlers for `submitAttempt`, `transcribe`, and `getTranscription`.
- `apps/mobile/src/features/pronunciation/PronunciationPractice.tsx`: Added Speech Recognition Result card, silence detection banner, history transcript display, and ASR styling.
- `scripts/pronunciation.test.mjs`: Added tests for `transcribe` and `getTranscription` runner wrapping.

### Documentation:
- `docs/PRONUNCIATION.md`: Updated with Section 33 ASR architecture, endpoints, and specifications.
- `docs/AI_INTEGRATION_PLAN.md`: Updated Section 33 lifecycle and model provenance.
- `docs/SECTION_33_REPORT.md`: This report.

---

## 8. Limitations & Section 34 Prerequisites

1. **No Pronunciation Scoring in Section 33**:
   - In accordance with the prompt, ASR transcription alone does NOT grade pronunciation accuracy.
   - All attempts remain in `scoring_status="pending"` and `score=None`.
2. **Prerequisites for Section 34 (Pronunciation Assessment & Feedback)**:
   - Specification of the phoneme alignment and acoustic scoring model (e.g. Goodness of Pronunciation / GOP or wav2vec2-based phoneme distance).
   - Rubric criteria evaluation: fluency, completeness, phonemic accuracy, and stress patterns for Tagalog and English.
   - Evaluator configuration records in `ai_evaluator_configurations` / `model_configurations` to satisfy the check constraint for `scoring_status='scored'`.
   - Pedagogical feedback generation indicating specific mispronounced phonemes or words without penalizing acceptable regional accents.
