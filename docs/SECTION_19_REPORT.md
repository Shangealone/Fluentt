# Section 19 — Assignment publishing and classroom distribution

Completed 2026-10-19 (Asia/Manila). No Section 20 implementation, commit or push.

## Inspection and approved decisions

Reviewed the historical handoff, development plan, accepted Section 18 report and assignment, architecture, API, classroom/enrollment, identity/security, schema/migration and question-bank contracts. Inspected assignment versions/items/attempts and guards, live membership/owner locking, mobile clients/routes/components, manifests and existing Git changes. The handoff remains historical and unchanged; accepted later reports are authoritative for implemented scope.

The user approved all three publication policies:

1. Immutable **distribution-only-v1** publication, requiring at least one eligible question, while points and max_attempts remain unset. Database guards allow this freeze and explicitly forbid attempts. No published edits, close/archive, dates/timer/scoring or inferred execution policy.
2. Explicit instructor confirmation to bind an unbound class to the selected lesson's subject atomically with publication. Reject incompatible retained assignment/lesson-progress context or existing bound subject; never infer subject from learning language.
3. Immediate metadata availability to every currently eligible active member, including later joiners/rejoiners, with access denied after leaving/removal or class/owner deactivation. Pinned publications survive question/curriculum retirement. No notifications, individual distribution records or question content/answering yet.

## Delivered behavior and security

Instructor class assignment lists now include draft, archived and published summaries. A saved eligible nonempty draft exposes Review and publish, followed by explicit confirmation identifying any subject binding and the immutable/current-and-later-members policy. Unsaved changes must be saved first. The server revalidates ownership, active class, published lesson ancestry, grade/language/explicit subject, all exact locked published revisions, distinct stable Question identities and contiguous order. Configured legacy attempt/window/point policies are rejected rather than overwritten. Empty/ineligible drafts cannot publish.

Publication authenticates/locks live user+session, owner/class, exclusive content advisory 78090001, assignment and versions; locked ORM state is refreshed after waits. It snapshots safe curriculum context, freezes the exact version/items, stores the contract/request UUID, changes draft → published and records assignments.publish in one transaction. Audit includes actor, class/version/subject IDs, whether binding occurred, request and time; no question keys, instructions or credentials. An injected failure after publication DML proved full rollback, including subject binding.

UUID Idempotency-Key plus If-Match supports interrupted-response reconciliation: replay of the committed original publication key returns the same immutable result even with the original freshness marker; another key/stale changed draft conflicts. Replay adds no second audit. Mobile preserves the original row/key for explicit retry, blocks edits after unknown outcomes, and reloads authoritative status. Pending keys are memory-only; after restart inspect saved status. No insecure token/key storage or automatic retry with a new key.

Students use My Classes → choose enrolled class → View published assignments → metadata detail. Each list/detail checks school-student role and live eligible membership, active owned class and live instructor state. Lock order is student/session → owner → class → membership → shared content advisory; a real lock-wait test verified owner deactivation is revalidated before returning data. Another class/nonmember/unpublished/missing assignment is indistinguishable as 404. Other mobile roles receive 403; anonymous/expired/revoked credentials receive 401. Device credentials remain distinct from admin cookies. Native SecureStore and SessionController.run remain mandatory.

Student DTOs include assignment/class/version IDs, title/instructions, safe curriculum context, published timestamp, real question count and ordered method identifiers. They exclude question prompts/content/revision entries, private keys, Flashcard backs, scoring and grading configuration. Student lookup does not load question content/keys. No start/answer/submission control exists. Instructor previews remain front-only across all ten methods. Published historical IDs remain pinned and read-only even after bank retirement; catalog eligibility affects new publication, not authorized historical availability. Invitation expiry never terminates membership.

Focus/refresh and route guards reuse existing components and clear prior results on loading/error/blur; late responses are ignored. Lists handle empty states, retry and paging. Existing unsaved-edit/Android Back protection remains. Published details label answering as upcoming and do not fabricate progress, recipient counts, delivery receipts or notifications. No new dependency or unrelated design change.

## API contracts

All paths are under /api/v1 with existing mobile Bearer authentication, production HTTPS, bounded process-local session throttling and no-store responses/errors.

| Method | Endpoint | Contract |
|---|---|---|
| POST | /assignments/{id}/publish | Owned instructor; {confirm:true, bind_subject_id:UUID or null}; UUID Idempotency-Key and If-Match required. Returns committed owner detail. |
| GET | /classes/{class_id}/published-assignments | Eligible school student; metadata page, default 20/max 100, offset max 100000; publication descending/UUID tie-break. |
| GET | /assignments/{id}/published | Eligible school student; independently authorized metadata detail. |
| GET | /classes/{class_id}/assignments | Existing owned-class list additionally includes published summaries. |
| GET | /assignments/{id} | Existing owner detail additionally supports immutable published history. |

Existing PATCH/archive reject published state. Missing If-Match=428, stale/illegal/configured/conflicting context=409, invalid confirmation/content/binding=422, unauthorized/missing object=404. There is no publication of question answering, attempt execution, grading or notification API. ASSIGNMENTS.md contains the full current policy and historical Section 18 contract.

## Migration and local preservation

Additive **0008_assignment_publication** adds nullable publication_contract/publication_request_id on AssignmentVersion; still 60 domain tables. Existing columns/values/IDs and frozen 0001–0007 remain unchanged. The configuration guard permits only identified locked distribution-only versions with unset attempt/score/window policies. Existing nonempty/locked-question and version/item freeze guards remain. The attempt guard rejects distribution-only versions; root/version insertion/reparenting guards prevent changing or silently replacing distributed history. Downgrade refuses retained publications rather than erasing evidence. No startup migration, data backfill, reset, seeded content/account or privilege grant.

After disposable-database verification, the specifically checked development database fluentt_local on localhost:55432 was backed up to ignored private-data/verification/section19-before.dump and normally upgraded 0007 → 0008. All **60 table row counts remained unchanged**, and alembic check reported no new upgrade operations. No unknown/deployed database was touched. Deployment still needs separate migration/runtime credentials, trigger restrictions and distributed edge limits.

## Verification evidence

| Check | Actual result |
|---|---|
| Full backend/PostgreSQL suite | **531 passed**, zero failed/skipped, 107.12 seconds. Includes prior identity/class/enrollment/admin/curriculum/question-bank regressions, migration round-trip and metadata checks. Two existing upstream deprecation warnings. |
| Final focused backend/PostgreSQL checks | **34 passed**, zero failed/skipped, 42.29 seconds after final explicit version-lock/class refresh changes. Includes all draft/publication scenarios, strict confirmation/input checks and schema/offline migration checks. |
| Publication integration scenarios | All ten methods, hidden keys/content, student draft invisibility, published list/detail, later joiners, owner/nonowner/mobile-role/anonymous isolation, ended memberships, disabled owner/archived class, expiry, retained retired content, explicit subject/conflicting contexts, empty/ineligible/configured drafts, missing/stale freshness, same-key/different-key concurrent publishing, single audit, rollback after DML, immutable versions/items/root and blocked attempts/new versions. Owner lock wait revalidation verified. Earlier enrollment/session regressions cover removal/rejoin and revoked credential behavior. |
| Combined client/component regressions | **117 passed**, zero failed/skipped. New cases exercise actual confirmation/publish handlers, interrupted publication same-row/key retry, frozen UI, metadata-only escaped rendering, loading/empty/error/retry, school-only routes and typed publication headers/private-payload rejection. Existing session/navigation/all-ten method regressions pass. |
| Mobile TypeScript / ESLint | **Passed**. Initial lint rejected render-time ref reads; publication retry state was corrected to React state. No rule suppression. |
| Expo web export | **Passed**, dist/section19-web. |
| Expo Android export | **Passed**, dist/section19-android. Initial sandboxed Hermes run failed with temporary bytecode write permission denied; retry with approved filesystem access succeeded. No app-code workaround or dependency change. |
| Ruff / format / Python compile | **Passed**; final formatting check covered 119 files. No configured Python static typechecker was run. |
| Local forward upgrade / preservation / schema drift | **Verified** expected database/head preflight, backup, additive upgrade, unchanged counts across 60 tables and clean alembic check. |
| Next.js checks | Not rerun: admin source/contracts are unchanged; full backend admin regression passed. |

Early focused runs exposed fixture expectations (enrollment returns 200; publication now exists), plus an expiry fixture violating the preexisting timestamp constraint. Corrected fixtures then passed; no production integrity rule was weakened. The full suite preceded final explicit version locks/class refresh; the subsequent 34-pass focused run verifies those final behavioral changes. Final edits afterward are documentation/comments only.

**Unverified device/end-to-end work:** no physical/emulator live mobile-to-server publication/student flow, native gesture/hardware Back, TalkBack/VoiceOver, keyboard/focus/text scaling/orientation or representative device performance audit. React handler tests use synthetic props/mock router, while API persistence tests use real disposable PostgreSQL separately. Exports are bundles, not installed native tests. No browser authentication bypass or insecure SecureStore fallback was introduced to manufacture UI coverage. Real OIDC/MFA/TLS remains unconfigured; legitimate published content is needed for nonempty runtime catalogs. PostgreSQL was available; no final integration test was skipped.

## Every changed file

Compared with the pre-section SHA256 baseline: **26 existing files changed, 6 new files including this report, 282 previous files unchanged, zero removed**. Unrelated uncommitted work, administrator source, dependency/environment files, original handoff and frozen migrations are preserved. Mobile package-lock SHA256 remains 92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6. Ignored verification logs/backup/helper are local artifacts.

```text
AGENTS.md
README.md
apps/mobile/src/app/_layout.tsx
apps/mobile/src/app/assignments.tsx
apps/mobile/src/app/published-assignments.tsx
apps/mobile/src/features/assignments/AssignmentEditor.tsx
apps/mobile/src/features/assignments/PublishedDetails.tsx
apps/mobile/src/features/enrollment/MyClasses.tsx
apps/mobile/src/services/api/assignments.ts
apps/mobile/src/session/routing.ts
docs/API_DESIGN.md
docs/ARCHITECTURE.md
docs/ASSIGNMENTS.md
docs/CLASSROOMS.md
docs/DATABASE_SCHEMA.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/ENROLLMENT.md
docs/MIGRATIONS.md
docs/SECTION_19_REPORT.md
scripts/assignments.test.mjs
scripts/choice-components.test.cjs
services/api/app/models/assessments.py
services/api/app/modules/assignments/publication.py
services/api/app/modules/assignments/router.py
services/api/app/modules/assignments/schemas.py
services/api/app/modules/assignments/service.py
services/api/migrations/versions/0008_assignment_publication.py
services/api/scripts/document_schema.py
services/api/tests/integration/test_assignment_drafts_postgresql.py
services/api/tests/integration/test_assignment_publication_postgresql.py
services/api/tests/test_assignment_drafts.py
```

## Section 20 readiness and prerequisites

**Ready to proceed to Section 20 after your acceptance and its authoritative prompt.** Section 19 publication/distribution has no remaining implementation blocker; native/end-to-end verification limits remain explicit. Before enabling answering/attempts, approve the execution/configuration and release policies, including treatment of Flashcard backs and any attempt/scoring/feedback rules required by that prompt. Distribution-only versions are intentionally immutable and non-executable; a future approved additive configuration/version strategy must preserve the original published references rather than silently filling NULLs or bypassing guards. No Section 20 policy or implementation is inferred here. Stop for acceptance.
