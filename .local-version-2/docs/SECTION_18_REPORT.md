# Section 18 — Instructor assignment builder

Completed 2026-10-19 (Asia/Manila). No Section 19 implementation, commit or push.

## Inspection and approved decisions

Reviewed the historical PROJECT_HANDOFF.md, development plan, accepted question-bank/method reports through Section 17, API/architecture/security/class/curriculum/database/migration contracts and current Git changes. Inspected existing assignments/versions/items/attempts/FKs/freeze triggers, exact question-revision/public DTOs, ownership/session locks, enrollment, mobile role policy/shared components and manifests. The historical handoff remains unchanged; later accepted reports supersede its environment/head statements. Read Expo SDK 58 guidance and the installed Expo Router usePreventRemove signature, whose repeat callback differs from older router examples.

The user explicitly approved all three recommendations:

1. One selected published lesson; all selected questions from that lesson, matching class grade/language and its subject when bound. For null-subject classes, snapshot the explicit lesson subject without modifying the class. Binding remains required before future publication.
2. Instructor front-only access to globally published locked revisions in that eligible lesson; no keys/Flashcard backs. One stable Question per draft even across versions. Preserve pinned retired-content history, flag ineligible content and revalidate remaining selections before edits. Archive rather than hard-delete; no restore/publication.
3. Title 1–200, optional instructions up to 8,000, 0–200 ordered items, fixed class, UUID creation idempotency and If-Match edits/archive. Add an additive migration allowing draft points/max_attempts to be NULL, preserving existing values and requiring configuration before future locking. No scoring or attempt policy inferred.

## Delivered backend, data and security

New app/modules/assignments reuses Assignment → AssignmentVersion → AssignmentQuestion and existing mobile sessions, classroom ownership and public question contracts. Each operation authenticates/locks the live user+session, requires instructor role, locks/revalidates the owned class, then coordinates content through advisory 78090001 before domain DML/materialized reads. Writes lock the assignment and check freshness in the same transaction. Owner-before-class matches instructor/enrollment conventions. Other owner/missing IDs return 404, other mobile roles 403, invalid credentials 401; no admin cookie/mobile role promotion or client-only authorization.

| Method | Endpoint under /api/v1 | Implemented contract |
|---|---|---|
| GET / POST | /classes/{class_id}/assignments | Owner-only paged draft/archived summaries; create complete draft with UUID Idempotency-Key. Summaries contain real question_count and safe context, not repeated full item bodies. |
| GET | /classes/{class_id}/assignment-lessons | Published lesson contexts filtered by class grade and bound subject, with search/pagination. Unbound subject remains explicit in selected context. |
| GET | /classes/{class_id}/assignment-questions?lesson_id=... | Eligible locked published revisions from selected lesson/class language, prompt search, one-of-ten method filter and stable paging. Newer unpublished revisions are excluded. |
| GET / PATCH | /assignments/{assignment_id} | Full owner-only safe view; complete unlocked draft replacement requires If-Match. Class identity/policies are not editable inputs. |
| POST | /assignments/{assignment_id}/archive | If-Match archive of an unlocked draft, retaining versions/references. |

Pydantic schemas reject extra fields and bound title/instructions/items/queries. Exact selected revision IDs are retained; stable Question ID, method and version derive from them. Array order becomes contiguous positions. Duplicate revisions/stable identities, foreign lessons, wrong grade/subject/language, missing/unlocked/retired content and stale writes fail before a committed replacement. Active classes allow create/edit; owner history survives class archival, while selection/edit is blocked and draft archive remains possible. Published/closed/locked assignments cannot be mutated through this draft API. Legacy invalid/unlocked references fail closed for operator review.

Safe curriculum_snapshot stores schema_version=1 and explicit lesson/edition/grade/subject IDs/labels; no private provenance/research fields. Published question corrections never silently replace pinned IDs. Retired question/curriculum references remain visible only through owned draft history with eligibility flags; saving revalidates every remaining selection. Draft row replacement may recreate unlocked AssignmentQuestion records, without deleting referenced/locked history. Existing FK/parent freeze guards remain authoritative.

Assignment services never load the answer-key table. Instructor previews reuse all ten public method shapes/adapters; Flashcards shows cue/front only, with no back reveal. Private key/explanation/rubric data is absent. No student assignment listing, delivery, attempts, scoring, feedback, due date, timer, research or practice-event API is added. Publication remains unavailable. Existing no-store/error/transport/throttle conventions apply; per-process limits still need production edge controls. Safe audit events record assignments.create/replace/archive actor/item/request/time without instructions, keys or secrets.

Creation stores owner/request UUID plus original normalized body/class fingerprint. Same key/body returns the saved current draft; changed body/class conflicts. User/session locks serialize concurrent same-instructor creates. Retry does not re-create content or add a duplicate mutation audit. Edit/archive hashes root/version/item identities/timestamps/status for If-Match freshness. Lost/stale edits require reconciliation; invalid full replacements roll back. No private-key value is hashed into a freshness marker.

## Mobile workflow

Existing instructor class details links to Assignment drafts, then create/view builder. Both routes use the established instructor role policy/Stack protection. Typed assignment services are wrapped by SessionController.run, retaining generation checks and immediate current-401 invalidation/secure cleanup. No raw credential props, browser storage fallback or traditional login is added. List refreshes on focus; catalog reads clear loading/error/unmount state and ignore late results after blur.

The builder offers explicit named curriculum/subject/lesson selection, title/instructions, all-ten method filters, prompt search, paged published revisions, safe preview, add/remove/earlier/later ordering and saved-draft reload. Lesson changes confirm removal of selected items. Empty drafts can save. Archived drafts are read-only. Existing cards/buttons/inputs/Screen provide wrapping text, keyboard avoidance and scrolling; no dependency or unrelated redesign is added.

Saves are single-flight. Interrupted creation retains and freezes the original body/key for safe retry; after restart, inspect the list before deliberately creating again. Unknown/stale edits disable further saving until reload/reconciliation. Expo Router's installed usePreventRemove protects unsaved route/gesture/Back navigation and browser unload; discard/reload/archive confirmations are explicit. Busy saves are normally gated from navigation; authentication loss is not blocked. Publishing controls and student availability are absent.

## Migration and local preservation

Additive **0007_assignment_drafts** keeps 60 tables and frozen 0001–0006 unchanged. It adds nullable creation_request_id/fingerprint with per-instructor UUID uniqueness and permits NULL max_attempts/item points for unconfigured drafts. New service drafts explicitly store NULL, no copied question weights or invented attempt count; date/timer fields stay null and grading_policy empty. Existing configured values remain; same-revision item values are retained on edits. The new invoker function/trigger refuses locking with NULL attempts/points, supplementing existing nonempty/locked-question/freeze checks. Downgrade refuses new unconfigured drafts or retained creation metadata rather than deleting evidence or filling policies.

Disposable PostgreSQL tests applied the new migration and verified metadata/guards. After those checks, the specifically verified development database fluentt_local on localhost:55432 was backed up to ignored private-data/verification/section18-before.dump, then normally upgraded 0006 → 0007. **All 60 table row counts remained unchanged**, no data/account/content was seeded, and alembic check reported no new upgrade operations. No database was reset/downgraded; no unknown/deployed database was touched. The original handoff and all unrelated Git changes remain preserved.

## Verification

| Check | Actual result |
|---|---|
| Focused backend input/schema/migration and PostgreSQL checks | **24 passed**, zero skipped; final **25.68 seconds**. Includes 12 input cases, schema/offline migration checks and five real HTTP/database scenarios. |
| Assignment PostgreSQL scenarios | Verified all ten revisions, safe previews, NULL draft configuration and both locking guards, empty drafts, original-key replay/conflicting bodies, concurrent creation, exact reference order, stale and concurrent edits, archive/protected history, missing/foreign/unlocked versions, duplicate stable identity across published revisions, class language/subject compatibility, retired-content removal/revalidation, owner versus other instructor/student/anonymous, archived classes and revoked device sessions. Lightweight list response was verified after its final change. |
| Full backend/PostgreSQL regressions | **521 passed**, zero failed/skipped; **129.94 seconds**. Includes prior identity/class/enrollment/admin/curriculum/all-ten question contracts, migrations/metadata round-trip and concurrency. Two existing upstream warnings remain. The final summary/guard assertions were subsequently covered by the 24-pass focused run. |
| Combined client/component regressions | **114 passed**, zero failed/skipped. Seven new cases cover stable-question duplicate prevention, order/validation, interrupted UUID/body retries/single flight, instructor route guards, typed auth/freshness/filter requests, actual controlled editor save/navigation/archive and item remove/reorder/public preview handlers, plus late-read cleanup. Earlier session/navigation and ten-method regressions pass. Existing Node module-type warnings remain. |
| Mobile TypeScript / ESLint | **Passed**. An initial lint finding in the new catalog loader was corrected to schedule its read/state transition and retain unmount guards. |
| Expo web / Android exports | **Passed**: dist/section18-web and dist/section18-android. These are bundles, not installed native applications. |
| Ruff / formatting / Python compilation | **Passed**. No configured Python static typechecker was run. |
| Local forward upgrade / preservation / schema drift | **Verified** backup, exact expected database/revision preflight, normal additive upgrade, unchanged counts across 60 tables and clean alembic check. |
| Next checks | Not rerun: administrator source/contracts are unchanged; backend admin regressions passed. This section's changed client is Expo. |

Early focused runs caught test fixture import/language/registration mistakes; corrected fixtures then passed. The frozen-schema test was updated only for the three explicitly migrated assignment tables, with focused assertions and real PostgreSQL metadata comparison covering the changes; frozen migration files were not edited. The component hook harness was extended for useCallback and mocked router removal callbacks. No integrity rule was weakened to obtain passing tests.

**Unverified/skipped device work:** no physical/emulator end-to-end run, native gesture/Android Back execution, TalkBack/VoiceOver, text scaling/focus/long-list performance/orientation audit or full live mobile UI-to-server flow. Component handler tests use synthetic props/mocked router; HTTP persistence tests use real disposable PostgreSQL separately. No browser-auth bypass, insecure SecureStore fallback, seeded runtime data or synthetic production route was introduced to claim end-to-end coverage. Real OIDC/MFA/TLS remains unconfigured; actual nonempty catalogs require legitimately published curriculum/questions. PostgreSQL was available and no final integration check was skipped.

## Every changed file

Relative to the pre-section SHA256 baseline: **17 existing files changed, 16 new files including this report, 275 previous files unchanged, zero removed**. Administrator source, manifests/dependencies, environment files and frozen migrations are unchanged. Existing mobile package-lock SHA256 remains 92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6; PROJECT_HANDOFF.md is unchanged.

```text
AGENTS.md
README.md
apps/mobile/src/app/_layout.tsx
apps/mobile/src/app/class-details.tsx
apps/mobile/src/app/assignment-builder.tsx
apps/mobile/src/app/assignments.tsx
apps/mobile/src/features/assignments/AssignmentEditor.tsx
apps/mobile/src/features/assignments/ItemPreview.tsx
apps/mobile/src/features/assignments/state.ts
apps/mobile/src/services/api/assignments.ts
apps/mobile/src/session/provider.tsx
apps/mobile/src/session/routing.ts
docs/API_DESIGN.md
docs/ASSIGNMENTS.md
docs/DATABASE_SCHEMA.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/MIGRATIONS.md
docs/SECTION_18_REPORT.md
scripts/assignments.test.mjs
scripts/choice-components.test.cjs
services/api/app/api/v1/router.py
services/api/app/main.py
services/api/app/models/assessments.py
services/api/app/modules/assignments/__init__.py
services/api/app/modules/assignments/router.py
services/api/app/modules/assignments/schemas.py
services/api/app/modules/assignments/service.py
services/api/migrations/versions/0007_assignment_drafts.py
services/api/scripts/document_schema.py
services/api/tests/integration/test_assignment_drafts_postgresql.py
services/api/tests/test_assignment_drafts.py
services/api/tests/test_schema.py
```

## Section 19 prerequisites

**Ready to proceed to Section 19 after your acceptance and its authoritative prompt.** Section 18 draft management has no remaining implementation blocker; native/device verification limits remain explicit. Before publication, Section 19 must approve explicit class-subject binding, required configuration/weights/attempt semantics, eligibility/revalidation and immutable assignment snapshots, dates/timers if any, feedback/back-release rules and student availability. NULL draft policies must not become implicit defaults. No student attempt or scoring scope is inferred from existing tables. Preserve exact content versions and all research/privacy boundaries. Stop here before Section 19.
