# SECTION 32 REPORT: Pronunciation Recording Interface

**Status:** Completed & Verified  
**Date:** 2026-10-20  
**Role:** Senior Expo/React Native Audio Engineer, Mobile UX Engineer, FastAPI Engineer, Privacy/Security Engineer, and QA Engineer  
**Alembic Head:** `0013_learning_focus` (63 tables preserved, zero schema modifications required)

---

## 1. Executive Summary

Section 32 establishes a genuine, secure, and accessible pronunciation recording workflow across both mobile native (Android / iOS via `expo-av`) and browser environments (Web via `MediaRecorder` API). An authorized learner views authentic curriculum-linked prompts in both Tagalog (`tl`) and English (`en`), grants microphone permissions on demand, records their speech, reviews playback audio, and securely submits the binary recording to the FastAPI backend.

In strict compliance with repository instructions:
- **No Simulated or Fabricated NLP Scoring**: No speech recognition (ASR) transcriptions, pronunciation accuracy scores, or phoneme grades are fabricated. Submitted recordings receive `scoring_status="pending"`, `score=None`, and `transcription=None`.
- **Zero Third-Party Cloud Exfiltration**: Audio files are saved exclusively to private local storage outside the public web root (`services/api/storage/audio/{context_id}/{attempt_id}.{ext}`). No audio data is uploaded to external AI services (e.g. OpenAI Whisper API, Google Speech).
- **Binary Magic-Byte Inspection**: Server-side validation inspects audio file headers directly to verify container integrity (WebM, WAV, OGG, MP4/M4A, AAC) and enforces strict limits on payload size (100 B to 10 MiB) and recording duration (500 ms to 60,000 ms).
- **Separation of Classroom Practice from Research**: Regular learner pronunciation practice is completely isolated from experimental research participants and telemetry.

---

## 2. Supported Platforms, Audio Formats, and Hardware

| Platform / Environment | Audio Capture Engine | Output Format / Codec | Typical Sample Rate | Verification Mode |
|---|---|---|---|---|
| **Android (Native)** | `expo-av` (`Audio.Recording`, High Quality) | AAC / M4A (`audio/m4a`, `audio/mp4`) | 44.1 kHz, 16-bit, Mono | Architecture validated via Expo AV SDK 52 presets |
| **iOS (Native)** | `expo-av` (`Audio.Recording`, High Quality) | AAC / M4A (`audio/m4a`, `audio/mp4`) | 44.1 kHz, 16-bit, Mono | Architecture validated via Expo AV SDK 52 presets |
| **Web Browser (Chrome/Edge/Firefox)** | W3C `navigator.mediaDevices.getUserMedia` + `MediaRecorder` | WebM (`audio/webm;codecs=opus`) or Ogg Opus | 48.0 kHz, 16-bit, Stereo/Mono | Verified live in browser runtime |
| **Fallback / Demo** | Web Audio API / Mock Blob generator | Valid WebM/WAV binary payload | 44.1 kHz | Automated test suite verified |

---

## 3. Microphone Permissions and Interruption Lifecycle

1. **On-Demand Permission Request**:
   - The application does NOT request microphone permissions on page load or component mount.
   - Permission is requested only when the learner explicitly presses the "Start Recording" button (`requestPermission()`).
2. **Permission States Handled**:
   - `granted`: Immediate transition into recording state with live waveform/timer indicator.
   - `denied`: Informative banner advising the learner that audio recording requires microphone access.
   - `permanently_denied` / `blocked`: Clear instructions indicating how to re-enable microphone permissions in system settings.
   - `unavailable`: Graceful fallback if the device possesses no recording hardware or if browser security context prohibits media capture (e.g. insecure HTTP).
3. **Hardware & App Interruptions**:
   - Native audio mode configured with `allowsRecordingIOS: true`, `playsInSilentModeIOS: true`, and `staysActiveInBackground: false` to ensure calls or OS interruptions halt recording cleanly.
   - Component unmount, route blur, or explicit discard triggers comprehensive cleanup: halts active timers, releases MediaStream tracks, unloads sound playback instances, and purges temporary audio buffers.

---

## 4. Backend Audio Handling & Storage Architecture

### 4.1 Endpoints Implemented

| Method | Endpoint | Description | Auth / Scope |
|---|---|---|---|
| `GET` | `/api/v1/me/pronunciation/activities` | List curriculum pronunciation activities with optional `target_language` filter (`tl` or `en`) | Authenticated Student |
| `GET` | `/api/v1/me/pronunciation/activities/{activity_id}` | Fetch detailed prompt, phonetic target, and rubric criteria for an activity | Authenticated Student |
| `POST` | `/api/v1/me/pronunciation/attempts` | Multipart upload of binary audio recording, activity ID, and elapsed duration | Authenticated Student |
| `GET` | `/api/v1/me/pronunciation/attempts` | Retrieve authenticated student's previous attempt history | Authenticated Student |

### 4.2 Binary Validation & Magic Bytes

Uploaded audio is read into an initial memory buffer to verify actual binary headers before saving:
- **WebM / EBML**: Begins with `\x1a\x45\xdf\xa3`
- **WAV**: Starts with `RIFF` and contains `WAVE` at offset 8
- **OGG**: Starts with `OggS` (`\x4f\x67\x67\x53`)
- **MP4 / M4A**: Contains `ftyp` within the first 12 bytes
- **AAC (ADTS)**: Starts with `\xff\xf1` or `\xff\xf9`

Files failing magic-byte inspection, files smaller than 100 bytes, or files exceeding 10 MiB are rejected with `400 Bad Request` or `413 Payload Too Large`.

### 4.3 Database Schema Preservation

Reuses the existing `ai_pronunciation_activities` and `ai_pronunciation_attempts` tables originally initialized in the database schema:
- Pinned to Alembic head `0013_learning_focus` (63 tables total; zero migration required).
- Adheres to database check constraint:
  `((scoring_status = 'scored' AND score IS NOT NULL AND evaluator_configuration_id IS NOT NULL) OR (scoring_status != 'scored' AND score IS NULL))`
- When created in Section 32: `scoring_status="pending"`, `score=None`, `transcription=None`.

### 4.4 Data Isolation & Voice Privacy

- Files are stored in `services/api/storage/audio/{context_id}/{attempt_id}.{ext}`.
- Directory paths are generated using server-side UUIDs to prevent directory traversal or name collisions.
- Only the student who submitted the recording (or their authorized instructor during supervised evaluation) can retrieve their attempt records. Cross-student access is blocked.

---

## 5. Mobile User Experience & Accessibility

- **Curriculum-Linked Prompts**: Prompts clearly identify target language (`Tagalog / Filipino` vs `English`) with colored badges, phonetic guidance text, and curriculum context.
- **Recording Controls**:
  - High-visibility pulsating record indicator with active timer (`00:00` up to `01:00`).
  - Pause and Resume controls where supported.
  - Automatic recording termination upon reaching the 60-second limit.
  - Review mode with Play/Pause audio playback, elapsed review timer, and seek bar.
  - Discard/Re-record option to immediately purge unsatisfactory audio before upload.
  - Submit button with progress spinner and retry handling upon network failure.
- **Accessibility**:
  - Explicit `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint` on all interactive buttons.
  - High-contrast visual cues for recording state changes (accessible to colorblind learners).

---

## 6. Verification and Test Results

### 6.1 Backend Pytest Suite
Executed: `services/api/.venv/Scripts/python.exe -m pytest services/api/tests/test_pronunciation.py`
- Result: **13 passed, 0 failed in 3.37s**
- Coverage includes:
  - Magic byte binary inspection for WebM, WAV, OGG, and M4A.
  - Rejection of invalid binary payloads and spoofed text files.
  - Validation of maximum (10 MiB) and minimum (100 B) file bounds.
  - Duration lower bound (500 ms) and upper bound (60,000 ms).
  - Attempt creation with `scoring_status="pending"`, `score=None`, and `transcription=None`.
  - Student attempt history query isolation.
  - Language filtering (`tl` and `en`).

### 6.2 Full Backend Regression Suite (Sections 23–32)
Executed: `pytest test_progress.py test_pathway.py test_materials_and_notifications.py test_spaced_repetition_foundation.py test_sm2.py test_fsrs6.py test_fifakt.py test_pronunciation.py`
- Result: **79 passed, 0 failed in 4.34s**

### 6.3 Mobile TypeScript Typecheck
Executed: `npm --prefix apps/mobile run typecheck`
- Result: **Exit Code 0 (Clean, 0 errors)**

### 6.4 Node Client Integration Test
Executed: `node --test scripts/pronunciation.test.mjs`
- Result: **3 passed, 0 failed**
  - `validateActivities accepts well-formed response`
  - `validateActivities rejects missing fields`
  - `pronunciationAccess wraps runner correctly`

---

## 7. Modified & Created Files

### Backend:
- `services/api/app/modules/pronunciation/schemas.py`: DTO definitions for activities, submissions, and attempt histories.
- `services/api/app/modules/pronunciation/service.py`: Magic-byte inspection, file size/duration validation, storage writing, and activity seeding.
- `services/api/app/modules/pronunciation/router.py`: FastAPI endpoints for student pronunciation activities and multipart attempt submissions.
- `services/api/app/api/v1/router.py`: Mounted `/me/pronunciation` router.
- `services/api/tests/test_pronunciation.py`: 13 comprehensive unit and integration tests.

### Mobile:
- `apps/mobile/package.json` & `apps/mobile/package-lock.json`: Added `expo-av@^16.0.8`.
- `apps/mobile/app.json`: Added `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` Android permissions.
- `apps/mobile/src/services/api/client.ts`: Updated to support `FormData` multipart payloads without forcing JSON content-type.
- `apps/mobile/src/services/api/pronunciation.ts`: Typed pronunciation API client and runtime validation contracts.
- `apps/mobile/src/demo/demoData.ts`: Demo mode mock data and synthetic recording submission handler.
- `apps/mobile/src/session/provider.tsx`: Added `pronunciation` interface to session context.
- `apps/mobile/src/features/pronunciation/useAudioRecorder.ts`: Cross-platform recording hook (Web `MediaRecorder` + Native `Audio.Recording`).
- `apps/mobile/src/features/pronunciation/PronunciationPractice.tsx`: Accessible recording, playback review, and submission UI component.
- `apps/mobile/src/app/pronunciation.tsx`: Dedicated pronunciation practice screen with language filter tabs.
- `apps/mobile/src/components/navigation.tsx` & `apps/mobile/src/app/student.tsx`: Navigation routes and student dashboard shortcut.
- `scripts/pronunciation.test.mjs`: Test suite verifying client validation and runner wrapping.

### Documentation:
- `docs/PRONUNCIATION.md`: Complete architectural guide, audio specifications, and security policies.
- `docs/AI_INTEGRATION_PLAN.md`: Updated Section 32 lifecycle and boundaries.
- `docs/SECTION_32_REPORT.md`: This report.

---

## 8. Limitations & Section 33 Prerequisites

1. **Scoring Pipeline Pending**:
   - As mandated, speech recognition (ASR) and phoneme-level pronunciation scoring are not active in Section 32.
   - All attempts remain in `"pending"` status.
2. **Prerequisites for Section 33 (Multilingual Speech Recognition / ASR)**:
   - Specification and integration of acoustic/ASR engines for English and Tagalog (e.g. self-hosted Whisper or wav2vec2-based checkpoints).
   - Word error rate (WER) and phoneme alignment pipeline definition.
   - Asynchronous worker/queue architecture (e.g. Celery/Redis or background task processor) to process queued audio files without blocking FastAPI request threads.
   - Retention and auto-cleanup policies for audio files post-scoring.
