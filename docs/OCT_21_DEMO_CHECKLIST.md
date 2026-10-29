# October 21, 2026 — supervisor demo checklist

Verified October 19, 2026 (Asia/Manila). **Section 25 implementation/backend demonstration passes. A populated, authenticated native supervisor walkthrough is NOT yet verified or ready.** No real learner messages or educational outcomes were fabricated.

## Startup (separate PowerShell terminals)

From `C:\Users\Shan Gealone\Desktop\Projects\Fluentt`:

```powershell
# Local PostgreSQL; controls only the existing isolated development cluster.
.\scripts\local-postgres.ps1 start

# API terminal
Set-Location services/api
.venv/Scripts/python -m alembic current   # expected: 0012_class_communication
.venv/Scripts/python -m alembic check
.venv/Scripts/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --no-access-log

# Mobile terminal, starting from repository root
Set-Location apps/mobile
npm.cmd start

# Optional administrator website terminal, starting from repository root
Set-Location apps/admin
npm.cmd run dev
```

The configured local database was backed up and upgraded to 0012; do not reset/downgrade it. A new machine must follow MIGRATIONS.md, including the empty-bootstrap adapter only for a genuinely empty database. API health is `http://localhost:8000/api/v1/health`. Real Uvicorn startup/HTTP health and denied anonymous communication were checked on temporary localhost port 8015 and that process was stopped; persistent demo servers are not left running by Section 25.

For a physical phone, set the existing ignored mobile EXPO_PUBLIC_API_URL to the computer's reachable LAN origin; Android emulator normally uses `http://10.0.2.2:8000`. Web uses localhost but remains a navigation preview: account issuance requires native SecureStore. Use separate native app instances/devices for instructor and student identities; do not clear their secure storage or assume username-based login/recovery.

## Reproduce the verified backend/database demonstration

This test exercises actual FastAPI HTTP handlers, transactions and a generated disposable PostgreSQL database. It creates explicitly synthetic curriculum/questions/accounts via approved services/APIs, uses the existing isolated test-only admin session issuer, and drops only its generated database. It does not seed the normal app database or enable a production sign-in bypass.

```powershell
# From repository root; local ignored verification credentials must exist.
Set-Location services/api
$taskPgPassword = Get-Content -Raw '../../private-data/verification/pg-password'
$env:FLUENTT_TEST_DATABASE_URL = "postgresql+psycopg://fluentt_local:${taskPgPassword}@127.0.0.1:55432/postgres"
.venv/Scripts/python -m pytest -q -s tests/integration/test_oct21_demo_postgresql.py
Remove-Item Env:\FLUENTT_TEST_DATABASE_URL
$taskPgPassword = $null
```

| Tested sequence | Actual result |
|---|---|
| Instructor opens owned class, creates/publishes a ten-method assignment | PASS — real persisted publication and pinned versions. |
| Enrolled student answers/submits; deliberately reveals a Flashcard | PASS — real finalized capture, all ten response methods. |
| Explicit authorized internal objective evaluation | PASS — actual deterministic 6.00/9.00 fixture result; Flashcard is N/A. No automatic grading on submit. |
| Instructor releases; student sees permitted result | PASS — real released totals; private keys/back content remain excluded. |
| Instructor views current-member performance | PASS — persisted submission and released mean 6.00/9.00. |
| Announcement, private message, retry, own read mark and student reply | PASS — real persistence/order/deduplication, no notifications. |
| Real OIDC administrator login | BLOCKED — deliberately disabled, live HTTP 503 confirmed. Test sessions are not live login evidence. |
| Authenticated native/browser walkthrough of this sequence | UNVERIFIED — exports/component tests do not establish it. |

Evidence: `private-data/verification/section25-demo-focused.log` records each step; the final regression includes the same smoke test. Full results: **679 backend tests and 151 client/component tests passed, no skips**, mobile TypeScript/lint and web/Android exports passed. See SECTION_25_REPORT.md.

## Before the hands-on demonstration

- [ ] Prepare approved, clearly labeled synthetic demo curriculum/questions in the normal app database through an authorized staging workflow. Current inspected counts: **0 published editions, 0 published locked questions, 0 published assignments, 0 class-text messages**. The disposable smoke intentionally leaves these unchanged.
- [ ] Resolve the live content/grading administrator access path. OIDC/MFA is unconfigured; Next.js has no grading-execution UI. Preserve fail-closed authentication and administrator-only grading. Do not promise an instructor “Grade” button or automatic scoring. Until this is resolved, demonstrate grading through the clearly identified real backend test, not a claimed native end-to-end flow.
- [ ] Run instructor/student flows on two native instances with reachable API URL, valid secure sessions and staged content; check keyboards, text scaling, Back/unsaved-send confirmation, refresh, read marking and membership isolation.
- [ ] Agree which portions the supervisor will see: verified synthetic backend test versus a separately verified native walkthrough. Keep real-student messages out until retention/moderation/privacy policies are approved.

Section 25 stops here for demo approval. No Section 26, AI, ESR, pronunciation or research execution is started.
