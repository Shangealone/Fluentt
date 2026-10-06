# FLUENTT Research Implementation Specification v1

## 1. Purpose and Status

**Project:** FLUENTT: An Adaptive Language Learning System with Enhanced Spaced Repetition and NLP-Driven Pronunciation Modeling
**Milestone:** Plan D — Research Readiness & Pipeline Hardening; D1 only
**Specification version:** 1
**Prepared:** 2026-10-06
**Inspected foundation commit:** `e30ce31811cce0fa8c89faf94c9326dab7bf4410`

This document converts the research decisions supplied for D1 into a technical implementation contract. It distinguishes the locked study design from requirements derived from it and research decisions still awaiting approval. Locked design does not mean that the final algorithms, assessment schedule, instruments, or provider configurations have been finalized.

The authoritative source for the locked requirements is the researcher-supplied D1 request. This contract governs the later research work where the earlier v0.1 foundation specification intentionally deferred it. D1 does not implement or authorize subsequent milestones.

### Status vocabulary and normative language

- **LOCKED RESEARCH DECISION:** An authoritative decision supplied for D1.
- **CURRENT STATE:** Behavior verified by source inspection at the commit above.
- **REQUIRED STATE:** A future implementation obligation; its presence here does not claim it exists.
- **FUTURE / UNRESOLVED:** A decision that developers MUST NOT invent or silently resolve.
- **MUST / MUST NOT:** Mandatory requirements.
- **SHOULD:** Recommended implementation practice; any departure should be justified and recorded.

Implementation representations and descriptive identifiers in this document are conceptual contracts, not prescribed database columns, new endpoints, parameter values, or finalized algorithms.

### D1 scope and baseline

D1 creates this documentation file only. Application code, migrations, tests, manifests, lockfiles, and dependencies MUST remain unchanged. D1 MUST NOT implement ESR, Conventional SRS, experimental assignment, pronunciation, or NLP.

The researcher reports that the restored clean-machine baseline passes 50 backend tests, backend Ruff, 88 mobile tests, TypeScript, and ESLint, with Python 3.13, uv, Docker PostgreSQL, Node 22, and pnpm working. These results were supplied as baseline evidence; D1 did not rerun the suites or claim a new runtime verification. Git was clean before drafting.

The architecture remains React Native/Expo/TypeScript with Expo Router, FastAPI/Python, authoritative PostgreSQL, limited SQLite offline persistence, and SecureStore authentication tokens. Backend authority and this storage separation MUST be preserved.

## 2. Research Design Contract

### LOCKED RESEARCH DECISIONS

- The study includes **exactly 30 Filipino English learners from NE Learning Inc.**, at approximately pre-intermediate proficiency.
- Participants use their own mobile devices.
- Evaluation is primarily online/remote.
- Participation lasts approximately **1–2 weeks**, with approximately **30 minutes daily**.
- ESR is evaluated using a **controlled, counterbalanced within-subject experimental design**.
- Every learner experiences **both FLUENTT Enhanced Spaced Repetition (ESR) and Conventional Spaced Repetition (SRS)**.
- Two equivalent conversational vocabulary sets, **Set A** and **Set B**, are used.
- Fifteen learners receive Set A with ESR and Set B with Conventional SRS; the other fifteen receive the opposite mapping.
- The primary ESR outcome is **delayed vocabulary retention**.
- Secondary measures may include immediate post-test performance, recall accuracy, learner response time, and review-interaction logs.
- Pronunciation evaluation is separate from the ESR-versus-SRS experiment. Software quality/usability evaluation is also separate.

### REQUIRED STATE

The system MUST preserve both condition exposures for each participant. It MUST NOT model the experiment as one ESR-only group of 15 versus one SRS-only group of 15.

Both conditions MUST use the same application, instructional presentation, equivalent learning content, activities, study duration, and assessment procedures. The principal experimental difference MUST be the scheduling method. Any research-affecting deviation requires explicit methodological approval.

Review logs MUST NOT be treated as a substitute for the delayed-retention assessment. The data model and later analysis workflow MUST distinguish practice interactions, immediate assessments where approved, and delayed assessments. Pronunciation and software-quality outcomes MUST remain distinguishable from ESR outcomes.

### FUTURE / UNRESOLVED

Exact assessment timing, delayed-test interval, administration, scoring, approved secondary measures, and operational participation windows remain to be finalized. The approximate duration and daily time MUST NOT be converted into invented deadlines or exclusion thresholds. The supplied counterbalancing mappings do not establish chronological condition order, study periods, or a washout interval; developers MUST NOT infer those.

## 3. Participant and Assignment Model

### LOCKED RESEARCH DECISIONS

Age MUST be verified before enrollment. Adult informed consent applies where appropriate. For minors, applicable guardian consent and learner assent procedures apply. Eligibility MUST be established before random assignment.

| Counterbalancing sequence | Learners | Vocabulary Set A | Vocabulary Set B |
|---|---:|---|---|
| Sequence 1 | 15 | FLUENTT ESR | Conventional SRS |
| Sequence 2 | 15 | Conventional SRS | FLUENTT ESR |

Sequence 1 and Sequence 2 are descriptive labels for these set-to-condition mappings, not temporal crossover schedules.

### CURRENT STATE

`users` stores a unique coded `participant_code` and an internal account UUID. `learner_profiles` stores interface and target learning languages. There are no enrollment, age-verification, consent, condition-assignment, vocabulary-set, or counterbalancing records.

`GET /users/me` currently returns the learner-profile UUID as `id`; mobile stores that value as its auth-user ID. It is not the `users.id` used by backend review ownership. This ambiguity MUST be resolved before queue ownership relies on it.

### REQUIRED STATE

- Enrollment MUST establish the approved eligibility, age-verification, and applicable consent/assent status before assignment or formal data collection.
- The assignment procedure MUST randomly allocate eligible participants while satisfying the locked 15/15 balance.
- Assignment records MUST identify the coded participant, authoritative account linkage, sequence, set-to-condition mappings, and assignment/protocol version. They SHOULD retain the procedure/version and audit evidence sufficient to reconstruct the allocation.
- The assignment realization MUST be preserved and included in the research freeze. It MUST NOT be silently regenerated during login, reinstall, import, or synchronization.
- Client queue ownership MUST resolve to an authenticated account identity that the backend can verify. A client-supplied participant code alone MUST NOT authorize ownership.
- Enrollment evidence and direct identity mapping MUST be separated from analytical event payloads, with only necessary coded references exposed.

### FUTURE / UNRESOLVED

The precise proficiency eligibility procedure, age-verification procedure, consent/assent instruments, balanced-randomization procedure, withdrawal/missing-data/replacement rules, and any chronological exposure sequence need approval. D1 defines no age threshold, screening cutoff, enrollment form, replacement policy, or allocation algorithm.

## 4. Experimental Conditions

### CURRENT STATE

Only `DevelopmentScheduler` exists. No ESR, Conventional SRS, condition registry, or assignment-driven selector exists. Current correctness is a learner's binary self-assessment after answer reveal; it is not an implemented research assessment rubric.

### REQUIRED STATE

- Both research schedulers MUST be selected explicitly by the backend from the participant's approved assignment and the immutable vocabulary-set reference.
- Scheduler algorithm version and configuration/version reference MUST remain distinguishable and reconstructable for every accepted attempt.
- Prior review state/history used by an algorithm MUST belong to the correct participant, item, condition, and relevant version. State MUST NOT silently leak between conditions or scheduler versions.
- Both conditions MUST share the approved task and assessment semantics. Differences outside scheduling MUST be documented and approved.
- A formal research attempt MUST NOT silently fall back to `development` when assignment, configuration, or a required scheduler is unavailable.
- Development records MUST remain identifiable and separable from formal research records.

### FUTURE / UNRESOLVED

The final ESR method, Conventional SRS interval rules, correctness/rating mappings, configuration schema, and algorithm-specific state are not locked. No equations, parameters, thresholds, or baseline intervals are supplied by this document.

## 5. Content and Versioning Requirements

### CURRENT STATE

`languages`, `lessons`, and `vocabulary_items` provide stable identifiers and content-version strings. `import_content_data` updates existing lesson and item rows in place when their UUIDs match. Current review attempts reference vocabulary UUIDs without a content snapshot or immutable content-version reference.

The default lesson feed chooses the content version from the most recently created active lesson for the language. Mobile caches rows by identifier; cached lesson-detail retrieval does not constrain vocabulary to the lesson's content version. These mechanisms do not establish immutable research provenance.

There is no vocabulary-set assignment or equivalence-validation mechanism.

### REQUIRED STATE

- Set A and Set B MUST be equivalent conversational vocabulary sets under the approved research procedure.
- Set identity, set version, item membership, and exact item/content version MUST be reconstructable for each research attempt.
- Provenance MUST preserve the actual material presented, including relevant prompt, definition, example, translation, and approved content attributes.
- Historical reconstruction MUST NOT depend solely on the current mutable vocabulary row. Immutable versioned references or preserved snapshots with verifiable reconstruction MAY satisfy this obligation; D5 must choose and document the implementation.
- Later imports MUST NOT silently change the meaning of historical records or frozen set membership.
- Online retrieval, offline caches, and acceptance validation MUST preserve the assigned, frozen content version. Stale or incompatible content MUST be handled explicitly without invented provenance.
- Content references SHOULD have verifiable integrity evidence suitable for the approved freeze.

### FUTURE / UNRESOLVED

Exact set sizes, item selection, equivalence evidence, and validation procedure remain unspecified. D1 does not declare the sample English/Filipino datasets to be the final experimental sets.

## 6. Review Event Data Contract

### CURRENT STATE: acceptance and response

`POST /reviews/attempts` and `POST /sync/review-events` share `record_review_attempt`. Authentication resolves the user; schema validation handles identifiers and timing; the service checks for a previously accepted user/event UUID, validates an active item, resolves a user-owned session, invokes the scheduler, and persists the accepted result.

A new attempt transaction writes `ReviewAttempt`, `ReviewSchedule`, `AcceptedClientEvent`, `REVIEW_ANSWERED`, and `REVIEW_COMPLETED`. Session creation can commit separately. Database uniqueness on `(user_id, client_event_id)` and conflict recovery support duplicate-safe replay.

The backend response is flat: `id`, `client_event_id`, `session_id`, `vocabulary_item_id`, `correct`, `response_time_ms`, `scheduler_type`, `algorithm_version`, `next_interval_seconds`, `next_due_at`, `server_acceptance_at`, and `scheduler_state`.

Mobile types instead describe a possible nested schedule with `interval_minutes`, `due_date`, and `repetition_number`. Mobile session types expect user/lesson/start/end fields absent from the backend session response, which contains `id`, `client_session_id`, and `created_at`. The screen sends its server-session reference as both session identifiers, leaving the original generated client-session UUID unused after online creation.

### REQUIRED STATE: logical record obligations

The following information MUST be preserved as applicable across the accepted attempt and its immutable linked records. It need not be duplicated in every event payload.

| Information | Contract |
|---|---|
| Participant/account | Coded participant reference with verifiable authoritative account linkage |
| Assignment | Frozen sequence and set-to-condition assignment reference |
| Vocabulary | Stable item identifier, exact content version, set identity/version |
| Condition | Explicit ESR or Conventional SRS condition |
| Scheduler | Type, algorithm version, configuration/version reference |
| Review identity | Stable client event UUID, distinct client session identity, reconciled server session identity, accepted attempt ID |
| Interaction | Explicit approved correctness/answer facts and learner duration in milliseconds |
| Prior review information | Immutable input/state/history references required by the finalized scheduler |
| Scheduling result | Calculated interval with explicit units, resulting due time, relevant resulting state |
| Timestamps | Original client interaction timestamp and separate server acceptance timestamp |
| Device/build | Accurate platform, app/build identity, and only additional metadata approved by the protocol |
| Validity/provenance | Relevant interruption, missing-data, or compatibility indicators and logging-schema reference |

- D6 MUST reconcile mobile types, wire contracts, backend schemas, fixtures, and units without inventing research algorithms.
- A retry MUST retain the same event identity and original facts. Distinct genuine interactions MUST receive distinct UUIDs, even for the same item.
- Acceptance MUST use the authenticated owner and verify assignment/content consistency; it MUST NOT trust arbitrary client-selected conditions or schedulers.
- Research acceptance MUST NOT fabricate correctness, original timestamps, platform, versions, or assignment from compatibility defaults. Missing or incompatible data require explicit validation or an approved, traceable handling policy.
- An acknowledged attempt, its scheduling result, idempotency record, and research records MUST remain mutually consistent. Retry or lost acknowledgement MUST NOT duplicate them.

Current `0–3,600,000 ms` timing validation is a software sanity bound. It MUST NOT become an unapproved methodological exclusion rule. Current legacy normalization defaults omitted correctness to true and metadata to Android/`v0.1`; it is not sufficient evidence of research validity.

## 7. Response-Time Semantics

### LOCKED RESEARCH DECISION

Research response time represents learner interaction duration. It MUST NOT include or be redefined as API/network latency, synchronization delay, or backend processing latency.

### CURRENT STATE

The mobile clock uses `performance.now()` with a non-decreasing `Date.now()` fallback. Timing starts when the screen prepares the item and ends when Correct/Incorrect is committed after reveal, before the attempt request. It is rounded to integer milliseconds. Original wall-clock time is separately captured with `new Date().toISOString()`.

Timing is not tied to confirmed visible/interactable rendering, and there is no background/interruption handling. The current duration includes reveal and self-assessment behavior; it is not proof of a finalized recall-latency definition.

### REQUIRED STATE

- D8 MUST tie timer boundaries to the approved task definition and actual prompt visibility/interactability and final answer commitment.
- Duration MUST be measured locally using a validated elapsed-time source. Monotonic values MUST NOT be treated as cross-device wall-clock timestamps.
- Learner duration, request latency, sync delay, and backend processing duration MUST remain separately named and interpretable if collected.
- Backgrounding, focus loss, screen locking, interruption, navigation away, and process termination MUST NOT silently produce apparently valid uninterrupted response times.
- The implementation MUST preserve interruption/validity evidence needed by the approved policy. It MUST NOT silently subtract time, reset the timer, impute a duration, or exclude an attempt without that policy.
- Timestamp representation, clock-skew handling, and fallback timing behavior MUST be documented and validated. Original interaction timestamps MUST survive replay.

### FUTURE / UNRESOLVED

Precise recall/reveal/commit boundaries, interruption treatment, pause/resume rules, permissible clock behavior, and analytical exclusions require approval. Developers MUST NOT invent timing thresholds or use synchronization time to repair a missing interaction time.

## 8. Offline and Synchronization Invariants

### CURRENT STATE

SQLite `pending_review_events` contains:

`client_event_id`, `payload_json`, `status` (`pending`, `syncing`, `failed`), `attempt_count`, `last_error`, `created_at`, and `updated_at`.

Queue serialization retains only `client_event_id`, `session_id`, `vocabulary_item_id`, `response_time_ms`, `correct`, optional `submitted_answer`, and `created_at`. It drops the original client-session ID, explicit interaction timestamp, platform, and app version. Backend compatibility normalization reconstructs omitted fields from aliases/defaults.

There is no queue owner field or account partition. Logout retains queued events. The worker submits with the current authentication token, reads only `pending` rows, marks batches of 50 as `syncing`, and removes acknowledged events. Authentication errors pause draining; other request exceptions restore pending state without distinguishing permanent validation failure.

Automatic drain is triggered by an observed offline-to-online transition after a health probe, plus manual Sync Now. No explicit startup/login drain or recovery of stranded `syncing`/`failed` rows exists. Backend events commit individually; a later invalid event can abort the batch response after earlier acceptance.

SQLite initialization failures fall back to memory. Jest uses the in-memory adapter, and the current simulated reopen test retains its singleton; this does not prove real process-restart durability.

### REQUIRED STATE

| Invariant | Required behavior |
|---|---|
| Stable identity | Generate the UUID before durable capture; preserve it through every retry and recovery |
| Owner isolation | Bind entries to the creating account/participant; drain only for that authenticated owner |
| Account switching | Retain and isolate unsent events; never submit them with another participant's credentials |
| Metadata preservation | Preserve original session, interaction time, assigned provenance, and approved device/build metadata |
| Durability | Report an event saved only after durable persistence; do not substitute volatile memory silently |
| Crash recovery | Recover valid interrupted entries without permanent stranding or duplicate acceptance |
| Acknowledgement | Remove/complete local entries only after reconcilable authoritative acceptance for the correct owner/event |
| Retry classification | Separate transient network/server failures, authentication/authorization pauses, and non-retryable validation failures |
| Batch behavior | Reconcile partial acceptance; one invalid event must not permanently block unrelated valid events |
| Lifecycle | Define authenticated startup, successful login, resume, reconnect, backend recovery, and manual retry behavior |
| Original time | Preserve interaction time; sync/queue bookkeeping times must remain distinct |

Authentication failure requires reauthentication or explicit authorization resolution, not blind transport retry or event deletion. Reauthentication MUST NOT change event ownership. Non-retryable invalid events MUST remain traceable under an approved correction/exclusion policy.

The future queue SHOULD expose understandable pending, paused, and failed states without revealing secrets. Retry bookkeeping MUST NOT mutate original research facts. Secrets MUST remain in SecureStore and MUST NOT enter SQLite or research payloads.

D2–D4 must specify implementation details and verify ownership, recovery, and lossless serialization. D1 does not prescribe state names, migration fields, backoff values, or destructive queue cleanup.

## 9. Scheduler Authority and Due-Review Semantics

### CURRENT STATE

`DevelopmentScheduler` defines:

| Property | Value |
|---|---|
| Scheduler type | `development` |
| Algorithm version | `dev-0.1` |
| Correct interval | 86,400 seconds |
| Incorrect interval | 600 seconds |
| Due calculation | Client interaction timestamp plus the selected interval |

It ignores response time and difficulty. The context has correctness, duration, difficulty, and interaction timestamp; no prior state/history or participant/item identity is passed. The service defaults to this scheduler.

Each accepted attempt appends a schedule row. No current-schedule resolver or due-review endpoint is implemented. The mobile review screen loads all active vocabulary in a lesson regardless of due time and does not use the returned schedule for selection.

### REQUIRED STATE

- The backend MUST remain authoritative for research scheduler selection, state transitions, calculated intervals, and due-review eligibility.
- `development/dev-0.1` MUST remain a foundation-validation scheduler and MUST NOT be used as the formal ESR or SRS implementation.
- The selected frozen scheduler/configuration MUST follow the approved participant/set assignment.
- Calculated `due_at` MUST govern backend due-review eligibility. Merely storing it is insufficient.
- D7 MUST define authoritative current scheduling state and preserve historical schedule results. Item/condition histories and reassignment/version transitions MUST be explicit.
- The system MUST document deterministic handling of late offline events, concurrent submissions, duplicates, and differing interaction/acceptance order.
- Mobile MUST NOT invent authoritative due times or silently override a server result. Offline presentation and later reconciliation MUST follow a documented protocol.
- Temporal reference points, new-item eligibility, early reviews, overdue reviews, and assessment exceptions MUST be explicitly approved before they affect formal exposure.

### FUTURE / UNRESOLVED

ESR/baseline calculations and research-specific eligibility rules remain unresolved. The temporary scheduler's client-time anchoring MUST NOT be assumed to define the final algorithms. D7 provides infrastructure; it does not settle the final research rules.

## 10. Research Logging and Privacy

### CURRENT STATE

`ResearchEvent` is separate from operational logs. A new accepted attempt emits:

| Event | Current payload |
|---|---|
| `REVIEW_ANSWERED` | Client event ID, participant code, vocabulary ID, correctness, duration, platform, app version, interaction time, acceptance time |
| `REVIEW_COMPLETED` | Attempt ID, client event ID, scheduler type/version, interval seconds, due time |

The event row also contains a UUID, user ID, type, and server creation timestamp. Both events are committed with the attempt. `REVIEW_COMPLETED` is currently emitted per attempt, not as a distinct session-completion event.

These payloads omit explicit content/set/condition/configuration provenance and session references. Only these two event types are currently emitted. The sanitizer removes credential-like dictionary keys recursively through dictionaries, but does not explicitly filter email keys or traverse dictionaries nested inside lists. Current emitted payloads do not contain email or credentials.

The model is append-oriented by application convention; database immutability is not enforced. Foreign-key cascade deletion can remove research records or their supporting history when users/content are deleted.

### REQUIRED STATE

- Analytical records MUST use coded participant references; direct identifiers such as email MUST NOT be required inside analytical payloads.
- Collection MUST minimize unnecessary personally identifying information. Identity and enrollment/consent records MUST have a separate, controlled purpose.
- Credential/secret exclusion MUST cover nested supported payload structures. Sanitization MUST complement an explicit approved logging schema and metadata policy.
- Event names and scope MUST be unambiguous about item attempts, sessions, assessments, and synchronization.
- The accepted research record and linked provenance MUST reconstruct the review-event contract in section 6.
- Duplicate or offline replay MUST NOT create duplicate research attempts or duplicate acceptance events.
- Logging MUST NOT silently rewrite original facts. Corrections, exclusions, and authorized changes MUST preserve the auditability required by the approved protocol.
- D9 MUST reconcile research integrity with the approved retention, withdrawal, and deletion procedures. Account/content operations MUST NOT silently destroy required historical reconstruction.
- Operational errors MUST NOT be mistaken for research outcomes. Failed future AI calls MUST remain failed/pending/unavailable rather than fabricated scores.

### FUTURE / UNRESOLVED

Retention periods, withdrawal/deletion handling, access arrangements, exact event schema, approved extra device metadata, raw speech collection/retention, and any research export procedure require approval. D1 does not authorize collecting additional identifying or speech data.

## 11. Research Build Freeze

### REQUIRED STATE

Before formal participant data collection, freeze and record an identifiable research-build manifest containing:

| Freeze item | Required evidence |
|---|---|
| Application | Mobile and backend version/commit/build identity |
| Database | Applied schema migration revision |
| Learning material | Exact vocabulary/content/set versions and membership |
| Assignment | Participant counterbalancing realization and approved assignment procedure/version |
| Conventional SRS | Algorithm and configuration/version reference |
| ESR | Algorithm and configuration/version reference |
| Pronunciation | Model/provider/service version and configuration for the separate evaluation |
| NLP/conversation | Model/service version and evaluation configuration where applicable |
| Instruments | Consent/assent, eligibility, assessments, and approved questionnaire versions as applicable |
| Logging | Event/data-contract schema version |
| Dependencies/services | Relevant dependency, runtime, and external-service versions |

Each formal attempt MUST resolve to the applicable freeze. Applicable unresolved components block the corresponding formal evaluation; an unused component MUST be explicitly marked not applicable rather than falsely reported as configured.

The final optimized scheduler, if adopted, MUST be validated and frozen before participant evaluation. Research participants MUST NOT continuously retrain it during the formal experiment.

Research-affecting changes after freeze MUST be documented with their reason, affected versions/cohorts/data, and applicable regression/revalidation evidence before formal collection continues. Historical data MUST retain the original freeze reference. Necessary protocol approval MUST precede continuation; builds/configurations MUST NOT be silently mixed.

External services SHOULD use identifiable pinned versions where available. If a provider cannot maintain the required stability, its limitations and change-handling procedure require explicit approval.

## 12. Unresolved Research Decisions

These decisions MUST remain unresolved until supplied and approved by the research authority. Implementation convenience, common practice, or an AI-generated proposal does not establish methodology.

| Decision | Unresolved scope / prohibited invention |
|---|---|
| Final ESR | Equations, variables, parameters, thresholds, FSRS adaptations, binary-rating mappings, state requirements |
| Conventional SRS | Exact interval rules and configuration; common intervals are not authoritative |
| Historical datasets / FSRS optimization | Dataset selection, provenance, optimization pipeline, validation, and whether FSRS is adopted at all |
| Pronunciation | Model/provider, intelligibility/accuracy metric, validated rubric, scoring formula, A/B/C/D thresholds |
| NLP/conversation | Model/provider, tasks, evaluation configuration, and research role |
| Software-quality questionnaire | Exact source, scale, scoring, and validation procedure |
| Assessments | Delayed interval, immediate/delayed test procedures, scoring, equivalence and approved secondary measures |
| Enrollment and allocation operations | Operational eligibility/age/consent procedures, randomization method, temporal exposure order, withdrawal/missing-data rules |
| Research timing and offline eligibility | Timer boundaries, interruption/skew/exclusion policy, late-event ordering and approved exposure/assessment exceptions |
| Privacy and provenance operations | Retention/deletion/export policy, approved metadata, and raw speech handling |

A potential historical-review-dataset/FSRS parameter-optimization pipeline is **not** the definitive ESR implementation. It MUST NOT become one by implication. Any adopted optimization must be validated and frozen before evaluation, with no continuous participant-driven retraining.

Pronunciation evaluation targets **intelligibility/accuracy**, not elimination of Filipino accent. A/B/C/D are presentation categories only until an underlying validated metric/rubric is finalized. Developers MUST NOT assign thresholds or infer scores from those labels.

The selected software-quality proposal scope includes **functional suitability, performance efficiency, and usability**. It does not identify a questionnaire, scale, scoring method, or validation procedure. Formal administration MUST wait for those decisions.

Developers SHOULD record unresolved requirements and dependencies explicitly and request the necessary research decision before dependent implementation. They MUST NOT disguise guessed values as defaults or call development placeholders research-validated mechanisms.

## 13. Plan D Implementation Sequence

All rows below are **planned required state**, not implemented or authorized by D1. D1 stops after this document.

| Step | Scope | Completion evidence required |
|---|---|---|
| D2 — Offline Queue Ownership & Account Isolation | Bind queued events to the creator's participant/account and prevent cross-account submission | Queue isolation across logout/login/account switching, including definitive account identity |
| D3 — Sync Crash Recovery & Retry Semantics | Recover stranded syncing records; classify failures; establish startup/login/reconnect behavior | Termination/recovery, partial acknowledgement, validation/auth pauses, and retry evidence without data loss |
| D4 — Research Metadata Preservation | Preserve original sessions, interaction time, platform, app version, and approved metadata | Online/offline/replay serialization equivalence |
| D5 — Immutable Content / Condition Provenance | Reconstruct exact content, condition, assignment, and scheduler versions | Historical reconstruction after imports or later configuration changes |
| D6 — Mobile ↔ Backend Review Contract Alignment | Reconcile TypeScript, wire payloads, schemas, responses, and units | Shared contract evidence and representative integration checks without premature ESR |
| D7 — Due-Review / Current-Schedule Infrastructure | Introduce authoritative current state and due-review selection | Eligibility governed by due time, with explicit offline/concurrency semantics |
| D8 — Research Timing Hardening | Implement approved visibility/background/interruption timing | Automated and real-device evidence for correct duration/validity semantics |
| D9 — Research Logging & Data Integrity Hardening | Strengthen sanitizer, provenance, event meaning, retention/integrity | Schema/privacy/integrity verification and traceable correction/deletion behavior |
| D10 — Full Regression + Real-Device Verification | Verify the hardened foundation before experimental scheduler implementation | All backend/mobile tests, Ruff, TypeScript, ESLint, plus device termination/offline/reconnect/account-switch scenarios |

The sequence MUST preserve the existing foundation and idempotency guarantees. Each later task must resolve its technical design and approved research dependencies before implementation. D5 documents provenance requirements without authorizing experimental assignment in D1. D7 establishes infrastructure without inventing final scheduler rules.

D10 completion is a gate before moving to experimental scheduler implementation; it is not sufficient by itself to authorize formal participant collection. Frozen algorithms, instruments, assignment, and research-build approval remain separate gates.

## 14. Acceptance Criteria

### D1 documentation acceptance

- [ ] All 14 sections clearly distinguish locked decisions, inspected current behavior, required mechanisms, and unresolved research decisions.
- [ ] Exactly 30 learners, both conditions per learner, equivalent Set A/Set B, and the two randomized balanced 15-person mappings are captured without implying independent ESR-only/SRS-only groups.
- [ ] Eligibility, age verification, and applicable adult consent or guardian consent/learner assent precede enrollment/assignment as required.
- [ ] Controls, delayed retention as primary outcome, optional secondary measures, and separate pronunciation/software-quality evaluations are explicit.
- [ ] The complete review-data/provenance contract, timing distinction, offline ownership/recovery/idempotency invariants, and backend due-review authority are specified.
- [ ] No ESR equations, baseline intervals, FSRS decision, pronunciation rubric/thresholds, NLP provider, questionnaire scale, or unresolved assessment/interruption policy has been invented.
- [ ] The research freeze and documented regression/revalidation of later research-affecting changes are specified.
- [ ] D2–D10 are documented as future work; no unimplemented mechanism is claimed to exist.
- [ ] The only new/modified file is `docs/research/fluentt-research-implementation-spec-v1.md`; no code, migration, test, dependency, manifest, or lockfile change occurs.
- [ ] `git diff --check` and `git status --short` are shown after creation; the new untracked file receives a separate whitespace/content check because ordinary Git diff does not include it.
- [ ] No commit is made and D2 is not begun.

These checklist items define verification obligations; unchecked boxes do not mean D1 has implemented the future mechanisms.

### Future research-readiness acceptance

Before the affected formal evaluation, evidence MUST demonstrate:

1. Approved enrollment/consent and balanced random assignment, with every learner mapped to both conditions and the intended sets.
2. Accurate identity reconciliation and no cross-account submission of queued events.
3. Durable offline capture across actual process termination and recovery, including interrupted sync and lost acknowledgements.
4. One accepted attempt/result per owner/event UUID and distinct preservation of genuine repeated interactions.
5. Original interaction facts/metadata and exact historical content/assignment/scheduler reconstruction across online, offline, import, and replay paths.
6. Backend scheduler selection and current due-review eligibility governed by approved, versioned policies, with development records excluded from formal evaluation.
7. Correct mobile/backend contracts, explicit units, and no fabricated correctness, provenance, due times, or provider outcomes.
8. Validated local timing and approved interruption handling, separate from transport/sync/backend latency.
9. Approved assessments/instruments and separation of ESR, pronunciation, and software-quality outcomes.
10. Regression and real-device verification at D10, followed by separately approved and frozen experimental implementations and a recorded research build.

### Inspected source evidence and known conflicts

Paths below are repository-relative and refer to the inspected foundation commit.

| Contract area | Inspected source | Conflict or current limitation |
|---|---|---|
| Scheduler | `backend/app/scheduling/development.py`, `types.py`; `backend/app/reviews/service.py` | Development-only default; no assignment selection or prior-state context |
| Acceptance/idempotency | `backend/app/reviews/service.py`, `schemas.py`, `router.py`; `backend/app/sync/models.py`, `service.py` | User/event deduplication exists; assignment/version validation absent; legacy defaults and partial-batch acknowledgement need hardening |
| Queue | `mobile/src/offline/migrations.ts`, `reviewQueue.ts`, `syncWorker.ts`, `db.ts` | No owner, dropped metadata, stranded states, incomplete lifecycle/retry semantics, volatile fallback |
| Content | `backend/app/content/models.py`, `service.py`; `mobile/src/content/contentCache.ts` | Mutable import rows and no immutable attempt/set provenance |
| Review contract | `backend/app/reviews/schemas.py`; `mobile/src/reviews/types.ts`, `api.ts`; `mobile/app/(app)/review/[lessonId].tsx` | Session/response mismatch; original client-session UUID not consistently sent; hardcoded Android/`v0.1` versus Expo `1.0.0` |
| Timing/eligibility | `mobile/src/reviews/clock.ts`; review screen; `backend/app/reviews/models.py` | No visibility/background validity handling or due-controlled selection |
| Logging | `backend/app/research_logging/models.py`, `service.py`; review service | Missing frozen provenance, incomplete sanitizer traversal/privacy protection, cascade retention risks |
| Identity | `backend/app/users/router.py`, `models.py`; `mobile/src/auth/AuthProvider.tsx` | Profile/account UUID ambiguity; network failure during restoration clears tokens |
| Existing verification | `backend/tests/reviews/`, `backend/tests/sync/`; `mobile/src/offline/__tests__/reviewQueue.test.ts` | Foundation coverage exists; simulated reopen is not real process termination evidence |
| Schema | `backend/alembic/versions/` | Inspected migration head is `65b5e4087f54`; D1 makes no migration changes |

The conflicts above are implementation gaps against this contract, not new methodology decisions. This specification does not repair them or certify the foundation as ready for formal data collection.
