# Parallel-group database changes

2026-11-05. Inactive foundation implemented; overall PARTIAL for complete participant operation. No real participants, production migration, commit, push or deployment. Prior uncommitted research/model work preserved.


Prepared head 0026_parallel_foundation follows 0025_assessed_proficiency; frozen 0001–0025 unchanged. Adds five research_private tables:

- parallel_protocols: ResearchStudy/class/published vocabulary pool/creating admin references, immutable configuration, private 32-byte seed, UUID create request and fingerprint. Unique actor/request and study identity.
- parallel_clearances: append-only verified/revoked evidence references, configuration hash and ordered sequence. No HTTP writer. Latest matching verification is necessary for inactive assignment; it is not a claim all ethics/model/workflow approvals exist.
- parallel_allocations: coded participant, protocol, allocating actor, slot 0–29, explicit condition, timestamp and method. Unique protocol/participant and protocol/slot. All slots remain reserved after withdrawal.
- parallel_opportunities: PREPARED common class-day metadata, UTC open/close and local date. Not per-student delivery/completion evidence and not yet instructor-published activities.
- parallel_assessments: pretest/posttest/delayed designation metadata. Instruments, questions, answers, rubric and results deliberately absent while policy is unresolved.

RESTRICT foreign keys preserve references. All five tables reject UPDATE/DELETE. Allocation insert trigger locks protocol and rejects wrong-study/ineligible participants and >15 records in either condition. Service locks protocol before counting/slot selection, checks current user/membership/consent/conflicting enrollment and retains approval checks. Immutable rows prevent accidental reassignment; no administrative correction workflow is invented. PUBLIC privileges revoked; owners are not restricted by that revocation. Production runtime/approval-writer separation requires operator review before any real use.

## Tested migration/rollback

Disposable UUID databases were upgraded through head. An empty 0026 downgrade to 0025 preserved the old ESR table and re-upgraded successfully. Populated 0026 downgrade intentionally refused before deleting evidence. Concurrent fixtures used their own disposable database; all generated databases were dropped by fixtures. No unknown/local application/Supabase database was migrated, reset or stamped.

For a future separately approved target, verify its current revision, back up it and inspect runtime grants; use that checkout's API environment: `python -m alembic current`, then reviewed `python -m alembic upgrade head`. Do not initialize or stamp existing databases. Empty rollback: `python -m alembic downgrade 0025_assessed_proficiency`. If any new table has evidence, rollback refuses: keep source feature off and use a reviewed preservation/migration plan, not deletion. Fresh bootstrap retains the existing repair_initial_names adapter requirements; see MIGRATIONS.md. Turning the feature off is the operational rollback and does not remove history.
