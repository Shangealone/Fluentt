# Fluentt UI redesign tracker

Updated: 2026-11-04

This tracker records the page-by-page redesign work discussed for Fluentt. “Redesigned” means the approved presentation has been implemented in the app; it does not claim that the user has completed hands-on testing. Keep this list current as new pages are approved and implemented.

## Completed in the current Fluentt visual direction

Shared look: Plus Jakarta Sans, warm background, deep green text, coral primary actions, pastel illustrations, rounded white cards, clear wrapping, and the learner or teacher bottom navigation appropriate to each role.

ESR addition (2026-11-02): administrator `/vocabulary` preparation and school learner `/vocabulary-review` presentation added. These are a gated feature foundation, not an approved live study. Genuine inference and the complete participant workflow remain unavailable; see `ESR_IMPLEMENTATION.md`. Existing page redesign status below is unchanged.

| Area | Page or route | Status |
|---|---|---|
| Entry | `/` welcome | Implemented |
| Sign-in | `/auth` sign-in, two-step account creation, class verification, and Finish sign-in | Implemented; user testing pending |
| Personal learner | `/student` home | Implemented |
| Personal learner | `/question-practice` Learn | Implemented |
| Personal learner | `/pronunciation` Speak | Implemented |
| Personal learner | `/conversation` Chat | Implemented |
| Personal learner | `/personal-stats` My progress | Implemented |
| Personal learner | `/preferences` learning focus | Implemented; user testing pending |
| Shared | `/account` account and settings | Implemented |
| Shared | `/notifications` notifications | Implemented |
| Learners and instructors | `/learning-materials` resource list and focused reading view | Implemented; user testing pending |
| Personal setup | `/learning-focus`, `/language`, `/experience` | Implemented; learning focus stays optional; user testing pending |
| Account setup | `/set-password` initial password setup | Implemented; user testing pending |
| School learner | `/student` home | Implemented |
| School learner | `/my-classes` | Implemented |
| School learner | `/published-assignments` list and assignment details | Implemented |
| School learner | `/learning-history` My progress | Implemented 2026-10-31; user testing pending |
| School learner | `/assignment-attempt` question player, review, and submission receipt | Implemented 2026-10-31; user testing pending |
| School learner | `/assessment-results` result status and shared answer review | Implemented; user testing pending |
| School learner | `/research` studies, consent, participation, activities, assessments, and withdrawal | Implemented; user testing pending |
| School learner | `/class-code` join a class | Implemented; user confirms the current design matches the Fluentt visual standard. Back history and bottom-navigation visibility/selection were also corrected. |
| Instructor | `/instructor` home | Implemented |
| Instructor lesson authoring | `/instructor-lessons`, `/instructor-lesson` library, editor, versions and sharing | Implemented with approved Canvas; local migration 0019 applied; user testing pending |
| Instructor lesson directory refinement | `/instructor-lessons` Class lessons / Browse lessons tabs and My lessons | Approved preview implemented 2026-11-04: lesson-organizer illustration, compact cards, expandable details, and no catalog grade labels; existing eligibility/navigation retained; user testing pending |
| Instructor lesson editor refinement | `/instructor-lesson` writing page, question forms and reordering | Approved writing-page preview implemented 2026-11-04: compact steps, optional part headings, all ten simplified question forms, and hold-to-drag reordering with keyboard/up-down alternatives. Explicit saves and original retry/publication contracts retained; hands-on and native testing pending |
| School learner lessons | `/class-lessons` directory and reading | Implemented; user testing pending |
| Instructor | `/first-class` create class | Implemented |
| Instructor | `/class-edit` edit class | Implemented |
| Instructor | `/class-details` | Implemented |
| Instructor | `/assignments` class assignments | Implemented |
| Instructor | `/assignment-builder` | Implemented |
| Instructor | `/assignment-results` | Implemented |
| Instructor | `/instructor-monitoring` overview, chooser, student history, and assignment detail views | Implemented |
| Instructor and school learner | `/communication` messages | Implemented |

## Still awaiting a page redesign

All pages recorded in this mobile redesign sequence now have an implemented presentation. Hands-on testing remains separate. `/grade` continues to redirect into personal setup.

## Separate admin app

The admin landing and dashboard received an earlier responsive refresh recorded in [`UI_REDESIGN.md`](UI_REDESIGN.md). They use a separate admin visual system and were not included in the latest mobile Fluentt redesign sequence. Admin questions, curriculum, and research pages have no current Fluentt-style redesign approval recorded; review them separately if the same new visual direction should cover the admin app.

## Tracking notes

- `/login`, `/username`, `/school-role`, and `/grade` are redirects or routing steps rather than separate page designs.
- Personal `/personal-stats` and school `/learning-history` are separate progress experiences; the school history redesign does not replace personal activity history.
- The school student and personal learner both use `/student`, but each role has its own presentation.
- Continue the preview-first workflow: inspect the real screen and its data constraints, make a Canvas preview, get visual approval, implement the presentation, and preserve the existing APIs, permissions, and saved data behavior.
- The user handles hands-on testing when requested; record testing separately from visual implementation.
- Teacher-created lessons and quizzes are documented in [`TEACHER_LESSONS.md`](TEACHER_LESSONS.md). They use explicit class sharing and the existing assignment flow; they do not add automatic grading or reading-completion tracking.
- Research functionality needs a separate pass: the pre-existing assessment submission sends a fixed `response_duration_ms` value, and the current start/resume contract does not return saved responses. The redesign preserves those contracts and does not claim measured timing or restored responses.
