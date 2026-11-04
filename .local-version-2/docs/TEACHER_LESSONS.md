# Teacher-created lessons and quizzes

Implemented: 2026-11-01. Feature scope and Canvas were approved before application changes. App functionality and automated checks were not executed, following the user's standing preference.

## How to use it

Teacher homepage → **My lessons**, or Class details → **Lessons** → **Create a lesson**.

1. Enter a title, grade, learning language and an existing subject; optionally add an introduction.
2. Add ordered reading sections. Each needs its heading and text.
3. Optionally author questions using any of the ten existing formats. Answer controls are private to the owner. Student preview uses the existing question controls with no keys or correctness.
4. Review and **Save draft**. Publishing requires reading content or a valid question.
5. **Publish lesson** freezes that version. It does not share automatically.
6. **Share with a class** offers compatible active classes owned by that teacher. Subject binding is explicit for unbound classes and checks retained class content first.
7. From Class lessons, **Create assignment** opens the existing builder with that exact shared version selected. Select its questions, save, and publish the assignment through the existing flow.

Students open **Class lessons** from their homepage class card or My classes. A shared reading does not start an attempt or record completion. Quiz answers continue through class assignments, the existing player, and current results/release policies.

## Publication and history

- The teacher library is private; personal learners and other teachers cannot browse it.
- Corrections use **Create a new version**. One unpublished draft at a time avoids competing correction branches.
- Sharing a version replaces the current reading entry for that lesson in the selected class only. All share changes append retained events.
- **Stop sharing** removes the class directory entry. Already published assignments retain their original lesson/question references and live membership access rules.
- **Archive lesson** blocks new selection, publication, revision and sharing, preserving existing shares and assignment history. Existing shares can still be explicitly stopped.
- Existing administrator curriculum and its question bank remain separate from teacher authoring.
- No automatic evaluation, new grading permissions, automatic result release or score editing is added. If an assignment has not been evaluated through the existing authorized process, its result remains unavailable/waiting as before.

## Storage and access

Migration `0019_teacher_lessons` follows `0018_personal_history`. It adds teacher roots, version metadata, ordered question links, append-only class-sharing events and durable mutation replay records. Teacher versions use explicitly marked lesson leaves with NULL curriculum topics; existing lesson, question, assignment, attempt and result IDs are preserved. Constraints distinguish teacher leaves from official curriculum ancestry.

Teacher questions reuse the existing revision/key contracts. A copied lesson version gets independent question identities, retaining the original assigned evidence. Published versions/text/order/private evidence are guarded against changes. Draft replacement touches only unlocked unpublished draft questions.

Every authoring request checks the current mobile instructor session and owner. Sharing additionally locks/revalidates owned classes before the content boundary. Student reads reuse the existing live student/owner/class/membership context and project text/context only. General materials and personal practice do not expose teacher leaves. Administrator question authoring excludes teacher roots.

Mutation UUID and exact-body fingerprints are transactional; retries replay the original response without reapplying a publication/share/withdrawal. ETags derive from root identity and monotonic revision, not private key content. The internal replay table retains owner response snapshots, including private authored definitions, and is never a student-facing source. Audits contain action/resource IDs only.

## APIs

All paths are beneath `/api/v1` and use existing secure mobile/browser credential handling.

| Method | Path | Purpose |
|---|---|---|
| GET | `/instructor/lesson-subjects` | Existing subject choices |
| GET/POST | `/instructor/lessons` | Private paginated library / create draft |
| GET | `/instructor/lessons/{id}?version_id={id}` | Owner detail, including version-bound private definitions |
| GET | `/instructor/lessons/{id}/classes?version_id={id}` | Paginated owned-class compatibility choices |
| POST | `/instructor/lessons/{id}/actions` | Save, publish, new version, archive, share, unshare |
| GET | `/classes/{id}/teacher-lessons` | Current member’s shared lesson directory |
| GET | `/classes/{id}/teacher-lessons/{lessonId}` | Current shared reading; no questions/keys |
| GET | `/classes/{id}/assignment-lessons/{lessonId}` | Exact eligible source context for assignment creation |

Creates and actions require `Idempotency-Key`; actions also require `If-Match`. Destructive visibility changes and publication require explicit confirmation. Request snapshots remain in client memory only. Inputs freeze after uncertain writes, with original-request retry and a confirmed reload/exit path. Account navigation and browser reload are included in unsaved/uncertain-exit protection.

Limits: title 200 characters, introduction 8,000, 50 sections, section heading 200, section body 20,000, 200 questions, 64 KiB per question and 1 MiB per lesson request. Grade 1–12 and English/Tagalog retain their existing meanings. Subject and language are separate choices.

## UI routes

- `/instructor-lessons` — teacher library; optional `classId` scopes to that class’s current shares.
- `/instructor-lesson` — create/edit; `id` and optional `versionId` open retained versions; optional `classId` preselects grade/language without sharing.
- `/class-lessons?classId=…` — student directory; `lessonId` opens a focused reading.

The existing assignment builder accepts an optional `lessonId`. Teacher context has `source=teacher`, a lesson version, and NULL curriculum edition fields. Progress/history and monitoring retain real assignment counts; edition pickers omit inapplicable NULL editions rather than inventing one.

## Local delivery record

- Source-only review found and corrected an account-navigation path that could have discarded unsaved edits or uncertain request identity.
- The existing local database was backed up under ignored `private-data/teacher-lessons/` before applying migration 0019.
- After the migration: users 21, classes 3, lessons 3, questions 37, assignment versions 1, assignment attempts 0 — unchanged from the pre-migration counts. No example lessons or quiz attempts were inserted.
- Existing local listeners: mobile web 8082, API 8001, PostgreSQL 55432.
- No app tests, typecheck, lint, automated functionality checks, APK build, commit or push were performed for this feature. Native behavior and complete teacher/student execution need the user's hands-on testing.

### Later trigger correction

During administrator content import on 2026-11-01, migration 0019's shared trigger tried to access `instructor_id` on unrelated curriculum rows, causing those writes to fail. The failed import rolled back. Forward migration `0020_teacher_trigger_dispatch` narrowed that field access to teacher-lesson rows; it was applied locally after a private backup, and the administrator draft import subsequently committed. No frozen migration or existing content was rewritten. No application test suite was run.

## 2026-11-03 classroom grouping update

Class proficiency is an optional client assessment label: Beginner, Intermediate, Advanced. Class sharing and assignment eligibility now match language and subject without requiring school-grade equality; lesson grade remains curriculum metadata. Existing class grades and historical assignments are preserved. See CLASS_PROFICIENCY.md for migration and access details.
