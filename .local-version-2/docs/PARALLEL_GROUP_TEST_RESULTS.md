# Parallel-group test results

2026-11-05. Inactive foundation implemented; overall PARTIAL for complete participant operation. No real participants, production migration, commit, push or deployment. Prior uncommitted research/model work preserved.


Actual automated execution in combined .local-version-2; no speech checkpoint load or Groq network call. API interpreter reused the existing Python 3.13 environment with the older API site-packages appended for Authlib and ignored validation-test-deps for previously prepared Groq dependencies. Shared environments were not modified. Restricted Windows async test execution stalled and was interrupted; normal-process rerun completed. A later direct invocation omitted the Authlib search path and failed collection; rerun using the documented setup succeeded. These attempts are not counted as passes.

| Check | Actual final outcome |
|---|---|
| Backend research/class/scheduler/speech/Tutor selection | 243 passed, 3 dependency deprecation warnings |
| Focused parallel tests after final completion-time guard | 12 passed (subset rerun, not 12 additional unique tests) |
| PostgreSQL parallel + retained vocabulary workflow | 8 passed |
| Mobile authenticated status consumer tests | 2 passed |
| Administrator existing proxy/session tests | 4 passed |
| Mobile typecheck/lint | typecheck PASS; lint 0 errors/6 existing hook warnings |
| Administrator typecheck/lint | PASS, no lint findings |
| Focused backend Ruff and diff check | PASS |
| Phone/browser hands-on, APK build, live speech/Tutor connectivity | NOT RUN/UNVERIFIED |

Backend selection: python -m pytest tests/test_parallel_study.py tests/test_esr_shadow.py tests/test_esr_development_boundary.py tests/test_vocabulary_review.py tests/test_fsrs6.py tests/test_fifakt.py tests/test_research_execution_guard.py tests/test_research_participants.py tests/test_research_setup.py tests/test_wavlm.py tests/test_mms.py tests/test_voice_safety.py tests/test_redesigned_model_routes.py tests/test_groq_tutor.py tests/test_classrooms.py tests/test_enrollment.py -q --tb=short.

PostgreSQL: python -m pytest tests/integration/test_parallel_study_postgresql.py tests/integration/test_vocabulary_review_postgresql.py -q --tb=short. Only a privately supplied LOCAL maintenance URL was used; fixtures create/drop their own UUID databases, including a separate one for concurrent committed fixtures. Earlier attempt: two tests passed and one setup errored due to committed synthetic curriculum code collision; separate concurrency-engine fixture resolved it. Final eight passed include new migration rollback/refusal and retained vocabulary authorization/transaction behavior.

Frontend: npm run typecheck and npm run lint in each app; node --test tests/parallel-status.test.mjs in mobile; node --test tests/*.test.mjs in admin. Existing node_modules junctions were reused; no package change. Tests validate session wrapper usage/rejection of unexpected activation, not native screen rendering.

New targeted tests cover deterministic 15/15/fewer-participant prefixes; month/timezone boundaries; no false completion; exact offline control result; rejected personal context; blocked live treatment; assessment-policy refusal; feature-off startup/no-store; forged admin credentials; school-only status; immutable DB assignments; 30-way allocation with retries; withdrawal, clearance revocation/quota; real admin/class-grant/CSRF checks; draft retry body mismatch; and migration preservation/rollback. Synthetic metadata/clearance/participants never establish ethics approval or model validity.

Sources/migrations for FSRS, speech, Tutor, Personal Learning and frozen 0001–0025 were not modified. Research legacy paths changed only to reject the NEW contract/conflicts. Passed mocks/regressions do not establish current external-provider availability. No production DB migration, study activation or enrollment occurred.
