# Section 10 — Administrator curriculum management

Implemented 2026-10-18 (Asia/Manila) after acceptance of Section 09 and the local database repair. No Section 11 work, commit or push.

## Approved scope and reconciliation

Read the preserved PROJECT_HANDOFF.md, development plan, Sections 08/09 reports, curriculum/API/architecture/decisions/admin security documents, migration guards and current code/Git changes. The handoff describes Sections 00–05; newer accepted reports and LOCAL_VERIFICATION_REPORT.md supersede its historical environment/head notes. PostgreSQL is now available at head **0005_constraint_names**. Real OIDC remains intentionally disabled pending a provider/MFA configuration.

The user approved all recommended policies, correcting an accidental permission selection:

- Manage the existing version→grade→subject→quarter→topic→lesson→competency hierarchy plus global subject definitions. No new module/level or rich lesson-body model; Filipino remains distinct from Tagalog.
- Edit/reorder/reparent/remove only eligible unfrozen/unreferenced drafts. Published editions retire as a whole, never unretire, and corrections use new editions/child IDs. Shared labels referenced by frozen editions/classes remain immutable.
- Publication requires explicit review confirmation and source/licensing references plus review note, at least one complete branch through competencies, and no empty included parent. No all-grades/four-quarters rule, invented content counts, academic review role/status or verification claim.
- Operator-managed editor grants read+write; publisher grants read+publish. Publishing/retirement require both grants. Existing/default administrators receive no automatic permission.

## Delivered backend and persistence

Seven method/path patterns under **/api/v1/admin/curriculum/manage**, serving eight fixed kinds: versions, grades, subjects (edition links), quarters, topics, lessons, competencies, global-subjects. Exact fields, pagination, errors and operator commands are in CURRICULUM.md.

| Method/path | Behavior |
|---|---|
| GET /{kind} | Safe structural pages; literal search, applicable lifecycle filters, validated parent, bounded pagination, deterministic ordering. |
| GET /{kind}/{id} | Structural values, IDs, parent/version, frozen state and current revision. |
| POST /{kind} | Strict per-kind creation; child creates validate parent and its If-Match. |
| PATCH /{kind}/{id} | Validated partial fields, ordering and optional move; source If-Match plus destination target_revision. |
| DELETE /{kind}/{id} | Single eligible draft node; no cascade, RESTRICT preserves children/content/history. |
| POST /versions/{id}/publish | Explicit review payload; prepare all topics/lessons, flush, then freeze root atomically. |
| POST /versions/{id}/retire | Whole-version draft/published→archived; immutable historical content remains. |

All reads use curriculum.read. Every mutation requires read+write, dedicated admin cookies, exact Origin, session-bound CSRF, live mapped administrator status/permissions and the existing locked User/session transaction. Publish/retire additionally require curriculum.publish. Permission checks and domain callbacks share one transaction; there is no authenticate-then-write gap. Structural DML acquires exclusive advisory 78090001 before rows; reads hold its shared form while materializing responses.

If-Match fingerprints the whole edition, including its hierarchy and referenced labels. Changes elsewhere in an edition invalidate open forms; moves compare both old and destination state. Fingerprints are not credentials and are reused per edition inside a list request. Duplicate code/order, invalid/reference-protected writes and database concurrency errors produce safe conflicts; missing revisions return 428, stale revisions 409. Database constraints/guards remain authoritative.

Successful mutations write actor-attributed curriculum audits (entity kind/ID, time, request ID) without body text/secrets. Publication stores review/source/licensing references and reviewer ID/time privately in source_metadata.administrative_review; mobile/read-only Section 09 DTOs do not expose this metadata. A new edition remains academically unverified. No educational content or real administrator was seeded.

New CLI commands explicitly grant/revoke curriculum-editor and curriculum-publisher roles, retaining reader compatibility, User locks, idempotent grants, drift checks and atomic audit. No arbitrary RBAC management, mobile promotion or default privilege expansion is added.

**No migration is necessary.** The existing 60 tables, JSON metadata, audit model, uniqueness/FKs and snapshot functions suffice. Frozen revisions 0001–0005 and SQL artifacts remain unchanged. No developer database was downgraded or reset; all new synthetic authoring data belonged to generated disposable databases, removed after tests.

## Delivered website and security

Protected **/curriculum** verifies server authorization before rendering account/management context; backend APIs recheck permissions independently. Dashboard navigation/card exposes Curriculum only with read permission. Users without read receive an access-required state. Existing account/session controls remain, with actual permission context and an optional unsaved-change guard before sign-out.

Real forms browse/create/edit hierarchy, search/filter/page collections, search/page subject definitions, validate ordered fields, and verify an advanced destination parent before moving. Breadcrumbs provide structural preview; no lesson delivery or assessment payloads are rendered. Eligible draft removal and edition retirement require accessible application confirmations. Review fields/confirmation publish the complete version; frozen pages omit editing controls. No mock records are inserted into the normal database.

Forms provide labeled/native required controls, field bounds, success/empty/loading/retry/conflict states, unsaved navigation protection and beforeunload for close/reload. Confirmation dialogs focus the safe action, support Escape and trap Tab; responsive wrapping preserves long metadata/IDs. Session denial clears protected state. Visibility/pageshow/idle checks revalidate without a keepalive heartbeat. Late collection reads are generation-checked/aborted; no token or form draft is stored in browser storage.

The fixed BFF extends only approved management entity/method paths, validates Origin, bounds JSON to 32 KiB and forwards only permitted cookies/write headers. It never forwards mobile Authorization or arbitrary paths. Invalid sessions clear only the session cookie, preserving an independent OIDC attempt. Protected pages/API responses are no-store.

Browser testing exposed a request-time rendering issue during partial-prefetch prerendering; the shared backend helper now explicitly awaits Next connection() before cookies/config/network timing. A live development reload loop stopped after explicitly scoping Turbopack to the standalone administrator app, keeping monorepo runtime/database files outside its watcher boundary. The new error boundary also requires its own client directive. These corrections passed the final build/HTTP/browser checks; no authentication/caching security control was disabled.

## Verification

| Check | Actual result |
|---|---|
| Initial focused backend/admin/curriculum run | **72 passed**, including the first 7 live management tests. |
| Full backend suite with PostgreSQL | **342 passed, zero skipped**, two existing dependency deprecation warnings. Includes 9 new management tests and earlier identity/class/enrollment/admin/curriculum/migration regressions. |
| Final targeted management checks | **9 passed** after search expansion and per-request fingerprint reuse; covers real HTTP CRUD/persistence, review validation, draft/published/retired visibility, immutable shared labels, stale/missing revisions, duplicate ordering, FK removal conflicts, moves, permission/Origin/CSRF/mobile rejection, revocation, concurrency, defaults and incomplete branches. |
| Existing client/state/static-component tests | **45 passed**, unchanged mobile functionality. Existing Node module-type warnings remain. |
| Expanded Next HTTP integration | **10 passed** using real Next and a synthetic backend contract, including permission-gated pages, write-path/method/header allowlists, Origin/size checks, cookie isolation and earlier session regressions. |
| Administrator production build | **Passed**, /curriculum included behind authenticated Suspense boundary. |
| Administrator TypeScript / ESLint | **Passed**, serial checks after production build. |
| Backend Ruff / format / compilation | **Passed**, 95 Python files satisfy formatting. |
| Real browser + Next + FastAPI + PostgreSQL | **Verified** with a synthetic admin session in a generated disposable database: draft create/edit persisted, unsaved keep/discard confirmation, whole-version publish/frozen controls, retire with retained hierarchy, keyboard sign-out and denial of direct curriculum access afterward. |
| Responsive browser check | At requested 390×844 viewport (375 CSS-pixel content width after scrollbar), document scrollWidth equaled clientWidth; no horizontal overflow. Default viewport restored. |
| Preservation | All earlier unrelated source changes, mobile package-lock, PROJECT_HANDOFF.md and frozen migrations/SQL remain unchanged; no deleted source files, dependency updates, commit or push. |

The first full regression run found two fixture-isolation failures: newly published API records remained in the older shared test database, interfering with a single-hierarchy assumption and correctly preventing downgrade. Management API fixtures now use their own UUID database; the full suite passed without changing the downgrade/snapshot guards. The first Next HTTP attempt encountered an already running development-server lock; stopping that task-owned server resolved it. Native browser confirm blocked automation, so in-page actions now use tested accessible application dialogs.

The browser harness used the real application/BFF/database and initialized only a **synthetic test session** outside production source/configuration. It did not verify OIDC/provider MFA, create a real administrator or enable a runtime bypass. The harness/server and UUID database were stopped/removed after verification. Browser evidence is saved locally in ignored private-data/verification/section10-published.png; the screenshot shows a synthetic published edition, not real educational content.

## Limits and Section 11 prerequisites

1. Real issuer/client/MFA evidence, exact provider subject mapping, actual operator provisioning/grants and deployed HTTPS cookie/provider login remain unconfigured/unverified. Sign-in stays disabled as the user requested. Local synthetic browser success is not a real-provider claim.
2. Academic source/licensing references are publisher attestations, not independent verification. Rich lesson bodies, question-bank ownership/version policy, class edition/subject binding and historical learner access still need the next relevant approved contracts. No question-bank authoring, student lessons, grading, AI/ESR or research execution is implemented.
3. Full-edition hashing and global advisory serialization favor correctness; large-catalog throughput, distributed limits, production restricted DB grants, trusted proxies/TLS, retention/operator attribution and comprehensive screen-reader/multi-browser audits remain deployment checks.
4. Native Android checks and mobile exports were not rerun in Section 10 because mobile source/dependencies did not change; earlier results remain historical. Mobile backend/client regressions did run. Current mobile preview/credential boundaries are unchanged.
5. No automatic edition cloning, bulk reorder, cascading deletion or independent child publication/retirement is provided. Use draft metadata/parent moves and whole-version lifecycle under the approved policy.
6. Stop for Section 10 acceptance and the authoritative Section 11 prompt.

## Every Section 10 changed/new source or documentation file

**29 files** relative to the pre-section hash baseline:

```text
AGENTS.md
README.md
apps/admin/next.config.ts
apps/admin/src/app/api/admin/curriculum/[...segments]/route.ts
apps/admin/src/app/curriculum/error.tsx
apps/admin/src/app/curriculum/page.tsx
apps/admin/src/app/dashboard/page.tsx
apps/admin/src/app/globals.css
apps/admin/src/components/admin-nav.tsx
apps/admin/src/components/admin-session.tsx
apps/admin/src/components/curriculum-manager.tsx
apps/admin/src/services/admin-server.ts
apps/admin/src/services/curriculum-contract.ts
docs/ADMIN_AUTH.md
docs/API_DESIGN.md
docs/ARCHITECTURE.md
docs/CURRICULUM.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/SECTION_10_REPORT.md
scripts/admin-web.test.mjs
services/api/app/api/v1/router.py
services/api/app/modules/administration/cli.py
services/api/app/modules/administration/service.py
services/api/app/modules/curriculum/management.py
services/api/app/modules/curriculum/management_router.py
services/api/app/modules/curriculum/management_schemas.py
services/api/tests/integration/test_curriculum_management_postgresql.py
services/api/tests/test_curriculum.py
```

Ignored test logs, browser harness/evidence and normal build output were also generated. No environment secret/configuration was changed in Section 10.
