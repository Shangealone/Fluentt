# Section 09 — Curriculum structure and learning content architecture

Implemented in source on 2026-10-18 after the user's Section 09 prompt accepted Sections 00–08. No authoring screens, question-bank management, assessment delivery, ESR/AI or research execution were implemented. No curriculum/content/progress/admin account was seeded, no database migrated, and no permission command, commit or push was executed.

## Inspection and approved decisions

Read the preserved handoff, development plan, architecture/decisions, schema/API/database/migration documents and latest reports. Inspected existing curriculum, grade/subject, classroom/membership, question/version, activity, learning context/progress, research level, identity/session and administrator permission code. Git status and hashes of all 217 existing nonignored files were captured before changes; pre-existing Sections 06–08 and mobile lockfile edits were retained.

The original hierarchy is authoritative: version → grade → subject → quarter → topic → lesson → competency. There is no ordinary module or lesson-revision table. The 58-table foundation is reused, with the two accepted Section 08 admin tables bringing the unchanged total to 60. Five research levels remain separate study snapshots; they are not replacement quarters/modules. Filipino and Tagalog remain distinct subject/language concepts.

The user explicitly approved:
- Published structure browsing for all authenticated mobile roles; optional class scope additionally enforces owner/eligible membership and actual grade/explicit subject.
- Admin draft/retired structure reads using curriculum.read, with explicit operator CLI grant/revoke; existing/default admins retain dashboard-only access.
- The recommended immutable whole-version snapshot, retirement through archived status and new version/child IDs for corrections. No unsupported academic structure or lesson counts were inferred.

Open academic policies are documented in CURRICULUM.md: approved sources/licensing/review evidence, grade/subject/language compatibility, lesson-body format, publication completeness, research-level content/counts/thresholds, cross-lesson competency/assessment rules, class edition selection and historical retired-content access. These do not block the authorized structure reads; they must be resolved before the relevant authoring/delivery work.

## Implemented contracts and boundaries

CURRICULUM.md lists all 14 GET suffixes under each of /api/v1/curriculum and /api/v1/admin/curriculum (28 backend paths). They provide version list/detail, grade/subject/quarter/topic/lesson traversal/details and competency list/detail. Unknown/invalid queries are rejected; limit is 1–100 (default 50), offset 0–100000. Grade/subject filters and optional mobile class_id intersect the actual ancestry. Admin lifecycle filters are limited to versions/topics/lessons.

Explicit DTOs return only structure/competency fields. Private source JSON, question prompts/keys, attempts/progress, media/model configuration and research data are excluded. Stored unverified status is never promoted to an academic verification claim. Existing empty parents list no items; missing/hidden parents and details share generic 404. Deterministic ordering and has_more use bounded queries. No implicit latest edition or fake progress/counts are returned.

Mobile reads require existing device authentication and every relevant published ancestor. Class scope revalidates active class/instructor and owner or active/unended membership under shared locks, including direct descendant IDs. Unconfigured subject returns empty items plus requires_subject=true; current class APIs still do not configure a subject, and this section does not invent a setter or infer one from language.

Admin reads require mapped active administrator status, dashboard.view and curriculum.read. A narrowly scoped read callback extends the existing session resolver so permission verification and queries share the same User/session transaction, rather than authenticating and then opening an unchecked second transaction. Existing session/profile/logout contracts remain compatible.

The Next.js GET-only adapter accepts only fixed hierarchy paths/UUIDs and forwards the existing dedicated admin cookies to FastAPI. No authoring screen or generic proxy is added. Unauthorized curriculum reads clear only the invalid session cookie, preserving an independent in-flight OIDC binding. Backend permissions remain authoritative.

Operator grant-curriculum-read/revoke-curriculum-read commands manage a dedicated read role only, with atomic auditing and User locking. Provisioning defaults do not change. Grants are idempotent and reject unexpected extra privileges on the role; revoke fails for review if another role still grants read access. Other readers/dashboard sessions remain intact. No operator action was run against a real database.

## Additive migration and content relationships

New head: 0004_curriculum_snapshots. No table/column/model replacement or data rewrite; frozen 0001–0003 remain unchanged. New functions/triggers protect published/retired hierarchy metadata, links/ordering, and referenced shared grade/subject labels. Root lifecycle preserves content/IDs and publication evidence; legacy missing evidence is not backfilled.

Existing draft hierarchy already referenced by assignment_versions/learner_progress is protected against rewriting assigned/completed IDs. Curriculum writes and assignment/progress reference-link changes use exclusive advisory boundary 78090001; structure reads use the shared form. Future writers must acquire the lock before row DML and use consistent ordering/reviewed conflict handling. Ordinary progress updates retaining the same lesson avoid the lock. This coarse correctness design is not a throughput or deadlock-free deployment claim. Downgrade refuses protected curriculum.

No publication API is exposed. Future publishers prepare children before publishing/freezing the root, and must add their own approved academic review, permission, validation and audit contract. Current browsing hides retired versions; future historical resolvers need specific assignment/progress authorization.

Existing QuestionRevision/QuestionCompetency, VocabularyItem, PronunciationActivity, ConversationTopic, AssignmentVersion, LearnerProgress and research snapshot links are documented without serving their private/executable payloads or implementing those later features. Item-version/ownership/language rules remain mandatory before future delivery.

The new snapshot guard covers structural rows through competencies, not the independently versioned activity/item collection. Existing item locks remain; future delivery must pin explicit item versions and cannot silently treat later lesson-linked items as part of an old assignment.

## Actual verification

| Check | Result |
|---|---|
| Focused curriculum/admin authentication | Initial focused run: 63 passed; later additions included in final full suite. |
| Final API pytest -q | **257 passed, 72 skipped**, 2 dependency deprecation warnings. Includes 29 curriculum API/query/projection tests plus the new offline migration test and all earlier identity/class/enrollment/admin regressions. |
| PostgreSQL curriculum checks | **24 added, all skipped** without FLUENTT_TEST_DATABASE_URL. They cover actual hierarchy/order, draft ancestry, retirement, frozen metadata/shared labels, append/reparent rejection, invalid parents/order/deletion, historical draft protection, class scope, explicit permission grants/revocation/role drift and shared/exclusive locking. |
| Next.js HTTP integration | **8 passed** using the real Next server with a synthetic backend contract. Includes fixed curriculum read paths, method/path rejection, cookie handling and prior admin routing/session/CSRF/outage regressions. This is not a real issuer/database integration. |
| Existing Node client/state/component checks | **45 passed** across api-clients/onboarding/classes/enrollment/navigation/dashboard-components. No native execution claimed. |
| Next production build | **Passed**, including dynamic /api/admin/curriculum/[...segments]. |
| Next TypeScript / ESLint | **Passed**. One concurrent typecheck initially raced Next dev-type regeneration; after the test server stopped, production build and serial typecheck passed. No tsconfig/source workaround was introduced. |
| Backend Ruff / format / compilation | **Passed**, 87 Python files formatted; compileall passed. |
| Migration head / offline SQL | Single head **0004_curriculum_snapshots**; upgrade/downgrade compilation tests pass. No live SQL execution or Alembic application occurred. |
| Schema documentation | Regenerated complete 60-table dictionary/ERD; no new tables or content. |

Existing Starlette/AnyIO and Authlib/HTTPX deprecation warnings remain; Node emits its existing module-type warning. Backend and Next HTTP/build checks used the previously required Windows sandbox exceptions. No unavailable test was counted as passed.

## Limitations and Section 10 prerequisites

1. PostgreSQL remains unavailable/unconfigured for integration. All **72** PostgreSQL cases are skipped, including 24 new ones. PL/pgSQL execution, constraints, guards, races, grants, downgrade behavior and operator persistence are **unverified**.
2. The frozen-0001 duplicate constraint-name bootstrap blocker remains documented in MIGRATIONS.md. An additive 0004 cannot repair failure before it runs. Approve a baseline/bootstrap repair strategy after inspecting any existing deployment history, then validate only on the generated disposable database before applying a reviewed forward migration. No frozen revision or existing database was reset/repaired here.
3. Real OIDC/MFA configuration, admin provisioning, curriculum.read grant/revoke, deployed TLS/cookies/proxy trust and restricted DB grants remain activation checks from Section 08. There is no real account/provider/database test success claim.
4. There is no catalog/authoring screen, generic lesson-body model, content seed, class subject/edition configuration workflow, publication API or historical retired-content resolver. No live educational content exists merely because structural APIs are implemented.
5. Mobile source/dependencies did not change. Typecheck/lint/web/Android exports and native-device/browser accessibility checks were not rerun in this section; earlier results remain historical. Current verification is backend/HTTP/client/static-render coverage, not a new native end-to-end run.
6. Before future authoring: resolve academic content/review policies, publication completeness, explicit class subject/edition selection, rich content format and cross-lesson item rules. Future writers need narrow approved permissions, transaction/advisory lock ordering, immutable snapshot handling, safe conflicts and audits.
7. Receive acceptance of Section 09 and the exact Section 10 prompt before further implementation. Do not infer authoring, delivery, AI or research permission from this foundation.

## Every Section 09 changed file

**27 files** changed/added relative to the pre-section working tree, including this report. Earlier unrelated edits remain intact.

```text
AGENTS.md
README.md
apps/admin/src/app/api/admin/curriculum/[...segments]/route.ts
docs/ADMIN_AUTH.md
docs/API_DESIGN.md
docs/ARCHITECTURE.md
docs/CURRICULUM.md
docs/DATABASE_SCHEMA.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/MIGRATIONS.md
docs/SECTION_09_REPORT.md
scripts/admin-web.test.mjs
services/api/app/api/v1/router.py
services/api/app/main.py
services/api/app/modules/administration/cli.py
services/api/app/modules/administration/service.py
services/api/app/modules/curriculum/__init__.py
services/api/app/modules/curriculum/repository.py
services/api/app/modules/curriculum/router.py
services/api/app/modules/curriculum/schemas.py
services/api/app/modules/curriculum/service.py
services/api/migrations/versions/0004_curriculum_snapshots.py
services/api/scripts/document_schema.py
services/api/tests/integration/test_curriculum_postgresql.py
services/api/tests/test_curriculum.py
services/api/tests/test_schema.py
```

No dependencies, environment secrets, mobile files or frozen migrations changed. The complete pre-section hash comparison is used to verify unrelated preservation; no deletion is intended. The preserved mobile lockfile SHA-256 is 92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6; PROJECT_HANDOFF.md is EFBA6D1FA5B51D4FD0695553E0BBA19E857E30C37F3D09E00C6249EC45F39F71.

