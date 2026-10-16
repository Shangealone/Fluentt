# FLUENTT repository instructions

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
