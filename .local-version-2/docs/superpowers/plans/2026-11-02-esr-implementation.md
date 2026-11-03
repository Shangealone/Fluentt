# ESR implementation plan

> Implement inline with the executing-plans workflow. The user approved the design and requested implementation on 2026-11-02. Preserve unrelated changes.

**Goal:** versioned vocabulary reviews and concurrent counterbalanced FSRS-6/ESR orchestration without exposing private keys or enabling simulated treatment.

**Architecture:** isolated review domain with pure response/scheduling policies, PostgreSQL snapshots and replay identities, live mobile/admin authorization, and dedicated presentation. Real study execution requires externally verified approvals and a compatible real model artifact.

**Stack:** existing FastAPI/Pydantic/SQLAlchemy/Alembic, Expo Router and Next.js.

**Spec:** `docs/superpowers/specs/2026-11-02-esr-counterbalanced-design.md`

## Constraints and rulings

- Approved matching: review-only NFC/outer trim/casefold, preserving raw evidence. Incorrect objective response uses effective again; correct uses selected rating.
- Mapping 1: A/FSRS-6 and B/ESR. Mapping 2 reverses these. No cross-pool model history.
- Preserve legacy models, algorithms and execution guards. Real calibrated inference and formal approvals cannot be inferred from design approval.
- Numerical hybrid/calendar settings are explicit versioned configuration, not hidden constants copied from a simulation.
- Ruling: execute in the current checkout while preserving existing changes. The live app depends on uncommitted teacher-lesson work. No branch creation, commit, push or publication is included.
- Ruling: implement inline. The user already requested implementation; no second execution-method approval is needed.

## Review focus

Unicode matching; causal and condition-isolated history; exact FSRS fallback; single-commit retry behavior; genuine model readiness.

## Tasks

- [x] Pure review schemas, response checking, effective ratings, mapping, calendar and interval fusion. Files: `services/api/app/modules/vocabulary_review/{schemas,policy,scheduler}.py`. Tests: `tests/test_vocabulary_review.py`.
- [x] Artifact interface and causal sequences with no simulated default. Files: `vocabulary_review/{inference,features}.py`. Interface only: actual inference adapter and checkpoint remain unavailable.
- [x] Additive PostgreSQL pool/protocol/allocation/review/state/replay storage, live authorized services and APIs. Migration follows `0020_teacher_trigger_dispatch`.
- [x] Administrator vocabulary/pool/protocol and readiness presentation with existing auth/CSRF. No UI grants permissions or verifies ethics evidence.
- [x] Learner review route with both formats, answer/feedback/rating phases, stable retries and protected session cleanup. Backend resolves the condition. Formal execution remains blocked.
- [x] Focused checks, documentation, tracker updates and independent source review. No real learner records or fabricated outcomes.
- [ ] Genuine checkpoint, inference loader, calibration and acceptance evidence.
- [ ] Complete consent/enrollment, withdrawal, allocation presentation and pool-linked assessment integration; controlled approval-provisioning workflow.
- [ ] Full research acceptance and approved activation. See `docs/ESR_IMPLEMENTATION.md`.

## Execution ledger

2026-11-02: source audit/design reread. Installed provider is simulated; no upstream checkpoint was found. Old research control is SM-2. Missing model preparation is a real dependency; no trained/integrated-treatment claim is permitted without evidence.

2026-11-02: foundation implemented; local schema head verified as 0021 with seven ESR tables. Final focused suite: 19/19. Administrator typecheck and changed-file lint passed; mobile changed-file lint passed but repository-wide typecheck has preexisting errors. Independent source review completed by esr_source_review.

Final: fixed missing workflow activation gate — test_missing_evidence_and_model_block_activation RED→GREEN, focused suite 19/19. A trained model and approval metadata cannot activate incomplete participant workflows.

Final: fixed next-encounter prediction-format ambiguity — test_prediction_targets_the_format_of_the_next_encounter RED→GREEN, focused suite 19/19. Observed and prediction formats are recorded separately.

Final: fixed confirmed-conflict retry trap — returned 409/412 now permit reconciliation; uncertain transport requests retain their identities. Source and lint verification only; hands-on interface checks remain unperformed.

Final: Ruling: preserve the existing checkout and unrelated edits — allows the live app's unfinished teacher-lesson work to coexist; cost if wrong is reduced change isolation. No commit or push performed.

Final: Ruling: implement inline with one independent final source review — matches the user's request to proceed without another execution-method question; cost if wrong is less per-task independent review.

Final: Ruling: study activation stays unavailable until model and participant workflows are complete — no placeholder model or fabricated consent is used; cost is that real study reviews cannot yet be exercised.

2026-11-02 training follow-up: user confirmed no checkpoint and selected training preparation next. Added a concrete preparation document, deliberately untrained manifest and non-executing bundle-integrity checker. No dataset downloaded or weights loaded. Final combined focused suite: 22/22; three additional tests cover changed bytes, out-of-bundle paths and rejection of the untrained template.
