# Administrator authentication — Section 08

Section 21 adds explicitly approved operator-only grant/revoke-grading-read and grant/revoke-grading-run commands. Reader grants grading.read; runner grants grading.read+grading.run, with no automatic grants or mobile promotion. Internal evaluation mutations require live permissions, Origin and CSRF in the same User/browser-session/evaluation transaction. New grading permissions do not grant direct question-key access; no Next BFF, dashboard or result-release UI is added. OIDC remains safely disabled until configured. See GRADING.md and SECTION_21_REPORT.md; older default-permission statements below retain their original scope.

Section 11 adds separate operator questions reader/editor/publisher grants/revokes. Curriculum roles do not imply bank access. Key reads need questions.read+write; publish/retire need read+write+publish. Locked User/session callbacks and Origin+CSRF protect mutations. QUESTION_BANK.md lists exact commands and backend-only preview contracts; no Next authoring/proxy surface or OIDC activation is added.

Section 10 adds operator-only curriculum_editor/read+write and curriculum_publisher/read+publish grants/revokes; publishing/retirement need both roles. Default provisioning remains dashboard-only. Domain mutation callbacks require live permissions and CSRF under existing User/session locks in the same write/audit transaction. Next /curriculum verifies authorization server-side; fixed manage BFF paths enforce Origin, allowed headers and bounded bodies. Backend calls explicitly await a real Next request, including partial-prefetch rendering. No real OIDC activation/admin grant or runtime auth bypass was added. See CURRICULUM.md and SECTION_10_REPORT.md.

Post-Section 09 verification: local PostgreSQL now runs at head 0005_constraint_names and the real database authentication/provisioning/revocation tests run. The user confirmed no provider is available and requested sign-in remain disabled. No actual administrator was provisioned. Provider-enforced MFA and deployed TLS/browser-cookie verification remain pending; unit/synthetic provider checks do not satisfy them. See LOCAL_VERIFICATION_REPORT.md and MIGRATIONS.md; use current head, rather than the historical 0003 milestone below.

Section 09 adds explicitly approved curriculum.read reads and operator grant-curriculum-read/revoke-curriculum-read commands (CURRICULUM.md). Provisioning still grants dashboard-only access by default. These reads run under the same live User/session locks and transaction as authorization; Next adds only fixed GET curriculum proxy paths. No authoring UI, arbitrary permission management, public registration or research access is added. Section 08 statements about future permissions below describe that milestone.

FastAPI is the authentication and authorization authority. Next.js provides same-origin browser endpoints and server-verified dashboard rendering; it never accesses PostgreSQL. Mobile identity and SecureStore contracts are unchanged.

## Approved policies

The user approved provider-neutral OIDC with provider-enforced MFA. No provider has been selected or configured. Sign-in is disabled until issuer, confidential client ID/secret and accepted MFA evidence are supplied locally. There is no password fallback, public registration, seeded administrator or development authentication bypass.

Operators provision separate administrator profiles mapped to exact `(issuer, subject)`, with `administrator_shell` role and `dashboard.view` permission. Existing mobile accounts cannot be promoted. Only the dashboard/session shell is authorized; future modules remain unavailable.

Browser sessions allow multiple browsers, expire after 30 minutes idle or 8 hours absolute, and support current-session logout and operator revoke-all/disable. Successful authenticated lookups slide idle expiry without extending absolute expiry. No background heartbeat keeps sessions alive. Identity-provider logout/revocation does not automatically revoke FLUENTT sessions: operators must also disable/revoke locally. Back-channel logout and full account management require future approved work.

## Configure locally

Apply migrations through `0003_admin_sessions` using the normal reviewed workflow in MIGRATIONS.md. Configure the backend's ignored `.env` / deployment secret manager:

- `FLUENTT_ADMIN_WEB_ORIGIN`: exact website origin, no trailing slash; defaults to `http://localhost:3000` for development.
- `FLUENTT_ADMIN_OIDC_ISSUER`: exact HTTPS discovery issuer; maximum 255 characters. Discovery issuer must match exactly.
- `FLUENTT_ADMIN_OIDC_CLIENT_ID` and `FLUENTT_ADMIN_OIDC_CLIENT_SECRET`: a registered confidential client. Never send the secret in chat or put it in `NEXT_PUBLIC_*`.
- `FLUENTT_ADMIN_OIDC_MFA_CLAIM`: `acr` (string) or `amr` (array).
- `FLUENTT_ADMIN_OIDC_MFA_VALUES`: JSON array of explicitly approved values. Empty defaults disable sign-in. At least one configured value must appear in the verified claim. There is no universal default meaning of MFA: validate the chosen provider's claim semantics and enforcement before enabling real access.
- `FLUENTT_ADMIN_AUTH_LIMIT`: default 10 start/callback requests per peer per existing 60-second window, independently scoped from mobile limits.

Configure Next.js server environment `FLUENTT_API_URL` and the same `FLUENTT_ADMIN_WEB_ORIGIN`. `NEXT_PUBLIC_API_URL` remains only the existing public health client configuration. Both server URLs must use HTTPS in production. Use the same development/production mode on API and website, because cookie names differ. Health remains available without database/OIDC configuration.

Register exactly `<admin-web-origin>/api/admin/callback` as the provider callback. The supported provider contract is OIDC discovery, authorization code response via GET query, PKCE S256, `client_secret_basic`, HTTPS token/JWKS endpoints, RS256 or ES256 signed ID tokens, and `auth_time`. Requests use `openid`, `prompt=login` and `max_age=300`; ACR configurations also send `acr_values`. Auth time must be within 300 seconds with 30-second clock tolerance. Other algorithms, response modes, public clients, provider-specific claims/policies or authentication methods are not silently accepted. Select a compatible provider or review an extension explicitly.

## Initial provisioning and operations

Use a locally configured **operator** PostgreSQL credential with appropriate grants, after migrations. API runtime credentials should not be able to provision roles/identities. Commands run from `services/api`; placeholders below are identifiers, never real secrets:

```powershell
.venv/Scripts/python -m app.modules.administration.cli provision --username OperationsAdmin --issuer https://YOUR-APPROVED-ISSUER --subject YOUR-EXACT-PROVIDER-SUBJECT
.venv/Scripts/python -m app.modules.administration.cli revoke-all --username OperationsAdmin
.venv/Scripts/python -m app.modules.administration.cli disable --username OperationsAdmin
```

Provision creates a fresh globally unique 3–24 character username, active `administrator` User, AdminIdentity, shell role membership and permission linkage in one transaction with an audit event. Reserved public usernames remain reserved. A duplicate username/identity fails without returning/promoting an existing account. A transaction advisory lock serializes creation of shared role/permission references; uniqueness constraints remain authoritative. No command creates provider accounts, sets passwords or grants future user/content/research permissions.

Disable locks the administrator User, sets disabled status, revokes every browser session and audits atomically. Revoke-all leaves the account enabled for subsequent OIDC login. Neither command touches mobile credentials. No public or web re-enable/promote API is provided. Operator events use a null actor with `reason=operator_cli`; correlate them with restricted operator execution logs. A named operator identity audit scheme remains a deployment decision.

## Protocol and security

1. Same-origin POST starts sign-in. Both website and backend require the configured Origin and reject cross-site Fetch Metadata. GET start is unsupported. This prevents drive-by login initiation.
2. FastAPI creates a ten-minute attempt with random state and browser binding. PostgreSQL stores only their SHA-256 digests. The binding is an HttpOnly cookie; PKCE verifier and nonce derive from it plus state using domain-separated HMAC. Neither raw verifier nor binding is stored in the database.
3. Callback requires matching browser cookie/state, unexpired attempt and a row lock. The attempt is consumed before exchanging the code, so replay/retries require starting again. There is no caller-selected return URL.
4. Authlib exchanges the code; joserfc verifies the signature using discovery JWKS and a fixed asymmetric algorithm allowlist. Authlib validates issuer, audience/authorized party, expiry, issued time, nonce and optional access-token hash. Local checks require fresh auth_time, subject and approved MFA evidence. Discovery/JWKS fetches carry no access token. Provider redirects during server HTTP calls are rejected. TLS verification remains enabled; environment proxies are not implicitly trusted.
5. Only an active, unarchived, explicitly mapped administrator with `dashboard.view` can obtain a session. There is no email/username fallback or mobile-role promotion. A new random session secret is generated on every successful login; a supplied prior session for the same administrator is revoked. Other browser sessions remain independently valid.
6. Separate `admin_browser_sessions` hold SHA-256 credential digests, idle/absolute deadlines and revocation. Every lookup rechecks the current mapped User status, role and permission in the same transaction. User then session locks serialize authentication against operator disable/revoke-all. Locked session reads refresh ORM state after waiting, preventing stale pre-lock revocation data.
7. Admin endpoints accept only the dedicated cookie. Authorization/Bearer headers are explicitly rejected on protected session endpoints. No administrator credential is issued as JSON or placed in localStorage. A stolen session cookie is still a bearer secret until expiry/revocation; HTTPS, HttpOnly, short expiry and revocation mitigate this, without claiming complete replay prevention.
8. Cookies are host-only, HttpOnly, Path=/, SameSite=Lax; production adds Secure and `__Host-` names. Session cookie lifetime is eight hours; server idle/absolute checks remain authoritative. Development cookies are `fluentt_admin`/`fluentt_oidc`; production names add `__Host-`.
9. `/admin/me` returns a session-bound HMAC CSRF value (not a bearer credential). Logout requires that value plus exact Origin. Future cookie-authenticated mutations must enforce both protections and their specific backend permissions. SameSite alone is insufficient.
10. The Next.js BFF forwards only the two admin cookies to fixed, allowlisted FastAPI paths. It forwards no mobile Authorization header or unrelated cookies and accepts no arbitrary proxy URL. CORS remains credential-disabled for the existing API; admin browsers use same-origin Next routes, so no credentialed cross-origin policy is needed.

Backend authentication responses, BFF responses and protected dashboard rendering use no-store. Next checks authorization within the protected page, before account data is rendered, with Suspense for its existing Cache Components mode. Logout uses full navigation to sign-in; invalid sessions clear cookies through the BFF. On SSR denial, the server redirects without rendering account context; any residual invalid HttpOnly cookie conveys no access and expires normally. Browser back-cache restoration and idle deadline trigger verification; network failures offer retry and do not invent an authenticated result.

Audits record login start/success/failure, CSRF rejection, logout, provisioning, disable and revoke-all. Reasons are fixed categories; no passwords, raw state/binding/session secrets, provider tokens, authorization codes or provider error text are recorded. Existing request-ID/status-only logs remain. Next development callback request logging is suppressed. Always use Uvicorn `--no-access-log`; configure ingress/APM/tracing to omit callback query strings, Cookie/Set-Cookie, Authorization and CSRF headers. Avoid HTTP debug logging in production.

## Deployment and verification gates

- PostgreSQL is mandatory. There is no SQLite or memory runtime fallback. New migration is additive and explicitly denies PUBLIC table access, installs updated_at triggers using the existing function, and leaves research guards/grants unchanged. Review separate migration/operator/runtime grants before real data. Runtime needs session/attempt SELECT/INSERT/UPDATE, mapping/permission reads, User locking and audit INSERT; provisioning writes belong to operators.
- MFA policy, exact issuer/client/subject mapping, callback registration, TLS and trusted reverse proxies require actual deployment verification. ASGI must see HTTPS in production; trust forwarding headers only from configured infrastructure.
- Process-local throttling is bounded but not a distributed or per-end-user edge defense. The BFF aggregates requests under its peer address. Add global client-aware edge budgets and provider brute-force protections before public deployment/scaling; never trust arbitrary forwarding headers.
- Attempt/session rows are retained; expiry makes them unusable. Retention/cleanup policy and audit retention need a separately reviewed operational decision before sustained production use. No automatic deletion job is introduced.
- See SECTION_08_REPORT.md for actual checks. Signed-token and HTTP doubles prove contracts, not integration with a real issuer/PostgreSQL. Real provider MFA, browser cookies over deployed TLS, concurrent database races and native mobile checks remain explicitly unverified here.

Library references: [Authlib OAuth clients](https://docs.authlib.org/en/stable/oauth2/client/http/index.html), [joserfc JWT verification](https://jose.authlib.org/en/guide/jwt/). Dependencies are pinned; existing HTTPX remains supported through Authlib's compatibility adapter, which emits a deprecation notice. A future HTTPX2 migration must be reviewed independently.
