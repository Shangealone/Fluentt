# D9 — Research logging and data integrity

Authority: D1 sections 6, 10 and 11 and the approved D9 request. D3–D8 notes were inspected. D9 stops before D10, experimental scheduling and formal research collection.

## Audit and implementation plan

Pre-D9 research events are free-form JSON with no schema version or attempt FK. `REVIEW_ANSWERED` redundantly stores event/item/code/answer/duration/platform/version/timestamps. `REVIEW_COMPLETED` stores attempt/event/scheduler/result facts but represents an item rather than session completion. Its attempt link and the answered event's ledger resolution are implicit JSON references. These facts already exist on authoritative attempt/session/schedule/content/ledger records, except the answered payload's historical participant-code snapshot. Codes can be changed by ORM/SQL, even though provisioning/password reset/preferences APIs expose no code-edit operation. Legacy payload code must not be replaced with today's code.

The sanitizer recurses only through dictionaries, misses lists and several direct-identifier/credential keys. No research export endpoint or export script exists. Current progress queries aggregate attempts and do not export records. Repository scripts provision participants, reset passwords, or import content; none deletes accounts/history. Nevertheless ORM/SQL deletion of users or review sessions can cascade through attempts, schedules, ledger and events. SQL UPDATE/DELETE can rewrite/remove every accepted research row. D5 already guards immutable content and restricts deletion of its referenced logical records; D8 timing is retained on attempts but inherits their deletion risk. Current pointers are operational mutable state, distinct from immutable schedule history.

Plan, executed with deterministic tests before corresponding changes:

1. Add nullable event `schema_version` and `review_attempt_id`. New version `review-events-1` emits `REVIEW_ANSWERED` and `REVIEW_SCHEDULED`, both scope `item_attempt`. Typed payload contains only that scope; authoritative facts remain linked, not duplicated. Composite attempt/owner FK and current-schema uniqueness/check constraints prevent mismatched or duplicate current events. Legacy rows remain unchanged/null, with no guessed linkage/version.
2. Harden recursive JSON key sanitization, including dictionaries in nested lists; typed allowlists remain primary. Keep operational failures separate. Test transactional rollback, rejection/auth failures, replay and distinct accepted interactions.
3. Protect attempts, historical schedules, ledger and events against UPDATE/DELETE/TRUNCATE. Protect referenced session identity and make participant codes immutable after provisioning. Replace historical-chain cascades with RESTRICT. Keep current pointer transitions and auth/password/profile operations available. Preserve D5/D8 evidence. Explicit isolated test maintenance may disable guards using privileged DDL; no production reset/correction bypass is introduced.
4. Frozen D9 Alembic upgrade preserves all legacy rows and adds no inferred facts. Downgrade fails closed when established accepted evidence exists. Test actual PostgreSQL migration cycles and integrity operations. Preserve prior tests by using explicit isolated maintenance only where they deliberately fabricate historical states.
5. Run every requested verification command. Document reconstruction, privacy limits, exact blocked destructive operations, unresolved governance and D10/freeze obligations. No commit.

## Current event schema and meaning

New accepted item interactions emit exactly two events with `schema_version = "review-events-1"`:

| Event | Meaning | Typed payload |
| --- | --- | --- |
| `REVIEW_ANSWERED` | Backend accepted this item's final binary response and original interaction facts. | `{"scope":"item_attempt"}` |
| `REVIEW_SCHEDULED` | Backend persisted the historical scheduling result for that same accepted item attempt. | `{"scope":"item_attempt"}` |

Neither event claims that a review session, lesson, or study instrument has completed. No new `REVIEW_COMPLETED` event is emitted. Existing `REVIEW_COMPLETED` rows retain their original item-level meaning, original JSON and original name. Existing answered events also retain their pre-D9 semantics and payloads. Consumers must distinguish legacy rows from `review-events-1` records.

`research_events.review_attempt_id` is nullable only for legacy compatibility. A composite restrictive FK `(review_attempt_id, user_id)` references the attempt's `(id, user_id)` unique key. Current events therefore cannot point to another owner's attempt. A check constraint admits either both new columns null (legacy) or the exact current schema, a non-null attempt link, one of the two supported event types and the exact JSON payload. A unique constraint on `(review_attempt_id, event_type, schema_version)` prevents repeated current outcomes for one attempt/type/version. Null legacy links/versions permit existing duplicates to survive without invented historical uniqueness.

The production recording service requires the typed payload, a supported event name and an explicit attempt UUID. Ordinary raw INSERT privileges are not an event-authenticity boundary: SQL could still insert an unversioned row claiming legacy status. Restrict production database privileges and use the acceptance service; D9 does not infer a version from arbitrary SQL-created records.

## Authoritative reconstruction and coded identity

Use the event's attempt FK, then the attempt's original links. No field is reconstructed from today's mobile session, current content pointer, current app version, or current schedule pointer.

| Fact | Authoritative source |
| --- | --- |
| Account linkage / coded participant | `ResearchEvent.user_id`, checked against `ReviewAttempt.user_id`; linked `User.participant_code` |
| Research event identity / time / schema | Event `id`, `created_at`, `schema_version`, `event_type`, payload scope |
| Original client event / idempotency identity | Attempt `client_event_id`; ledger's unique `(user_id, client_event_id)` and `attempt_id` |
| Original client session / server session | Attempt `session_id` -> session `id`, `client_session_id`, `user_id` |
| Logical word and displayed immutable facts | Attempt `vocabulary_item_id`, `content_revision_id`, `content_release_id` -> D5 revision and release manifest |
| Correctness, submitted answer, measured duration | Attempt `correct`, `submitted_answer`, `response_time_ms` |
| Original interaction and acceptance times | Attempt `client_interaction_at`, `server_acceptance_at`; ledger `accepted_at` |
| Timing source, interruptions and capture facts | Attempt's original D8 `timing_evidence`, including explicit legacy absence |
| Scheduler identity and historical result | Attempt's type/version and `ReviewSchedule.attempt_id` -> type/version, interval, due time, original scheduler state |
| Platform/build identity as supplied at interaction | Attempt `device_platform`, `application_version`; no inferred research-build/freeze identifier |
| Original accepted API result | Immutable ledger `response_payload` |

Provisioned participant codes are unique and now immutable in PostgreSQL, including before the first review. Changes to email, password, temporary-password status, activation and profile preferences remain available. Analysis needs only the coded reference, not email, names or password hashes. A test reconstructs a coded projection after email changes and a newer content publication; it still sees the original revision and timing evidence. This test creates no export endpoint or production dissemination format.

D9 preserves the code present at migration and all future accepted coding. It cannot prove whether a code changed before D9. A legacy JSON code snapshot must not be overwritten with the current account code; missing or contradictory historical coding remains uncertain. Legacy content/timing/link absence stays absent.

The review acceptance service also rejects a supplied owned server session whose original client session UUID conflicts with the submitted client session UUID. This prevents a new acceptance from discarding the original session identity. Ledger replay still returns the original accepted result before revalidating caller-supplied historical facts.

## Privacy construction and sanitization

The current Pydantic payload model forbids extra fields and allows only the literal item-attempt scope. Database JSON equality enforces the same minimal allowlist for current events. Email, names, passwords/hashes, tokens, headers, cookies, device identifiers, queue leases/retries and exception details are outside the current payload schema. Neither event duplicates answer text or other authoritative attempt fields.

The generic sanitizer is defense in depth for supported JSON dictionaries and lists. It recursively visits dictionaries inside arbitrarily nested lists, case-folds keys and removes separator characters before matching. It strips credential, authorization, cookie, email and device-identifier fragments, and explicit name/contact-identifier keys. It removes offending entries without fabricating replacements, preserves safe values and list shape, and leaves the input untouched. Non-string keys and unsupported non-JSON values fail rather than being stringified.

This is a key sanitizer, not arbitrary string-content detection, and does not sanitize existing historical JSON in place. The typed current scope prevents arbitrary payload text from being accepted. Original `submitted_answer` remains on the authoritative attempt under the existing D4 contract; participant-supplied answer text and legacy JSON may need access/redaction decisions before dissemination. D9 introduces no approved export or retroactive scrubbing policy. Operational errors stay application concerns and are not emitted as successful learner outcomes.

## Database protection and blocked operations

PostgreSQL row triggers reject all ordinary UPDATE and DELETE operations on `review_attempts`, `review_schedules`, `accepted_client_events` and `research_events`, including legacy rows. Statement triggers reject TRUNCATE on those four tables and `review_sessions`; truncating an ancestor with CASCADE cannot bypass them. Truncate is blocked even for an empty guarded table, so reset requires explicitly isolated maintenance.

Referenced review sessions reject UPDATE and DELETE once any attempt points to them. Unreferenced session maintenance remains possible. The participant-code trigger rejects any actual code change, while a no-op assignment remains permissible. These are database protections and cover ORM as well as direct SQL operations; there is no runtime flag, GUC or application repair bypass.

The nine audited CASCADE relationships now use RESTRICT:

| Child | Restrictive parent references |
| --- | --- |
| Review session | User |
| Review attempt | User, review session |
| Historical schedule | User, logical vocabulary item, review attempt |
| Accepted client ledger | User, review attempt |
| Research event | User, plus the new composite attempt/owner reference |

D5 restrictive logical-content/provenance references and immutable revision/release guards remain in force. D7 current schedule pointers remain mutable operational state and continue to advance only on genuine acceptance; historical schedule rows cannot be edited or deleted. Direct loss of a pointer continues to fail eligibility closed under D7, rather than generating a guessed reconstruction.

Deleting an account with review sessions, attempts, schedules, ledger or research events is blocked. Even an unused session must be explicitly removed before its parent account could be removed; no automatic cleanup policy is introduced. Deleting a referenced session, logical word, lesson or language is blocked by the retained historical/content references and guards. All blocked cascades are transactional: attempted parent deletion cannot leave partial historical destruction. Authorization for withdrawal, corrections, exclusions and research deletion remains unresolved.

These guards protect ordinary application operations, not a privileged schema owner that can disable triggers, alter/drop tables, or bypass privileges. Production role separation, backups and the eventual research-build freeze remain necessary. No production destructive maintenance helper is added.

Test reset tooling requires an explicitly named `*_test` database and uses privileged transactional DDL to disable only truncate guards during the isolated reset, then restores them. Deliberate historical corruption in migration fixtures requires an isolated database and a rollbackable savepoint. Its DDL and row edits are rolled back. These helpers live exclusively under tests and are not approved research cleanup procedures.

## Acceptance transaction and replay

Both event inserts occur inside the existing attempt/schedule/ledger/current-pointer acceptance transaction. Validation and authorization failures create no accepted outcome. Injected failure after staging the first event rolls back both events and all accepted-record writes. A session may have been created separately by the existing get-or-create behavior; that does not establish a successful review outcome.

Same-owner event UUID replay returns the original attempt/schedule/ledger result without rewriting version, payload, linkage, timing or current pointer. Concurrent duplicate submission remains governed by ledger uniqueness and rollback. A genuine new interaction UUID creates a new accepted attempt with its own two events and historical schedule. Sync retains D3's per-item transaction behavior: an earlier accepted item in a partially failed batch is real evidence, and later failed items add no successful outcome.

## Migration and legacy handling

Alembic `d9c0de000001`, following `d8c0de000001`, adds nullable version/link columns without defaults, an attempt-owner unique key, the current-event constraints/index, the nine restrictive FKs and frozen D9 trigger definitions. It inspects existing FK relationships before replacement and runs in PostgreSQL transactional DDL. It performs no row backfill, JSON rewrite, code recoding, legacy deduplication, or guessed UUID resolution.

Downgrade refuses while any event, attempt, historical schedule or accepted ledger row exists, including legacy-only history. Only an empty-history schema can remove the protections and restore the former columns/FKs. This deliberately blocks destructive downgrade over accepted evidence pending approved governance. Real migration tests preserve duplicate legacy JSON values, leave both columns SQL NULL, verify all nine restrictive relationships, test empty round trips and refuse downgrade over current and legacy evidence.

## Changed scope and tests

Production changes: `app/research_logging/models.py`, `service.py`, new `integrity_ddl.py`; `app/reviews/models.py`, `service.py`; `app/sync/models.py`; new Alembic D9 migration. No mobile code, wire attempt response, timing instrument, content behavior or scheduler rule changes.

Test changes: new `tests/research_logging/test_integrity.py` and `test_migration.py` cover 33 additional cases for current schema/linkage, reconstruction, privacy, replay, failed acceptance, code protection, row/cascade/truncate guards and migration. New `tests/research_helpers.py` separates privileged fixture maintenance. `tests/conftest.py` installs D9 in an existing isolated schema and safely resets it. Existing review/sync event assertions use the relational link and canonical current name; D7 migration fixtures explicitly fabricate history in rollbackable test-only maintenance. The concurrency fixture now pairs its server and client session identities consistently. All prior regression tests remain present.

Updated regression files are `tests/reviews/test_current_schedule_migration.py`, `tests/reviews/test_due_review.py`, `tests/reviews/test_review_api.py` and `tests/sync/test_sync_api.py`. Including this note, the complete scope is 16 files: 10 modified tracked files and 6 new files.

## Verification

Verified on Windows with PostgreSQL; backend tests use the isolated `fluentt_test` database. Starting Git state was clean `main`, HEAD `cd01273` (`feat(research): harden review timing evidence`). The development database was upgraded from D8 to D9. No commit was made.

| Working directory | Required command | Result |
| --- | --- | --- |
| `C:\FLUENTT\backend` | `uv run alembic upgrade head` | Exit 0; upgraded `d8c0de000001` -> `d9c0de000001` |
| Backend | `uv run pytest -v` | Exit 0; 173 passed, 2 dependency deprecation warnings |
| Backend | `uv run ruff check app tests scripts` | Exit 0; all checks passed |
| `C:\FLUENTT\mobile` | `pnpm test` | Exit 0; 232 tests, 32 suites passed; Node SQLite experimental warning |
| Mobile | `pnpm exec tsc --noEmit` | Exit 0 |
| Mobile | `pnpm lint` | Exit 0; 0 errors, 2 existing `src/i18n/index.ts` warnings |
| `C:\FLUENTT` | `git diff --check` | Exit 0 |
| Repository | `git status --short` | 10 modified tracked files and 6 new files; all within D9 backend/tests/documentation |

The initial targeted red run demonstrated missing D9 version/link/name, nested sanitizer and database guards (24 failed, 2 passed). Initial full regression exposed three assertions tied to the retired duplicate payload UUID; assertions now follow the authoritative FK. Final full verification above includes those regressions and the new migration/privacy/integrity cases.

## Governance and next phase

Retention duration, withdrawal/right-to-delete behavior, authorized correction/exclusion, export/access/redaction and dissemination policy remain unresolved. No policy durations, deletion automation, exclusion flag, correction workflow or user export endpoint is invented. Formal research collection remains blocked pending those approvals.

D10 is not implemented. It requires full regression plus real-device termination, offline/reconnect and account-switch verification before experimental scheduler implementation. D9's automated checks do not establish real-device verification. Final SRS/ESR algorithms, condition and counterbalanced vocabulary assignments, instrument decisions, approved governance, and a frozen research build/configuration must exist before study collection. Current `development` / `dev-0.1` scheduling remains for integration validation only. The D9 version describes event structure and semantics; it is not an algorithm, assignment, instrument or research-build freeze ID. Pronunciation and NLP remain outside this change.
