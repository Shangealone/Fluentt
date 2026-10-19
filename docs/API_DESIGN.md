# API design

## Section 25 implemented communication API

Mobile-session GET /communication/classes and GET /classes/{class_id}/communication expose eligible class/participant context. Owner-only /communication/participants lists current enrolled school usernames. Class-scoped GET/POST /announcements and /messages/{student_id} persist owner announcements or private owner–student messages; GET /communication/messages/{message_id} and POST its /read mark only the viewer's read state after explicit opening. Sends require UUID Idempotency-Key and strict {content}, 1–4,000 Unicode code points; history pages carry a server as_of bound for stable pagination. Every operation revalidates live class/owner/membership and separates class context from the existing exclusive message destination. No private keys/grades/research records are automatically attached; no peer/personal chat, uploads, receipts shared with participants, notifications or realtime promises. See COMMUNICATIONS.md for exact contracts and demo-only retention.

## Section 24 implemented monitoring API

Authenticated instructor GET /instructor/monitoring/classes lists active owned classes. GET /classes/{class_id}/monitoring returns current-cohort counts; nested /students, /students/{student_id}, /assignments, /assignments/{assignment_id} and /contexts provide bounded rosters, student history, publication summaries/outcomes and assigned lesson/edition choices. Every class read reauthorizes owner, active class and current eligible memberships. Only released pinned COMPLETE evaluations project points; means require identical engine/policy/maximum within one assignment version. No student responses, keys, card backs or research data appear. INSTRUCTOR_MONITORING.md defines filters, denominators, ordering, safe errors, lock/retry behavior and unchanged separately authorized Section 22 review permissions. All these paths have no-store responses.

## Section 23 implemented progress API

Student mobile GET /me/progress returns submission-counts-v1 counts for all current eligible classes or optional class_id. GET /me/progress/classes provides paginated eligible class choices. GET /me/learning-history filters own available assignments by class, submission status and timezone-aware inclusive since/exclusive before, with bounded pagination and pinned released totals only. Personal tracking returns explicit unavailable/NULL counts; instructors cannot access these /me records. No scores are aggregated, answers/keys returned or activity/progress persisted. PROGRESS.md defines exact metric/empty/time/privacy contracts; /me/ successes and errors are no-store. Earlier conceptual progress endpoints remain unimplemented unless described here.

## Section 22 implemented results API

Mobile-session GET /assignments/{assignment_id}/result returns the student's own current eligible result; owner GET /assignments/{assignment_id}/results lists finalized eligible submissions. Owner GET /assignments/results/{attempt_id} and /evaluations provide safe pinned/selected evaluation review. Owner POST /assignments/results/{attempt_id}/release confirms release/withdraw/re-release with run_id, UUID Idempotency-Key and If-Match. Students receive scores/own-answer review only after release; expected answers, private keys/rubrics/explanations and Flashcard backs stay hidden. No grading or queued job is triggered. See RESULTS_AND_FEEDBACK.md for precise DTO, pagination, status/security rules and error contracts; earlier exclusions are historical.

Section 21 adds internal administrator POST /api/v1/admin/grading/attempts/{id}/evaluate, GET /runs/{id} and GET /attempts/{id}/runs. Live explicit grading.read/run, Origin+CSRF on mutation and no-store apply; no mobile or Next BFF exposure. Evaluate only finalized ordinary classroom captures with the approved objective-exact-v1 policy and exact pinned evidence; immutable run/item results preserve original unscored attempts/responses. No keys, release UI, student results, automatic grading-on-submit or research access. GRADING.md defines per-method states, equal-point arithmetic, natural idempotence and metadata.

Section 20 adds school-student POST /api/v1/assignments/{id}/attempt; GET /api/v1/assignments/attempts/{attempt_id}; PUT .../progress; POST .../submit; and POST .../questions/{item_id}/reveal. Live student/session/membership/class/owner authorization is shared with Section 19. One unscored capture supports explicit partial saves/resume and confirmed incomplete finalization; general questions are key-free, and only a deliberately requested pinned Flashcard back may be revealed before submission. If-Match, UUID finalization retry identity, receipt-only final access and server-side response validation apply. No grading or research API. See ASSIGNMENTS.md and SECTION_20_REPORT.md.

Section 19 adds instructor POST /api/v1/assignments/{id}/publish (confirmation, If-Match, UUID Idempotency-Key) and school-student GET /api/v1/classes/{class_id}/published-assignments plus /api/v1/assignments/{id}/published. Owner lists/details include immutable published status. Student DTOs contain metadata/context/count/methods only, no questions or keys. Live membership, class/owner state and device session remain authoritative. ASSIGNMENTS.md defines immediate/later-member eligibility, explicit subject binding, distribution-only-v1 and retry rules. Attempts/grading/notifications remain unavailable.

Section 18 implements owner-only instructor draft assignment management and grade/subject/language-scoped selection of locked published question revisions. GET/POST /classes/{id}/assignments, GET /classes/{id}/assignment-lessons and /assignment-questions, GET/PATCH /assignments/{id} and POST /assignments/{id}/archive use device sessions, class ownership, creation idempotency and If-Match. Key-free previews span all ten methods, with Flashcards front only. No student assignment/attempt/publication endpoint is added. ASSIGNMENTS.md defines exact input/output, eligibility, retained history and migration 0007; earlier route tables below remain provisional where not explicitly implemented.

Section 17 completes administrator editing for all ten existing methods with flashcards. Public definition remains content.cue only; back and optional scoring_rubric_version remain private. Existing read+write key lookup supplies a separately held back for deliberate editor preview; read-only preview never fetches it. Mobile FlashcardPractice receives authorized version-bound front/back props, emits only local self-report recall callbacks and exposes no learner retrieval/history/review-event endpoint. No persistence, telemetry, scoring, scheduler or migration is added. VOCABULARY.md records approved recall semantics and OPEN future persistence/access policies.

Section 16 adds matching_type to the existing administrator editor/fixed BFF, reusing V1 left/right item sets and private complete one-to-one pairs. Browser/mobile public projections exclude keys; complete unscored responses contain pairs of stable left_id/right_id in authored left order. Partial drafts remain valid under existing backend semantics. No new endpoint, migration, grading or learner delivery capability is added. QUESTION_BANK.md has the accurate ten-contract/nine-interface support matrix and SECTION_16_REPORT.md records verification.

Section 15 adds word_arrangement/sentence_arrangement to the existing administrator editor/BFF, reusing public items[{id,text}] (minimum two), private ordered_ids (complete permutation) and existing version/permission APIs. Presentation order is independent of expected order; no shuffle is inferred. Safe mobile/browser components start empty and become structurally ready only after every ID appears once. Word responses use ordered_token_ids; sentence responses use ordered_sentence_ids, retaining learner order. No scoring, alternative-order policy, submission endpoint, migration or other method editor is added. QUESTION_BANK.md and SECTION_15_REPORT.md define the implemented boundaries.

Section 14 extends the existing administrator editor/BFF to multiple_select and error_identification using unchanged V1 backend contracts. Multiple Select uses ordered options and private correct_option_ids; Error Identification uses ordered whole tokens and private error_token_ids/optional accepted_corrections. Safe unscored responses serialize selected IDs in content order; empty selection is an unfinished preview. No selection-bound fields, offset/span representation, learner correction entry, grading or delivery/submission API is added. Existing permissions, session/CSRF, If-Match, publication and history guarantees remain authoritative. See QUESTION_BANK.md and SECTION_14_REPORT.md.

Section 13 reuses the same administrator question endpoints and expands the Next BFF/editor to Identification and Fill in the Blank. Additive content metadata is optional input_max_length (strict integer 1–2,000 Unicode code points per response field) and, for blanks, template_syntax="double-brace-v1". Tagged prompts must match ordered blank_ids exactly once with {{blank_id}} markers; legacy untagged prompts remain literal. Identification/blank responses preserve raw text without normalization; the existing validator optionally enforces exact complete blank coverage. Keys/explanations stay editor-only. No learner retrieval/submission/grading endpoint or migration is added. See QUESTION_BANK.md and SECTION_13_REPORT.md.

Section 12 consumes the Section 11 APIs unchanged from protected Next /questions and fixed same-origin /api/admin/questions routes. Only Multiple Choice/True or False authoring and unscored preview UI are added. BFF method/path/cookie allowlists, 64 KiB JSON budget, Origin+CSRF, live backend permissions and If-Match remain authoritative. Mobile components consume explicit key-free props and produce the existing option_id/boolean answer shapes; no learner retrieval/submission or scoring endpoint is added. QUESTION_BANK.md documents UI/data boundaries and interrupted-save reconciliation.

Section 11 adds administrator-only `/api/v1/admin/questions` listing, creation, revision history/preview, complete draft replacement, new revisions, publication and whole-item retirement. Explicit questions.read/write/publish permissions, editor-only private-key reads, Origin+CSRF, If-Match and atomic audits apply. QUESTION_BANK.md defines exact paths, ten typed contracts and unresolved scoring policies. No learner retrieval/submission/grading endpoint or authoring UI is added; conceptual endpoint/response envelopes below remain future planning.

Section 10 adds administrator-only management under `/api/v1/admin/curriculum/manage`: paged/detail GETs, create POST, edit PATCH, unreferenced-draft DELETE, and whole-version publish/retire POSTs. Read/write/publish permissions, dedicated cookies, Origin+CSRF, full-edition If-Match and atomic audits are authoritative. Section 09 read paths remain compatible. CURRICULUM.md documents exact payloads/statuses and SECTION_10_REPORT.md records verification. No question-bank, lesson delivery or assessment API is introduced.

Section 09 implements GET-only `/api/v1/curriculum/...` and `/api/v1/admin/curriculum/...` structure contracts: version lists/details and grade/subject/quarter/topic/lesson/competency traversal/details. See CURRICULUM.md for all 14 suffixes per audience, safe fields, bounded pagination and strict filters. Mobile requires a device session and published ancestry; admin requires its separate browser session plus curriculum.read. Optional mobile class_id intersects class access/grade/explicit subject; class language never implies a subject. Next exposes fixed GET adapters at `/api/admin/curriculum/...`. No private provenance, answer keys, question delivery, authoring or research data is exposed. Older conceptual resources and milestone notes below are not additional implemented APIs.

Current additions through Section 06: PATCH /users/me/preferences, instructor class create/list/details/edit, and student class-enrollment-previews/class-memberships/class-memberships/mine. See CLASSROOMS.md and ENROLLMENT.md for implemented contracts. Earlier milestone status paragraphs below remain historical.

Section 03 now implements /api/v1/usernames/check, POST /api/v1/users, GET /api/v1/sessions/me and POST /api/v1/sessions/revoke, in addition to health. See [IDENTITY_AND_SESSIONS.md](IDENTITY_AND_SESSIONS.md) for actual contracts and security behavior. The resource map below is the earlier conceptual plan; endpoints not listed as implemented remain future work, and /profiles or /usernames/availability are not aliases. FastAPI OpenAPI is the source for generated clients. JSON uses stable IDs, ISO-8601 UTC timestamps and explicit language_track. Lists use bounded cursor pagination. Errors: {error: {code, message, details, request_id}}; details never expose secrets/answer keys. Use 401 missing/invalid session, 403 forbidden, 404 absent or intentionally concealed resource, 409 uniqueness/state conflict, 422 invalid input, 429 throttled, 503 unavailable integration. Log safe request IDs.

## Resource map

| Access | Planned endpoints | Contract / scope |
|---|---|---|
| Public throttled | GET /usernames/availability?username=; POST /profiles | Advisory availability; atomic profile plus device credential issuance. Never retrieve an existing profile by username. |
| Device session | GET /me; PATCH /me; POST /sessions/rotate; DELETE /sessions/current | Server role, mode and onboarding status; constrained profile edits; revoke on logout. No username/password login endpoint. |
| Student session | POST /class-enrollment-previews; POST /class-memberships; GET /class-memberships/mine | Implemented Section 06: code in body, minimal preview and optimistic snapshot version; confirmation revalidates current invitation/class and creates membership idempotently. No separate preview token. See ENROLLMENT.md. |
| Instructor owner | GET/POST /classes; GET/PATCH /classes/{id}; POST /classes/{id}/join-code/rotate; GET /classes/{id}/members | Validate grade, subject, language and ownership; return codes only to authorized class owner. |
| Session, published content | GET /curriculum-versions; GET /grades; GET /subjects; GET /quarters; GET /topics; GET /lessons; GET /lessons/{id} | Filter hierarchy, language and publication state. Admin draft access separately authorized. |
| Instructor owner | GET/POST /classes/{id}/assignments; PATCH /assignments/{id}; POST /assignments/{id}/preview; POST /assignments/{id}/publish | Draft editing; publish frozen question/config versions after validation. |
| Member student | GET /me/assignments; GET /assignments/{id}; POST /assignments/{id}/attempts; PUT /attempts/{id}/responses/{question_id}; POST /attempts/{id}/submit | Attempt limits/server expiry; public question payloads only; atomic idempotent final grading. |
| Instructor owner | GET /assignments/{id}/submissions; GET /classes/{id}/progress; POST /attempts/{id}/feedback | Relevant class data only; no unrestricted personal or research histories. |
| Learner | GET /me/progress; GET /me/scores; GET /me/points; GET /me/reviews/due; POST /reviews/{state_id}/events; GET /me/review-history | Context-specific reviews; optimistic state revision plus event UUID prevents duplicate advancement. |
| Learner | GET /pronunciation-activities; POST /pronunciation-attempts; GET /pronunciation-attempts/{id}; GET /jobs/{id} | Multipart recording, activity/context IDs; 202 if queued. Owner-only job/results. |
| Learner | GET /conversation-topics; POST /conversation-sessions; POST /conversation-sessions/{id}/messages; GET /conversation-sessions/{id}/messages | Selected language/topic; authorized history under retention policy; simulated/provider metadata. |
| Session/owner | GET /me/notifications; PATCH /notifications/{id}; GET/POST /classes/{id}/announcements; GET/POST /messages | Student recipients must belong to instructor class; own-message visibility. |
| Admin identity | GET /admin/auth/config; POST /admin/auth/start; GET /admin/auth/callback; DELETE /admin/session; GET /admin/me | Section 08 implemented provider-neutral OIDC state/nonce/PKCE/MFA and separate cookie sessions; activation requires configuration. |
| Admin permission | GET /admin/dashboard; GET/PATCH /admin/users/{id}; GET /admin/users; GET /admin/classes; GET /admin/enrollments; PUT /admin/users/{id}/roles | Narrow explicit permissions; audited role changes; prevent self-escalation. |
| Admin content | GET/POST/PATCH /admin/{curriculum-resource}; GET/POST /admin/questions; PATCH /admin/questions/{id}; POST /admin/{resource}/{id}/publish or /archive | Allowlisted resources: curriculum-versions, grades, subjects, quarters, topics, lessons, competencies; version-aware edits. No generic arbitrary-table API. |
| Admin AI/content | GET/POST/PATCH /admin/pronunciation-activities; /admin/reference-audio; /admin/conversation-topics; /admin/model-configurations | Validate language capability; no secrets in returned configs. |
| Research permission | GET/POST /admin/research/studies; POST /admin/research/studies/{id}/participants; POST /admin/research/participants/{id}/consents; POST /admin/research/studies/{id}/allocations; POST /admin/research/studies/{id}/lock | Eligibility, consent/assent and protocol checks; audited balanced allocation; locks enforce immutable conditions. |
| Research permission | GET/POST /admin/research/studies/{id}/levels; /assessments; /scheduler-configurations; GET /admin/research/studies/{id}/analytics; POST /admin/research/studies/{id}/exports | Five controlled levels and instrument versions; coded CSV allowlist and download authorization. |
| Enrolled participant | GET /me/research/activities; POST /research/activities/{id}/attempts; POST /research/attempts/{id}/submit | Server resolves participant/group and enforces phase, language, instrument and schedule. Client cannot choose group/scheduler. |
| Admin operations | GET /admin/audit-logs; GET/PATCH /admin/settings | Permission-scoped redacted logs/settings; data handling policy versioning. |

Verb shorthand in this table is planning notation; exact routes/schemas must be materialized and checked for conflicts during implementation. Resource-specific mutation schemas prevent arbitrary role/content fields from being assigned.

## Assessment contracts

Common public item: {id, question_revision_id, method, schema_version, prompt, content, points}. Common response: {question_id, method, schema_version, answer, client_response_latency_ms}. Server checks method against frozen item. Private keys are never part of learner payloads.

| Method identifier | Typed answer payload |
|---|---|
| multiple_choice | {option_id} |
| true_false | {value: boolean} |
| identification | {text} |
| fill_in_the_blank | {blanks: [{blank_id, text}]} |
| multiple_select | {option_ids: []} |
| flashcards | {recall: again\|hard\|good\|easy} |
| error_identification | {selected_token_ids: [], correction?: string} |
| word_arrangement | {ordered_token_ids: []} |
| sentence_arrangement | {ordered_sentence_ids: []} |
| matching_type | {pairs: [{left_id, right_id}]} |

Use discriminated Pydantic unions and generated TypeScript types; reject unknown IDs/duplicates and invalid shapes. Common grading result: {score, max_score, grading_version, feedback, evaluated_at, status}. Feedback/answer release respects assignment policy. Flashcard recall is not evidence of objective accuracy; scored use requires approved rubric (DECISIONS.md).

## Submission and integration semantics

Use Idempotency-Key for profile creation, attempt creation, final submissions, review events and queued audio/conversation requests; scope to principal/operation, reject mismatched-body reuse, and return the committed result on retry. Profile creation needs an anonymous request key policy to handle a lost credential response without permitting account takeover; finalize before implementing this endpoint. Timer starts on server attempt creation; final deadline uses server time. Resume/submission policy requires explicit rubric decisions.

Audio validates size, duration, container/codec and actual content, with private quarantine/storage and owner authorization. Limits are configurable and must be selected before implementation. Jobs return queued/processing/succeeded/failed with safe retry information. Never present failed, unsupported-language or simulated scoring as a measured result. ASR text and pronunciation metrics are separate fields.

Research analytics distinguish review accuracy, client latency, pre/post/delayed scores and pronunciation metrics; report sample sizes and missing data. No invented experimental outcome. CSV exports omit direct identifying fields and record protocol/configuration versions.

## Implemented API status after Section 01

Only GET /api/v1/health is implemented, returning {"status":"ok","service":"fluentt-api"}. This checks application liveness, not PostgreSQL. All other resources above remain plans. Error envelopes and request IDs are implemented at the application boundary; no authentication or domain endpoints exist.


## Section 03 implemented mobile identity

- GET /api/v1/usernames/check?username=... returns username, available and message, with throttling and no profile disclosure.
- POST /api/v1/users accepts exactly username and role (personal_student, school_student or instructor), returning 201 user + issued session; duplicates return 409, invalid input 422.
- GET /api/v1/sessions/me restores the current mobile profile through a Bearer credential; POST /api/v1/sessions/revoke revokes that credential and returns 204. No duplicate restore route or role-update route exists.

Details, examples, 401/429/503 behavior, no-store caching, session lifetimes, stricter new-username policy and recovery limitations are in IDENTITY_AND_SESSIONS.md. These endpoints reuse the Section 02 schema without a migration. PostgreSQL persistence/race verification remains blocked by infrastructure; passing test doubles do not imply live success.

## Section 08 implemented administrator contracts

All backend paths below are under `/api/v1`. Next.js exposes only the listed same-origin adapters; there is no generic admin proxy or registration API. See ADMIN_AUTH.md for exact configuration, provisioning and security requirements.

| Backend | Next.js adapter | Result / protections |
|---|---|---|
| GET /admin/auth/config | GET /api/admin/config | Public `{enabled:boolean}`; no secrets or provider metadata. |
| POST /admin/auth/start | POST /api/admin/start | Exact Origin; process-local throttle; configured OIDC required; 303 provider redirect + ten-minute HttpOnly binding cookie. No credential fields. |
| GET /admin/auth/callback | GET /api/admin/callback | Code/state/error/iss query; browser-bound one-use attempt, PKCE/nonce/signature/claim/MFA checks and explicit mapped-admin permission. 303 dashboard or generic sign-in failure; successful callback sets session cookie. |
| GET /admin/me | GET /api/admin/me | Dedicated cookie only; active admin + dashboard.view. Returns username, administrator role, permission codes, CSRF token, idle expires_at and absolute_expires_at. Raw session secret is never JSON. |
| DELETE /admin/session | DELETE /api/admin/session | Dedicated cookie + exact Origin + X-CSRF-Token; atomic current-session revocation/audit, 204 and cookie removal. |

Protected session endpoints return 401 for absent/expired/revoked/ineligible sessions or any Authorization header, 403 for Origin/CSRF rejection, 503 for missing/unavailable database, and redacted existing error envelopes. Start/callback share a default 10-per-peer/process/window throttle (429 with Retry-After); production global limits remain prerequisites. Callback credential/provider denials redirect to the same safe failure page. Configuration absence returns 503 before opening a database for start/callback. Every admin response is no-store.

There is no `/admin/dashboard` analytics endpoint, account-management API, password endpoint, refresh-token exchange, public provisioning or web revoke-other-session API in Section 08. Operator CLI provisioning/disable/revoke-all is the approved operational surface. Mobile endpoints and contracts remain unchanged.

## Personal focus request extension — 2026-10-19

Mobile Profile responses include nullable learning_focus. PATCH /users/me/preferences accepts learning_focus={topics:[...],lessons:[...]} only for personal learners. Supply 1–20 requests total, at most 10 per list, each distinct within its list, trimmed and 1–120 Unicode code points. The UI accepts one request per line, so newlines separate labels rather than becoming part of them. This is self-described preference metadata; it does not identify a published curriculum node, deliver an activity, infer mastery or create progress. Focus plus language is sufficient for new personal onboarding; the optional legacy grade field and all historical values are retained for compatibility. See IDENTITY_AND_SESSIONS.md and migration 0013_learning_focus.
