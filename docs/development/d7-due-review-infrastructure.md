# D7 — Due-review / current-schedule infrastructure

This phase implements the D7 scope in the authoritative [D1 research contract](../research/fluentt-research-implementation-spec-v1.md), preserving [D3](d3-sync-lifecycle.md), [D4](d4-research-metadata-preservation.md), [D5](d5-content-provenance.md), and [D6](d6-api-contracts.md). Final algorithms, assignment, timing-policy changes, and logging/retention redesign remain outside this phase.

## Audit and selected design

Pre-D7 `ReviewSchedule` appends a row for each accepted attempt. It has no current marker, pair uniqueness, or query establishing a current schedule. Replay uses the accepted-event ledger to return the original attempt's schedule. The mobile review screen selects every active word and can start from cached content. Progress counts accepted attempts and distinct logical items, so it needs no D7 change. The local development database contained zero schedules at inspection; real PostgreSQL is available in the test environment.

`current_review_schedules` is a separate pointer table with primary key `(user_id, vocabulary_item_id)`. Its composite foreign key enforces that `schedule_id` belongs to that same learner/item. `uq_review_schedule_attempt` enforces at most one historical schedule per attempt; the shared acceptance transaction creates exactly one. Historical schedule results and content facts remain unchanged.

Migration `d7c0de000001`, following D5, selects existing schedules using their linked attempts' server acceptance time. It refuses ambiguous latest acceptance times, inconsistent ownership/item links, or duplicate attempt/schedule links without inventing history. No client/SQLite timestamp, version label, or UUID tie-break establishes historical order. Missing pointer with prior accepted history returns HTTP 503 rather than classify the item as new. Downgrade refuses when current pointers exist because dropping them would lose established acceptance order.

## Atomic transition and concurrency

Online acceptance and sync share `record_review_attempt`. The transaction appends the attempt and historical schedule, flushes the owner/event-unique ledger entry, upserts the current pointer, appends the existing research events, and commits. Any failure rolls the acceptance transaction back. The existing session-resolution commit remains separate and does not advance scheduling.

PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` locks the pair's unique key and serializes conflicting transitions. For distinct events, the last successfully committed transition on that pair becomes current; both historical schedules remain. Runtime transitions do not infer order from timestamps, so concurrent equal timestamps do not create ambiguity. The current schema does not reserve work across simultaneous sessions.

Already-accepted UUIDs return their original attempt/schedule before any transition. A duplicate race fails the ledger uniqueness check before pointer modification, rolls back its candidate history, and returns the winner. Replaying an older accepted event after another event became current cannot restore the older pointer. Current transition and all acceptance evidence commit atomically.

## Eligibility policy

An already-reviewed item is due exactly when its current schedule's `due_at <= authoritative_backend_now`. Evaluate one server instant per response. The device does not calculate eligibility. Never-reviewed items remain available, preserving the existing introduction behavior without quotas, daily limits, steps, or class-ordering heuristics. Both classes retain existing published content order.

`GET /reviews/eligible-items?lesson_id=<UUID>&content_release_id=<optional exact UUID>` returns the resolved `lesson_id`, `content_release_id`, `evaluated_at`, and `items`. Each item contains `vocabulary_item`, `eligibility` (`new` or `due`), and `current_schedule` (null for new; otherwise schedule ID plus D6 scheduler/version/seconds/due timestamp/state fields). Future-scheduled items are absent. This read grants no reservation and acceptance continues to support interactions already displayed/captured before connectivity loss.

Scheduling belongs to the learner and logical vocabulary item. The returned word belongs to the requested published snapshot, and a new interaction captures that exact revision/release. Publication does not rewrite history or reset logical scheduling. Exact release requests never substitute another release.

The current schedule object contains `id`, `scheduler_type`, `algorithm_version`, `next_interval_seconds`, `next_due_at`, and `scheduler_state` (JSON object or null). Its ID is a historical schedule UUID, not an attempt/session UUID. Intervals remain seconds and timestamps remain timezone-bearing strings. The mobile adapter exposes camelCase fields and rejects malformed required data, contradictory new/due state, duplicate items, and mismatched lesson/release provenance. It never compares due time to the device clock or uses the returned schedule to calculate eligibility.

An unknown/inactive lesson or exact release returns HTTP 404. Unpublished legacy network content returns HTTP 409; published eligibility vocabulary requires non-null revision/release IDs. Authentication uses the existing normal-user dependency. No caller-supplied learner ID selects another account's schedule.

## Offline boundary

New review initialization and retries require a fresh backend eligibility response. Eligibility is not persisted in SQLite or recomputed from cached schedule/timestamps. An already-open eligible snapshot can continue while offline and queue original captured answers under D3–D5. Reopening, restarting, or reloading review while unavailable shows an explicit unavailable state, even when study content is cached. An empty eligible set is a normal empty state, not a network error.

The boundary is the in-memory approved review flow, not a persisted eligibility grant. There is no invented expiry/grace period, reservation, or offline clock test. Acceptance does not reject an originally displayed interaction solely because another attempt has since moved its schedule forward; this preserves queue/replay guarantees. Older clients that still select all active words must be updated to the D7 selection contract. Offline study content remains available through the unchanged D6 cache policy.

## Remaining temporary behavior

`development/dev-0.1` continues to schedule 86,400 seconds after a correct answer or 600 seconds after an incorrect answer, anchored to the existing captured client interaction time. Server-time eligibility does not revise that calculation or sanitize clock skew. Newly accepted offline work supersedes current state by acceptance transition order, not by the client interaction timestamp. Replay returns the original result without a new transition.

Plan E/F will replace or extend scheduler logic and approved experimental policy; D7 introduces no ESR/SRS/FSRS semantics, parameter optimization, assignment/counterbalancing, or daily caps. D8 timing, D9 logging/retention, and D10 full regression/device and clock-skew verification remain deferred.

The current development scheduler is stateless and computes before the pointer upsert. A future scheduler that depends on previous state must extend serialization to lock/read that state before calculating its transition. D7 does not claim this implements final algorithm-state evolution. Apply the migration with pre-D7 writers stopped and deploy the updated acceptance path together; an old writer does not maintain the new invariant.

## Tests and file scope

PostgreSQL tests cover first/later current state, history retention, account/item isolation, owner/item and uniqueness constraints, due boundaries, client-time independence, old replay across online/sync, pinned release changes, missing-state refusal, rollback, and overlapping distinct/duplicate events. Migration tests exercise the real upgrade/downgrade on savepoints, including ambiguity refusal. Mobile tests cover explicit new/due adaptation, malformed shapes, exact-release request/display/answer, empty work, cached-content offline refusal, account switching during a pending eligibility request, and device clocks in 1900/2200. Existing D2–D6 regressions remain in the full suites; D4 session UUID and timer assertions are retained.

Backend files:

- `app/reviews/models.py`
- `app/reviews/service.py`
- `app/reviews/schemas.py`
- `app/reviews/router.py`
- `app/reviews/eligibility.py` (new)
- `alembic/versions/d7c0de000001_current_review_schedule.py` (new)
- `tests/conftest.py`
- `tests/reviews/test_due_review.py` (new)
- `tests/reviews/test_current_schedule_migration.py` (new)

Mobile files:

- `app/(app)/review/[lessonId].tsx`
- `src/reviews/eligibility.ts` (new)
- `src/reviews/__tests__/eligibility.test.ts` (new)
- `src/reviews/__tests__/reviewScreen.test.tsx`
- `src/testUtils/contracts.ts`
- `src/i18n/locales/en.json`
- `src/i18n/locales/fil.json`

This note is `docs/development/d7-due-review-infrastructure.md`, the 17th D7 file. No scheduler implementation, SQLite migration, progress query, queue worker, assignment, timing policy, or logging schema is changed.

## Verification

The D7 migration was applied with `uv run alembic upgrade head` on the local PostgreSQL development database. `uv run pytest -v` passed all 120 backend tests; `uv run ruff check app tests scripts` passed. `pnpm test` passed all 209 mobile tests across 31 suites; `pnpm exec tsc --noEmit` passed; `pnpm lint` passed with no errors and the two existing i18n warnings. Backend output retains two dependency deprecation warnings, and Node SQLite tests retain the experimental-module warning. `git diff --check` passed.

Branch is `main`, starting from D1–D6 checkpoint `6efb54d`. D7 changes comprise ten modified tracked files and seven untracked files. Nothing was staged or committed. Real native-device verification remains D10; the passing PostgreSQL concurrency and automated mobile tests do not replace it.
