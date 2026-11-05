# Track 1 Class Learning test results

2026-11-05. Only synthetic fixtures and generated disposable local PostgreSQL databases. No model inference, provider call, production migration or real enrollment.

## Actual final verification

| Check | Result |
|---|---|
| Backend targeted research/class/scheduler/speech/Tutor suite | 251 passed; 3 dependency deprecation warnings |
| PostgreSQL workflow + parallel foundation + retained vocabulary suite | 21 passed; 3 dependency deprecation warnings |
| Final revoked-clearance publication check | 1 passed (subset of the 21, not another unique test) |
| Mobile authenticated consumer tests | 5 passed |
| Administrator session/proxy tests | 5 passed |
| Mobile typecheck | PASS |
| Mobile lint | 0 errors, 6 existing hook-dependency warnings |
| Administrator typecheck and lint | PASS; 0 lint findings after correction |
| Targeted Python Ruff / git diff whitespace | PASS |
| Real Android/browser walkthrough, APK, responsive/accessibility/device/network acceptance | NOT RUN / UNVERIFIED |
| Live WavLM/MMS/Groq availability or trained FIFAKT inference | NOT RUN; outside Track 1 |
| Production migration/real study/deployment | NOT PERFORMED |

The 251 include 8 new test-workflow unit cases and the previous 243 selected regressions. The 21 PostgreSQL checks comprise 13 new workflow checks, 4 retained parallel checks and 4 retained vocabulary checks. Reruns are not added together.

## Coverage

Synthetic fixture: published one-card vocabulary pool, 30 active school identities, current membership, explicitly synthetic approvals/consent, immutable 15/15 allocation and real server-issued-format opaque sessions. HTTP calls use ordinary authorization; only test database dependency and server clock are controlled by fixtures.

New unit cases cover both flags/environment, actual database identity/address, non-synthetic evidence rejection, malformed Unicode and no-store unavailable behavior. New transactional checks cover:

- Complete control path: pretest draft/save/reload, final receipt/replay, publication, future lock, activity, posttest and seven-day delayed assessment.
- First real FSRS decision equals the unchanged calculator; subsequent review uses prior learner state. Wrong answer plus easy becomes effective again, retaining both ratings and objective outcome.
- Experimental assessment allowed but practice rejected before creating attempts; no false hybrid observations.
- Closed partial/missing attempts, baseline-blocked expired assessments, no zero imputation, retained completed status.
- Invalid choice IDs/incomplete responses/stale revision; typed NFC/casefold/trim behavior and preserved accents.
- Cross-participant access refusal; withdrawal/retry, retained assignments and denied later execution.
- Current class membership, clearance revocation and instructor publication gating.
- School role/consent-kind/changed enrollment retries; administrator live grants and CSRF.
- Separate-connection concurrent enrollment and exact finalization retries produce one retained result.
- SQL rejects final response mutation; populated 0027 refuses downgrade.

Retained parallel checks exercise actual concurrent 30-slot 15/15 allocation, quota/no withdrawal slot reuse, admin/class authorization, immutable allocation and empty upgrade/downgrade round-trip through both new migrations. Retained vocabulary checks protect existing answer-before-rating, final/published snapshot immutability and trained-provider gates.

## Reproduction environment and commands

Working root is the directory containing this docs folder, services/api and apps. Existing environments/junctions were reused, not changed:

- Node v24.11.0.
- Python 3.13.17: C:/Users/shang/Desktop/Fluent/versions/fluentt-main/backend/.venv/Scripts/python.exe.
- pytest 9.1.1, SQLAlchemy 2.0.54, Alembic 1.20.0, FastAPI 0.141.1, psycopg 3.3.6.
- API process appends C:/Users/shang/Desktop/Fluent/services/api/.venv/Lib/site-packages for existing Authlib; ignored ../../private-data/validation-test-deps supplies previously prepared Tutor test dependencies. No dependency installation.
- PostgreSQL maintenance URL is read privately from the older API's ignored local configuration, asserted loopback, and its database component set to postgres. Never print that URL/password. Fixtures alone create/migrate/drop fluentt_test_<32hex>; maintenance database and Supabase are not migrated.

From services/api, with that interpreter/import path:

```text
python -m pytest tests/test_parallel_workflow.py tests/test_parallel_study.py tests/test_esr_shadow.py tests/test_esr_development_boundary.py tests/test_vocabulary_review.py tests/test_fsrs6.py tests/test_fifakt.py tests/test_research_execution_guard.py tests/test_research_participants.py tests/test_research_setup.py tests/test_wavlm.py tests/test_mms.py tests/test_voice_safety.py tests/test_redesigned_model_routes.py tests/test_groq_tutor.py tests/test_classrooms.py tests/test_enrollment.py -q --tb=short
python -m pytest tests/integration/test_parallel_workflow_postgresql.py tests/integration/test_parallel_study_postgresql.py tests/integration/test_vocabulary_review_postgresql.py -q --tb=short
python -m pytest tests/integration/test_parallel_workflow_postgresql.py::test_current_membership_and_clearance_required -q --tb=short
```

In each apps/mobile and apps/admin: npm run typecheck; npm run lint; node --test tests/*.test.mjs. Targeted Ruff checks covered workflow_*.py, the new model/migration and both workflow test files. git diff --check passed. Mobile lint warnings remain in SchoolHomeLearning.tsx (1), SchoolProgress.tsx (3), useLessonData.ts (2); none introduced in the new panel.

## Failed attempts and fixes

Earlier runs are not counted as passes: synthetic HTTP session tokens initially lacked the required flt_ prefix, a production unavailable test needed HTTPS, and one expected future-state assertion omitted publication prerequisite. An actual adapter defect passed unsupported vocabulary arguments to calculate_fsrs6; the adapter was corrected to its real signature without changing FSRS. A strengthened JSON constraint initially caused Alembic to parse :true as a bind; spacing the JSON literal fixed that verified new-migration defect (intermediate run 1 failure/18 setup errors). Admin lint rejected a test variable named module; renamed it. Restricted Windows async attempts were interrupted; normal-process authorized reruns produced the reported results.

The final suite is a selected regression suite, not every repository test. Mobile tests transpile/execute the API consumer and admin tests execute proxy/session behavior; they do not render native screens. Passing synthetic tests establishes technical behavior, not ethics clearance, scientific validity, retention benefit or live experiment readiness.
