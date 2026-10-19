# Pronunciation progress audit â€” 19 October 2026

Repository inspected: D:\Codes\FLUENTT\FLUENTT (the Git repository is nested one level below the requested folder).

## Remediation — 19 October 2026

The initial findings below are preserved as the baseline. The implementation has now been repaired; this section supersedes the original readiness assessment.

| Finding | Repair |
| --- | --- |
| Migration fails on import | Added proper P04 upgrade/downgrade functions, registered pronunciation models in Alembic, and added P05 to repair existing result schemas. The entire migration chain was executed successfully from an empty isolated database. |
| Error/unscorable database failures | Corrected the feedback constraint in models and both migration paths. Terminal error, NoMatch, omission, timeout, recovery and replay cases are exercised on PostgreSQL. |
| Loss of score precision | Parse fractional provider values as Decimal; store unconstrained NUMERIC; persist exact nested evidence; emit exact numeric JSON through a Decimal-aware response renderer. The 89.999999999999999 regression remains category B across HTTP, database and replay. |
| Shared arithmetic-context effects | Isolated pronunciation decimal parsing and display formatting from caller contexts, including rejected malformed scores. No scheduler source changes were required. |
| Optional target kind | Require explicit term/sentence metadata, reject invalid provenance with a safe 422 envelope, and document sentence behavior in the new P03 addendum. |
| Mobile missing end-to-end flow | Preserve audio until submission/reconciliation; submit multipart metadata/audio with authentication; show server score/category, deterministic issues and feedback, unscorable/configuration errors, and a fresh-recording action. Term/sentence switching is supported. |
| Mobile race/retry gaps | Reconcile the original attempt after transport uncertainty; resend the original metadata/audio only after status 404. Freeze identity/time at capture finalization. Fence owner changes, cancellation and late responses. Enforce a 45-second request deadline and bounded processing polling. |
| Missing translations/tests | Added English/Filipino pronunciation strings and focused capture, API, submission, screen, account-fencing, timeout and multipart-header tests. |
| Lint failures | Cleared the pronunciation mobile errors and backend findings. Older migration edits are import/typing lint cleanup; scheduler implementations are unchanged. Two existing i18n import warnings remain non-blocking. |
| Runtime/coverage limits | Added periodic expiry/orphan maintenance, row locking for dispatch/finalization/expiry, real simultaneous claim/overlapping-replay tests, multipart-file cleanup, streamed provider limits, bounded subprocess capture/deadlines and output-file limits. |
| Old migration regression | Updated the rollbackable D5 migration test to remove empty later pronunciation tables before exercising historical downgrades. |

### Verification

**Final full backend suite: 782 passed, zero failures or skips** (369.25 seconds). This includes scheduler-isolation acceptance, concurrency, precision, real migrations, converter limits and real AAC conversion. Two existing Starlette/httpx deprecation warnings remain.

**Final full mobile suite: 258 tests passed across 37 suites.** Typecheck passes. Mobile lint passes with two existing i18n import warnings and zero errors. Backend Ruff lint passes; all 23 checked pronunciation/integration Python files pass formatting. git diff --check passes (existing line-ending conversion notices only).

Real generated AAC audio converts to 16-kHz, mono, 16-bit PCM and its temporary job directory is removed. The entire Alembic migration chain succeeds on an empty isolated database. Application startup and /health/db succeed (HTTP 200) against the separate new local development database.

Run logs: backend/fix-verified-backend.log, backend/fix-migration.log, backend/fix-runtime-smoke.log, mobile/fix-full-mobile.log, mobile/fix-typecheck.log and mobile/fix-lint.log. Logs are ignored local files; they are supporting execution evidence, not live Azure/device evidence.

The first broader run exposed decimal-context pollution from invalid-score parsing; that issue was reproduced and corrected. The final full backend rerun includes that correction rather than treating a targeted retry as a full-suite pass.

### Local runtime prepared

- PostgreSQL remains running at the existing portable cluster. Test runs use explicitly isolated *_test databases.
- Created a new, separate local development database named fluentt and applied all migrations. No pre-existing application database was modified.
- Prepared ignored backend/.env with local database settings, a generated JWT secret, and absolute converter paths. No secret is included in this report or committed files. .env.example now documents pronunciation settings.
- Installed the portable FFmpeg 9.0.2 essentials build from the Windows build provider linked by ffmpeg.org. ZIP SHA-256 matched the provider's published value: 60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba.
- Converter directory: D:/Tools/fluentt-ffmpeg/ffmpeg-9.0.2-essentials_build/bin. It is configured directly in the ignored backend dotenv; no global PATH change was required.

### Remaining live gates

Azure credentials are still absent. Populate AZURE_SPEECH_KEY, AZURE_SPEECH_ENDPOINT and AZURE_SPEECH_REGION in the local ignored backend/.env, and provide an authorized Android device for a real recording and paid provider assessment. The previous F:/SDK adb path is unavailable on this host; device capture/authorization has not been proved. A physical device must also use a reachable backend API URL rather than the emulator-only default address.

No live Azure score or physical-device feasibility pass is claimed. The existing P02F report remains historical. See [P03 sentence-target addendum](p03-pronunciation-sentence-target-addendum.md) for the corrected contract and verification boundary.


---

## Initial audit conclusion

The Sunday summary overstates readiness. The backend has substantial implementation but confirmed functional and migration failures. The mobile has local Android capture scaffolding, but the end-to-end upload/assessment/results flow is absent. Percent-complete claims are not supported by acceptance evidence.

## Initial findings (see remediation status below)

1. **Blocking: migration cannot load safely.** `backend/alembic/versions/p04c0de000001_pronunciation_attempts_results.py:11` executes table creation at module scope and defines neither upgrade nor downgrade. Loading the revision through Alembic produces an Operations proxy NameError without an operations context; existing migration tests encounter DuplicateTable inside their context. Put DDL inside the appropriate migration functions and validate the real upgrade path.
2. **Blocking: unscorable/error results violate database constraints.** `backend/app/pronunciation/models.py:201` requires feedback to be present if and only if status is scored. Service finalizers also attach feedback to unscorable/failed results. Real PostgreSQL raises ck_pronunciation_result_scored_feedback violations, including NoMatch and expired claim recovery. The migration repeats this constraint.
3. **High: decimal handling is not lossless end-to-end.** `azure_adapter.py:170` uses ordinary json.loads (binary float parsing); models use Numeric(12,6), and schemas serialize through float. Reproduction: provider JSON AccuracyScore 89.999999999999999 parses to Decimal('90.0'), yielding A instead of B. Storage can also round values to six decimal places independently of stored category.
4. **Contract mismatch: target_kind is optional.** `schemas.py:45` defaults to term. Model introspection confirms is_required() is False, contradicting the supplied summary.
5. **Mobile vertical slice missing.** The existing screen is explicitly local-only and Android/term based. `capture.ts:120` cleans up and deletes captured audio before reporting recorded. No URI survives for upload. API client defaults to application/json, and no pronunciation submit/poll/result integration exists. No pronunciation keys exist in either en.json or fil.json, including the keys already referenced by the capture screen. No pronunciation-specific mobile tests were found.
6. **Mobile lint fails.** Synchronous setController in the screen effect (line 31) and AudioModule.AudioRecorder namespace lookup in nativeCapture.ts (line 9) produce errors. This lint error alone is not evidence that the native recorder fails at runtime.
7. **Incorrect scoring test oracle.** test_scoring_oracles.py:17 expects 90.00499999 to produce B, although the implemented >=90 rule correctly produces A. Correct the expectation after checking the intended threshold policy.
8. **Coverage limits.** API tests exist for replay, capacity, expiry and other flows, but no actual concurrent-thread race tests were found in the pronunciation API tests. The reaper/orphan cleanup is invoked at startup, not periodically. Provider response size and subprocess output limits are checked after buffering, so the claimed bounds do not enforce streaming memory limits. Invalid target paths also raise plain HTTPException rather than the structured pronunciation envelope.

## Initial checks performed

- Existing portable PostgreSQL 17 cluster successfully started; fluentt_test created for the full backend run. A separate fluentt_pronunciation_audit_test database was created for the focused pronunciation run. No production database was used.
- Full backend run stopped at its configured five-failure limit: 5 failed, 104 passed, 1 skipped (59.81 seconds). Failures include two existing migration tests broken by the new migration and three pronunciation failures. This is not a complete full-suite result.
- Pronunciation test collection: 109 cases.
- Focused pronunciation lint: passed.
- Entire backend lint: failed with 32 findings, including a new migration import-order finding and findings in older migrations.
- Mobile typecheck: passed.
- Mobile Jest: 32 suites, 239 tests passed. This does not validate pronunciation capture/upload.
- Mobile lint: 2 errors, 2 warnings.
- git diff --check: passed (line-ending warnings only).

## Initial live prerequisites

No backend .env exists, and the current settings resolve no Azure key, endpoint or region. Neither ffmpeg nor ffprobe resolves using the configured command names. The previously documented adb path F:\SDK\platform-tools\adb.exe is absent in this check, so current device authorization was not revalidated. The old feasibility report is historical evidence, not a current device check.

## Original recommended work order

Fix migration structure and terminal-result constraints first; fix lossless parsing/storage and the incorrect oracle; require target_kind and complete error coverage; rerun backend and scheduler-isolation checks. Then preserve captured audio until submit/cleanup, add multipart transport and result/retry/status UI, add both translations and pronunciation tests, and clear mobile lint. Finish with authorized-device capture, real conversion and Azure assessment, and update the sentence-target specification and feasibility evidence.

Application source files were not edited during this audit. Test logs are in backend/audit-pytest.log, backend/audit-pronunciation.log and backend/audit-collection.log. The local PostgreSQL cluster remains running.

## Initial focused test result

Pronunciation run completed: **15 failed, 93 passed, 1 skipped**, 109 cases total, 74.15 seconds. The scheduler-isolation acceptance test failed in an unscorable path because of the result feedback constraint; isolation therefore cannot be marked verified across all flows. Two additional phoneme-selection tests fail because their fixtures do not mark observations as target evidence (select_issues filters by is_target). Distinguish those fixture failures and the incorrect threshold expectation from runtime defects when repairing the suite. Eleven API cases fail, covering expiry, unscorable output and converter/provider errors.


