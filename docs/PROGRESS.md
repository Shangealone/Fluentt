# Student progress and learning history — Section 23

Later personal-history request (2026-10-21): a dedicated `/me/personal-history` receipt log now powers personal Stats → History. It does not change this document's original school submission-counts-v1 contracts or the personal NULL/unavailable responses from `/me/progress` and `/me/learning-history`. Personal activity receipts are not mastery/grades or a LearnerProgress/scheduler writer. See [PERSONAL_HISTORY.md](PERSONAL_HISTORY.md); the original “no approved personal writer” rationale below is historical to Section 23.

## Section 24 extension

Instructor monitoring now reuses submission-counts-v1 and the published-assignment/first-capture/result projection described below. It does not grant instructors access to student /me endpoints or personal progress. Current owned-class membership defines the cohort; each class has A×S opportunities, each student A and each assignment S. Only comparable released objective runs contribute a within-assignment mean under the separately approved released-assignment-mean-v1. See INSTRUCTOR_MONITORING.md; historical Section 23 exclusions below describe that milestone. No lesson coverage/mastery or personal activity writer is added.

The user approved a **submission-counts-v1** projection over existing ordinary classroom publications and captures. It measures assignment submission, without inferring mastery or curriculum completion. Every value comes from the authenticated student's authorized persisted records. No activity, score, completion, review/scheduler or research record is created by reading progress.

## Metrics and supported data

| Field | Definition |
|---|---|
| available | Each published, locked distribution-only-v1 assignment in the currently eligible class scope, counted once. Drafts, archived drafts, other students' assignments and unsupported legacy publication contracts are excluded. |
| not_started | Available assignment without this student's first attempt. Publication is availability, not learner activity. |
| in_progress | Existing first unscored-capture-v1 attempt with in_progress status, whether empty, partially saved, or a revealed Flashcard. Starting/revealing never counts as completion. |
| submitted | Existing finalized first capture with submitted_at. Counts even with unanswered questions, awaiting evaluation, withheld/review-required results or subjective Flashcards. |
| pending | not_started + in_progress. |
| class_count | Distinct currently eligible classes in the requested scope; includes a class with zero available assignments. |

available = not_started + in_progress + submitted. The UI displays **submitted / available counts**, not a percentage or academic grade. Zero availability is “No available assignments”; it does not imply 0% mastery. Publishing additional assignments or changing membership changes the denominator. Rejoining uses the same retained attempt; membership history, retries, re-evaluation, release/withdrawal and multiple item rows do not inflate counts.

Global summary counts cover the student's eligible school classes; individual record class/version IDs remain distinct. A class filter narrows this scope. Summary counts are deliberately independent of history status/date filters, as explained in the UI. Points are never summed/averaged across assignments or classes.

Personal learners receive availability=unavailable with counts/class_count=NULL and an empty unavailable history. There is no approved persistent personal activity writer or completion algorithm. Profile preferences, public curriculum browsing, the component-only Flashcard practice and dormant LearnerProgress/VocabularyReviewState/Event records do not authorize a progress metric. Their stored rows remain untouched, even if a legacy/test row contains a completed flag or metrics JSON. No fake zeros, streaks, levels, mastery, retention, due reviews, pronunciation metrics or forecasts are shown.

Permitted curriculum context is the original assignment snapshot: edition/version ID/name, lesson ID/name, grade and subject, with the class learning language separately labeled. Filipino subject is not Tagalog language. No approved module/lesson coverage denominator exists, so Section 23 does not calculate one or treat research's five levels as an ordinary curriculum structure.

## History and results

History includes currently available assignments, including pending entries, and real owned attempt start/change/submission timestamps when present. It is a current authorized assignment ledger, not a research event stream, former-class transcript, per-question click log or duration measurement.

- Rows sort descending by submitted_at, otherwise attempt.updated_at, otherwise publication locked_at, with ascending assignment UUID as a deterministic tie-break. last_activity_at is the persisted attempt update timestamp, not a claim of a lesson visit, time on task or a successful recall. Card reveal can update that timestamp without advancing submission counts.
- Date filters use this same sort_at field: since is inclusive and before exclusive, both timezone-aware. Mobile YYYY-MM-DD controls use the device's local calendar and convert an inclusive end date to the next local midnight, then send UTC instants. Invalid/naive/reversed dates are rejected. No deadline/timer/expired-capture policy is introduced.
- Current valid capture states are only in_progress/submitted. Expired/graded/legacy incompatible attempts in an otherwise eligible publication fail safely with 409 rather than being silently counted as complete or unstarted. The approved capture database guards normally prohibit those states. No formal academic invalidation state/workflow exists; none is invented here.
- Submitted without a grading run is awaiting administrator evaluation, with no automatic job implied. Review-required/unsupported results remain awaiting_manual_review with no overall score. Flashcard-only evaluations remain not_applicable without a denominator.
- Section 22's current release decision governs scores. Unreleased/withdrawn history has no evaluation ID, policy or points. Released history uses the exact permanently pinned run and its Decimal-string totals. A newer engine evaluation does not replace it. History omits answers, item correctness, private keys/rubrics/explanations and Flashcard backs; the existing results route separately authorizes permitted review.
- Curriculum/question retirement and newer editions do not replace original snapshot/version references or erase already published authorized assignment history. There is no join to the current public curriculum catalog that would silently hide historical assignments when an edition retires.

## Access and consistency

Only authenticated school/personal students may use these /me routes. There is no student-ID selector or instructor progress endpoint. Instructors receive 403 and ordinary administrator browser cookies provide no mobile credential. Every query resolves the actual authenticated owner and eligible active/unended memberships, active/unarchived classes, and available instructor owners. Class filter targets outside that scope return generic 404. Leaving/removal/deactivation removes subsequent access; eligible rejoining restores retained history. Invitation expiry alone does not end membership.

Transactions lock student/session, discover candidate classes, lock distinct instructor owners in UUID order, then classes and eligible memberships in deterministic order, refreshing ORM rows after waiting. They revalidate eligibility before acquiring shared content advisory 78090001 and projecting data. This extends the existing student_context ordering to multiple classes. A real PostgreSQL lock-wait test confirms a newly disabled owner is revalidated before history disclosure. Existing instructor result mutations use NOWAIT for student locks, preserving that inverse-wait safety boundary. Future writers must retain these lock rules.

The authenticated student lock serializes starts/saves/submission and membership writers. Owner/class locks coordinate publication and result visibility, preventing disclosure through a completed withdrawal. Progress is not a permanent snapshot: each response reports the server read-check time, and refresh verifies current data/access. Summary/history are separately authorized reads, so their displayed checked times may differ.

The shared SQL base joins one immutable published assignment version and that student's first attempt. Membership eligibility is a distinct class-ID scope, not an activity join that multiplies rows. Aggregate COUNT/FILTER runs in PostgreSQL. Status/date filtering, deterministic ordering and LIMIT/OFFSET happen before bounded LATERAL evaluation/visibility lookups; each lookup takes one latest decision and the pinned run, or only latest sealed run status before pinning. Conditional SQL/DTO projection returns points only after release. No per-row API/database loop or full history load is needed. Existing class/version/attempt/release indexes support these joins; no migration/index/model change is required. Head remains 0011_result_release, 63 domain tables.

Queries never read StudentResponse, QuestionAnswerKey, LearnerProgress, vocabulary/scheduler histories, research_private or research outcome tables. No research consent, participant identity, treatment effect or experiment analytics is inferred from classroom membership.

## API and mobile flows

All paths follow /api/v1 and use existing mobile Bearer, secure transport, bounded throttling and SessionController.run conventions. Success and error responses use Cache-Control:no-store and Pragma:no-cache, including the new /me/ prefix.

| Method | Path | Contract |
|---|---|---|
| GET | /me/progress?class_id=optional-UUID | Global or one eligible class summary, availability/as_of/policy and counts. Personal counts are NULL/unavailable. |
| GET | /me/progress/classes | Bounded eligible class choices with IDs, name, grade and learning language; includes empty classes. |
| GET | /me/learning-history | Current authorized assignment history; optional class_id, status=all/not_started/in_progress/submitted, aware since/before; bounded pagination. |

Lists use limit 1–100/default20 and offset 0–100000; has_more probes one additional row. Class options sort by name/UUID; history uses the timestamp/UUID order above. Bad filters=422, invalid session=401, nonstudent role=403, unavailable class=404 and incompatible legacy evidence=409. Network/database failures follow existing safe envelopes; errors never echo keys, responses or credentials.

The student dashboard has a refreshable submission summary and Progress and learning history link. My Classes also links directly to that class's history. The protected /learning-history screen supports both student pathways, with class selection, submission status, optional calendar dates, explicit Apply/Clear filters, bounded previous/next pages, summary/history refresh and existing assignment/result navigation. The personal pathway explains unavailable tracking without a fake school record.

Existing Screen, Button, Input, Choices, Picker and LoadState provide scrolling, accessible labels, responsive wrapping, keyboard behavior and retry/empty/loading states. Focus loss, route changes, refresh and invalid sessions clear visible prior data and ignore late completions; no sensitive browser/disk/offline history cache is added. Filter edits are local until Apply; changing scope remounts read state. Back uses existing navigation. Default dashboard future-feature copy now acknowledges actual classroom assignments/results/submission progress instead of incorrectly labeling all progress unavailable.

See SECTION_23_REPORT.md for actual tests and limits. Native-device/session/assistive-technology behavior, production load and real OIDC/TLS remain separate verification prerequisites. Future personal/lesson completion, mastery and Section 24 monitoring require explicit policies rather than repurposing these submission counts.
