# Assignment drafts, publication and classroom distribution

## Section 22 results

The approved result workflow now exposes submission/evaluation/withheld/released states and, only after explicit owner release, real objective totals and original-answer review. Instructor reads/releases require current ownership and eligible members; grading remains a separate administrator operation. Release never edits the unscored attempt, frozen assignment or response. RESULTS_AND_FEEDBACK.md defines the separate append-only visibility contract; Section 20 capture reads still return receipt-only after submission. Head 0011_result_release. Historical no-result exclusions below remain their original milestones.

Section 21 now provides explicitly approved internal objective evaluations as separate immutable GradingRun/GradingItemResult records. It never changes the frozen assignment, Section 20 capture contract, submitted responses, receipt-only mobile access or unset assignment points/limits. Trusted administrators need explicit grading.read/run; no evaluation runs on submission and no results are released. GRADING.md defines approved exact matching, equal-point policy, Flashcard exclusion and manual/unsupported states. Earlier no-grading statements below describe their original milestones.

## Section 20 approved student response capture

Section 20 supersedes the earlier no-attempt/no-question-delivery exclusions below for this explicitly approved **unscored-capture-v1** workflow. The user approved one resumable attempt per school student per pinned published assignment, no retakes/timer/deadline, explicit progress saves, confirmed incomplete submission, a final receipt without answers/results, and controlled unscored Flashcard reveal. Existing distribution-only assignment versions, unset points/max_attempts and historical item IDs remain unchanged. This contract is not a grading configuration or permission to execute research.

Start is idempotent by student/version and always returns the same attempt, including its submitted receipt. Every operation requires live device authentication, school role, eligible membership, active class/live owner and the exact published distribution-only version. Losing membership suspends access without deleting work; eligible rejoining resumes the same attempt. Historical incompatible attempts require operator review. No username/class-code authentication or personal/instructor access is introduced.

### State, saves and finalization

One attempt moves in_progress → submitted. Server timestamps/identity, pinned version/items and ordinal 1 are authoritative. Explicit Save progress replaces the complete response snapshot plus resume position under If-Match; absent entries clear prior draft responses. Local question navigation retains buffers without network autosave. Empty/incomplete valid buffers are supported. Invalid fields/references/limits fail before writes. Save conflicts/unknown outcomes require reload and explicit discard confirmation, protecting other-device updates. No responses or bearer tokens are persisted in browser/local storage.

Text capture preserves valid Unicode, case, whitespace and punctuation exactly, including unfinished empty/whitespace buffers. The versioned capture validator extends draft-buffer handling without weakening the original response validator or interpreting expected answers. Declared input_max_length applies; legacy fields have an 8,000-code-point operational ceiling. Progress snapshots are capped at 200 entries/1 MiB, with duplicate/unknown assignment-question IDs rejected. Surrogate-only invalid Unicode is rejected. These limits are operational, not academic or grading policy.

Progress uses assignment_question_id bound to the frozen assignment version; public questions additionally retain stable Question and exact QuestionRevision IDs. Responses preserve existing per-method ID shapes. Multiple Select/Error Identification serialize selected IDs in authored order through existing controls; arrangements preserve learner order and matching preserves left-item order. Text fields remain raw. Structural answered/unanswered/incomplete indicators do not mean correctness: false is an answered boolean; empty choices/text or partial blanks/arrangements/matching are incomplete.

Final confirmation warns about unanswered/incomplete items and allows deliberate submission anyway. The submit request atomically saves the current snapshot, marks response/attempt timestamps and freezes the attempt with an idempotency UUID/body fingerprint. An interrupted retry reuses the original row/body/key; equal already-finalized payloads return the same receipt without another mutation, even with stale freshness. A different payload conflicts; it never edits final responses. The fingerprint is internal and never returned. Missing If-Match=428, stale/final/transaction conflicts=409, malformed/invalid responses=422, unavailable objects/membership=404, other roles=403 and invalid sessions=401. A confirmed receipt includes identity, timestamps, question/completion counts and assignment title, with empty question/response/reveal arrays. No score, correctness, feedback or answer review is returned.

### Flashcards and privacy

General attempt reads contain public fronts/cues only, never keys, backs, private explanations/rubrics or correctness data. An explicit attempt-scoped POST may return only the requested pinned Flashcard back after live authorization, item/method checks and freshness validation. The server remembers revealed item IDs. Recall cannot be saved before reveal, may be revised before final submission and remains subjective again/hard/good/easy. On resume, backs are not automatically included; deliberately request the same authorized reveal again. Reveal is blocked after final submission. Independent practice retains its original once-per-visit local semantics. No vocabulary-review event, scheduler state, latency, experimental telemetry or research consent is created.

### Added API under /api/v1

| Method | Path | Contract |
|---|---|---|
| POST | /assignments/{id}/attempt | Explicit start/resume; same student/version returns the same attempt or final receipt. No arbitrary retake parameter. |
| GET | /assignments/attempts/{attempt_id} | Owner-only live-authorized saved state; submitted state is receipt-only. |
| PUT | /assignments/attempts/{attempt_id}/progress | If-Match; {position:1-based integer, responses:[{assignment_question_id,answer}]}; full snapshot replacement. |
| POST | /assignments/attempts/{attempt_id}/submit | Same snapshot plus confirm:true, If-Match and UUID Idempotency-Key; atomic confirmed finalization. |
| POST | /assignments/attempts/{attempt_id}/questions/{item_id}/reveal | If-Match; explicit Flashcard reveal only. Returns {revision_id,back,attempt_revision}; no general key access. |

AttemptView includes id, assignment_id, class_id, version_id, title/instructions, status, freshness revision, server start/submit timestamps, position/counts, safe questions, saved raw responses and revealed item IDs. Question entries reuse existing public Item with assignment_question_id. New and old metadata endpoints remain no-store and independently authorized. SessionController.run wraps every mobile request. The shared student authorization context locks student/session → owner/class/membership → shared content advisory before attempt/response writes. Locked attempt state is refreshed after waits; user and attempt locks serialize same-student writes. Safe audit events record start/save/submit actor, attempt, request/time/contract without responses, backs or credentials; replay/reveal do not invent learning telemetry.

### Storage and user flow

Additive **0009_response_capture** adds nullable capture_contract/capture_state/submission_fingerprint on existing AssignmentAttempt (still 60 tables). capture_state contains server-managed revealed item IDs and explicit saved position. No AssignmentVersion or published child is altered. The attempt guard allows only ordinal-1 unscored capture against a locked distribution-only publication, with no expiry/score and only in_progress/submitted states. Additional guards retain attempt identity/history, require finalization identity and prevent post-submission response changes, grading fields or latency collection. Legacy configured-attempt validation remains; no old attempt conversion. Downgrade refuses retained capture history; frozen 0001–0008 remain unchanged.

Student: My Classes → published assignment detail → Start, resume or view submitted receipt. The player presents instructions, current question, structural progress, previous/next and optional question jump controls. Existing ten widgets are controlled by per-item buffers; clearing/resetting affects the draft only until explicit save. Save progress, reload/discard confirmation, final incomplete warning, exact submission retry and safe exit are explicit. Busy/uncertain saves freeze inputs. Membership loss hides questions/backs; session loss and blur unmount protected state and late callbacks are ignored. A closed app loses unsaved local buffers while explicitly saved server progress remains. Native device execution is not established by component tests or exports.

See SECTION_20_REPORT.md for test evidence, limitations and Section 21 prerequisites. Automatic grading, result publication, instructor analytics, AI and research remain excluded. Any future approved grading strategy must retain immutable captured responses and use explicitly versioned policies; the current unscored attempt contract is not implicitly upgraded.

## Section 19 approved publication contract

Section 19 supersedes the historical draft-only exclusions below. The user approved immutable **distribution-only-v1** publication with points/max_attempts still NULL, no grading policy, dates or timer. At least one eligible question is required. This is classroom distribution of assignment metadata, not executable assessment delivery. No student attempt, question-content, response, scoring, notification or research API is supplied. Already configured legacy policies are rejected for operator review rather than overwritten.

Publish requires an explicit confirmation, live instructor ownership, active class, If-Match freshness and UUID Idempotency-Key. Revalidate the selected published lesson, class grade/language/subject, exact locked published question revisions, unique stable Question identities and contiguous positions. Exactly one draft version is supported. The same transaction freezes that version/items, records the publication request/contract and actor audit, then changes draft → published. Failure rolls all of this back. Published versions/root metadata cannot be edited, re-versioned, closed or archived in this section; draft archive remains available. No destructive deletion occurs.

For an unbound class, confirm bind_subject_id equal to the selected lesson subject. Review retained assignment versions and classroom lesson progress first; conflicting/missing subject context rejects binding for operator review. Bind subject atomically with publication, never infer Filipino subject from Tagalog language. An already bound class must match. Audit records include explicit subject/binding, class/version IDs and actor, without instructions, keys or credentials.

Availability is immediate for **every currently eligible active school-student membership**, including later joiners/rejoiners. Leaving/removal, class archival, owner deactivation or invalid credentials removes access on the next authorized request. Existing enrollment rules still block self-rejoining after removal. Invitation expiry does not end membership. No frozen recipient cohort, delivery receipt, individual assignment allocation, push/email or research participation is implied. Publication status means available through authenticated classroom reads, not a notification sent or learner completion.

Question/curriculum retirement blocks new publication but does not withdraw an already pinned publication. Its original IDs/context remain traceable and visible under live class/membership authorization. There is no automatic question replacement, executable configuration update or reassignment.

### Added/current API under /api/v1

| Method | Path | Contract |
|---|---|---|
| POST | /assignments/{id}/publish | Instructor only; JSON {confirm:true, bind_subject_id:UUID\|null}, UUID Idempotency-Key and If-Match. Returns committed owner detail with status=published, editable=false. Missing freshness 428; stale/illegal/configured/conflicting context 409; incomplete/ineligible/unconfirmed subject 422. |
| GET | /classes/{class_id}/published-assignments | School student only; live eligible membership. Page limit 1–100, offset 0–100000. Published timestamp descending, UUID tie-break. Empty page is valid. |
| GET | /assignments/{id}/published | School student only; the same live membership/class/owner checks; unavailable/other-class/draft IDs are indistinguishable 404. |
| GET | /classes/{class_id}/assignments | Owner list now includes draft, archived and published summaries. |
| GET | /assignments/{id} | Owner safe detail now includes published read-only history. Existing PATCH/archive reject published assignments. |

Student DTO: id, class_id, version_id, status=published, title, instructions, safe curriculum context, published_at, question_count and ordered methods. It deliberately excludes questions/prompts/content/revision references, answers, Flashcard backs, scores and grading configuration. The detail endpoint rechecks authorization independently; knowing an ID or choosing a class grants nothing. Existing device credentials, HTTPS, no-store, safe error and process-local throttle conventions remain; admin cookies grant no mobile access.

The original publication key may replay the committed result with the original If-Match after an interrupted response, including after content retirement; it adds no second mutation/audit. A different key or stale changed draft conflicts. Mobile retains the original row/key in memory for explicit retries; failed/unknown publication freezes edits until reload. After restart, inspect saved status. No key/body is persisted insecurely. Reload reconciles the authoritative server state.

Student transaction order: authenticate/lock student+session; lock/revalidate owner, class, eligible membership; shared content advisory 78090001; materialize metadata. Instructor publication follows existing owner/class → exclusive content advisory → assignment/version order and refreshes locked ORM data. Membership writers must keep student-before-owner/class conventions. Owner disable/class mutation waits are revalidated, rather than using stale identity-map data.

### Migration and navigation

Additive **0008_assignment_publication** adds nullable publication_contract/publication_request_id on AssignmentVersion; still 60 tables. Frozen 0001–0007 remain unchanged. The configuration guard permits only a fully identified, locked distribution-only version with all attempt/score/window policies unset. Existing freeze/nonempty/locked-question guards remain. The attempt guard explicitly rejects this contract, even if future code tries inserting attempts directly. Root/version insertion/reparenting guards prevent silently replacing a distributed version. Downgrade refuses retained publication history; no backfill, reset or data deletion.

Instructor: My Classes → class details → Assignment drafts/Class assignments → saved builder → Review and publish → explicit confirmation (including subject binding). Published status/read-only detail is authoritative; no fabricated recipient counts. School student: My Classes → choose enrolled class → View published assignments → metadata detail. Refresh/focus clears stale content and handles empty/error/session-loss states. No Answer/Start attempt control exists. Both use existing protected routes and SessionController.run. Local component tests/exports do not establish native-device execution.

Section 20 must approve an executable assessment contract and attempt/feedback/release policies before enabling question retrieval or attempts. These immutable distribution-only rows cannot simply acquire scores/attempt limits or bypass guards; any additive execution configuration/version strategy must preserve the original references. See SECTION_19_REPORT.md for actual verification and limitations.

## Historical Section 18 draft contract

Only authenticated instructors may read or mutate drafts for their owned classes. Every request checks live device session/user state and instructor role, locks the owned class, then acquires shared/exclusive content advisory lock 78090001 before materializing reads/domain writes. Writes lock the assignment and check freshness in that same transaction; authorization is never a separate unchecked read. Another owner's ID is indistinguishable from missing (404); other mobile roles receive 403, missing/invalid/revoked credentials 401. Administrator cookies confer no mobile access. Responses/errors are no-store. Production transport must be HTTPS; existing bounded process-local session throttling applies and still requires deployment-wide limits.

## Approved draft policy

The user approved one explicitly selected published lesson per draft. Every selected item must be an exact locked QuestionRevision from that lesson, in the class learning language, with published/unretired question identity and curriculum/topic/lesson ancestry. Lesson grade must match the class; an already bound class subject must match too. A class with null subject may create a draft whose snapshot explicitly names the chosen subject; the class is never changed or inferred from English/Tagalog. Explicit class-subject binding remains a Section 19 publication prerequisite. Filipino subject is separate from Tagalog learning language.

All ten methods are eligible under identical version/access rules. The instructor catalog includes each eligible locked revision, ordered by stable Question ID, descending revision number, then revision ID; a newer draft is never selectable merely because its Question identity was previously published. An instructor deliberately pins the desired revision. Only one revision of each stable Question may appear in a draft, even if several versions are published. Caller positions are not accepted; array order becomes contiguous positions 1..N. Title is trimmed 1–200 Unicode characters, optional instructions trimmed up to 8,000, and 0–200 ordered questions are allowed. Empty drafts are valid; future locking still requires nonempty items. No scoring, due dates, timers, attempts or feedback controls exist.

Classes are fixed on creation. Active owned classes permit create/edit. Owner reads remain available after class archival; archived classes reject content selection/create/edit but permit discarding an unlocked draft through archive. Assignment archival is one-way, preserving versions and references; no hard-delete, restore, new-version, publish or attempt endpoint is supplied here. Locked/published/closed assignments are not mutable through these draft APIs. Legacy malformed/unlocked question references fail closed for operator review rather than disclosing unpublished content.

## Version and privacy contracts

Reuse Assignment → AssignmentVersion → AssignmentQuestion; the draft maintains its unlocked version and pins question_revision_id. Stable Question identity/method/version are derived from that immutable revision, never independently caller-edited. Draft replacement may recreate unreferenced AssignmentQuestion rows; those row IDs are not a learner delivery contract. Existing FK/freeze guards prevent changing referenced/locked history. Corrections to published questions remain separate revision IDs; adding a later draft/revision never silently replaces selected content.

curriculum_snapshot contains schema_version=1 and safe context: lesson ID/name, curriculum-version ID/name, grade number, subject ID/name. It omits provenance/private keys/research data. Later question/curriculum retirement does not erase owner-only pinned history; detail returns safe public definitions and eligible=false for affected content. Before saving any edit, all remaining items and the selected lesson are revalidated; remove/replace retired or incompatible items. Archive does not require making retired content eligible again.

Instructor previews reuse public method adapters/widgets. Flashcards exposes the cue/front only, with no back reveal. No answer-key table is loaded by assignment services; keys, private explanation/rubric and correctness configurations never enter responses. Public question points/difficulty remain existing content metadata; they are not assignment weights or evaluated proficiency. Nothing is delivered to students, and no practice/assessment response is persisted. Ordinary classroom state does not authorize research enrollment or telemetry.

## API

Paths follow /api/v1 and require Authorization: Bearer with the existing mobile device credential. Inputs reject extra fields. Common page query: limit 1–100 (default 20), offset 0–100000; content search q up to 200 characters and optional one-of-ten method filter on questions. List/history eligibility is checked server-side; selecting a class in the client grants no access.

| Method | Path | Behavior |
|---|---|---|
| GET | /classes/{class_id}/assignments | Page of draft/archived summaries: id, class_id, status, title, safe context, real question_count. Newest creation first, UUID tie-break. Does not repeat all question bodies. |
| POST | /classes/{class_id}/assignments | Requires UUID Idempotency-Key. Body: lesson_id, title, instructions?, question_revision_ids. Returns 201 full saved draft after commit. |
| GET | /classes/{class_id}/assignment-lessons | Page of eligible published lesson contexts for explicit selection; grade/subject filtered, optional lesson-name search. |
| GET | /classes/{class_id}/assignment-questions?lesson_id=... | Page of eligible exact question revisions, safe public definitions only; prompt search/method filter. |
| GET | /assignments/{assignment_id} | Owner-only full draft/archived view with version_id, revision marker, safe context, ordered questions, eligible/editable/requires_subject flags. |
| PATCH | /assignments/{assignment_id} | Requires If-Match; complete draft replacement using the create body. No partial property/role/class/policy mutation. |
| POST | /assignments/{assignment_id}/archive | Requires If-Match; archive unlocked draft and retain history. No restore route. |

Full question entries contain id (revision ID), question_id (stable identity), version, eligible and the existing key-free public definition. Full draft revision is a SHA256 freshness marker over root/version/item row identities/timestamps/status, not a credential or private-key hash. Missing If-Match is 428; stale/protected/concurrent/FK changes 409; invalid input/eligibility/duplicates 422; unavailable ownership/context 404. These are separate from authentication 401/403. Safe error messages do not echo request content/secrets. Audit assignments.create/replace/archive records actor/item/request/time, never question keys or instructions.

## Retry and transaction behavior

Creation stores a nullable legacy-compatible UUID creation_request_id plus normalized original-body/class fingerprint on Assignment, unique per instructor/request. User/session locking serializes same-instructor concurrent requests. Same key/body returns the already saved current draft, including after metadata edits/archive/retirement; another body/class with that key returns 409. No replay mutation/audit is added. A lost initial response is retried with the exact original body/key, never a new POST key automatically. After process restart the in-memory pending key is lost: inspect the draft list before deliberately creating another.

Edits/archive use If-Match and explicit reconciliation on stale/unknown outcomes. Repeating a committed changed PATCH with the old marker yields 409, preserving the first save. Invalid full replacements validate before deleting/replacing unlocked child references, and the transaction rolls back on error. Published versions/FK references remain protected. Future writers must use owner-before-class, then content advisory, then assignment/version locks consistently and refresh ORM rows after lock waits. Do not insert references outside the shared content boundary or bypass guards through raw SQL/bulk writes.

## Migration 0007_assignment_drafts

Still 60 domain tables. Add only creation_request_id/fingerprint plus owner/key uniqueness; allow max_attempts and item points to be NULL for unconfigured drafts. Existing rows/defaults/values are preserved. New service drafts explicitly store NULL, with empty grading_policy and null date/timer fields. Existing configured item values retained on edits for the same revision are not silently rewritten. The new invoker guard require_assignment_configuration refuses locking when max_attempts or any item points is NULL, supplementing frozen nonempty/locked-question/child-freeze guards. No policy value is inferred and no question points are copied as assignment weights.

Frozen 0001–0006 and SQL artifacts remain unchanged. Reviewed existing databases use normal alembic upgrade head; fresh empty databases retain the explicit bootstrap adapter. No automatic startup migration. Downgrade refuses any newly unconfigured fields or durable creation request metadata rather than inventing values/deleting retry evidence. Do not downgrade/reset an existing database to run tests. Runtime privileges/trigger disabling still need deployment controls.

## Mobile workflow and verification limits

My Classes → class details → Assignment drafts → create/view builder. Existing protected Expo Router policy permits only instructors; every typed API operation uses SessionController.run, generation checks and current-401 secure cleanup. Catalogs clear visible results on loading/error/unmount; list reloads on focus. Native SecureStore remains required; browser account creation stays blocked.

Choose a named curriculum/subject/lesson, enter title/instructions, filter published questions across ten methods, preview public content, add/remove/reorder and save an empty or populated draft. Changing lesson confirms removal of selected items. Save is single-flight; an interrupted create freezes inputs and retains original body/key. Unknown/stale edits require reload/reconciliation. Reload and route removal warn about unsaved edits; Expo Router's installed usePreventRemove handles route/gesture/Back and web unload protection. Busy saves cannot be navigated away from normally; loss of authenticated role is not prevented. Archive has a confirmation and leaves a read-only retained view. No Publish button or student availability is added.

Physical device/native navigation/accessibility behavior is not established by TypeScript/SSR/export tests; see SECTION_18_REPORT.md for actual evidence and Section 19 prerequisites. Section 19 must approve publication, attempt/scoring/release/dates/weights and explicit class-subject binding before exposing coursework to students.
