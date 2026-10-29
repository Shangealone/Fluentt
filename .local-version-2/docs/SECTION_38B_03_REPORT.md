# Section 38B Prompt 03 - Administrator research setup

Date: 2026-10-21 (Asia/Manila). Repository: `C:/Users/Shan Gealone/Desktop/Backup/Fluentt`. Base HEAD remains `6e2d7167e7f36e79172852d73c267a5dc84e13e5`, branch `codex/personal-learning-voice-updates`. The Prompt 01/02 documents and their uncommitted implementation were read and retained. This report records only the additional Prompt 03 work.

## Delivered workflow

The existing `/research` page is now **Research Management**, with Overview, Classroom setup and Revision history within its current administrator navigation entry. No duplicate research page was introduced. It uses the Prompt 02 manager-owned research-classroom namespace; it does not auto-load legacy studies, simulated analytics, demo participant counts or legacy exports.

- A live separately authenticated administrator needs explicit `research.read`; draft mutations additionally require `research.manage`. Studies are still limited to their exact manager. Read-only users can inspect configuration but cannot create, attach, save or change state.
- Create a DRAFT with explicit code, title, English/Tagalog, protocol version and proposed target. The target is labeled as a proposal, not an enrolled count or approved sample size. Root identity remains immutable after creation, consistent with Prompt 02.
- Choose an eligible classroom from a server list restricted to matching language, active class, eligible instructor owner and the exact classroom manage grant. Attaching is an explicit confirmed action; it enrolls no students and records no consent.
- Edit the study's dates, timezone and weekday proposals; proposed intervention weeks; same-day daily availability; pre-test/intervention/post-test/delayed-follow-up/questionnaire windows; versioned review, due-date and allocation policy references/parameters; proposed assessment attempt limit; exact frozen instruments and individual instrument windows/timers; consent document/required evidence kinds and permission references.
- Three intervention weeks are a labeled placeholder/proposal, never a default approval. Monday-Friday is not automatically selected. No daily duration, retention delay, participant count, review policy or attempt policy is invented. Window validation orders each window and keeps it inside configured study dates; relative phase ordering and methodology-specific rules remain dependent on approved Chapter 3.
- SM-2 is selectable only when an existing `sm2-classic-v1` configuration is actually returned. No configuration/instrument is auto-seeded. ESR remains unavailable because the installed adapter uses simulated inference; even a database model labeled nonsimulated does not certify that implementation.
- Overview uses actual server DRAFT/READY/ACTIVE/PAUSED/COMPLETED state, configured revision, blockers and proposed target. Participant enrollment and experiment outcomes are **N/A**, with no fabricated charts or results. State actions follow the backend graph and stay disabled when required evidence is unresolved.
- Revision history shows genuine saved configuration versions, fingerprints and inspectable saved settings. Lifecycle/designation events remain retained by the backend; no separate event-log viewer is falsely implied.

Each save creates an immutable protocol revision and requires review confirmation. Draft edits/class designation stop outside DRAFT. Explicit state transitions require confirmation. Unsaved navigation warns before discarding. A 412 requires refresh; unknown save outcomes retain the exact original UUID/body/revision **in memory only**, freeze editing and provide an exact retry. A replay response is followed by a fresh server read rather than overwriting a later state with an old receipt. Generation/visibility checks reject stale protected reads and mutation continuations; session/access loss hides protected research data.

## Minimal research-only backend additions

Prompt 02 did not provide the requested selector APIs or typed fields for several administrator planning settings. Added only:

1. `GET /api/v1/admin/research-classrooms/studies/{scope_id}/choices?kind=classrooms|conditions|instruments&limit=...&offset=...`. It reuses live administrator authorization, exact manager ownership, current class grants/owner eligibility and bounded pagination. Instrument options are exact same-study locked references with no prompts, snapshots, answer keys or participant identities. Condition options report implementation availability, not ethics approval. GET does not seed anything.
2. Optional `ProtocolConfiguration.administrator_setup`: typed proposed intervention weeks, same-day availability, five named phase windows, versioned review policy and proposed attempt limit. It is stored in the existing append-only protocol JSON, with server validation for strict positive integers, IANA timezone, aware ordered timestamps, in-study windows and request/configuration bounds. These values are **configuration proposals only**: no daily availability enforcement, assessment attempt execution, questionnaire collection or scheduling worker is added.
3. Readiness blockers for unsupported SM-2 implementation versions and the actually simulated ESR adapter, independent of database model labels. No scheduler code, parameters, personal state or algorithm registry is changed. The synthetic positive state-machine test now references the actual supported SM-2 identity instead of an arbitrary implementation name.
4. Canonical serialization omits an absent optional administrator proposal from mutation identity, preserving Prompt 02 replay fingerprints for old create/revision payloads. Existing stored protocol records are not rewritten.

No new table or migration was necessary. Source head remains `0017_research_classrooms`, 70 domain tables. Frozen migrations, models and ordinary learning contracts remain unchanged. No application/developer/production database was read, upgraded, seeded, reset or modified during this prompt. Integration operations used only generated disposable test databases.

## Next.js authorization and isolation

The existing research BFF catch-all gains a fixed `/api/admin/research/classrooms/studies/...` sub-contract, mapped only to `/admin/research-classrooms/...`. The new proxy accepts allowlisted UUID paths, methods and bounded paging queries. Unknown paths, private keys, legacy datasets, arbitrary backend forwarding and unsupported query parameters are rejected.

The page still calls `requireAdmin` on the server before rendering account data. Each new BFF operation verifies the current administrator profile/research permissions and the backend rechecks ownership/permissions in its transaction. Mutations require exact Origin, non-cross-site fetch, current CSRF token, UUID idempotency key, bounded JSON and exact revision where applicable. Only the existing dedicated administrator cookies are forwarded; device bearer tokens/unrelated cookies are not. New page/proxy responses are no-store. No new authentication shortcut, permission grant or browser storage was introduced.

Demo mode exposes no new study data or mutation capability: the page explains that a live authorized session is required and the new BFF rejects the demo flag. The old legacy dashboard component/legacy endpoints remain unchanged but are not invoked by this managed classroom page; this slice does not certify their historical demo, model, analytics or permission behavior.

All new styles are scoped to the research workspace and reuse the current administrator typography, tokens, cards, controls and navigation. Existing shared navigation changes only its research label and retains the permission condition/href. The only Next.js configuration change adds private no-store headers for `/research`.

## Verification and evidence

| Check | Actual final result |
| --- | --- |
| Research/setup plus existing ordinary-class PostgreSQL regression command | **67 passed, 0 failed/skipped**, 2 existing dependency warnings, 63.77 s. 12 new pure setup checks + 4 new setup PostgreSQL checks + 27 Prompt 02 checks + 24 existing classroom/enrollment/capture/progress checks. |
| `node --test scripts/research-setup.test.cjs` | **10 passed**, 0 failed/skipped. Actual TypeScript/TSX contracts, rendered native form structure, current navigation and dependency-injected BFF handler. |
| `node --test scripts/research-admin-web.test.cjs` | **4 passed**, 0 failed/skipped, 30.33 s. Real Next.js and isolated headless Chrome against a synthetic HTTP fixture. |
| Administrator typecheck/lint/production build | `npm --prefix apps/admin run typecheck`, `run lint` and `run build` all passed. Final build required host execution after a sandbox EPERM on a generated prerender directory; no source workaround or deployment. |
| Ruff on the three research backend modules and two new Python test files | Passed. |
| Recorded backend baseline selection | **243 passed, 1 existing failure**, 2 warnings, 15.48 s. Unchanged exact personal-column assertion omits existing `learning_experience`. |
| Recorded 84-test client baseline selection | **82 passed, 2 existing failures**: `scripts/enrollment.test.mjs:101` expects `/learning-focus` instead of existing `/language`; `scripts/progress.test.mjs:49` omits existing personal experience and expects history access. No assertion/source was repaired in Personal Learning. |

Backend command from `services/api`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_research_setup.py tests/test_research_classrooms.py tests/integration/test_research_setup_postgresql.py tests/integration/test_research_classrooms_postgresql.py tests/integration/test_classrooms_postgresql.py tests/integration/test_enrollment_postgresql.py tests/integration/test_response_capture_postgresql.py tests/integration/test_progress_postgresql.py --tb=short
```

The existing disposable fixture was given a maintenance URL privately in-process after verifying localhost/127.0.0.1 and port 55432, replacing the configured database name with `postgres`. It creates/migrates/drops only its generated `fluentt_test_<UUID>` databases. Nothing connects to the named application database. Model/clearance/class/instrument fixtures are explicitly synthetic test evidence, not real approvals, participants or validated outcomes.

The browser test copies the actual admin source/configuration into its own generated `.next/research-test-<UUID>` workspace, links existing dependencies, starts a separate Next server with an explicit synthetic backend URL, and launches a separate temporary headless browser context. It excludes application environment files. Cleanup verifies its generated directory boundary, unlinks only its dependency junction and removes only that test workspace. The existing port-3000 developer server is left running. No runtime auth bypass, real provider session or real learner data is used.

The first browser launch found the existing dev-server lock; a separate source-copy workspace resolved it without stopping that server. A development run also caught ambiguous dropdown accessible names; explicit names were added and the final four workflows passed. Browser checks include genuine empty-state requests, no legacy analytics request, draft creation/class attachment, exact retry after a simulated committed-save timeout, unresolved activation disabled, read-only grant refresh, session revocation cleanup, keyboard focus and no horizontal overflow at 390px. These are synthetic browser/API integration results, not proof of deployed OIDC/MFA/TLS, approved methods or native-app execution.

Visual QA inspected both resulting screenshots, including the full narrow layout:

- `output/research-setup/prompt03-overview.png` - 1440px administrator overview.
- `output/research-setup/prompt03-setup-mobile.png` - 390px administrator website setup; not an Expo screen.

Protected-source check: the same 146 original files reconstruct the Prompt 01 fingerprint after removing only the prior Prompt 02 additive registry import: `dc91ff34290d846acde675ee0c737f9e3070c19a1a5086ef98fc52e57e9119bc` (PowerShell Sort-Object, LF-joined path/TAB/lowercase SHA-256). Personal/mobile screens, routes, state, algorithms, scheduling and records remain unchanged; ordinary-class service paths have no changes. HEAD remains the base commit. No commit, push or deployment occurred.

## Exact Prompt 03 changed files

Existing administrator files:

- `apps/admin/src/app/research/page.tsx`
- `apps/admin/src/components/admin-nav.tsx`
- `apps/admin/src/app/api/admin/research/[[...segments]]/route.ts`
- `apps/admin/next.config.ts`

New administrator implementation:

- `apps/admin/src/components/research-manager.tsx`
- `apps/admin/src/components/research-protocol-form.tsx`
- `apps/admin/src/components/research-setup.module.css`
- `apps/admin/src/services/research-classroom-contract.ts`
- `apps/admin/src/services/research-routing.ts`
- `apps/admin/src/services/research-proxy.ts`

Research-only backend additions to the retained Prompt 02 files:

- `services/api/app/modules/research/classroom_schemas.py`
- `services/api/app/modules/research/classroom_service.py`
- `services/api/app/modules/research/classroom_router.py`
- `services/api/tests/integration/test_research_classrooms_postgresql.py` - positive fixture uses real SM-2 implementation identity.

New checks/artifacts/documentation:

- `services/api/tests/test_research_setup.py`
- `services/api/tests/integration/test_research_setup_postgresql.py`
- `scripts/research-setup.test.cjs`
- `scripts/research-admin-web.test.cjs`
- The two screenshots above.
- `docs/SECTION_38B_03_REPORT.md`, `docs/SECTION_38B_PROGRESS.md`, `docs/DECISIONS.md`.

All other entry-state Prompt 01/02 changes and existing `output/personal-learning/`/`output/personal-reference/` artifacts are retained. This report does not describe those earlier changes as new Prompt 03 work.

## Remaining blockers and stop boundary

No independently approved Chapter 3, protocol/instrument artifacts or applicable ethics/institution/site permissions were supplied or found. Evidence-reference inputs cannot grant them. Real activation still requires those approvals, verified clearance records, reviewed operator authority and non-owner runtime database grants with SELECT-only clearance access, plus deployed administrator authentication prerequisites. No such approvals/grants/provider setup were fabricated or deployed. If an application database is still below 0017, an independently authorized operator must apply the reviewed migration before the new namespace can serve it; no application migration was performed here.

Daily/phase/review/attempt settings remain retained proposals, not execution policies or an assessment implementation. Questionnaire instruments/capture, participant consent/enrollment, allocation/treatment, server execution/timers, research outcomes/exports and trained/validated ESR remain outside this prompt. Do not reuse legacy simulated execution to fill these gaps.

Prompt 03 is complete at this administrator configuration boundary. **STOP; require the exact next prompt before further implementation.**
