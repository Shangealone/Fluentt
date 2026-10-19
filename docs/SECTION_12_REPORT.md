# Section 12 — Multiple Choice and True or False

Completed 2026-10-18 (Asia/Manila). No Section 13 work, commit or push.

## Inspection and scope

Read the preserved PROJECT_HANDOFF.md, development plan, Section 11 report and question-bank/API/security/decision documents; inspected Git changes, backend schemas/lifecycle/permissions, Next administration/BFF/session patterns and Expo UI/tests. The handoff remains historical through Section 05; accepted reports establish current migration head 0006. Read both application AGENTS files, installed Next route/component guides, [Expo SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/) and [React Native accessibility documentation](https://reactnative.dev/docs/accessibility).

No material policy conflict: the supplied Section 12 prompt explicitly authorizes the two editors and reusable unscored renderers that Section 11 deferred. Existing single correct_option_id and strict boolean contracts suffice; no new grading, academic verification, media, permissions or learner-delivery policy was inferred. Real OIDC remains disabled as previously requested. No real educational content, admin account or permission grant was seeded.

## Delivered interfaces and contracts

Protected Next **/questions** verifies the separate administrator session before rendering the management module. Navigation/dashboard links require questions.read; absence produces an explicit access-required state. Read-only accounts get safe preview/history, editors get private-key-backed authoring, and publish/retire require read+write+publish. Curriculum permissions remain independent.

The page provides method selection, literal prompt search, lifecycle filters, paged items and revision history; create/edit draft, explicit correction revision, unsaved/saved unscored preview, publication and whole-item retirement. Unsupported method history is labeled unavailable in this editor. Empty/loading/retry/error/conflict states and accessible confirmations reuse established visual patterns. Forms use labeled controls, associated errors, metadata details, wrapping layouts and stable option controls. Unsaved changes guard in-page navigation, links and close/reload. No form draft/key or bearer credential is persisted in browser storage.

| Method | Authoring and backend contract | Presentation/response |
|---|---|---|
| multiple_choice | Nonblank prompt, at least two text options, distinct stable IDs, exactly one existing correct_option_id. Array order is authoritative. Generated IDs survive text edits and reorder; removing the correct option clears it and requires a replacement. Backend revalidates everything. | Key-free prompt/instructions/options, one selected radio; `{method:'multiple_choice',answer:{option_id}}`. Repeated taps do not toggle/double-select. |
| true_false | Empty content object and one strict boolean key. No free-form answer-option editor. Missing is distinct from false. | True/False radios; `{method:'true_false',answer:{value:boolean}}`. False restores/selects correctly. |

Existing points/difficulty/schema/competency/language/explanation metadata is retained. Lesson and optional same-lesson competency UUIDs come from existing records; browse Curriculum with its separate read grant or use operator-provided IDs. No implicit curriculum permission or new picker/catalog API is added. Text only; no media or content generation. Source/licensing and academic correctness are not independently verified by this UI.

Draft saves use the existing real create/PUT/new-revision endpoints and whole-item If-Match, followed by server restoration. Publication freezes the selected revision; historical versions remain immutable and corrections create new IDs. Retirement preserves history and removes authoring controls. Non-idempotent saves with an unknown/network/timeout/server/gateway failure are treated as potentially committed: further saving is disabled until bank/history reconciliation. No automatic creation retry assumes deduplication.

The fixed **/api/admin/questions/[[...segments]]** BFF allowlists only existing collection/item/revision/key/publish/retire paths and GET/POST/PUT operations. JSON writes are bounded to 64 KiB and limited to these two methods. It forwards only dedicated admin cookies, validated CSRF/If-Match and configured Origin, never mobile Authorization/unrelated cookies/arbitrary URLs. Backend permission/relationship/version validation remains authoritative. Pages/proxy responses are no-store; invalid sessions clear only the relevant cookie.

Question data is hidden during background/restored/idle access verification; permission/session denial clears protected/private state. Sign-out clears it before sending revocation. Async reads and editor saves ignore superseded results, and writes have a synchronous single-flight guard. Final review hardened structured gateway/server errors as uncertain saves and validated the marker returned with private editor data.

## Reusable Expo foundation

`features/questions/choice.ts` defines key-free presentation and typed response contracts, explicit projection from authorized revision data, strict ID/boolean validation and deterministic selection helpers. It never spreads a private definition. It rejects malformed/unsupported item shapes, preserves order and ignores invalid/repeated choices.

`ChoiceQuestion.tsx` exports controlled **ChoiceQuestion** and optional **UnscoredChoicePreview**. They use existing theme/components, wrapping/scalable text, minimum-height controls, radio/group labels, checked/disabled state, loading/error/retry/empty states and explicit reset. The host discards local state when its revision/resetKey changes, it becomes inactive, or loading/error/empty/unmount replaces interaction. Future routes must unmount/set active=false on blur and clear their own attempt-level answer state; callbacks are local interaction events, not stored submissions.

**No mobile route or question API client is added.** Existing student/instructor portals cannot browse unpublished bank items. Components are ready for later authorized hosts; they do not fetch bank data, store responses, grade, publish scores, select assignments or implement timing. Browser preview similarly takes only an allowlist of public fields; private editor keys/explanation never enter its props or rendered output. The other eight methods remain backend contracts only.

## Verification

| Check | Actual result |
|---|---|
| New method/state/component tests | **14 passed** after final interrupted-save case. Covers authoring/ordering/invalid IDs and fields, false vs missing, projections/private-field omission, repeated/invalid taps, real option handlers, disabled/radio semantics, loading/error/empty/away/reset identity, browser preview and field-error markup. |
| Combined new + existing client/state/static component regressions | **59 passed**, zero failed/skipped. Existing Node module-type warnings remain. |
| Real Next HTTP integration | **12 passed**, zero failed/skipped: prior auth/curriculum regression plus question server permission gates, anonymous denial, BFF path/method/body/Origin/header/cookie restrictions and two-method write boundary. Synthetic backend contract, not real OIDC. |
| Complete backend with disposable PostgreSQL | **391 passed**, zero skipped, 81.40 seconds. Includes all ten method validation/storage, question lifecycle/private-key access, immutable history, migration/preflight/concurrency and earlier identity/class/enrollment/admin/curriculum regressions. Two existing upstream deprecation warnings. |
| Mobile TypeScript / ESLint | **Passed**. |
| Expo web / Android exports | **Passed**, dist/section12-web and dist/section12-android. Export is not native-device execution. New reusable components have no route, so app export does not establish an end-user native pathway for them. Their source is covered by TypeScript and component/state tests. |
| Final Next production build / TypeScript / ESLint | **Passed**, /questions and its BFF included. Final build followed the interrupted-save/logout safeguards; no concurrent dev/build server was left running. |
| Real browser + Next + FastAPI + PostgreSQL | **Verified with disposable synthetic data**: empty bank; missing-correct-option validation; MC order/key restoration; local selection/reset; create/save; publication and disabled frozen editing; correction as version 2 retaining version 1; unsaved keep-current dialog; TF false persistence/restoration; PUT edit retaining revision ID; saved key-free unscored preview; retirement retaining history/removing mutation controls; logout and direct-URL denial. Keyboard Tab/Enter publication confirmation verified. |
| Native/TLS/provider/manual accessibility | **Unverified**: no physical/emulator interaction with these new components, real provider/MFA login, deployed TLS/cookies or comprehensive screen-reader/multi-device audit. |

The first focused component run found missing checked-state attributes in React Native Web rendering. Explicit aria-checked/aria-disabled, alongside native accessibility state, corrected it; focused/final tests passed. An initial lint warning about cleanup ref mutation was removed. The first browser fixture intentionally attempted a /questions callback redirect; the existing BFF correctly rejected its dashboard/login allowlist violation. The test-only fixture was corrected, with no authentication policy change.

The live Turbopack fixture continuously compiled/refreshed and produced stale accessibility snapshots. Browser workflow verification therefore used the installed **`next dev --webpack`** mode. Default production Turbopack build and automated Next HTTP tests passed; the interactive default-dev refresh issue was not fully diagnosed. No runtime bundler/authentication setting was weakened or silently changed. If this occurs in normal local development, `npm run dev -- --webpack` is an available local fallback; default Turbopack interactive reliability remains an environment follow-up.

The browser harness issued a synthetic HttpOnly session only outside production source/config, in a generated UUID database. It did not configure OIDC, promote mobile users or add a runtime bypass. All harness processes and their generated database were stopped/removed. Evidence: ignored private-data/verification/section12-preview.png, section12-browser.log, section12-backend-tests.log, section12-client-tests.log and section12-admin-web.log. The screenshot depicts synthetic fixture text and an unscored selection, not real curriculum or measured correctness. Browser workflow evidence predates the small final interrupted-save/logout-clear hardening; those final changes passed unit checks and the final build, without a repeated complete browser run.

## Preservation and changed files

**No backend, model, migration, dependency, environment secret or lockfile change.** Head remains 0006_question_associations. All frozen migrations/SQL, mobile identity/session/routing and original handoff remain unchanged. The existing mobile package-lock hash remains 92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6. No existing developer database was reset/downgraded or seeded with bank fixtures.

Relative to the pre-section hash baseline: **11 existing files changed, 11 new files including this report, 243 previous files unchanged, zero removed**. The complete 22-file list:

```text
AGENTS.md
README.md
apps/admin/next.config.ts
apps/admin/src/app/api/admin/questions/[[...segments]]/route.ts
apps/admin/src/app/dashboard/page.tsx
apps/admin/src/app/globals.css
apps/admin/src/app/questions/error.tsx
apps/admin/src/app/questions/page.tsx
apps/admin/src/components/admin-nav.tsx
apps/admin/src/components/question-editor.tsx
apps/admin/src/components/question-manager.tsx
apps/admin/src/services/questions-contract.ts
apps/mobile/src/features/questions/ChoiceQuestion.tsx
apps/mobile/src/features/questions/choice.ts
docs/API_DESIGN.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/QUESTION_BANK.md
docs/SECTION_12_REPORT.md
scripts/admin-web.test.mjs
scripts/choice-components.test.cjs
scripts/choice.test.mjs
```

## Section 13 readiness

**Ready for Section 13 after acceptance and receipt of its authoritative prompt.** The approved two-method authoring/rendering foundation is implemented, with the verification limits above explicitly retained.

Real OIDC/MFA/TLS activation is still required for actual administrator use; it is not a new grading or component dependency. Native devices, screen readers/text scaling at device settings, small-screen browser layouts, interrupted-network UI scenarios and the default-dev refresh issue need further environment verification. Responsive CSS and component semantics are implemented, but this report does not claim exhaustive viewport/device coverage.

Future prompts must separately authorize other-method editors, learner delivery/attempt binding, grading/feedback release, assignment composition or research. Keep the existing unresolved normalization, punctuation, synonyms, partial credit, randomization and scored flashcard/rubric decisions deferred until relevant. No Section 13 implementation has started.
