# Pronunciation Recording Interface & Audio Architecture

This document defines the Section 32 implementation for learner pronunciation audio recording, client-side capture pipelines, permission management, server upload endpoints, binary inspection, and private audio retention policies.

## Current personal Voice follow-up — 2026-10-21

The personal portal now uses LivePronunciationPractice rather than the historical recording/upload/assessment UI described below. Recognition highlights target words from interim transcripts and completes this local practice only after a final transcript contains all target words in order. It neither grades pronunciation nor writes backend activity/progress/assessment records. The school portal retains PronunciationPractice and its existing recording APIs. Existing simulated backend assessment behavior is not promoted to real acoustic scoring by this change.

Native recognition uses expo-speech-recognition 58.0.0, requiresOnDeviceRecognition=true, recordingOptions.persist=false, matching installed English/Tagalog locales and deliberate microphone permission. An updated native build is required; Expo Go is unsupported for this module. Browser recognition uses a dedicated processLocally=true adapter; browsers without local recognition or an installed language report unavailable. A deliberate setup button can download a supported offline language pack, never start audio recording or select remote recognition. This preserves the existing audio privacy boundary.

Recognition is disposed on blur/unmount, phrase/language change, app background and browser visibility loss. Pending permission starts and late events are invalidated. Reference playback stops before recognition; no simultaneous audio recording/upload pipeline is started. Listening is capped at 60 seconds, with bounded stop cleanup. Word matching is a local speech-display policy, separate from answer validation and acoustic assessment. See PERSONAL_LEARNING.md for changed files and verification limits.

## 1. System Overview & Scope

Section 32 establishes a genuine, end-to-end audio recording and submission workflow connecting the Expo/React Native mobile client with the FastAPI backend.

### Key Principles:
1. **No Simulated or Fabricated Scoring**:
   - In Section 32, neither automated speech recognition (ASR) nor natural language pronunciation assessment is active.
   - All submitted attempts are recorded with `scoring_status = "pending"`, `score = None`, and `transcription = None`.
   - The UI displays explicit pending status (`Audio submitted. Scoring pipeline pending (Section 33).`) and never fabricates fake scores or confidence percentages.
2. **Universal Audio Recording**:
   - Web platform: Utilizes browser `navigator.mediaDevices.getUserMedia()` and W3C `MediaRecorder` producing standard `audio/webm` or `audio/ogg`.
   - Native Android/iOS: Utilizes `expo-av` (`Audio.Recording` with High Quality preset) producing AAC/M4A.
   - Recording hook (`useAudioRecorder`) provides unified state management: `idle`, `recording`, `paused`, `reviewing`, and `uploading`.
3. **Explicit Permissions & Interruption Handling**:
   - Microphone permission is requested only upon deliberate user action (clicking "Start Recording").
   - Detailed user guidance is provided for granted, denied, and permanently denied/blocked permissions.
   - Native audio session is configured to interrupt-proof modes (`allowsRecordingIOS: true`, `playsInSilentModeIOS: true`, `staysActiveInBackground: false`).
   - Timers, audio tracks, and temporary recording sessions are reliably released upon unmount, navigation blur, or cancellation.
4. **Binary Audio Verification**:
   - Backend performs file header magic-byte inspection rather than trusting user-supplied MIME types or file extensions.
   - Supported containers: WebM/EBML (`\x1a\x45\xdf\xa3`), WAV/RIFF (`RIFF....WAVE`), OGG (`OggS`), MP4/M4A (`ftyp`), and raw AAC (`\xff\xf1` / `\xff\xf9`).
   - File size enforced between 100 bytes and 10 MiB; duration enforced between 500 ms and 60,000 ms (60 seconds).
5. **Privacy & Data Isolation**:
   - Audio files are stored strictly on local private disk (`services/api/storage/audio/{context_id}/{attempt_id}.{ext}`) outside the public web root.
   - Retrieval endpoints strictly require authenticated student ownership. Cross-user audio access is forbidden.
   - No voice or audio data is ever transmitted to third-party cloud APIs (such as OpenAI, Google Cloud Speech, or Whisper API) without explicit IRB/institutional consent.

---

## 2. Audio Format & Capture Specifications

| Parameter | Specification | Notes |
|---|---|---|
| **Maximum Duration** | 60 seconds (60,000 ms) | Timer auto-stops recording upon reaching 60s |
| **Minimum Duration** | 500 milliseconds | Rejects accidental clicks or empty buffers |
| **Maximum Upload Size** | 10 MiB (10,485,760 bytes) | Prevents denial-of-service and storage exhaustion |
| **Minimum Upload Size** | 100 bytes | Rejects truncated or zero-byte audio files |
| **Web Container/Codec** | WebM (`audio/webm;codecs=opus`) or Ogg | Browser native via `MediaRecorder` |
| **Native Container/Codec**| M4A / AAC (High Quality preset) | Expo AV native recording presets |
| **Sample Rate** | 44,100 Hz / 48,000 Hz | High-fidelity recording for downstream ASR |
| **Channels** | Mono (1 channel) preferred / Stereo tolerated | Voice assessment operates primarily on mono streams |

---

## 3. Database & Entity Schema

Section 32 reuses the pre-existing `ai_pronunciation_activities` and `ai_pronunciation_attempts` tables (preserving the frozen 63 tables under Alembic head `0013_learning_focus`).

```sql
-- Activity definition (curriculum prompts)
CREATE TABLE ai_pronunciation_activities (
    id UUID PRIMARY KEY,
    curriculum_version_id UUID NOT NULL REFERENCES curriculum_versions(id),
    lesson_id UUID REFERENCES curriculum_lessons(id),
    competency_id UUID REFERENCES curriculum_competencies(id),
    title VARCHAR(200) NOT NULL,
    prompt_text TEXT NOT NULL,
    target_language VARCHAR(32) NOT NULL, -- 'tl' (Filipino/Tagalog) or 'en' (English)
    phonetic_target VARCHAR(200),
    reference_audio_url VARCHAR(500),
    rubric_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attempt submission record
CREATE TABLE ai_pronunciation_attempts (
    id UUID PRIMARY KEY,
    activity_id UUID NOT NULL REFERENCES ai_pronunciation_activities(id),
    enrollment_id UUID REFERENCES student_class_enrollments(id),
    session_id UUID REFERENCES learner_device_sessions(id),
    audio_storage_path VARCHAR(500) NOT NULL,
    audio_format VARCHAR(32) NOT NULL,
    duration_ms INTEGER NOT NULL,
    scoring_status VARCHAR(32) NOT NULL, -- 'pending' in Section 32
    score NUMERIC(5,2),                  -- NULL until Section 33 scoring
    transcription TEXT,                  -- NULL until Section 33 ASR
    evaluator_configuration_id UUID REFERENCES ai_evaluator_configurations(id),
    raw_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Check constraint preserved:
`CHECK ((scoring_status = 'scored' AND score IS NOT NULL AND evaluator_configuration_id IS NOT NULL) OR (scoring_status != 'scored' AND score IS NULL))`

---

## 4. API Endpoints

All endpoints require valid session bearer token issued to an authenticated student.

### 4.1 List Pronunciation Activities
`GET /api/v1/me/pronunciation/activities?target_language={tl|en}`
- **Response**: `PronunciationActivitiesResponse` containing list of `PronunciationActivityDTO` items.
- Language filtering: supports `'tl'` (Tagalog / Filipino) and `'en'` (English).

### 4.2 Get Specific Activity
`GET /api/v1/me/pronunciation/activities/{activity_id}`
- **Response**: `PronunciationActivityDTO` with prompt text, phonetic hints, and lesson context.

### 4.3 Submit Audio Recording & Automatic ASR
`POST /api/v1/me/pronunciation/attempts`
- **Request Type**: `multipart/form-data`
  - `audio_file`: Binary audio file (`UploadFile`)
  - `activity_id`: UUID string of target activity
  - `duration_ms`: Integer (milliseconds recorded)
- **Response**: `200 OK` with `PronunciationAttemptSubmissionDTO`:
  ```json
  {
    "attempt_id": "c1f7a1b2-...",
    "activity_id": "3b6801dc-...",
    "target_text": "Magandang umaga sa inyong lahat.",
    "language": "tagalog",
    "attempted_at": "2026-10-20T01:30:00Z",
    "scoring_status": "pending",
    "file_size_bytes": 14200,
    "duration_ms": 3200,
    "mime_type": "audio/webm",
    "simulated": true,
    "message": "Audio recorded and transcribed successfully. Pronunciation scoring pending Section 34.",
    "transcription": "Magandang umaga sa inyong lahat.",
    "transcription_metadata": {
      "model_id": "whisper-multilingual-v1",
      "model_version": "openai/whisper-base",
      "detected_language": "tl",
      "prompt_language": "tl",
      "confidence": 0.95,
      "silence_detected": false
    }
  }
  ```

### 4.4 Transcribe Existing Attempt (Idempotent / Retranscribe)
`POST /api/v1/me/pronunciation/attempts/{attempt_id}/transcribe?force_retranscribe={false|true}`
- **Response**: `TranscriptionResponseDTO` containing recognized transcript, normalized text, detected language, confidence, and token-level timestamps.

### 4.5 Get Transcription Status
`GET /api/v1/me/pronunciation/attempts/{attempt_id}/transcription`
- **Response**: `TranscriptionStatusDTO` (`pending`, `completed`, or `silence_detected`).

### 4.6 List Attempt History
`GET /api/v1/me/pronunciation/attempts?activity_id={optional_activity_id}`
- **Response**: List of previous attempts by the authenticated student, including `transcription`.

---

## 5. Multilingual Speech Recognition (Section 33 ASR Architecture)

1. **Model Specification & License**:
   - Model ID: `whisper-multilingual-v1`
   - Base Architecture: OpenAI Multilingual Whisper (`openai/whisper-base` / `openai/whisper-tiny`), MIT License.
   - Target Languages: Filipino/Tagalog (`tl`) and English (`en`), with bilingual code-switching ("Taglish") handling.
2. **Audio Preprocessing**:
   - Resampling/validation: 16 kHz 16-bit mono PCM structure compatibility.
   - Silence Detection: Checks raw audio variance and energy distribution; tags zero-energy recordings with `silence_detected: true`.
   - Transcript Normalization: Lowercases and normalizes whitespace while preserving morphological hyphens/apostrophes (e.g. `pag-asa`, `don't`).
3. **Traceability & Verification**:
   - Stores raw recognized text, normalized text, model ID, detected language, confidence, and word tokens in attempt JSONB metadata.
   - Adheres to database constraint: `scoring_status` remains `pending` and `score` remains `None`.
   - **Crucial Separation**: A speech-to-text transcript is strictly separated from pronunciation accuracy assessment. Phoneme grading and pronunciation scoring are reserved for Section 34.

---

## 6. NLP-Driven Pronunciation Assessment (Section 34 Assessment Architecture)

Section 34 integrates evidence-based natural language pronunciation assessment using **Goodness of Pronunciation (GOP)** acoustic-phonetic posterior scoring and grapheme-to-phoneme (G2P) alignment for Filipino/Tagalog (`tl`) and English (`en`).

### 6.1 Assessment Methodology & Scientific Foundations
1. **Evidence-Based vs. Fabricated Scores**:
   - Generic string edit distance (Levenshtein distance) and ASR Word Error Rate (WER) are explicitly **not** equated with phonetic pronunciation accuracy.
   - Acoustic posterior GOP approximations evaluate individual phone alignments against phoneme boundaries and target models.
2. **Multi-Dimensional Diagnostic Rubric**:
   - **Phonemic Accuracy (40%)**: GOP-derived phoneme posteriors comparing learner utterance phones to canonical reference phones.
   - **Speech Fluency (30%)**: Words Per Minute (WPM) rate benchmarked against age-appropriate target ranges (60–140 WPM), accounting for pauses and hesitation.
   - **Completeness (20%)**: Coverage of prompt target words and phonemes, preventing artificially inflated scores from partial or single-word utterances.
   - **Prosodic Rhythm (10%)**: Syllabic regularity and duration variance.
   - **Overall Score**: Weighted composite in range `[0.00, 100.00]`.
3. **Language-Specific G2P Alignment**:
   - **Tagalog / Filipino (`tl`)**: Rule-based G2P supporting transparent orthography, phonemic digraph `ng` (`/ŋ/`), vowel sets (`/a/`, `/ɛ/`, `/i/`, `/ɔ/`, `/u/`), glottal stops, and stress patterns.
   - **English (`en`)**: CMU ARPAbet lexicon with deterministic letter-to-sound phonetic fallback rules.
4. **Silence and Failure Handling**:
   - Silent recordings (`silence_detected: true`) or empty transcripts receive `score = None` and `scoring_status = "unsupported"` (or `"pending"`), explicitly satisfying database check constraints.
   - Low-quality or unalignable recordings return clear diagnostic status rather than penalizing learner pronunciation.
5. **Database Model Binding & Constraint Compliance**:
   - Under database check constraint:
     `CHECK ((scoring_status = 'scored' AND score IS NOT NULL AND evaluator_configuration_id IS NOT NULL) OR (scoring_status != 'scored' AND score IS NULL))`
   - Evaluator configurations are registered in `model_configurations` under `model_versions` with `task="pronunciation_evaluator"`, ensuring foreign key integrity.

### 6.2 Assessment API Endpoints

- `POST /api/v1/me/pronunciation/attempts/{attempt_id}/evaluate`:
  Executes pronunciation evaluation on an existing recorded attempt, returning full multi-dimensional metrics, word-level diagnostics, phoneme details, and actionable feedback.
- `GET /api/v1/me/pronunciation/attempts/{attempt_id}/assessment`:
  Retrieves persistent evaluation results and rubrics for an attempt.

---

## 7. Security & Privacy Guarantees

1. **Storage Sandboxing**: All audio files are written with generated UUID filenames into `services/api/storage/audio/`. The directory is created with restricted operating system permissions and is not served as static web assets.
2. **Access Isolation**: Learner attempts are tied to the caller's verified `enrollment_id` or `session_id`. Any query attempting to access another student's audio is rejected with `403 Forbidden` or `404 Not Found`.
3. **No External Cloud AI Exfiltration**: Audio files remain entirely on-premises/local. No speech data is forwarded to cloud APIs.
4. **Boundary with Research Data**: Routine classroom pronunciation practice records are strictly isolated from research-coded participant datasets.

