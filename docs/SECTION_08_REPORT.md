# Section 08 — Administrator authentication and protected website access

Completed in source on 2026-10-18 after accepted Sections 00–07 and the user's explicit security-policy answers. No production activation, account provisioning, live migration, commit or push was performed.

## Scope and approved decisions

Implemented provider-neutral OIDC authorization-code sign-in with provider-enforced MFA evidence, operator-only provisioning/disable/revoke-all, separate browser sessions, backend permissions, a protected Next.js dashboard shell and safe login/logout/retry states. Sign-in deliberately remains disabled until the operator configures issuer, confidential client and accepted MFA claim values. No provider, credentials, administrator account or password fallback was invented.

Approved session policy is 30 minutes idle / 8 hours absolute, multiple browser sessions, current-session logout and operator revoke-all. Cookies are HttpOnly, SameSite=Lax and host-only; production adds Secure and __Host- names. No mobile credential storage, role or onboarding change was made in Section 08.

Pre-implementation inspection covered PROJECT_HANDOFF.md, development plan, architecture/decisions, accepted reports including Section 07, security/identity/API/schema/migration documentation, existing RBAC/AdminIdentity/AuditLog models, FastAPI authentication/transactions, Next.js routes and bundled version-specific docs, manifests and Git changes. The original handoff remains a historical Sections 00–05 snapshot; later reports are authoritative for subsequent work.

The conflicts resolved were the unselected OIDC provider, absent password/session storage, undefined provisioning and session policies, conceptual GET sign-in initiation and the initially public-only website. User approval permits configurable OIDC with sign-in disabled, separate operator-provisioned identities, shell permission and the stated session policy. POST initiation replaces conceptual GET so both servers can enforce Origin. No later-section permission is implied.

## Implementation

- FastAPI `/api/v1/admin/auth/config`, POST `/admin/auth/start`, GET `/admin/auth/callback`, GET `/admin/me`, DELETE `/admin/session`. Config is public and returns only enabled status. Other conceptual administrator APIs remain unimplemented.
- Single-use, ten-minute state/browser binding; PKCE S256 and nonce derived using domain-separated HMAC. Stored attempts contain only digests. Callback locks and consumes the attempt before code exchange; unauthenticated invalid callbacks cannot clear an existing admin session or an unrelated pending binding.
- Authlib 1.9.1 handles the confidential code flow; joserfc 1.7.5 verifies RS256/ES256 signatures against HTTPS discovery JWKS. Issuer, audience/authorized party, nonce, expiry, issued time, optional access-token hash, fresh auth_time and configured acr/amr evidence are checked. No token/userinfo/email fallback or provider token persistence. See ADMIN_AUTH.md for supported provider prerequisites.
- Sessions use a separate random secret/digest table, live mapped administrator role/status/permission checks, sliding idle expiry capped by absolute expiry, revocation and transactional safe audits. User/session locks and refreshed locked ORM rows prevent using stale pre-lock access state; expiry is evaluated after lock acquisition. PostgreSQL concurrency behavior remains unverified locally.
- Operator CLI creates a new User/AdminIdentity/RBAC mapping and audit atomically; never promotes a mobile account. Disable and revoke-all are audited and do not touch mobile UserSession records. Only dashboard.view is granted. No actual administrator was provisioned here.
- Next's fixed same-origin BFF forwards only dedicated cookies and defined admin paths. Server checks precede protected account rendering; direct anonymous access redirects without account data. Idle expiry/back-cache restoration revalidates, logout requires CSRF plus Origin, failures offer retry and no fabricated data. All future module actions are disabled.
- Existing credential-disabled CORS is retained. No administrator bearer secret goes into JSON or browser storage. Safe request logging/no-store responses, callback log suppression, no-referrer, frame denial and content-type protections are included. Deployment ingress/APM redaction and TLS remain operator responsibilities.

## Database and provisioning

Additive head `0003_admin_sessions` creates `admin_browser_sessions` and `admin_oidc_attempts`, bringing domain tables to 60. It adds digest/expiry constraints, session indexes, explicit PUBLIC revocation and updated_at triggers using the existing function. Frozen 0001/0002, existing records, mobile identities and research guards/grants are untouched. Downgrade refuses occupied new tables; no automatic deletion or destructive backfill occurs.

Offline upgrade/downgrade SQL compiles in tests. No live PostgreSQL migration/grant/race check passed or was attempted against an existing developer database. Eight new PostgreSQL tests use the existing generated UUID-database fixture and are skipped when the test URL is absent.

Final documentation regeneration exposed a pre-existing bootstrap blocker: frozen 0001/current metadata have duplicate constraint names on learning_competencies, assignment_questions and vocabulary_review_events. The exact names and [PostgreSQL constraint-naming requirement](https://www.postgresql.org/docs/17/sql-createtable.html) are recorded in MIGRATIONS.md. Static evidence predicts fresh bootstrap failure; it was not reproduced against PostgreSQL here. No frozen migration/model outside Section 08 was changed to repair it. An approved baseline/bootstrap repair strategy is required before claiming the migration chain is operational. The schema-document generator now sorts tied constraints/references deterministically, avoiding unrelated ordering drift without altering schema semantics.

Provisioning commands, environment fields, callback registration, exact issuer/subject mapping, restricted operator/runtime grants and activation steps are in ADMIN_AUTH.md. Settings examples contain placeholders and an empty MFA allowlist. No ignored .env/.env.local file was edited. No secret was placed in documentation or logs.

## Verification results

| Check | Actual result |
|---|---|
| Full API `pytest -q` | **227 passed, 48 skipped**, 2 dependency deprecation warnings. All skips are PostgreSQL; includes 36 admin authentication tests and the added offline schema test. |
| OIDC contract coverage | Real RSA-signed synthetic tokens test issuer/audience/nonce/expiry/subject/MFA/auth-time/signature/algorithm rejection. MockTransport exercises the actual OAuth client discovery/code exchange/PKCE/nonce/JWKS path and ensures tokens are not attached to public metadata/key requests. Production cookie/transport and missing-config behavior tested. |
| Session/API coverage | Login, unknown/disabled/archived/wrong-role/missing-permission rejection, restoration, rotation, idle/absolute expiry, revocation, logout, Origin/CSRF denial, one-use/browser-bound attempts, invalid callback non-interference and throttling pass with explicit test-only repositories. |
| Real Next.js HTTP checks | **7 passed** via `node --test scripts/admin-web.test.mjs`, using a synthetic backend server. Covers direct anonymous dashboard access, disabled login, wrong Origin/paths/methods, cookie allowlisting, real server-rendered account context, redirects/cookies, restoration, CSRF, logout/revoked clearing and backend outage. No runtime bypass is added. |
| Mobile/public client regressions | **33 passed** across api-clients/onboarding/classes/enrollment/navigation tests, plus **12 passed** dashboard component renders. These are client/state/static-render checks, not native-device execution. |
| Next TypeScript / ESLint | **Passed** (`npm run typecheck`, `npm run lint`). No npm dependency or lockfile change. |
| Next production build | **Passed**; public landing, partial-prerender login/dashboard and dynamic BFF routes produced. Request-time cookies boundary prevents build-time evaluation of deployment-only settings. |
| Backend Ruff / format | **Passed** across app/migrations/scripts/tests (79 Python files formatted). |
| Python compilation / dependency consistency | **Passed** compileall and pip check. |
| Migration head / schema documentation | **0003_admin_sessions** single head; generated 60-table dictionary/ERD includes the two new tables. |
| Browser observation against actual unconfigured backend | Anonymous `/dashboard` redirected to `/login?expired=1`; refresh retained safe sign-in; the provider button was disabled with a clear unconfigured message. Layout visually inspected at the available browser width. Temporary servers/tab were stopped/closed. |

During development, tests exposed and corrected model-count assertions, HTTPS configuration during prerendering, HTTPX OAuth discovery compatibility and invalid callback cookie interference. The sandboxed HTTP server check could not become ready, and a subsequent sandboxed build hit Windows EPERM in generated .next output; both checks passed outside the sandbox. There is no unresolved test failure in the available suite.

Backend TestClient also requires the previously documented Windows sandbox exception for socket startup. Warnings are Starlette's AnyIO alias deprecation and Authlib's HTTPX compatibility-adapter deprecation. Node client checks emit the existing module-type detection warning; no manifest rewrite was introduced to suppress it.

## Explicit limitations and Section 09 prerequisites

1. PostgreSQL URL/tools are unconfigured here. All 48 conditional checks, including eight new admin persistence/provisioning/transaction tests, are **skipped**, not passed. Resolve the pre-existing frozen-0001 constraint-name collisions through an explicitly reviewed repair strategy first. Live migration constraints, role grants, row-lock races and operator CLI persistence then need verification on the disposable test database before touching the intended database.
2. No real issuer/client/MFA policy or admin mapping is configured. Real provider login, provider denial/rotation behavior, MFA enforcement and full browser success/logout over deployed HTTPS are **unverified**. Provider-neutral support is intentionally inactive until configured and validated.
3. Production TLS/ASGI proxy trust, Secure __Host- cookies, deployment CORS/origin matching, edge throttling, ingress/APM secret redaction and restricted grants require deployment verification. In-memory limits are process-local and BFF peers aggregate traffic; provider/edge brute-force controls remain necessary.
4. IdP-only disable/logout does not terminate existing FLUENTT sessions. Use approved local disable/revoke-all. There is no back-channel logout, refresh token, named operator actor identity, public registration, password login, re-enable/account-management API or automatic retained-session/attempt cleanup. Operational attribution and retention/cleanup need review before real production use.
5. Authenticated browser interaction with an actual provider, multiple-browser revocation races, screen-reader/keyboard audits, alternate device widths, native mobile interactions and production browser cache behavior are **unverified**. Mobile exports/typecheck/lint were not rerun because no mobile source/dependency changed in Section 08; Section 07 records their prior results.
6. Accept Section 08 with these limits, supply the authoritative Section 09 prompt and define its permissions/provisioning requirements before further implementation. Do not infer curriculum, management or research authorization from the shell.

## Every Section 08 changed file

Earlier Section 06/07 edits and the user's mobile package-lock modification remain in the working tree and are not counted as new Section 08 work. This section changes/adds **45 files**:

```text
AGENTS.md
README.md
apps/admin/.env.example
apps/admin/next.config.ts
apps/admin/src/app/globals.css
apps/admin/src/app/page.tsx
apps/admin/src/app/api/admin/[action]/route.ts
apps/admin/src/app/dashboard/page.tsx
apps/admin/src/app/dashboard/error.tsx
apps/admin/src/app/login/page.tsx
apps/admin/src/components/admin-login.tsx
apps/admin/src/components/admin-session.tsx
apps/admin/src/services/admin-contract.ts
apps/admin/src/services/admin-server.ts
docs/ADMIN_AUTH.md
docs/API_DESIGN.md
docs/ARCHITECTURE.md
docs/DATABASE_SCHEMA.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/IDENTITY_AND_SESSIONS.md
docs/MIGRATIONS.md
docs/SECTION_08_REPORT.md
scripts/admin-web.test.mjs
services/api/.env.example
services/api/app/api/v1/router.py
services/api/app/core/config.py
services/api/app/main.py
services/api/app/models/__init__.py
services/api/app/models/admin_sessions.py
services/api/app/modules/administration/__init__.py
services/api/app/modules/administration/cli.py
services/api/app/modules/administration/oidc.py
services/api/app/modules/administration/repository.py
services/api/app/modules/administration/router.py
services/api/app/modules/administration/security.py
services/api/app/modules/administration/service.py
services/api/migrations/versions/0003_admin_sessions.py
services/api/requirements.txt
services/api/requirements.lock.txt
services/api/scripts/document_schema.py
services/api/tests/admin_support.py
services/api/tests/test_admin_auth.py
services/api/tests/integration/test_admin_postgresql.py
services/api/tests/test_schema.py
```

Installed only the pinned OIDC dependencies into the existing project virtual environment; transitive cryptography/cffi/pycparser versions are recorded in requirements.lock.txt. No system-wide installation, npm dependency change, production account or secret was created.

Preservation checks: apps/mobile/package-lock.json SHA-256 remains `92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6`; PROJECT_HANDOFF.md remains `EFBA6D1FA5B51D4FD0695553E0BBA19E857E30C37F3D09E00C6249EC45F39F71`. Existing uncommitted Section 06/07 work is retained. Frozen migrations show no Git diff. No commit/push or Section 09 implementation occurred.
