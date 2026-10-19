# Section 11 — Question bank and ten answer methods

Completed 2026-10-18 (Asia/Manila). Backend foundation only; no Section 12 implementation, commit or push.

## Inspection, scope and approved decisions

Reviewed the supplied Section 11 prompt, preserved handoff, development plan, Sections 09/10 reports, API/architecture/database/curriculum/security/research decisions, existing assessment schemas/ORM hooks/migration guards and Git changes. The handoff reflects Sections 00–05; later accepted reports and local verification supersede its historical head/environment notes. The original 58-table foundation now has 60 domain tables because Section 08 added separate admin sessions/attempts. No duplicate question/option/rubric infrastructure is needed.

The user explicitly approved all three recommendations:

1. Stable Question identity, published locked QuestionRevision versions, corrections using new revision IDs, whole-item retirement and retained history; competencies belong to the revision's lesson, with published/unretired ancestry required at publication.
2. Separate operator questions.read/write/publish grants. Editor gets read+write; publisher gets read+publish; publish/retire need all three. Private keys require write. Curriculum roles grant no bank access implicitly.
3. Administrator-preview-only retrieval and a key-free DTO for future authorized delivery. No mobile bank browsing/submission endpoint or grading; retain ungraded-v1 and document pending evaluation policies.

Existing method identifiers and V1 schemas remain unchanged. Filipino curriculum subject is independent of Tagalog learning language. No actual content, administrator, permission grant or outcome was seeded in the development database.

## Delivered contracts and persistence

`app/modules/questions` implements 10 HTTP method/path combinations under `/api/v1/admin/questions`: list/create; item detail; paged revision history/create; revision preview/full draft replacement; editor-only private definition/key lookup; revision publish; whole-item retire. QUESTION_BANK.md provides exact fields, paths, filters, limits, errors and operator commands. FastAPI OpenAPI includes discriminated authoring/preview models. A separate typed response union is available for future attempt services, with no submission route yet.

| Method | Definition/key/response contract | Real HTTP → PostgreSQL round trip | Evaluation |
|---|---|---|---|
| multiple_choice | Existing options and single valid option ID | Verified | Deferred |
| true_false | Strict boolean key/response | Verified | Deferred |
| identification | Accepted strings/case flag and text response | Verified | Deferred |
| fill_in_the_blank | Stable blank IDs and fully covered answer map | Verified | Deferred |
| multiple_select | Distinct valid correct/response option IDs | Verified | Deferred |
| flashcards | Public cue, private back/rubric reference, recall enum | Verified | Ungraded; scored rubric unapproved |
| error_identification | Tokens, valid targets/correction references | Verified | Deferred |
| word_arrangement | Stable items, complete key permutation | Verified | Deferred |
| sentence_arrangement | Stable items, complete key permutation | Verified | Deferred |
| matching_type | Stable left/right IDs, complete one-to-one key | Verified | Deferred |

All ten reject unknown configuration/key fields; existing validators reject duplicate IDs, invalid references and method-specific shape/type errors. Nonblank prompt, bounded authoring text/definition, points precision/range, exact schema version, existing lesson and same-lesson competency validation are enforced. Public previews omit key/explanation/grading fields; only explicit editor key reads return those fields. Response contracts accept no correctness/score claims and preserve existing partial-draft validation semantics.

Initial creation atomically stores Question, revision 1, private key and optional links. Subsequent revisions allocate monotonically increasing numbers under Question locking; draft replacement takes the complete definition. It validates before deleting the old unlocked key/links, flushing content, then inserting the new validated key/links. This avoids the pre-existing ORM hook comparing new content against an old incompatible key, without weakening that hook or leaving an intermediate committed state.

Publication revalidates stored content/key and current curriculum ancestry, then locks the revision and marks the item published. Existing PostgreSQL triggers freeze the revision/key/competency children. Retirement archives the identity and timestamp, blocks later authoring/publication and keeps history. Existing assignment references remain pinned to their original revision IDs. A published item may have later draft revisions; latest administrative metadata is never a learner-delivery eligibility rule. No hard-delete, unretire, automatic cloning, scoring algorithm or full authoring UI is provided.

## Authorization, concurrency and audits

Every operation requires a dedicated live administrator browser session and explicit question permission. Mobile Bearer credentials, anonymous/expired/revoked/disabled users and dashboard/curriculum-only administrators receive no bank access. Reads need questions.read; keys additionally need write; writes need read+write; publish/retire additionally need publish. Existing User/session locks, post-wait refresh, same-transaction authorization and server expiry remain authoritative.

Mutations enforce exact Origin/Fetch Metadata and session CSRF. The shared CSRF comparison now validates the expected ASCII token shape before constant-time comparison, so non-ASCII malformed input safely returns 403 instead of raising a comparison error; normal session behavior is unchanged. Responses/errors inherit existing no-store and redacted error/request logging.

Acquire existing curriculum advisory 78090001 before domain DML/Question locks, exclusive for bank/curriculum writes and shared for materialized reads. Whole-item If-Match covers root/child row identities and update timestamps, avoiding hashes of low-entropy answer-key values. Missing marker returns 428, stale marker/conflicting relationship/protected history returns 409. Concurrent updates and new-revision requests by different administrators have one winner with the same stale marker. Pagination/order are deterministic; private content is not returned by list/history/preview.

Successful mutation audits include actor, item, affected revision/version, request ID and time, without body text, answer keys, explanation or credentials. Operator grants/revokes reuse the existing transaction/role-drift/idempotency/revocation checks via a restricted content-domain helper; existing curriculum commands/policies remain compatible. No arbitrary RBAC, mobile promotion or automatic privilege expansion is introduced.

## Migration and preservation

Additive **0006_question_associations** adds one invoker function and three triggers, not tables/columns. It enforces same-lesson links both when associations change and when either side's lesson changes, coordinating with curriculum writers. A preflight aborts on historical mismatches rather than silently deleting/relabeling data. Existing frozen revisions 0001–0005, original SQL, JSON contracts and identities remain unchanged.

Verified fresh upgrade, metadata consistency, full migration round trip and data-preserving preflight refusal using generated UUID PostgreSQL databases. Applied the ordinary forward upgrade to the known isolated local development database: before 0005, afterward **0006_question_associations (head)**, `alembic check` reports no new upgrade operations. No existing database was reset/downgraded, no developer content was deleted, and no database credentials/configuration were changed. Test-only downgrade/fixture cleanup occurred solely in generated disposable databases.

Hash comparison against the pre-section baseline confirms **232 pre-existing source/documentation files unchanged**, **12 existing files changed**, **10 new files including this report**, and **zero removed files**. All mobile/admin frontend source, mobile package-lock, PROJECT_HANDOFF.md and frozen migration/SQL files remain intact. Ignored PostgreSQL runtime/test logs and normal build/cache artifacts are outside this source count.

## Verification evidence

| Check | Actual result |
|---|---|
| Initial existing/new method contract tests | 53 passed before additional method-injection cases. |
| First focused real PostgreSQL bank run | 8 passed, 1 failed: assignment fixture used grade instead of the established grade_level field. Corrected fixture; no class API change. |
| Corrected focused bank run | 9 passed. |
| Expanded new Section 11 contract/PG tests | 49 passed, including migration preflight, separate-admin races, missing/invalid relationships, private-key denial, default/disabled/expired admins and empty legacy history. |
| First full regression | 390 passed, 1 failed: Alembic operation bypassed a lazily opened ORM test savepoint. Fixed the test to use a real connection savepoint; migration refusal/data protection worked. |
| **Final complete backend regression** | **391 passed, zero skipped**, including PostgreSQL identity/classes/enrollment/admin/curriculum/question/migration/research-storage regressions; 64.54 seconds. Two pre-existing dependency deprecation warnings (Starlette/AnyIO and Authlib HTTPX compatibility). |
| Earlier client/state/static component regressions | **45 passed**, zero failed/skipped. Existing Node module-type warnings remain. |
| Ruff / formatting / Python compilation | **Passed**, 103 Python files formatted. |
| Local forward migration/current/check | **Passed**, head 0006; no metadata drift. |
| Client typecheck/lint/build/exports | Not rerun: no client source/dependency/consumed contract changed. Section 10 browser/build results remain historical, not Section 11 claims. |
| Real provider MFA/TLS, native devices | Not verified; no provider is configured and real sign-in remains intentionally disabled. |

Final full suite includes the non-ASCII CSRF rejection assertion added after the expanded focused run. Local ignored evidence: private-data/verification/section11-final-tests.log, section11-final-focused.log and section11-changes.json. Disposable fixture databases were cleaned up by their generated-database fixtures; no persistent synthetic bank data was inserted in the developer database. The local cluster remains available through scripts/local-postgres.ps1.

## Limitations, unresolved policies and Section 12 readiness

**Ready to proceed to Section 12 after acceptance and receipt of its authoritative prompt.** The approved Section 11 backend foundation is implemented and verified. Further scope is not inferred from the roadmap.

- Real browser authoring remains a later section. OIDC issuer/client/provider-enforced MFA evidence, exact subject provisioning/grants and deployed HTTPS/cookie behavior remain unconfigured/unverified; real administrator access stays disabled as requested. Synthetic HTTP/DB sessions do not prove real-provider login.
- Grading, normalization, partial credit, punctuation/Unicode/case/diacritics policy, accepted synonyms, alternative arrangements, distractors, many-to-one matching, randomization/reproducible seeds, blank prompt formatting, completion and feedback release are unresolved. QUESTION_BANK.md enumerates existing representational boundaries. Resolve whichever policies the next prompt actually needs; do not infer an algorithm from stored keys/points or flashcard recall.
- Future delivery must bind an authorized class/personal/research context to a specific locked question and immutable assignment version, exclude drafts/retired selections, enforce release rules and preserve original attempts. No mobile endpoint or automatic question availability is granted here. Historical learner access and controlled research instrument use still need approved policies/consent.
- Initial item creation is not idempotent; a lost response needs deliberate reconciliation before retry. No hard-delete/unretire, bulk authoring/import or automatic edition/revision cloning is implemented.
- Operational limits, global advisory serialization and per-item history fingerprints favor correctness; large-catalog load testing, restricted production DB/function grants, operator attribution/retention, distributed edge limits, provider/TLS and deployment verification remain prerequisites before real sensitive data/public use. Direct SQL/bulk content writes bypass Python JSON validators and remain prohibited for unvalidated runtime authoring.

## Every Section 11 changed/new file

```text
AGENTS.md
README.md
docs/ADMIN_AUTH.md
docs/API_DESIGN.md
docs/ARCHITECTURE.md
docs/CURRICULUM.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/MIGRATIONS.md
docs/QUESTION_BANK.md
docs/SECTION_11_REPORT.md
services/api/app/api/v1/router.py
services/api/app/modules/administration/cli.py
services/api/app/modules/administration/service.py
services/api/app/modules/questions/__init__.py
services/api/app/modules/questions/router.py
services/api/app/modules/questions/schemas.py
services/api/app/modules/questions/service.py
services/api/migrations/versions/0006_question_associations.py
services/api/tests/integration/test_question_associations_postgresql.py
services/api/tests/integration/test_question_bank_postgresql.py
services/api/tests/test_question_bank.py
```
