# Instructor-created lessons and quizzes

Status: feature scope approved by the user on 2026-10-31; Canvas preview is next. Application implementation has not started.

## Confirmed direction

- Instructors can write lesson content and author their own quiz questions.
- A teacher owns a reusable lesson library and explicitly shares lessons with classes they own.
- Use Fluentt’s approved visual style and a Canvas preview before live UI implementation.

The user’s first “yes” was interpreted as including both content and quiz questions. Their subsequent “yes” accepted reuse across their own classes with explicit class sharing.

## Recommended approach

Build teacher-owned, versioned content alongside the administrator curriculum. Extend the existing assignment pipeline to accept that content, retaining its attempt and result behavior.

This follows the selected reusable-library approach. Copying a lesson into every class would make corrections and reuse harder. Giving teachers administrator curriculum access would expose shared content beyond their ownership. Neither alternative fits the selected ownership model.

## Product scope proposed for approval

### Teacher library

- Add **My lessons** on the instructor homepage and **Lessons** on class details.
- From a class, show lessons shared with that class and actions to create or share an existing lesson. Creating from a class preselects its context without sharing automatically.
- Library cards show title, grade, language, subject, and actual draft/published/archived state. Show only returned information.
- A teacher can access only their own authoring library and private answer keys. Other teachers’ content is unavailable.

### Lesson editor

- Use **Details → Content → Quiz → Review** with retained local edits when moving between steps.
- Details: title, grade, learning language, and subject. Use existing grade/language/subject definitions; do not infer subject from language.
- Content: optional introduction and ordered text sections, each with a heading and body. Provide add, move, and remove controls. Text only in the first release.
- Quiz: optional ordered questions. Reuse the ten existing question formats and validation rules, with teacher-friendly labels and author-only answer controls.
- Review: preview the learner-facing content, edit each section, **Save draft**, and **Publish lesson**.
- A lesson can be published without quiz questions when it has reading content. A quiz assignment still requires at least one eligible question.
- Lesson publication requires a valid title/context and nonempty reading content or at least one valid question. Do not publish an empty shell.
- Use explicit saving, duplicate-submit guards, optimistic freshness, and retained retry identity. An uncertain save must be reconciled or retried with its original body/key.
- Confirm leaving unsaved work. Block conflicting actions while a request is active. Clear private state on session loss and reject late responses.

### Publishing and class sharing

- Publish freezes a specific lesson version and its ordered content/question revisions.
- Sharing is a separate explicit action: choose compatible active classes owned by the teacher, review the selection, then confirm.
- Compatible means matching grade, learning language, and subject when the class already has a subject. An unbound class requires explicit subject binding and existing retained-content conflict checks, as with assignment publication.
- Publication alone does not expose a lesson to students.
- All currently eligible members of a selected class can read its shared lessons, including later joiners. Removed members and inactive users/classes lose access through live server checks.
- Corrections create a new draft version. Sharing a new version is explicit; it never silently updates existing assignments or student responses.
- Proposed directory rule: each class shows one currently shared version per lesson. Explicitly sharing a newer version replaces that lesson’s reading entry after confirmation; older versions remain in teacher history and pinned assignments. Keep retained sharing history rather than deleting the prior share.
- **Stop sharing** removes the lesson from the class’s current lesson directory after confirmation. Existing published assignments, attempts, and results retain their pinned content and existing access rules.
- Archiving removes content from new selection/sharing while preserving already shared versions and assignment history. Stop sharing remains a separate action; no hard deletion of retained work.

### Quiz delivery

- Teacher-authored quiz questions become a source in the current assignment builder alongside administrator curriculum questions.
- **Create assignment** from a shared lesson opens the existing builder with that class and lesson version selected. Do not create or publish an assignment automatically.
- One assignment uses one source lesson version; do not mix official and teacher lesson sources in the same assignment for this release.
- Retain existing title/instruction limits, ordered questions, 200-question limit, explicit draft save, publication confirmation, and class-specific assignment destinations.
- Student quiz work continues through published assignments, the existing assignment player, explicit saved progress, the single resumable attempt, submission receipt, and existing result visibility rules.
- Do not add a second quiz-attempt system or grade a lesson simply because it was read.
- Teacher authoring does not grant administrator grading permissions. Do not add automatic evaluation, automatic result release, score overrides, or new scoring semantics. Existing evaluation availability must be stated honestly.

### Student experience

- Add **Lessons** to each joined class’s actions in the student homepage and My classes.
- Show only explicitly shared published versions under the class’s lesson list, with title, teacher, and available publication metadata.
- Open a focused reading view with ordered sections and a **Class assignments** action for quiz work.
- Reading a lesson does not start an attempt or record completion. Do not invent reading progress, scores, streaks, or time spent.
- A teacher’s entire library, draft questions, and private answer keys never appear in student lesson responses. Flashcard backs remain restricted to the existing authorized attempt reveal flow.

## Compatibility and architecture

### Findings from the current code

- `models/curriculum.py::Lesson` requires a curriculum topic and has no teacher ownership field.
- `QuestionRevision.lesson_id` and `AssignmentVersion.lesson_id` currently reference official lessons.
- `assignments/service.py::lesson_path` validates the official curriculum hierarchy, grade, and subject.
- Curriculum and question authoring endpoints currently require administrator authorization.
- Assignment capture and evaluation pin question revision IDs; they must keep loading the exact original evidence.

Consequently this feature needs additive backend/storage work as well as UI. It cannot be implemented by showing an existing administrator editor to teachers.

### Implementation direction

- Introduce teacher-owned lesson roots, immutable published versions, ordered text sections, and explicit class-to-version sharing records.
- Reuse existing question definition/private-key validation. Add a clearly discriminated official-versus-teacher lesson source to question/assignment context using additive schema changes and database constraints. Existing official rows remain valid without rewriting frozen history.
- Keep existing question revision and answer-key identity usable by the assignment/capture/evaluation pipeline. Do not convert old IDs or invent official curriculum editions for teacher content.
- Source selection and authorization must be centralized and reused by assignment saving, publication, capture, results, progress, monitoring, and lesson reads. Any existing official-only joins must be audited before enabling teacher-source assignments.
- Teacher lesson snapshots expose their actual title/grade/subject/language and provenance. Official edition metadata is absent when inapplicable; filters and UI must represent this honestly.
- Add authenticated owner-scoped lesson authoring endpoints, class sharing endpoints, and membership-scoped student lesson reads. Keep administrator grants and authoring endpoints separate.
- Reuse `SessionController.run`, role-aware protected navigation, no-store protected reads, server pagination, deterministic ordering, focus refresh, and stale-response cleanup.
- Author-only private-key responses are separate from public previews. Validate ownership on every key read or write.
- Mutation replay keys, freshness checks, and audit records must be durable and transactional. Audits contain actor/resource/action identifiers, never lesson text, student answers, keys, or credentials.
- Preserve current lock ordering. Revalidate live session, role, class ownership, membership, share, and content version after waits and before materializing protected responses.
- Use new forward migrations; do not edit frozen migrations, reset the database, or silently run migrations at application startup.

Exact table/DTO names, route names, lesson text limits, and page sizes are implementation choices to record in the implementation plan. Reuse existing field limits where contracts already exist; define and document new text-section limits before building the editor.

## Visual direction and preview

Use Plus Jakarta Sans, Fluentt logo, warm background, green text, coral primary actions, rounded white cards, and new coordinated lesson-workbench artwork. Match the current instructor and student headers, keyboard spacing, and navigation.

Canvas should cover the teacher library, class lessons, all four editor steps, question authoring/preview, class-sharing confirmation, revisions, student lesson list/reader, and empty/loading/error/interrupted-request states. Include 390px, 320px, enlarged text, long names, and accessible controls at least 44px tall. Preview records and sharing interactions remain local.

## Delivery sequence

1. Approve the feature design and review a Canvas preview before changing live screens.
2. Implement ownership/versioning/sharing storage and authenticated APIs.
3. Integrate both content sources across assignments and every affected read projection.
4. Implement teacher authoring and sharing, then the student lesson list/reader.
5. Update feature documentation and the redesign tracker. Record verification separately; prior UI work was not functionally tested.

The prior request to leave app testing to the user remains in effect. Backend authorization and migration checks are a proposed follow-up before release, not evidence already obtained. Applying a migration to the running local database should follow inspection and preservation of its existing data.

## Excluded from this release

File uploads, rich HTML, embedded external media, AI lesson/question generation, teacher-to-teacher sharing, public catalogs, personal-learner access, automatic evaluation/release, new quiz policies, research integration, APK builds, and automatic production deployment.

## Approval requested

Approve the proposed scope: a reusable teacher-owned text lesson and question library, explicit sharing to compatible owned classes, and delivery of quizzes through existing assignments. The scope and architecture above are recommendations, not claims that the user has approved every detailed policy.

A source-only builder check identified the class-directory behavior across revisions as the remaining ambiguity. The proposed directory rule above resolves it for review; no application execution or testing was performed.
