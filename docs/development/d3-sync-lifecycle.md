# D3 synchronization lifecycle

This documents operational queue behavior under the authoritative research contract
in `docs/research/fluentt-research-implementation-spec-v1.md`. It defines no learner
timing threshold, methodological exclusion, or new research payload fields.

## States and ownership

| Stored state | Meaning | Automatic handling |
| --- | --- | --- |
| `pending`, no failure | Queued work | Claim when verified owner and connectivity are eligible |
| `pending`, `failure_kind=transient` | Transport, incomplete acknowledgement, HTTP 408/429 or server failure | Retry after `next_retry_at` |
| `syncing` | Claimed event, identified by `lease_id`; `updated_at` is its heartbeat | Live lease is left alone; expired lease becomes pending |
| `pending`, `failure_kind=auth` | Authentication/authorization pause | Pause the owner's drain until a new verified session |
| `failed`, `failure_kind=permanent` | Non-retryable client/data rejection | Preserve for inspection; never automatically resend |

Pre-D3 `failed` rows stay failed conservatively: no guessed error classification
or automatic rewrite. Original `payload_json`, event UUID, owner and creation time
are never changed by claims, recovery, authentication resumption, or failure handling.
Ownerless legacy rows are never claimed, recovered, relabeled, counted for a learner,
or automatically deleted. Every production transition includes an explicit owner.

## Leases, acknowledgements and retries

A lease expires when `Date.parse(updated_at) <= now - 300000` (five minutes).
Claims are atomic conditional SQLite updates of eligible pending rows. A live worker
renews its lease every 30 seconds; requests have a 30-second deadline. Recovery checks
the observed timestamp, state and lease again in the SQL update, so a heartbeat that
arrived after the recovery read wins. Success/error/heartbeat mutations are fenced
by the owner and lease ID; an old worker cannot change a newer claim.

The clock is device wall time for operational persistence, not the monotonic learner
response-time clock. These constants are sync infrastructure, not research exclusion
thresholds. Large device clock changes can delay or accelerate expiry/backoff and
require D10 device verification. Suspended JS does not renew a lease; replay following
expiry is protected by backend idempotency even if acceptance occurred before suspension.

Transient retries wait `min(300000, 5000 * 2^min(6, max(0, attempt_count-1)))` milliseconds.
Both automatic and manual drains honor this persisted backoff. There is no retry limit
for valid transient work. A matching accepted UUID is required before local deletion.
Missing, malformed or unknown acknowledgements retain retryable work. Explicit event
error results and HTTP 4xx other than 401/403/408/429 retain non-retryable failed rows.
HTTP 401/403 pause authentication; other exceptions and HTTP 5xx are transient.
The API client also preserves credentials on refresh transport/service failures;
only a genuine refresh authentication rejection invalidates the current tokens.
Refresh has its own 30-second deadline so a stuck shared refresh cannot strand
subsequent sync requests. D2 compare-and-swap token/account guards are unchanged.

`attempt_count` counts entry into `syncing` (a sync claim, including a crash before
transmission). It increments once per claim, never on reads, heartbeat, recovery,
failure recording or deletion. A token-refresh replay within the claim does not
increment it again. This is not a learner review-attempt count or learning measure.
Historical pre-D3 counts are retained rather than corrected by inference.

## Partial batches and idempotency

The backend commits each accepted event independently. A later service validation
failure aborts the batch response but does not undo earlier commits. D3 uses one queued
event per request, without changing the backend protocol. A permanent rejection does
not stop later valid events. Transient failure ends the current drain; subsequent
eligible triggers retry it or skip its backoff to offer other pending work a turn.

An accepted event whose acknowledgement was lost is replayed with the same UUID.
The existing PostgreSQL `(user_id, client_event_id)` ledger returns the stored result
without another attempt, schedule or research event. No new UUID is generated for replay.

## Lifecycle and concurrency

The root layout mounts one coordinator and removes its listeners/timer on unmount.
It attempts recovery/draining after verified startup/restoration or login, foreground
resume, network reconnection, and every 30 seconds while foregrounded. This periodic
probe handles backend recovery, expired leases and due retry backoff even when no
connectivity event occurs. Manual Sync Now uses the same guarded worker.

No queue drain occurs before `/users/me` verifies the backend user ID. A newly verified
owner/token generation can clear only that owner's auth-paused rows; health probes,
resume, reconnect, periodic ticks and manual retries cannot clear an existing pause.
Verification on a new process start offers one fresh auth opportunity; another rejection
pauses again. No timer or probe transmits old-owner work under new-owner credentials.

The worker acquires its JS-runtime single-flight flag before any await. Overlaps skip;
the lifecycle coordinator coalesces triggers and later foreground ticks offer another
turn. Atomic SQLite claims and fenced completions protect leased rows as well. After
an account switch, only an already-started request's owner-scoped acknowledgement/error
can be reconciled; subsequent old-session requests stop. Background/unmount stops new
lifecycle transmissions; an in-flight acknowledgement may finish safely.

## Visibility, storage and verification limits

Participant counts include all retained rows of the verified owner, including permanent
failures; the sync screen shows rejection/auth notices and does not claim all-synced on
a storage read error. Queue UUID, raw payload, owner, state and error remain inspectable
in SQLite. There is no automatic deletion, correction, reassignment or exclusion policy.

Runtime SQLite initialization/migration failure rejects and permits a later retry; it
does not select volatile memory. The review screen does not advance or report a saved
review if enqueue fails. It keeps the captured attempt in memory for a same-screen retry
with the same UUID and original facts. That unsaved memory is explicitly not durable.

Jest's existing memory adapter remains test-only. D3 tests additionally execute production
SQL against Node's real SQLite engine, including file close/reopen, lease boundaries,
fencing and byte-preserving recovery. Backend tests verify lost acknowledgements and
partial-batch replay without duplicate persistence. This does not prove native Expo
process termination, OS suspension, disk exhaustion or device clock behavior: those
remain D10 manual/device checks. A crash before durable insertion cannot be recovered
from a queue row that never existed.

D4 still owns complete session/timestamp/platform/app-version metadata preservation.
The existing queue payload allowlist is unchanged, and existing offline session/payload
contract gaps can therefore become visible permanent rejections. D3 does not repair
those facts or expand the API/research contract. Failed/ownerless support tooling and
research inclusion/exclusion decisions remain outside D3.
