# D11 ESR Pre-Implementation Audit

## Executive Summary

**CONFIRMED — Audit date: 2026-10-16, Asia/Manila.** This is a source, migration, contract, test, installed-metadata and pinned-library-source audit. It does not implement either research scheduler, change the manuscript, run a migration, connect to a study database, install a dependency, or exercise a learner review. Findings about database structure describe the checked-in SQLAlchemy/Alembic definitions, not a fresh assertion about a particular deployed database.

**CONFIRMED — Repository baseline:** `F:\FLUENTT`, branch `main`, HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`, subject `fix(reviews): isolate per-item timing lifecycle`. Initial `git status --short` contained only `?? docs/development/d10-timing-fix-review-bundle.txt`. That independent-review artifact is excluded from this audit's changes.

**CONFIRMED — Recent history captured:**

```text
4135cd7 fix(reviews): isolate per-item timing lifecycle
a52480b fix(auth): harden startup session restoration
7f3a9cb feat(research): harden research logging and integrity
cd01273 feat(research): harden review timing evidence
052985f feat(reviews): add server-authoritative due eligibility
6efb54d feat(research): add content provenance and align API contracts
2c4e033 fix(research): preserve canonical review metadata
ee3389b fix(offline): harden sync recovery and retry lifecycle
```

| Status | Principal finding |
| --- | --- |
| CONFIRMED | `backend/app/scheduling/development.py::DevelopmentScheduler.schedule` is the only implemented scheduler. `backend/app/reviews/service.py::record_review_attempt` selects it whenever its optional injected scheduler is absent. |
| CONFIRMED | Append-only schedules, an owner/item current pointer, original interaction timestamps, immutable content provenance, and duplicate-safe online/sync acceptance already provide much of D11's foundation. |
| BLOCKER | The current scheduler input has no previous memory state or previous-review timestamp. Computation happens before the pointer upsert's serialization. Stateful scheduling cannot simply replace the development class. |
| BLOCKER | `review_schedules.interval_seconds` is PostgreSQL `INTEGER`: 36,500 × 86,400 = **3,153,600,000**, exceeding 2,147,483,647. A `BIGINT` expansion is required. |
| CONFIRMED | JSON can represent the required small SM-2/FSRS memory objects; existing code does not validate their schemas. Storage capacity is adequate, but existing validation and state evolution are not. |
| BLOCKER | There is no experimental enrollment/assignment, research Set A/B, frozen mapping, allocation sequence, or assignment-version infrastructure. A server-authoritative assignment must exist before research acceptance is enabled. |
| RECOMMENDED | Preserve the current mobile request/response shape and binary UI. Add strict server state contracts, authoritative assignment resolution and serialized state transitions. |
| CONFIRMED | The intended library project is py-fsrs, but the actual distribution/import is **`fsrs`**. The eventual dependency declaration should be `fsrs==6.3.2`, not `py-fsrs==6.3.2`. It is absent from the current manifest, lockfile and backend virtual-environment package inventory. |

**CONFIRMED — Classification boundary:** the committed D10 report retains its emulator results, physical Android verification BLOCKED / NOT RUN, and overall D10 BLOCKED. This audit neither changes those classifications nor authorizes Plan E/F.

**RECOMMENDED — Verdict: D11 READY FOR SPEC REVIEW.** The audit is ready for review; live D11 implementation/activation remains subject to the decisions and gates below.

## Current Scheduler Architecture

**CONFIRMED — Exact current flow:**

| Stage | Repository implementation | Current behavior |
| --- | --- | --- |
| Eligible items | `backend/app/reviews/router.py:26::eligible_review_items` → `backend/app/reviews/eligibility.py:23::get_review_eligibility` | Reads a published lesson/release, joins current schedules for the authenticated learner, includes never-reviewed items as `new`, and includes reviewed items when `due_at <= backend_now()`. |
| Mobile acquisition | `mobile/app/(app)/review/[lessonId].tsx:57::resolveSession`, `initializeReview`, initial loading effect; `mobile/src/reviews/eligibility.ts:54::fetchReviewEligibility` | Resolves an owner-scoped session and obtains fresh server eligibility. It does not start new reviews from cached eligibility. The resulting item list is a fixed presentation list. |
| Review session | `backend/app/reviews/service.py:25::get_or_create_review_session`; `ReviewSession` | Unique `(user_id, client_session_id)`; optional server ID can be resolved during sync. No lesson, research set or assignment is bound to a session today. |
| Answer commitment | `ReviewScreen:138::handleResponse`; `mobile/src/reviews/timing.ts:42::createPresentationTimer`; `metadata.ts:7::captureReviewAttempt` | Correct/Incorrect becomes a boolean. Timing and original metadata freeze before authentication, transport or SQLite awaits. D10's timer ownership is per presentation lifecycle in `useReviewTiming.ts:16::useReviewTiming`. |
| Online/offline transport | `mobile/src/reviews/api.ts:29::submitReviewAttempt`; `offline/reviewQueue.ts:40::enqueuePendingReview`; `offline/syncWorker.ts:74::drainReviewQueue` | Online submission or owner-scoped durable queuing of the captured request. Replay uses the original event UUID and original captured facts. |
| Validation / accepted replay | `backend/app/reviews/schemas.py:43::ReviewAttemptCreate`; `service.py:66::record_review_attempt` | Request parsing, then an authenticated `(user_id, client_event_id)` ledger lookup. Accepted replay returns the linked original attempt/schedule before content resolution or scheduling. New work resolves exact revision/release membership and owned session identity. |
| Scheduler | `service.py:142–158`; `backend/app/scheduling/base.py::Scheduler` | Optional service injection; otherwise `DevelopmentScheduler()`. `correct` selects 86,400 or 600 seconds. |
| Historical persistence | `service.py:160–199` | Creates one `ReviewAttempt` and one `ReviewSchedule`; state and result identifiers come from the scheduler result. |
| Ledger / current state | `service.py:201–238` | Inserts and flushes the owner/event-unique acceptance ledger before upserting `CurrentReviewSchedule` by learner/item. |
| Research events | `service.py:240–255`; `backend/app/research_logging/service.py:81::record_research_event` | Stages `REVIEW_ANSWERED` and `REVIEW_SCHEDULED`, each with schema `review-events-1` and minimal item-attempt payload. |
| Commit / acknowledgement | `service.py:257–289`; `reviews/router.py:52::submit_review_attempt`; `sync/service.py:8::sync_review_events` | Acceptance chain commits together. Duplicate ledger races roll back and return the winner. Sync commits per event, not atomically for an entire batch. |
| Local deletion | `syncWorker.ts` accepted-ID check; `queueTransitions.ts:71::acknowledgeReview` | Deletes only after a structurally valid matching event acknowledgement, fenced by owner, `syncing` status and lease. |

**CONFIRMED — Scheduler interface:** `Scheduler.schedule(self, context: ReviewContext) -> SchedulingResult`. `ReviewContext` (`scheduling/types.py:6`) is a frozen dataclass containing `correct`, `response_time_ms`, `item_difficulty`, `interaction_at`. `SchedulingResult` (`types.py:14`) contains scheduler type/version, integer next-interval seconds, next-due datetime and a generic state dictionary. The dictionary itself is not deeply immutable or schema-validated by a frozen dataclass.

**CONFIRMED — Development selection/calculation:** `DevelopmentScheduler.schedule` (`development.py:34`) ignores response time and difficulty, selects its two constants from `context.correct`, computes `interaction_at + timedelta(seconds=interval_seconds)`, and creates a descriptive development-only state. `service.py:146–150` nevertheless maps content difficulty `medium`/`hard` to numeric weights and passes them into the context. These fields must not accidentally become D11 model features.

**CONFIRMED — First review:** no current schedule and no accepted history means `eligibility="new"`, `current_schedule=null`. No memory state is persisted by eligibility or session creation. The first accepted answer creates the historical state and current pointer. History without a pointer returns 503, not an invented fresh state (`eligibility.py:51–62`). D11 can preserve this flow: initialize the assigned algorithm transiently on first acceptance, then persist its first result.

**CONFIRMED — Overdue/history timestamps:** the previous current schedule identifies its linked attempt. That attempt's `client_interaction_at` is the actual previous interaction anchor; `server_acceptance_at` is transport/acceptance time, `ReviewSchedule.due_at` is previous due time, and `ReviewSchedule.updated_at` is a historical row creation/default timestamp despite its name. None is a substitute for the previous learner interaction. There is no distinct `created_at` column on `ReviewSchedule`.

**CONFIRMED — Current ordering:** D7 intentionally makes the last committed acceptance current; it does not sort runtime transitions by client timestamps or reserve eligible work. `tests/reviews/test_due_review.py::test_later_acceptance_supersedes_only_pointer_and_replay_returns_original` explicitly accepts a later-arriving backdated interaction. The D7 development note already warns that a stateful scheduler needs serialization before state calculation (`docs/development/d7-due-review-infrastructure.md`, Atomic transition and concurrency).

**RECOMMENDED — Time arithmetic for D11:**

| Concern | Required handling |
| --- | --- |
| New input timezone | Require an aware interaction timestamp after the accepted-replay boundary; normalize the instant to UTC. `ReviewAttemptCreate.client_interaction_at` is currently plain Pydantic `datetime`, with no explicit aware/UTC validator. Preserve legacy replay compatibility. |
| Previous-review time | Load the current schedule's linked immutable attempt timestamp; require state/algorithm/owner/item consistency. Do not use due time or acceptance time as elapsed-review time. |
| Due timestamp | Compute `interaction_at_utc + timedelta(seconds=interval_days * 86400)`. Never add the interval to server receipt time. |
| Day/timezone semantics | A study day is exactly 86,400 seconds, not local midnight or the next calendar date. UTC arithmetic avoids DST-length days. A learner display timezone must not affect stored due instants. |
| Rounding | SM-2 uses the locked `ceil(previous_interval_days * ease_factor)` rule. Preserve the pinned FSRS engine's integer-day rounding; do not substitute SM-2's ceiling for it. |
| Bounds | Use checked integer multiplication and checked datetime addition. Reject invalid/nonfinite state and unsupported results before accepted evidence is inserted. The enhanced maximum requires BIGINT. |
| Old/future client clocks | Do not silently replace the interaction anchor with server time. The research policy for out-of-order/skewed genuine interactions must be settled before activation. |

## Current Data Model

**CONFIRMED — `ReviewSchedule` (`backend/app/reviews/models.py:145`), all columns non-null:**

| Column | SQLAlchemy / PostgreSQL type | Purpose |
| --- | --- | --- |
| `id` | `Uuid(as_uuid=True)` / UUID, primary key | Historical schedule identity |
| `user_id` | UUID, indexed | Owner; FK `users.id`, RESTRICT |
| `vocabulary_item_id` | UUID, indexed | Logical item; FK `vocabulary_items.id`, RESTRICT |
| `attempt_id` | UUID, indexed, unique | FK `review_attempts.id`, RESTRICT; `uq_review_schedule_attempt` |
| `scheduler_type` | `String(64)` / VARCHAR(64) | Free string, not an enum |
| `algorithm_version` | `String(64)` / VARCHAR(64) | Free string, not an enum |
| `interval_seconds` | `Integer` / INTEGER | Currently signed 32-bit storage |
| `due_at` | `DateTime(timezone=True)` / TIMESTAMPTZ, indexed | Authoritative due instant |
| `scheduler_state` | `JSON`, Python `dict[str, Any]`, default `{}` | Untyped JSON storage, not JSONB and not a validated state model |
| `updated_at` | TIMESTAMPTZ, default/onupdate UTC now | Historical row timestamp; D9 forbids ordinary updates |

**CONFIRMED — Schedule constraints:** in addition to the unique attempt, `uq_schedule_owner_item` makes `(id,user_id,vocabulary_item_id)` unique for the current-pointer composite FK. There is no learner/item uniqueness on the historical schedule table, because history must retain multiple schedules. There is no algorithm-state shape check, whole-day check, interval bound check or assignment FK today. The schedule's attempt FK is on attempt ID alone; the pointer's composite FK does not independently prove that a schedule's owner/item agree with its attempt. The service supplies matching values and D7 migration preflight checks legacy mismatches; a D11 loader must still verify these joins.

| Status | Model / source | Relevant facts |
| --- | --- | --- |
| CONFIRMED | `ReviewAttempt`, `reviews/models.py:55` | Immutable answer, original duration/evidence, client/server timestamps, platform/version, session/event identity, revision/release and scheduler type/version. Composite revision/item FK and paired provenance-nullability check. Unique `(id,user_id)` supports research-event ownership. Event uniqueness is enforced through the acceptance ledger/transaction, not a separate `(user_id,client_event_id)` unique constraint on this table. |
| CONFIRMED | `CurrentReviewSchedule`, `models.py:203` | Mutable PK `(user_id,vocabulary_item_id)` and non-null schedule ID; composite FK binds that schedule to the same owner/item. It is not keyed by release, condition or experimental period. |
| CONFIRMED | `ReviewSession`, `models.py:23` | Owner, original client-session UUID and creation time; owner/client-session unique. No assignment, lesson, release, eligibility reservation or research-period columns. |
| CONFIRMED | `AcceptedClientEvent`, `sync/models.py:11` | Unique owner/event UUID, linked attempt, acceptance timestamp and JSON response cache. History retained with RESTRICT FKs. Replay currently reconstructs the response from linked records; it does not return `response_payload` directly. That cache omits `scheduler_state`, so it must not become an alternate D11 response path without contract review. |
| CONFIRMED | `ResearchEvent`, `research_logging/models.py:20` | JSON payload, nullable legacy schema/link, owner-scoped composite attempt FK, unique attempt/type/schema. Current events are restricted to the canonical pair and minimal payload. Service atomicity supplies the complete pair; uniqueness alone does not require both events to exist. |
| CONFIRMED | `User`, `auth/models.py:14` | Unique non-null `participant_code: String(32)` and internal account UUID. Code is immutable. There is no experimental assignment or study-eligibility field. Coded identity is an analysis label, not authorization. |
| CONFIRMED | `LearnerProfile`, `users/models.py:17` | Language preferences and timestamps only; not an experimental group or set selector. |
| CONFIRMED | `VocabularyItem`, `VocabularyRevision`, `ContentRelease`, `content/models.py` | Stable logical item identity; immutable revision facts; immutable release manifest with exact lesson/item/revision membership. No research Set A/B field. |

**CONFIRMED — Migration/guard audit:** `65b5e4087f54_add_reviews_schedules_and_research_.py` creates INTEGER interval/JSON state; `d5a1c0de0001_immutable_content_provenance.py` adds immutable provenance; `d7c0de000001_current_review_schedule.py` adds schedule uniqueness/current pointers and conservative historical backfill; `d8c0de000001_timing_evidence.py` adds nullable original timing evidence; `d9c0de000001_research_integrity.py` retains history and installs `research_logging/integrity_ddl.py`. D9 blocks UPDATE/DELETE/TRUNCATE on attempts, schedules, ledger and events; sessions with accepted attempts cannot be changed/deleted, and participant codes cannot change. D5's `content/provenance_ddl.py` guards revisions/releases against UPDATE/DELETE. These guards must stay enabled.

**CONFIRMED — State capacity versus validation:** JSON supports SM-2 integers/floats and the verified FSRS scalar/nullable state. It is not necessary to convert it to JSONB or add separate memory columns. However, ORM annotations, response `dict[str,Any] | None`, and a dataclass do not reject a wrong object, list/scalar JSON inserted elsewhere, wrong algorithm, unsupported state version, missing fields, or nonfinite/inconsistent memory. Capacity alone is not D11 readiness.

## D11 Fit / Existing Capabilities

**CONFIRMED — Locked research specification used by this audit:**

| Condition | Exact identifiers | Binary mapping | Locked behavior |
| --- | --- | --- | --- |
| Conventional | `conventional_srs` / `sm2-binary-v1` | Correct → q=4; Incorrect → q=2 | Initial 0 repetitions, EF 2.5, 0 interval days, 0 lapses. Correct: 1, then 6, then ceiling(previous days × EF), increment repetitions. Incorrect: repetitions 0, 1 day, increment lapses, retain EF. No same-session repetitions. |
| Enhanced | `enhanced_srs` / `fluentt-esr-fsrs6-binary-v1` | Correct → Good=3; Incorrect → Again=1 | FSRS-6; retention 0.90; empty learning/relearning steps; 1-day effective minimum; 36,500-day maximum; fuzzing off. No Hard/Easy fabrication or global retraining. |

**CONFIRMED — The locked 21 parameters are:**

```text
[0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194,
 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
```

| Status | Contract already supported | D11 preservation requirement |
| --- | --- | --- |
| CONFIRMED | D3 owner-scoped SQLite queue, leases, crash recovery and accepted replay | Keep immutable queued facts and matching acknowledgements; preserve per-event batch commits and retry classification. |
| CONFIRMED | D4 metadata capture before async work | Preserve original IDs, durations, interaction timestamp, platform and version. |
| CONFIRMED | D5 exact immutable revision/release membership | Resolve condition through an additional frozen research mapping; never infer it from today's mutable content. |
| CONFIRMED | D6 shared online/sync schemas and seconds-based flat responses | Keep the current wire shape and units. |
| CONFIRMED | D7 explicit new/due behavior and current pointer | Preserve new-item introduction, history retention, server-time eligibility and replay's inability to restore an old pointer. Add state-computation serialization. |
| CONFIRMED | D8/D10 per-item timing and frozen retry commitment | Keep the measured duration/evidence immutable; exclude duration, interruptions and transport latency from algorithm inputs. |
| CONFIRMED | D9 immutable linked attempt/schedule/ledger/event history | Store new algorithm identifiers and state in their existing authoritative rows; preserve the event pair and coded identity. |

**RECOMMENDED — Safe reuse:** keep the current introduction flow and result persistence shape. A new item gets a transient initial state only after an authoritative assignment is resolved. Existing unknown/incompatible current state must fail explicitly; it must never be treated as a new item or converted from dev-0.1.

## Required Backend Changes

**RECOMMENDED — Change these boundaries later, not during this audit:**

1. **`scheduling/types.py::ReviewContext`, `base.py::Scheduler`:** define a versioned research input containing binary correctness, aware UTC interaction time and validated prior learner/item memory context. Remove response time and instructional difficulty from the research calculation interface. Continue storing them where already required; preserve an explicit development adapter if legacy tests need its old input type.
2. **New scheduler registry/adapters:** implement the two exact type/version pairs with immutable configuration. Resolve the experimental condition outside each scheduler. An unknown pair or state version is an error, never an implicit `DevelopmentScheduler` selection.
3. **`reviews/service.py::record_review_attempt`:** retain accepted-replay lookup first; resolve immutable assignment/provenance, serialize state access, recheck the ledger, load current schedule plus its attempt, validate state, and compute once against that predecessor. Do not mutate the predecessor's JSON dictionary in place.
4. **First versus subsequent answer:** no history/current pointer permits the assigned initial state. History with no pointer, a dev current schedule under a research assignment, a mismatched owner/item/version, or malformed state must fail closed. Do not regenerate state from partial history.
5. **Output validation:** check exact identifiers, finite state values, whole positive day count, interval bounds, exact seconds/due consistency and assignment provenance before historical inserts. Do not rely on a third-party constructor or Python type annotations as validation.
6. **Transaction management:** keep attempt, schedule, ledger, current pointer, assignment binding and the canonical research pair atomic per event. `get_or_create_review_session` currently commits separately; do not acquire a state lock and then call a helper that commits/releases it. Either resolve the session before the state transaction or later refactor its commit boundary deliberately. A rejected scheduler state must leave no partial accepted chain; session existence alone is not a scheduler outcome.
7. **`reviews/eligibility.py::get_review_eligibility`:** retain backend-time due comparisons, release order, new items and missing-pointer refusal. Before research work is offered, verify immutable enrollment/set assignment and supported state. Eligibility remains a non-reserving read; do not reject a legitimate offline answer merely because today's eligibility list changed.
8. **No same-session conventional repeats:** the screen currently walks each returned item once, but the backend has no owner/session/item duplicate guard for genuine new UUIDs. Enforce the locked conventional rule under the same serialization boundary, while accepted UUID replay remains valid. Do not apply a blanket historical uniqueness rule to development records.
9. **Failure taxonomy:** distinguish unavailable/corrupt server assignment/state or temporarily unsupported deployment from invalid client provenance. Document retryable service failures versus permanent rejections so `syncWorker.ts::classifySyncFailure` preserves work appropriately. Do not silently acknowledge/drop an unscheduled answer.

**CONFIRMED — Research logging impact:** `ReviewAttempt.scheduler_type/algorithm_version` and `ReviewSchedule.scheduler_type/algorithm_version/scheduler_state/interval_seconds/due_at` already retain the authoritative facts. `record_research_event` emits only links plus `{"scope":"item_attempt"}`. New algorithms can flow through these joins without changing `research_events` or inventing extra per-answer events. A frozen assignment/configuration link is additional provenance; duplicating all state into the event JSON is unnecessary and would violate the current payload allowlist.

## Required Database Changes

**BLOCKER — Mandatory numeric migration:** expand `review_schedules.interval_seconds` from `Integer` to `BigInteger` in the model and a new migration following D9. The enhanced maximum is 3,153,600,000 seconds; INTEGER cannot store it. Python/Pydantic integers and mobile safe-number parsing can represent this value. Do not reduce the locked maximum to avoid the migration.

**RECOMMENDED — Smallest safe state storage:** retain the existing JSON column. Introduce strict application-owned schemas keyed by scheduler type, algorithm version and state-schema version. No dedicated SM-2 columns, FSRS memory table, JSONB conversion or new last-review timestamp is necessary for the algorithms themselves.

**BLOCKER — Assignment persistence is additive schema work before live D11 routing.** The minimum recommended concept, subject to spec review, is:

| RECOMMENDED later structure | Minimum purpose / constraints |
| --- | --- |
| Immutable research protocol/set definition and set-membership mapping | Versioned Set A/B identity, exact release/item/revision membership, explicit algorithm configuration identity; validate membership against D5. Unambiguous, disjoint logical item membership within the protocol. |
| Immutable participant allocation | Internal `user_id`, protocol/version, eligibility decision reference, allocated mapping/sequence, assignment version and timestamp; one allocation per participant/protocol. Join `participant_code` from `users`, do not duplicate credentials or use the code as an authorization key. |
| Immutable participant/set condition mapping | One authoritative condition/type/version per allocated learner/set, consistent with the allocation. A unique mapping prevents silent reassignment; retain records rather than updating them in place. |
| Accepted-attempt assignment reference | Prefer a nullable assignment FK on `ReviewAttempt`, with owner-scoped integrity, required for new D11 attempts and left null on legacy development rows. Existing content IDs plus this link make set/config provenance reconstructible. Exact table/column names are design proposals, not created schema. |

**RECOMMENDED — Migration shape:** use forward additive migrations: widen the interval; create the immutable assignment structures; add a nullable future-attempt assignment reference with no historical backfill; add conditional constraints for new D11 rows. Preserve all D5/D9 triggers, current pointers, existing values and canonical research links. A conditional whole-day/positive check may apply to the two D11 types while leaving dev-0.1's 600-second history valid. Apply the enhanced upper bound only to enhanced rows; conventional's maximum remains a spec decision. Optional defense in depth includes a composite schedule→attempt owner/item FK and scoped same-session conventional uniqueness after preflight; neither justifies rewriting history.

**RECOMMENDED — Operational safety:** widening INTEGER to BIGINT can require an exclusive lock/table rewrite. Preflight on an isolated clone, inventory constraints/indexes/triggers, capture logical-history digests and plan a writer maintenance window. Verify equal pre/post historical values and live guards. Do not edit frozen old migration logic. Refuse a narrowing/destructive downgrade if D11 data exists or any interval exceeds INTEGER; rollback should disable new routing, not erase evidence.

## Required Mobile Changes

**CONFIRMED — Zero scheduler-related mobile behavioral or wire changes are currently required under immutable server assignment.** `ReviewScreen.handleResponse` supplies a boolean and `submitted_answer` of `correct`/`incorrect`; there are only two learner rating buttons. Unused Hard/Easy style names do not create rating inputs. Mobile never calls a scheduling engine or chooses a scheduler. The screen discards returned current memory when constructing its presentation list.

**CONFIRMED — Captured offline inputs are sufficient:** original owner-scoped event/session identity, item/revision/release, correctness, commitment timestamp, duration/evidence, platform/version are preserved by `metadata.ts::captureReviewAttempt`, `payload.ts::sanitizeReviewAttempt` and `reviewQueue.ts`. The queue contains no trusted condition or scheduler state. Assignment must be derivable from immutable server facts established before those interactions; otherwise zero-wire-change compatibility cannot establish an original condition after the fact.

**CONFIRMED — Existing response contract already includes** `scheduler_type`, `algorithm_version`, `next_interval_seconds`, `next_due_at`, `scheduler_state` on acceptance and current-schedule responses (`reviews/schemas.py:66/86`, `mobile/src/reviews/types.ts:24/66`, `eligibility.ts:26`). Adapters accept nonempty algorithm strings, finite JSON and safe integer seconds rather than a dev-only enum. 3,153,600,000 is within JavaScript's safe-integer range.

**RECOMMENDED — Do not add condition selection to requests or learner controls.** A new response `condition` field is unnecessary for scheduling and may expose/blind the experimental arm differently. Existing scheduler/version fields already identify the result for machine use; do not display condition-specific learning activities. Preserve the same app, activities, binary UI, duration and assessment procedures across conditions. Future mobile contract tests should cover new labels and large intervals without changing interval calculation or timing behavior.

## Research Assignment Gap

| Status | Concept | Existing representation |
| --- | --- | --- |
| CONFIRMED | Coded participant identity | Immutable `User.participant_code` exists. |
| BLOCKER | Study enrollment/eligibility for allocation | No authoritative study eligibility/allocation record. `User.is_active` and password-change state are unrelated. |
| BLOCKER | Research Set A / Set B | No set ID or frozen set mapping in models or release construction. |
| BLOCKER | Scheduler condition | Only output scheduler labels exist; no authoritative assignment relation. |
| BLOCKER | Counterbalanced mapping / sequence / assignment version | No current schema or service implements them. |

**RECOMMENDED — Authority location:** a backend research-assignment service should accept provisioned allocation facts and resolve `(authenticated user, protocol, exact released item)` to one immutable assignment/configuration. The scheduler consumes the resolved condition; it does not randomize it. Languages, lesson titles, category, instructional difficulty, arbitrary version-label strings, participant-code prefixes, client state and authentication flags are not safe substitutes.

**RECOMMENDED — Later allocation invariant:** retain 30 eligible participants with exactly 15 assigned Set A→ESR/Set B→conventional and 15 assigned Set A→conventional/Set B→ESR. The provisioning/randomization layer must validate both mappings and balanced totals transactionally, record assignment version/sequence provenance and prevent changes after study use. No counterbalancing implementation is part of this audit.

**CONFIRMED — Content/release interaction:** `content/provenance.py::publish_content_release` freezes lesson context and item/revision membership; `resolve_review_content` checks exact membership. A lesson UUID can be one anchor in an approved set definition, but a mutable lesson row/title alone is not a frozen research set. Existing sample files `scripts/seed_content/sample-en-v0.1.json` and `sample-fil-v0.1.json` are not an authoritative matched Set A/B assignment mechanism.

**RECOMMENDED — Freeze a separate research-set mapping to existing immutable releases/revisions; do not rewrite a release manifest or overload `category`/`difficulty`.** Current memory is keyed by learner/logical item, not release or set. The same logical item ID appearing in both conditions would share a current pointer and memory. Prefer disjoint item identities for the approved sets; overlapping membership or switching conditions would require a separately approved memory-scope redesign.

**RECOMMENDED — Engines may be implemented/tested before a full randomizer exists, using explicit test assignments and disabled research routing.** Real acceptance must not proceed without the minimal immutable authority and provenance binding. New formal accounts must have their allocation/set mapping frozen before eligibility is offered. Already accepted events replay under their recorded algorithm even if current assignment services are unavailable. Unaccepted development queue events must not be relabeled as research events after deployment.

## FSRS State Representation

**CONFIRMED — Exact pinned API verified externally, without installation:** the `v6.3.2` sources define `Scheduler.review_card(card, rating, review_datetime=None, review_duration=None) -> (Card, ReviewLog)`. Explicit UTC-aware review time is required. Empty steps promote a new card to Review; intervals use integer-day `round`, clamp to 1..maximum, and due/last-review follow the review instant. Elapsed review time uses whole `.days` from the prior review. [Pinned scheduler source](https://raw.githubusercontent.com/open-spaced-repetition/py-fsrs/v6.3.2/fsrs/scheduler.py).

**CONFIRMED — Pinned Card representation:**

| Library field | Type / meaning |
| --- | --- |
| `card_id` | Integer identity; not the memory mathematics |
| `state` | State enum; serialized integer |
| `step` | Nullable learning/relearning step |
| `stability`, `difficulty` | Nullable floating memory values |
| `due` | Aware datetime; serialized ISO string |
| `last_review` | Nullable aware datetime; serialized ISO string |

`Card.to_dict/from_dict` use these seven keys. Constructor defaults otherwise use wall-clock identity/due values; explicit reconstruction avoids them. The conversion helpers are not a complete application state validator. [Pinned Card source](https://raw.githubusercontent.com/open-spaced-repetition/py-fsrs/v6.3.2/fsrs/card.py). `State` has Learning=1, Review=2, Relearning=3; `Rating` has Again=1 and Good=3 alongside the unused ratings. [Pinned State](https://raw.githubusercontent.com/open-spaced-repetition/py-fsrs/v6.3.2/fsrs/state.py), [pinned Rating](https://raw.githubusercontent.com/open-spaced-repetition/py-fsrs/v6.3.2/fsrs/rating.py).

**RECOMMENDED — Minimum persisted application memory:** retain an application-owned envelope with state-schema version, immutable algorithm/configuration identity, pinned engine version, and memory state/step/stability/difficulty. Reconstruct `due` from the selected historical schedule's `due_at` and `last_review` from its linked attempt's `client_interaction_at`; no new timestamp column is needed. Derive a deterministic engine integer identity from the server's stable learner/item identity, rather than generating it from wall time or adding a client-trusted ID. Those existing columns/identities are part of the persisted reconstruction context. A full third-party Card dictionary is not the only valid storage representation.

**RECOMMENDED — Validation/precision:** proposed envelope names are not yet locked. Validate a discriminated type/version, required keys, finite binary64 floats, positive stability, difficulty 1..10, allowed phase/step relationships, UTC timestamps and agreement with authoritative owner/item/configuration/history. For this no-steps protocol, an accepted result must be Review with a null step; absent stability/difficulty after acceptance is invalid. Preserve full float precision through Python/JSON round trips; do not round displayed values back into memory. Do not persist raw Python enums/datetime objects or permit NaN/Infinity. Reject unknown/malformed state explicitly instead of relying on assertions, coercive deserializers or defaults.

**RECOMMENDED — Historical isolation:** decode the application schema into the pinned engine through an explicit adapter. Do not pass arbitrary stored JSON straight to a mutable future `Card.from_dict`. A new engine/config/state schema gets a new supported version/adapter; old rows retain their original representation. The locked vector/configuration must be passed explicitly and identified by version/config digest, not read from library defaults. No optimizer/retraining or historical rescheduling is permitted during participant collection. Keep response time in the existing research record and leave it out of the scheduler call, including its optional duration argument.

**RECOMMENDED — First accepted FSRS interaction:** construct a transient Card explicitly with deterministic identity, Learning state, step 0, null stability/difficulty/last-review, and due equal to the aware UTC interaction instant. Apply the binary rating with the locked empty step configuration, then persist the returned Review-state memory. Do not create an FSRS state during eligibility/session creation, reuse a development state, or let constructor wall time become the review anchor.

**DEFERRED — Runtime golden vectors:** source verification is complete, but this audit did not execute or install FSRS. Pin installation, deterministic round-trip tests and golden outputs must be verified in the later integration milestone. Do not treat source inspection as a passing engine runtime test.

## SM-2 State Representation

**RECOMMENDED — Store all four locked fields in the existing state JSON**, under the same application envelope/version discipline: integer `repetition_count`, finite numeric `ease_factor`, integer `interval_days`, integer `lapse_count`. No dedicated relational columns are needed because only the current result is loaded for a transition and historical snapshots remain available for analysis.

**CONFIRMED — Locked transition details:** q=4 gives EF change `0.1 - 1*(0.08 + 1*0.02) = 0`. Incorrect responses explicitly retain EF under this binary protocol; do not import a standard SM-2 implementation that decreases it on q=2. Starting at EF=2.5, normal reachable histories retain 2.5. Initial `interval_days=0` is transient; accepted results have at least one day. Correct intervals begin 1, 6, 15, 38 days under the specified ceiling. Lapses reset repetitions to 0 and increment lapse count.

**RECOMMENDED — Keep `interval_days` in memory and `interval_seconds` in the generic schedule row.** The former is a direct transition input; the latter supports algorithm-independent due/response handling. This intentional duplication is useful if validation requires `interval_seconds == interval_days * 86400`. Keep counters nonnegative integers, reject booleans/coercive malformed numbers, enforce reachable state relationships and preserve numeric precision. With unchanged EF 2.5, exact decimal/rational multiplication can avoid large-integer float-ceiling errors.

**BLOCKER — Conventional maximum not specified:** the locked enhanced maximum must not silently become a conventional cap. Set a researcher-approved conventional maximum/overflow policy before boundary tests and live acceptance are finalized. Checked failure before persistence is safer than silent capping or datetime overflow.

## Replay / Integrity Considerations

**CONFIRMED — Existing replay strength:** accepted owner/event lookup precedes content/session/scheduler work; old replay returns its original schedule and cannot advance the pointer. The uniqueness flush precedes pointer change. D9's immutable records retain the exact algorithm/state/result. Sync and online share this path.

**BLOCKER — Stateful concurrency gap:** the current pointer upsert serializes pointer writes only after scheduler computation. Two distinct genuine events can compute from the same predecessor and then overwrite each other's current state. Concurrent duplicate requests can both call a candidate scheduler before one ledger insert loses; today's test checks persisted cardinality, not a single stateful calculation. `test_postgresql_concurrent_acceptance_has_one_current_schedule` deliberately permits either distinct-event result to become current.

**RECOMMENDED — Serialize before reading/calculating memory.** For the 30-participant scope, a transaction-level per-learner lock is a simple safe option: it covers missing first-item pointers and duplicate event IDs with conflicting submitted item facts. A more granular fixed-order event/item locking design is possible but needs equivalent proofs. Recheck the ledger after lock acquisition, load fresh current state rather than a stale ORM identity-map object, validate assignment and predecessor, calculate purely, then persist the entire acceptance chain and commit. Locking an existing pointer alone is insufficient when no pointer row exists. Keep algorithm objects stateless with respect to global parameters and copy prior memory before transition.

**BLOCKER — Late genuine offline events:** accepted UUID replay is solved; a previously unaccepted answer whose interaction predates the current last-review instant is not. Processing it as ordinary elapsed time, replacing its timestamp with receipt time, silently dropping it, or recomputing immutable historical schedules is unacceptable. Define a study policy for cross-device/out-of-order interactions and clock skew. Until that policy is approved, fail explicitly before acceptance rather than invent a negative-elapsed transition. Queue failures must remain visible and recoverable under the approved retry/permanent-error policy.

**RECOMMENDED — Preserve all D3–D10 boundaries:** no queue payload rewrites; no client state/condition authority; no second transition on accepted replay; exactly one transition per newly accepted genuine interaction; no partial attempt/schedule/ledger/event/current-pointer state after failure; original response time and interruption evidence retained but never scheduling features. A global Pydantic timezone/state rule that rejects old accepted requests before ledger lookup needs particular compatibility review.

## Historical Compatibility

**CONFIRMED — Targeted searches covered** development/dev-0.1, scheduler labels/state/interval/current pointers, due/interaction time, correct, 86,400/600 and eligible-items across runtime source, tests and migrations. The following classify actual hits, not instructions to replace constants.

| Class / status | Exact existing file(s) | Later treatment |
| --- | --- | --- |
| A — CONFIRMED historical algorithm | `backend/tests/reviews/test_scheduler.py` | Keep explicit DevelopmentScheduler version/86,400/600 and frozen-context coverage. This is not the conventional research comparator. |
| A + B — RECOMMENDED explicit development configuration | `backend/tests/reviews/test_review_api.py`; `backend/tests/sync/test_sync_api.py` | Retain historical acceptance/replay/lost-ack semantics; configure the development resolver explicitly for tests asserting dev labels/intervals. Add separate research-assigned variants rather than changing old expected values wholesale. |
| A + B — RECOMMENDED | `backend/tests/research_logging/test_integrity.py` | Preserve exact dev state/history assertions, failure rollback and immutable event tests; add D11 version/state/assignment projections separately. |
| A — CONFIRMED historical fixtures | `backend/tests/content/test_provenance.py`; `backend/tests/content/test_provenance_migration.py`; `backend/tests/analytics/test_progress.py` | Their seeded dev identities/intervals describe retained history or generic analytics, not a mandate to rewrite old rows. Content-version text such as `development-content-1` is not scheduler selection. |
| A + B — RECOMMENDED predecessor-aware extension | `backend/tests/reviews/test_due_review.py` | Keep dev boundaries and acceptance-order/replay tests; its development constant import and concurrent candidate scheduler need explicit test configuration. Add stateful serialization tests; do not claim its current concurrency test proves FSRS/SM-2 evolution. |
| A — CONFIRMED regression retention | `backend/tests/reviews/test_current_schedule_migration.py`; `test_timing.py`; `test_timing_migration.py`; `backend/tests/research_logging/test_migration.py` | Preserve historical migration, nullable evidence, immutable records and original timing semantics, even when they do not assert a literal interval. |
| B — RECOMMENDED generic wire fixture | `mobile/src/testUtils/contracts.ts`; `mobile/src/offline/__tests__/syncContract.test.ts`; `mobile/src/reviews/__tests__/contracts.test.ts`; `eligibility.test.ts`; `reviewScreen.test.tsx` | Preserve dev fixtures for backward contract coverage and introduce explicit D11 response fixtures. No client algorithm switch or mass 600→86,400 replacement. |
| A — CONFIRMED unrelated matching text | `mobile/src/offline/__tests__/syncRecovery.test.ts`; vocabulary-card font-weight literals; email-environment tests | `development-content-1`, font weight 600 and app environment names are not scheduler assumptions. Leave them alone. |
| D — BLOCKER runtime assumption | `backend/app/reviews/service.py:143–158`; `backend/app/scheduling/types.py` | Remove implicit dev fallback for research work and replace the stateless research input, while preserving an explicitly authorized development path outside the two study conditions. |
| C — DEFERRED new test files | Proposed `backend/tests/scheduling/test_sm2_binary.py`, `test_fsrs6_binary.py`, `test_state_contracts.py`; `backend/tests/research_assignment/test_assignments.py`; D11 migration and acceptance/eligibility tests | New files/paths are proposals only. The matrix below defines the missing coverage; no tests were written here. |

**RECOMMENDED — Fixture infrastructure:** `backend/tests/conftest.py` currently initializes/upgrades known earlier schemas and imports model modules before create_all; future assignment models/migrations must be included deliberately. `backend/tests/research_helpers.py` confines privileged fixture edits/reset to isolated `_test` databases. Preserve those safeguards; never repurpose them to convert D10 or formal participant evidence.

## Dependency Impact

**CONFIRMED — Local project:** `backend/pyproject.toml:4` requires Python `>=3.13,<3.14`; `backend/uv.lock` targets 3.13 and already includes `typing-extensions` 4.16.0. Neither file contains fsrs. Direct inspection of `backend/.venv/Lib/site-packages` found neither an fsrs package nor fsrs/py-fsrs distribution metadata; `pyvenv.cfg` identifies CPython 3.13. The venv's uv trampoline could not spawn its Python child under the current sandbox; package absence was checked by the package/metadata directory inventory instead, without changing the environment.

**CONFIRMED — Pinned upstream metadata:** distribution `fsrs` 6.3.2 declares Python >=3.10 and core dependency `typing-extensions`; its optional optimizer brings torch/numpy/pandas/tqdm and is unnecessary here. [Pinned project metadata](https://raw.githubusercontent.com/open-spaced-repetition/py-fsrs/v6.3.2/pyproject.toml). PyPI publishes a platform-independent Python wheel for this version. [Version-specific PyPI record](https://pypi.org/project/fsrs/6.3.2/).

**RECOMMENDED — Later packaging change:** explicitly pin `fsrs==6.3.2` in the production dependency list and update `uv.lock` through the normal resolver. The declared Python requirements are compatible with the project, but runtime/regression tests on 3.13 remain necessary. Existing README setup uses `uv sync`, so this is a production packaging/lock change, not a mobile dependency. Do not request optimizer extras, add GPU/native training packages, or install `py-fsrs` by a guessed distribution name. Record the resolved artifact hashes in the lockfile and keep the global parameter/configuration snapshot immutable.

**DEFERRED — Dependency addition and execution:** neither happened during this audit. An installed engine can precede assignment activation if isolated behind disabled research routing; a successfully installed library alone does not make the current INTEGER schema or acceptance state machine safe.

## Test Gap Matrix

**RECOMMENDED — Required later tests; all rows are proposals, not executed D11 evidence.** Keep the existing regression suites. Use explicit clocks, assignments, versions and isolated PostgreSQL migrations; avoid tests depending on wall time or random defaults.

| Area / proposed test | Required assertion |
| --- | --- |
| Conventional: first/second Correct | Initial state → 1 day / repetition 1; next Correct → 6 days / repetition 2. |
| Conventional: later Correct / ceiling | 6×2.5→15; 15×2.5→38, not 37; interval seconds/due agree. |
| Conventional: Incorrect / lapse | Reset repetitions to 0; set 1 day; increment lapses exactly once; retain EF and follow reset sequence on next Correct. |
| Conventional: q mapping / EF | Only q4/q2; q4 EF delta zero, Incorrect retains EF; no additional rating or hidden time/difficulty factor. |
| Conventional: state round trip | Exact counters, EF and interval days survive encode/decode; earlier state snapshot does not mutate. |
| Conventional: bounds / same session | First accepted interval >=1 day; approved maximum/overflow policy; no new same-session repeat; accepted UUID retry still succeeds unchanged. |
| Enhanced: first Good / first Again | Explicit initial Card/config and binary ratings produce pinned golden states/intervals; no same-day learning step. |
| Enhanced: repeated Good | Next state depends on actual previous state/time and evolves once. |
| Enhanced: established Again / lapse | Correct binary lapse path with empty relearning steps; retained prior snapshot remains unchanged. |
| Enhanced: overdue | Elapsed time uses previous interaction, including a late review beyond due date; acceptance latency and previous due date do not stand in for review time. |
| Enhanced: retention / vector freeze | Exactly 0.90 and all 21 locked values; later learners/reviews cannot mutate global configuration. |
| Enhanced: mappings / no steps / no fuzz | Only Good/Again; empty step tuples; fuzz disabled; repeated identical inputs/configuration are deterministic. |
| Enhanced: state round trip / precision | Card reconstruction through the app-owned schema yields the same future transition after JSON storage; reject nonfinite/invalid memory. |
| Enhanced: day rounding / min-max | Preserve pinned rounding; minimum 1 and maximum 36,500 days; BIGINT stores 3,153,600,000 seconds and mobile adapter accepts it. |
| Shared: authoritative selection | Same binary request, authenticated owner+frozen set assignment selects the correct type/version; attempted client condition/state injection is not authoritative. |
| Shared: forbidden features | Vary response time, interruption evidence, instructional difficulty and any pronunciation result without changing algorithm output for identical legitimate inputs. Preserve their separate research facts where applicable. |
| Shared: anchors / timezone | Offset-equivalent aware instants schedule identically; naive input fails under D11 rules; UTC/DST and subsecond anchors retain exact 86,400-second day semantics. |
| Shared: accepted replay | Online→sync, sync→online and old-event replay after later state: zero engine re-entry/transition, unchanged original state/due, no duplicate pair or pointer rollback. |
| Shared: genuine interaction | New UUID advances the assigned state exactly once and appends one attempt/schedule/ledger/two-event chain. |
| Shared: duplicate/distinct concurrency | Concurrent duplicates compute/persist one logical accepted transition; distinct events serialize predecessor reads without lost memory updates; first item has no absent-row lock hole. |
| Shared: malformed/unknown state | Wrong algorithm/config/schema, missing/scalar state, unsupported phase, invalid numbers, inconsistent timestamps/owner/item and missing pointer with history fail explicitly; no dev fallback or partial accepted evidence. |
| Shared: injected failures | Failure after scheduling, ledger, pointer or first event rolls back all acceptance changes and releases locks safely. Preserve per-event batch commit semantics. |
| Shared: immutable history | Original D10/dev rows, content facts and canonical event shapes remain unchanged; D9 UPDATE/DELETE/TRUNCATE protections still apply to new schedules. |
| Shared: eligibility | Future schedules absent, exact due boundary included, new items introduced, release changes retain logical schedule, other learner/item isolated. |
| Shared: offline assignment | Frozen pre-presentation mapping survives restart/delayed sync; accepted replay works even if assignment resolver later fails; queued dev work is never reassigned. |
| Shared: chronology policy | Approved out-of-order, equal-time, future-clock and cross-device scenarios behave explicitly without reanchoring or rewriting history. |
| Assignment: ownership | Learner cannot select/use another learner's assignment; response/analysis joins remain coded. |
| Assignment: set mapping | Approved Set A/B release/revision membership maps deterministically to the two algorithms; overlapping/ambiguous mappings rejected. |
| Assignment: allocation balance | Eligibility precedes allocation; exactly 15/15 approved mappings; duplicate/concurrent provisioning cannot exceed or change allocation. |
| Assignment: immutability/version | No silent mid-study reassignment, protocol/config mutation or set-membership replacement; accepted attempt binding reconstructs original condition. |
| Migration: preservation / downgrade | Real D9→D11 upgrade retains logical row digests, pointers, event links and guards; handles max interval; unsafe downgrade refused. |
| Mobile / native regressions | Existing contracts, A/B/C compiled timing, immutable retries, account fencing, queue leases, restart and reconnect still work with research-labelled responses; repeat required D10 native checks after actual implementation. |

## Migration / Deployment Risks

| Status | Risk | Safest later handling |
| --- | --- | --- |
| BLOCKER | Old backend writers default to development and do not load/validate memory | Do not enable research accounts under mixed old/new writers. A deployment feature gate must remain closed until all writers support assignment/state contracts. |
| BLOCKER | Existing dev-0.1 current schedules do not contain SM-2/FSRS memory | Preserve them unchanged. New formal participants should start with clean accounts and approved research-set identities, not converted D10/development histories. An incompatible existing pointer is an explicit refusal, not an initial state. |
| BLOCKER | Queued unaccepted development work has no assignment snapshot | Drain/reconcile under an explicit development-only route before enrollment, or leave old cohorts isolated with that route. Do not choose the new algorithm merely because sync arrives after deployment. Never rewrite queued payloads. |
| CONFIRMED | Already accepted dev events have immutable ledger/results | Keep replay before new resolver/state validation so their original result remains available. |
| BLOCKER | Out-of-order genuine answers conflict with prior immutable memory chronology | Obtain the approved handling policy before formal use; do not replay/rewrite historical schedules as an automatic repair. |
| RECOMMENDED | BIGINT expansion and additive provenance schema | Deploy tested expansion before any maximum-size interval or D11 assignment-dependent write. Guard against lock contention and unsafe downcast. |
| RECOMMENDED | Dependency introduction | Library/lockfile can land before activation, with no default algorithm switch and no optimizer extras. |
| RECOMMENDED | Assignment rollout | Provision frozen protocol/set mappings and clean eligible participants before exposing their first work; keep randomization/provisioning separate from scheduling engines. |
| RECOMMENDED | Operational rollback | Disable new assignment/routing, preserve accepted evidence and retain decoding of existing versions. Do not delete study rows or restore an older writer that silently emits dev schedules for enrolled learners. |

**RECOMMENDED — Do not touch existing D10 accepted records or counters for migration testing.** Use isolated databases/new coded test accounts and actual migration tests. Validate current deployed schemas/version at the later deployment gate; this static audit did not query or mutate any live database. D10 physical-device/overall blocks remain independent readiness gates.

## Chapter 3 Alignment Notes

**DEFERRED — Manuscript edits; conceptual amendments only:**

- Response time remains measured and immutably logged for analysis, but is not a scheduler input.
- The conventional comparator is explicitly the locked binary SM-2 protocol, including the q4/q2 mappings and lapse/EF behavior.
- ESR is explicitly a binary FSRS-6 adaptation using Good/Again, not a four-rating learner interface.
- FSRS memory Difficulty is distinct from instructional content difficulty.
- Pronunciation scores/labels do not affect either vocabulary schedule.
- Parameters, retention, steps, fuzzing and algorithm versions are frozen before formal collection.
- Individual memory state updates normally; no participant-time global retraining occurs. Balanced authoritative assignment is implemented separately from scheduler math, with equivalent activities, duration and assessments.

## Recommended Implementation Milestones

**RECOMMENDED — This sequence is a review proposal, not authorization to implement:**

| Milestone | Reviewable scope / exit gate |
| --- | --- |
| D11A — Close contracts and study decisions | Approve set/release identity, chronological-event policy, conventional bounds, allocation meaning and clean-cohort policy. Freeze app-owned state/configuration contracts, authority rules and test oracles. No live scheduler switch. |
| D11B — Expand persistence and build safe acceptance scaffolding | BIGINT plus minimal immutable assignment/provenance structures, strict version/state validators, explicit development routing and serialized predecessor access. Migration/replay/rollback tests pass with research gate disabled. |
| D11C — Binary SM-2 adapter | Pure locked transitions and state round trips, explicit configuration/test assignments, no default selection in production. Boundary policy implemented exactly as approved. |
| D11D — Pinned FSRS-6 adapter | Add `fsrs==6.3.2` and lock; explicit frozen configuration, adapter/round-trip/golden/boundary tests on Python 3.13; no optimizer or historical conversion. |
| D11E — Authoritative assignment and end-to-end scheduling | Separately reviewed allocation/provisioning service binds approved sets/participants, enforces balance/version/ownership, and routes both online/offline acceptance through the serialized path. Test assignments can precede a full randomizer; formal routing cannot precede authority. |
| D11F — Regression, rollout and freeze review | Full backend/mobile suites, real migration preservation checks, stateful concurrency, native offline/restart/reconnect, physical-device readiness and independent spec/code review. Freeze all formal versions/configuration before collection. No Plan E/F promotion from unit tests alone. |

**RECOMMENDED — Ordering rationale:** persistability, authority and transaction contracts precede live engine use; pure engine work can be reviewed before full counterbalancing tooling. This avoids an intermediate release where stateful results are calculated against stateless acceptance or a research participant silently uses the development fallback.

## Blocking Questions

**BLOCKER — Researcher decisions needed before live D11 activation:**

1. Which exact approved Set A/B memberships, language(s), releases/revisions and equivalent content/assessment procedures constitute the formal study? Can disjoint logical item IDs be guaranteed across conditions?
2. Does “sequence” mean only the two condition-to-set mappings, or also chronological study periods/order? Specify the eligibility criterion, balanced randomization/provisioning procedure, assignment version and timing before first work. The required 30 participants / 15+15 split is already locked.
3. What is the policy for a genuine offline interaction arriving earlier than the current last-review instant, equal-time interactions across devices, and future/skewed client clocks? The actual interaction anchor and immutable history are already locked; silently using receipt time is not an option.
4. What conventional maximum/checked-overflow policy applies beyond the specified SM-2 transitions? The enhanced 36,500-day maximum does not automatically answer this.
5. Confirm clean formal-account enrollment and isolation of existing development/test/D10 queues and current schedules, rather than conversion or erasure of accepted history.

**CONFIRMED — Not unresolved research questions:** binary mappings, retention, enhanced bounds, empty steps, no fuzzing, frozen vector, exclusion of response time/pronunciation/instructional difficulty as scheduling inputs, and backend authority are already locked. The library distribution name correction is verified technical metadata, not a change of research engine. Exact pinned API verification was completed; installation/runtime integration remains deferred work.

## Final Recommendation

**RECOMMENDED — D11 READY FOR SPEC REVIEW.** Approve the unresolved study policies and the proposed state/authority/migration contracts before implementation. The current schema and acceptance service are not safe for live D11 as-is; JSON capacity alone does not solve INTEGER overflow, state serialization, assignment provenance or offline chronology.

**CONFIRMED — Audit-only deliverable:** this new untracked document is the only intended filesystem change. No application source, migration, dependency/lockfile, Chapter 3 text, database evidence or D10 review bundle was changed. No D11 tests were written or executed, no dependency was installed, no review/B04/Plan E/F was started, and no commit or push was performed for this audit. Earlier checkpoint test results are not presented as fresh D11 verification.
