# API design

Section 03 now implements /api/v1/usernames/check, POST /api/v1/users, GET /api/v1/sessions/me and POST /api/v1/sessions/revoke, in addition to health. See [IDENTITY_AND_SESSIONS.md](IDENTITY_AND_SESSIONS.md) for actual contracts and security behavior. The resource map below is the earlier conceptual plan; endpoints not listed as implemented remain future work, and /profiles or /usernames/availability are not aliases. FastAPI OpenAPI is the source for generated clients. JSON uses stable IDs, ISO-8601 UTC timestamps and explicit language_track. Lists use bounded cursor pagination. Errors: {error: {code, message, details, request_id}}; details never expose secrets/answer keys. Use 401 missing/invalid session, 403 forbidden, 404 absent or intentionally concealed resource, 409 uniqueness/state conflict, 422 invalid input, 429 throttled, 503 unavailable integration. Log safe request IDs.

## Resource map

| Access | Planned endpoints | Contract / scope |
|---|---|---|
| Public throttled | GET /usernames/availability?username=; POST /profiles | Advisory availability; atomic profile plus device credential issuance. Never retrieve an existing profile by username. |
| Device session | GET /me; PATCH /me; POST /sessions/rotate; DELETE /sessions/current | Server role, mode and onboarding status; constrained profile edits; revoke on logout. No username/password login endpoint. |
| Student session | POST /class-enrollment-previews; POST /class-memberships | Code in body, minimal class preview and short-lived enrollment reference; confirmation revalidates current code/class and creates membership idempotently. |
| Instructor owner | GET/POST /classes; GET/PATCH /classes/{id}; POST /classes/{id}/join-code/rotate; GET /classes/{id}/members | Validate grade, subject, language and ownership; return codes only to authorized class owner. |
| Session, published content | GET /curriculum-versions; GET /grades; GET /subjects; GET /quarters; GET /topics; GET /lessons; GET /lessons/{id} | Filter hierarchy, language and publication state. Admin draft access separately authorized. |
| Instructor owner | GET/POST /classes/{id}/assignments; PATCH /assignments/{id}; POST /assignments/{id}/preview; POST /assignments/{id}/publish | Draft editing; publish frozen question/config versions after validation. |
| Member student | GET /me/assignments; GET /assignments/{id}; POST /assignments/{id}/attempts; PUT /attempts/{id}/responses/{question_id}; POST /attempts/{id}/submit | Attempt limits/server expiry; public question payloads only; atomic idempotent final grading. |
| Instructor owner | GET /assignments/{id}/submissions; GET /classes/{id}/progress; POST /attempts/{id}/feedback | Relevant class data only; no unrestricted personal or research histories. |
| Learner | GET /me/progress; GET /me/scores; GET /me/points; GET /me/reviews/due; POST /reviews/{state_id}/events; GET /me/review-history | Context-specific reviews; optimistic state revision plus event UUID prevents duplicate advancement. |
| Learner | GET /pronunciation-activities; POST /pronunciation-attempts; GET /pronunciation-attempts/{id}; GET /jobs/{id} | Multipart recording, activity/context IDs; 202 if queued. Owner-only job/results. |
| Learner | GET /conversation-topics; POST /conversation-sessions; POST /conversation-sessions/{id}/messages; GET /conversation-sessions/{id}/messages | Selected language/topic; authorized history under retention policy; simulated/provider metadata. |
| Session/owner | GET /me/notifications; PATCH /notifications/{id}; GET/POST /classes/{id}/announcements; GET/POST /messages | Student recipients must belong to instructor class; own-message visibility. |
| Admin identity | GET /admin/auth/start; GET /admin/auth/callback; DELETE /admin/session; GET /admin/me | OIDC state/nonce/PKCE and secure web session; provider pending. |
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
