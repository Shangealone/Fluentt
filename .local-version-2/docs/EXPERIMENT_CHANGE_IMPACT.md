# Experiment change impact and implementation plan

2026-11-05. Documentation-only audit. VERIFIED = source/artifact observation; PROPOSED = requires approval; BLOCKED = unmet prerequisite. No application/schema/configuration/participant changes. Existing uncommitted work preserved. No live database inspected; statements about behavior describe code, not actual enrollment counts.


No schema/code changes authorized by this audit. All entries below PROPOSED unless marked out of scope.

| Priority | Source files/components | Planned change |
|---|---|---|
| Required | app/models/vocabulary_review.py; models/research.py; new additive migrations after actual head 0025 | New parallel protocol/arm identity, immutable participant assignment, daily opportunities, protocol-linked assessments; preserve existing constraints and histories |
| Required | modules/vocabulary_review/schemas.py, policy.py, service.py, router.py | Separate approved contract dispatch, participant arm selection, eligibility/consent, scoped state/history, day window enforcement and idempotency |
| Required | modules/research/execution_guard.py, service.py, experiment_service.py | Extend fail-closed handling for NEW contract; never route to SM-2 seeding/legacy auto infrastructure; retain old guards |
| Required | modules/research/classroom_service.py, classroom_schemas.py | Explicit FSRS versus hybrid contract/reference validation; preserve owner/class permission boundary and existing managed scopes |
| Required | modules/vocabulary_review/inference.py; isolated validated model adapter | Matching feature/mapping/horizon manifest, safe load, finite output, exact fallback, provenance and readiness evidence |
| Required | modules/research/assessment_draft_service.py and approved execution/result services; reporting_service.py/analytics_service.py | Pinned common instruments, participant-specific authorization, explicit anchors/missingness; arm-level research analytics rather than legacy SM-2 or pool mapping aggregation |
| Required | apps/mobile/src/features/vocabulary/VocabularyScreen.tsx; src/app/vocabulary-review.tsx; services/api/vocabulary.ts; features/research/* | Study-specific enrollment/withdrawal, assigned-day state, blinded common UI, assessments; secure session generation and stale-response cleanup |
| Required | apps/admin/src/components/vocabulary-manager.tsx, research-protocol-form.tsx, research-manager.tsx; services/research-*-contract.ts; BFF vocabulary/research routes | New-contract preparation/approval visibility; no secret sequence or keys in public DTOs; authorized deviations and coded outcomes |
| Required | tests/test_vocabulary_review.py, test_esr_shadow.py, test_research_execution_guard.py; integration/test_vocabulary_review_postgresql.py plus new parallel fixtures | Atomic allocation/races, seed secrecy/replay, no reassignment, withdrawal/membership, calendar edges, missed/no-opportunity, protected instruments, preserved histories, fallback/version attribution |
| Recommended | model preparation manifests, research reports, access/audit/deletion policy docs | Preregister model/analysis/retention plan; verify runtime least privilege, attribution and grant/revoke behavior |
| Optional | blinded research status explanations, approved adherence export | Add only after consent/privacy approval; avoid instructor comparison leaks |
| Out of scope | enrollment/service.py/class join codes; ordinary classes/assignments; spaced_repetition/fsrs6.py; Personal Learning; speech/Tutor modules; unrelated admin UI | Preserve behavior; no account conversion, class split/deletion or algorithm rewrite |

Migration strategy: additive NEW parallel tables or explicitly versioned sidecar records with unique protocol/participant identity and bounded arm capacities. Select exact DDL only after protocol approval; distinguish stable state identity from event history. Frozen 0001–0025 revisions remain untouched. Do not replace the legacy ResearchGroup condition enum, cast mapping groups into arms, or reset old study states. Keep FK RESTRICT/historical snapshot guards, coded research storage, append-only assignments/exposure/audits, optimistic versions, lock order and request replay rules. Test fresh and reviewed upgrades only on generated UUID databases before a separately authorized target backup/upgrade. No production migration executed.

Recommended sequence: approve scientific design/estimand and policies; obtain permitted compatible model-development evidence; validate sealed model; implement new storage/contracts with default-off guards; complete enrollment/assessments/day opportunities; run synthetic+PostgreSQL security/concurrency tests; perform authorized genuine shadow replay and device acceptance; approve staged participant pilot; activate only by approved operator action. Existing instructor-owned classes and records remain intact throughout.
