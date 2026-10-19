# FLUENTT repository instructions

## Section 23 additions

- Read docs/PROGRESS.md. Student-only /me/progress, /me/progress/classes and /me/learning-history derive submission-counts-v1 from eligible published distribution-only assignments and the authenticated student's first capture. Count finalized submissions even when incomplete/withheld/review-required; never equate them with mastery. No percentages, cross-class grade averages or progress writes.
- Personal tracking is explicitly unavailable with NULL counts; ignore dormant LearnerProgress/scheduler metrics without an approved writer. No module/lesson coverage, streak, retention, due-review or research inference. Preserve all models/migrations; head remains 0011_result_release (63 tables).
- Lock student/session → distinct owners ordered by UUID → classes/memberships → shared content boundary, refresh/revalidate after waits. Use distinct eligible class scope and bounded SQL; page before visibility/run lookups. Return only the exact released pinned-run totals; no answers/keys/private records or instructor monitoring. Retired/new editions never replace assignment snapshots.
- Mobile summary/history reuse secure session generation checks and clear stale protected state on blur/error. /me/ successes/errors must be no-store. Stop before Section 24; any new monitoring, personal activity, completion or grading semantics need its prompt/approval.

## Section 22 additions

- Read docs/RESULTS_AND_FEEDBACK.md. Ordinary classroom results use live mobile ownership/membership and explicit owning-instructor release; administrator grading permissions and execution remain isolated. No auto-grade/release, research access, expected answers/private feedback or Flashcard backs.
- Head 0011_result_release adds one append-only visibility ledger (63 tables), preserving frozen 0001–0010 and all captured responses/evaluations. First COMPLETE run is permanently pinned; confirmed release/withdraw/re-release uses UUID replay identity, If-Match, alternating retained events and safe audit. A late retry must never undo a later withdrawal.
- Owner lock order: user/session → owned class → shared content advisory → eligible student NOWAIT/shared membership → attempt. Do not wait for a student user while holding its owner; return retryable conflict. Student reads reuse student_context. Keep authorization, visibility, audit and DTO materialization in one transaction; refresh locked rows after waits.
- Pre-release students get status only; released review contains exact objective totals, pinned fronts and their original answers/correctness, never keys/rubrics. Review/unsupported totals remain unset; all-Flashcards have no denominator. No score edits, adjudication, academic invalidation or instructor-written feedback. Native/session cleanup and protected route rules remain authoritative. Stop before Section 23.

## Section 21 additions

- Read docs/GRADING.md. Backend-only grading uses pure objective-exact-v1 plus live explicit grading.read/run; no client grades, automatic grants, key downloads or grading-on-submit. Reader/runner grants are operator-only and preserve role-drift/revocation checks. No Next/mobile result route or research permission.
- Exact options/booleans, sets, complete sequences/pairs; Identification casefold only under its stored false case flag, blanks exact case-sensitive. No other normalization, partial credit, penalties or inferred synonyms. 1.00 per objective item in the evaluation overlay, Decimal arithmetic; Flashcards NOT APPLICABLE. Invalid evidence/manual or unknown/unsupported items withhold overall totals. No academic verification claimed.
- Head 0010_grading_results adds two immutable run/item tables (62 total), preserving frozen 0001–0009 and all submitted captures/assignment policies. Pin original revision/key/response IDs and source marker; never substitute latest versions or overwrite capture grades. Natural attempt/engine/policy identity gives idempotence; new engine/policy versions create separate runs. Preserve Unicode version in engine identity.
- Authorization locks admin User/browser session, shared content advisory 78090001, then finalized classroom attempt and new run/items. Keep permission/Origin/CSRF checks and writes/audit atomic; refresh after waits. Seal only after all item outcomes/totals agree. Never alter sealed results, relax capture guards or treat ordinary classroom records as research data. Stop before Section 22 and obtain result-release policies there.

## Section 20 additions

- Read docs/ASSIGNMENTS.md. Student capture lives in assignments/capture*.py and mobile AttemptPlayer/CaptureQuestion. Reuse shared student_context locks, exact pinned versions and existing widgets. Every start/read/save/reveal/submit checks live school role/membership/class/owner; no role switch, generic bank access or client-only authorization.
- One unscored-capture-v1 attempt per student/publication, explicit saves/resume position, no retakes/timer/deadline or autosave/local persistence. Full snapshots and If-Match protect saves; final confirmation permits incomplete responses and UUID/body identity safely replays committed submission. Final reads return receipt only. Unknown save outcomes require reconciliation; do not overwrite other-device state.
- Head 0009_response_capture adds nullable attempt contract/state/fingerprint and capture/final-response guards, preserving frozen 0001–0008 and all published assignment policies. Never silently fill points/max_attempts or convert old attempts. Raw partial Unicode buffers use the capture validator; original response/scoring validators remain unchanged. Declared limits, legacy 8,000-code-point ceiling, 200 items and 1 MiB snapshots apply.
- Only deliberate owned-attempt Flashcard reveal returns that pinned back; general DTOs remain front-only, recall requires server-recorded reveal and can change before finalization. All other keys/rubrics stay hidden. Independent practice retains once-per-visit local semantics. No grading, latency, scheduler or research data.
- Use SessionController.run, clear protected state on access/session loss/blur, ignore late responses and retain exact finalization retry state in memory only. Stop after Section 20; future grading needs approved versioned policies while keeping captured answers immutable.

## Section 19 additions

- Read docs/ASSIGNMENTS.md. Head 0008_assignment_publication adds immutable distribution-only-v1 publication with unset attempts/points/windows and an explicit database attempt prohibition. Preserve frozen 0001–0007 and historical references. Published roots/versions/items cannot be edited, re-versioned, closed or archived in this section.
- Instructor Publish requires live ownership/active class, content revalidation, If-Match, UUID retry identity and explicit confirmation. An unbound class requires explicit lesson-subject binding after retained assignment/progress conflict checks, committed with publication. Never infer subject from language or overwrite configured legacy policies.
- Student reads require school role plus live eligible membership/owner/class, locking student/session → owner → class → membership → shared content advisory. Refresh/revalidate after waits. Immediate availability includes later joiners; leaving/removal/deactivation denies access. Retirement does not replace/withdraw already pinned publication.
- Student DTOs/navigation expose metadata/context/count/methods only, no prompts, question content, keys/backs or attempts. No delivery receipts, notifications or research participation. All clients use SessionController.run. Section 20 needs an approved execution/release/configuration strategy that preserves immutable distribution history; stop for acceptance/prompt.

## Section 18 additions

- Instructor drafts live in app/modules/assignments; read docs/ASSIGNMENTS.md. Authenticate/lock user+session, owner/class, content advisory 78090001, then assignment/freshness in one transaction. Owner-only historical reads persist; no learner publication/attempt/scoring API. All-ten instructor previews are key-free, including Flashcards front only.
- One published lesson per draft; validate grade/language and bound subject, exact locked published revisions and one stable Question each. Unbound class subject stays null; snapshot explicit lesson context and require binding before future publication. Retirement flags pinned history ineligible; saving requires removing/replacing invalid content. Archive preserves history, no hard-delete/restore.
- Head 0007_assignment_drafts adds durable owner/request idempotency and nullable unconfigured draft max_attempts/item points. Preserve existing values; configure before locking. Never infer weights/attempt/timer/feedback policy. Title 1–200, instructions up to 8,000, 0–200 ordered items; UUID create retries and If-Match edits/archive.
- Mobile assignment routes use existing role guards and SessionController.run. Reuse Expo Router's installed usePreventRemove repeat API for unsaved navigation; no new dependency or insecure storage. Stop before Section 19.

## Section 17 additions

- /questions supports all ten existing methods. Flashcards uses public cue/private back and optional retained rubric reference; no vocabulary FK/media fields. Read-only preview is front-only; editor reveal fetches the matching private key under live read+write and checks the revision marker. Never mix backs into public DTOs or other method previews.
- FlashcardQuestion/FlashcardPractice are component-only; backs are separately supplied, already-authorized and version-bound. Deliberate reveal precedes optional subjective again/hard/good/easy; one rating per visit, authored order, reset on navigation/restoration, confirmed exit and Android Back confirmation. Hosts own Screen scrolling, blur/session cleanup and onExit navigation.
- General practice persistence remains OPEN. No learner retrieval/history/event API, latency collection, scheduler state/interval updates or experimental telemetry. Do not fake scheduler records to use VocabularyReviewEvent. Research consent stays separate. Read docs/VOCABULARY.md and stop before Section 18.

## Section 16 additions

- /questions supports nine interfaces over ten backend contracts; Flashcards remains backend-only. Matching V1 requires complete one-to-one private pairs across left/right sets, at least two distinct stable IDs per side; side namespaces are separate and repeated labels are valid. Many-to-one needs a future approved versioned contract.
- Preserve independent authored order, no shuffle, initially empty preview, left-then-right selection, target reassignment clearing its prior owner, review/remove/reset and complete responses in left order. Ready is not correct/scored/submitted. Item removal clears associations; published versions remain frozen.
- MatchingQuestion/UnscoredMatchingPreview are component-only. Future hosts own Screen/blur/session/attempt cleanup; follow existing key-free projection, security and ambiguous-save conventions. No new migration/API/grading/Flashcards scope. Read docs/QUESTION_BANK.md and stop before Section 17.

## Section 15 additions

- /questions supports eight editors. Arrangement methods reuse items (minimum two, distinct stable IDs) and private ordered_ids (complete permutation). Public presentation order is independent; no automatic shuffling or splitting. Repeated labels are distinct by ID. Removing units clears private references; published history stays frozen.
- ArrangementQuestion/UnscoredArrangementPreview are component-only: initially empty, tap/append once, move/remove/reset, ready only when every ID appears once. Ready is not correct or submitted. Word/sentence response IDs retain learner order; no key, score, alternative-order policy, delivery/persistence API or new migration is added.
- Follow existing public projection, permission, session, Screen/blur/attempt-cleanup and ambiguous-save conventions. Read docs/QUESTION_BANK.md. Do not infer grading from the stored expected permutation or presentation order.

## Section 14 additions

- /questions supports six editors. Multiple Select keeps existing one-or-more correct IDs with no public bounds; zero selections is an unfinished preview. Serialize selected IDs in content order, never leak private set size or infer scoring.
- Error Identification uses whole ordered {id,text} tokens and one-or-more target IDs, not spans/offsets. Preserve optional private accepted_corrections for any known token; no learner correction entry or grammar evaluation. Removing entries clears their target/correction references; published history remains frozen.
- MultiSelectionQuestion/UnscoredMultiPreview are component-only and reuse choice styles. Future hosts own Screen scrolling and blur/session/attempt cleanup. No Section 14 API, migration, permission or backend semantic change was added. Read docs/QUESTION_BANK.md and retain existing authoring/security/session conventions.

## Section 13 additions

- Read docs/QUESTION_BANK.md before text-method changes. Identification/blank responses preserve raw Unicode, whitespace, punctuation and case. Never use the author-metadata TextValue stripper on learner text or infer scoring from accepted_answers/case_sensitive.
- Optional input_max_length is 1–2,000 Unicode code points; new editors default 500, legacy absence stays absent. Tagged double-brace-v1 prompts require exact ordered {{blank_id}} markers, each once. Untagged legacy prompts are literal; published revisions remain frozen. No migration or response-submission API was added.
- The existing protected question editor/BFF supports four methods only. Expo TextQuestion is component-only; hosts use Screen for keyboard/scrolling and discard local/attempt buffers on blur/session loss. Private keys never enter presentation DTOs. Follow existing permissions, live session checks and interrupted-save reconciliation.

## Section 12 additions

- Administrator /questions and its fixed BFF implement only Multiple Choice/True or False editing/preview; use existing questions permissions/APIs. Keep stable option IDs, authored order, a single correct_option_id and strict boolean false; text-only and ungraded-v1. No implicit curriculum access or new backend/learner endpoints.
- Mobile features/questions presents explicit key-free props and typed local selection. Hosts must unmount/set active=false on blur and reset their own attempt state; no route, bank retrieval, persisted answer or correctness feedback is added. Never pass a private definition through prop spreading.
- Treat unknown/network/timeout/5xx save outcomes as potentially committed: reconcile bank/history before another non-idempotent save. Keep protected/private question state hidden on access verification and clear it before sign-out. No browser storage fallback.
- Read docs/QUESTION_BANK.md and docs/SECTION_12_REPORT.md before extending these components. Run mobile typecheck/lint, method/component tests and relevant backend/BFF checks; exports do not prove native execution. Stop before Section 13 and explicitly report readiness.

## Section 11 additions

- Question-bank services live in services/api/app/modules/questions; read docs/QUESTION_BANK.md before changes. Reuse exactly the ten question_config V1 methods. Explicit questions.read/write/publish grants are separate from curriculum roles; keys need write, publish/retire need all three. No mobile bank/response endpoint or scoring is approved in Section 11.
- Question is stable identity; locked revisions/keys/links are immutable. Corrections create new revisions, retirement archives the whole item and preserves history. Published item status does not make its latest draft deliverable. Future delivery must authorize a pinned locked version.
- Advisory 78090001 precedes bank DML and Question locks; live admin authorization/write/audit share one transaction. Draft replacements validate first, removing old unlocked key/links before content replacement. Migration 0006 protects same-lesson competencies in both edit directions; inconsistent history requires operator review, never silent repair.
- Keep ungraded-v1; no invented normalization, partial credit, objective flashcard scoring, media or research policy. See the report for verification limits. Stop for the next section prompt and explicitly state readiness at completion.

## Section 10 additions

- Structural authoring is app/modules/curriculum/management*.py and Next /curriculum, reusing existing tables. No new migration; head remains 0005_constraint_names. Read docs/CURRICULUM.md and docs/SECTION_10_REPORT.md before changes.
- Explicit operator roles: curriculum_editor grants read+write; curriculum_publisher grants read+publish. Publishing/retirement require read+write+publish. Existing/default administrators gain no automatic access. OIDC remains disabled until configured; no runtime auth bypass.
- Writes require dedicated cookies, live permissions, Origin, CSRF, the User/session transaction, then exclusive advisory key 78090001 before DML. If-Match fingerprints the entire edition; child creation compares its parent fingerprint, moves also compare target_revision. Preserve guards and historical references.
- Edit/reparent/remove only eligible unreferenced drafts; single-node RESTRICT removal never cascades. Publish complete hierarchy atomically after explicit review/source/licensing confirmation; no new review status or academic verification. Published editions retire as a whole, never unretire. Shared subjects referenced by frozen editions/classes cannot be relabeled.
- Next uses fixed entity/method paths, bounded JSON, allowed headers, request-time authorization and no-store. Synthetic sessions belong only in isolated tests. Published API fixtures use their own UUID database so older downgrade tests retain their guards.

## Post-Section 09 database verification

- Current head is 0005_constraint_names. Frozen 0001–0004 remain unchanged. Fresh empty PostgreSQL databases require the explicit `alembic -x repair_initial_names=true upgrade head` execution adapter; it changes only three conflicting constraint declarations and refuses existing objects/versioned databases. Normal upgrades of reviewed existing databases do not use this flag. Never reset or stamp an unknown existing database.
- 0005 only converges constraint names by column signature; no data/constraints are dropped. Its downgrade intentionally retains valid names. See docs/MIGRATIONS.md and docs/LOCAL_VERIFICATION_REPORT.md. Local PostgreSQL is now configured; previous skipped-test statements are historical. Keep local credentials and test artifacts in ignored files.

## Section 09 additions

- Current head is 0004_curriculum_snapshots, still 60 domain tables; previous head notes are historical. Preserve frozen 0001–0003 and the documented bootstrap naming blocker. Read docs/CURRICULUM.md before curriculum changes.
- Reuse version → grade → subject → quarter → topic → lesson → competency. Five research levels stay separate. Never infer Filipino subject from Tagalog language, seed real content, invent counts/thresholds or claim academic verification.
- All authenticated mobile roles may browse published structure. Optional class scope must enforce owner/eligible membership and actual grade/explicit subject at every descendant. Null subject returns an honest empty state. Admin draft/retired reads require explicit curriculum.read under the same session/User transaction; only operator grant/revoke commands are approved. Default provisioning remains dashboard-only.
- Published/historically referenced hierarchy is immutable; corrections use new version and child IDs, retirement uses archived status. Structural reads use advisory key 78090001 shared; future writers must acquire it exclusively before DML and preserve guards/reference ordering. No authoring/delivery/research API or private answer/provenance payload is authorized by these read contracts.

## Section 08 additions

- Administrator implementation is app/modules/administration; read docs/ADMIN_AUTH.md before changes. OIDC/provider MFA only; sign-in fails closed without issuer, confidential client and approved MFA evidence. No password fallback, public registration or mobile promotion.
- Admin browser sessions/attempts are isolated from mobile sessions. Current head is 0003_admin_sessions; frozen 0001/0002 remain immutable. Always lock/revalidate admin User before browser session; refresh locked ORM rows after waiting. Privileged backend operations require live explicit permissions and cookie mutations require Origin plus CSRF.
- Next.js uses fixed same-origin admin BFF paths and server authorization before account data rendering; never forward arbitrary paths, mobile Authorization or unrelated cookies. Suppress OIDC callback query logging. No browser-storage bearer secret or development auth bypass.
- Only operator CLI provisioning/disable/revoke-all and dashboard.view are approved. Future management/content/research permissions require their own section prompt. Preserve retained sessions/audits and report unavailable PostgreSQL/provider/TLS verification honestly.

- Read docs/ARCHITECTURE.md, docs/DECISIONS.md and the current section prompt before changes. Inspect repository files, manifests and Git status; preserve existing behavior.
- Implement only the explicitly supplied section. Section 00 is documentation only. The roadmap is provisional, not permission to implement later sections.
- Stack: Expo/React Native/TypeScript with Expo Router, separate Next.js/React/TypeScript admin, Python FastAPI/Pydantic/SQLAlchemy 2.x/Alembic and PostgreSQL. Only backend accesses database and AI providers.
- One mobile app contains student/instructor portals. No traditional mobile password-login screens. Globally unique canonical usernames identify profiles; secure server-issued device sessions authenticate. Never restore an account by username or treat class codes as identity/consent.
- Admin authentication/permissions are separate. Enforce backend object ownership and research permissions, not only UI route checks.
- Preserve exactly the ten assessment methods in docs/API_DESIGN.md. Keep curriculum topic selection independent of answer method. Separate subject Filipino from learning track Tagalog.
- Version published content, grading and model/scheduler configurations. Do not expose private answer keys to learners.
- Research requires explicit approved enrollment and consent/assent; separate coded identities and classroom state. Instructors cannot edit locked study content. Use synthetic early fixtures only.
- Never claim DepEd verification, trained FIFAKT, integrated ESR, valid Tagalog pronunciation scoring, passing tests or research outcomes without evidence. Clearly mark all simulated model output.
- No secrets in source/logs; configuration is environment-based. Record assumptions and decision changes in docs/DECISIONS.md.
- Run checks appropriate to the current section; report actual results, limitations and every changed file. Stop for the next section prompt when the current section is complete.

## Section 01 additions

- Run commands and environment/network setup are in README.md. Current mobile routes live in apps/mobile/src/app; the architecture's app/ directory was a proposed location only.
- Administrator authentication belongs to Section 08 per the accepted Section 01 prompt. Until then, expose only the public landing page and health diagnostics.
- Section 01 implements only health and UI shells; planned domain APIs remain unimplemented. PostgreSQL configuration is lazy and optional until Section 02.

## Section 02 additions

- SQLAlchemy model registry: services/api/app/models/__init__.py; metadata: app/db/base.py. Import the registry for migrations. Use synchronous get_session dependency; services own explicit transactions. Never create tables at application startup.
- Read docs/DATABASE_SCHEMA.md and docs/MIGRATIONS.md before database changes. Keep applied migrations immutable; create new revisions for later schema changes and explicitly maintain PostgreSQL guard functions/grants.
- PostgreSQL tests create/drop only their own generated UUID database. Never downgrade/reset an existing developer database without explicit approval. SQLite is not a substitute for PostgreSQL checks.
- Research learning contexts must not contain ordinary user IDs; resolve identities only through research_private. PUBLIC revocation does not restrict schema owners; runtime DB credentials and API authorization need separate permissions before real data.
- Section 02 added storage contracts and models only. Sessions/auth APIs belong to Section 03; research enrollment/allocation/execution belong to Sections 36–38 per the Section 02 prompt.

## Section 03 additions

- Identity API implementation is in services/api/app/modules/identity; shared username policy, opaque credential helpers and bounded throttling are in app/core. Read docs/IDENTITY_AND_SESSIONS.md before changing identity behavior.
- New public names are 3–24 ASCII characters without whitespace; preserve legacy storage up to 32. Use the same lowercase canonical rule. Admin creation and arbitrary fields are rejected by public schemas and services.
- Never return an existing account/session from a duplicate username. Raw credentials appear only in issuance JSON and belong in future mobile secure storage. Session restoration uses GET /sessions/me; no username-based recovery or duplicate restore endpoint.
- No Section 03 schema migration is needed. The in-memory repository is test-only; runtime always uses PostgreSQL and fails with 503 when unavailable. Do not claim the skipped PostgreSQL identity/race tests passed.
- The rate limiter is single-process; global edge limits and trusted proxy configuration are production deployment prerequisites. Existing migration/research/privacy constraints still apply.

## Section 04 additions

- Mobile identity state lives in apps/mobile/src/session; SecureStore is native-only. Web is an explicit navigation preview with creation blocked before credential issuance. Do not add an insecure browser/AsyncStorage fallback.
- Personal preferences use PATCH /users/me/preferences and existing learner-profile fields; GET /sessions/me returns grade/language for restoration. Keep authorization and writes in a single transaction. Grade reference labels are upserted by number without replacing existing records; no curriculum content or schema revision is added.
- Protected routes follow backend role/completion data. School joining and first-class screens are explicit unsaved boundaries for Sections 06/05, never successful enrollment/class creation.

## Section 05 additions

- Class implementation lives in services/api/app/modules/classrooms; read docs/CLASSROOMS.md before changing it. Shared authenticated_session holds session/user locks through class operations. Never authenticate and then write in a separate unchecked transaction.
- 0002_class_creation is the current migration head. Preserve frozen 0001. Codes are permanently unique across history, including inactive values; do not free codes by deleting records. Collision retries use savepoints and bounded secure server RNG.
- Curriculum subject is optional until explicitly configured; never infer it from learning language. Context-bound grade/language edits are rejected. Future enrollment/content services must lock and revalidate the class before writing related state.
- POST /classes requires UUID Idempotency-Key, unique per owner/request. Mobile pending retries reuse key/body; restoration checks actual class existence and never auto-creates. Runtime uses PostgreSQL only. Static component preview and in-memory repositories are test/review tools, never authentication bypasses or runtime fallbacks.

## Section 06 additions

- Student enrollment lives in services/api/app/modules/enrollment; read docs/ENROLLMENT.md before changes. Multiple active classes are approved. Left members may rejoin with a new row; prior removal blocks self-enrollment. Never erase history to bypass removal.
- Confirmation requires code + optimistic class_version, revalidates in the authenticated transaction, and returns an existing eligible active membership on retry. The version is not a credential. Owner-before-class locking matches instructor writers; future membership writers must lock the student and class consistently.
- School restoration derives completion from actual eligible memberships; invitation expiry does not terminate membership. Runtime remains PostgreSQL-only; no Section 06 migration. Peer/session enrollment limits are process-local, not a production distributed limiter.
- Mobile /class-code serves onboarding and additional joining for school students. /student lists safe backend memberships. Native SecureStore remains required; no browser fallback. Broader dashboards/navigation remain Section 07, pending Section 06 acceptance.

## Section 07 additions

- Mobile role policy is in apps/mobile/src/session/routing.ts; protected declarations must use those rules. Instructor onboarding still defaults to first-class; zero-class instructors may deliberately open their empty dashboard. Class selection never grants permissions.
- All protected client operations use SessionController.run generation checks. On current 401, hide protected state and invalidate/clear credentials without a second network validation. Logout requires explicit UI confirmation, server revoke/401, then secure cleanup; failures remain gated for retry. Do not add username recovery or insecure storage.
- Shared dashboard reads in features/dashboard refresh on focus, clear visible class data on loading/error, and ignore late results after blur/session loss. Personal preferences use the existing authenticated API only; no role/identity mutation. No fabricated metrics or administrator auth was added.

## Section 24 additions

- Instructor monitoring lives in services/api/app/modules/monitoring; read docs/INSTRUCTOR_MONITORING.md before changes. Current eligible active school members of owned active classes only; no former/disabled/personal/research scope or implicit new permissions.
- Reuse progress published/first-capture/result projections and submission-counts-v1. Class opportunities=A×S, student=A, assignment=S; no completion/mastery percentages. Pinned lesson/edition filtering does not measure curriculum coverage.
- Monitoring exposes released pinned COMPLETE points only. released-assignment-mean-v1 groups one immutable assignment version by engine/policy/max; Decimal rounding once, two places ROUND_HALF_UP. Mixed groups are not comparable; no eligible results means unavailable. Do not infer cross-assignment grades/rankings.
- Owned User/session/class locks and shared content boundary precede current student FOR SHARE NOWAIT revalidation; student contention returns retryable 409 to avoid reverse-order deadlocks. Live memberships remain locked through read projections. Section 22 separately authorized prerelease review/release stays unchanged.
- Expo /instructor-monitoring uses role guards, SessionController.run and focus-scoped read cleanup; no offline/token cache or auth bypass. No migration/dependency change. Stop after Section 24 for acceptance and the authoritative Section 25 prompt.

## Section 25 additions

- Read docs/COMMUNICATIONS.md before messaging changes. Only owned-class announcements (no replies) and current school-student/instructor one-to-one class-context messages, either may initiate. No peer/personal/admin chat, attachments, editing/deletion or automatic grade/key/research links.
- Reuse messages/message_reads. class-text-v1 adds nullable context/request/contract fields while preserving exclusive recipient/class destination and all legacy rows. Head 0012_class_communication (63 tables), frozen 0001–0011 unchanged. New sent/read records immutable; sender/request UUID retries compare exact text, destination and class; no content in audits/logs.
- Every read/write revalidates active owner/class/current membership. Student→owner→class order; instructor target reads use NOWAIT to avoid inverse waits. Former/removed/disabled access is hidden, eligible rejoin restores retained work, later members see announcements. Read status is own-viewer only; history uses server as_of paging anchors and manual refresh.
- Plain text 1–4,000 Unicode code points, no blank-only/NUL/lone-surrogate input; preserve accepted raw text. No insecure local cache/auth bypass. Compose retries retain original body/key in memory; unknown outcomes require history inspection before recreating a request after restart. Navigation changes use confirmed removal boundaries.
- Synthetic demonstration retention only; real-student retention/moderation is unapproved. October 21 smoke uses isolated synthetic admin test sessions and real disposable PostgreSQL, not production OIDC bypass. See docs/OCT_21_DEMO_CHECKLIST.md for actual blockers. Stop for demo approval; no Section 26.
