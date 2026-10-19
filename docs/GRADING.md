# Internal objective grading — Section 21

## Section 22 visibility boundary

Section 22 now adds explicitly approved owning-instructor release of COMPLETE ordinary-classroom evaluations, including earlier captures, through separate APIs and append-only visibility history. Computation and grading.run/read remain administrator-only; no grading-on-submit or automatic release. Submitted evidence and immutable engine/policy snapshots remain unchanged. RESULTS_AND_FEEDBACK.md defines current-member access, exact totals/own-answer review, permanent run pinning, withdrawal/re-release and always-hidden expected answers/backs. The Section 21 no-release statements below describe its historical computation scope.

This is an explicitly approved internal evaluation of finalized ordinary classroom captures. It is not student result release, instructor analytics, research evaluation or academic verification. The original unscored AssignmentAttempt and submitted StudentResponse records remain immutable and unchanged; new GradingRun/GradingItemResult records retain separate versioned outcomes.

## Approved policy objective-exact-v1

Each supported objective item has a maximum of **1.00** point in this evaluation policy, independent of QuestionRevision.points and the still-unset AssignmentQuestion.points/max_attempts. All-or-nothing: 1.00 for an approved exact match, otherwise 0.00. No partial credit, penalties, percentages, letter grades or rounding conversion. Valid missing/incomplete responses earn zero; malformed evidence requires review. This policy does not retroactively configure the published assignment or claim the earlier capture was a scored examination.

| Method | Approved comparison |
|---|---|
| Multiple Choice | Exact stable option ID. |
| True or False | Strict boolean equality; false is an ordinary answer. |
| Identification | Exact authored accepted string; when case_sensitive=false (including its stored default), compare Unicode casefold values. Otherwise preserve case. No trimming, Unicode/accent normalization, spelling tolerance, inferred synonyms or semantic equivalence. |
| Fill in the Blank | Every stable gap must be present/nonblank and match one of its authored accepted strings exactly and case-sensitively. All gaps together receive 1.00 or 0.00; no per-gap credit. |
| Multiple Select | Exact unordered set of valid IDs; neither subset nor superset receives credit. |
| Flashcards | NOT APPLICABLE for objective scoring. Again/Hard/Good/Easy is subjective; even a named rubric reference does not authorize a score. |
| Error Identification | Exact unordered target token-ID set. No correction/grammar scoring or use of private correction alternatives. |
| Word Arrangement | Exact stable-ID sequence; repeated display words remain distinct IDs. No alternative-order inference. |
| Sentence Arrangement | Same exact stable-ID sequence rule. |
| Matching Type | Exact complete one-to-one ID mapping. Pair-array order does not affect the result. |

Authored accepted alternatives are literal approved strings, not an inference that other synonyms are equivalent. Raw submitted text is never rewritten. Partial captures remain structurally valid evidence; incomplete blanks, selections, arrangements and matching receive zero under this explicit policy. Unknown IDs/duplicate references/type errors are review cases, not ordinary incorrect answers.

## States and totals

- **AUTO_GRADABLE:** supported valid objective evidence, exact awarded/max Decimal points and internal correctness flag. Reasons distinguish exact match/mismatch, missing and incomplete responses.
- **MANUAL_REVIEW_REQUIRED:** missing/unlocked/inconsistent keys, unlocked revisions or malformed content/response. No awarded/max points or correctness is invented. This label does not implement human adjudication.
- **NOT_APPLICABLE:** structurally valid Flashcards with consistent pinned evidence; no objective points. Invalid Flashcard evidence still requires review.
- **UNSUPPORTED:** unknown schema/method/policy/source-key contract; no guessed interpretation or score.

Run COMPLETE totals exist only when all applicable items are automatically resolved. Any manual/unsupported item yields REVIEW_REQUIRED with overall earned/possible totals unset; automatic subtotals are explicitly labeled and cannot stand in for a final grade. All-Flashcard runs are NOT_APPLICABLE with no overall score/denominator and zero automatic subtotals. Decimal arithmetic uses a local precision-28 context; equal integer points require no rounding. API point values serialize as exact decimal strings.

The engine identity is objective-engine-v1-u{Unicode database version}; policy_snapshot records objective-exact-v1, comparison rules, point unit, no-release context and Unicode version. Python's casefold behavior therefore does not silently replace an old runtime's recorded evaluation. Source QuestionAnswerKey.grading_version remains its original ungraded-v1 authoring marker; the applied rubric_version is objective-exact-v1. Unknown source contracts are unsupported, not executable rubrics. A future engine or policy correction must use a new explicit version/run; existing records never change.

## Authorization and API

Only separate live administrators with explicit **grading.read** may read internal evaluations. Running requires **grading.read + grading.run**, exact configured Origin and session CSRF. Mobile Bearer credentials, ordinary students/instructors, anonymous/revoked/expired administrators and existing dashboard/question/curriculum-only permissions do not confer access. No Next BFF path/navigation or mobile result endpoint is added. Real OIDC sign-in remains disabled until locally configured; test sessions are isolated fixtures only.

All paths below follow /api/v1/admin/grading, use existing administrator cookies/secure transport and return no-store success/errors.

| Method | Path | Contract |
|---|---|---|
| POST | /attempts/{attempt_id}/evaluate | Body {policy_version:"objective-exact-v1"} (or current-policy default). Runs only a finalized unscored-capture-v1 ordinary classroom attempt on its frozen distribution-only publication. Returns a sealed RunView; same attempt/engine/policy returns the existing run. Client grades/correctness/weights/engine overrides are rejected. |
| GET | /runs/{run_id} | Live grading.read; sealed internal run, policy snapshot and ordered item outcomes. |
| GET | /attempts/{attempt_id}/runs | Live grading.read; summaries, limit 1–100/default 20, offset 0–100000, evaluation timestamp descending/UUID tie-break. Empty is valid; no response/key bodies in summaries. |

RunView identifies the attempt, original assignment version, evaluating actor, engine/policy, timestamps, ordinary_classroom context, status, real item count, optional complete totals, automatic subtotals and ordered results. Items pin AssignmentQuestion, exact QuestionRevision, optional original StudentResponse and QuestionAnswerKey IDs, original key marker and applied rubric. Metadata contains response-presence/schema information, not responses or expected answers. No configuration/back/accepted-answer/private explanation/rubric contents are returned. grading.run permits trusted server computation, not direct key downloads; existing question-key permissions remain separate.

Unauthenticated=401, missing permissions/Origin/CSRF=403, unknown objects=404, unsupported input=422 and unfinalized/incompatible evidence/transaction conflicts=409. Errors never echo keys or response text. A generic failure rolls back the complete run/items/audit; retry cannot duplicate partial scores. Safe audit grading.evaluate records actor, run, request/time and engine/policy/status, without private keys, responses, grade values or credentials.

## Operator grants

From services/api using the existing restricted operator connection and an already provisioned separate administrator:

```powershell
.venv/Scripts/python -m app.modules.administration.cli grant-grading-read --username OperationsAdmin
.venv/Scripts/python -m app.modules.administration.cli grant-grading-run --username OperationsAdmin
# Matching revoke-grading-read / revoke-grading-run remove those explicit roles.
```

Reader grants grading.read; runner explicitly grants grading.read+grading.run. No account automatically gains either role. Revocation refuses ambiguous overlapping permission grants for operator review. Existing mobile accounts cannot be promoted; roles with unexpected permissions are rejected. No real account/grant was seeded here. Granting these permissions does not enable a result UI, notifications or grading-on-submit.

## Persistence, replay and safety boundaries

Additive **0010_grading_results** creates two tables (60 → 62 domain tables) because Section 20 correctly forbids overwriting capture answers/grade fields. All frozen 0001–0009 and learner rows stay unchanged. UUID/FK/composite version constraints preserve exact evidence. A unique attempt/engine/policy tuple provides durable idempotence. Runs are staged and sealed transactionally only after all pinned item outcomes exist and database-checked sums/states agree. Sealed runs and append-only items cannot be changed/deleted or receive later items. PUBLIC table access is revoked; production runtime grants/trigger restrictions still need deployment review. Downgrade refuses any grading history rather than deleting results.

Live admin User/browser-session authorization, shared content advisory 78090001, locked/refreshed finalized attempt, evaluation, result persistence and audit share one transaction. Different administrators serialize on the target attempt and return one run. Key/revision reads occur under the content boundary and use the exact assigned IDs, never latest bank revisions. Retired questions/curriculum remain valid pinned history; retirement is not academic invalidation. No approved academic invalidation/adjudication field exists: malformed/inconsistent evidence is flagged, while formal invalidation/remediation requires a future explicit policy. Missing structural assignment evidence fails safely without creating an empty/fake evaluation.

Ordinary classroom history may be evaluated after submission without changing enrollment or notifying learners. The service accepts no practice/pre-test/post-test/delayed-test/research context selector; it never reads research_private, infers consent, creates research results, alters assignments or invokes schedulers. Future controlled-research grading needs its own approved instrument/context/consent and reproducibility contracts.

Section 22 must approve who can see/release which completed results, handling of pending review, any grade representation and disclosure/feedback rules. No manual-review UI, re-adjudication, research outcomes, AI grading or release behavior is inferred. See SECTION_21_REPORT.md for actual verification and limitations.
