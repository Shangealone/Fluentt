# Classroom results and feedback — Section 22

The user approved explicit instructor release of existing Section 21 COMPLETE evaluations of ordinary classroom captures, including earlier Section 20 submissions. This is **equal-point objective evaluation**, not conversion of the original unscored capture into an examination grade. Grading still requires a separate administrator with grading.read/run; submission, instructor reads and release never execute the engine or enqueue a job. Existing engine policy snapshots retain their original no-release computation boundary; this separate visibility contract does not alter them.

## Access and lifecycle

- Every request authenticates the live mobile session. Students can read only their own assignment result through a currently eligible active membership and active class/instructor. Leaving/removal, disabled identities/class or revoked/expired credentials deny subsequent access without deleting history. An eligible rejoin restores access to the same retained submission/release; removal still prevents self-rejoining under enrollment policy.
- Only the owning instructor can list finalized captures, inspect evaluations, or change visibility, and only for currently eligible school students. No former-member roster, unrelated class, personal-learner, administrator-cookie-to-mobile promotion or research-private data is exposed.
- No attempt/in-progress: `not_submitted`; finalized without evaluation: `submitted` (awaiting administrator evaluation). There is no automatic processing queue, so no fabricated processing indicator.
- COMPLETE, unreleased: `withheld`. REVIEW_REQUIRED (including unsupported evidence): `awaiting_manual_review`, no overall score. NOT_APPLICABLE/all-Flashcards: `not_applicable`, no denominator. Only COMPLETE can be released. No automatic subtotal is passed off as a final grade.
- Release requires explicit instructor confirmation, selected immutable run ID, UUID Idempotency-Key and current If-Match revision. The first release pins that run permanently. Instructors may withdraw visibility and re-release **that same run**, retaining every decision. A newer engine/policy run never replaces the pinned evaluation. No score edit, adjudication, appeal, academic invalidation or instructor-written feedback workflow is approved here.
- Repeating the same request returns current authorized state without an additional event/audit. Reusing its key for another payload/attempt conflicts. A delayed release retry after withdrawal cannot resurrect visibility. Competing stale changes fail rather than overwrite another decision.

## Disclosure

Before release, student responses contain identity/submission metadata and an appropriate lifecycle status, without scores, item review or evaluation identifiers/configuration. After release, the student receives exact Decimal-string earned/possible points, evaluation identity/engine/policy and ordered read-only item outcomes: original pinned public question front, original submitted response, correctness and awarded/max points. Missing answers remain missing; raw Unicode and whitespace are preserved. Flashcard recall is subjective and has no objective points; its back is not returned, even if revealed while taking the assignment.

Owned instructors may inspect the same safe fronts, original responses and actual item states before release, including partial automatic outcomes in a review-required run. Overall totals remain unset when unresolved. Malformed historical answers are retained unchanged but omitted from widget presentation; response IDs distinguish unavailable malformed evidence from no submitted answer. Unknown/missing structural evidence fails safely for operator review.

Expected answers, accepted-answer strings, private explanations/corrections, answer-key IDs/configuration, rubrics, Flashcard backs and research telemetry are never returned by result endpoints. The service never queries QuestionAnswerKey. The learner's own answer can naturally coincide with a correct answer; that does not grant access to the stored key. Retirement preserves pinned published history and does not imply academic invalidation. Controlled research pre/post/delayed tests remain outside these ordinary-classroom contracts; no study feedback timing or consent is inferred.

## API

Paths follow `/api/v1`; mobile Bearer authentication, HTTPS requirements, bounded session throttling and no-store responses/errors follow existing conventions.

| Method | Path | Authorized contract |
|---|---|---|
| GET | `/assignments/{assignment_id}/result` | School student, own current eligible classroom result; no attempt is a real empty state. |
| GET | `/assignments/{assignment_id}/results` | Owner, paginated finalized current-member submissions, no grade/response body in roster. |
| GET | `/assignments/results/{attempt_id}` | Owner, selected safe evaluation/detail; optional `run_id` before first pin, otherwise the pinned run. |
| GET | `/assignments/results/{attempt_id}/evaluations` | Owner, paginated sealed ordinary-classroom run summaries for that eligible student's attempt. |
| POST | `/assignments/results/{attempt_id}/release` | Owner, `{run_id, released, confirm:true}`, UUID Idempotency-Key plus If-Match. Release/withdraw/re-release only. |

Lists use limit 1–100/default20, offset 0–100000, stable timestamp/UUID ordering. Item review follows original item positions. Point values are decimal strings, never client-calculated percentages/letter grades. Missing authentication=401, wrong role=403, unavailable ownership/membership/object=404, malformed requests=422, missing freshness=428, stale/illegal transitions/content/lock conflicts=409. Errors do not echo response text or secrets.

## Persistence and locking

Additive **0011_result_release** introduces one append-only `assessment_result_releases` ledger (62 → 63 domain tables). Each event records attempt, exact run/version, instructor, request UUID, consecutive sequence and visibility; Entity timestamps supply the decision time. Unique actor/request and attempt/sequence constraints enforce replay/ordering. A PostgreSQL trigger locks the attempt, validates finalized ordinary-classroom/COMPLETE evidence and instructor ownership, freezes the first run ID, requires alternating visibility, and rejects all event updates/deletes. Existing grading, capture, question and migration history remains untouched. Downgrade refuses occupied release history. PUBLIC access is revoked; least-privilege production runtime grants still require deployment review.

Owner authorization locks the instructor/session, owned class, shared content advisory 78090001, current student/membership and finalized attempt before release and safe audit. Student-row shared locks use NOWAIT: a student operation already holding its user lock and waiting for the owner produces a retryable 409, avoiding an inverse owner/student lock wait. Locks refresh ORM state after waiting. Student reads reuse student_context's student→owner→class→membership/content order, so withdrawal and student disclosure are serialized by the owner lock. Result selection, visibility, audit and response materialization share the transaction. Audit records contain event/attempt/run IDs and sequence, never keys, answers, score values or credentials.

## Mobile flow

Students: **My Classes → Published assignments → Results**. The result screen shows server-confirmed submission/evaluation/withheld/released/N/A status, refresh, and assignment access. Released review is one question at a time using the ten existing controlled widgets in disabled review mode; answer keys and card-back actions remain unavailable.

Instructors: **Owned class → Assignments → Results and release** on a published assignment. Choose a currently eligible submitted student, inspect the persisted evaluation (or an empty awaiting-evaluation state), then confirm release/withdrawal. Before a run is pinned, the paginated evaluation selector can inspect existing versions. Release does not create evaluations. Explicit refresh reconciles other-device changes and unknown network outcomes; retry preserves the original key/body/freshness and no new change is offered until reconciled. Back navigation warns during pending visibility decisions. Protected data clears on current authentication/access failure; focus/unmount boundaries ignore late reads/writes.

No new dependencies, insecure credential storage, authoring/editor duplication, result-release notifications, full analytics or research execution are introduced. Physical-device accessibility, orientation, native Back and real OIDC/TLS deployment remain separately unverified; component/native-handler tests and exports are not device execution. See SECTION_22_REPORT.md for actual test evidence and Section 23 prerequisites.
