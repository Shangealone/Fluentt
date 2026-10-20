# FLUENTT — COMPREHENSIVE DEMONSTRATION GUIDE

**Version**: 1.0 (Section 39 Defense-Ready)  
**Target Audience**: Thesis Committee, Technical Evaluators, Peer Reviewers, and Demonstrators

---

## 1. Overview & System Topology

FLUENTT is designed as a three-tier distributed architecture:
1. **FastAPI Backend (`services/api`)**: Port `8000` (or `8001`). Exposes the REST API, owns authentication, transaction boundaries, spaced-repetition engines, audio validation, and research analytics.
2. **Next.js Admin Website (`apps/admin`)**: Port `3000`. Privileged web dashboard for curriculum authoring, question bank management, and researcher analytics/exports.
3. **Expo Mobile Application (`apps/mobile`)**: Port `8081` (Metro bundler / web preview / native Android/iOS). Serves both students and instructors via role-based navigation.
4. **PostgreSQL Database (`infra`)**: Port `5432` (or local mapped port e.g. `55432`). Database head `0013_learning_focus` with 63 tables.

```
       +-------------------------------------------------+
       |              PostgreSQL (Port 5432)             |
       +-------------------------------------------------+
                               ^
                               |
               +-------------------------------+
               |   FastAPI Backend (Port 8000)  |
               +-------------------------------+
                       ^               ^
                       |               |
     +-----------------+               +-------------------+
     |                                                     |
+----+---------------------+                     +---------+-------------------+
| Next.js Admin (Port 3000)|                     | Expo Mobile (Port 8081/Web) |
| (Curriculum, Research)   |                     | (Students, Instructors)     |
+--------------------------+                     +-----------------------------+
```

---

## 2. Prerequisites & Environment Setup

### 2.1 Software Prerequisites
- **Node.js**: v20+ LTS or v24+
- **Python**: v3.11+
- **PostgreSQL**: v15, 16, or 17 (or Docker for running `infra/compose.yaml`)
- **Git**

### 2.2 Quick Service Launch Sequence

Open three separate terminal windows:

#### Terminal 1: Database & Backend API
```powershell
# Navigate to API directory
Set-Location services/api

# Activate Python Virtual Environment
.\.venv\Scripts\Activate.ps1

# Ensure database migrations are up to date
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Verification*: Open `http://127.0.0.1:8000/api/v1/health` in your browser. Expect: `{"status":"healthy","database":"connected"}`.

#### Terminal 2: Administrator Web Portal
```powershell
# Navigate to Admin directory
Set-Location apps/admin

# Start Next.js development server
npm run dev
```
*Verification*: Open `http://localhost:3000` in your browser to view the administrative login / public diagnostic page.

#### Terminal 3: Mobile Application (Expo / Web Preview)
```powershell
# Navigate to Mobile directory
Set-Location apps/mobile

# Start Expo dev server (press 'w' in terminal for Web preview, or scan QR code via Expo Go app on Android)
npm start
```
*Verification*: Browser automatically opens `http://localhost:8081` showing the FLUENTT onboarding welcome screen.

---

## 3. Role-by-Role Demonstration Workflows

### 3.1 Student Workflow: Onboarding & Classroom Learning

1. **Launch App**: In Expo Web/Mobile (`http://localhost:8081`), click **Get Started**.
2. **Choose Role**: Select **School Student**.
3. **Pick Unique Username**: Enter an alphanumeric username (e.g., `maria_santos26`). Click **Check Availability** → **Create Account**.
4. **Session Token**: An opaque `flt_...` token is securely generated and saved into native SecureStore.
5. **Classroom Enrollment**:
   - The app prompts for a 6-digit class code.
   - Enter a code provided by your instructor (e.g., `104829`).
   - Click **Verify Code** to view class details, grade, and instructor name.
   - Click **Confirm Enrollment** to join the class.
6. **Adaptive Learning Focus**:
   - If not in a fixed class, the student selects their preferred topics and target language (Tagalog/English).
   - Set learning focus to **Tagalog Core Vocabulary & Grammar**.
7. **Complete an Assignment**:
   - Navigate to the **Assignments** tab.
   - Select an assigned task (e.g., *"Unit 1: Basic Greetings & Identification"*).
   - Answer the interactive items (Multiple Choice, True/False, Fill in the Blanks, Word Ordering).
   - Click **Submit Responses**.
   - Review receipt confirmation: the submission is recorded in `unscored-capture-v1` format.

### 3.2 Spaced Repetition Practice (Flashcards & Vocabulary)

1. Navigate to the **Spaced Repetition / Flashcards** tab.
2. Select a deck: **Tagalog Common Verbs**.
3. **Card Presentation**: The prompt / cue is displayed (*e.g., "Kumain"*). The answer remains hidden.
4. **Deliberate Reveal**: Click **Show Answer** to reveal the definition (*"To eat"*).
5. **Rate Recall**: Choose one of 4 ratings:
   - **Again (1)**: Blackout / forgotten.
   - **Hard (2)**: Recalled with significant effort.
   - **Good (3)**: Recalled with moderate effort.
   - **Easy (4)**: Instant, effortless recall.
6. **Telemetry & Interval Update**:
   - The selected spaced repetition engine (SM-2, FSRS-6, or FIFAKT) recalculates the item stability and schedules the next review date.

### 3.3 Pronunciation & Conversational AI Practice

1. **Pronunciation Module**:
   - Navigate to **Pronunciation Practice**.
   - Target phrase displayed: *"Magandang umaga po!"*
   - Click **Record Audio** (or upload sample WAV).
   - Speak into the microphone and click **Stop**.
   - View phoneme breakdown and Goodness of Pronunciation (GOP) score:
     - Overall Accuracy: `88%`
     - Feedback: Clean articulation on bilabial plosives /p/ and velar nasal /ng/.
2. **Guided AI Conversation**:
   - Navigate to **Conversation Practice**.
   - Scenario: *"Ordering food in a Carinderia in Manila"*.
   - AI Tutor opens: *"Magandang araw! Ano po ang gusto ninyong kainin ngayon?"*
   - Student responds by typing or audio input: *"Gusto ko po ng adobo at kanin."*
   - AI Tutor evaluates grammatical case markers (`ng` vs `ang`), validates response coherence, and advances the dialogue state machine.

### 3.4 Instructor Workflow: Classroom & Assessment Management

1. **Create Instructor Account**:
   - On the welcome screen, select **Instructor**.
   - Enter username (e.g., `guro_reyes`).
2. **Create a Classroom**:
   - Navigate to **Classrooms** → **Create New Class**.
   - Name: *"Grade 7 - Mabini Tagalog Core"*.
   - Grade: `Grade 7`, Subject: `Filipino`.
   - Click **Generate Class**. A unique 6-digit code (e.g., `839201`) is issued.
3. **Manage Assignments**:
   - Click **Create Assignment Draft**.
   - Attach lessons from the published curriculum hierarchy.
   - Add questions from the question bank.
   - Set instructions and click **Publish Assignment**.
4. **Monitor Student Submissions**:
   - Open **Class Dashboard** → **Submissions**.
   - View real-time submission rates, completed captures, and pending reviews.
5. **Release Results**:
   - Click **Run Objective Grading** to score completed captures using `objective-exact-v1`.
   - Click **Release Results to Students**. Pinned run totals become visible on the students' progress screens.

### 3.5 Researcher & Administrator Workflow (Next.js Portal)

1. Open `http://localhost:3000` in your browser.
2. Navigate to **Research Dashboard** (`/admin/research` or `/research`).
3. **Select Active Study Protocol**:
   - Select study: `EXP-2026-TAG-01` (*"Comparative Efficacy of FSRS-6 vs SM-2 vs FIFAKT in Secondary Tagalog Acquisition"*).
4. **CONSORT Participant Flow**:
   - View live enrollment pipeline:
     - Target Sample Size ($N = 120$)
     - Assented & Consented Participants ($N = 104$)
     - Allocated to Control [SM-2] ($n = 35$)
     - Allocated to Experimental [FSRS-6] ($n = 35$)
     - Allocated to Experimental [FIFAKT] ($n = 34$)
     - Active in Intervention ($n = 98$)
     - Completed Post-Test ($n = 92$)
5. **Descriptive Analytics & Learning Gains**:
   - Inspect comparative table of Pre-Test, Level Milestones, and Post-Test scores.
   - Inspect Hake's normalized gain ($g$) and delayed retention decay.
   - Note small-cell warning flags ($N < 5$) if viewing filtered subgroups.
6. **Export De-Identified Data**:
   - Click **Export Longitudinal Participants CSV**.
   - Click **Export Assessment Attempts CSV**.
   - Click **Export Spaced Repetition Review Telemetry CSV**.
   - Open downloaded CSV in Excel: verify that student identities are masked as `P-TAG-XXXXXX` and formula injection characters are sanitized.

---

## 4. Graceful Fallback & Offline Modes

- **Mock ASR / Offline Speech**: If an external speech recognition API key is omitted, the backend automatically uses its built-in acoustic similarity heuristic provider. Demonstrations never fail due to lack of cloud API credits.
- **Mock AI Conversational Agent**: If external LLM credentials are absent, the system uses the deterministic rule-based dialogue tree to simulate realistic pedagogical responses.
- **Synthetic Research Fixtures**: The research analytics dashboard includes a **Generate Synthetic Research Cohort** utility to demonstrate CONSORT visualizations and CSV exports without needing to manually register 100+ test students.
