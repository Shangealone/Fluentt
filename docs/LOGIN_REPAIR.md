# Local account repair — 2026-10-28

## Cause and repair

The user's screenshot is registration (Confirm Password), not returning login. The running log confirmed PostgreSQL UndefinedColumn for `users.password_hash`. The configured localhost development database `fluentt_local` at `127.0.0.1:55432` was still at `0012_class_communication`, while source expects `0018_personal_history`. Username availability could succeed independently of the failing account insert. The entered name was still available after repair; no human account was created or impersonated for verification.

Verified the existing migration chain on a generated disposable PostgreSQL database. Created a private custom-format backup with bundled `pg_dump`, validated it with `pg_restore -l`, then applied the existing normal 0012→0018 forward migrations with 5-second lock/120-second statement timeouts. Backup: ignored `private-data/login-repair/before-upgrade-20261028T064611Z.dump`, 316,738 bytes. All 64 pre-existing table row counts remained unchanged within the upgrade transaction. Password column/final revision verified before commit. No new/frozen migration edits, reset, stamp, downgrade, production operation or password backfill. The existing pending migrations also add profile fields and structural research/history tables; no participation, approval or outcome data was created.

## Form changes

- Clarify new-account creation and move its single sign-in link near the top. Do not claim names are available after failed browser checks. Require a successful matching availability check before submitting.
- Keep explicit demo autofill/Fast-Enter local. Real registration no longer becomes a demo merely because a preview session was open. Preserve controller conflicts and pending secure-save retries.
- Require password/confirmation in the new real-account form; preserve legacy backend optional-password compatibility. No passwords guessed/reset.
- Login returns the new authenticated profile and waits for that exact profile before routing, avoiding stale demo-role data and guessed student routes. Block duplicate taps and clear the entered password on success.
- Map invalid-credentials responses to the correct fixed message rather than an expired-session message. Inactive accounts remain denied.

## Changed files

`apps/mobile/src/app/username.tsx`, `apps/mobile/src/app/login.tsx`, `apps/mobile/src/session/provider.tsx`, `apps/mobile/src/services/api/client.ts`, `scripts/username.test.cjs`, `scripts/login.test.mjs`, `services/api/tests/integration/test_identity_postgresql.py`, this report, `docs/IDENTITY_AND_SESSIONS.md`, `docs/DECISIONS.md`, `PROJECT_HANDOFF.md`. Runtime schema changed through existing migrations only. Unrelated working-tree changes retained; no commit or push.

## Evidence

- Initial full identity PostgreSQL module: 11 passed, 2 failed. The existing failures `test_live_preference_persistence` and `test_live_focus_roundtrip_preserves_legacy_grade` expect grade/focus alone to activate personal onboarding; current onboarding requires language and experience. They were not rewritten to hide baseline failures.
- Added three disposable lifecycle cases covering all mobile roles: spaced-name/password signup → restoration → revocation → old-session denial → wrong-password rejection → case-insensitive sign-in → same identity/role restoration. No accounts written to the application database for these tests.
- `pytest tests/integration/test_identity_postgresql.py -q --tb=line -k 'not test_live_preference_persistence and not test_live_focus_roundtrip_preserves_legacy_grade'`: **14 passed, 2 deselected**, two dependency warnings. The maintenance URL was supplied privately; fixture creates/drops only a generated UUID database.
- `node scripts/username.test.cjs`: **11 passed**. Includes explicit demo behavior, blocked failed availability and waiting for the matching sign-in profile.
- `node --experimental-strip-types scripts/login.test.mjs`: **4 passed**, including wrong-password messaging. The old function-presence test alone is not persistence proof; real PostgreSQL cases supply that evidence.
- Final mobile typecheck passed; final lint passed with 0 errors and 29 existing warnings. Targeted Ruff passed.
- Running HTTP username availability returned 200 after migration. No browser/device end-to-end result claimed; no human password requested or account session assumed.

## Limits and use

The pre-existing browser vault uses localStorage for bearer credentials. This repair preserves it, does not introduce another fallback and is not production security approval; that implementation differs from the older native-only storage instructions. Legacy accounts without passwords cannot be recovered by username; no password recovery was added. Learning algorithms, research treatment, consent and grading remain unchanged.

Reload and create the currently available username once without demo autofill. Complete onboarding, then sign out and use **Sign In** with that username/password. Do not recreate an already registered identity.
