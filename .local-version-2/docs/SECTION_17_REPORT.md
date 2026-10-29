# Section 17 — Flashcards and vocabulary recall foundation

Completed 2026-10-19 (Asia/Manila). No Section 18 implementation, commit or push.

## Inspection and approved boundaries

Read the supplied Section 17 attachment, historical PROJECT_HANDOFF.md, development plan, accepted Sections 11/16 reports, question-bank/API/architecture/decision/security/database contracts and current Git changes. Inspected question/revision/key/competency/publication services, administrator editor/BFF, mobile session/navigation, learner profiles, LearningContext, VocabularyItem/ReviewState/ReviewEvent and scheduler/research/consent models. Consulted installed Next.js guidance and current Expo/React Native guidance, including BackHandler. Later reports supersede the historical handoff environment/head status; head remains 0006_question_associations, with 60 domain tables.

Existing Flashcards V1 is public content.cue and private answer_key.back plus optional scoring_rubric_version; common lesson/language/prompt/instructions and private explanation already exist. No approved QuestionRevision↔VocabularyItem relationship, general-practice persistence policy or learner back-release API exists. Vocabulary review storage requires a scheduler configuration/state, due date, intervals and snapshots, so it cannot represent unscheduled practice without inventing data/policies. The prompt explicitly permits reusable interfaces with persistence OPEN.

The user approved both recommendations:

- Preserve current schema and access: existing editor read+write permits private back reveal; mobile receives separately supplied already-authorized version-bound back props, without a new delivery/history/event API or vocabulary link.
- Optional self-report after deliberate reveal: again=could not recall, hard=recalled with difficulty, good=recalled with some effort, easy=recalled readily. One rating per visit, authored order, navigation resets reveal/rating and confirmed exit discards local state. No scores, durations, scheduler updates or persistence.

The supplied prompt's scheduler Sections 28–31 and research Sections 36–38 supersede provisional roadmap numbering. Consent/assent remains separate from ordinary accounts/class membership; no research data is collected.

## Delivered behavior and contracts

The existing protected /questions editor and fixed BFF now support **all ten** established methods. Flashcards adds separate front/cue and private-back fields, retains optional private rubric references without executing them and reuses required common metadata, field errors, validation, unsaved-change protection, ambiguous-save reconciliation, listing/filtering/paging/history, draft replacement, correction revisions, publishing and retirement. Plain text only; no vocabulary dataset, extra content field or fictional learning outcome is created. Repeated text is valid; persistent IDs identify cards, not labels.

PublicDefinition/publicDefinition and mobile flashcardFrontFromRevision explicitly project front-only fields, excluding back, explanation, rubric and other private metadata. Saved preview rechecks the live session; only an administrator with questions.read+write fetches the matching private key, checks revision ID/freshness and passes the back separately to FlashcardPreview. Read-only users retain a front-only preview with no reveal control. Unsaved editor previews use the already authorized private draft. Back text and ratings are absent from initial rendered markup and appear only after deliberate reveal; optional subjective rating is single-choice per visit, local only. Restart clears preview state. Hiding text is presentation, not encryption: authorized editors can inspect their private-key response.

Mobile FlashcardQuestion is controlled and accepts separate FlashcardFront, FlashcardBack and FlashcardState. A back must match the front's revision ID; missing/mismatched backs show unavailable/retry and cannot reveal/rate. FlashcardPractice supplies authored-order Previous/Next, count, loading/error/retry/empty states, per-visit reset and explicit exit confirmation. Duplicate revision IDs are rejected; repeated labels with different IDs are allowed. Ratings are optional; no progression gate or grading is inferred. A ref guards duplicate same-visit response callbacks; confirmed exit is also guarded against duplicate invocation. Android hardware Back opens the same exit confirmation, with listener cleanup. Shared cards/buttons/text wrapping support accessible controls without flip animations or new dependencies.

The host remounts local state on resetKey/deck-ID changes and loading/error/empty/inactive/unmount boundaries. Returning to an earlier card or restarting/session recovery starts unrevealed/unrated. Future route hosts must use Screen for scrolling/keyboard avoidance, set active=false/unmount on blur/session loss, clear their own buffers and supply onExit navigation. No mobile route is opened and no existing dashboard advertises an operational review service.

| Contract | Meaning |
|---|---|
| FlashcardFront | id (pinned revision), lesson_id, method:'flashcards', prompt, instructions, cue; front-only projection |
| FlashcardBack | {revision_id,back}, separately supplied by an authorized practice host |
| FlashcardState | {revealed:boolean,recall:null|'again'|'hard'|'good'|'easy'}, local per visit |
| FlashcardResponse | {method:'flashcards',answer:{recall}}, existing V1 self-report, no score/timing |
| Optional mobile callback | (revisionId,response), synchronous local integration boundary, no transmission or persistence by default |

VOCABULARY.md documents the exact OPEN persistence decisions: eligible learner/content/context policy, question/vocabulary version links, event types/order, revisits/skips, server timestamps/client duration semantics, idempotency/retry/concurrency/replay, owner-only history, retention/deletion/minor-data policy and consent. Scheduler integration may later consume approved pinned events through a server-owned versioned contract; no adapter executes now. No fake scheduler configuration/intervals are inserted to reuse review tables.

## Security and preservation

FastAPI remains authoritative. Existing dedicated admin cookies, live explicit permissions, Origin/CSRF, no-store, fixed BFF method/path/header/cookie forwarding, request budgets, If-Match, locked authorization/write/audit transaction and immutable published revisions remain intact. Keys require read+write, publish/retire require read+write+publish. Revoked access clears/gates private preview state; no secret or draft is stored in browser storage. No administrator endpoint is made available to mobile credentials.

Only existing administrator content persistence is used. No backend application/model/endpoint, migration, dependency, environment setting, scheduler state, practice history or research record is added. No real data/account/grant is seeded. Original handoff and unrelated uncommitted work are preserved. Tests and browser fixtures use generated disposable UUID databases; the existing developer database is never reset, downgraded or populated with fixtures. Real OIDC sign-in remains safely disabled until configured.

## Verification

| Check | Actual result |
|---|---|
| Focused backend schemas | **57 passed**, including 23 new Flashcards cases: front/private projection, malformed/unsupported content, missing back, retained rubric metadata, four strict self-report values, invalid scores/telemetry, repeated/long Unicode text. |
| Focused question-bank PostgreSQL + Flashcards | **46 passed**, zero skipped; **35.50 seconds**. Real persistence, safe versus private reads, atomic invalid replacement rejection, stale writes, publication, frozen history/correction revision and live key/write/session revocation. |
| Full backend/PostgreSQL regressions | **503 passed**, zero failed/skipped; **77.00 seconds**. Includes all ten contracts and identity/class/enrollment/admin/curriculum/migrations/concurrency. Two upstream deprecation warnings remain. |
| Combined client/component regressions | **107 passed**, zero failed/skipped. Ten new pure/component tests include public/private separation, version-bound back, reveal/recall gating, duplicate callbacks, Previous/Next resets, confirmed exit, phase/reset/session-restoration boundaries and mocked Android Back listener/cleanup; earlier nine methods and navigation/session regressions pass. Existing Node module-type warnings remain. |
| Final focused component checks after spacing adjustment | **32 passed**, zero skipped. |
| Next HTTP security regressions | **12 passed**, zero skipped: all ten authorized BFF methods, unknown eleventh rejection, fixed paths/methods/body budget, cookie/header forwarding, CSRF, permission gates, logout/revocation/outage and prior admin/curriculum regression. Synthetic backend HTTP contract, not real OIDC. |
| Mobile TypeScript / ESLint | **Passed**. |
| Expo web / Android exports | **Passed**, dist/section17-web and dist/section17-android. Components remain route-free; exports do not prove native execution. |
| Ruff / formatting / Python compilation | **Passed**. No configured Python static typechecker was run; backend application source is unchanged. |
| Next production build / TypeScript / ESLint | **Passed**; browser fixture stopped before build and final typecheck/lint followed it. |
| Browser → real Next/FastAPI/PostgreSQL | **Verified with disposable synthetic data:** required private back blocked save; Unicode cue/back saved; initial preview hid back; keyboard reveal exposed it; choosing Good disabled other ratings and showed local-only status; restart hid back; publication froze editing. After operator revocation of write permission, reload retained questions.read but removed edit/create and private reveal; saved preview was front-only. Logout then direct /questions redirected to /login?expired=1. |
| Practice-event persistence/history/replay | **Not implemented under the approved explicit fallback**, rather than claimed tested or silently recorded. Existing scheduler/event storage tests remain in backend regressions; these do not establish a general-practice event API. |

An HTTP page-copy assertion initially failed after wording changed; the established preview-only wording was restored and all 12 checks passed. Screenshot review identified touching rating buttons; shared wrapping action spacing was applied and final component checks passed. No backend tests or integrity constraints were weakened.

Browser testing uses the existing next dev --webpack fallback for the earlier unresolved interactive default-Turbopack refresh issue; production build was checked separately. Synthetic authentication exists only in the ignored disposable fixture, never runtime production code. The browser tab and fixture servers were closed/stopped and its generated database removed. Ignored evidence: section17-*.log and private-data/verification/section17-preview.png.

**Unverified:** physical/emulator interaction, real Android hardware Back, TalkBack/VoiceOver, native scaling/long-text scrolling/focus/orientation/blur integration, comprehensive accessibility audit, real provider/MFA and deployed TLS/cookie behavior. Android Back was verified through actual handlers with mocked native facilities, not a device. No PostgreSQL integration check was skipped in the final run.

## Every changed file

Relative to the pre-section SHA256 baseline: **13 existing files changed, 6 new files including this report, 273 previous files unchanged, zero removed**. Manifests/lockfiles, environment files, backend application/models and all migration history are unchanged. Existing mobile package-lock SHA256 remains 92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6; PROJECT_HANDOFF.md remains unchanged.

```text
AGENTS.md
README.md
apps/admin/src/app/api/admin/questions/[[...segments]]/route.ts
apps/admin/src/components/question-editor.tsx
apps/admin/src/components/question-manager.tsx
apps/admin/src/services/questions-contract.ts
apps/mobile/src/features/questions/FlashcardQuestion.tsx
apps/mobile/src/features/questions/flashcards.ts
docs/API_DESIGN.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/QUESTION_BANK.md
docs/VOCABULARY.md
docs/SECTION_17_REPORT.md
scripts/admin-web.test.mjs
scripts/choice-components.test.cjs
scripts/flashcards.test.mjs
services/api/tests/integration/test_question_bank_postgresql.py
services/api/tests/test_flashcard_methods.py
```

## Section 18 prerequisites

**Ready for Section 18 after your acceptance and its authoritative prompt.** All ten authorized method interfaces now exist. The approved component-only Flashcards scope has no implementation blocker; general practice persistence remains explicitly OPEN. Any future live learner delivery/event/history feature must first approve content/reveal eligibility, ownership, immutable version links, retention/consent, event ordering/idempotency/replay and required migration/API contracts. Real deployment still needs OIDC/MFA/TLS configuration and native/accessibility follow-ups. No scheduling/scoring/AI/research work is authorized or implemented. Stop here before Section 18.
