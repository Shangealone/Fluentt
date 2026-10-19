# Section 25 — Instructor–Student Communication

Implemented and verified October 19, 2026 (Asia/Manila). Section 24 is accepted by the supplied Section 25 context. No Section 26 implementation, commit or push. **Communication and the synthetic real-backend demonstration pass; a populated native supervisor walkthrough remains blocked/unverified as detailed below.**

## Inspection and approvals

Read the preserved PROJECT_HANDOFF.md, current development plan, Section 24 report and relevant architecture/decisions/API/privacy/enrollment/assignment/grading/database/migration rules and actual models/services/navigation/Git state. The original handoff is a historical through-05 snapshot; accepted later reports/prompts define current scope. Read mobile instructions and checked installed Expo 58 against its versioned SDK documentation, llms index and Router docs before UI work.

Message/MessageRead storage already existed without runtime communication APIs. Message enforces recipient_id XOR class_id; it could not safely scope a direct instructor/student conversation to one of their multiple classes. The user explicitly approved three policies before implementation:

1. Owner announcements without replies plus class-scoped instructor/current-school-student direct messages, either may initiate. No peer/personal/admin chat.
2. Current eligible owner/class/membership access, later joiners may read announcements, direct history only for its pair, suspended access hides retained records and eligible rejoin restores them. No editing/deletion/attachments. Preserve synthetic demo messages; real-student retention/moderation remains unapproved.
3. Plain text 1–4,000 Unicode code points, reject blank-only while preserving accepted raw text, server times, UUID send deduplication, bounded history/manual refresh and explicit own-viewer read marking. No shared participant receipts, push, websocket, typing or automatic protected-content sharing.

## Delivered workflow and contracts

Existing mobile dashboard/class details/My Classes link to role-protected /communication. Choose an eligible class, then announcements or a named instructor/student conversation. Instructor recipients come from the authorized current roster; selected peer context is verified before compose. Students have only their own class instructor conversation. Empty conversations may be initiated by either participant.

Messages display safe plain text, server time and own-viewer read/sent state; detail opening explicitly marks an unread message. No other participant's receipt is exposed. Compose validates Unicode count, retains exact uncertain-send text/request ID, blocks concurrent taps, and confirms removal of unsaved/uncertain work. Class/recipient/tab/refresh/account transitions use route-removal boundaries; no insecure local cache is added. Manual refresh reauthorizes context and replaces stale reads; focus/session loss ignores late completions, and lost class/peer access hides protected conversation state. Existing Screen/Input/Choices/Button/Picker patterns provide scrolling, wrapping, keyboard avoidance and accessible controls, subject to native verification limits.

COMMUNICATIONS.md documents full data/access/ordering/retry/retention contracts. Nine GET/POST operations use seven path patterns under /api/v1:

- /communication/classes
- /classes/{class_id}/communication (optional validated student_id context)
- /classes/{class_id}/communication/participants (owner-only)
- /classes/{class_id}/announcements (GET/POST)
- /classes/{class_id}/messages/{student_id} (GET/POST)
- /classes/{class_id}/communication/messages/{message_id}
- /classes/{class_id}/communication/messages/{message_id}/read

Sends accept strict {content}, require UUID Idempotency-Key and derive sender/recipient/kind/context/time server-side. Exact key/body/class/destination retries return one committed message; mismatch=409. Lists use limit 1–100/default20, offset 0–100000, has_more, server as_of and optional aware before. History sorts sent_at/UUID descending; retaining as_of while paging excludes intervening new sends. Classes/participants sort by names/UUID; literal search escapes LIKE metacharacters. DTOs never automatically load unpublished content, answers/keys, protected grades, research/private records or notification data.

Current mobile sessions, owner/class/membership locks, transaction rollback, no-store responses and safe errors remain authoritative. Instructor student locking uses NOWAIT to avoid inverse waits against student→owner ordering. Read and send writes occur under the same live authorization transaction. Send audit metadata includes actor/message/class/kind/contract/request/time, no body, secret or grade. Network/database errors are not presented as sent success; invalid/revoked/expired sessions remain 401.

## Database and preservation

Additive **0012_class_communication**, still **63 tables**, adds nullable communication_contract, context_class_id and send_request_id to existing messages, sender/request uniqueness, a RESTRICT class-context FK, indexed ordering and new-contract shape checks. The original recipient/class destination rule stays intact. New APIs serve only class-text-v1 rows; no old direct messages are assigned a guessed class. New sent and read records are immutable through invoker guards; valid pair/owner/membership checks complement API authorization. PUBLIC grants on these tables are revoked; deployed least-privilege runtime grants remain a separate prerequisite.

Legacy row destinations/content/timestamps are verified unchanged across 0011→0012, empty-new-contract downgrade and re-upgrade in a generated disposable database. Alembic check detects no model drift. Downgrade refuses retained new contract/context/request data. Frozen 0001–0011 remain byte-for-byte unchanged. No stored content is backfilled or deleted.

The configured local development database was backed up to ignored private-data/verification/section25-before-upgrade.dump, then forward-upgraded from 0011 to 0012. It contained zero message/read rows; preservation checks compared pre/post retained message fields/timestamps. Local current/check confirms 0012 head with no new upgrade operations. Models/dictionary/ERD are updated from the schema generator. No dependency, credential, provider or existing identity change.

## Verification evidence

| Check | Actual result |
|---|---|
| Final complete backend suite | **679 passed, 0 failed, 0 skipped**, 303.99 seconds, including disposable PostgreSQL. |
| Final complete client/component suite, 19 scripts | **151 passed, 0 failed, 0 skipped**. |
| Focused communication + demo integration | 9 passed before adding the last student-initiation case; final suite includes that case too. |
| Targeted schema/text units | 17 passed. |
| Mobile TypeScript and ESLint | Passed, exit 0. |
| Ruff lint/format, Python compilation | Passed; 152 Python files already formatted, including new migration checks. |
| Final Expo web and Android exports | Passed, final ignored section25-export-web-final / section25-export-android-final artifacts. |
| Local migration/schema | Backup + additive forward upgrade passed; head0012, 63 tables, no drift. |
| Temporary real Uvicorn/HTTP startup | Health passed; anonymous communication=401/no-store; unconfigured OIDC=503; temporary process stopped. |

Coverage includes announcements, student-initiated/replied directs, named/current recipients, role/class/peer isolation, later membership/left/rejoin/disable/archival, exact Unicode text and size errors, strict fields/keys, own read state and immutability, server ordering/anchored pages during new sends, duplicate/key-mismatch/concurrent retries, NOWAIT contention, device expiry/revocation, safe audits, legacy preservation and migration roundtrip/drift. UI/client tests cover escaped text, no private props/receipt leakage, role routing, validated requests, pending-send single flight/retry/discard, compose navigation warnings, explicit detail read and history anchors. Earlier identity/enrollment/content/ten-method/capture/grading/results/progress/monitoring regressions remain in the final suite.

The first PostgreSQL run found an ambiguous PL/pgSQL variable in the newly authored trigger; it was corrected and retested before applying 0012 to the normal development database. ESLint identified direct mutation of a state-held helper and unescaped JSX apostrophes; those were corrected before final lint, tests and exports. Initial backup setup encountered a protected SecretStr type conversion before any backup/migration; the corrected invocation completed successfully without logging credentials. No failed/skipped check is counted as passed. Existing Starlette/Authlib and Node module-type deprecation/tool warnings remain nonfailing.

## October 21 smoke: actual scope and blockers

A single reproducible test creates synthetic curriculum/all ten bank methods, instructor/class and assignment through real services/APIs in a generated PostgreSQL database; publishes, enrolls a student, submits real responses including a deliberately revealed Flashcard, explicitly evaluates with a separately authorized synthetic administrator, releases, reads student results and instructor monitoring, then sends/reads/replies to announcements/direct messages with retry deduplication. Actual fixture objective outcome is **6.00/9.00**, Flashcard N/A; no grading success is mocked. Original capture/results boundaries remain intact. Printed PASS steps are in section25-demo-focused.log; the final backend suite runs the same smoke.

The administrator session is the existing **isolated test-only issuer**, not real OIDC or a runtime authentication bypass. No production seed/account/token or browser-storage credential was created. The smoke is a real backend/database integration sequence, not proof of native UI/device behavior. A separate real Uvicorn process verified HTTP startup/auth boundaries against the normal local database without writing demo records.

The normal app database was inspected and has **0 published curriculum editions, 0 published locked question revisions, 0 published assignments and 0 class-text messages**. The disposable test intentionally leaves it unchanged. Real OIDC/MFA sign-in is still safely disabled as previously requested; no grading-execution UI exists. Therefore a populated hands-on supervisor demonstration needs an approved synthetic staging/content workflow and an honest grading/access presentation, plus a native instructor/student walkthrough. No unrelated administrator or major-feature repair/bypass was attempted. **OCT_21_DEMO_CHECKLIST.md** supplies startup commands, reproducible smoke sequence/results and the remaining checklist.

Physical Android/iOS, SecureStore end-to-end, TalkBack/VoiceOver, orientation/text scaling/keyboard/hardware Back remain unverified on devices. No live authenticated native/browser message walkthrough was completed. Next.js source/build/browser harness is unchanged and was not redundantly rerun; previous Turbopack limitations remain historical. Production load/very large histories, distributed limits, runtime grants, TLS/provider activation and real-student retention/moderation require separate validation. Human-authored confidential text is not automatically classified; no moderation efficacy or educational/research validity is claimed.

## Stop and readiness

**Section 25 is complete within its approved synthetic-demo scope. The backend demonstration is verified; the fully staged native supervisor demo is not yet ready.** Stop for demo approval and resolution of the concrete checklist items. Do not proceed to Section 26, AI, ESR, pronunciation or research execution. No commit/push.

## Every changed file

Compared with the Section 25 SHA256 baseline: **21 existing files changed, 16 new files including this report, 360 prior files unchanged, zero removed**. Existing mobile lockfile, original handoff and all prior reports/frozen migrations remain unchanged. Lock SHA256: `92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6`; handoff: `EFBA6D1FA5B51D4FD0695553E0BBA19E857E30C37F3D09E00C6249EC45F39F71`. Existing unrelated tracked/untracked work is retained. Logs, backups, local exports and verification snapshots are ignored artifacts.

```text
AGENTS.md
README.md
apps/mobile/src/app/_layout.tsx
apps/mobile/src/app/class-details.tsx
apps/mobile/src/app/communication.tsx
apps/mobile/src/app/instructor.tsx
apps/mobile/src/features/communications/CommunicationBrowser.tsx
apps/mobile/src/features/communications/state.ts
apps/mobile/src/features/enrollment/MyClasses.tsx
apps/mobile/src/services/api/communications.ts
apps/mobile/src/session/provider.tsx
apps/mobile/src/session/routing.ts
docs/API_DESIGN.md
docs/ARCHITECTURE.md
docs/COMMUNICATIONS.md
docs/DATABASE_SCHEMA.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/MIGRATIONS.md
docs/OCT_21_DEMO_CHECKLIST.md
docs/SECTION_25_REPORT.md
scripts/choice-components.test.cjs
scripts/communications.test.mjs
services/api/app/api/v1/router.py
services/api/app/main.py
services/api/app/models/operations.py
services/api/app/modules/classrooms/repository.py
services/api/app/modules/communications/__init__.py
services/api/app/modules/communications/router.py
services/api/app/modules/communications/schemas.py
services/api/app/modules/communications/service.py
services/api/migrations/versions/0012_class_communication.py
services/api/scripts/document_schema.py
services/api/tests/integration/test_communication_postgresql.py
services/api/tests/integration/test_oct21_demo_postgresql.py
services/api/tests/test_communication.py
services/api/tests/test_schema.py
```
