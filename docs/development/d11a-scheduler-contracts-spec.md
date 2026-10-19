# D11A Scheduler Contracts, State Schemas & Transaction Ordering Specification

## 1. Status and Scope

**LOCKED — Specification only; ready for independent specification review.** This document defines future D11 contracts. It does not implement an engine, assignment, migration, dependency, manuscript amendment or deployment. Formal research routing remains disabled. Specification readiness, implementation completion and formal research readiness are separate decisions.

**CONFIRMED — Baseline:** 2026-10-16, repository `F:\FLUENTT`, branch `main`, HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`. Initial status contained only the untracked D10 timing review bundle and D11 preimplementation audit. This new document must also remain untracked. No commit or push is authorized.

The repository-grounded source is [D11 ESR Pre-Implementation Audit](d11-esr-preimplementation-audit.md). Relevant current boundaries are `backend/app/scheduling/{base,types,development}.py`, `backend/app/reviews/{service,models,schemas,eligibility,router}.py`, `backend/app/sync/{service,models}.py`, `backend/app/content/provenance.py`, and the mobile review/offline modules identified below. These references describe checked-in code, not a fresh deployed-database inspection.

**LOCKED — Explicit supersessions of audit recommendations:** this specification applies the EF update on **every** SM-2 response, including Incorrect, and caps **both** research algorithms at 36,500 days. The audit's earlier EF-retention statement and unresolved conventional cap are historical, superseded statements. New D11 distinct-event chronology is strictly increasing; D7 development behavior is not retrospectively changed. Engine version is retained in the immutable configuration, rather than duplicated inside every state envelope. The audit and D10 evidence remain untouched.

## 2. Locked Research Scheduler Identities

| Role | `scheduler_type` | `algorithm_version` | `state_schema_version` | `config_version` |
| --- | --- | --- | --- | --- |
| Conventional: Binary SM-2 adaptation | `conventional_srs` | `sm2-binary-v1` | 1 | `sm2-binary-config-v1` |
| Enhanced: binary FSRS-6 ESR | `enhanced_srs` | `fluentt-esr-fsrs6-binary-v1` | 1 | `fsrs6-binary-r90-config-v1` |

**LOCKED:** these are the only two formal research schedulers. Historical `development / dev-0.1` is development-only and retains its own representation. No research routing fallback to development is permitted. Registry entries bind the entire identity tuple; mixing entries is invalid.

## 3. Binary Response Mapping

| Captured strict boolean | Learner button | Conventional quality | Enhanced rating |
| --- | --- | --- | --- |
| `true` | Correct | q = 4 | Good = 3 |
| `false` | Incorrect | q = 2 | Again = 1 |

**LOCKED:** no Hard/Easy buttons, invented intermediate ratings, pronunciation-derived ratings, or response-time-derived ratings. `submitted_answer` is descriptive; it cannot override `correct`. Preserve the existing binary presentation and fixed item list in `mobile/app/(app)/review/[lessonId].tsx::handleResponse`.

## 4. Scheduler Input Contract

**LOCKED — Exact mathematical input, conceptual immutable type:**

```text
SchedulerInput[Memory] = {
    correct: StrictBool,
    interaction_at_utc: AwareUtcDatetime,
    prior_state: ValidatedStateEnvelope[Memory] | None,
    prior_interaction_at_utc: AwareUtcDatetime | None
}
```

These are the **only four fields**. The current `scheduling/types.py::ReviewContext` is not this contract: it still includes response time and instructional difficulty and lacks predecessor memory.

Invariants:

- `correct` is an actual boolean, without coercion from strings or integers.
- Datetimes are aware, normalized UTC instants; a naive datetime is never assigned an assumed timezone.
- First review: both prior fields are `None`, after the service proves no accepted item history and no pointer.
- Subsequent review: both prior fields exist, from the same freshly selected current schedule and its linked attempt. Exactly one missing is invalid.
- Prior state is deeply immutable/copy-isolated. No caller-owned dictionary, predecessor object or persisted JSON is mutated.

**LOCKED — Separate dispatch context:** exact identity fields are `scheduler_type`, `algorithm_version`, `state_schema_version`, `config_version`. The trusted dispatcher resolves their immutable registry entry and verifies its digest. These are configuration/decoder selection, not learner features. They are obtained from backend assignment, never the request.

**LOCKED — Separate reconstruction context:** the service supplies validated server `user_id`, `vocabulary_item_id`, and `prior_due_at_utc` (null only for first review) to the FSRS adapter. They provide deterministic Card identity and reconstruct an existing storage field; they are not extra mathematical features. The conventional adapter does not consume them. Both calculation adapters are pure with respect to this explicit context and the four-field input: no database, network, clock, randomness or assignment lookup inside calculation.

Excluded from both mathematical input and feature transformation: `response_time_ms`, interruption evidence, instructional difficulty, pronunciation score/category, transport timing, personal name/email, client-selected condition. Timing facts remain immutable in the attempt/research chain under D8/D10. The FSRS optional `review_duration` argument is not supplied.

## 5. Scheduler Output Contract

**LOCKED — Exact generic internal result, with no extra fields:**

```text
SchedulerResult = {
    scheduler_type: ResearchSchedulerType,
    algorithm_version: SupportedAlgorithmVersion,
    state_schema_version: StrictInt,
    config_version: SupportedConfigVersion,
    interval_days: StrictInt,
    interval_seconds: StrictInt,
    due_at: AwareUtcDatetime,
    scheduler_state: ValidatedStateEnvelope
}
```

`interval_days` belongs in the generic result because both locked engines emit whole days. It is also in SM-2 memory because its next transition needs it. FSRS memory does not duplicate it.

Before any accepted-evidence insert, validate all of the following:

1. Exact registered identity agrees with assignment, envelope and adapter; schema version is integer 1, not `true`.
2. `1 <= interval_days <= 36500`; booleans, fractional values and coerced strings are rejected.
3. `interval_seconds == interval_days * 86400`, using checked integer arithmetic; range 86,400 through 3,153,600,000.
4. `due_at == input.interaction_at_utc + timedelta(seconds=interval_seconds)` as an exact instant. Check datetime overflow before persistence.
5. Strict envelope and memory validation succeeds; all numeric memory values are finite; no NaN/Infinity anywhere.
6. The proposed state is the assigned algorithm's transition from the validated predecessor, not an externally supplied state. No additional engine call is needed merely to format or persist it.

**CONFIRMED — Wire adaptation:** existing responses use `next_interval_seconds`, `next_due_at`, scheduler type/version and `scheduler_state` (`reviews/schemas.py::ReviewAttemptResponse/CurrentScheduleResponse`). Map the internal result into those existing fields. Schema/config identity is available inside the envelope; no new request selector or separate required wire field is needed. Mobile safe-integer parsing can represent the maximum seconds value.

## 6. Shared State Envelope

**LOCKED — Exact persisted JSON object:**

```json
{
  "schema_version": 1,
  "scheduler_type": "conventional_srs",
  "algorithm_version": "sm2-binary-v1",
  "config_version": "sm2-binary-config-v1",
  "memory": {
    "repetition_count": 1,
    "ease_factor": 2.5,
    "interval_days": 1,
    "lapse_count": 0
  }
}
```

All five envelope keys are required; additional properties are forbidden. `memory` must be an object. The enhanced envelope substitutes the exact enhanced identifiers and section 8 memory. `schema_version` is the envelope's field name; `state_schema_version` is its internal result/dispatch counterpart. They must agree.

Decoder selection is exactly `(scheduler_type, algorithm_version, schema_version)`, followed by validation of supported `config_version` and digest. Unknown identity fails closed; there is no generic pass-through, coercive engine deserialization or initialization fallback. Validate envelope identity against schedule columns, linked attempt columns and assignment. Research state from one engine cannot seed the other. JSON null, duplicate JSON keys at an input boundary, nonfinite numeric tokens and unexpected keys are invalid.

Engine distribution/version and configuration digest are not repeated inside state. Immutable configuration and assignment references provide them unambiguously. Future engine/config/schema changes receive new immutable identities and adapters; they do not reinterpret old rows.

## 7. Binary SM-2 State Schema

**LOCKED — Exact accepted `memory` JSON Schema (2020-12 semantics):**

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["repetition_count", "ease_factor", "interval_days", "lapse_count"],
  "properties": {
    "repetition_count": {"type": "integer", "minimum": 0},
    "ease_factor": {"type": "number", "minimum": 1.3, "maximum": 2.5},
    "interval_days": {"type": "integer", "minimum": 1, "maximum": 36500},
    "lapse_count": {"type": "integer", "minimum": 0}
  }
}
```

Application validation additionally requires actual integer values for counters/days (no bool, floating representation such as `1.0`, or string coercion), finite EF, and these reachable-state invariants. JSON Schema alone is insufficient:

- EF equals `max(1.3, 2.5 - 0.32 * lapse_count)` using exact decimal arithmetic. Correct q4 contributes zero; each Incorrect q2 contributes -0.32 before clamping.
- `repetition_count == 0` requires `lapse_count >= 1` and `interval_days == 1`; an accepted zero/zero transient initial state is invalid.
- Repetition 1 requires interval 1; repetition 2 requires interval 6.
- For repetition `r >= 3`, begin at interval 6 and apply `min(36500, ceil(interval * ease_factor))` exactly `r - 2` times. The stored interval must match. Once capped, remaining iterations remain capped; validation need not loop for an unbounded counter.
- The linked current attempt's `correct` is false iff repetition is zero. When producing a result, counter/lapse increments must also match its actual predecessor and captured answer.
- Memory interval agrees with the historical schedule's seconds; schedule due agrees with its linked interaction plus seconds. Reject an internally plausible state with inconsistent ownership/provenance/row values.

**LOCKED — Transient initialization only:** `{repetition_count: 0, ease_factor: 2.5, interval_days: 0, lapse_count: 0}`. It is not an accepted state or a persisted placeholder.

**LOCKED — Pure transition:** take q from section 3; first calculate `EF_new = max(1.3, EF_old + 0.1 - (5-q)*(0.08+(5-q)*0.02))` for **every** answer. On Correct use previous repetition 0 -> 1 day, 1 -> 6 days, otherwise `ceil(previous_interval_days * EF_new)`; increment repetitions and retain lapses. On Incorrect set repetitions 0, interval 1, increment lapses. Clamp the resulting interval to [1,36500]. Return a new object.

Use exact decimal/rational arithmetic for the SM-2 formula, reachability checks and ceiling, without binary-float accumulation or arbitrary rounding. Persist EF as a JSON number with its exact finite decimal value. This is a **Binary SM-2 adaptation**, not unmodified/original SM-2. No same-session remedial item is inserted on a lapse.

## 8. FSRS-6 State Schema

**LOCKED — Exact accepted enhanced `memory` schema:**

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["state", "step", "stability", "difficulty"],
  "properties": {
    "state": {"type": "string", "const": "Review"},
    "step": {"type": "null"},
    "stability": {"type": "number", "exclusiveMinimum": 0},
    "difficulty": {"type": "number", "minimum": 1, "maximum": 10}
  }
}
```

Numbers must be finite actual numeric values, not booleans or coerced strings. Preserve the pinned engine's full binary64 precision through JSON round trips; display rounding must not alter memory. Persist no Learning/Relearning state, non-null step, missing memory value, enum object, or raw engine `Card.to_dict()` object. Due is in `ReviewSchedule.due_at`; last review is the linked `ReviewAttempt.client_interaction_at`. They must not be duplicated inside memory.

**LOCKED — Explicit reconstruction:**

```text
card_id = (server_user_uuid.int << 128) | server_vocabulary_item_uuid.int

first:
    Card(card_id=card_id, state=State.Learning, step=0,
         stability=None, difficulty=None,
         due=interaction_at_utc, last_review=None)

subsequent:
    Card(card_id=card_id, state=State.Review, step=None,
         stability=prior_state.memory.stability,
         difficulty=prior_state.memory.difficulty,
         due=prior_due_at_utc, last_review=prior_interaction_at_utc)
```

The pair of server UUID integers produces a deterministic, collision-free 256-bit pair encoding. It remains an internal Python integer, never a JavaScript number, stored memory field or client identifier. No UUID hashing/truncation, client Card ID, generated wall time, implicit constructor time or default due is used. Prior due comes from the same current row as prior memory. Reconstruction is a fresh Card; it cannot mutate the predecessor JSON.

Call the explicitly configured pinned `Scheduler.review_card` once with mapped Good/Again and explicit `review_datetime=interaction_at_utc`; omit `review_duration`. Validate returned Review/null-step memory, due, last-review and whole-day interval before wrapping it. The transient Learning state is never persisted. Retain pinned engine rounding/elapsed-time behavior; do not substitute SM-2 ceiling or a fractional-day variant.

**CONFIRMED — Source basis, not runtime golden proof:** the audit verified empty-step handling, 1..10 Difficulty, integer-day calculation and UTC review API in the [v6.3.2 scheduler](https://raw.githubusercontent.com/open-spaced-repetition/py-fsrs/v6.3.2/fsrs/scheduler.py). Explicit construction avoids the [v6.3.2 Card defaults](https://raw.githubusercontent.com/open-spaced-repetition/py-fsrs/v6.3.2/fsrs/card.py). The pair-identity rule is this application's design decision. **DEFERRED:** runtime verification after the authorized pinned installation, including large internal integer identity round trip. No FSRS numerical golden result is claimed here.

## 9. Frozen Configuration Identity

**LOCKED:** registry names are exactly `sm2-binary-config-v1` and `fsrs6-binary-r90-config-v1`. Version labels are immutable keys, not mutable aliases. The two complete configuration records below are normative. Decimal **strings in configuration documents** preserve explicit constant spelling for hashing; adapters convert them using their specified arithmetic. Memory EF/stability/difficulty remain JSON numbers.

```json
{
  "algorithm_version": "sm2-binary-v1",
  "binary_rating": {"correct": 4, "incorrect": 2},
  "config_version": "sm2-binary-config-v1",
  "correct_transition": {
    "first_intervals_days": [1, 6],
    "lapse_increment": 0,
    "later_interval": "ceil(previous_interval_days*updated_ease_factor)",
    "repetition_increment": 1
  },
  "day_seconds": 86400,
  "ease_update": {
    "apply_to": "every_response",
    "arithmetic": "exact_decimal",
    "formula": "EF+0.1-(5-q)*(0.08+(5-q)*0.02)",
    "minimum": "1.3"
  },
  "incorrect_transition": {"interval_days": 1, "lapse_increment": 1, "repetition_reset": 0},
  "initial_memory": {"ease_factor": "2.5", "interval_days": 0, "lapse_count": 0, "repetition_count": 0},
  "interval_cap": "after_transition",
  "maximum_interval_days": 36500,
  "minimum_interval_days": 1,
  "same_session_remedial_repetition": false,
  "scheduler_type": "conventional_srs",
  "state_schema_version": 1
}
```

```json
{
  "algorithm_version": "fluentt-esr-fsrs6-binary-v1",
  "binary_rating": {"correct": 3, "incorrect": 1},
  "config_version": "fsrs6-binary-r90-config-v1",
  "day_seconds": 86400,
  "desired_retention": "0.90",
  "elapsed_days": "pinned_engine_timedelta_days",
  "enable_fuzzing": false,
  "engine": {"distribution": "fsrs", "model": "FSRS-6", "version": "6.3.2"},
  "interval_rounding": "pinned_engine_round_then_clamp",
  "learning_steps_seconds": [],
  "maximum_interval_days": 36500,
  "minimum_interval_days": 1,
  "numeric_arithmetic": "pinned_engine_binary64",
  "optimizer_enabled": false,
  "parameters": [
    "0.212", "1.2931", "2.3065", "8.2956", "6.4133", "0.8334", "3.0194",
    "0.001", "1.8722", "0.1666", "0.796", "1.4835", "0.0614", "0.2629",
    "1.6483", "0.6014", "1.8729", "0.5425", "0.0912", "0.0658", "0.1542"
  ],
  "participant_time_global_retraining": false,
  "relearning_steps_seconds": [],
  "same_session_remedial_repetition": false,
  "scheduler_type": "enhanced_srs",
  "state_schema_version": 1
}
```

The future enhanced adapter passes the 21 parameters, retention 0.90, `learning_steps=()`, `relearning_steps=()`, `maximum_interval=36500`, and `enable_fuzzing=False` explicitly. Minimum effective interval is one day. Distribution/import is `fsrs`, future pin `fsrs==6.3.2`; no optimizer extras, optimizer invocation or participant-time global retraining. Learner/item memory still evolves normally.

**LOCKED — Additional SHA-256 binding selected:** recursively sort object keys by ascending ASCII code point, retain array order, serialize with no whitespace/separators other than JSON `,` and `:`, no BOM or trailing newline, ASCII strings without alternate escapes, lowercase JSON booleans, base-10 integers without leading zeros. All keys/string values above are ASCII; decimal constants retain the exact string spellings shown. No floating JSON numbers occur in these configuration documents. SHA-256 the resulting UTF-8 bytes; encode as 64 lowercase hex characters. This is a deliberately restricted canonical format, not a claim to implement generic JSON canonicalization.

| Immutable config | SHA-256 of canonical complete record above |
| --- | --- |
| `sm2-binary-config-v1` | `3bd486d1183d84a869a2470f0a97a13ecabc44365eb9fe8e158014fd1ef2a0d9` |
| `fsrs6-binary-r90-config-v1` | `4e4c56a9f928cae5581e5d577de413b17c9d581185482db423a98551f6575e4f` |

These digests were computed in memory during D11A, without installing or executing either scheduler. Later fixtures must independently reproduce them. Future immutable configuration records store the canonical document and digest. Protocol/condition references bind `(config_version, config_sha256)`; state references `config_version`, whose immutable unique record supplies the digest. No per-state engine/version/digest duplication is needed. Missing required supported registry data is an unavailable deployment; a stored binding contradicting a frozen record is an integrity failure.

Clock-skew policy, assignment, set membership and chronological period order are **protocol validation configuration**, not engine configuration. They are separately versioned and frozen; changing them cannot silently edit either engine record.

## 10. Time and Interval Contract

**LOCKED:** a study day is exactly 86,400 seconds. Normalize new aware interaction instants to UTC before comparison/calculation. `due_at = client_interaction_at_utc + interval_days * 86400 seconds`; never anchor to server acceptance, local midnight, a calendar-date boundary, network receipt or local timezone. Original immutable timing evidence is preserved; UTC normalization preserves the instant.

Both engines have minimum accepted interval one day and technical maximum 36,500 days. The cap is a storage/overflow safeguard, not a predicted methodological interval. Validate checked integer multiplication and representable datetime addition. A malformed/unrepresentable new timestamp is rejected before engine entry; an internally inconsistent engine output is a server failure. Do not repair either by changing the anchor.

**LOCKED — Future-skew hook:** a frozen protocol clock-policy reference must eventually supply a nonnegative maximum future duration. For new work the service captures one aware backend validation instant and checks `interaction_at_utc <= validation_now_utc + configured_max_future_skew`. Passing the check does not replace the interaction timestamp. The service check is outside scheduler mathematics/state; it runs after replay and before calculation. Test fixtures may supply explicit controlled policies, clearly labeled non-formal.

**DEFERRED / FORMAL BLOCKER:** the numeric tolerance and its formal clock-policy version await adviser/device-pilot approval. This document supplies no numeric tolerance. Absent a frozen formal policy, return a retryable deployment error and keep formal routing closed, rather than treating an absent limit as unlimited acceptance.

## 11. First-Review Contract

**LOCKED:** under the learner lock, prove no accepted history for the logical item (attempts, schedules or accepted chain) and no current pointer. Resolve the frozen assignment first. Initialize only the assigned transient state in sections 7/8 and apply the first captured response. Eligibility/session creation does not persist scheduler memory or reserve a state transition.

First acceptance atomically creates one attempt, one historical schedule, one owner/event ledger record, one current pointer, one assignment binding, and the canonical `REVIEW_ANSWERED` / `REVIEW_SCHEDULED` pair. A pre-existing session alone is not accepted evidence.

History without a pointer, a dangling pointer, a pointer with no valid linked attempt, a pointer without matching accepted evidence, or a partial history chain is an integrity failure. A formal assignment with a development pointer/state is also an integrity/enrollment failure. Do not initialize anew, replay history into a new algorithm, or convert/delete development records.

## 12. Chronology Contract

| Case | New D11 acceptance decision |
| --- | --- |
| A: owner/event UUID already accepted | Return the original accepted result first; ignore current chronology for replay. |
| B: distinct UUID, no accepted item history and no pointer | Assigned first review, subject to provenance/assignment/time validation. |
| C: distinct UUID, incoming instant strictly greater than current linked interaction | One transition from that freshly loaded predecessor. |
| D: distinct UUID, equal instant | 409 `D11_STALE_INTERACTION`; zero new accepted evidence. |
| E: distinct UUID, earlier instant | 409 `D11_STALE_INTERACTION`; zero new accepted evidence. |
| F: new D11 timestamp lacks timezone | 422 `D11_TIMEZONE_REQUIRED`; never assume UTC. |
| G: timestamp beyond approved future limit | 422 `D11_FUTURE_INTERACTION`; no acceptance. Without a configured formal policy: 503 `D11_CLOCK_POLICY_UNAVAILABLE`. |

The previous instant is the **current schedule's linked attempt** `client_interaction_at`, normalized UTC. It is not prior due, acceptance, updated-at, latest UUID, or a timestamp found by independently sorting history. Prior state and prior interaction must identify that one predecessor.

No history reordering, timestamp repair, retrospective rescheduling, state reinitialization for stale work or pointer rollback is allowed. Genuine offline events may be rejected if another device's newer interaction became current first. Queue retries keep the original UUID/timestamp; generating a new UUID or changing time is not reconciliation. A rejected genuine event creates no immutable accepted rows, pointer change or research event; a separately committed session may exist.

## 13. Replay and Idempotency Contract

**LOCKED — Key:** `(authenticated user_id, client_event_id)`, never a cross-owner UUID lookup. Authentication/ordinary request parsing necessarily precede the service, but new-D11 timezone, condition, chronology, config and routing rules must follow the accepted-replay boundary. Do not add a global strict validator that rejects an otherwise parseable accepted legacy replay before that boundary.

Return the linked original attempt and its original schedule, even after later item transitions, assignment service outage, routing disablement or a new unsupported current state. Zero engine entries, new state, pointer writes, assignment reevaluation or additional canonical events. Original scheduler labels/state/interval/due/acceptance metadata are returned; replay must not substitute the latest schedule. Envelope decoding is not a prerequisite for returning historical accepted state unchanged.

`reviews/service.py::record_review_attempt` already performs the initial ledger lookup. Preserve it, then recheck after acquiring the learner lock. The ledger's existing owner/event uniqueness remains the database backstop. A request waiting behind acceptance of its duplicate returns the winner after the lock; it does not run a second transition. An accepted UUID identifies original work, not permission to overwrite facts with differing replay fields.

**CONFIRMED:** current replay reconstructs from linked records; `AcceptedClientEvent.response_payload` omits `scheduler_state`. Keep one authoritative original-result builder for online and sync rather than switching to that incomplete cache. An existing ledger whose linked attempt/schedule is missing is server corruption, never permission to schedule again.

## 14. Transaction Ordering

**LOCKED — Decision on the existing session commit:** resolve/validate the session **before** the scheduler acceptance transaction. Do not call `get_or_create_review_session` under the learner lock. Its existing `db.commit()`/`db.refresh()` boundary can remain for D11B; session creation alone may survive a later rejected attempt. No acceptance helper may independently commit once the lock is acquired.

SQLAlchemy reads/authentication may already have opened a transaction. Capture only validated immutable IDs/value facts needed from preflight. After session resolution, ensure no uncommitted writes remain (only the helper's independently committed session creation is permitted), then explicitly end the preflight read transaction by rollback/close. A refresh after helper commit can have opened another read transaction; end that too. Never start a nominal nested transaction over that existing transaction or accidentally commit pending acceptance work. Request scope must not contain unrelated pending writes.

**LOCKED — Future `record_review_attempt` pseudocode, shared by online and sync:**

```text
A  authenticate; retain authenticated owner ID (ordinary parsable request required)
B  look up accepted owner/event FIRST; if present return original or integrity error
C  resolve exact immutable released item/revision provenance
D  resolve/validate owner session and original client_session_id in preflight
   finish preflight read transaction as described above

   begin one explicit PostgreSQL READ COMMITTED acceptance transaction
E    SELECT users.id WHERE id = authenticated_owner_id FOR UPDATE
F    freshly recheck owner/event ledger; if accepted return original, no engine
G    resolve immutable protocol/enrollment/set condition/config and routing gate
     reject absent/contradictory assignment; never use a development default
H    freshly load current owner/item pointer, schedule, linked attempt and ledger
     load existence evidence to distinguish first review from broken history
     revalidate session owner/identity; check no forbidden same-session repeat
I    validate owner/item/provenance/assignment/type/version/config/envelope/memory
     prior state + prior interaction must come from that same selected record
J    validate new timezone/representability, assignment active at interaction,
     strict chronology and configured future-skew policy
K    calculate exactly ONE pure transition using the resolved adapter/config
L    validate complete result, state and due/seconds/identity consistency
M    stage immutable ReviewAttempt with authoritative assignment reference
N    stage immutable ReviewSchedule; flush as required to obtain linked IDs
O    stage AcceptedClientEvent using original-result builder; flush uniqueness
P    insert/update CurrentReviewSchedule for this owner/item to the new schedule
Q    stage canonical REVIEW_ANSWERED linked to the attempt
R    stage canonical REVIEW_SCHEDULED linked to the attempt
S  commit all M-R atomically; release learner lock; return accepted result
```

Frozen provenance can be retained as validated scalar preflight data; mutable/session-dependent facts are reread under the lock. Use fresh SQL results/explicit refresh or populate-existing semantics for pointer/schedule/attempt, not a stale ORM identity-map snapshot from preflight. READ COMMITTED ensures reads after waiting see the preceding committed acceptance. There is no engine call before E or F. Ledger uniqueness is flushed before pointer change, as in current D7/D9 acceptance.

**LOCKED — Failure behavior:** any error in the acceptance transaction rolls back its entire staged chain and pointer. On the specific owner/event unique-constraint race, roll back, open a fresh read transaction and return the valid winner if one exists; do not rerun the engine. Do not reinterpret an arbitrary integrity exception as a duplicate. SQLSTATE serialization/deadlock/lock-timeout conditions return retryable 503; no server-side retry loop repeats K within one request. A later retry of an unaccepted, rolled-back event may calculate again; an already accepted event never does. A lost commit acknowledgement is reconciled by the unchanged UUID.

**LOCKED — No remedial repetition:** no lapse causes UI reinsertion. New formal acceptance also permits at most one genuine accepted answer for an owner/session/logical item, in either condition, checked under the learner lock; a new UUID for that same session/item gets 409 `D11_SESSION_ITEM_ALREADY_ANSWERED`. Accepted UUID replay still wins first. Subsequent scheduled study reviews use a new session. This is a scoped D11 rule, not a rewrite or blanket constraint on legacy development history.

Current `sync/service.py::sync_review_events` commits per event; keep that granularity. Never hold one learner lock across a network batch or use one transaction for multiple learners/items.

## 15. Serialization / Locking Strategy

**LOCKED — Select the existing learner row with `FOR UPDATE`, per user, transaction-level.** `users.id` always exists for an authenticated owner, covering an absent first-item pointer. A pointer-row lock alone cannot protect first review. No advisory-key hash, distributed lock or extra lock table is necessary for 30 participants.

Acquire before any fresh current-state/history read or calculation; hold through S. PostgreSQL releases it at commit/rollback. Two items for one learner serialize too; this small conservative scope is intentional. Different learners proceed independently. The lock does not change existing immutable user participant codes or other user fields.

All review acceptance writers that can touch a research learner, including explicit development/test writers and sync, must honor the same user-lock discipline. Clean enrollment/freeze operations take the same user lock before checking history and activating assignment. Old unlocked backend writers must be removed before enabling research. Immutable assignment reads introduce no additional update lock under normal acceptance.

Duplicate waiting requests recheck replay immediately after acquiring the lock. Distinct requests read the newly committed predecessor and revalidate time. If increasing interaction order matches lock order, both may accept serially. If the newer interaction wins first, the older genuine event rejects as stale; do not promise that all concurrently submitted distinct events accept. Never calculate both from the same predecessor.

**LOCKED — Deadlock discipline:** one learner and one item per acceptance transaction; no session helper commit or network call under lock. Order is user row, then owner/item state read, then staged acceptance writes. Do not acquire another learner lock. A future explicitly approved multi-owner operation would require ascending UUID lock ordering and a separate design review; it is outside this contract. Lock timeout/deadlock is a retryable service condition, not a permanent client failure.

## 16. Research Assignment Authority

**LOCKED — Authority boundary:** a backend research-assignment service resolves `(authenticated user, protocol identity/version, exact content_release_id + vocabulary_item_id + content_revision_id)` to exactly one immutable condition and configuration. The protocol is resolved from authoritative enrollment and exact membership, not a client condition/participant-code prefix/current app version. Reject ambiguity. Schedulers neither allocate nor randomize. No authentication secret or personal identity field belongs in these concepts.

These are exact minimum conceptual records/invariants; future physical table names may differ:

| Concept | Required fields / binding |
| --- | --- |
| `ResearchProtocol` | `protocol_id`, `protocol_version`, mode (`formal` or isolated `test`), approved equivalence reference, immutable Set A/B references, supported algorithm/config versions and digests, allocation-procedure version, period-order-procedure version, assignment-freeze policy reference, clock-policy version/reference, immutable approval/freeze timestamp. Exactly one complete frozen version is authoritative; drafts cannot accept work. |
| `ResearchSet` | `research_set_id`, protocol ID/version, label A or B, immutable membership of exact `(content_release_id, vocabulary_item_id, content_revision_id)` triples, content approval reference. Each triple must pass D5 release provenance. Logical item membership is unique within a set and disjoint across the two sets. |
| `ParticipantAllocation` | `allocation_id`, authenticated internal `user_id`, protocol ID/version, approved eligibility reference, `mapping_group` (1 or 2), **separate** `period_order` (ordered A/B set identities), assignment version, allocation-procedure reference, period-order-procedure reference, `frozen_at`. Unique owner/protocol; coded participant identity is joined from User. Assignment must be frozen before first offered work and before accepted interaction time. |
| `ParticipantSetCondition` | `participant_set_condition_id`, allocation ID, owner ID, protocol ID/version, research set ID, scheduler type, algorithm version, state schema version, config version/digest. Exactly two mappings per allocation, one per set, matching its mapping group. Immutable and owner-scoped. |
| `AttemptAssignmentReference` | One immutable link from a new research `ReviewAttempt` to its `participant_set_condition_id`; owner/protocol/set/config and allocation/period order are reconstructible through it. Existing attempt item/revision/release must be an exact member of the referenced set. The link is created atomically with acceptance, required for new D11 attempts and null on historical development rows. A separate table is not required if an owner-scoped FK on the attempt supplies this binding. |

Exactly 30 formal participants, with exactly 15 in each mapping group:

| Mapping group | Set A | Set B |
| --- | --- | --- |
| 1 | `enhanced_srs` | `conventional_srs` |
| 2 | `conventional_srs` | `enhanced_srs` |

**LOCKED:** `mapping_group` is not chronological period order. The order field records a separately approved two-set sequence; do not derive A-first/B-first from group number or invent its allocation procedure here. The randomization/provisioning authority validates 15/15 totals and stores procedure provenance outside engine mathematics. Test allocations are separately labeled and excluded from formal counts.

Assignment is frozen before eligibility is exposed, so delayed offline work resolves the original fixed condition from exact server provenance. Do not choose a condition from receipt date or whichever period is currently displayed. Incoming time before assignment freeze is a permanent provenance rejection; lack of a freeze/policy due to service configuration is retryable unavailability. Exact chronological study-period procedures remain a formal gate; introducing period windows or cross-period rejection rules requires their approved protocol definition, not an ad hoc acceptance-time rule.

Absent enrollment/no matching assigned item is a permanent research-provenance error only when the authoritative service successfully proves that absence. Missing service/registry availability is 503; contradictory stored authoritative mappings are 500. An outage must never masquerade as “not assigned.”

## 17. Formal Set / Memory Isolation

**CONFIRMED / LOCKED:** `CurrentReviewSchedule` is keyed by `(user_id, vocabulary_item_id)`, not protocol, release, condition or period. Set A and Set B therefore use disjoint **logical item IDs**, not merely different revisions of one item. A new release ID does not isolate old memory. Exact words/memberships are deferred; no sample lesson is designated a formal set by this specification.

Clean formal enrollment requires a provisioned coded account, approved study eligibility, complete frozen allocation, and zero attempts, schedules and current pointers for formal items; there must also be no development state or queued development work for those items. Under the enrollment user lock, check the entire accepted history, not only the current pointer. An incompatible history fails enrollment. Never convert D10 accounts, delete accepted history, reset pointers or transform dev JSON into research memory.

Backend SQL alone cannot prove an offline device queue is empty. Before formal enrollment, the controlled onboarding/device procedure must verify/reconcile all applicable owned queues without rewriting payloads and record that clearance. Dedicated formal accounts and approved formal content provide isolation; an unverifiable queue clearance blocks formal enrollment. Accepted dev replays still reconcile normally. Unaccepted dev work remains development work, never reclassified because its upload occurs after a deployment.

## 18. Error Taxonomy

**CONFIRMED — Existing API conventions:** content/session provenance errors are 400 in `reviews/service.py` / `content/provenance.py`; request validation uses FastAPI/Pydantic 422; auth dependencies use 401 and password-change 403. `mobile/src/offline/syncWorker.ts::classifySyncFailure` maps 401/403 to `auth`, other 4xx except 408/429 to `permanent`, and network/5xx/408/429 to `transient`. `mobile/src/api/client.ts::normalizeApiErrorMessage` understands string `detail`; an object-only detail would lose the useful message.

**LOCKED — Future D11 service error body:** `{"detail":"<safe human-readable message>","code":"<stable code>","category":"<category below>"}`. No payloads, state dumps or credentials in error messages. Existing framework validation 422 retains its `detail` error list; it belongs to category A without changing legacy parsing. New D11 semantic time validation uses the stable service codes below. Mobile classification continues to use HTTP status, not assumed parsing of a new field.

| Category | Stable code(s) / circumstance | HTTP | Existing mobile class / consequence |
| --- | --- | --- | --- |
| A `client_provenance` | `D11_CONTENT_PROVENANCE_INVALID`, `D11_SESSION_INVALID`, `D11_ITEM_NOT_ASSIGNED`, `D11_ASSIGNMENT_NOT_ACTIVE_AT_INTERACTION` | 400 | `permanent`; retain as failed evidence for review, do not fabricate acknowledgement. |
| A `client_provenance` | Framework malformed request; service `D11_TIMEZONE_REQUIRED`, `D11_TIME_INVALID`, `D11_FUTURE_INTERACTION` under a configured limit | 422 | `permanent`; original work is not silently corrected/reissued. |
| A `client_provenance` | `D11_STALE_INTERACTION`, `D11_SESSION_ITEM_ALREADY_ANSWERED` | 409 | `permanent`; no accepted chain or pointer change. |
| B `server_integrity` | `D11_STATE_CORRUPT`, `D11_STATE_IDENTITY_UNSUPPORTED`, `D11_ASSIGNMENT_CONTRADICTION`, `D11_CURRENT_CHAIN_INVALID`, `D11_OUTPUT_INVALID` | 500 | `transient` in the existing queue; retain payload, back off, raise an operator-visible blocker. |
| C `service_unavailable` | `D11_ASSIGNMENT_UNAVAILABLE`, `D11_ROUTING_DISABLED`, `D11_CONFIG_UNAVAILABLE`, `D11_CLOCK_POLICY_UNAVAILABLE`, `D11_ENGINE_UNAVAILABLE`, `D11_TRANSACTION_RETRY` | 503 | `transient`; preserve work/UUID for retry after service/deployment recovery. |
| D existing authentication | Preserve current 401/403 body and refresh/owner behavior | 401/403 | `auth`; pause owner work; no new authentication scheme. |
| E accepted replay | Original accepted response; no error code/category | 200 | Validate matching acknowledgement; normal owner/lease-fenced acknowledgement. |

Category B means the stored data/output cannot be fixed by repeating the same computation; operator intervention is required. It **does not** mean a permanent mobile 4xx failure. Server faults must not park valid queued work as client-invalid or remove it. Backoff/retry is not evidence that corrupt state may be regenerated. Preserve the payload; do not acknowledge it. A known valid frozen historical identity unsupported only by this deployment is category C `D11_ENGINE_UNAVAILABLE`; an unknown/contradictory identity in persisted data is category B. Do not label temporary deployment incompatibility as corrupted history.

Network/timeouts and rate limiting keep existing transient semantics (408/429 where applicable). Never use 403 for an unassigned item, 409 for a database serialization retry, or 422 for unavailable assignment/configuration. Error responses roll back accepted evidence; generic unexpected server failures remain 5xx. This taxonomy does not authorize changing existing D1-D9 auth, queue or research logging contracts.

## 19. Development / Legacy Compatibility

**LOCKED:** keep `development/dev-0.1` only behind an explicit backend development/test routing decision, separate from formal assignment. This can use existing endpoints with server-side account/environment authority; a client-supplied scheduler is never authoritative. Formal routing must not call `scheduler or DevelopmentScheduler()` or equivalent implicit defaults. Engine injection is test-only and must not bypass assignment in production.

Accepted historical development UUIDs return original results before all D11-only checks, even if they have legacy provenance/state shape or old timestamps. Do not retrofit research envelopes/configs/assignment FKs onto old rows. Development 600-second Incorrect schedules remain valid history; new research whole-day constraints are conditional on research types.

Development current schedules and D10 evidence remain immutable. Unaccepted queued development work can use the explicit development authority for isolated development accounts; it cannot seed a newly enrolled formal condition. Clean enrollment and freeze-before-work prevent ambiguity without adding a client condition field or rewriting offline payloads. Block conflicting enrollment rather than making assignment depend on application version or sync arrival time.

**LOCKED:** new research chronology/same-session constraints do not change the D7 development regression that later acceptance may supersede a backdated interaction. Preserve D1-D9 contracts, D8 timing meaning, D10 timer ownership, canonical logging, owner isolation and original queue bytes.

## 20. Database Contract for Future D11B

**BLOCKER BEFORE RESEARCH WRITES:** `backend/app/reviews/models.py::ReviewSchedule.interval_seconds` must change from INTEGER to **BIGINT** in a new forward migration. `36500 * 86400 = 3,153,600,000`, beyond signed INTEGER. Both research types use this technical maximum. Do not lower the cap to avoid migration, edit old migrations, or narrow while large values exist.

Keep the JSON state column; strict validation/version dispatch supplies schema discipline. No dedicated FSRS memory table, due/last-review duplicate columns, JSONB conversion, or state-at-eligibility insertion is required. Generic `interval_days` is derived/internal; SM-2 retains it in its memory.

Future additive persistence must supply immutable configuration documents/digests, protocol/set/membership, eligibility/allocation/condition binding and nullable legacy-compatible attempt assignment reference. Require owner-scoped referential integrity and exact released membership for new D11 attempts. A foreign key alone does not prove every cross-table identity: service validation must verify attempt/schedule owner/item, set/revision/release, config and protocol consistency. Same-session research uniqueness is serialized under the user lock, with a scoped database backstop considered during D11B schema review; never add blanket legacy uniqueness.

Conditional checks can enforce positive whole-day intervals/bounds and required D11 assignment binding without invalidating `development/dev-0.1`. Preserve existing unique attempt/ledger constraints, owner/item pointer FK and D9 immutable history guards. The canonical research event payload remains `{"scope":"item_attempt"}` and schema `review-events-1`; assignment is reconstructed through the immutable attempt link, not duplicated into event JSON.

Before migration, test an isolated clone, inventory guards/constraints, plan the lock/rewrite maintenance window and capture historical value digests. Verify pre/post historical identity and unchanged D9 rejection of UPDATE/DELETE/TRUNCATE. Assignment/config immutability needs analogous future guards. A deployment rollback disables new research routing while retaining evidence, decoders and BIGINT; it must not restore an unlocked/default-dev writer for enrolled participants. No database is modified or contacted by this specification.

## 21. Acceptance-Test Oracles

**LOCKED — Future tests, not tests executed during D11A.** For each accepted event, assert exactly one attempt, one schedule, one ledger, the expected current pointer, one assignment binding and exactly the canonical event pair. For each rejected transaction, compare all those counts, pointer ID and historical digests to the before snapshot: zero accepted change. A preflight session is the documented exception.

SM-2 exact sequential fixtures, each with a fresh strictly later interaction instant:

| Input / prior history | New repetitions | EF | Interval days | Lapses |
| --- | --- | --- | --- | --- |
| First Correct | 1 | 2.5 | 1 | 0 |
| Second Correct | 2 | 2.5 | 6 | 0 |
| Third Correct | 3 | 2.5 | 15 | 0 |
| Fourth Correct | 4 | 2.5 | 38 | 0 |
| Incorrect from EF 2.5, any valid repetition | 0 | 2.18 | 1 | previous + 1 |
| Second consecutive Incorrect from initial EF 2.5 | 0 | 1.86 | 1 | 2 |
| Third consecutive Incorrect | 0 | 1.54 | 1 | 3 |
| Fourth and further consecutive Incorrect | 0 | 1.3 | 1 | increment each time |
| Correct immediately after first lapse | 1 | 2.18 | 1 | unchanged |
| Following Correct after that | 2 | 2.18 | 6 | unchanged |
| Following Correct after that | 3 | 2.18 | 14 | unchanged |

Verify cap saturation at 36,500, exact decimal ceiling, invalid counters/bools/floats, EF floor and lapse-linked reachability, interval/state consistency, copy isolation, deterministic repeated calls and no input mutation. The 38-day fourth initial Correct specifically proves ceiling of 37.5. A first Incorrect is valid accepted repetition 0/lapse 1; initial zero/zero is not.

**DEFERRED — FSRS numeric goldens:** after authorized installation of exactly `fsrs==6.3.2`, independently capture/review full-precision stability/difficulty, interval days, due, Review/null-step and last-review for: initial Good; initial Again; repeated Good at defined elapsed gaps; Good->Again->Good; repeated Again; same-day later instants; just below/at/above 86,400-second elapsed boundaries; overdue gaps; maximum cap; and JSON round-trip reconstruction. Record exact initial UTC instants/gaps, input states, parameter vector/config digest, Python/library version and outputs in fixtures. Repeat independently with fuzzing disabled and compare uninterrupted versus serialized/reconstructed transitions. Verify explicit Card defaults are never used and stable server Card identity accepts the chosen pair encoding. Do not populate fixtures with guessed outputs. Goldens are an implementation/activation gate, not an unresolved numerical choice for D11A.

Shared acceptance matrix:

| Oracle | Required assertion |
| --- | --- |
| Excluded features | Vary response time, interruption evidence, instructional difficulty, pronunciation and transport delay with identical scheduler facts; result/state/due unchanged. Attempt timing evidence remains captured unchanged. These fields never reach the adapter or FSRS duration argument. |
| Time anchor | Use a delayed server receipt and non-UTC aware input; due equals normalized original interaction + N*86400, including DST/calendar boundaries; no receipt-time addition. |
| Prior pair | Both absent is first only after no-history proof; one absent, mismatched linked attempt, dangling pointer or history without pointer fails closed. |
| Replay | After later transitions and with routing/assignment/engine service unavailable, replay original owner/event returns its original state/result, zero engine entries and zero pointer/history changes. Same UUID under another owner cannot retrieve it. |
| Duplicate concurrency | Two same-owner/event requests on separate PostgreSQL connections: loser waits, rechecks ledger, returns winner; total one engine entry for the committed acceptance and one complete chain. |
| Distinct concurrency | Barriers before user-lock acquisition; state read occurs after lock. Increasing timestamps in lock order transition successively. Reverse order makes the older loser stale. No two accepted outcomes derive from one stale predecessor. Include absent-pointer first-review race and two different items for one learner. |
| Stale/equal | Distinct UUID at <= prior instant returns 409 and zero accepted evidence; no repair or new initial state. Accepted same UUID still replays. |
| New time validation | Naive input 422; configured future-limit equality accepted if other rules pass; greater-than rejected; missing formal policy 503, zero engine entries. No tolerance invented in formal fixtures. |
| Identity/state corruption | Unknown schema/config binding, dev predecessor under research assignment, nonfinite/out-of-range memory, wrong owner/item/version and output inconsistency cause zero partial evidence. Supported-but-unavailable deployment returns 503. |
| Session | Independently created session may survive rejection; no commit after learner lock except final acceptance. Duplicate UUID replays before same-session guard; distinct repeated formal session/item returns 409 without calculation. |
| Atomic rollback | Inject failure after each staged M-R step, including ledger uniqueness and event creation; rollback restores pointer and all accepted counts; retry unchanged UUID either returns winner or performs one fresh unaccepted transition. |
| Numeric/storage | Both engines' 36,500-day result stores/returns 3,153,600,000 in BIGINT and mobile safe integer; invalid/nonpositive/overflow results fail before inserts. |
| Assignment | Both 15/15 mappings correct; independent period order does not change condition; wrong release/set rejected; missing service 503; contradictory record 500; attempt binding owner/set/config exact. Test allocations excluded from formal counts. |
| Enrollment/isolation | A/B logical intersection rejected; incompatible history, pending dev queue or unverified queue clearance blocks enrollment; concurrent development acceptance cannot race past clean checks. No D10 account conversion. |
| Error/queue compatibility | Actual mobile classifier sees A as permanent, B/C as transient, D as auth. 503/500 and lost acknowledgement never delete or reserialize payload; matching successful owner/lease acknowledgement alone permits deletion. |
| Versions/history | Persist exact identities/envelope/digests; config tamper detected; old development rows/current pointers/ledger/events and original payload bytes remain unchanged through migration and replay. |
| Regression | Existing D1-D10 relevant backend/mobile suites, type/lint gates, migration preservation, real PostgreSQL concurrency and native offline/restart/reconnect checks pass. No physical-device result is inferred from emulator success. |

## 22. Formal Research Activation Gates

**LOCKED — Implementation readiness:** this specification can be reviewed now. After approval and a separately reviewed implementation plan, D11B scaffolding and controlled pure-engine/test-assignment work can proceed while formal routing stays disabled. Deferred study choices do not prevent building the defined interfaces with explicit isolated fixtures. They do prevent formal acceptance. No implementation is authorized by writing this document.

**BLOCKER — Formal research readiness requires every gate below:**

- Approved exact Set A and Set B membership, disjoint logical IDs, equivalent content/activities/assessment approval, and immutable research releases/revisions.
- Frozen protocol identity/version, approved eligibility, exact 30-person coded cohort and audited 15/15 allocation procedure/provenance.
- Separately frozen chronological period-order procedure, stored order, and assignment-freeze timing; no implicit equivalence between group and period.
- Adviser/device-pilot-approved numeric future-clock-skew limit and frozen clock-policy identity.
- Clean dedicated formal accounts and documented device-queue clearance, with no incompatible formal-item history/development state.
- Immutable algorithm/config/state identities and independently reproduced configuration digests, no optimizer/retraining, pinned `fsrs==6.3.2` runtime verification and approved golden fixtures.
- BIGINT plus assignment/config/provenance migrations applied and verified; strict schemas, same learner-lock discipline on every writer, assignment authority and explicit development isolation deployed. No mixed legacy writers.
- Full regression/atomicity/replay/concurrency/native-offline gates, complete research build/readiness verification including outstanding physical-device requirements, and independent review/freeze approval.

The adviser build may exercise controlled **test** assignments with isolated accounts/data and an explicit test policy. This does not activate formal enrollment, turn test participants into the formal cohort, mark D10/D11 overall PASS, execute B04, or authorize Plan E/F.

## 23. Chapter 3 Alignment Checklist

**DEFERRED — Checklist only; manuscript unchanged:**

- Name the comparator Binary SM-2 adaptation, q4/q2, EF update on every answer, lapse reset and fixed bounds.
- Name enhanced ESR binary FSRS-6, Good/Again, pinned engine and frozen configuration.
- Describe response time/interruption evidence as logged research facts; response time is analyzed, not a scheduler input.
- Distinguish FSRS memory Difficulty from instructional difficulty; keep pronunciation separate.
- State frozen parameters/configurations and no global retraining during study, while learner/item memory evolves.
- Describe authoritative counterbalanced assignment, 15/15 mappings, independent period order and disjoint equivalent sets.

## 24. Deferred Decisions

| Deferred item | Boundary / consequence |
| --- | --- |
| Exact approved vocabulary membership/equivalence and releases | Researcher/adviser content approval; cannot invent words or designate development sample sets. Blocks formal activation. |
| Formal protocol/version value, eligibility evidence and assignment freeze procedure/timing | Provisioning authority; identity fields are locked here but actual approved values are not fabricated. Blocks formal activation. |
| Exact 15/15 allocation procedure and chronological period-order procedure | Separate study decisions, not engine randomization. Blocks formal activation. |
| Numeric future-skew tolerance and clock-policy version | Adviser/device pilot; hook is fixed in section 10. Blocks formal activation. |
| FSRS runtime numerical goldens / target-runtime confirmation | After authorized pin installation in D11D; no guessed numbers or source-only PASS. Blocks enhanced production acceptance. |
| Physical names/DDL, migration mechanics and administrative provisioning UI | D11B/later design within these locked semantics; no schema or UI implemented here. |

Not deferred: exact scheduler/config labels, both binary mappings, EF-on-Incorrect behavior, shared bounds, envelope/memory fields, pure input/output, strict chronology, user-lock scope, preflight session boundary, error mapping, disjoint logical item policy and clean cohort. There is no remaining undefined engine formula or storage-identity decision needed to start the next approved implementation design.

## 25. Implementation Handoff

**LOCKED — Future work sequence; no execution during D11A:**

1. Obtain specification review approval and a separate implementation plan. Resolve any review changes in the specification before coding.
2. **D11B:** implement additive BIGINT/immutable authority provenance scaffolding, strict result/state registry/validators, explicit development routing and serialized acceptance boundaries in `reviews/service.py`; preserve shared online/sync path and D9 logging. Keep formal gate closed. Prove migration history preservation, replay, rollback and PostgreSQL races before enabling any research writes.
3. **D11C:** implement pure Binary SM-2 adaptation and exact-decimal fixtures from sections 7/21; use explicit isolated assignments, never default research selection.
4. **D11D:** add the authorized `fsrs==6.3.2` manifest/lock change, explicit adapter/configuration and approved runtime goldens, round-trip and boundary tests. No optimizer extras.
5. **D11E:** implement/prove backend enrollment/allocation/protocol authority and integrated assigned acceptance; freeze the actual study procedures/content before formal use.
6. **D11F:** complete independent review, regression, migration/deployment, real-device/native offline verification and research freeze gates. Only separately approved activation can open formal routing.

Preserve mobile `useReviewTiming.ts`, `timing.ts`, `metadata.ts`, `payload.ts`, queue ownership/leases/payload immutability, and current request shape. `reviews/eligibility.py` may later enforce assignment/support before offering work but remains a non-reserving backend-time read; a changed current eligibility listing alone cannot invalidate originally captured offline provenance. Do not persist state at eligibility or rewrite accepted history to match a new engine.

## 26. Final Recommendation

**D11A READY FOR SPEC REVIEW**

The application-owned contracts, state/config identities, clean enrollment boundary, serialization/transaction sequence, chronology/replay semantics and failure mappings are specified. Formal research is **not ready**: section 22 gates remain closed. Implementation awaits specification approval and its separate plan; no engine, assignment, migration, dependency or manuscript work is performed here.

Only this untracked specification is created for D11A. The existing D11 audit and D10 timing review bundle are preserved byte-for-byte; application source and all tracked files remain unchanged. No commit, push, database operation, review session execution, B04, or Plan E/F is part of this milestone.
