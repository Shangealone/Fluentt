# Section 21 — Automated grading engine

Completed 2026-10-19 (Asia/Manila). Backend internal evaluation only; no Section 22, result-release UI, commit or push.

## Inspection and approved decisions

Reviewed the handoff/development plan, Sections 11/17/20 reports and assessment, question-bank, vocabulary, assignment, research-isolation, administrator security, schema/migration and current Git contracts. Inspected all ten content/key/response schemas, capture validators and freeze guards, published revision/key relationships, existing grade fields, operator permissions and synchronous transaction callbacks. Section 20 intentionally forbids altering submitted capture records; original key markers are ungraded-v1. Neither stored fields nor rubric names constituted approval to invent grading.

The user approved:

1. Exact option/boolean, unordered set, stable sequence and complete pair matching; Identification uses literal accepted strings with Unicode casefold only when its stored case_sensitive flag is false; blanks require full exact case-sensitive matches. No other normalization, inferred synonyms, spelling/semantic tolerance, partial credit or penalties. Valid missing/incomplete objective responses earn zero; malformed evidence is flagged.
2. A versioned evaluation overlay with 1.00 per supported objective item, exact Decimal totals and no percentages/letter grades/rounding conversion. Flashcards are NOT APPLICABLE. Missing/unlocked/inconsistent keys require manual review; unknown contracts are unsupported. Unresolved overall totals stay unset and only labeled automatic subtotals are retained. Preserve pinned retired evidence.
3. Explicit administrator grading.read/run permissions through operator grants, no automatic access, backend-only selected internal evaluations and separate immutable records. Existing finalized Section 20 classroom captures may be evaluated without changing their unscored identity/answers. No student/instructor grading access, grading-on-submit, result release or research grading.

These are approved technical scoring rules, not proof of academic/DepEd verification or psychometric validity.

## Per-method support matrix

| Method | Implemented policy | State with valid evidence |
|---|---|---|
| Multiple Choice | Exact stable option ID | AUTO_GRADABLE |
| True or False | Strict boolean equality, including false | AUTO_GRADABLE |
| Identification | Authored accepted strings; stored case flag controls casefold only | AUTO_GRADABLE for exact lexical matching; semantic/spelling equivalence unsupported |
| Fill in the Blank | All stable gaps match authored accepted strings exactly/case-sensitively; no per-gap credit | AUTO_GRADABLE |
| Multiple Select | Exact unordered ID set; subsets/supersets get zero | AUTO_GRADABLE |
| Flashcards | Subjective recall has no objective score; rubric name is not executable approval | NOT APPLICABLE, excluded from points |
| Error Identification | Exact target-token ID set; no correction/grammar grading | AUTO_GRADABLE |
| Word Arrangement | Exact stable-ID sequence; no alternative-order inference | AUTO_GRADABLE |
| Sentence Arrangement | Same sequence policy | AUTO_GRADABLE |
| Matching Type | Exact complete one-to-one ID mapping, independent of pair-array order | AUTO_GRADABLE |

Every method validates pinned content/response/key integrity. Missing/unlocked/inconsistent or malformed evidence produces MANUAL_REVIEW_REQUIRED, including malformed Flashcard evidence. Unknown schema/method/policy/source-key markers produce UNSUPPORTED. No invalid definition is silently treated as a student's incorrect answer. Capture timestamp/metadata inconsistencies are separately flagged or safely rejected; a synthetic malformed historical finalization was persisted as review-required without rewriting its response.

AUTO_GRADABLE items award exactly 1.00 or 0.00; no partial credit/penalties. Valid unanswered/incomplete objective items receive zero. Overall totals exist only for COMPLETE runs with no unresolved applicable items. REVIEW_REQUIRED runs retain null overall totals plus clearly labeled automatic earned/possible subtotals. All-Flashcard runs are NOT_APPLICABLE with null overall score/denominator and zero automatic subtotals. Decimal arithmetic uses a local precision-28 context, including protection from a changed ambient Decimal context. API points are exact decimal strings.

Raw text remains unchanged. No trimming, NFC/NFKC, diacritic/punctuation removal, stemming, synonym inference or AI is used. Unicode casefold behavior is explicitly version-linked through objective-engine-v1-u{Unicode database version}; policy_snapshot records objective-exact-v1 and approved comparison/context/no-release rules. Original keys retain their ungraded-v1 source marker; each result records objective-exact-v1 as its applied rubric. New engine/policy versions require separate runs rather than rewriting old results.

## Delivered services, authorization and API

New app/modules/grading separates a pure deterministic engine, strict Pydantic contracts and transactional administrator service/routes. It reuses existing content/capture validation and live administrator authorization. Only finalized ordinal-1 unscored-capture-v1 ordinary classroom attempts on locked distribution-only publications are eligible. Student responses must retain coherent finalization timestamps and unscored metadata; unsupported or malformed evidence cannot silently become automatic credit. Exact assigned QuestionRevision/QuestionAnswerKey/StudentResponse IDs are used; later bank corrections/retirement do not substitute newer material.

Live grading.read is required for reads; mutation requires grading.read+grading.run, exact configured Origin and session CSRF. Every retry rechecks authorization. Default/dashboard/question/curriculum roles gain no new access. grading-only administrators may trigger trusted computation but still cannot directly download private bank keys. Mobile Bearer credentials, anonymous/revoked/expired users and other mobile roles cannot use these routes. Admin/mobile identity separation, no-store errors/responses and production HTTPS remain unchanged.

| Method | Endpoint under /api/v1/admin/grading | Contract |
|---|---|---|
| POST | /attempts/{attempt_id}/evaluate | Body {policy_version:"objective-exact-v1"}, or its current default. Server chooses the engine and fixed approved policy; client correctness/score/weights are rejected. Returns sealed RunView. |
| GET | /runs/{run_id} | Explicit grading.read; immutable internal outcome/policy/item detail. |
| GET | /attempts/{attempt_id}/runs | Explicit grading.read; summaries with limit 1–100/default 20, offset up to 100000; evaluation timestamp descending/UUID tie-break. |

Run/item DTOs expose policy/version/evidence IDs, actor/timestamps, reasons, internal correctness/points and limited response-presence/schema metadata. They never expose private configurations, expected strings/options/mappings, Flashcard backs, explanations/rubric bodies or learner response text. No mobile endpoint, Next BFF path, grading UI, result release, notification or grading-on-submit was added. User-selected attempt/engine/policy identity is not authority to access a run without live permissions.

Unknown objects return 404, unfinalized/incompatible evidence or transaction conflicts 409, unsupported inputs 422, missing live permission/CSRF/Origin 403 and invalid credentials 401. Safe errors never echo keys or raw responses. An unknown structural assignment without complete evidence fails without a fake empty run. Retirement is not academic invalidation: no approved academic-invalidation/adjudication field exists; formal invalidation/remediation still needs a future policy. Evidence inconsistencies are safely flagged rather than guessed.

## Permissions and immutable persistence

Operator CLI adds grant/revoke-grading-read and grant/revoke-grading-run. Reader grants grading.read; runner explicitly grants read+run. Commands reuse existing separate-admin identity checks, user locks, role-drift validation, overlap-safe revocation and safe audits. No real account, credential, permission or content was seeded. Real OIDC/provider MFA remains disabled until configured; tests use synthetic administrator sessions in disposable databases.

Live administrator User/browser-session locks, shared content advisory 78090001, locked/refreshed finalized attempt, evidence reads, run/item writes and audit share one transaction. Different administrators serialize on the attempt. The unique attempt/engine/policy tuple returns the same completed run on retries, without another evaluation audit. Failed processing rolls back run/items/audit entirely and can safely retry. No second transaction writes unchecked grades.

Additive **0010_grading_results** creates two necessary sidecar tables, increasing the domain count **60 → 62**. Original capture grade fields remain NULL/unscored and submitted answers remain immutable. New run/item rows pin exact assignment-version, question-revision, optional key and response IDs plus original source/applied rubric versions. Explicit composite FK/unique names avoid the old bootstrap naming problem. Database guards validate eligible finalized captures, evidence links, exact item coverage, state/point consistency and aggregate sums before sealing. Sealed runs cannot change/delete; items are append-only and cannot be added after sealing. PUBLIC access is revoked. Downgrade refuses retained history. Frozen 0001–0009 and original SQL artifacts remain unchanged.

After verification, the specifically checked development database fluentt_local on localhost:55432 was backed up to ignored private-data/verification/section21-before.dump, then normally upgraded 0009 → 0010. **All existing 60 table row counts were unchanged; the two new grading tables were empty.** Alembic reported no new upgrade operations. No reset/downgrade, historical rewrite, automatic score backfill or unknown/deployed database access occurred. Production runtime/migration grants, trigger restrictions and deployment-wide rate limits remain deployment prerequisites.

The service accepts no research/practice/pre-test/post-test/delayed-test selector, does not query research_private or infer consent, and never creates research assessment results, scheduler events or outcome analysis. Future research grading needs an explicitly approved typed context/instrument/consent contract. Safe grading.evaluate audits record actor, run, request/time and engine/policy/status without keys, responses, grade values or credentials.

## Actual tests and limitations

| Check | Actual result |
|---|---|
| Pure grading/schema focused checks | **55 passed** initially: all-ten fixtures, exact/casefold/whitespace/Unicode rules, missing/partial/malformed responses, explicit review/unsupported/N/A states, Decimal precision, immutable outcomes and frozen new-table DDL. Also covered by final checks. |
| Initial real grading PostgreSQL tests | **5 passed**, covering HTTP permissions/CSRF, pinned versions, private-data exclusion, unchanged capture evidence, immutable results, rollback and different-administrator concurrency. |
| Full backend/PostgreSQL regressions | **613 passed**, zero failed/skipped, **137.70 seconds**. Includes earlier identity/class/enrollment/admin/curriculum/ten-method/capture regressions, migration round-trip, metadata drift and concurrency. Two existing upstream warnings. |
| Final focused backend/PostgreSQL checks | **66 passed**, zero failed/skipped, **30.34 seconds** after final historical-evidence checks and added Flashcard-only/malformed-finalization scenarios. Includes grading/schema and earlier response-capture integration tests. |
| Client/component regression cases | **123 passed**. Mobile/admin source is unchanged. The combined command also attempted the separate default admin-web harness, which failed before its tests; see the next two rows. Existing Node module-type warnings remain. |
| Default Turbopack admin-web harness | **Failed readiness timeout**: Next reported ready but its config endpoint did not become ready within the existing harness window. This was an additional unaffected-frontend check, consistent with the previously documented default-bundler limitation; not claimed as passing or fixed. |
| Webpack admin-web fallback | **12 passed**, using an ignored temporary copy of the existing harness with only --webpack added. Verified server-rendered authorization, session/CSRF/revocation/outage handling, fixed BFF allowlists and private cookie boundaries. Original test/application files were unchanged; temporary server/fixture cleaned up. This does not establish that the default Turbopack issue is fixed. |
| Ruff / formatting / Python compilation | **Passed**; 135 files formatted/checked. No configured Python static typechecker was run. |
| Local upgrade/preservation/schema drift | **Verified** exact expected database/head, backup, preserved prior 60 table counts, two empty new tables and clean alembic check. |
| Client typecheck/lint/build/Expo exports | Not rerun: no frontend source or consumed client contract changed. Previous Section 20 exports remain historical evidence, not new Section 21 checks. |

Final PostgreSQL coverage includes successful/incorrect/missing grading across all ten methods, all-Flashcard no-denominator behavior, live read/run grants/revocation, no mobile or direct-key privilege expansion, CSRF/Origin and client-score rejection, pinned-key behavior after correction/retirement, same-run retries/single audit, exact Decimal totals, immutable run/items/capture evidence, rollback after flushed results, concurrent distinct administrators, review/unsupported aggregate withholding and a malformed historical response timestamp that remains untouched. Synthetic forced manual/unsupported outcomes exercise persistence without manufacturing corrupt production data; independent engine fixtures exercise actual malformed-key/schema cases.

Early schema tests correctly detected the new table count/head scope; tests now keep historical revision checks scoped to their original migrations and separately compare both new tables/indexes against frozen 0010 DDL. Real PostgreSQL metadata checks cover the complete schema. A test-helper fixture naming lint issue was corrected. No old integrity rule or failing test was disabled.

**Not verified/implemented:** production TLS, real OIDC/MFA/provider sessions, least-privilege deployed runtime grants, independent academic/psychometric validation, manual adjudication/remediation, semantic/spelling/synonym grading, scored Flashcards, result release and research grading. No physical/native/UI grading test applies to this backend-only section; existing native end-to-end limitations remain. Default Turbopack readiness remains an unresolved frontend-environment check. PostgreSQL was available and no final integration test was skipped.

## Every changed file

Against the pre-section SHA256 baseline: **17 existing files changed, 11 new files including this report, 311 previous files unchanged, zero removed**. Existing mobile/admin frontend source, package/environment files, original handoff, accepted reports and frozen migrations are preserved. Mobile package-lock SHA256 remains 92FABC14C7635427E3D1849BFFEACAEC9050405C361AEFE2EEBEEC4DFFEA63C6. Ignored test logs, Webpack harness copy and database backup/helper are local artifacts.

```text
AGENTS.md
README.md
docs/ADMIN_AUTH.md
docs/API_DESIGN.md
docs/ARCHITECTURE.md
docs/ASSIGNMENTS.md
docs/DATABASE_SCHEMA.md
docs/DECISIONS.md
docs/DEVELOPMENT_PLAN.md
docs/GRADING.md
docs/MIGRATIONS.md
docs/QUESTION_BANK.md
docs/SECTION_21_REPORT.md
docs/VOCABULARY.md
services/api/app/api/v1/router.py
services/api/app/models/__init__.py
services/api/app/models/grading.py
services/api/app/modules/administration/cli.py
services/api/app/modules/grading/__init__.py
services/api/app/modules/grading/engine.py
services/api/app/modules/grading/router.py
services/api/app/modules/grading/schemas.py
services/api/app/modules/grading/service.py
services/api/migrations/versions/0010_grading_results.py
services/api/scripts/document_schema.py
services/api/tests/integration/test_grading_postgresql.py
services/api/tests/test_grading.py
services/api/tests/test_schema.py
```

## Section 22 readiness

**Ready to proceed to Section 22 after your acceptance and its authoritative prompt.** Approved internal objective evaluation has no remaining Section 21 implementation blocker. Section 22 must decide result ownership/access/release, treatment of review-required/unsupported/N/A runs, any permitted grade representation and feedback disclosure, including whether these internal evaluations of earlier unscored captures may be released. Do not infer release from COMPLETE or turn automatic subtotals into final grades. Account for the known default Turbopack readiness issue if frontend work is requested; the tested Webpack fallback remains available. No result-release UI, instructor dashboard, AI/ESR or research analysis is implemented. Stop for acceptance.
