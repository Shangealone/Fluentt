# Section 16 — Matching Type

Completed 2026-10-19 (Asia/Manila). No Section 17 implementation, commit or push.

## Inspection and scope

Reviewed the historical PROJECT_HANDOFF.md, development plan, accepted Sections 11/15 reports, question-bank/API/architecture/decision documents, repository instructions, current Git changes and relevant schema/service/publication/editor/mobile/tests. Consulted installed Next.js client-component guidance and Expo SDK 58/React Native accessibility documentation. Later accepted reports supersede historical handoff environment/head statements; migration head remains 0006_question_associations.

The accepted V1 schema already requires complete **one-to-one** keys, at least two entries per side, unique IDs within each side and full coverage of both sets. Complete definitions therefore require equal counts. Reused targets are invalid; many-to-one would require a future approved versioned contract. Separate side namespaces allow identical IDs across sides; repeated display labels remain distinct by ID.

The user explicitly approved independent authored left/right order, no automatic shuffle, initially empty associations, left-then-right selection, reassignment clearing the target's previous owner, review/remove/reset, responses in authored left order and structural readiness without grading.

**Counting conflict:** all ten backend contracts existed in Section 11. Sections 12–15 implemented eight interfaces; Matching adds the ninth. Flashcards remains backend-contract-only. The prompt's “tenth” wording is not permission to implement Flashcards. QUESTION_BANK.md now records an accurate ten-method support matrix. No new educational content, scoring, learner route, response endpoint, permission, migration or dependency is added.

## Delivered implementation and security

The protected /questions editor and fixed BFF support matching_type using the existing real FastAPI/PostgreSQL APIs. Authors enter prompts/directions and two independently ordered text sets with persistent IDs, add/remove/reorder entries, then deliberately build a complete private mapping. Text edits/reordering retain ID associations; removal clears affected pairs. Empty labels, duplicate/invalid IDs, unequal counts and incomplete/unknown/reused mappings cannot save. Field errors, existing save reconciliation, unsaved-change protection, paging/history, new correction revisions, publication and whole-item retirement are reused. A warning identifies private mappings aligned by visible row; authored text/order may still imply hints and needs human review.

MatchingControls powers the private builder and key-free MatchingPreview. Keyboard-accessible controls select a left item, associate a right target, show all pairs/unmatched items, remove and reset. Reassignment evicts a target's previous owner without silently allowing duplicates. Source numbers distinguish repeated labels; wrapping controls and text avoid relying on lines, dragging, offsets or text identity. Whole Unicode/Tagalog labels render as escaped plain text.

Expo MatchingQuestion is controlled through pairs and pending left selection. It reuses shared cards/buttons/error/loading/empty/retry patterns and choice styling. Radio checked/disabled semantics and visible selected text provide accessible feedback. UnscoredMatchingPreview remounts state on revision/resetKey, loading/error/empty/inactive/unmount boundaries. Layout does not depend on orientation dimensions, so ordinary layout changes do not reset stable-ID state. Future hosts must provide Screen scrolling/keyboard avoidance and clear their own attempt buffers on blur/session loss; no learner route/attempt persistence is introduced.

The safe adapter explicitly projects only revision ID, method, prompt, instructions and public left/right id/text sets, rejecting malformed/duplicate/unequal sets. Expected pairs, explanation, grading metadata and private fields never enter preview props. Complete response: `{method:'matching_type',answer:{pairs:[{left_id,right_id}]}}`, copied in authored left order independent of tap order. Empty/partial local state yields no complete callback response. Any complete bijection is structurally ready, with no answer comparison. Existing backend partial-response validation remains unchanged.

The authoritative backend already validates full definitions, references and injective partial responses. Existing live isolated administrator sessions and explicit questions.read/write/publish remain authoritative: keys require read+write; publish/retire require all three. Origin/CSRF, no-store, fixed BFF path/method/cookie/header restrictions, bounded JSON, transaction/audit boundaries and If-Match protections are unchanged. No mobile credentials are forwarded. Frozen revision/key/history semantics remain intact; correction revisions have new IDs. No production auth bypass, browser-storage secret, runtime fixture or seeded real content is added.

## Verification

| Check | Actual result |
|---|---|
| Focused backend contract regressions | **112 passed**, including 19 new matching cases: full/private projection, missing/duplicate/reused/unknown targets, invalid sides, unequal counts, separate namespaces, partial responses, Unicode/long text and forbidden schema extensions. |
| Focused question-bank PostgreSQL + matching contracts | **41 passed**, zero skipped; **37.57 seconds**. Includes atomic invalid-save rejection, private mapping read, public reorder, stale update, publication freeze, new revision retaining old key and live permission/session revocation. |
| Full backend/PostgreSQL regressions | **479 passed**, zero failed/skipped; **88.35 seconds**. Includes all ten backend contracts, identity/class/enrollment/admin/curriculum, migrations and concurrency. Two upstream deprecation warnings remain. |
| Combined client/component regressions | **97 passed**, zero failed/skipped. Nine new tests cover round-trip authoring, key-free projections, malformed mappings, deterministic reassignment, partial/complete readiness, native actual handlers, disabled/checked semantics, reset/phase boundaries, browser controls and field errors. Earlier method/navigation/session regressions pass. Existing Node module-type warnings remain. |
| Next HTTP security integration | **12 passed**, zero skipped; nine-method BFF allowlist plus explicit Flashcards rejection, bounded body/path/method/cookie/header controls, server permission checks, CSRF/logout/revocation and prior curriculum/admin contracts. Synthetic backend contract, not real OIDC. |
| Mobile TypeScript / ESLint | **Passed**. |
| Expo web / Android exports | **Passed**, dist/section16-web and dist/section16-android. Component-only exports do not prove native interaction execution. |
| Ruff / formatting / Python compilation | **Passed**. No configured Python static typechecker was run; backend application source is unchanged. |
| Next production build / TypeScript / ESLint | **Passed**. Browser fixture stopped before final build; final typecheck/lint followed build. |
| Real browser → Next → FastAPI → PostgreSQL | **Verified with disposable synthetic data:** incomplete private mapping blocked; repeated Unicode labels persisted; initially empty safe preview; keyboard selection; association/reassignment clearing prior owner; complete readiness; remove/reset; private key restored on edit; presentation reorder saved with same draft revision ID; publication confirmed by keyboard and edit disabled after freeze; logout cleared protected state and direct /questions redirected to /login?expired=1. |

An initial component check caught React Native Web omitting checked state when only accessibilityState was supplied. Matching now follows the established explicit aria-checked/aria-disabled plus native accessibilityState pattern; regressions pass. Two verification commands initially used the wrong working directory, made no source changes and were rerun correctly. No constraints/tests were weakened to obtain passing results.

Browser QA uses the existing next dev --webpack fallback for the earlier unresolved interactive default-Turbopack refresh issue; production build evidence is separate. Synthetic authentication/session/content exist only in a generated UUID fixture database, with no runtime bypass. The tab and harness servers were closed/stopped and the generated database removed. PostgreSQL tests create/drop only their own generated UUID databases; no existing developer database was reset, downgraded or seeded. Ignored evidence includes section16-*.log and private-data/verification/section16-preview.png.

**Unverified:** physical/emulator interaction, orientation transitions on a device, TalkBack/VoiceOver, native scaling/long-text scrolling/focus/Back/blur integration, comprehensive accessibility audit, deployed TLS/cookies and real OIDC/provider MFA. Real sign-in remains deliberately disabled until configured. No PostgreSQL integration checks were skipped in the final run.

## Every changed file and preservation

Relative to the pre-section SHA256 baseline: **13 existing files changed, 5 new files including this report, 268 previous files unchanged, zero removed**. Backend application/models, manifests, dependencies, environment files and frozen migration history are unchanged. Original PROJECT_HANDOFF.md and the existing mobile package-lock modification are preserved; package-lock SHA256 remains 92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6.

```text
AGENTS.md
README.md
apps/admin/src/app/api/admin/questions/[[...segments]]/route.ts
apps/admin/src/components/question-editor.tsx
apps/admin/src/components/question-manager.tsx
apps/admin/src/services/questions-contract.ts
apps/mobile/src/features/questions/MatchingQuestion.tsx
apps/mobile/src/features/questions/matching.ts
docs/API_DESIGN.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/QUESTION_BANK.md
docs/SECTION_16_REPORT.md
scripts/admin-web.test.mjs
scripts/choice-components.test.cjs
scripts/matching.test.mjs
services/api/tests/integration/test_question_bank_postgresql.py
services/api/tests/test_matching_methods.py
```

## Section 17 prerequisites

**Ready to proceed to Section 17 after your acceptance and its authoritative prompt.** No blocker remains for the authorized unscored Matching foundation. Do not infer Section 17 scope from provisional roadmap numbering or claim all ten interfaces are complete. Flashcards needs its own authorization; reused-target cardinality, randomization/seed retention, scoring/partial credit, feedback/release rules and attempt/delivery permissions remain deferred. A future host must authorize pinned immutable revisions, validate responses server-side and own session/navigation cleanup. Real operator use still requires OIDC/MFA/TLS configuration, with native/accessibility checks tracked separately. Work stops here before Section 17.
