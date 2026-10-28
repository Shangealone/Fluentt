# Instructor question-type selection — 2026-10-27

## Newly created demo classes — 2026-10-28

The browser demo previously gave only `demo-class-1` a lesson and a question catalog. For newly created demo classes, the assignment builder now exposes a class-specific **Class practice** lesson, a question form, and the existing selected-question draft list. The instructor can create all ten formats: Multiple Choice, True or False, Identification, Fill in the Blank, Multiple Select, Flashcards, Error Identification, Word Arrangement, Sentence Arrangement, and Matching Type. The form collects each format's required public content and expected answer metadata. Fill in the Blank uses `___` gaps; ordered items and matching pairs are entered in intended correct order and presented in a different order to students. Creation selects the question in the current draft and refreshes its catalog; saved and published drafts retain the exact authored public question revisions for student attempts. Flashcards now reveal their authored back within the matching demo attempt. Answer metadata stays out of question and attempt DTOs. New demo activities remain unscored; author-entered answers are not an evaluation result.

This is synthetic, in-memory demo authoring for URLs such as `/assignment-builder?classId=demo-class-3`. A full browser reload or demo reset removes newly created demo classes/questions. Live instructor accounts still use the existing administrator-published question bank and published lesson constraints; no real instructor authoring permission, schema or endpoint was added here. Tests cover class/lesson scoping, private answer separation, validation, draft selection, publication and exact student delivery. The earlier Section 27 behavior below remains the live contract.

2026-10-28 verification: `node scripts/class-question-authoring.test.cjs` **3 passed** (including all ten student projections and authored Flashcard reveal); `node scripts/choice-components.test.cjs` **52 passed**; `node scripts/class-activity-demo.test.cjs` **3 passed**; mobile `npm run typecheck` and `npm run lint -- --quiet` passed. The localhost:8096 builder returned HTTP 200. No actual device interaction or real-account authoring was verified.

Instructors can build a classroom activity by choosing a published lesson, browsing a question type, adding exact published questions, saving a draft and explicitly publishing it. Students open **Classes → View assignments → the activity → Start, resume or view submitted receipt**. The student receives the selected questions in the instructor's chosen order, with the existing format-specific answer controls.

## Scope and behavior

- A clear, accessible radio-card selector replaces raw technical method names and the extra Apply filter step. All ten existing contracts remain: Multiple Choice, True or False, Identification, Fill in the Blank, Multiple Select, Flashcards, Error Identification, Word Arrangement, Sentence Arrangement and Matching Type.
- Browse one format at a time, or All question types. Selecting another filter keeps already selected questions, so an activity can mix formats. Filtering resets the question catalog page and clears the item preview; explicit prompt search remains available.
- Selected questions show readable type names and counts per type. Empty catalogs explain that the content administrator must publish eligible questions for the selected lesson. This does not add instructor question-bank authoring or invent live content.
- Fixed a confirmed creation-route defect: an absent assignment ID now creates an empty draft, instead of loading `demo-draft-1`. Live missing-class routes show an error; the default demo class applies only in explicit demo mode. An explicitly loaded assignment must match the selected class.
- Updated publication wording to reflect the existing student attempt feature; no new timer, scoring, attempt policy, notification or automatic release behavior was added. Published assignments remain immutable.
- The current in-memory demo now filters by type/search/lesson/class, saves exact selected revisions/order, publishes a frozen snapshot, lists the new publication for its class and opens a separate attempt containing exactly that snapshot. It no longer substitutes three sample questions or always opens the unrelated ten-question attempt. New demo activities do not inherit sample grades/evaluations from another assignment; result access reports that no scores were generated.

Live API behavior continues through the existing typed `AssignmentAccess`, `SessionController.run` authentication and server ownership, lesson/grade/language/subject, pinned revision, freshness and confirmed publication checks. There are no backend/model/migration/permission changes. Personal Learning routes, practice algorithms, history writers and research flows were not modified.

## Verification

- `node scripts/class-activity-demo.test.cjs`: **3 passed**. Synthetic QA covers blank-new-route versus explicit edit and class mismatch, all ten demo filters/empty scopes, mixed selected revision persistence, publication replay, exact student delivery, separate attempts, immutable published/submitted state and absence of fabricated new scores.
- `node scripts/choice-components.test.cjs`: **50 passed**. Includes two new tests for all ten accessible named type cards, checked radio state, immediate filtering and preservation of selected questions across format changes, alongside existing save/retry/publication/player/privacy checks.
- `node --test scripts/assignments.test.mjs scripts/capture.test.mjs`: **8 passed**. Existing typed client, role restrictions, retry/freshness, pinned IDs and capture checks.
- `pytest tests/integration/test_assignment_drafts_postgresql.py tests/integration/test_assignment_publication_postgresql.py tests/integration/test_response_capture_postgresql.py -q --tb=short -x`: **14 passed**, two existing dependency deprecation warnings. Existing real HTTP/database tests verify all ten methods, ownership/membership, publication immutability, exact item pinning, capture/resume/reveal and finalization. The first attempt encountered the stopped local database runtime; after starting it, all passed. Tests create/migrate/drop only their own generated disposable PostgreSQL databases. No application database data/migration changed.
- Mobile `npm run typecheck`: passed. `npm run lint`: **0 errors, 29 pre-existing warnings**. No dependencies added.
- Actual browser synthetic walkthrough: instructor created a new empty draft, chose Multiple Choice and Identification, added one of each, saved and confirmed publication; switched to Student in the same demo session, opened the new two-question activity and verified both the choice controls and Identification text input. Screenshots are under `output/class-question-types/`. The instructor type selector was left open for review.

Demo data is in memory and clears on reset, full reload or development module refresh; it is not a human participant record or evidence of learning outcomes. Real classroom access requires authenticated instructor/student profiles and eligible published content. No native device execution or new APK build was performed for this UI change. No commit/push/deployment occurred.

## Changed files for this request

- `apps/mobile/src/features/assignments/questionTypes.ts` (new)
- `apps/mobile/src/features/assignments/QuestionTypePicker.tsx` (new)
- `apps/mobile/src/features/assignments/AssignmentEditor.tsx`
- `apps/mobile/src/features/assignments/PublishedDetails.tsx`
- `apps/mobile/src/app/assignment-builder.tsx`
- `apps/mobile/src/app/class-details.tsx` (assignment-tool description only)
- `apps/mobile/src/demo/demoData.ts` (assignment/capture demo fidelity and new-activity result guards only)
- `scripts/class-activity-demo.test.cjs` (new)
- `scripts/choice-components.test.cjs` (two new tests)
- `docs/CLASS_QUESTION_TYPES.md` (new), `docs/ASSIGNMENTS.md`, `docs/DECISIONS.md`, `PROJECT_HANDOFF.md`

Existing unrelated administrator, APK and hosting edits were preserved.
