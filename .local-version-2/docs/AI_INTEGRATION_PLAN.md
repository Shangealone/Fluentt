# AI and adaptive learning integration plan

No models, schedulers, training runs, datasets or validated performance exist in Section 00. These are backend-only interfaces. Screens consume versioned domain contracts and do not select vendors or experimental conditions.

## Common result envelope

Every model operation records request_id, task, language_track, schema_version, model_version_id, configuration_version, simulated, status, started_at, completed_at and task result or safe error. Store sanitized parameters, artifact/library versions and research context where applicable. Never record secrets. Simulated responses must be labeled in API data, UI, analytics and exports, and excluded from actual experiment analyses. Production research must reject simulated providers.

## Interfaces (conceptual, not code)

| Interface | Input | Output and constraints |
|---|---|---|
| Scheduler.schedule | immutable previous state, recall outcome, server event time, item/context, frozen config | next state, next due time, implementation/config version; deterministic replay where possible |
| ForgettingPredictor.predict | approved learning history/features, prediction time, language, model/config version | prediction, calibration/provenance and unavailable status; no automatic scheduling side effects |
| SpeechRecognizer.transcribe | private audio handle, language hint, reference context, model config | transcript, detected language, optional confidence/segments; confidence only if meaningful for provider |
| PronunciationEvaluator.evaluate | private audio, reference text/audio, explicit target language, config | supported metrics, feedback, validity scope, unavailable/unsupported status; independent of transcription |
| ConversationProvider.reply | allowed topic, language, minimal learner context, approved conversation history, config | assistant text, learning feedback, finish/error metadata and version |

Providers are selected by backend configuration and capability checks. Mock implementations return clearly simulated fixtures without downloads. Contract tests cover unsupported language, malformed output, timeouts, retry limits and version recording. AI outputs are untrusted data and never authorize users or database actions.

## Scheduling research

SM-2 (sm2-classic-v1) is implemented in Section 29 as the control scheduler. FSRS-6 (fsrs-6-reference-v1) is implemented in Section 30 with the verified 21-parameter specification and power forgetting curve as the foundation for ESR. Schedulers operate through the shared Section 28 interface against immutable review history and versioned configurations.

FIFAKT and Enhanced Spaced Repetition (ESR) are implemented in Section 31 as `fifakt-esr-v1` combining FSRS-6 DSR foundations with a documented, leakage-guarded knowledge-tracing feature pipeline (`extract_features_from_event_history`) and a simulated reference adapter (`fifakt-simulated-v1`). The ESR stability fusion rule strictly clamps adjustments to [0.80, 1.25], guarantees lapse stability non-expansion (alpha_eff <= 1.0 on 'again'), and provides safe fallback to base FSRS-6 on inference failure. In accordance with project instructions, because no empirical training weights or datasets are present in the repository, the model is explicitly labeled with simulated=True; no empirical accuracy, DepEd endorsement, or comparative superiority is claimed. See SECTION_31_REPORT.md.


Lock condition, scheduler implementation/configuration and item set per protocol. Preserve previous/next state and event order. No silent fallback from ESR to SM-2 or from a real provider to mocks in research. Pause/mark failed activity if the locked provider is unavailable; an approved protocol amendment is required for substitutions.

## Speech and pronunciation

Section 32 implements the genuine learner audio recording workflow, cross-platform audio capture (expo-av on native, MediaRecorder API on web), binary magic-byte audio validation, bounded upload handling, and private local storage.

Section 33 implements genuine multilingual automatic speech recognition (ASR) using the Multilingual Whisper architecture (`whisper-multilingual-v1` / `openai/whisper-base`, MIT License) on a private backend. It supports English (`en`) and Filipino/Tagalog (`tl`) as well as bilingual code-switching ("Taglish"). Audio is deterministically preprocessed, validated against duration limits (500ms to 60,000ms), and inspected for silence/zero-energy signals. Output provides traceable raw transcripts, normalized transcripts, language detection, and token-level word timestamps. When local weights are not initialized in lightweight environments, the deterministic `whisper-simulated-v1` adapter operates with `simulated: True`. Crucially, speech-to-text transcription is strictly distinguished from pronunciation evaluation: a transcript alone is not a pronunciation score. Phoneme-level pronunciation scoring and grading remain reserved for Section 34.

Upload and Recognition Lifecycle (Sections 32 & 33 implemented):
1. Client audio capture with live audio level, duration bounds (0.5s to 60s), and playback preview.
2. Direct multipart upload to `POST /api/v1/me/pronunciation/attempts` with active session authentication.
3. Server-side binary inspection (WebM `\x1a\x45\xdf\xa3`, WAV `RIFF`, OGG `OggS`, MP4/M4A `ftyp`, AAC `\xff\xf1`/`\xff\xf9`).
4. Strict size limit enforcement (100 B to 10 MiB) and duration bounds (500ms to 60,000ms).
5. Immutable attempt persistence with `PronunciationAttempt` record (`scoring_status="pending"`, `score=None`, `transcription=raw_transcript`).
6. Multilingual ASR processing via `whisper-multilingual-v1` with language routing (`tl`/`en`), silence detection, and token alignment.
7. Dedicated idempotent endpoints: `POST /api/v1/me/pronunciation/attempts/{attempt_id}/transcribe` and `GET /api/v1/me/pronunciation/attempts/{attempt_id}/transcription`.
8. Secure storage in private directory (`services/api/storage/audio/{context_id}/{attempt_id}.{ext}`) outside web root.
9. Strict student ownership and membership isolation; zero cross-learner exposure and zero public accessibility.
10. Complete separation between ordinary classroom practice recordings and research recordings. No external cloud or third-party AI transmission without explicit institutional review board (IRB) and parental/student consent.

## Conversation Practice (Section 35 Implementation)

Section 35 implements controlled, curriculum-linked conversational language practice with educational AI personas, multi-turn dialogue state tracking, safety guards, and formative linguistic feedback:

1. **Curriculum-Linked Scenarios (`conversation_topics`)**:
   - Preserved frozen schema and constraint `ck_conversation_topics_language` ('tagalog', 'english').
   - Scenarios include: *Pagpapakilala sa Sarili* (Grade 7 Filipino), *Pamimili sa Pamilihan* (Grade 8 Filipino), *Pagtatanong ng Direksyon* (Grade 8 Filipino), *School Orientation & Friends* (Grade 7 English), and *Ordering at a Local Cafe* (Grade 9 English).
   - Scenarios define personas, pedagogical goals, and target vocabulary hints.

2. **Safety Guards & Prompt Injection Defense (`SafetyGuard`)**:
   - Rejection and deflection of prompt injection vectors (`ignore previous instructions`, `DAN`, `jailbreak`, system prompt leaks, shell commands, script tags).
   - PII filtering: detects and rejects credit card numbers, Philippine mobile numbers, and password disclosures.
   - Out-of-bounds queries trigger character-consistent educational deflections back to the scenario topic.

3. **Dialogue & Provider Integration (`ConversationProviderRegistry`)**:
   - Default local engine (`EducationalDialogueEngine`): deterministic, privacy-guaranteed, local heuristic state machine with Tagalog politeness detection (`po`/`opo`, `salamat`), vocabulary recognition, and authentic scenario replies.
   - Provider interface supports replaceable external models (`FLUENTT_LLM_API_KEY`) with token bounds (150 tokens/turn), strict context limits, and timeout protection (8s).
   - Traceability: recorded with `model_version="fluentt-dialogue-v1.0"`, `simulated=True`.

4. **Speech & Pronunciation Synergy (Sections 32–34 Integration)**:
   - Learners can respond via text or spoken audio.
   - Spoken responses reuse Section 32 audio capture, Section 33 Whisper ASR, and Section 34 GOP evaluation.
   - Pronunciation scores are displayed only for spoken inputs and are never fabricated for typed text.

5. **Approved Data Retention & Boundaries**:
   - Satisfies database check constraint `ck_conversation_sessions_approved_retention` and trigger `fluentt_guard_conversation_retention`:
     `retain_messages = True`, `retention_policy_version = "edu-retention-v1"`, `delete_messages_after = now + 30 days`.
   - Max turn limit enforced (20 turns per session).
   - LLM feedback is strictly formative and never used for objective assignment grading or formal academic certification.

## Evaluation gates

1. Obtain authoritative artifacts and licensing at implementation time; document exact versions.
2. Use synthetic adapter fixtures for engineering, clearly separated from research evidence.
3. Evaluate task/language validity with approved data and rubrics; record limitations and missing results.
4. Freeze protocol, content, model/config and scheduler versions before participant activity.
5. Reproduce exports and scheduler trajectories from retained versioned events without identity mapping.

Unresolved: approved datasets, FIFAKT reproduction/training, ESR fusion, Tagalog pronunciation validity, provider selection, resource budgets and ethics/data retention. These are dependencies, not completed research.
