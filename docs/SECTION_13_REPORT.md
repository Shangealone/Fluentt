# Section 13 — Identification and Fill in the Blank

Completed 2026-10-18 (Asia/Manila). No Section 14 implementation, automatic commit or push.

## Inspection and approved decisions

Reviewed the preserved handoff, development plan, Sections 11–12 reports, question-bank/API/security/architecture/decision documents, application instructions, current Git changes and relevant backend/model/editor/BFF/mobile tests. Read installed Next.js client-component guidance and React Native TextInput/ScrollView documentation. The original handoff is historical through Section 05; later accepted reports establish the current implementation and migration head 0006.

Two missing contract decisions were approved explicitly before implementation:

- Add optional input_max_length to existing text-method JSON content: strict integer 1–2,000 Unicode code points per field; new editor drafts default to 500; legacy absence means no declared limit. No published row is rewritten.
- Add opt-in template_syntax="double-brace-v1" for exact {{blank_id}} markers, each once in declared order. Untagged legacy prompts stay literal with separate labeled fields.

The prompt's raw-response requirement conflicted with the old TextValue whitespace stripper. Identification and blank response models now validate nonblankness while returning the original string. Other methods and author expected-answer metadata retain their existing semantics. This is not a grading/normalization policy. No unanswered material policy blocks this section; free-text evaluation remains deferred.

## Delivered functionality

The existing protected Next **/questions** management module now supports four authoring methods. Identification has private newline-separated expected-answer metadata, retained case_sensitive metadata, optional input limit and a labeled unscored text preview. Fill in the Blank has stable gap IDs, private expected-answer groups, add/remove controls, optional limits, explicit template opt-in and multi-gap preview. Saved data comes from the real secured Section 11 endpoints. Existing question grants, private-key access, search/filter/history, loading/empty/retry/error states, field errors, unsaved guards, uncertain-save reconciliation, live session checks and logout clearing remain in place.

Tagged templates reserve braces and reject malformed/spaced/nested/unclosed/unknown/duplicate/missing markers. Every marker must match blank_ids exactly once in order. The editor explicitly uses passage order when saving, retaining each stable ID's private answer association. Adding a gap appends its marker; removing a gap removes its exact markers. Legacy syntax is never inferred from prompt text. Both browser/native presentation show plain text and `[Gap N]` references paired with labeled fields; no HTML is interpreted.

The same fixed BFF paths now allow identification/fill_in_the_blank writes alongside Section 12's two methods. No endpoint, public/mobile bank client, permission or session contract is added. Dedicated cookies, no-store responses, bounded JSON, Origin/CSRF, backend live authorization and If-Match remain authoritative. Published revisions cannot be edited; corrections use new revision IDs, and retirement/history follow the existing whole-item lifecycle. Expected answers, explanations and correctness fields never enter presentation DTOs.

Backend Pydantic/ORM validation enforces optional limits, exact template mapping, complete private answer maps and metadata that fits declared limits. Absent/null optional additions serialize as absent, preserving legacy {} / blank_ids payloads. Raw response strings preserve spaces, line breaks, case, punctuation, diacritics, combining forms and emoji. Python len and client Array.from count code points; combining forms are not normalized and code points are not grapheme clusters.

Typed complete responses remain:

```text
{method:"identification", answer:{text:raw}}
{method:"fill_in_the_blank", answer:{blanks:[{blank_id, text:raw}]}}
```

The shared validator keeps existing partial-draft compatibility and adds optional require_complete=True for exact blank coverage. Unknown/duplicate IDs and over-limit fields fail. The future response envelope alone does not establish revision-bound validity: a future authorized host/API must bind the actual server-selected method/content and invoke validation. No submission, attempt engine, scoring, feedback release or persistence API is added.

Expo **TextQuestion** is controlled through raw field buffers; **UnscoredTextPreview** provides local reset/state boundaries. text.ts projects key-free authorized revisions and builds complete typed responses in item order, without trimming or normalization. Empty/over-limit buffers stay editable but yield no complete response. Inputs disable autocorrect/capitalization/spelling, expose labels/counters/errors and next/done focus handlers, and preserve multiline buffers. Hosts use the established Screen for scrolling/keyboard avoidance and own blur/session/attempt-state cleanup. Revision/resetKey changes and loading/error/empty/inactive/unmount transitions discard the preview's local state. No new learner route is opened.

## Verification

| Check | Actual result |
|---|---|
| Focused backend contract checks | **82 passed**: prior ten-method schemas plus new legacy serialization, Unicode/code-point limits, raw response preservation, strict limits, malformed templates and explicit complete mapping. |
| Focused question-bank PostgreSQL + new contracts | **36 passed**, zero skipped. Includes real text-method persistence, private/read separation, immutable legacy history/new revisions and ORM prompt validation. |
| Raw response PostgreSQL round-trips | **2 passed** after fixture correction. Exact raw text survives JSONB reload; over-limit ORM updates fail and retain the original answer; no score/correctness is assigned. Existing assignment tables are used only as storage fixtures. |
| Final full backend/PostgreSQL regressions | **415 passed**, zero failed/skipped, **87.94 seconds**. Existing identity/session/class/enrollment/admin/curriculum/question/migration/concurrency checks included. Two upstream deprecation warnings remain. |
| Combined client/state/component regressions | **68 passed**, zero failed/skipped. Nine new text-specific tests cover metadata/legacy round-trips, parsers, exact/raw responses, safe projections, prototype-like IDs, actual native change/focus/disabled handlers, state boundaries, editor errors and plain-text escaping. Existing Node module-type warnings remain. |
| Final targeted client rerun | **23 passed**, zero skipped, after the final shared expected-answer error display adjustment. |
| Real Next HTTP regressions | **12 passed**, zero skipped: prior administrator/curriculum checks plus four-method BFF boundary, protected server rendering, cookie/header/path/body restrictions, CSRF/logout/revocation. Synthetic backend contract, not a real provider. |
| Mobile TypeScript / ESLint | **Passed**. |
| Expo web / Android exports | **Passed**: dist/section13-web and dist/section13-android. Export does not execute the component on a device; no component route exists yet. |
| Backend Ruff / compilation | **Passed**. No configured Python static typechecker was run; Pydantic contracts and Python compilation are not a substitute for one. |
| Final Next production build / TypeScript / ESLint | **Passed**, including /questions and its fixed BFF. Build completed after the browser harness stopped; typecheck/lint ran after build. |
| Real browser + Next + FastAPI + PostgreSQL | **Verified with disposable synthetic fixtures**: Identification create/save/private metadata restoration; raw Unicode/whitespace preview and code-point count; over-limit input retained; reset; keyboard publication confirmation and frozen edit removal. Multi-gap creation, malformed-template field error, reordered passage persistence with correct private answer association, saved key-free preview, combining Unicode/pasted line breaks, reset and publication. Logout hides data and a direct /questions visit redirects to expired sign-in. |
| Native/provider/TLS/accessibility | **Unverified**: physical/emulator keyboard/IME/scrolling/Android Back integration for a future host, comprehensive screen-reader/text-scaling/small-viewport coverage, real OIDC/MFA and deployed TLS cookies. Sign-in intentionally remains disabled without configuration. |

Initial full regression had two failures in the newly added storage fixtures: an attempt was created before its assignment version was locked; the first correction also exposed its missing private key. Fixtures were corrected to satisfy the existing key/question/assignment locks. Focused storage checks and the final complete suite passed. No database constraint or application guard was weakened. The restricted process view initially reported PostgreSQL stopped; a normal-host check confirmed the existing isolated cluster was already running. No reset was performed.

Browser verification reused the earlier isolated harness with **next dev --webpack**, avoiding Section 12's unresolved interactive default-Turbopack refresh issue. Production build/HTTP regression results are separate evidence. The harness issued synthetic HttpOnly sessions only in a generated UUID database; no production auth bypass, real administrator, provider mapping or curriculum seed was added. Its servers stopped and generated database was removed. Ignored evidence includes private-data/verification/section13-preview.png and section13-*.log. The screenshot is synthetic unscored input, not academic content or measured correctness.

## Preservation and all changed files

No dependency, environment, migration or lockfile change. Frozen migrations and SQL, ten method identifiers, earlier mobile identity/enrollment/routing and PROJECT_HANDOFF.md remain unchanged. Migration head remains **0006_question_associations**. The existing developer database was not reset, downgraded or seeded. The original mobile package-lock SHA256 remains **92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6**.

Relative to the pre-section SHA256 baseline: **17 existing files changed, 6 new files (including this report), 248 prior files unchanged, zero removed**. Complete 23-file list:

```text
AGENTS.md
README.md
apps/admin/src/app/api/admin/questions/[[...segments]]/route.ts
apps/admin/src/app/globals.css
apps/admin/src/components/question-editor.tsx
apps/admin/src/components/question-manager.tsx
apps/admin/src/services/questions-contract.ts
apps/mobile/src/features/questions/TextQuestion.tsx
apps/mobile/src/features/questions/text.ts
docs/API_DESIGN.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/QUESTION_BANK.md
docs/SECTION_13_REPORT.md
scripts/admin-web.test.mjs
scripts/choice-components.test.cjs
scripts/text-methods.test.mjs
services/api/app/models/validation.py
services/api/app/modules/questions/schemas.py
services/api/app/schemas/question_config.py
services/api/tests/integration/test_question_bank_postgresql.py
services/api/tests/integration/test_text_responses_postgresql.py
services/api/tests/test_text_methods.py
```

## Section 14 readiness and open policies

**Ready to proceed to Section 14 after Section 13 acceptance and receipt of its authoritative prompt**, subject to the explicitly unverified environment checks above. No implementation blocker remains for this text-method foundation. No Section 14 work has begun.

Keep scoring/normalization, accent/punctuation/case/synonym equivalence, partial credit, response persistence/release, attempt binding/timing and practice-versus-controlled-test feedback unresolved until separately authorized. A future mobile host must wire authorized delivery and Screen/blur/session cleanup before claiming end-to-end learner use. Real administrator operation needs configured OIDC with approved provider MFA evidence and TLS; the user explicitly requested disabled sign-in until then. Device/IME/accessibility and the earlier default-dev refresh issue remain verification follow-ups, not claims of passing behavior.
