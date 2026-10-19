# Section 20 — Student assignment interface and response capture

Completed 2026-10-19 (Asia/Manila). No Section 21 implementation, commit or push.

## Inspection and approved policies

Read the supplied Section 20 attachment and reviewed the historical handoff, development plan, Sections 18–19 reports, assignment/question-bank/response/vocabulary/session/security and migration contracts, existing ten widgets, model validators, published payloads and Git changes. Section 19 deliberately froze distribution-only versions with no attempt policy; the existing attempt guard therefore required an explicit approved extension rather than invented max_attempts or points.

The user approved all three recommendations:

1. One **unscored-capture-v1** attempt per student/published assignment, resumable until submission, without retakes, deadlines or timers. Keep the published version and unset assignment policies immutable. Live membership is required for every operation; access loss suspends access without deleting saved work.
2. Explicit Save progress, no background autosave/insecure local persistence, server resume position, unsaved-exit warning, deliberate incomplete submission, immutable final responses and receipt-only access. Repeated finalization safely returns the same result.
3. Deliberate attempt-scoped reveal of the pinned Flashcard back, server-remembered reveal and revisable subjective recall before final submission. General reads stay key-free; no independent spaced-repetition persistence, scheduler, timing or research telemetry.

## Delivered workflow

School students open My Classes → published assignment detail → Start, resume or view submitted receipt. Start returns the same server attempt on retries or restarts, including the final receipt once submitted. Only eligible members of the exact active class can access the pinned publication; personal learners, instructors, nonmembers, unrelated classes and other students' attempts cannot use these APIs.

The player shows instructions, current question, structural answered/unanswered/incomplete counts, previous/next, optional question jump controls, clear current response, Save progress, reload/discard confirmation, review/final confirmation and safe exit. All ten existing controlled widgets are reused; no question editor or grading system is duplicated. Inputs and IDs remain stable with repeated labels, Unicode and long text. Clearing/reloading remounts local interaction state, including pending matching selections. Route/gesture/Back prevention reuses Expo Router's existing repeat contract. Busy or unknown-outcome writes freeze editing; membership failure hides questions/backs and session loss/blur unmounts protected state. Late callbacks are ignored.

Responses remain local while navigating. Save progress explicitly stores the complete validated snapshot and one-based resume position; omitted entries clear prior draft responses. No browser/AsyncStorage/disk response cache, bearer fallback or autosave was added. Restart loses unsaved local buffers and restores explicitly saved server work. Unknown/stale save outcomes require reload with discard confirmation, protecting another device's edits.

Final confirmation states the incomplete count and allows deliberate submission anyway. The server atomically saves the current snapshot and finalizes it; the UI claims success only after confirmation. An interrupted submit retains its exact row/body/UUID key in memory for retry. Equivalent committed payloads return the same receipt without another mutation/audit, including stale freshness; changed final payloads conflict. Receipt-only views omit questions, answers, reveal IDs, scores and correctness feedback. Retakes and post-submit editing/reveal are unavailable.

## Method and privacy contracts

| Method | Captured response / structural readiness |
|---|---|
| Multiple Choice | option_id; one selected valid option. |
| True or False | strict boolean value, including false. |
| Identification | Raw text; empty/whitespace draft is incomplete, preserved without normalization. |
| Fill in the Blank | Ordered blank_id/text entries; partial/empty buffers retained; every defined nonblank gap means structurally answered. |
| Multiple Select | option_ids in authored order; empty is incomplete, no invented selection bounds or partial credit. |
| Flashcards | again/hard/good/easy subjective recall, accepted only after server-recorded reveal. |
| Error Identification | selected_token_ids in authored order; no free-form correction entry or grammar evaluation. |
| Word Arrangement | ordered_token_ids; complete permutation means ready, not correct. |
| Sentence Arrangement | ordered_sentence_ids; same structural rule. |
| Matching | Stable left_id/right_id pairs, one-to-one partial drafts and canonical left-item ordering through existing controls. |

Each response references its AssignmentQuestion ID, whose composite FK binds the frozen AssignmentVersion; safe question payloads also retain stable Question and exact QuestionRevision identities. Server derives identity, method, version and timestamps. Unknown/duplicate IDs, cross-version references, malformed fields, invalid ordering/references and input limits fail before writes.

The separate capture validator supports raw unfinished text, including whitespace, without changing the original strict response/scoring contract. Declared input limits apply; legacy fields have an 8,000-Unicode-code-point operational ceiling. A snapshot allows at most 200 response entries/1 MiB. Unicode/case/accents/punctuation are never normalized; isolated invalid surrogates are rejected. Structural completeness uses no answer keys and computes no correctness or score.

General attempt reads expose only public question fronts/content and the student's own saved buffers. Only an explicit live-authorized Flashcard reveal returns that pinned card's back and a fresh attempt marker; no private explanation/rubric or other key is returned. Reveal IDs are remembered but backs are not automatically returned on resume. Recall can change until submission. FlashcardQuestion has an opt-in assignment mode; independent FlashcardPractice retains once-per-visit local semantics. No VocabularyReviewEvent, scheduler update, latency or experimental record is written.

## Backend, endpoints and transaction safety

Reuse AssignmentAttempt and StudentResponse through the existing assignment module and typed mobile SessionController.run clients. Shared student_context extracts the existing Section 19 authorization boundary, preserving metadata endpoints. Lock order is authenticated student/session → instructor owner → class → eligible membership → shared content advisory 78090001 → attempt/responses, with locked state refreshed after waits. Same-student/session/attempt locking serializes starts/saves/finalization; published versions/items stay unchanged. PostgreSQL remains the only runtime store.

All endpoints below use /api/v1, existing mobile Bearer credentials, secure transport in production, bounded process-local throttling and no-store success/error responses. Admin cookies grant no mobile access.

| Method | Path | Contract |
|---|---|---|
| POST | /assignments/{id}/attempt | Explicit idempotent start/resume or submitted receipt. One ordinal-1 capture per student/version. |
| GET | /assignments/attempts/{attempt_id} | Live-authorized owner saved state or receipt only. |
| PUT | /assignments/attempts/{attempt_id}/progress | If-Match; {position,responses:[{assignment_question_id,answer}]}; full snapshot replacement. |
| POST | /assignments/attempts/{attempt_id}/submit | Same snapshot plus confirm:true; If-Match and UUID Idempotency-Key; atomic finalization. |
| POST | /assignments/attempts/{attempt_id}/questions/{item_id}/reveal | If-Match; only a pinned Flashcard before finalization. Returns revision_id/back/attempt_revision. |

Missing freshness=428; stale/final/protected/transaction conflicts=409; invalid input=422; unavailable/cross-user/membership objects=404; wrong mobile role=403; anonymous/expired/revoked credentials=401. Errors do not echo responses or private keys. Safe ordinary audit events record start/save/submit actor, attempt, contract, request/time only; no response text, backs or credentials. An injected failure after response flush proved rollback of answers and resume position. No instructor analytics, assignment notification or student results endpoint was added.

## Migration and local database preservation

Additive **0009_response_capture** adds nullable capture_contract, capture_state and submission_fingerprint to AssignmentAttempt; still 60 domain tables. capture_state stores server-managed reveal IDs and explicit saved position. Published AssignmentVersion/AssignmentQuestion rows, points/max_attempts and frozen 0001–0008 remain unchanged. The attempt guard permits only ordinal-1 unscored capture against a locked distribution-only version, without expiry/scores and with in_progress/submitted states. Additional guards retain capture identity/history, require finalization identity, prohibit post-submit response changes and reject grading/latency fields. Legacy configured attempts keep their prior validation; no historical attempt conversion. Downgrade refuses retained capture history.

After tests, the specifically verified development database fluentt_local on localhost:55432 was backed up to ignored private-data/verification/section20-before.dump and normally upgraded 0008 → 0009. All **60 table row counts remained unchanged**; alembic check reported no new upgrade operations. No reset/downgrade, unknown/deployed database access, account/content seed or permission grant occurred. Production still needs restricted runtime/migration credentials, trigger restrictions, deployment-wide rate limits and TLS/provider configuration.

## Actual verification

| Check | Result |
|---|---|
| Full backend/PostgreSQL regressions | **560 passed**, zero failed/skipped, **126.75 seconds**. Includes identity/class/enrollment/admin/curriculum, Sections 11–19, real migration round-trip/schema metadata and concurrency. Two existing upstream warnings. |
| Capture unit checks plus schema | **32 passed**, including ten shapes, raw Unicode/whitespace and partial states, malformed IDs/limits, surrogate rejection and deliberate confirmation. These also passed in the full suite. |
| Focused capture/publication PostgreSQL run | **8 passed** before the final additional rollback/capture checks; all final capture tests subsequently passed in the full suite. |
| Final capture PostgreSQL scenarios | All ten responses, true false value, explicit back reveal/private data exclusion, saved/raw resume, stale writes, incomplete finalization, same-result retry, receipt-only restart, immutable records, no second attempt, membership suspension/restoration, other-student/anonymous/revoked access, invalid IDs/position, concurrent start/save/submit and rollback after flushed response changes. Shared Section 19 tests retain owner/class disable and lock-wait revalidation coverage. |
| Combined client/component regressions | **123 passed**, zero failed/skipped. Includes prior ten-method/session/navigation tests plus capture serialization, protected routes, typed headers/version checks, actual player save/confirmation/retry/receipt handlers, membership hiding, safe exit and all-ten rendering. |
| Final focused client/component run | **43 passed**, zero failed/skipped, after neutral shared wording and interaction-reset changes; includes the changed player/widgets and prior assignment/method handlers. |
| Mobile TypeScript / ESLint | **Passed**, including final player/reset code. |
| Expo web / Android exports | **Passed**, dist/section20-web and dist/section20-android. Hermes received the filesystem access established as necessary in Section 19. Exports are bundles, not installed-device proof. |
| Ruff / format / Python compilation | **Passed**; 126 files formatted/checked. No configured Python static typechecker was run. |
| Local upgrade / row preservation / schema drift | **Verified** expected database/revision, backup, additive upgrade, unchanged 60-table counts and clean alembic check. |
| Next.js checks | Not rerun: administrator source/contracts are unchanged; backend administrator regression passed. |

An initial immutability test used a malformed response and correctly hit ORM structural validation before reaching the intended SQL guard; the test was changed to a valid-field mutation and the database guard then verified. Early import/lambda lint findings were corrected. No existing integrity rule or test was disabled to get a pass. The frozen-schema comparison excludes the explicitly migrated attempt table and checks new nullable fields; real PostgreSQL metadata comparison covers the complete schema.

**Unverified native/end-to-end work:** no installed emulator/physical-device mobile-to-server assignment run, TalkBack/VoiceOver, native keyboard/focus/text scaling/orientation/performance audit or native gesture/hardware Back execution. Actual widget/route handler tests use synthetic props and a mocked router; persistence/API tests use separate real disposable PostgreSQL. Existing keyboard/Back component regressions pass, but do not establish native execution. No browser auth bypass, insecure storage fallback or synthetic runtime seed was introduced. Real OIDC/MFA/TLS is still unconfigured; runtime nonempty assignments need legitimate published curriculum/questions/classes. PostgreSQL was available and no final integration check was skipped.

## Every changed file

Against the pre-section SHA256 baseline: **27 existing files changed, 14 new files including this report, 287 previous files unchanged, zero removed**. Unrelated uncommitted changes, administrator source, environment/dependencies, PROJECT_HANDOFF.md and frozen migrations are preserved. Existing mobile package-lock SHA256 remains 92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6. Ignored logs/backup/upgrade helper are local verification artifacts.

```text
AGENTS.md
README.md
apps/mobile/src/app/_layout.tsx
apps/mobile/src/app/assignment-attempt.tsx
apps/mobile/src/app/published-assignments.tsx
apps/mobile/src/features/assignments/AttemptPlayer.tsx
apps/mobile/src/features/assignments/CaptureQuestion.tsx
apps/mobile/src/features/assignments/PublishedDetails.tsx
apps/mobile/src/features/assignments/captureState.ts
apps/mobile/src/features/questions/ChoiceQuestion.tsx
apps/mobile/src/features/questions/FlashcardQuestion.tsx
apps/mobile/src/features/questions/MultiSelectionQuestion.tsx
apps/mobile/src/features/questions/TextQuestion.tsx
apps/mobile/src/services/api/capture.ts
apps/mobile/src/session/provider.tsx
apps/mobile/src/session/routing.ts
docs/API_DESIGN.md
docs/ARCHITECTURE.md
docs/ASSIGNMENTS.md
docs/DATABASE_SCHEMA.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/MIGRATIONS.md
docs/QUESTION_BANK.md
docs/SECTION_20_REPORT.md
docs/VOCABULARY.md
scripts/capture.test.mjs
scripts/choice-components.test.cjs
services/api/app/api/v1/router.py
services/api/app/models/assessments.py
services/api/app/models/validation.py
services/api/app/modules/assignments/capture.py
services/api/app/modules/assignments/capture_router.py
services/api/app/modules/assignments/capture_schemas.py
services/api/app/modules/assignments/publication.py
services/api/app/schemas/capture.py
services/api/migrations/versions/0009_response_capture.py
services/api/scripts/document_schema.py
services/api/tests/integration/test_response_capture_postgresql.py
services/api/tests/test_capture.py
services/api/tests/test_schema.py
```

## Section 21 readiness

**Ready to proceed to Section 21 after your acceptance and its authoritative prompt.** No remaining Section 20 implementation blocker; native/end-to-end limitations remain explicit. Automatic grading/result publication are not inferred from stored expected answers or subjective recall. Before adding them, approve method-specific grading/normalization/partial-credit/weight/rubric/release policies and immutable algorithm/configuration references. A future authorized grading strategy must preserve final captured answers and explicitly address the present unscored guard boundary rather than silently changing old attempts or published policies. No grading, analytics, AI, adaptive scheduling or research execution is implemented here. Stop for acceptance.
