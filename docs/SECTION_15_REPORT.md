# Section 15 — Word and Sentence Arrangement

Completed 2026-10-19 (Asia/Manila). No Section 16 implementation, commit or push.

## Inspection and approved policy

Reviewed the historical PROJECT_HANDOFF.md, development plan, accepted Sections 11–14 reports, question-bank/API/architecture/security/decision documents, instructions, current Git changes and relevant validators/services/publication controls/admin/mobile/tests. Consulted installed Next.js client-component guidance, Expo SDK 58 and React Native accessibility documentation. Later accepted reports supersede historical handoff status/head notes; migration head remains 0006.

Existing V1 contracts already define both methods as public items[{id,text}] (minimum two, distinct stable IDs) and private ordered_ids (complete permutation). The user explicitly approved authored public order separate from private expected order, no automatic shuffle, initially empty learner sequences, tap/append plus move/remove/reset and readiness only when every ID appears exactly once. Grading and alternative valid orders remain deferred.

## Delivered implementation

The protected **/questions** module now supports eight methods. Word/Sentence Arrangement reuse the existing real secured APIs, permissions, search/filter/paged history, private key reads, transactional draft replacement, correction revisions, publication and whole-item retirement. No backend application/model/schema behavior, API endpoint, permission, migration, dependency or learner delivery route is added.

Both editors provide explicit whole word/token or sentence unit fields, stable IDs and independent presentation-order controls. Repeated visible labels are valid with distinct IDs. Authors deliberately build a separate private expected sequence by appending each unit once, moving/removing entries or resetting. Missing/duplicate/unknown references cannot save. Public reorder or text edits preserve private ID associations; removing a unit removes its private reference, while new units require deliberate inclusion. A warning appears when visible order equals the private sequence, since authored presentation can itself imply an answer. No automatic splitting, shuffling, random seed or alternative-order policy is introduced.

Existing author metadata trimming remains unchanged. Whole Unicode/Tagalog text, punctuation, combining marks and emoji are displayed without slicing or HTML interpretation. Word units are not automatically split on whitespace; sentence units are not automatically split on punctuation. Private ordered_ids, explanation and grading metadata never enter safe preview props. Removing private fields cannot guarantee that author-supplied text/order contains no semantic hints; author review remains necessary.

Shared browser **SequenceControls** power the private builder and key-free **ArrangementPreview**. Public previews start empty and use native keyboard-accessible buttons to append, move earlier/later, remove, review and reset. Available units disable after selection; repeated taps cannot duplicate an ID. Source unit numbers and numbered sequence rows distinguish repeated labels. Wrapping controls accommodate long sentences. No answer comparison, score or correctness feedback is calculated.

Expo **ArrangementQuestion/UnscoredArrangementPreview** use the established Button, card, text and loading/error/retry/empty patterns. There was no existing arrangement drag infrastructure to extend; the approved tap/button alternative avoids a new dependency and offers explicit screen-reader/keyboard-friendly actions. The controlled component keeps raw ordered ID buffers; the optional host resets them on revision/resetKey or loading/error/empty/inactive/unmount boundaries. Future route hosts must use Screen for scrolling/keyboard avoidance and clear their own attempt state on blur/session loss. No route or bank/submission client is exposed.

| Method | Safe public units | Private expected answer | Complete local response |
|---|---|---|---|
| word_arrangement | items[{id,text}], at least two | ordered_ids, every ID once | {method:'word_arrangement',answer:{ordered_token_ids:[...]}} |
| sentence_arrangement | items[{id,text}], at least two | ordered_ids, every ID once | {method:'sentence_arrangement',answer:{ordered_sentence_ids:[...]}} |

The presentation adapter explicitly projects only safe fields and rejects malformed/duplicate/missing units. IDs are independent of display text. Complete response arrays are copied in the learner's chosen order. **Ready means structural completeness only**: both forward and reversed complete permutations are ready; neither is graded. Partial/empty local buffers yield no complete callback response. Existing backend partial-draft response semantics remain unchanged; future submission must bind an authorized pinned revision/context and validate it server-side. No attempt persistence is added.

## Security and preservation

The same fixed BFF now allowlists the eight authorized editor methods; unsupported matching/flashcard editors remain unavailable. Dedicated cookie sessions, Origin/CSRF, no-store, bounded JSON, fixed path/method/header forwarding and authoritative FastAPI permission checks remain unchanged. Private key reads require questions.read+write; publication/retirement require read+write+publish. Live revocation clears/gates editor state through the existing manager; no browser storage or authentication bypass is added.

If-Match and existing transactions guard atomic replacement and stale edits. Published revisions/keys remain frozen; corrections use new revision IDs and historical expected sequences remain intact. All ten backend identifiers, frozen migrations/SQL and unrelated prior changes are preserved. No existing developer database was reset/downgraded/seeded; synthetic tests use generated disposable UUID databases only. Real OIDC/MFA sign-in remains intentionally disabled until configured.

## Verification

| Check | Actual result |
|---|---|
| Focused backend schema regressions | **122 passed**, including 25 new parametrized cases: complete/reversed expected permutations, repeated labels, missing/duplicate/unknown units/keys, wrong response envelopes, Unicode/long sentences, safe previews and preserved partial drafts. |
| Focused question-bank PostgreSQL + arrangement contracts | **46 passed**, zero skipped; 31.76 seconds. Per-method HTTP/database checks cover private order, atomic invalid-save rollback, public reorder, stale updates, publication, immutable/new revisions and live write/session revocation. |
| Full backend/PostgreSQL regressions | **459 passed**, zero failed/skipped; **81.38 seconds**. Includes identity/session/class/enrollment/admin/curriculum/all-ten-method/migration/concurrency regression. Two existing upstream deprecation warnings remain. |
| Focused client/component checks | **43 passed**, including prior six methods and the new arrangement tests. |
| Combined client regressions | **88 passed**, zero failed/skipped. Ten new tests cover independent key/presentation order, repeated IDs versus labels, malformed data, safe DTOs, copied responses, append/repeat/move/remove/reset, readiness, native actual handlers/disabled states, preview state boundaries, keyboard buttons and safe rendering. Existing Node module-type warnings remain. |
| Real Next HTTP integration | **12 passed**, zero skipped: eight-method BFF boundary, path/method/body/cookie/header restrictions, server permission gates, CSRF/logout/revocation and previous administrator/curriculum contracts. Synthetic backend contract, not real OIDC. |
| Mobile TypeScript / ESLint | **Passed**. |
| Expo web / Android exports | **Passed**: dist/section15-web and dist/section15-android. Components have no learner route; exports do not prove native interaction execution. |
| Backend Ruff / formatting / compilation | **Passed**. No configured Python static typechecker was run; backend app source is unchanged. |
| Final Next production build / TypeScript / ESLint | **Passed**, including /questions and the fixed BFF. Browser harness stopped before production build; final typecheck/lint followed build. |
| Real browser + Next/FastAPI/PostgreSQL | **Verified with disposable synthetic data.** Word flow: incomplete private sequence rejected; repeated labels with distinct IDs persisted/restored; independent presentation/key edits and equal-order warning; draft PUT retained revision ID; initially empty safe preview; append/move/remove/reset/readiness; keyboard publication confirmation and frozen state. Sentence flow: explicit Unicode/punctuation units saved, wrapped in safe preview, arranged to ready without scoring, reset and published/frozen. Logout hid protected data; direct /questions access redirected to /login?expired=1. |
| Native/provider/accessibility limits | **Unverified**: physical/emulator execution, TalkBack/VoiceOver, native text scaling, small-device long-sentence scrolling/focus/Back/blur integration; deployed TLS/cookies and real OIDC/MFA. Browser keyboard checks are not a comprehensive accessibility audit. |

The first administrator typecheck caught an arrangement discriminated-union narrowing issue; it was corrected to distinct public variants and typecheck passed. No backend test failures or weakened constraints were needed. The published root status still does not authorize delivering a newer draft; no student availability policy is inferred.

Browser QA uses the existing **next dev --webpack** fallback for Section 12's unresolved interactive default-Turbopack refresh issue; production build evidence is separate. Synthetic sessions/content exist only in a generated fixture database, never runtime production configuration. Ignored evidence: section15-*.log and private-data/verification/section15-preview.png. The browser tab/harness servers were closed/stopped and the generated UUID database was removed. No existing developer database was reset or populated with fixture records.

## Every changed file

Relative to the pre-section SHA256 baseline: **14 existing files changed, 5 new files including this report, 262 previous files unchanged, zero removed**. Backend application source, manifests, lockfiles, environment files and migration history remain unchanged. Existing mobile package-lock SHA256 remains **92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6**; the original handoff is unchanged.

```text
AGENTS.md
README.md
apps/admin/src/app/api/admin/questions/[[...segments]]/route.ts
apps/admin/src/app/globals.css
apps/admin/src/components/question-editor.tsx
apps/admin/src/components/question-manager.tsx
apps/admin/src/services/questions-contract.ts
apps/mobile/src/features/questions/ArrangementQuestion.tsx
apps/mobile/src/features/questions/arrangement.ts
docs/API_DESIGN.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/QUESTION_BANK.md
docs/SECTION_15_REPORT.md
scripts/admin-web.test.mjs
scripts/arrangement.test.mjs
scripts/choice-components.test.cjs
services/api/tests/integration/test_question_bank_postgresql.py
services/api/tests/test_arrangement_methods.py
```

## Section 16 prerequisites

Receive acceptance and the authoritative Section 16 prompt before new work. Do not infer the next method or grading scope from the provisional roadmap. Alternative acceptable sequences, normalization/punctuation equivalence, automatic grading/partial credit, randomization/seed retention, attempt persistence and feedback/release policies remain unresolved until separately authorized. A future learner host/API must bind authorized immutable content, own navigation/session cleanup and enforce backend rules.

Real operator use still needs approved OIDC/MFA/TLS configuration; native/accessibility checks and the earlier default-dev issue remain environment follow-ups.

**Ready for Section 16 after Section 15 acceptance and receipt of its authoritative prompt.** No implementation blocker remains for the approved unscored arrangement foundation. The verification limits above remain explicit. Work stops here; no Section 16 work has begun.
