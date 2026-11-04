# Instructor lessons preview implementation plan

> **For agentic workers:** Use superpowers:executing-plans for the eventual application implementation. This plan covers only the approved preview deliverable; it does not authorize deployment or claim completed application work.

**Goal:** Make the approved teacher lesson ownership, authoring, sharing, and student reading flow reviewable before changing the app.

**Architecture:** One self-contained interactive preview with local illustrative records. Host preview controls choose views, request states, publication states, width, and enlarged text. Product actions navigate the proposed workflow without contacting a server.

**Tech stack:** HTML, scoped CSS, local JavaScript, Plus Jakarta Sans, bundled Fluentt logo, provided Lucide line icons, new CSS illustration.

**Spec:** `docs/superpowers/specs/2026-10-31-instructor-lessons-design.md` (scope approved).

## Constraints

- Match the approved Fluentt design, support 390px/320px and enlarged text, and keep controls at least 44px tall.
- No app code, API calls, database changes, real sharing, generated credentials, or app testing in this preview task.
- Use teacher-only answer controls and a separate learner-facing question preview.
- Retain typed preview data when navigating between editor steps.
- Revisions and sharing must explain immutable assignment history and explicit replacement of the class reading version.

## Task 1: Library and authoring preview

- [x] Create `instructor-lessons-preview.html` in the thread visualization directory with compact header, teacher library, class lesson view, and new lesson-workbench art.
- [x] Add Details, Content, Quiz, and Review steps; local controls edit and reorder sections/questions.
- [x] Add question editor templates for the ten existing formats and a key-free student preview.
- [x] Add explicit save/publish controls and local confirmation states. Publishing alone does not share.

## Task 2: Sharing and student preview

- [x] Add compatible owned-class selection with confirmation and an example unavailable class with an explanation.
- [x] Show published, archived, revision, stop-sharing, and uncertain-save presentations.
- [x] Add student class lesson list and focused ordered reading view. Quiz work links to class assignments; opening a reading never starts an attempt.

## Task 3: Preview delivery

- [x] Add host controls for views, request states, publication state, screen width, and enlarged text outside the depicted app.
- [x] Read the fragment source for missing identifiers, mismatched controls, escaped markup, and unsafe interpolation. Do not execute app tests or automated checks.
- [x] Present the preview for visual approval. The next application plan must cover additive storage/API work and integration of teacher content across assignments, capture, results, progress, and monitoring before live implementation.

## Review focus

Keep answer keys out of student previews; prevent publication being mistaken for class sharing; preserve local editor inputs between steps; show newer shares as explicit replacements; do not invent completed quiz attempts or grading results.

## Delivery record

Preview created in the thread visualization directory as `instructor-lessons-preview.html`. Source was inspected for local navigation, retained draft state, explicit class sharing, separate published reading snapshots, responsive styling, and guarded request-state controls. No application code, APIs, database records, app tests, or automated checks were run or changed. Live implementation remains pending visual approval and its application implementation plan.
