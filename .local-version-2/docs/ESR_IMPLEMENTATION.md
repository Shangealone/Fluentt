# ESR implementation checkpoint

Updated: 2026-11-02

Training follow-up: the user confirmed that no checkpoint exists and requested training preparation next. See `ESR_TRAINING_PREPARATION.md` and the deliberately untrained example manifest/integrity checker in `services/api/training/esr/`.

CPU engineering checkpoint: `ESR_CPU_SMOKE_RESULTS.md` records seven passing synthetic checks and a bounded optimization run in a separate environment. This does not satisfy the genuine-model or full-study-workflow dependencies below.

## Status

The user approved the counterbalanced design and implementation on 2026-11-02. This checkpoint implements **vocabulary authoring and the review/scheduling foundation**. It is not a complete, executable research intervention. No learner was enrolled, allocated, or reviewed by this work.

Two separate dependencies prevent study activation:

1. A genuine, compatible FIFAKT checkpoint, preprocessing/vocabulary/format mappings, provenance, and future-recall calibration are not installed. The existing simulated provider is not used by this pipeline.
2. The new study contract still needs its participant-facing consent/enrollment, withdrawal, and pool-linked baseline/immediate/delayed assessment integration. An unconditional `study_workflow_unavailable` blocker prevents a model or inserted approval records from accidentally enabling this incomplete workflow. There is no deployment switch to bypass it.

The original readiness audit is historical source-inspection evidence. This document describes the subsequent implementation.

## Implemented

- Administrator `/vocabulary`: author multiple-choice and typed-recall prompts, accepted forms and stable option IDs; save and publish immutable vocabulary-pool snapshots against a published official lesson. Corrections require a new snapshot. Curriculum read/write/publish permissions remain separate.
- Research configuration API and preparation UI: two disjoint published pools, a class, capacity, explicit numerical/calendar settings, frozen implementation-policy identities and a model-artifact hash. Class-specific research grants are required in addition to global research permissions. UI configuration is disabled without a real provider.
- Isolated `research_private.esr_*` records for pools, protocols, external approval evidence, counterbalanced allocations, review state, committed responses, final decisions and mutation replays. Existing SM-2 records and ordinary assignments are preserved.
- Server-side balanced allocation with randomized ties, frozen A/B mapping and initialized per-item state. Allocation is deliberately unavailable while activation blockers remain.
- Learner `/vocabulary-review`, reached from Research studies: directory, due queue, answer commitment, factual feedback, four recall choices, saved review and next item. No model names, answer keys before commitment, invented scores or personal-learning research conversion.
- Typed checking uses NFC, outer trim and casefold, preserving accents and internal spaces. Incorrect objective responses use effective `again`; raw ratings remain intact. Blank answers are unfinished.
- Both formats alternate by pinned item position and review revision, independent of condition. Prediction targets the **next** encounter's format, which is recorded separately from the observed format.
- FSRS-6 baseline memory is retained unchanged. ESR adjusts only the proposed interval using an explicit bounded linear factor and half-up day rounding. Lapses cannot lengthen their interval. Unavailable, sparse or invalid inference produces the exact baseline schedule followed by the same calendar policy.
- Histories are restricted to the same study/participant/pool/configuration and finalized encounters before question presentation. The current response is excluded. An eventual adapter must be trained and validated for this precise causal input and future horizon.
- Stable request identities, one final scheduling transition, immutable committed evidence, live session/membership checks, private projection, duplicate-tap guards and stale-response cleanup. Transport uncertainty keeps the original retry; confirmed conflicts allow reconciliation rather than an endless retry loop.

## Where to inspect

- Admin: `http://localhost:3000/vocabulary` using an authorized live administrator. Existing curriculum grants expose the pool editor. The page does not grant research permissions or certify external approvals.
- School learner: Research studies → Vocabulary review, or `http://localhost:8082/vocabulary-review`. Without approved enrolled/allocated participation, the directory remains empty. Personal learners cannot use this study route.
- API: `/api/v1/admin/vocabulary/*` and `/api/v1/me/vocabulary/*`.
- Storage: migration `0021_esr_vocabulary_review`, following `0020_teacher_trigger_dispatch`; seven additive tables. Applied and verified in the existing local development database. No existing learner content was edited.

## Next implementation work

1. Obtain or reproduce a permitted model checkpoint with its full encoders, feature definitions, licenses and evaluation evidence. Keep development/calibration participants separate from formal study outcomes. An upstream source repository is not a trained artifact.
2. Implement a target-safe inference adapter satisfying `PredictionProvider` in `inference.py`, with finite outputs in [0,1], exact artifact hash and `future-recall-probability-v1`. It is injected through the API's `app.state.esr_prediction_provider`; no default or automatic loader is installed yet. Metadata checks alone do not verify model fidelity or calibration.
3. Complete the participant workflow with the supplied consent versions, guardian/site/ethics requirements, current withdrawal access and retention wording; never treat a learner checkbox as guardian authorization. Add allocation presentation and pool-linked study assessments. Ordinary assignment results are not substitutes.
4. Specify and validate matched pools, per-condition practice opportunities, presentation order, enrollment/retention criteria, language coverage and the repeated-measures analysis plan. Current due ordering is chronological then ID; it is not a validated opportunity-balancing intervention policy.
5. Freeze numerical fusion/calendar settings, model manifest and readiness thresholds under an approved configuration. Record operator-verified external evidence, including revocations, through a controlled provisioning workflow. No HTTP endpoint writes `ESRApproval`; that operator tool is not yet implemented. Production runtime roles must not own the schema or have approval-write privileges; `REVOKE FROM PUBLIC` does not restrict a table owner.
6. Run full authorization/concurrency/inference acceptance checks, including revoked membership and consent, partial-review resumption, condition isolation, held-out target leakage, inference coverage and final due-date divergence. Only then remove the workflow blocker with covering tests and activate an approved study.

## Verification at this checkpoint

- Focused tests: **22 passed** (10 pure vocabulary policies, 3 bundle-integrity preparation checks, 5 existing research guard checks, 4 disposable PostgreSQL transaction/authorization checks).
- PostgreSQL checks create and delete only a generated UUID test database. They verify mutation replay, original-response commitment, one-time state advancement, database snapshot protection, missing-readiness blockers and administrator permission revocation. Review-service tests replace external enrollment setup explicitly; they do not establish the missing end-to-end study workflow.
- New backend files: Ruff passed. Admin: typecheck and changed-file lint passed. Mobile: changed-file lint passed.
- Full mobile typecheck remains blocked by existing errors in accessibility primitives, shared ScrollView reference types and demo assignment data. It reported no diagnostics in the new vocabulary files. No unrelated repair was included.
- No model training, model-accuracy claim, full participant-flow verification, native-device check, APK build, commit or push was performed.

The source review identified the activation-readiness gap and definitive-conflict retry trap; both were addressed. No claim of study readiness or measured retention improvement is made.
