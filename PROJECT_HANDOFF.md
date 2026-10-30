# FLUENTT Project Handoff

**Updated:** 2026-10-30 (Asia/Manila)  
**Purpose:** Current product direction, project status, UI workflow, and open work. Detailed technical contracts and dated evidence stay in the linked project documents.

> This is a living summary, not a claim that every feature is production-ready. Use the latest approved decision and its evidence when an older milestone note differs. The localhost app and the tracked root app are separate codebases.

## Current snapshot

- The app currently previewed at **http://localhost:8082** is under **F:/FLUENTT/.local-version-2**. Its API is **http://localhost:8001** and administrator site is **http://localhost:3000**.
- Git branch: **fluentt/main**, four commits ahead of origin at this snapshot. There are many uncommitted and untracked changes across app source, docs, generated APKs, and caches. Preserve them; do not reset, clean, or assume an APK is a current release.
- The user confirmed Okta administrator sign-in reaches the local dashboard. The dashboard still showed “Ask your operator” for curriculum and question-bank access. Successful sign-in does not grant those permissions.
- The latest instructor Overview redesign is implemented. The user performs hands-on functionality checks. Functional/system tests were not run for that UI implementation.
- Content publication, trained speech models, and human research are not ready merely because related code or plans exist.

## Product direction

FLUENTT is a mobile-first English and Tagalog learning app for personal learners and school classrooms. Many expected respondents are under 18, so use familiar words, short instructions, clear choices, and age-appropriate activities.

- **Personal learner:** chooses English or Tagalog and a starting practice preference: Easy, Medium, or Challenging. This is not a measured proficiency rating.
- **Student:** joins a teacher’s class. New Student registration requires a valid six-digit class code before account creation and enrollment are committed.
- **Teacher/instructor:** creates and manages classes and can build class assignments from eligible published lessons and questions.
- **Content administrator:** manages the shared curriculum/question bank and publishes reviewed content. This is separate from a teacher’s class and assignment access.

A future teacher-owned lesson authoring, editing, and publishing capability was requested, but is not implemented; its ownership, review, and publication rules still need design.

Learner accounts use the shared sign-in/create-account flow. Browser sessions use server-issued HttpOnly cookies; Android uses secure device storage. Administrator access is separate and uses OIDC/MFA. Do not add username-only account recovery, role conversion, public demo shortcuts, or browser bearer-token storage.

## Two codebases: keep their status separate

| Path | Role | Status |
| --- | --- | --- |
| **F:/FLUENTT/.local-version-2** | Local app used for the current localhost UI work: Expo under apps/mobile, API under services/api, admin under apps/admin. Local PostgreSQL is an isolated cluster on port 55432; its documentation records migration 0018_personal_history. | Current UI/auth/class workflow. |
| **F:/FLUENTT/mobile**, **backend**, **speech-workers** | Separate tracked root app and speech integration. | The approved Wav2Vec2/WavLM integration is implemented here, but learner capabilities are off pending real model artifacts and validation. |

The speech plan targets the tracked root app and did not port the .local-version-2 app. Therefore the current localhost app does not automatically include that model integration. Before APK release, choose the final app tree and plan how the approved UI/account work and speech work meet in that one target. Do not merge either candidate branch wholesale; review and integrate specific changes.

## Feature status

### Accounts and classroom

The local app has shared sign-in/account creation, class-code-first Student signup, class joining for existing students, instructor class creation/details, and class-specific routes. The local PostgreSQL setup is isolated; do not reset it or assume accounts from an older database exist here.

Assignment draft, publication, student capture, results, and instructor monitoring paths exist. The assignment builder depends on eligible published curriculum/question records. A previous Grade 7 class binding/publication was explicitly put on hold; do not treat it as completed.

### UI redesigns

The current local app has redesigned Welcome and personal Home, unified account/onboarding, language and starting-level setup, Join a class, Learn/question practice, instructor Home, Create/Edit class, Class details, Class assignments, instructor Overview, Notifications, Messages, and Account & settings. The Overview includes class chooser, student/assignment lists, student history, assignment detail, summary counts, filters, and loading/empty/error states.

Account & settings includes personal learning preference editing, role-specific quick guides, About, and sign-out confirmation. Device reading preferences follow system settings by default; explicit text-size, higher-text-contrast, and reduced-motion overrides are stored separately from authentication and connected to shared text/input/layout primitives. See [ACCOUNT_SETTINGS.md](docs/ACCOUNT_SETTINGS.md). This update was implemented without app tests, typecheck, lint, or APK execution at the user's request; native behavior and visual results require hands-on review.

The refreshed visual system uses logo option B (open-dialogue mark), Plus Jakarta Sans, warm off-white, dark green text, coral actions, pastel illustrations, rounded cards, and a consistent line-icon style. Different concepts should have distinct but visually matching icons.

### Lesson content

Client-supplied books and online readers are references and inspiration, not FLUENTT’s full syllabus. The team is building original lessons. Source links, learner ranges, permission notes, and proposed lesson groupings are in **[CONTENT_SOURCE_REGISTER.md](docs/CONTENT_SOURCE_REGISTER.md)**.

The user confirmed that YouTube transcripts may be reused but video audio may not. Verify transcript wording/timestamps and retain attribution before adapting. No permission for video images or footage has been supplied.

An original English grammar pilot with three lessons and 37 activities/questions has been implemented in source, along with a draft-only importer and separate local review page. No import or publication into the active catalog has been confirmed. The importer needs a content administrator with curriculum/question-editor permissions; Okta login alone may not provide these. See **[PILOT_IMPLEMENTATION.md](docs/PILOT_IMPLEMENTATION.md)**.

### Speech, pronunciation, and offline use

The agreed model direction is **Wav2Vec2 for speech recognition** and **WavLM for completed-recording pronunciation assessment**. In the tracked root app, API contracts, isolated workers, and mobile capture are implemented. No trained model weights are included, normal learner access remains disabled, and candidate output is not validated scoring. Current documented candidates are English-only; Tagalog requires its own supported model/decoder and held-out evaluation.

The .local-version-2 app’s offline speech setup is a separate on-device flow. Device/browser services vary; the tested friend’s Android device did not offer a downloadable offline Tagalog language. This does not mean Wav2Vec2/WavLM are running in that app.

The broader goal is online features where possible and limited offline learning. Exact offline access still needs definition. The root app design keeps cached lessons/review usable offline while model speech requires a reachable API. Do not promise full offline speech.

## UI process and implementation rules

1. Review the current screen’s routes, permissions, data, and behavior.
2. Make a Canvas mockup in the approved Fluentt style, including relevant states.
3. Let the user review and request visual adjustments. Implement only after approval.
4. Keep the change presentational unless behavior changes are separately requested; preserve routes, APIs, auth, and server rules.
5. Show the finished screen on localhost when requested. The user usually handles hands-on functional testing. Do not run system/functionality tests when asked to leave testing to them.

Keep learner-facing language short and nontechnical. Use **practice** spelling. Design for 320px/390px widths, enlarged text, keyboard navigation, clear empty/error/retry states, labeled icon-only buttons, and at least 44px touch targets.

Keep learning feedback honest: recognized-word matching is not pronunciation scoring. Never infer a score from matches, display an empty “/100”, or fabricate a result. Show only real supported output or a clear unavailable state. Normal runtime demo scoring has been removed.

## Open work and recommended order

1. **User’s localhost review:** let the user test the redesigned screens and report changes; make focused follow-up fixes.
2. **Content administrator:** complete/confirm curriculum and question-bank permissions for the mapped Okta administrator.
3. **Pilot lessons:** review original lesson content, curriculum placement, answer keys, and source attribution; import as drafts; review and explicitly publish. Then verify the learner catalog contains eligible content.
4. **Teacher assignment flow:** when requested, resume the held Grade 7 class/assignment work using real eligible content; bind the class subject and publish only after the user reopens that scope.
5. **Remaining UI pages:** candidate follow-ups include assignment builder/results, class edit, messages/notifications, and remaining student screens. These are candidates, not blanket approval.
6. **Speech readiness:** settle the final app tree; source permitted datasets/artifacts; evaluate English and Tagalog recognition and scoring separately; resolve model/scorer licenses; measure memory, latency, failures, and up to 30 concurrent users. Keep capabilities disabled until validated.
7. **Android release:** build and test a native APK from the chosen target after integration and device/API configuration are ready. Current untracked APKs are not confirmed release builds.
8. **Teacher lesson authoring and offline scope:** design role boundaries and specify what content works offline before implementing those larger capabilities.

## Adaptive-practice research track

The repository includes documented SM-2, FSRS-6, and FIFAKT scheduler/knowledge-tracing work. These algorithms and their software checks are separate from evidence that they improve learning in a real classroom. The latest Section 38B evidence still marks the SM-2-versus-ESR study comparison blocked: the current ESR identity uses a simulated FIFAKT prediction, not an approved trained/calibrated artifact. Do not claim measured student benefit or comparative superiority. See [VOCABULARY.md](docs/VOCABULARY.md), the Section 29–31 reports, and [Section 38B final evidence](docs/SECTION_38B_FINAL_REPORT.md).

## Research readiness

The proposed evaluation is two class sections of about 30 students each, likely on separate days. This is a planning estimate, not participant authorization or a finalized study. **Human data collection is not ready.** Required gates include an approved protocol, school/site and ethics authorization, minor/guardian permission and student assent rules, finalized instruments and schedule, privacy/retention and analysis plans, and a verified deployment. Do not train/tune models on evaluation participants; freeze app/model versions before the first group. Keep research data distinct from ordinary class activity.

See **[SECTION_38B_FINAL_REPORT.md](docs/SECTION_38B_FINAL_REPORT.md)** and the Section 38B reports for exact research blockers and evidence.

## Local operation

From **F:/FLUENTT/.local-version-2**, start each service in its own terminal:

- API and its existing local database: **.\scripts\start.ps1 api**
- Mobile web preview: **.\scripts\start.ps1 mobile**
- Administrator site: **.\scripts\start.ps1 admin**

Ports are 8001, 8082, and 3000. API health is **http://localhost:8001/api/v1/health**. Avoid starting duplicate copies. For a phone, use the computer’s reachable LAN address; an Android emulator commonly uses **10.0.2.2:8001**. Production requires HTTPS and explicit allowed origins.

Keep ignored .env files, database credentials, Okta secrets, session keys, model artifacts, and user data private. Keep build caches/artifacts on F: and out of source commits unless intentionally preparing a distributable build.

## Project records

- Product decisions: **[DECISIONS.md](docs/DECISIONS.md)**
- App/account setup: **[README.md](README.md)** and **[UNIFIED_ACCOUNTS.md](docs/UNIFIED_ACCOUNTS.md)**
- Classes/enrollment/assignments: **[CLASSROOMS.md](docs/CLASSROOMS.md)**, **[ENROLLMENT.md](docs/ENROLLMENT.md)**, **[ASSIGNMENTS.md](docs/ASSIGNMENTS.md)**
- Monitoring/results: **[INSTRUCTOR_MONITORING.md](docs/INSTRUCTOR_MONITORING.md)** and **[RESULTS_AND_FEEDBACK.md](docs/RESULTS_AND_FEEDBACK.md)**
- Content: **[CONTENT_SOURCE_REGISTER.md](docs/CONTENT_SOURCE_REGISTER.md)** and **[PILOT_IMPLEMENTATION.md](docs/PILOT_IMPLEMENTATION.md)**
- Learning/speech: **[PERSONAL_LEARNING.md](docs/PERSONAL_LEARNING.md)**, **[PRONUNCIATION.md](docs/PRONUNCIATION.md)**, **[WHOLE_PHRASE_PRONUNCIATION.md](docs/WHOLE_PHRASE_PRONUNCIATION.md)**
- Root-app model work: **[approved design](../docs/superpowers/specs/2026-10-29-speech-model-integration-design.md)** and **[implementation verification](../docs/development/speech-model-integration-verification.md)**
- Research gates: **[RESEARCH.md](docs/RESEARCH.md)** and **[Section 38B final report](docs/SECTION_38B_FINAL_REPORT.md)**
- Database/local evidence: **[MIGRATIONS.md](docs/MIGRATIONS.md)** and **[LOCAL_VERIFICATION_REPORT.md](docs/LOCAL_VERIFICATION_REPORT.md)**

This handoff is the quick overview; it does not replace detailed contracts, approve research collection, grant content permissions, enable speech scoring, or authorize APK release.

