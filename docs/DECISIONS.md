# Decisions and constraints

## Section 25 approved communication decisions — 2026-10-19

The user approved all three recommended policies: owned-class announcements without replies plus class-scoped one-to-one instructor/current-school-student messages initiated by either participant; no peer, personal or admin chat. Live eligible enrollment/class/owner access gates every read/write, later members see announcements, direct history is participant-only, leaving/removal/disablement hides retained history and eligible rejoin restores it. Sent content is immutable, no editing/deletion/attachments; retain synthetic demo records without inventing a production purge schedule. Real-student retention and moderation remain OPEN before deployment. Plain text is 1–4,000 Unicode code points, blank-only rejected and accepted text preserved, server timestamps, UUID sender-scoped idempotency, bounded history and manual refresh. Read marking is explicit per viewer, never shared participant receipts. No automatic keys/grades/research data, push, WebSockets or typing indicators. Additive class context supplements the existing recipient-XOR-class destination; legacy rows remain untouched and excluded.

## Section 24 approved monitoring decisions — 2026-10-19

The user explicitly approved all three recommended monitoring policies: (1) instructor-owned active classes and current eligible active school memberships only, no former/disabled/personal/research data, aggregate points released-only; (2) submission-counts-v1 denominators A×S per class, A per student and S per assignment, no percentage/mastery, finalized incomplete/withheld/manual work still submitted, pinned lesson/edition filters without curriculum coverage; (3) released-assignment-mean-v1 includes only released COMPLETE runs of the same assignment version with identical engine/policy/max, Decimal mean rounded once to two places ROUND_HALF_UP, with cohort/exclusion counts, unavailable when empty and not_comparable for mixed contracts. No cross-assignment/class mean or academic grade. Section 22's separately authorized instructor review/release remains unchanged. No new writer, score, grade override, notification or research policy is approved.

## Section 23 approved decisions

- User approved submission counts: each currently available published assignment once; not started, in progress or finalized/submitted, even with unanswered questions or withheld/manual results. Display submitted/available counts without a completion percentage or mastery claim; no available assignments is an empty state. New publications and current membership change the denominator.
- User approved own currently eligible class records only, preserving class and pinned lesson/edition identity, pending entries, real timestamps and class/status/date filters. Scores require the exact released run; no combined average or cross-class academic grade. Leaving/removal hides that class, eligible rejoining restores retained history without duplication.
- User approved explicit unavailable personal tracking and no module/lesson mastery/completion, streak, retention, due-review, pronunciation or research metrics without an approved measured writer/algorithm. Existing progress/scheduler records remain untouched.
- Progress is a read projection, not a new analytics engine or event store. Existing published/capture/release contracts and tables suffice. PROGRESS.md defines query, lock, pagination and privacy rules; no migration or instructor permission is added.

## Section 22 approved decisions

- User approved owning-instructor explicit release of existing COMPLETE ordinary-classroom evaluations, including earlier unscored captures; label equal-point objective evaluation rather than original examination grade. Grading execution stays administrator-only and nothing runs/releases automatically.
- User approved current eligible membership/ownership on every read; students see status only before release, then actual totals, per-item correctness/points, pinned fronts and their own original responses. Keys, expected answers, private rubrics/explanations and Flashcard backs remain hidden. Instructor reads exclude former/ineligible members and research data.
- User approved one permanently pinned immutable run per attempt, confirmed release/withdraw/re-release of that same run, freshness/replay protection and retained history. Review/unsupported runs cannot release; all-Flashcards have no objective score. No replacement run, score edits, instructor-written feedback, academic invalidation or controlled-research release policy is inferred.
- Additive 0011_result_release stores append-only decisions without modifying captures or grading runs. RESULTS_AND_FEEDBACK.md specifies transaction/lock handling and safe disclosure.

## Section 21 approved internal objective grading — 2026-10-19

- User approved exact option/boolean, unordered-set, full sequence and complete pair comparisons; Identification uses authored accepted strings with casefold only when its stored case_sensitive is false; blanks are fully exact/case-sensitive. No trimming, normalization, inferred synonyms/spelling tolerance, partial credit or penalties. Valid missing/incomplete objective responses receive zero; malformed evidence is flagged.
- User approved 1.00 per objective item in a separate versioned evaluation policy, exact Decimal totals and no percentage/letter/rounding conversion. Flashcards are NOT APPLICABLE, not objective recall scores. Missing/unlocked/inconsistent evidence requires manual review; unknown schema/policy is unsupported. Unresolved overall totals remain unset; automatic subtotals are labeled. Pinned retired content remains historical evidence.
- User approved separate immutable run/item evaluations of existing finalized Section 20 classroom captures, explicit operator-granted grading.read/run and no automatic grants. Captures/answers/published limits remain unchanged; no student/instructor access, grading-on-submit, release UI or research grading. Additive 0010 creates two tables (62 total); GRADING.md defines the engine/source-key/applied-policy distinction and future release prerequisites.

## Section 20 approved capture policies — 2026-10-19

- User approved one unscored resumable capture attempt per student/pinned publication, no retakes/deadlines/timers, current membership for every operation, and retention/resumption after access suspension. Distribution-only versions and unset assignment policies remain immutable; new unscored-capture-v1 lives on attempts under additive 0009 guards.
- User approved explicit Save progress without autosave/insecure local persistence, validated partial raw buffers and saved position, confirmed incomplete final submission, immutable final answers and receipt-only access. Identical final requests safely replay; changed payloads/stale edits conflict. No grading, correctness feedback, latency or research telemetry.
- User approved deliberate attempt-scoped pinned Flashcard back reveal, remembered reveal IDs and revisable subjective recall before final submission. No backs in general reads; all other keys/rubrics stay hidden. Independent practice/scheduling semantics are unchanged.

## Section 19 approved publication policies — 2026-10-19

- User approved distribution-only-v1 publication: at least one eligible pinned question, immutable published version/root, unset points/max_attempts, no dates/timer/grading, close/archive/edit/new-version or attempts. Additive 0008 explicitly permits that freeze while rejecting executable attempts; preserve configured legacy values for operator review.
- User approved explicit instructor confirmation to bind an unbound class to the selected lesson subject atomically with Publish, after checking retained assignment/lesson-progress context. Bound mismatch/conflicts reject; language never implies subject.
- User approved immediate visibility to all currently eligible active members including later joiners/rejoiners, with removal/leave/class or owner deactivation denying access. Pinned publications survive curriculum/question retirement. No cohorts, per-student assignment records or notifications.
- Student reads expose metadata/context/count/methods only; questions, private keys/backs and answering wait for Section 20 approval. Publish uses If-Match plus durable version/request UUID replay and a safe actor audit. No attempt/scoring policy is inferred.

## Section 18 approved draft policies — 2026-10-19

- User approved one published lesson per draft, same-lesson exact locked question revisions, matching class grade/language and bound subject. Unbound classes keep null subject; snapshot the explicitly selected lesson subject and require explicit binding before Section 19 publication.
- User approved all-ten published front-only instructor previews, including no Flashcard backs, one stable Question per draft, retained owner-only pinned history after retirement and revalidation before edits. Archive rather than hard-delete; no restore, publication or attempts.
- User approved title 1–200, optional instructions up to 8,000, 0–200 ordered items, fixed class, UUID creation idempotency and If-Match edits/archive. Migration 0007 permits NULL draft item points/max_attempts; preserve existing values and require configuration before future locking. No scoring/timer/attempt/release policy is inferred.

## Section 17 approved practice boundary — 2026-10-19

- User approved unchanged Flashcards cue/private-back schema, existing editor key permissions and component-only mobile practice with separately supplied authorized version-bound backs. No new learner delivery/history/event API or QuestionRevision/VocabularyItem association. Read-only admin preview stays front-only; private reveal needs live read+write.
- User approved optional subjective ratings after reveal: again=could not recall, hard=with difficulty, good=with some effort, easy=readily. One per visit, authored order, fresh reveal/rating on navigation and confirmed exit. No objective scoring, timing collection, persistence or scheduler update.
- General practice persistence is OPEN under the prompt's explicit fallback. Existing vocabulary events require scheduler state/configuration/intervals and do not imply permission for unscheduled telemetry. No placeholder scheduler or fake intervals. Retention, ownership/history, event ordering/idempotency, content eligibility and version links require a future approved contract. Classroom identity does not imply research consent; no experimental collection by default.
- All ten method interfaces are now supported. Scheduler work remains Sections 28–31 and research execution 36–38 per the authoritative prompt; provisional roadmap numbering is superseded.

## Section 16 matching policy — 2026-10-19

- Existing accepted V1 keys are complete one-to-one mappings, with distinct IDs per side, equal complete set sizes and repeated labels permitted. No reused-target schema extension is approved or needed.
- User approved independent authored set order, no shuffle, initially empty preview, left-then-right association, reassignment clearing the target's prior owner, review/remove/reset and serialization in authored left order. Readiness is structural completeness only; scoring remains deferred.
- Matching extends existing editor/BFF and component-only mobile boundaries. No endpoint, migration, permission, dependency or backend application change. All ten contracts remain; only nine have interfaces because Flashcards is still deferred. The prompt's completion count does not authorize adding Flashcards.

## Section 15 approved sequencing policy — 2026-10-19

- User approved authored public item order independent of private expected order, no automatic shuffling, initially empty learner sequences, tap-to-append with move/remove/reset, and readiness only when every stable ID appears once. Alternative valid orders and grading remain deferred.
- Reuse word_arrangement/sentence_arrangement V1 items (minimum two) and private ordered_ids full permutation. Whole explicit units preserve repeated labels through distinct IDs; no automatic token/sentence splitting or Unicode normalization. Author metadata retains existing trimming semantics.
- Public reorder/text edits never rewrite private expected order. Removal removes the reference; new units require deliberate inclusion. The editor warns if visible order equals the private sequence; private-field omission cannot prevent semantic hints in author-supplied content.
- Ready means structural completeness only, never correctness. Complete typed callbacks copy IDs in learner order; existing partial backend response contracts remain unchanged. No migration, API, permission, dependency, grading, persistence, drag infrastructure or runtime auth bypass is introduced. Host scrolling/blur/session cleanup and real provider/native verification remain prerequisites for later learner delivery.

## Section 14 approved set/token policies — 2026-10-18; verified 2026-10-19

- User approved preserving Multiple Select's existing one-or-more correct IDs, no public selection bounds, unfinished zero-selection previews and deterministic content-order response serialization. Do not infer all-or-nothing, partial credit or required learner counts from private keys.
- User approved whole ordered token segments for Error Identification, supporting multiple target IDs. No character offsets/spans or Unicode slicing, learner correction entry or published-payload rewrite. Strict existing schemas reject offset/span alternatives; overlap is unrepresentable, not an implemented span feature.
- Preserve optional private accepted_corrections metadata, including existing non-target known-token entries/empty arrays. The advanced JSON editor avoids inventing grammar/correction rules; removing a token removes its target/correction references. Invalid JSON requires explicit correction before saving.
- Reuse the six-method shared editor/BFF, existing backend services/permissions/version locks and choice styling. No new API, migration, permission, dependency, real content/admin seed or runtime auth bypass. Safe components emit only selected canonical IDs; hosts retain Screen/blur/session cleanup responsibilities.

## Section 13 approved text-method contracts — 2026-10-18

- User approved optional input_max_length on the existing JSON contents: strict integer 1–2,000 Unicode code points, new editor default 500, absent for legacy items. No implicit limit or rewrite of existing/published rows. Expected metadata must fit a declared limit; this is structural validity, not grading.
- User approved opt-in template_syntax="double-brace-v1": exact {{blank_id}} markers, each exactly once in blank_ids order; reject malformed/nested/unknown/missing markers. Braces are reserved for this tagged syntax. The editor saves stable gaps in passage order and shows paired gap fields; untagged legacy prompts stay literal and keep saved order.
- The explicit Section 13 raw-response requirement supersedes TextValue's earlier stripping for Identification/blank response text only. Nonblank validation returns the original value. Case, whitespace, accents, punctuation, combining forms and synonyms are never transformed or evaluated. Private expected-answer metadata keeps its established semantics and remains hidden from previews.
- Extend the same protected editor/BFF to four methods with no new endpoint/permission/schema migration/dependency. Keep mobile rendering component-only, without bank fetching, delivery, submission or scoring. Hosts own blur/session cleanup and Screen scrolling/keyboard avoidance. Existing optional partial drafts remain valid; explicit require_complete checks exact blank coverage.
- Real OIDC/MFA/TLS remains disabled/unverified until configured; synthetic browser/database fixtures are not production accounts or educational content. No future method or grading/feedback policy is authorized.

## Section 12 implementation boundary — 2026-10-18

- The supplied prompt authorizes administrator Multiple Choice/True or False editors and unscored mobile components under Section 11's existing permissions and lifecycle. No new product/grading policy or permission grant is inferred.
- Existing ordered options/single correct_option_id and empty-content/strict boolean contracts are unchanged. Option IDs survive reorder/edit; boolean false remains distinct from missing. Text only; other eight editors, media, scoring and learner delivery stay deferred.
- Next uses a fixed same-origin question BFF; public previews explicitly project safe fields. Native components expose controlled typed selection plus a resettable unscored host, without adding any route or bank-fetch/submission capability. Future route hosts own blur/attempt-state cleanup.
- Ambiguous initial save responses, including gateway/server 5xx, require reconciliation instead of assuming a failed POST did not commit. Question state clears before sign-out begins. No browser token/draft persistence, new dependency, migration, real content/admin seed or auth bypass.

## Section 11 approved policies — 2026-10-18

- User approved stable Question identities and locked QuestionRevision publications; corrections use new revision IDs, retirement archives the whole item and history remains intact. Competencies belong to the revision's lesson; publication requires published, unretired curriculum ancestry.
- User approved separate operator-granted questions.read/write/publish. Editor=read+write; publisher=read+publish; publication/retirement require all three. Private key reads require write; curriculum roles confer nothing implicitly.
- User approved admin-preview-only retrieval and key-free DTOs for later authorized delivery. No mobile bank/submission API or scoring is implemented; ungraded-v1 is the only authoring grading marker. Existing partial response and ten-method V1 semantics remain unchanged.
- Additive 0006 guards same-lesson links in both edit directions without rewriting data. Inconsistent history aborts for operator review. Bank writers coordinate with curriculum under advisory 78090001, lock Question before freshness/version allocation, and keep authorization/write/audit atomic.
- Draft replacement validates complete payloads and removes the old unlocked key before content/key replacement, preserving existing ORM hooks. No hard-delete, automatic clone, seeded content, real admin grant or new dependency. QUESTION_BANK.md records request budgets and pending normalization/rubric/randomization/release policies.

## Section 10 approved policies — 2026-10-18

- The user approved the recommended hierarchy, publication and permission policies, explicitly correcting an accidental permission selection. Manage existing version/grade/subject/quarter/topic/lesson/competency structure plus global subjects. No new module/level, rich lesson-body model or language-to-subject inference.
- Only unfrozen/unreferenced drafts may be edited, reordered, reparented or removed. Removal is single-node RESTRICT, with no cascade. Published editions retire as a whole, cannot unretire, and corrections require a new edition/child IDs. Shared subjects referenced by frozen editions or classes remain immutable.
- Publication adds no review role/status. A publisher confirms review and supplies nonempty source/licensing references and review note. Require at least one complete grade→subject→quarter→topic→lesson→competency branch and no empty included parent. Do not require all grades/four quarters or invent lesson counts. Publish all topics/lessons before freezing the root in one transaction; retain review evidence/actor privately and in audits. Do not promote academic verification_status.
- Operator-only curriculum_editor grants read+write; curriculum_publisher grants read+publish. Publish/retire require all three. Existing/default administrators gain nothing automatically. Reader commands remain compatible; managed roles reject unexpected permissions and revocation rejects alternate grants of the controlled permission.
- If-Match hashes the entire edition plus referenced labels; child creates compare parent state, moves also compare target_revision. These are freshness markers, not credentials. Structural reads/writes and authorized mutations retain the existing shared/exclusive advisory boundary and one authorization/write/audit transaction.
- No migration, dependency, real curriculum seed, production admin grant or OIDC configuration is added. Current PostgreSQL/browser verification is documented in SECTION_10_REPORT.md; real provider/TLS and production operational grants remain prerequisites.

## Post-Section 09 repair and verification — 2026-10-18

- The user authorized local repair/testing and reported unknown earlier database history. Preserve frozen 0001–0004 and all unrelated work. Reproduced frozen 0001's duplicate-constraint failure on a generated disposable PostgreSQL database (SQLSTATE 42P07).
- Fresh verified-empty databases use an explicit Alembic naming adapter that rewrites exactly three CREATE TABLE constraint declarations at execution, never on disk. Existing databases reject this option. Additive 0005 converges the three names by constraint column signature without dropping constraints or changing records; its downgrade keeps valid names. Unknown deployments require inspection/backups before any upgrade, never reset/stamp.
- A separate password-protected PostgreSQL 17 cluster/database is configured locally on 127.0.0.1:55432; its runtime, password, data and logs are ignored. Existing environment settings were preserved while adding the backend database URL. This development owner credential is not a production runtime grant design.
- The user has no OIDC provider yet and explicitly requested that administrator sign-in remain disabled. No real administrator or provider mapping is provisioned. Real provider MFA/TLS activation remains pending; synthetic test identities stay in disposable tests.
- See LOCAL_VERIFICATION_REPORT.md for current evidence; older section reports retain their milestone results.

## Section 09 approved curriculum decisions

- Preserve version → grade → subject → quarter → topic → lesson → competency and original UUIDs. Five research levels remain separate study snapshots, not replacement modules/quarters. Filipino is a subject; Tagalog is a language. Sources, academic compatibility, lesson bodies and publication completeness remain open before authoring.
- The user approved published browsing for all authenticated mobile roles and class-scoped reads requiring owner/eligible membership plus actual grade/explicit subject. An unconfigured subject gives an empty state; no language-to-subject inference or implicit current edition.
- The user approved curriculum.read for admin draft/retired reads and explicit operator-only grant/revoke commands. Default admin provisioning remains dashboard-only. Backend read authorization and queries share one transaction; Next adds fixed GET proxy paths only.
- The user accepted recommended whole-version snapshots: freeze published hierarchy, retire through archived status, correct with new version/child IDs. Migration 0004 adds guards and protects legacy assignment/progress references without rewriting tables, data or frozen migrations. A coarse shared/exclusive transaction advisory boundary protects structural consistency; future writers must lock before DML and review conflict handling.
- Section 09 returns structure/competencies only; private provenance, question/key payloads, media/AI and research data are excluded. Existing content associations and open academic policies are documented in CURRICULUM.md. Frozen-0001 naming collisions and PostgreSQL/OIDC activation remain unresolved gates.

All decisions are planned baselines, not implemented controls. Preserve the approved Section 00 requirements across later sessions.

| ID | Decision | Reason / revision boundary |
|---|---|---|
| D01 | Modular monorepo, one FastAPI backend, PostgreSQL | Simple shared authorization and transactions; no direct frontend database access. |
| D02 | Expo Router for the shared student/instructor Expo TypeScript app | Consistent navigation; administrator is a separate Next.js TypeScript site. |
| D03 | REST /api/v1, JSON and multipart audio | Vendor-independent frontend contracts; generated TS client later. |
| D04 | Passwordless profile creation plus opaque device sessions | Required mobile flow; usernames never authenticate. |
| D05 | Separate secure administrator authentication | Section 08 approves provider-neutral OIDC with provider-enforced MFA, operator-only provisioning and separate browser sessions; sign-in disabled until issuer/client/accepted MFA evidence are configured. See ADMIN_AUTH.md. |
| D06 | Curriculum subject distinct from learning language | Filipino can be a subject while Tagalog is a learning track. |
| D07 | Version published content, grading rules, schedulers and models | Preserve completed activity and research reproducibility. |
| D08 | Exactly ten assessment methods | Speech and conversation remain independent activities. |
| D09 | Adapter boundaries and explicitly simulated providers | No trained/validated model or ESR integration is assumed. |
| D10 | Separate approved research participation and locked study context | Class enrollment cannot imply consent or group eligibility. |
| D11 | Online-first submissions | Offline graded activity and multi-device recovery need separate design. |

## Username normalization

Reversible initial policy: trim surrounding whitespace, accept only ASCII letters, digits and underscore, 3–32 characters, and lowercase ASCII for the canonical key. Store display spelling separately. Enforce canonical uniqueness in PostgreSQL across every user role, including administrative profiles, with a unique constraint. Reject unsupported Unicode rather than guessing transliterations. Availability checks are advisory; atomic creation resolves races with a conflict response. Changing to internationalized usernames requires an explicit migration and collision policy.

## Mobile session design

Backend issues cryptographically random opaque tokens with at least 256 bits of entropy; store only their digest, user/device association, creation, expiry and revocation metadata. Return the secret only at issuance. Expo secure device storage holds credentials; never ordinary app storage or logs. Send via HTTPS Authorization bearer header. Validate expiry/revocation on every request; route by server role and onboarding status. Suggested initial rolling expiry is 30 days with a 90-day absolute lifetime, configurable and subject to usability review. Rotation invalidates the previous token atomically; lost rotation responses require an explicit later retry design. Revoke sessions on sign-out and administrative disablement. Never recover by matching a username. Reinstall/lost-device recovery and adding another device are unresolved; do not collect passwords or silently invent recovery.

Profile creation issues a session in the same transaction. Rate-limit profile creation and username probes. Self-selected instructor status permits management only of their own classes. Six-digit join codes are strings (leading zeros allowed), generated with secure randomness, unique among active codes, with expiry/rotation/revocation and bounded collision retries. Apply per-session and network rate limits, generic invalid-code errors, and minimal preview data; enrollment requires authenticated explicit confirmation.

## Admin and authorization

Planned default is OIDC authorization-code flow with PKCE and MFA via a maintained provider, mapped to a local admin role/permission record. Backend verifies identity and local authorization. Use Secure, HttpOnly, SameSite cookies for web sessions, CSRF protection for cookie-authenticated mutations and explicit CORS origins. Do not store admin tokens in browser local storage. Provider choice and initial administrator provisioning require decisions before admin implementation. Staff privileges cannot be self-assigned through mobile profile creation.

Permissions distinguish content editing, user management, research administration and coded exports. Check object ownership and research scope on every resource, including audio downloads and job polling. Audit sensitive mutations/exports without storing secrets. Instructors cannot change locked experimental content or see consent documents by default.

## Assumptions and unresolved risks

- Prompts 01–39 are not available; roadmap slots are provisional and cannot authorize later work.
- Exact grade/subject/language compatibility, curriculum sources and verification workflow need content-owner approval. Nothing is DepEd-verified yet.
- Minor consent/assent procedures, ethics approval, identity access, retention/deletion periods and hosting/data residency must be set before real research or child data collection.
- Recovery, instructor verification, multi-class student policy and switching between personal/school modes require product decisions. Relational membership supports future multiple classes; first onboarding joins one.
- Timer behavior, partial credit, flashcard scoring, response normalization and late/duplicate submission rules require approved rubrics. Server time controls deadlines; record UTC and display local time.
- ESR fusion and FIFAKT training/compatibility are research dependencies. Tagalog pronunciation validity is unestablished. Failed or unavailable scoring must be explicit, not fabricated.
- LLM suitability, cost, abuse handling and age-appropriate topic boundaries need evaluation. External providers must satisfy approved data handling before real use.
- Six-digit codes have limited space; monitor active-code capacity and guessing. Username impersonation risks remain despite unique names; identity verification is a separate concern.
- Speech duration, formats, upload limits, storage provider and worker infrastructure require sizing before speech implementation.

## Section 01 prerequisites

Receive the actual Section 01 prompt, reconcile its scope with this baseline, confirm development runtime/tool availability, choose compatible locked versions and establish repository/version-control policy. No blocker prevents documentation completion; these choices are deferred to their implementation gates.

## Section 01 implementation update

The Section 01 prompt authorizes the runnable foundation, and explicitly schedules real administrator authentication for Section 08, superseding the provisional Section 00 slot. Retain apps/mobile, apps/admin and services/api from the approved architecture, with independently managed npm dependencies and backend virtual environment. Expo Router remains the only navigation approach. Health is application liveness only; database configuration is optional and lazy, with no schema/migrations until Section 02. Both frontends use separate centralized API clients until generated domain contracts are warranted.

The official starters selected Expo SDK 58 / React Native 0.88 / React 19.3 and Next.js 16.4.2 / React 19.3. Node 24.11.0 and Python 3.11.8 are available. Exact resolved dependencies are recorded in application lockfiles and backend requirements.lock.txt. Public health diagnostics grant no administrator access. Section 00 inspection notes remain historical; README.md and SECTION_01_REPORT.md describe the implemented foundation.

## Dependency audit after Section 01

Compatible npm audit fixes were applied. Remaining audit findings: mobile 27 (19 high, 8 moderate); admin 5 high. Reported roots include braces (build/lint glob matching), node-forge (Expo tooling) and uuid (Xcode tooling). The available automatic forced fixes propose incompatible framework downgrades; these were not applied. This foundation is for local development; review upstream patches and dependency advisory applicability before deployment. One backend test dependency emits a Starlette/AnyIO deprecation warning; tests pass. No production security certification is claimed.

A root Git repository was initialized without staging or committing. Expo's generated starter Git metadata was preserved at apps/mobile/.expo/generated-starter.git (ignored) to avoid nesting repositories; project source files are tracked from the root when the user chooses to commit.

## Section 02 decisions

- Retain synchronous SQLAlchemy 2.x with psycopg. Request sessions close/roll back reliably; services explicitly commit. No create_all or startup migrations.
- Use UUID keys, timezone-aware timestamps, named VARCHAR/CHECK enums, RESTRICT history references and JSONB only for structured variable content/state/results. Code/username uniqueness is database-enforced. Canonical usernames are computed with C collation to preserve the ASCII normalization rule across database locales.
- Separate stable question/assignment identities from immutable-when-locked versions. PostgreSQL triggers serialize child changes against publication and protect frozen keys/items. Full storage configuration/response structure validation uses Pydantic and ordinary ORM hooks; raw/bulk SQL bypasses those Python hooks and is prohibited for future unvalidated content writes.
- Research identifying links and consent evidence references use research_private with PUBLIC privileges revoked. Research learning contexts forbid ordinary user IDs. Database owners/superusers still have access; production runtime grants and application authorization must be configured before real use.
- Study/group targets default to 30/15 but remain configurable; future protocol validation enforces allocation. The accepted Section 02 prompt schedules enrollment/randomization/experiment execution in Sections 36–38, superseding provisional roadmap slots.
- No raw speech storage. Conversation retention defaults off and requires policy/version/deadline to store messages; deletion workers and actual consent checks remain future work.
- Initial migration is a frozen PostgreSQL DDL snapshot generated from current metadata plus explicit guard functions. Later changes require new migrations. Autogeneration does not maintain guard functions/grants.
- No installed PostgreSQL/Docker tools or reachable local port 5432 were found. No database URL was configured. Integration tests are present and skipped; offline compile success is not live PostgreSQL validation. Docker Compose and native Windows setup instructions are supplied without installing infrastructure or touching existing databases.

## Section 03 security decisions

- New public usernames follow 3–24 ASCII characters with no surrounding whitespace and four case-insensitive reserved names (admin, administrator, system, support). Retain the existing 3–32 storage/ORM policy for compatibility; no existing username is renamed or invalidated. Both normalize to lowercase ASCII, matching the C-collation generated column and global unique constraint.
- Reuse users/user_sessions/learner_profiles/instructor_profiles. No table or migration changes. New profile, subtype and session hash commit atomically; PostgreSQL uniqueness remains authoritative for racing registrations. Public input rejects administrator roles, client IDs/statuses and extra fields.
- Use an opaque flt_ token with 32 cryptographically random bytes; store SHA-256 only. Return the raw credential once after commit, hide it from object representations, authenticate via Authorization Bearer and disable identity response caching. No password flow, JWT, username-based restore or public role mutation.
- Valid requests slide the existing 30-day inactivity expiry within its original 90-day absolute bound. Revocation and authentication lock the session/user rows; inaccessible statuses and non-mobile roles receive generic 401. Multiple records are supported without a public device-pairing/recovery path.
- GET /sessions/me is the single restoration route; POST /sessions/revoke handles current-session logout. No duplicate restore or profile-update endpoint is needed for this section. Section 04 must use secure device storage, preserve credentials on temporary errors and derive routes from the returned server profile.
- Issuance response loss is not solved by matching usernames or replaying a raw secret. Creation idempotency/recovery from the conceptual API plan is deliberately deferred to a reviewed ownership protocol. A retry after a successful commit gets 409; it cannot claim that identity or redisclose the secret.
- Add bounded per-peer/per-process fixed-window throttling. Defaults: checks 30, creation attempts 10, session requests 60 per 60 seconds. Before public production/scaling, enforce global edge limits and configure only trusted proxy addresses. Identity endpoints require HTTPS in production. See IDENTITY_AND_SESSIONS.md for deployment and logging boundaries.
- PostgreSQL remains unavailable and unconfigured for local live tests. Test-only repository doubles are not runtime fallbacks. Live persistence, revocation and race tests remain pending; no existing database was changed.


## Section 04 decisions

- Extend the existing learner profile fields; no schema change or competing preference table. PATCH /users/me/preferences accepts only optional non-null grade (strict integer 1–12) and language (english/tagalog). Authentication, user/session locks and preference writes share one transaction. School/instructor roles receive 403; user ID and role cannot be supplied.
- When saving a grade, insert its standard Grade N reference label only if missing, using PostgreSQL ON CONFLICT(number) DO NOTHING. Preserve any existing ID/name. This is reference data, not seeded curriculum, and needs no migration; 0001_initial remains immutable.
- Personal profile becomes active only when both stored preferences exist. Read preferences on GET /sessions/me. School/instructor completion remains controlled by future class/enrollment services, never local flags.
- SecureStore is used on Android/iOS. The web app is explicitly a navigation preview and blocks creation before issuance rather than persisting credentials in browser storage. No change-user or logout action existed, so none is introduced.
- Secure-save failure retains issuance only in provider memory for an explicit secure-save retry. Creation is single-flight; retrying persistence does not POST again. Force-closing before successful persistence can still lose access; account recovery remains unresolved. A lost HTTP creation response can reserve the username; do not interpret a duplicate as authentication.
- First-class and join-code inputs are unsaved drafts with explicit future boundaries. They make no fake requests, show no simulated successful saving/enrollment and generate no code.

## Section 05 decisions

- The approved create-class form specifies grade and learning language but no curriculum subject. Make classes.subject_id nullable in additive revision 0002, retaining the FK and existing values. Leave it null on creation rather than invent subject records or equate Tagalog with the Filipino subject. Later curriculum assignment must explicitly configure/validate subject before publication.
- Reserve each join code permanently across historical class_join_codes rows with a unique constraint, in addition to the existing active-code indexes. Secure random six-digit allocation uses 12 savepoint retries; exhaustion rolls back the class. Historical duplicate-code data blocks upgrade with an actionable exception instead of deletion/relabeling.
- Require a UUID Idempotency-Key on POST /classes; unique owner/request identity prevents repeated or lost-response retries from creating duplicate classes. Requests for the same instructor serialize under the authenticated user lock. Same key and normalized fields replay 201; different fields conflict. Mobile retains pending request data/key only in memory. Restoration reads class existence, never automatically creates a class.
- Permit grade/language edits only for empty, subject-unbound classes with no historical membership, assignments, learning contexts or messages. Lock the class before checking. Existing context remains unchanged on conflict; owner/name/description edits never rotate codes. Future enrollment/content services must share class-lock/validation order.
- Invitation codes are owner-visible enrollment invitations, not device credentials. No enrollment/preview endpoint, rotation/revocation or class archival action is implemented. Copy/share uses Expo Clipboard and React Native Share, with cancellation/failure feedback and no delivery claim.

## Section 06 approved decisions

- User-approved policy: multiple active classes are allowed. Initial onboarding joins one; My Classes lists eligible memberships and permits another invitation entry. This resolves the earlier open multi-class policy.
- User-approved policy: students who left may rejoin with a new historical membership row; any prior instructor removal from the class blocks self-enrollment. Removal/departure/reinstatement workflows are not implemented here. No old row is rewritten or deleted to rejoin.
- Duplicate confirmation returns the existing eligible active membership with HTTP 200 and no repeated audit event. Student locks serialize retries across sessions; the existing partial unique index remains authoritative.
- Eligible membership is active/unended, with an active/unarchived class and available instructor owner. Invitation expiry does not end membership. School completion is derived from actual eligible rows at restoration, not a local/stored flag.
- Confirmation resubmits the six-digit code plus a server snapshot fingerprint and revalidates under session/student, shared owner, class and code locks. The fingerprint is an optimistic freshness marker, not authentication or a secret; no separate preview token/TTL/table is introduced. This approved design supersedes the conceptual short-lived reference in API_DESIGN.
- Class/code changes or departed membership history require fresh review; existing active membership permits retry without the old snapshot matching. If an invitation expires after a successful commit, recover via memberships/me rather than accepting an invalid invitation.
- Existing 58-table schema and frozen revisions suffice; no Section 06 migration. Enrollment audit, membership and completion commit together. Nullable subject is permitted; no curriculum/research state is created.
- Peer and authenticated-session budgets default to 60/10 preview+confirmation requests per existing window. Protection remains process-local; global deployment limits/trusted proxies remain prerequisites.

## Section 07 navigation and session UX

- Reuse Expo Router protected routes and backend-derived destination rules. Instructors still default to first-class when onboarding is incomplete, but can open their real empty dashboard; additional class creation remains available. Multi-class student selection is transient presentation state over authorized memberships, never an authorization grant.
- Personal learners can edit grade/language through the existing preferences API; school/instructor roles cannot. Shared account/navigation controls expose no unsupported identity, role, recovery or account-switching mutations.
- Logout is exposed using the existing current-session revoke API. Before confirmation, explain that this device provides access and username recovery is unavailable. Hide protected views immediately on confirmed logout intent; retain the secure credential until server revocation/401 is acknowledged, then delete it. Failed logout stays behind a retry gate; cleanup retries do not reissue a confirmed revoke.
- A current authenticated 401 immediately hides protected data, invalidates in-memory credentials and attempts secure cleanup without depending on a second network request. Generation checks reject late responses after invalidation/logout/restoration. Temporary restoration failures retain the secure credential behind the retry gate.
- Dashboard class reads refresh on navigation focus and reject stale responses. Loading/errors hide class data; any displayed saved profile preferences after a failed refresh are labeled as previously verified. No fabricated progress, roster counts or recommendations are added.

## Section 08 approved administrator decisions

- The user approved OIDC with provider-enforced MFA, then explicitly chose provider-neutral support with sign-in disabled until issuer, confidential client and accepted MFA evidence are configured. No password fallback or provider is invented. Provider-specific enforcement remains an activation prerequisite.
- Operator-only CLI provisions separate mapped admin profiles with dashboard/session access; existing mobile profiles are never promoted. CLI disable and revoke-all are approved. The shell grants only `dashboard.view`; later privileged APIs require separate approved permissions.
- Approved browser session policy: 30-minute idle, 8-hour absolute, multiple browsers, current logout and operator revoke-all. HttpOnly/SameSite=Lax/host-only cookies are Secure with __Host- names in production. Logout requires exact Origin plus session-bound CSRF HMAC; sign-in starts with same-origin POST.
- Reuse existing User/AdminIdentity/RBAC/AuditLog models. Add only digest-based admin_browser_sessions and admin_oidc_attempts in 0003; preserve frozen 0001/0002 and mobile sessions. Attempts are browser-bound, ten-minute and consumed once before exchange; fresh session secrets prevent fixation.
- Next's fixed same-origin BFF carries admin cookies to FastAPI, with server-side authorization before dashboard account rendering. Keep credentialed CORS disabled; no bearer secrets in browser storage or Next database access. The original planned GET auth/start becomes POST to enforce Origin on initiation.
- Default OIDC compatibility: discovery, confidential client_secret_basic, PKCE S256, GET callback, RS256/ES256, fresh auth_time and explicit acr/amr evidence. Authlib/joserfc provide protocol/signature validation. Unknown/missing evidence fails closed; no email/username matching fallback.
- Operator events audit a null actor plus operator_cli reason; production operator attribution, provider activation, distributed edge limits, retained-session/attempt cleanup and real PostgreSQL/TLS verification remain documented operational gates. IdP-only revocation is not a back-channel FLUENTT revocation.
- Final static review found pre-existing duplicate constraint names in frozen 0001 and metadata (MIGRATIONS.md). Preserve the frozen revisions; do not invent a baseline repair or reset an existing database. Approve a repair/bootstrap strategy and verify disposable PostgreSQL migration before activation. Offline SQL compilation alone does not validate those names against PostgreSQL.

## UI refresh — 2026-10-19

- User requested a clearer layout and updated visual design across the existing system. This is a presentation refresh of implemented screens, not authorization for a new roadmap section or new backend behavior.
- Use a consistent blue palette, quiet neutral surfaces, readable text, large controls, and task-oriented labels. Dashboard navigation is explicitly enabled only by the student/instructor home screens, preserving existing form/attempt navigation boundaries.
- Remove unsupported compliance/mastery claims, hard-coded student class/assignment totals, invented fallback teacher names, and static admin operational metrics. Continue using authorized progress projections; personal learning has no inferred activity counts.
- Keep demo entry visually separate and explicitly label sample data. Preserve existing demo/session implementations without expanding their permissions. This refresh does not certify those existing implementations for production.
- No dependencies, database models, migrations, API contracts, grading, release policies, or research semantics change. See UI_REDESIGN.md for changed files and verification.

## Personal learning focus and navigation — 2026-10-19

The user explicitly replaced personal grade selection with requested topics and lessons, and requested a previous-screen Back control throughout both clients. This authorizes the preference-contract adjustment below; classroom grades, curriculum structure, grading, research and progress semantics are unchanged.

- Add optional `learning_focus: {topics: string[], lessons: string[]}` to mobile profile and personal preference updates. At least one nonblank request is required when supplied; each list holds at most 10 distinct trimmed strings, each at most 120 Unicode code points. Extra fields/null/empty focus are rejected. Requests are self-described needs, not published curriculum IDs, enrollment, delivered activities, proficiency, or a recommendation engine.
- Store the request object in one nullable JSONB column on the existing learner profile, using additive migration 0013_learning_focus. Preserve every earlier migration and all legacy grade data. Table count remains 63.
- New personal setup can complete using focus plus language with grade null. Legacy grade-plus-language profiles remain valid and can add focus without resetting onboarding. Retain the old grade API field for compatibility; the personal UI no longer asks for it. Instructor class-grade configuration is unchanged.
- A shared Screen Back control uses Expo Router back history, then the guarded entry route if no previous screen exists. Back remains disabled during existing critical save/issuance operations. Existing attempt/editor usePreventRemove hooks remain authoritative.
- Administrator Back uses browser history and lets curriculum/question editors intercept the action with their existing unsaved-work confirmations. No browser storage is added.

## Username autofill repair — 2026-10-19

- Reproduced the sample username Continue button staying on /username: the demo route guard intentionally keeps onboarding screens accessible, so creating a sample profile alone did not trigger navigation. Username now navigates explicitly only after successful creation and a matching role/canonical username appears in session context.
- Selecting an autofill username explicitly requests a sample profile, including on native. Skip real availability checks for selected samples and existing demo sessions; stale checks are cancelled by effect cleanup. Fast-Enter passes the chosen handle and explicit preview flag directly, avoiding stale React state.
- Preserve real-profile issuance, SecureStore retry handling, authenticated role guards, and live creation failures. This repair adds no backend endpoint, migration or real-account lookup/recovery path. Sample entry remains labeled and does not create a real account.

## Personal learning activities and difficulty — 2026-10-20

The user explicitly limited personal learning to conversation simulation, pronunciation, and questions/activities, and requested lessons/topics labeled by difficulty instead of school grade. Personal home now exposes those three activities. Existing grade storage and classroom behavior remain intact; legacy personal grade links redirect to topic/lesson setup.

Personal questions use a new authenticated, key-free projection of published lessons and locked published question revisions across school grades, in the learner's chosen language. Difficulty is the author's existing easy/medium/hard metadata. Practice answers and self-reported recall remain local for one focused visit, without a grade or activity/progress writer. Only an explicit individual Flashcard reveal returns that pinned back; other keys/rubrics stay private. This user-authorized practice flow adds no database migration or scoring policy. Existing conversation and pronunciation outputs remain explicitly simulated. See PERSONAL_LEARNING.md for endpoints, changed files, verification, and limitations.

## Personal reference design — 2026-10-20

The user supplied five mobile reference images and asked to apply their design. Adopt the compact header, navy/rose/teal palette, rounded cards, line icons, and Home/Learn/Voice/Tutor/Stats navigation for the existing personal features. Account remains available from the header. The Stats tab is a personal-only presentation route with an explicit unavailable state: the screenshots do not authorize fabricated retention/mastery, streaks, CEFR certification, latency, ESR, or new activity writers. Keep authored easy/medium/hard lesson difficulty and the existing simulated pronunciation/conversation disclosures. No new backend semantics, migrations, providers, assets, or dependencies. See PERSONAL_REFERENCE_DESIGN.md for files, validation, and limitations.

## Spaced usernames and complete demo autofill — 2026-10-20

User explicitly requested spaces in new usernames. Permit internal ASCII spaces alongside letters/digits/underscores, while retaining the 3–24 new-name limit, reserved names, and rejection of surrounding spaces/control whitespace. Canonical identity remains lowercase with internal spaces preserved; existing usernames are unchanged. Migration 0015_username_spaces widens only the users format constraint (legacy storage still 3–32). Downgrade refuses when spaced names exist rather than renaming/deleting profiles. Demo account selection fills both password fields with the public sample FluenttDemo123! and remains isolated preview access, never a live-account credential.

Files: app/core/usernames.py, app/models/users.py, identity/schemas.py, migrations/versions/0015_username_spaces.py; mobile app/username.tsx and session/routing.ts; focused identity/security/PostgreSQL/onboarding/autofill tests and this decision log. Verified real disposable PostgreSQL creation, uppercase login, availability and case-insensitive duplicate rejection, plus focused backend/client tests. Local database upgraded from reviewed 0014 to 0015 without resets or row changes.

## Language-first personal learning — 2026-10-20

User requested language selection before learning-experience selection. Personal routing now requires English/Tagalog, then a self-selected experience (starting_fresh, some_words, simple_conversations, comfortable), before opening Home. Topics and school grade do not block this setup. Starting difficulty is easy for the first two options, medium for simple conversations, and hard for comfortable users; it is editable practice preference, not a proficiency assessment. Lessons use that filter initially, and personal Voice/Tutor filter to the selected language. English demo lessons now have English question content.

Migration 0016_learning_experience adds nullable learner_profiles.learning_experience JSONB with an independent selected experience per language. Existing data is preserved; users without a choice are asked to select one. Session restoration projects the current language's choice; changing to a new language requires its experience question. All saves reuse authenticated preferences and SessionController.run. No grades, mastery, scheduler or research writes were added. Local 0015 database upgraded normally to 0016 after a disposable PostgreSQL test proved first-language enforcement, persistence, separate-language restoration and input rejection. Focused 40 client checks passed; mobile typecheck/lint passed (existing warnings). No native-device test.

Files: services/api/app/models/users.py; identity/schemas.py and repository.py; migrations/versions/0016_learning_experience.py; integration/test_identity_postgresql.py; mobile services/api/identity.ts, session/provider.tsx and routing.ts; app/_layout.tsx, language.tsx, experience.tsx, preferences.tsx, question-practice.tsx, pronunciation.tsx; features/conversation/ConversationPractice.tsx and dashboard/PersonalHome.tsx; demo/demoData.ts and personalPractice.ts; scripts/onboarding.test.mjs, username.test.cjs, personal-practice.test.cjs and dashboard-components.test.cjs; this log and docs/PERSONAL_LEARNING.md.

## Easy listening and sentence building — 2026-10-21

User explicitly requested beginner word recognition from audio and jumbled sentence reconstruction with replay. Easy personal practice now opens these two activities in the selected English/Tagalog language. Each has three public built-in starter exercises per language. These examples are separate from published school content and private bank keys; no database seed, migration, classroom grading, persisted personal completion, scheduler or research writer is added. Exact local choice/order checks provide retry feedback only. Other difficulty filters retain the existing published lesson catalog.

Use SDK-compatible expo-speech (~58.0.3) for normal/slow device speech. Require a matching English or fil/tl voice; do not substitute English for Tagalog. Bound voice discovery, report unavailable playback, and offer explicit transcript reading support. Blur, exercise changes and language changes cancel playback and reject late voice discovery results. Device voice availability and pronunciation quality vary; no pronunciation assessment is implied. See PERSONAL_LEARNING.md for validation and changed files.

Follow-up: user requested ten Listen & Choose exercises in each language with increasing length within Easy. Retain the original first three words, add a fourth word, then three two-word phrases and three three-word phrases in authored order. Distractors have the same word count as the spoken target. Show the current word count and derive activity totals from content. Sentence-building content remains three exercises per language. No additional persistence, provider or dependency changes.

Further follow-up: user explicitly requested ten more jumbled-sentence exercises per language, sentence audio and drag-to-arrange cards, including an unused extra card. Retain the three original examples and add ten per language (13 each). Each new sentence includes one distractor; readiness uses the target sentence length, while exact local matching still requires the authored stable IDs in order. Duplicate printed words retain independent IDs. These public built-in examples do not change bank arrangement contracts or classroom scoring.

SentenceCards uses the installed React Native PanResponder and measured drop zones, supporting bank-to-sentence insertion, reordering and return to bank. Initial gesture capture handles small cards and fast diagonal movement; selection controls remain stable during dragging to preserve scroll/drop coordinates. Tap-to-add and selected-word earlier/later/remove controls remain available for keyboard and assistive navigation. Normal/slow audio and transcript support reuse the existing speech lifecycle. No dependency, API, schema, persistence or research changes.

## Personal Voice live word tracking — 2026-10-21

User requested the personal Voice phrase to highlight recognized words in real time and complete after the full phrase is spoken. Personal pronunciation now uses a separate live practice component; the existing school recording/upload/assessment flow is retained. Interim transcripts update the ordered word highlights, including revisions; a final full transcript confirms local phrase completion. This is word coverage, not acoustic pronunciation scoring, saved mastery, or a new activity/progress writer. Case/punctuation normalization and ordered matching apply only to this speech display, never bank responses or grading. Skipped/out-of-order target words remain pending; fillers/restarts may be ignored. Repeated target words require separate spoken occurrences.

Preserve the existing no-cloud-audio boundary: use SDK-compatible expo-speech-recognition 58.0.0 on native with requiresOnDeviceRecognition=true and persist=false. Native loading is optional so Expo Go shows an explanatory error instead of crashing. The browser adapter explicitly requires processLocally and installed local language support, with no remote fallback; its deliberate setup button may download a supported language pack without recording audio. English and fil/tl locales follow the selected phrase. Unsupported browsers/languages remain explicit unavailable states. Native deployment requires a new development/release build; no native build was created in this request.

Focus/session unmount, phrase/language changes, backgrounding, and browser visibility loss dispose recognition and reject late results/permission continuations. Reference speech stops before microphone start. A 60-second cap and bounded stop cleanup release recognition; final transcript confirmation, rather than simulated output or interim text alone, completes the phrase. No backend endpoint, migration, speech upload or provider key was added. Files and actual checks are recorded in PERSONAL_LEARNING.md and PRONUNCIATION.md.
