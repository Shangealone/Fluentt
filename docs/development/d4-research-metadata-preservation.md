# D4 — Research Metadata Preservation

The [D1 research specification](../research/fluentt-research-implementation-spec-v1.md)
remains authoritative. This note documents preservation only. The
[D3 operational specification](d3-sync-lifecycle.md) continues to define queue states,
leases, retry eligibility, authentication resumption, ownership and idempotency.

## Loss paths corrected

Previously the review screen put the resolved server session ID in both session
fields, hardcoded Android / `v0.1`, and created interaction time after awaiting
authentication. Initial-load retries also generated a new client session UUID.
The queue's seven-field allowlist discarded the client session, interaction time,
platform and application version, coerced correctness, and filled `created_at`
with enqueue time when absent. Backend compatibility normalization substituted
session/timestamp aliases and defaulted correctness/platform/version. Missing
historical facts consequently looked like authentic captured values.

## Captured facts and transport

`captureReviewAttempt` runs synchronously at the existing answer commitment,
before authentication or transport awaits. The same captured object is used by
online submission, offline enqueue and same-screen save retry:

| Field | Meaning/source |
| --- | --- |
| `client_event_id` | One UUID for this interaction; unchanged on replay |
| `client_session_id` | Original client-generated UUID for this mounted review session |
| `session_id` | Separately resolved backend UUID, if available at capture; otherwise absent |
| `vocabulary_item_id` | Current reviewed item ID |
| `correct` | Committed binary recall response, without coercion/default |
| `submitted_answer` | Existing supported `correct` / `incorrect` answer; optional in the API contract |
| `response_time_ms` | Existing monotonic duration; no new timing boundaries or exclusion rules |
| `client_interaction_at` | One ISO timestamp at answer commitment |
| `device_platform` | React Native `Platform.OS` at capture |
| `application_version` | Installed Expo Constants `expoConfig.version` at capture |

The session context retains the original client UUID across content-load retry,
offline session creation and authentication checks. Server resolution cannot
overwrite it or an already captured payload. A different owner or lesson starts
a distinct session context. No sync-time session UUID is generated.

Expo `app.json` currently configures version `1.0.0`; `expo-constants` is already
installed. No native build number is configured. This reports the approved app
configuration, not the Expo Go host version, hardware identity or a guessed build
identifier. Missing/blank/overlong configured version fails capture and shows the
existing save-failure UI; it does not create a queued/submitted review. No dependency
or configuration change is required. Version/platform are read only at capture;
an app update cannot overwrite an older queued event's captured values.

Online requests and new queue inserts use the same explicit allowlist and reject
missing required captured facts. Credentials, email, owner and queue bookkeeping
are excluded. `created_at` is not part of a new review wire payload. SQLite
`created_at` is insertion time and `updated_at` is operational mutation/heartbeat
time; neither substitutes for `client_interaction_at`. Pre-D4 column values may
have reflected the old interaction alias and remain untouched.

The worker continues to send the stored payload directly. Claims, retries, auth
pause/resume and stale-lease recovery leave `payload_json` byte-for-byte unchanged.
Owner, status, failure kind, lease ID, attempt count and retry eligibility stay in
SQLite columns. D3's five-minute lease, 30-second heartbeat/deadline, backoff,
single-flight and acknowledgement fencing are unchanged.

## Legacy handling and backend acceptance

There is no D4 migration, backfill, reassignment or automatic deletion. Stored
historical payloads are read as-is, including an existing `created_at` value or
missing fields. Ownerless rows remain blocked under D2. An owned incomplete row
reaching the backend receives HTTP 422 because both review endpoints share the
required canonical schema. D3 retains it as `failed` / `permanent`, leaves its
original bytes intact, shows the existing rejection notice and permits later valid
work to proceed. Existing failed rows are not automatically retried. Historical
absence remains absence; no platform/version/timestamp/session/correctness is guessed.

Compatibility aliases/defaults are removed rather than accepting fabricated
research facts. Existing older clients with incomplete payloads therefore receive
422. This change requires deploying the D4 mobile capture and backend validation
together. Already accepted records are not retroactively repaired.

The existing shared acceptance service stores the supplied timestamp, platform,
version, correctness, duration, answer and event UUID in `ReviewAttempt`. Its
`ReviewSession` link retains the original client UUID. Online and sync replay return
the original accepted attempt without another attempt, schedule, ledger or research
event; even changed metadata on a duplicate UUID does not replace accepted history.

## Verification and deferred work

Tests compare online payloads, SQLite payloads and sync bodies across transient
failure, auth resume, lost acknowledgement and an app-version change. They verify
separate client/server session identities, offline multi-card/load-retry continuity,
capture before delayed account verification, absent-version failure, actual runtime
platforms, operational timestamp separation, strict missing-field rejection and
legacy byte preservation. D2/D3 fixture updates supply the now-required canonical
fields; their account/token race, UUID, migration, backoff and fencing assertions
remain. Existing real SQLite file close/reopen and recovery tests now carry the
full D4 metadata. PostgreSQL tests exercise both endpoints with resolved and
unresolved backend sessions and check persistence, logging and idempotent replay.

- **D5:** immutable content/set/condition/assignment provenance is not added.
- **D6:** broad response/type/unit reconciliation and handling conflicting supplied
  client/server session identities remain deferred. The current service trusts an
  owned resolved server session; the D4 producer supplies matching identities.
- **D8:** prompt visibility, background/interruption validity and final timing
  methodology remain deferred; only existing duration and captured timestamp survive.
- **D9:** `REVIEW_ANSWERED` retains event UUID, item, correctness, duration, platform,
  version and interaction time. It omits session identities and submitted answer;
  authoritative linked review/session records retain those values. Logging schema,
  provenance, retention/deletion and inclusion/exclusion policy are not redesigned.
- **D10:** native Expo termination, suspension, clock changes, disk failures,
  app update and account-switch/device validation are still required. Node SQLite
  close/reopen and mocked runtime tests do not establish native-device behavior.

No due-review selection, experimental assignment, Conventional SRS, ESR,
pronunciation or NLP processing is implemented by D4.
