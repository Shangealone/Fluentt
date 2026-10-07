# D6 — Mobile and backend API contracts

D6 aligns the current foundation contracts with the actual routes and schemas. The authoritative research contract remains [D1](../research/fluentt-research-implementation-spec-v1.md); [D3](d3-sync-lifecycle.md), [D4](d4-research-metadata-preservation.md), and [D5](d5-content-provenance.md) retain their queue, capture, and provenance rules. This note describes the D6 implementation, including changes to D5's formerly deferred cache policy.

## Audit and decisions

| Mismatch in the incoming code | D6 decision |
| --- | --- |
| Mobile session request included a fictional lesson association; response types declared fields absent from the route | Request only the original client session UUID; adapt the three actual response fields |
| Mobile review response assumed a nested schedule with minutes and omitted actual acceptance/provenance fields | Adapt the flat response, explicitly preserving seconds, timestamp strings, nullable legacy provenance, and scheduler state |
| Profile domain type discarded account `user_id`; auth independently parsed profiles and assumed a password flag on them | One profile adapter preserves both UUIDs; auth uses account UUID for ownership and retains the profile UUID separately |
| Sync had `results` and `accepted_events` compatibility shapes, including an unused fictional per-event rejection branch | One canonical full accepted-attempt acknowledgement plus processed count |
| Published content types allowed absent references and defaulted activation; cache compared arbitrary version labels | Require and validate published facts; expose actual activation; use exact release identity and server context |
| Progress field names and units | Already match; no change |
| Health/reachability | Current mobile probe uses HTTP success/reachability, without a typed response-body dependency; no change |

## Identity

| Identifier | Meaning |
| --- | --- |
| `/users/me.user_id` → `LearnerProfile.userId` → `AuthUser.id` | Backend `users.id`, the authenticated account and queue owner |
| `/users/me.id` → `LearnerProfile.id` / `AuthUser.profileId` | Learner profile UUID |
| `participant_code` → `participantCode` | Research code; never an authorization identity |
| `client_session_id` → `clientSessionId` | Original client-generated session UUID |
| Session response `id`, attempt `session_id` → `sessionId` | Backend ReviewSession UUID |
| `client_event_id` → `clientEventId` | Stable client-generated event UUID and idempotency key, scoped by account |
| Attempt response `id` | Backend ReviewAttempt UUID |
| `vocabulary_item_id` | Logical vocabulary UUID |
| `content_revision_id` | Immutable vocabulary revision UUID |
| `content_release_id` | Immutable released context UUID |

Identifiers remain distinct; adapters never substitute another identifier. Wire UUIDs remain strings on mobile and UUID values on the backend. Mobile response guards require nonempty identity strings; backend UUID parsing remains authoritative.

## User and auth

`GET /users/me` and `PATCH /users/me/preferences` return:

```text
id, user_id, participant_code, email,
interface_language: "en" | "fil" | null,
target_learning_language: "en" | "fil" | null,
created_at, updated_at
```

Timestamps are timezone-bearing strings. Nullable fields must be present as null or a supported value; omission is not a default. Preferences patches retain optional snake_case fields and explicit null support.

`must_change_password` belongs to the token response from login/change-password, not the profile response. The existing protected profile route rejects temporary-password users. A successfully fetched normal profile therefore represents a normal signed-in account. SecureStore, token refresh, logout, restoration failure behavior, and the D2 verified-account/token-generation fencing remain unchanged. Auth can still initially hold only email and password-change state while the existing background profile fetch completes.

## Review sessions

`POST /reviews/sessions` request:

```json
{ "client_session_id": "<original client UUID>" }
```

Response:

```json
{ "id": "<server session UUID>", "client_session_id": "<same client UUID>", "created_at": "<timezone-bearing timestamp>" }
```

The mobile adapter exposes `id`, `clientSessionId`, and `createdAt`, and the caller checks that the echoed client ID matches. The backend already supports account-scoped idempotent session creation. There is no lesson association in this API contract. The review screen keeps its original client UUID separate from the optional resolved backend UUID; failure to resolve the latter does not regenerate the former.

## Review attempts

`POST /reviews/attempts` and each member of `POST /sync/review-events.events` use the same canonical D4/D5 request:

| Field | Contract |
| --- | --- |
| `client_event_id`, `client_session_id` | Required original client UUIDs |
| `session_id` | Optional/nullable resolved backend session UUID |
| `vocabulary_item_id` | Required logical vocabulary UUID |
| `content_revision_id`, `content_release_id` | Required for new mobile events and new server acceptance |
| `correct` | Required boolean |
| `submitted_answer` | Optional/nullable supported answer string |
| `response_time_ms` | Required integer milliseconds, existing software sanity range 0–3,600,000 |
| `client_interaction_at` | Required original timezone-bearing client timestamp |
| `device_platform`, `application_version` | Required original capture facts |

The existing sanitizer and persisted replay bytes are unchanged. Queue replay does not reconstruct facts using current clock, platform, app version, or content.

The actual flat response is:

```text
id, client_event_id, session_id, vocabulary_item_id,
content_revision_id: UUID | null,
content_release_id: UUID | null,
correct: boolean, response_time_ms: integer,
scheduler_type: string, algorithm_version: string,
next_interval_seconds: integer, next_due_at: timestamp,
server_acceptance_at: timestamp,
scheduler_state: JSON object | null
```

`ApiReviewAttemptResponse` describes snake_case wire fields; `ReviewAttemptResponse` exposes their camelCase equivalents. Required fields are validated without defaults, including explicit nullable provenance/state. Accepted legacy provenance remains paired null rather than fabricated.

The response does **not** return `client_session_id`, submitted answer, original client interaction timestamp, platform, or app version. Those remain canonical request/persisted facts; D6 does not declare fictional response fields or extend the backend response. Online submission checks that the accepted event ID matches the submitted event.

## Scheduler result and units

The response fields remain flat. `next_interval_seconds` → `nextIntervalSeconds` is seconds; `response_time_ms` → `responseTimeMs` is milliseconds. `next_due_at` → `nextDueAt` and `server_acceptance_at` → `serverAcceptanceAt` preserve timezone-bearing strings. There is no milliseconds/days conversion or minutes-based nested schedule alias. `scheduler_state` is retained as an explicit JSON object or null.

The existing scheduler remains `development/dev-0.1`: correct → 86,400 seconds; incorrect → 600 seconds. D6 changes no calculation, state evolution, timestamp anchor, or scheduler selection. Due time is represented accurately and is **not** used to select review items. The screen regression completes a review even when the returned due timestamp is in 2099.

## Synchronization acknowledgement and errors

Current request:

```json
{ "events": ["<canonical review request objects>"] }
```

The mobile D3 worker still sends one event per request. Current response:

```text
{
  accepted_events: ReviewAttemptResponse[],
  processed_count: integer
}
```

The backend returns the original accepted server attempt on account/event replay. `processed_count` equals the accepted list length, including reconciled idempotent replays; it does not count only newly inserted attempts.

The mobile parser requires the full valid accepted response, matching count, and unique event IDs. The worker then requires its own queued event's acknowledgement before attempting the existing owner/lease-fenced deletion. A missing match, missing required field, wrong type, duplicate ID, or count mismatch remains a transient retryable failure. Parser errors have no fabricated HTTP status. Persisted request bytes, leases, backoff, recovery, auth pause, and owner fencing are unchanged.

This API currently supports no per-event rejection object in a successful response. Validation/rejection remains HTTP failure. Existing D3 permanent HTTP 400/422 classification, auth pause, and transient/network classification remain unchanged. Backend partial-batch behavior is unchanged; D3's one-event requests continue to isolate rejected work.

## Published content

Published lesson summary/detail requires `content_release_id`. Published vocabulary requires both `content_revision_id` and `content_release_id`. Logical IDs, semantic fields, exact `content_version` labels, integer `sort_order`, actual boolean `is_active`, and nullable descriptive fields are preserved. Summaries carry `item_count`; details carry `vocabulary_items`.

Backend response schemas now expose actual `is_active` from release snapshots or legacy logical rows. Immutable manifest generation, revision/release identity, validation, and database constraints are unchanged.

Mobile published wire/domain types require provenance and activation. Network adapters reject missing/null published references, absent arrays/nullable fields, and vocabulary whose lesson/release differs from its parent. A current language feed must match its requested language, be active, and contain one release context. Arbitrary version labels are copied verbatim: lesson and member labels can differ without invalidating immutable membership.

Legacy-compatible SQLite/domain representations remain separate and allow nullable/absent provenance. A malformed successful network response raises an explicit contract error; it does not silently become valid data through cache fallback. Auth/HTTP client failures also do not trigger content fallback. Network/server failures can use an eligible cache entry.

## Cache and navigation

- Current lesson lists replace the active cached language feed according to server context, including an empty feed. Parent UPSERT preserves existing child storage.
- A current detail response replaces cached detail irrespective of lexical or numeric version-label order.
- Detail reads use only active vocabulary matching the parent's release ID. Published detail is unavailable until matching vocabulary count equals the summary's item count; metadata from one release cannot be displayed with vocabulary from another.
- `fetchLessonDetail(lessonId, contentReleaseId)` sends the exact release query. An unexpected lesson/release response fails explicitly. Offline fallback must match that exact release; another cached release is never substituted.
- A pinned response fills the current cached summary only through a release- and activation-conditional SQL update. If the cache points elsewhere, is inactive, or has no parent, the exact historical response remains usable online but does not replace/establish the current cache.
- Lesson list → detail → review navigation carries `contentReleaseId` when present. This pins the viewed context across navigation and retries. Legacy navigation has no fabricated release.
- Storage still holds one current parent/item copy per logical ID, not a complete historical cache. Concurrent fetches can leave detail temporarily unavailable until a matching complete response arrives; matching/count guards prevent mixed-release display.
- Existing legacy-null cache reads retain the legacy version-label membership filter and never invent provenance. D5's guard still prevents a new answer from unversioned legacy content.

This policy does not assign participant sets or govern due eligibility.

## Progress and reachability

`GET /analytics/progress` already matches mobile:
`vocabulary_items_studied`, `review_attempts_completed`, `correct_attempts` are counts; `accuracy_rate` is a 0–1 ratio (0 with no attempts), rounded by the existing service to four decimals. The existing UI converts the ratio to a displayed percentage. No analytics or progress code changed.

Health checks retain their existing HTTP-based reachability behavior; D6 adds no new health contract.

## Deliberate legacy compatibility

- D5's server ledger-first reconciliation for already-accepted pre-D5 UUIDs remains intact. Paired null provenance on the accepted response is preserved; new unaccepted events still require valid provenance.
- Ownerless/incomplete queued rows are neither attributed nor repaired by D6; D2/D3 handling remains unchanged.
- An older backend returning `accepted_events` plus redundant `results` can still be parsed through its canonical fields; extra `results` is ignored. A results-only response is unsupported and retained for retry rather than acknowledged.
- Earlier D3 mobile already has an accepted-events fallback, so removing the backend's redundant results does not remove its acknowledgement path.
- Backend legacy content read endpoints remain nullable; D6 mobile intentionally rejects unversioned network data as current published content. Explicit content publication remains necessary, without automatic migration/backfill.
- No backend/SQLite migration or schema upgrade is added in D6.

## Tests and boundaries

New mobile contract suites cover account/profile separation; session separation; canonical requests; complete flat responses; seconds/timestamps; strict published facts; legacy cache absence; exact-release fallback; arbitrary version labels; pinned current cache filling; and canonical/malformed sync acknowledgement. Real Node SQLite is used for cache and worker regression cases. The worker tests retain byte-identical payload after malformed/missing acknowledgement and complete a later correct retry.

Existing auth, lesson, review-screen, and offline tests use actual wire fixtures; ownership, token races, idempotency/lost acknowledgement, recovery, metadata, and provenance assertions remain. Navigation tests assert release propagation. Backend contract changes are covered by published activation and exact canonical sync shape assertions. Existing replay, provenance/migration, research logging, and scheduling tests remain.

D7 due/current-schedule infrastructure, D8 timing policy, D9 logging/retention hardening, and D10 full real-device verification remain deferred. ESR/SRS/FSRS optimization, assignment/counterbalancing, pronunciation, and NLP are not implemented by D6. Automated Node SQLite evidence does not establish native/device behavior.

## D6 file scope

The working tree already contained 39 D5 files at entry. The following 39 code/test files were changed or added during D6; this note is the 40th D6 file. Remaining incoming D5 files were preserved without modification. This is a D6 delta manifest, not a claim that the whole Git diff belongs to D6.

- `backend/app/content/provenance.py`
- `backend/app/content/schemas.py`
- `backend/app/content/service.py`
- `backend/app/sync/router.py`
- `backend/app/sync/schemas.py`
- `backend/tests/content/test_provenance.py`
- `backend/tests/sync/test_sync_api.py`
- `mobile/app/(app)/lessons/[lessonId].tsx`
- `mobile/app/(app)/lessons/index.tsx`
- `mobile/app/(app)/review/[lessonId].tsx`
- `mobile/src/api/contracts.ts`
- `mobile/src/auth/__tests__/AuthProvider.test.tsx`
- `mobile/src/auth/AuthProvider.tsx`
- `mobile/src/content/__tests__/contentCache.test.ts`
- `mobile/src/content/__tests__/contracts.test.ts`
- `mobile/src/content/__tests__/home.test.tsx`
- `mobile/src/content/__tests__/lessons.test.tsx`
- `mobile/src/content/api.ts`
- `mobile/src/content/contentCache.ts`
- `mobile/src/content/types.ts`
- `mobile/src/offline/__tests__/accountIsolation.test.ts`
- `mobile/src/offline/__tests__/syncContract.test.ts`
- `mobile/src/offline/__tests__/syncLifecycle.test.ts`
- `mobile/src/offline/__tests__/syncRecovery.test.ts`
- `mobile/src/offline/__tests__/syncStatusScreen.test.tsx`
- `mobile/src/offline/__tests__/syncWorker.test.ts`
- `mobile/src/offline/__tests__/useSyncStatus.test.ts`
- `mobile/src/offline/db.ts`
- `mobile/src/offline/syncContract.ts`
- `mobile/src/offline/syncWorker.ts`
- `mobile/src/profile/__tests__/contracts.test.ts`
- `mobile/src/profile/__tests__/preferences.test.tsx`
- `mobile/src/profile/api.ts`
- `mobile/src/profile/types.ts`
- `mobile/src/reviews/__tests__/contracts.test.ts`
- `mobile/src/reviews/__tests__/reviewScreen.test.tsx`
- `mobile/src/reviews/api.ts`
- `mobile/src/reviews/types.ts`
- `mobile/src/testUtils/contracts.ts`
- `docs/development/d6-api-contracts.md`

## Verification commands

Run from `backend`: `uv run pytest -v`; `uv run ruff check app tests scripts`.
Run from `mobile`: `pnpm test`; `pnpm exec tsc --noEmit`; `pnpm lint`.
Run from repository root: `git diff --check`; `git status --short`.

D6 does not stage or commit changes.

Observed verification: backend 102 tests passed (two dependency deprecation warnings); Ruff passed; mobile 192 tests across 30 suites passed; TypeScript passed; Expo lint passed with the two existing i18n warnings and no errors; Git diff whitespace check passed. Node's experimental SQLite warning remains test-runtime output. Branch remains `main`, with the incoming D5 work and D6 delta uncommitted.

