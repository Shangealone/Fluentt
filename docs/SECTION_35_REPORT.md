# FLUENTT — SECTION 35 REPORT: AI CONVERSATION PRACTICE

**Date**: 2026-10-20  
**Status**: COMPLETE & VERIFIED  
**Roles Involved**: Senior Conversational AI Engineer, React Native Engineer, FastAPI Engineer, Language Learning UX Architect, AI Safety/Privacy Engineer, QA Engineer.

---

## 1. Executive Summary

Section 35 delivers a controlled, curriculum-linked conversational language practice system for FLUENTT. The feature is explicitly engineered as an educational role-play tool bounded to approved scenarios in Tagalog and English, rather than an unconstrained general-purpose chatbot. It directly unifies the audio capture (Section 32), multilingual speech recognition (Section 33), and pronunciation assessment (Section 34) pipelines into a cohesive conversational experience.

### Core Architecture & Educational Guardrails:
1. **Curriculum-Linked Scenarios (`conversation_topics`)**:
   - Preserved frozen schema and constraint `ck_conversation_topics_language` ('tagalog', 'english').
   - Five published curriculum scenarios:
     - *Pagpapakilala sa Sarili* (Grade 7 Filipino): Introduction with polite markers (`po`/`opo`).
     - *Pamimili sa Pamilihan* (Grade 8 Filipino): Fruit/vegetable pricing and respectful bargaining.
     - *Pagtatanong ng Direksyon* (Grade 8 Filipino): Locational prepositions and city landmarks.
     - *School Orientation & Friends* (Grade 7 English): Campus life, classes, and peer introductions.
     - *Ordering at a Local Cafe* (Grade 9 English): Polite ordering, customization, and transactions.
2. **Defensive Safety & Injection Resistance (`SafetyGuard`)**:
   - Blocks prompt injection attacks (e.g. "ignore previous instructions", "system prompt", "DAN mode", "jailbreak", shell execution).
   - Filters sensitive personally identifiable information (PII) including credit card numbers, Philippine mobile numbers, and password leaks.
   - Off-topic inputs trigger in-character educational deflections back to the target scenario.
3. **Dual Input Mode (Spoken & Typed)**:
   - Learners can type text responses or record spoken responses using the microphone.
   - Spoken responses are transcribed via Section 33 Multilingual Whisper ASR and scored via Section 34 GOP pronunciation evaluation.
   - Spoken turns display pronunciation scores (`🎯 Score: 92/100`), while typed turns explicitly display `None` to prevent misleading feedback.
4. **Formative Feedback vs. Objective Grading**:
   - Every AI assistant turn delivers encouraging formative linguistic feedback, highlighting polite markers (`po/opo`), vocabulary usage, and phrasing suggestions.
   - Displays explicit disclaimers that conversation feedback is formative and does not constitute certified human-level evaluation or official DepEd grades.
5. **Database Integrity & Retention Enforcement**:
   - Preserves frozen 63 tables under Alembic head `0013_learning_focus`.
   - Conforms strictly to database constraint `ck_conversation_sessions_approved_retention` and PostgreSQL trigger `fluentt_guard_conversation_retention`:
     `retain_messages = True`, `retention_policy_version = "edu-retention-v1"`, and `delete_messages_after = now + 30 days`.
   - Max turn limit enforced (20 turns per session).

---

## 2. Technical Implementation & Modified Files

### Backend Components (`services/api`)
1. **`services/api/app/modules/conversation/schemas.py`**:
   - Defined `ConversationTopicDTO`, `ConversationTopicsResponse`, `ConversationSessionDTO`, `ConversationMessageDTO`, `SendMessageRequest`, `SendMessageResponseDTO`, and `ConversationSessionSummaryDTO`.
   - Defined `FormativeLanguageFeedbackDTO` with politeness detection, topic relevance, and educational uncertainty notices.
2. **`services/api/app/modules/conversation/provider.py`**:
   - `SafetyGuard`: Regex-based prompt injection detection and PII filtering.
   - `EducationalDialogueEngine`: Local deterministic dialogue state engine for Tagalog and English scenarios with vocabulary hint recognition, politeness tracking, and scenario progression.
   - `ConversationProviderRegistry`: Abstract provider interface supporting local heuristics (`fluentt-dialogue-v1.0`, `simulated=True`) and replaceable external models.
3. **`services/api/app/modules/conversation/service.py`**:
   - `get_or_create_conversation_model_configuration`: Manages `ModelVersion(task="conversation_agent")` and `ModelConfiguration`.
   - `seed_conversation_topics_if_empty`: Automatically populates the 5 standard published scenarios if missing.
   - `get_eligible_conversation_topics` and `get_conversation_topic`: Reads published scenarios.
   - `start_conversation_session`: Initiates bounded session with approved retention policy and delivers initial greeting.
   - `send_conversation_message`: Processes user input (text or audio attempt ID), invokes ASR/GOP if audio, runs provider reply, increments sequences, and commits conversation turns.
   - `end_conversation_session`: Concludes session and generates formative strengths and recommendations.
4. **`services/api/app/modules/conversation/router.py`**:
   - Protected FastAPI router (`/me/conversation`) with rate-limiting and session transport checks.
5. **`services/api/app/api/v1/router.py`**:
   - Registered `conversation_router`.
6. **`services/api/tests/test_conversation_practice.py`**:
   - 13 comprehensive unit tests covering safety guards, dialogue turns, model configuration, session lifecycle, audio linking, and student authorization.

### Mobile Client Components (`apps/mobile`)
1. **`apps/mobile/src/services/api/conversation.ts`**:
   - TypeScript API client and runner wrapper for topics, sessions, messaging, and summaries.
2. **`apps/mobile/src/demo/demoData.ts`**:
   - Mock conversation topics and session store for demo and preview modes.
3. **`apps/mobile/src/session/provider.tsx`**:
   - Exposed `conversation: ConversationAccess` on `useSession()`.
4. **`apps/mobile/src/features/conversation/ConversationPractice.tsx`**:
   - Three-phase interactive component:
     - **Topic Selection**: Filters by Tagalog/English, showing persona, goal, and vocabulary chips.
     - **Active Chat**: Persona headers, turn counter, message bubbles, formative feedback cards, text input, and voice recording with Section 32 audio recorder integration.
     - **Session Summary**: Formative completion card with key strengths and recommended practice areas.
5. **`apps/mobile/src/app/conversation.tsx`**:
   - Expo route registered for conversation practice.
6. **`apps/mobile/src/app/student.tsx` & `apps/mobile/src/components/navigation.tsx`**:
   - Integrated quick navigation links and dashboard cards.
7. **`scripts/conversation.test.mjs`**:
   - Node contract test verifying full client dialogue lifecycle.

---

## 3. Verification & Testing

### 3.1 Backend Pytest Verification
Command:
```powershell
.\.venv\Scripts\pytest.exe tests/test_conversation_practice.py tests/test_pronunciation.py tests/test_pronunciation_assessment.py tests/test_speech_recognition.py -v
```
**Results**:
- **50 passed in 2.04s** (0 failed).
- Specifically `test_conversation_practice.py`:
  - `test_safety_guard_prompt_injection_detection`: PASSED
  - `test_safety_guard_pii_detection`: PASSED
  - `test_safety_guard_safe_inputs`: PASSED
  - `test_educational_dialogue_engine_tagalog_politeness_and_relevance`: PASSED
  - `test_educational_dialogue_engine_english_cafe_ordering`: PASSED
  - `test_educational_dialogue_engine_safety_deflection`: PASSED
  - `test_get_or_create_conversation_model_configuration_mocked`: PASSED
  - `test_get_eligible_conversation_topics`: PASSED
  - `test_start_conversation_session_success`: PASSED
  - `test_send_conversation_message_text_success`: PASSED
  - `test_send_conversation_message_with_spoken_audio`: PASSED
  - `test_send_conversation_message_rejects_cross_student`: PASSED
  - `test_end_conversation_session_summary`: PASSED

### 3.2 Mobile Node Contract Tests
Command:
```powershell
node --test scripts/conversation.test.mjs scripts/pronunciation.test.mjs scripts/materials.test.mjs scripts/pathways.test.mjs scripts/reviews.test.mjs
```
**Results**:
- **19 passed in 291ms** (0 failed).

### 3.3 Mobile TypeScript Typecheck
Command:
```powershell
npm --prefix apps/mobile run typecheck
```
**Results**:
- **Exit Code 0** (0 TypeScript errors).

---

## 4. Limitations & Ethical Notice

1. **Simulated Dialogue Engine**: In offline/default environments, dialogue is driven by `EducationalDialogueEngine` (`simulated: True`), providing reliable, deterministic, zero-cost practice without third-party data egress.
2. **Formative Guidance Only**: Conversation responses and feedback support conversational willingness and fluency; they do not claim official DepEd mastery certification.
3. **Dialect and Idiom Boundaries**: Scenarios adhere to standard Tagalog/Filipino and Philippine English school registers. Regional dialects and informal slang are guided toward standard academic conversational forms.

---

## 5. Prerequisites for Section 36

1. Audio-visual avatar integration or natural TTS playback if spoken output is authorized.
2. Multimodal scene context or interactive visual props for situational dialogues.
3. Expanded scenarios aligned with Senior High School Track electives.
