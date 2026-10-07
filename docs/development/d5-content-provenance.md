# D5 — Immutable Content / Condition Provenance

The [D1 research specification](../research/fluentt-research-implementation-spec-v1.md)
remains authoritative. [D3](d3-sync-lifecycle.md) defines queue operations and
[D4](d4-research-metadata-preservation.md) defines original interaction metadata.
D5 adds content evidence; no formal experimental condition or assignment is created.

## Audit and chosen model

Before D5, `import_content_data` updated language, lesson and vocabulary rows in
place under the same UUIDs. Attempt/schedule/log records retained the logical item
ID but not the shown term, meaning, example, translation, grouping or content
version. Editing those rows could change historical interpretation. Content
cascades could also delete attempts and their ledger/schedule records. Progress
queries count attempts and distinct logical items; they do not reconstruct text.
Mobile cached logical IDs and version labels without immutable references.

Two new PostgreSQL entities provide the smallest evidence model for this schema:

- `VocabularyRevision`: immutable logical item/lesson IDs, term, definition,
  example sentence, difficulty, category, translation, content-version label,
  activation flag and sort order. There are no pronunciation-reference fields in
  the current content schema, so none are invented.
- `ContentRelease`: immutable language context, declared release/version label,
  and a manifest with each lesson's ID, language, title, description, version,
  activation/order and exact item-to-revision membership. The manifest stores
  revision references instead of duplicating vocabulary text.

`vocabulary_items.id` remains the logical identity. Revision and release IDs are
UUIDv5 values derived from SHA-256 digests of canonical **declared import facts**.
Keys are sorted and lessons/items are sorted by canonical logical UUID; array
position, mutable database state and timestamps do not define identity. Explicit
`sort_order` is an existing content attribute and is preserved. Hashes are stored
as `semantic_digest`. Changing a semantic fact changes its evidence identity;
identical re-imports reuse rows. A lesson-context-only change reuses unchanged word
revisions and creates a new release. Version labels alone are not immutable identity.

## Publication, editing and reads

The existing importer remains the only repository content-management path. It
updates the logical current rows, then publishes immutable evidence and updates
`Language.current_content_release_id` in the same transaction. Failure rolls back
both mutable changes and new evidence. PostgreSQL conflict handling reuses identical
revision/release IDs without updating immutable rows. Duplicate identities within
an import are rejected. An import is a complete released manifest for that language;
omitted lessons/items are absent from the new release even though logical/history
rows remain. The pre-D5 importer accepts lesson-level version overrides and item-level
overrides, defaulting an absent lesson label to the top-level label and an absent item
label to its lesson label. Neither the models nor the import script prohibits different
labels. The old mutable read paths filtered on parent-label equality, but that was
not an import constraint. D5 preserves all three declared labels without normalization.

For published content, exact immutable manifest membership determines inclusion.
Every active lesson in the selected release is listed, and every active revision
explicitly named in its lesson context is served and eligible for review acceptance.
A lesson label may differ from the release label, and an item label may differ from
the lesson label. These differences alone never hide a published member or invalidate
its provenance. Released language/lesson/item activation rules remain unchanged.

Published APIs read text/grouping from evidence, not from mutable rows. Direct
edits to current logical rows do not change an existing release; corrected material
must be republished through the importer. Default lesson feeds use the explicitly
selected current release rather than the creation time of a mutable lesson. The
existing version-label query can select a historical release; same-label corrections
use the latest matching publication. Exact historical detail is available through
`GET /content/lessons/{lesson_id}?content_release_id={release_uuid}`. An unknown
or unrelated requested release returns 404 instead of substituting current content.

Imports from the approved curated source use the existing command, for example
from `backend`: `uv run python scripts/import_content.py ../scripts/seed_content/sample-en-v0.1.json`.
The sample English/Filipino files remain development examples, not final Set A/B.
Pre-D5 logical content is readable with null references until it is explicitly
republished. The migration does not assume today's text was shown historically.
D5 mobile reviews require a refresh from published content before new acceptance.

## Attempt binding and legacy semantics

New mobile attempts carry required `content_revision_id` and `content_release_id`
alongside the logical vocabulary UUID and every D4 fact. The shared backend service
first reconciles the authenticated owner/event UUID with its accepted-event ledger.
An already accepted event returns its original attempt/schedule, without rewriting
provenance, including pre-D5 records whose references remain null.

For a new event, both references are mandatory. The backend validates existence,
logical item ownership of the revision, lesson grouping, exact membership in the
specified immutable release, and availability in that released context. Unknown,
mismatched, missing or unavailable provenance is rejected with HTTP 400; malformed
UUID/schema input is rejected with 422. Current revision is never substituted.
Client text is not authoritative. Scheduling uses the accepted revision's difficulty
while the existing `development` / `dev-0.1` scheduler and its rules remain unchanged.

`ReviewAttempt` stores nullable revision/release foreign keys so old absence remains
explicit. A paired-null check and composite revision/logical-item FK protect the
association. New attempt responses and ledger result payloads include the references.
Schedules remain linked through their attempt. Existing progress counts still count
logical vocabulary identities across revisions.

## Mobile cache and offline transport

The content adapters expose camelCase revision/release IDs. Nullable SQLite columns
store the references with cached text and grouping; old cache rows remain null.
Published lesson-detail reads filter vocabulary by the cached lesson's release;
declared item/lesson labels may differ. A published detail refresh uses its supplied
members even when an item's label sorts below the cached item's label. Legacy
null-release caches retain parent-version filtering and legacy item-version ordering;
no release membership is inferred. Lesson-level cache freshness policy is unchanged
and remains a D6 boundary. Parent lesson writes use UPSERT: the previous REPLACE
operation cascade-deleted vocabulary even during a same-release summary refresh.

Answer capture copies the displayed item's references once. Missing cached provenance
shows the existing save-failure UI and cannot create a new queued/submitted event.
The shared D4 allowlist retains the two IDs and excludes credentials, email, local
owner and queue bookkeeping. Cache/content/app refresh cannot alter an existing
payload. D3 sends its stored bytes through retry, lease recovery and auth resumption.
State meanings, deadlines, leases, backoff, ownership and idempotency are unchanged.

Pre-D5 queued rows are never rewritten or assigned today's revision. A complete D4
event already accepted before D5 can reconcile to its original null-provenance result.
An unaccepted event lacking references is preserved as a D3 permanent failure after
400; missing D4 facts still follow D4's 422 path. Ownerless work stays blocked under D2.
There is no automatic deletion, reclassification or inclusion/exclusion policy.

## Migration and referential integrity

Alembic `d5a1c0de0001` adds evidence tables, the nullable current-release pointer,
nullable attempt references, indexes and constraints. It creates no inferred
revisions/releases and backfills no attempts. PostgreSQL triggers forbid UPDATE and
DELETE of evidence rows. Revision references to logical vocabulary/lesson rows,
release references to language, and attempt provenance FKs use RESTRICT. The former
attempt-to-vocabulary CASCADE becomes RESTRICT, also protecting legacy attempts.
Thus ordinary item/lesson/language deletion cannot destroy content evidence or
linked attempts. Activation creates a new release/revision while old evidence remains.

Downgrade refuses if any immutable revisions/releases or bound attempts exist.
An empty-evidence downgrade removes only D5 schema and restores the previous FK
behavior; it does not delete legacy attempts, but the prior vocabulary cascade policy
returns. The migration guard/DDL module is frozen D5 schema code. Privileged database
reset/truncate is not a research-retention workflow. Tests use a separate disposable
PostgreSQL database; a migration cycle is tested inside a rollbackable savepoint.

## Future hooks and remaining boundaries

Release identity and immutable membership can support finalized Set A/B later, but
no set entity, lists, equivalence claims, participant assignment or counterbalancing
is populated. No condition/configuration slots are added because their real contract
is unresolved; formal condition/assignment remains unassigned. Existing scheduler
type/version/state on attempts and schedules retain actual development values.

- **D6:** broad session/response/type/unit reconciliation and cache freshness/
  navigation policy remain deferred. A release validates published context, not an
  individual participant's future assigned set or proof of a serving receipt.
- **D8:** timing boundaries and interruption validity remain unchanged.
- **D9:** research events still omit explicit revision/release IDs. The authoritative
  attempt is reconstructable through the owner/event ledger or completed attempt ID.
  Logging expansion, retention/withdrawal and user/session/attempt deletion policy
  remain deferred; their unrelated cascades are unchanged.
- **D10:** native Expo process termination, suspension, disk failures, cache/content
  updates and account-switch device verification remain required. Real PostgreSQL
  and Node SQLite tests do not establish native-device behavior.

No Conventional SRS, ESR/FSRS, optimization, due-review selection, pronunciation or
NLP processing is implemented by D5.

## Changed-file scope

All paths below are relative to the repository root. D5 changes 32 existing files
and adds seven files; dependency manifests, lockfiles and the D1 specification are
unchanged.

Backend production (12 files):

```text
backend/app/content/models.py
backend/app/content/router.py
backend/app/content/schemas.py
backend/app/content/service.py
backend/app/content/provenance.py (new)
backend/app/content/provenance_ddl.py (new)
backend/app/reviews/models.py
backend/app/reviews/router.py
backend/app/reviews/schemas.py
backend/app/reviews/service.py
backend/app/sync/service.py
backend/alembic/versions/d5a1c0de0001_immutable_content_provenance.py (new)
```

Backend tests (six files):

```text
backend/tests/conftest.py
backend/tests/reviews/test_review_api.py
backend/tests/sync/test_sync_api.py
backend/tests/content/test_provenance.py (new)
backend/tests/content/test_provenance_migration.py (new)
backend/tests/content_helpers.py (new)
```

Mobile production and test adapter (nine files):

```text
mobile/app/(app)/review/[lessonId].tsx
mobile/src/content/contentCache.ts
mobile/src/content/types.ts
mobile/src/offline/db.ts
mobile/src/offline/migrations.ts
mobile/src/offline/reviewQueue.ts
mobile/src/reviews/metadata.ts
mobile/src/reviews/payload.ts
mobile/src/reviews/types.ts
```

Mobile tests (11 files):

```text
mobile/src/offline/__tests__/accountIsolation.test.ts
mobile/src/offline/__tests__/accountQueueStatus.test.tsx
mobile/src/offline/__tests__/ownershipMigration.test.ts
mobile/src/offline/__tests__/reviewQueue.test.ts
mobile/src/offline/__tests__/syncLifecycle.test.ts
mobile/src/offline/__tests__/syncRecovery.test.ts
mobile/src/offline/__tests__/syncStatusScreen.test.tsx
mobile/src/offline/__tests__/syncWorker.test.ts
mobile/src/offline/__tests__/useSyncStatus.test.ts
mobile/src/reviews/__tests__/metadata.test.ts
mobile/src/reviews/__tests__/reviewScreen.test.tsx
```

Documentation (one new file): `docs/development/d5-content-provenance.md`.
