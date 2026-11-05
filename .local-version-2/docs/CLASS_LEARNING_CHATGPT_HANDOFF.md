# FLUENTT Class Learning — Current Implementation Handoff
Snapshot: 5 November 2026

Use this as project context. Distinguish implemented source, isolated automated evidence, the running local preview, and the older online/APK builds. Do not describe them as the same release.

## 1. Project and purpose

FLUENTT is an adaptive English/Tagalog learning system for a school/client. The planned main research contribution is Enhanced Spaced Repetition using FSRS-6 plus FIFAKT, compared with standalone FSRS-6. Speech practice and conversational support are supporting features.

The current demonstration is classroom-focused: Student, Teacher and separately authenticated Administrator. Personal Learning signup is hidden. Existing personal accounts and history are retained; accounts were not deleted or converted.

## 2. Exact version and application

Repository: https://github.com/BlackKaiser1121/FLUENTT
Saved branch: version-8
Saved commit: 81f3f54f5e578d883ce1932e6465d9da20a44e9c
Version-5 source: d49a23919e05290b0eb3cf7b81c888970f1f3cdc

Actual combined app:
C:/Users/shang/Desktop/Fluent/versions/fluentt-version5-combined/.local-version-2

Use apps/mobile, apps/admin and services/api inside that directory. The repository also contains another mobile/backend tree; do not edit or launch it by mistake.

Version 8 contains the version-5 combination and the guarded Class Learning research workflows. The subsequent class-only welcome/signup presentation, teacher-form regression and preview notes are local uncommitted changes, not yet included in the remote version-8 commit.

## 3. Running version versus old version

Correct local preview: http://127.0.0.1:8084/
Its API: http://127.0.0.1:8004/

The earlier localhost:8083 app used fluentt-groupmate/.local-version-2. Its class form still requested a grade, which exposed the running-version mismatch. Renaming a button in the combined source did not update that older app.

The correct preview uses a separate local development database through migration 0027_parallel_test_workflows. It contains the committed administrator library: 45 lessons and 371 questions. Those counts describe imported content, not validated curriculum, active classroom assignments or learning achievement.

Supabase accounts were not copied. One generated synthetic teacher/class was created for verification; users should create local test accounts for this preview. Supabase was last inspected read-only at migration 0018_personal_history and was not upgraded.

Older online services and Android APKs exist, but they were not redeployed/rebuilt with these latest changes. Their current feature availability is not established by the local tests.

## 4. Entry, accounts and class creation

Welcome offers Class Learning, Teach a class and Sign in. There is no advertised Personal Learning signup, even if an older backend offers that registration role.

Class Learning starts the school-student signup flow. A student must verify the teacher's six-digit class code before school account creation/enrollment. Joining a class never enrolls the student in research.

Teacher signup uses username, password and confirmation. It does not ask for grade level. Teacher class creation asks for class name, optional Beginner/Intermediate/Advanced proficiency, English/Tagalog language and optional description. The proficiency label comes from the client's external assessment; FLUENTT does not calculate placement from practice scores.

Legacy grade fields remain in historical storage. Their presence does not mean the UI should show a grade selector. Subject and learning language remain separate concepts.

Browser authentication uses server-issued HttpOnly cookies and session-bound request protection. Native authentication uses secure device storage. Administrator authentication and permissions are separate; no public administrator signup or authorization bypass.

## 5. Teacher Class Learning

Teachers manage their own classes, class codes, membership and class context. They can create lesson drafts, add reading sections and supported question formats, preview, publish a frozen version, and explicitly share it with compatible owned classes.

Corrections use new lesson versions. Sharing is separate from publication. Published assignments preserve pinned lesson/question versions even when newer content exists.

Teachers can browse the administrator lesson library and prepare assignments from eligible published content. Private answer keys stay on the backend and do not enter student lesson listings.

Class monitoring exposes authorized classroom participation/submission information and permitted released results. Teachers can record externally assessed student proficiency with dates and retained history. This does not automatically move students, change a class level or assign research treatment.

## 6. Student Class Learning

After authorized school sign-in, students see their class dashboard, joined classes, shared lessons, assignments, class messages, progress/history, Speak and Chat entry points.

Reading a shared lesson does not start an assignment, mark completion or prove mastery.

Assignment execution uses the pinned publication, explicit draft saving, resume and final submission. Existing answer components support the ten stored assessment-method contracts. Submitted answers are retained, and retries must not create duplicate final submissions.

Ordinary classroom results are separate from research assessment scores. Submission does not automatically run grading. Existing objective grading requires explicit backend permission; student visibility requires explicit owning-instructor release of an eligible completed evaluation. Missing, withheld or review-required results must not become invented scores.

Progress/submission counts are not vocabulary mastery, retention or a validated overall academic grade.

## 7. Communication and administrator functions

Class announcements and class-context teacher/student messages use live ownership/membership checks. This is not unrestricted peer or public chat. Existing draft/uncertain-send protections are preserved.

Administrator services include the established curriculum/question/vocabulary management and research preparation surfaces, subject to explicit permissions. Preparation pages do not grant consent, approve research or make a trained model available.

The content-library bundle transfers content only. It does not transfer user accounts, sessions, classes, enrollments or research participants.

## 8. FSRS-6 and FIFAKT — exact development status

Not every ordinary assignment uses FSRS. A separate research vocabulary workflow maintains learner/item/version memory states.

For the planned parallel study, 30 eligible participants would receive immutable 15/15 assignments: standalone FSRS-6 control or proposed FSRS-6 + FIFAKT experimental treatment.

Synthetic development enrollment, explicit consent/eligibility records, retained allocation, withdrawal, assessment attempts, instructor publication and control activities are implemented and tested in isolated PostgreSQL.

The development sequence is enrollment → pretest → scheduled weekday activities → immediate posttest → delayed assessment seven calendar days after the designated posttest reference date.

Control activities call the existing real FSRS-6 calculator, preserve its calculations, and record outcomes, raw/effective recall ratings, memory state, actual interval and due time. Incorrect objective recall uses the existing effective-again policy. This is not SM-2 or simulated scheduling.

The proposed intervention calendar is one calendar month, Monday–Friday, with local-day opening/closing and approximately 5–10 expected minutes metadata. Device time cannot open tasks. Actual duration and learning benefit are not guaranteed.

Experimental FIFAKT activities remain blocked. Public-data development training/shadow work does not supply a validated live FLUENTT provider. The application must not silently use control scheduling while calling it hybrid treatment.

Both research flags default off. Execution also requires environment=test and a verified disposable local fluentt_test_<32hex> database. The running class-demo database deliberately does not qualify. Its ordinary Class Learning functionality does not activate the research experiment.

## 9. Research assessments and evidence

Development assessment policy is explicitly synthetic: frozen/versioned items, authored order, one attempt, all responses required, one point per correct item and no retakes. Multiple-choice uses exact option IDs. Typed recall reuses the existing versioned NFC/outer-trim/casefold policy against authored accepted forms; accents/internal spaces remain significant.

Answers/keys remain private. Final responses are immutable. Drafts can resume; exact final-request retries return retained receipts. Missing/incomplete expired assessments are classified without automatically assigning zero.

These are development defaults, not approved final scientific instruments. Consent/assent, institutional approvals, instrument validity, accommodations, missing-data policy and a validated FIFAKT provider remain prerequisites for a real study. Research Comparison and CSV/report export were excluded from this work.

## 10. Speech and AI Tutor

English uses the existing Jianshu001/wavlm-phoneme-scorer pipeline with required alignment/preprocessing on the backend. Outputs are unvalidated model predictions, not certified academic grades.

Tagalog uses Meta MMS with the tgl adapter for transcription/reference comparison. Tagalog numerical or phoneme pronunciation ratings remain disabled. Allosaurus research has not established validated student-facing scoring. ASR agreement is not pronunciation accuracy.

Speech/model settings were preserved/reused locally, but no real-model inference was run in the new preview verification. UI availability does not prove model availability.

Groq Tutor code remains separate and unchanged. Provider credentials, account eligibility and running-server configuration determine availability; AI Chat has not been newly verified in this isolated preview. No API keys belong in the APK/source or handoff.

## 11. Verification and limits

Track 1 evidence: 251 targeted backend tests, 21 disposable PostgreSQL checks, 5 mobile API tests and 5 administrator tests passed.

Latest entry/form evidence: 9 mobile tests and 14 selected backend registration/combination checks passed. These overlap earlier suites; do not sum them as unique tests. Mobile typecheck passed; lint had no errors and six existing warnings.

Actual local HTTP checks: browser teacher registration 201; class creation without any grade field 201; stored grade NULL/proficiency beginner; session restoration 200. Correct preview/API/registration-options returned 200. Welcome and teacher-signup navigation were observed in the browser.

Full student/teacher device acceptance, APK rebuild, online deployment, real-model checks in the new preview and a live research study remain unverified or not performed. Automated tests are not scientific validation.

## 12. Constraints and next work

Preserve existing accounts/history, exact FSRS calculations, English WavLM, Tagalog MMS, Tutor integration, immutable evidence and authorization boundaries. Do not fabricate scores or enable FIFAKT/Tagalog ratings.

Next: complete teacher/student class-demo acceptance; verify lessons, sharing, assignments, messages and allowed results; independently verify speech/Tutor resources; review the required Supabase migration and deployment separately; rebuild the APK against the intended backend. Real research requires its own approved protocol and validated treatment.

Before changing anything, read AGENTS.md, current source, Git status and these reports:
- VERSION5_COMBINATION.md
- CLASS_LEARNING_VERSION5_ENTRY.md
- CLASS_LEARNING_WORKFLOW_IMPLEMENTATION.md
- STUDY_ENROLLMENT_IMPLEMENTATION.md
- RESEARCH_ASSESSMENT_IMPLEMENTATION.md
- CLASS_ACTIVITY_EXECUTION.md
- FSRS6_CONTROL_WORKFLOW_VALIDATION.md
- CLASS_LEARNING_TEST_RESULTS.md
- CLASS_LEARNING_ACTIVATION_READINESS.md
- TEACHER_LESSONS.md
- CLASS_PROFICIENCY.md
- ASSESSED_PROFICIENCY.md
- RESULTS_AND_FEEDBACK.md

Ask for missing evidence instead of assuming implementation, deployment or scientific approval.
