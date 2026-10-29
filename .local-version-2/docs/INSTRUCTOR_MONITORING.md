# Instructor monitoring — Section 24

This is a read-only view of actual ordinary classroom publications, captures and released evaluations. It does not execute grading, edit records, infer mastery or include personal/research activity. See SECTION_24_REPORT.md for verification evidence and limitations.

## Authorization and cohort

Every operation requires an authenticated instructor device session. Class routes lock/revalidate that instructor and owned class; the class must be active and unarchived. Only school_student users with active profiles, no archive timestamp, and active/unended memberships in that class enter the cohort. Former, removed and disabled users are excluded from both rows and denominators. An eligible rejoin restores retained first-attempt/result evidence; it does not create another submission. Invitation-code expiry does not end membership.

An unrelated class, student or assignment returns generic 404, noninstructor roles 403, invalid/revoked/expired credentials 401, malformed/unbounded filters 422, and contention or incompatible capture evidence 409. Success/error responses are no-store. Database failure follows the existing safe 503 envelope. No answer keys, private rubrics/explanations, response bodies, Flashcard backs or research-private identifiers are queried or returned.

Authorization and projection share one transaction. Owner/session → owned class → shared content lock follows existing instructor result conventions. Current student rows lock FOR SHARE NOWAIT in UUID order with fresh ORM state; membership rows are then locked/revalidated. A concurrent student operation may already hold its user while waiting for the owner, so NOWAIT prevents a reverse-order deadlock and returns a refreshable 409. Failed operations roll back; no monitoring record is written. Session last-use renewal remains normal authentication behavior.

## Counts: submission-counts-v1

A is the count of available published, locked distribution-only-v1 assignment versions in the selected class and optional pinned curriculum scope. S is the current eligible student cohort. Publication and membership changes can change the denominator.

| View | Available opportunities | Submitted |
|---|---|---|
| Class overview | A × S | Finalized first captures belonging to current students and available versions |
| Student class history | A | That student's finalized first captures |
| Assignment cohort | S | Current students with a finalized first capture for that version |

Each opportunity is exactly not_started, in_progress or submitted; pending=not_started+in_progress. Finalized incomplete, withheld or manually reviewed work still counts as submitted. No percentage, mastery, academic grade or curriculum coverage follows from these counts. Zero assignments or students means no meaningful progress denominator, with explicit empty states.

Submitted outcomes have separate counts: awaiting_evaluation (no sealed run), awaiting_manual_review (review-required/unsupported), withheld, released, not_applicable. There is no invented processing job, deadline or invalidation workflow. Incompatible legacy/expired captures fail closed with 409 instead of being misclassified. Opening/revealing is not submission or mastery.

Pinned assignment lesson/edition context is retained after retirement/new editions. Subject Filipino remains distinct from learning language Tagalog. Filtering selects assigned snapshot IDs, never an inferred module progression or research five-level structure.

## Released-assignment-mean-v1

Only the currently released, permanently pinned COMPLETE ordinary-classroom run contributes points. Withdrawal immediately removes its points and contribution; a newer evaluation never substitutes for the pin. N/A, missing, in-progress, unevaluated, review-required/unsupported and withheld work is excluded and shown through cohort/state counts.

Within ONE immutable assignment version, all included runs must have identical engine_version, policy_version and possible_points. With no included runs, mean status is unavailable and points NULL. With multiple comparison groups, status is not_comparable and mean/max NULL. Otherwise SQL sums exact earned points and counts results; Decimal divides once and quantizes to 0.01 using ROUND_HALF_UP under an isolated precision context. Display label: **mean released objective points**. The response includes eligible_results and version/engine/policy/max identifiers; zero earned points is a real score, not an unavailable state.

This is not an original examination grade, percentage, ranking, cross-assignment/class average, risk prediction or research outcome. Scores remain the Section 21 equal-point objective evaluation of an unchanged unscored Section 20 capture. Section 22's separately authorized instructor inspection/release of withheld runs remains available through its existing result screen; monitoring itself never exposes withheld scores.

## API

All paths below follow /api/v1, use existing mobile Bearer authentication, and are GET only.

| Path | Data |
|---|---|
| /instructor/monitoring/classes | Paginated active owned classes, grade and language; q matches class name. |
| /classes/{class_id}/monitoring | Full selected-cohort overview, as_of, A, S, counts and outcome counts. |
| /classes/{class_id}/monitoring/contexts | Assigned context choices, kind=lesson or edition. |
| /classes/{class_id}/monitoring/students | Paginated current roster, usernames, per-student counts/outcome counts; q matches username. |
| /classes/{class_id}/monitoring/students/{student_id} | Student summary and paginated safe history; q matches title and status narrows history. Its overview is a one-student scope. |
| /classes/{class_id}/monitoring/assignments | Paginated published assignments, original context, cohort/outcome counts and approved mean; q matches title. |
| /classes/{class_id}/monitoring/assignments/{assignment_id} | Assignment summary and paginated student outcomes; q matches username, status narrows rows. |

Pagination uses limit=1–100/default20, offset=0–100000 and has_more; one extra row is probed. Optional lesson_id/curriculum_version_id UUID filters select pinned contexts. q is at most 200 characters and SQL LIKE metacharacters are escaped as literal text. The shared query model validates status=all/not_started/in_progress/submitted and kind=lesson/edition; those controls affect only the routes noted above, not summary denominators. Extra fields are rejected. Context choices use distinct ID/label pairs from authorized published assignments.

Order: classes name/UUID; roster canonical username/UUID; assignments publication timestamp descending/UUID; student history most recent submitted/updated/publication timestamp descending/assignment UUID; assignment outcomes lowercase username/student UUID; contexts label/UUID. UUIDs are tie-breakers, never authorization credentials. Search/status/page filters affect rows while summaries/means retain the full selected curriculum scope. Assignment-detail selection outside its curriculum filter returns unavailable.

The service queries actual captures for grouped counters rather than constructing every class-wide assignment×student pair. Unstarted counts subtract actual captures from the denominator. Only assignment-detail pagination forms one selected assignment×current roster. Page enrichment uses shared LATERAL lookups for the latest visibility decision and pinned/sealed run. No N+1 item loop, answer-key/response query, duplicate analytics engine or new table is added. Current cohort locks/IDs scale with S; production-scale contention/load remains to be profiled, not claimed resolved by pagination tests.

## Mobile workflow

Instructor dashboard → **Monitor class progress**, or class details → **Monitor class progress**. Search owned active classes, choose a class, then switch between current student roster and published assignments. Class overview shows full-scope counts; student detail shows class history; assignment detail shows cohort statuses, released points and the narrowly defined mean. Follow submitted-result links to the existing separately authorized Section 22 review/release flow.

Use explicit search, pinned lesson/edition selection, submission filters on detail lists, bounded previous/next pages and **Refresh monitoring and access**. Refresh/search/filter/route changes remount protected read state; errors, focus loss and session invalidation hide stale rows/headers and ignore late responses. No sensitive local/offline cache, alternative session storage or browser auth bypass is added. Existing Screen/Input/Choices/Button/Picker provide scrolling, accessible labels, wrapping and keyboard/Back conventions. Native assistive technology/orientation/Back checks still require devices; exported bundles and component tests do not establish them.

## Next section boundary

No new publication, score override, notification, messaging, predictive analytics, AI, adaptive scheduling or research policy is approved. Section 25 requires acceptance and its authoritative prompt. Keep current-member privacy, immutable pins and released-only aggregates; any new metric or activity writer requires an explicit supported definition.
