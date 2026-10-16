# Decisions and constraints

All decisions are planned baselines, not implemented controls. Preserve the approved Section 00 requirements across later sessions.

| ID | Decision | Reason / revision boundary |
|---|---|---|
| D01 | Modular monorepo, one FastAPI backend, PostgreSQL | Simple shared authorization and transactions; no direct frontend database access. |
| D02 | Expo Router for the shared student/instructor Expo TypeScript app | Consistent navigation; administrator is a separate Next.js TypeScript site. |
| D03 | REST /api/v1, JSON and multipart audio | Vendor-independent frontend contracts; generated TS client later. |
| D04 | Passwordless profile creation plus opaque device sessions | Required mobile flow; usernames never authenticate. |
| D05 | Separate secure administrator authentication | Prefer maintained OIDC identity provider with MFA; provider selection unresolved. No development bypass in production. |
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
