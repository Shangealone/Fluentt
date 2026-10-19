# Section 14 — Multiple Select and Error Identification

Completed 2026-10-19 (Asia/Manila), following an interruption after the initial implementation/tests on 2026-10-18. No Section 15 implementation, commit or push.

## Inspection and approved scope

Reviewed PROJECT_HANDOFF.md, development plan, Sections 11–13 reports, question-bank/API/architecture/decisions/security documentation, application instructions, Git changes and relevant services/models/editor/BFF/mobile/tests. Consulted installed Next.js client-component guidance, Expo SDK 58 documentation and React Native accessibility documentation. The handoff remains historical through Section 05; later accepted reports establish the current implementation and migration head 0006.

Two material representational questions were resolved explicitly before implementation:

1. Preserve Multiple Select's existing one-or-more correct IDs, allow zero selections as an unfinished preview, serialize in option order, and defer configurable bounds/scoring.
2. Use Error Identification's existing ordered whole tokens, support multiple target IDs, preserve optional private correction metadata, omit learner correction entry and keep offsets/spans unsupported. No published payload is rewritten.

No further grading or normalization policy was invented. Existing contracts suffice without backend semantic changes or migrations.

## Delivered contracts and workflows

The protected Next **/questions** page now supports six methods. Both new editors reuse existing real FastAPI create/replace/new-revision/key/preview/publish/retire APIs, search/filter/history, explicit question grants, field errors, loading/empty/retry states, unsaved guards and ambiguous-save reconciliation. A dashboard description was updated to reflect supported question methods. Existing mobile identity/class/enrollment and four earlier editors remain intact.

| Method | Authoring/private contract | Safe interaction and response |
|---|---|---|
| multiple_select | content.options: at least two nonblank {id,text} entries with distinct IDs; private correct_option_ids: a nonempty distinct subset. One correct option remains valid. | Independent checkboxes; select/deselect any available options. Empty is unfinished. `{method:'multiple_select',answer:{option_ids:[...]}}`, serialized in content order. No public required count or configurable bounds. |
| error_identification | content.tokens: at least one whole nonblank {id,text} segment, ordered with distinct IDs; private error_token_ids: a nonempty distinct subset. Optional accepted_corrections retains arrays for any known token, including non-target entries and empty arrays. | Whole independently wrapping segments, labeled by position/text and selected via checkboxes. `{method:'error_identification',answer:{selected_token_ids:[...]}}` in token order. No correction text field or grammar evaluation. |

Shared option/segment controls retain stable IDs through text edits and reorder. Removing an entry clears its target and correction references; adding creates a fresh ID. Invalid private correction JSON remains editable but blocks saving. An advanced JSON field preserves existing correction metadata, including valid empty arrays, without silently splitting strings or imposing new correction policy.

Prompt and segments are separate existing fields. Segment text is not cut from a prompt by offsets, automatically tokenized, or reconstructed into an exact sentence. Segments retain author reading order and wrap independently. Existing author TextValue trimming remains unchanged. Whole Unicode/Tagalog strings, combining marks and emoji are displayed as text without slicing or unsafe HTML. Offset/span alternatives, including overlapping offsets or offsets inside Unicode sequences, are rejected as unsupported fields. Overlap is unrepresentable in this contract; no new span validator/editor is claimed.

Browser **MultiPreview** receives only allowlisted public fields. It supports independent toggling, count/status/reset, unfinished empty state, native checkbox keyboard controls and no correctness feedback. Public DTOs omit keys, target counts, corrections, explanation and grading metadata. A selected-count display reflects local interaction, never the private correct-answer count.

Expo **MultiSelectionQuestion/UnscoredMultiPreview** reuse Section 12's choice styles and established UI states. multi.ts validates/projects safe revision fields and builds typed ID-only sets in content order regardless of tap order. Unknown/duplicate response IDs are not presented as selected; unsupported or malformed segment representations do not become renderable items. Native checked/disabled checkbox semantics, scalable wrapping text, position labels and local reset are implemented. Revision/resetKey, loading/error/empty/inactive/unmount boundaries discard local preview state. Future hosts must use Screen for scrolling and clear their own attempt state on blur/session loss. No learner route, bank client, attempt, submission, scoring or persistence API is added.

## Security, persistence and compatibility

The existing fixed same-origin BFF now allows six implemented editor methods. Its path/method/header/cookie allowlists, 64 KiB body limit, Origin/CSRF, no-store and invalid-session behavior remain unchanged. FastAPI remains authoritative for live explicit questions.read/write/publish, object relationships, transactions and optimistic If-Match. Private keys require write; publication/retirement require all three grants. Mobile credentials remain rejected.

No backend application/model/schema behavior changes: existing validators enforce duplicate/unknown IDs, legal correct sets and strict payloads; existing transactions atomically replace content plus keys. Locked versions/history remain immutable; corrections create new revision IDs, and retirement retains history. Current source migration head is **0006_question_associations**. No dependencies, environment settings, migrations, schema tables, real content or production accounts were added.

## Verification evidence

| Check | Actual result |
|---|---|
| Focused backend schemas, including earlier methods | **97 passed**. Includes 15 new parametrized cases for one/many targets, unfinished empty responses, duplicate/unknown references, unsupported bounds/spans/overlap representations, private correction compatibility and long Unicode tokens. |
| Focused question-bank PostgreSQL + new contracts | **34 passed**, zero skipped; 29.93 seconds. New per-method HTTP/database tests verify atomic replacement/rollback, stale updates, publication, correction revisions/frozen history, safe reads, private keys and live write/session revocation. |
| Full backend/PostgreSQL regressions | **432 passed**, zero failed/skipped; **82.57 seconds**. Identity/session/class/enrollment/admin/curriculum/all-ten-method/migration/concurrency regressions included. Two existing upstream deprecation warnings remain. |
| Focused client/state/components | **33 passed** across the six supported editors/renderers. |
| Combined client regressions | **78 passed**, zero failed/skipped. Ten new tests cover safe DTOs, canonical toggles, empty/disabled states, actual native handlers, reset/state boundaries, stable-ID edits/removal, correction metadata, Unicode/long text, malformed spans and preview escaping. Existing Node module-type warnings remain. |
| Real Next HTTP regressions | **12 passed**, zero skipped. Six-method BFF boundary, protected rendering, cookies/headers/body/path restrictions, CSRF/logout/revocation and earlier admin/curriculum contracts. Uses a synthetic backend, not a real OIDC provider. |
| Mobile TypeScript / ESLint | **Passed**. |
| Expo web / Android exports | **Passed**: dist/section14-web and dist/section14-android. These exports do not execute the new component on a native device; no learner route hosts it yet. |
| Backend Ruff / formatting / compilation | **Passed**. Backend source unchanged; no configured Python static typechecker was run. |
| Final Next production build / TypeScript / ESLint | **Passed** after resumption, including /questions and the fixed BFF. Browser fixture stopped before production build; final typecheck/lint followed the build. |
| Browser: Multiple Select | **Verified before interruption** with real Next/FastAPI/disposable PostgreSQL: missing correct set rejected; two correct IDs saved after reorder; editor restored stable IDs, order and checks; draft PUT to one correct ID; saved multi-checkbox toggle/deselect/reset; keyboard publication confirmation and frozen state. |
| Browser: Error Identification | **Verified after resumption** using a fresh synthetic session/database: unknown correction reference rejected; Unicode whole segments and private map saved/restored; reordered target followed its stable ID; removal cleared correction references; a new segment used a fresh ID; draft PUT retained revision ID; safe preview allowed multiple toggles/reset without correction input/private data; publication froze the revision. Logout hid protected data and direct /questions access redirected to /login?expired=1. |
| Device/provider/accessibility limits | **Unverified**: native physical/emulator execution, TalkBack/VoiceOver, comprehensive text-scaling/small-screen/long-token interaction and future host Back/blur integration; real OIDC/MFA and deployed TLS/cookies. |

The interruption did not finish the section automatically: implementation and major tests were saved, but browser QA, final production build and documentation/report remained. On resumption the original synthetic session had expired and the website correctly redirected to sign-in. The old harness was stopped and its generated UUID database removed; remaining UI checks used a fresh disposable fixture. No application authentication bypass, session-policy extension or actual provider configuration was introduced.

Browser QA uses **next dev --webpack**, the existing local fallback for Section 12's unresolved interactive default-Turbopack refresh issue. Default production build and HTTP regression evidence are separate. Fixtures are labeled synthetic; they do not claim academic content, correct grammar, evaluated scores or real MFA. Ignored evidence includes section14-*.log, section14-resume-*.log and private-data/verification/section14-preview.png. Both browser harnesses stopped and removed only their own generated UUID databases. No production browser/API test process was left running. A stale tab for the stopped first fixture could not navigate because its connection-error page was blocked by browser tooling; a fresh tab completed the remaining checks without weakening application security and was closed.

## Preservation and every changed file

Relative to the pre-section SHA256 baseline: **16 existing files changed, 5 new files including this report, 255 previous files unchanged, zero removed**. All frozen migrations/SQL, backend application source, original handoff, dependency/environment files and earlier unrelated modifications remain unchanged. The original mobile package-lock SHA256 remains **92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6**. No existing developer database was reset, downgraded or seeded.

```text
AGENTS.md
README.md
apps/admin/src/app/api/admin/questions/[[...segments]]/route.ts
apps/admin/src/app/dashboard/page.tsx
apps/admin/src/app/globals.css
apps/admin/src/components/question-editor.tsx
apps/admin/src/components/question-manager.tsx
apps/admin/src/services/questions-contract.ts
apps/mobile/src/features/questions/ChoiceQuestion.tsx
apps/mobile/src/features/questions/MultiSelectionQuestion.tsx
apps/mobile/src/features/questions/multi.ts
docs/API_DESIGN.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/QUESTION_BANK.md
docs/SECTION_14_REPORT.md
scripts/admin-web.test.mjs
scripts/choice-components.test.cjs
scripts/multi-methods.test.mjs
services/api/tests/integration/test_question_bank_postgresql.py
services/api/tests/test_multi_methods.py
```

## Section 15 prerequisites

Section 15 requires acceptance of this section and its authoritative prompt. Do not infer permission for the remaining four editors, grading, attempts, delivery, AI or research. Configurable bounds, completion/submission rules, partial credit, penalties, correction evaluation/normalization and feedback release remain deferred until approved. Future learner hosts must bind an authorized immutable version/context, enforce backend permissions and own scrolling/navigation/session cleanup.

Real administrator operation still requires locally configured OIDC with approved MFA evidence and TLS; the user requested sign-in remain disabled until then. Native/accessibility verification and the earlier default-dev refresh issue remain environment follow-ups.

**Ready for Section 15 after Section 14 acceptance and receipt of its authoritative prompt.** No implementation blocker remains for the approved unscored set/token foundation. The environment limitations above remain explicit. Work stops here; Section 15 has not begun.
