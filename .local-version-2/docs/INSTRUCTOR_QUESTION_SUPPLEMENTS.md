# Questions from the assignment builder

When the first unfiltered question page is empty, the builder offers **Create questions**. An empty search/filter result instead offers **Clear filters**. Searching does not establish that a lesson has no published questions.

For a shared curriculum lesson, instructors can author a question using the existing ten-format editor, preview its student-facing definition, and explicitly confirm **Publish question**. Publication locks that question version, selects it locally, and returns to the assignment's Questions step. The assignment still needs an explicit save and publication. Its title, instructions, lesson and selections stay in memory while authoring; browser reload discards unsaved work after a warning.

These supplementary questions belong to the authenticated instructor and the selected class. They do not edit the shared lesson. They are excluded from other class catalogs, shared/personal practice, the general content-bank listing, and administrator lesson-library exports. Captured or published assignment snapshots keep their existing access and retention rules. No new administrator authoring permission is granted.

For an instructor-owned lesson, the builder opens its existing editor in place. Continue an existing draft, or create a new version of a published lesson. Publish and explicitly share the new version with this class, then return. The builder asks before replacing its selected lesson and clearing any prior question selections; title and instructions remain.

`POST /api/v1/classes/{class_id}/assignment-questions` accepts `lesson_id`, the existing validated teacher question definition, and `confirm: true`, with a UUID `Idempotency-Key`. It returns a key-free assignment question item. Live instructor/class ownership, current lesson eligibility, original request fingerprint and a single transaction protect publication. Unknown outcomes retain the exact question body/key and freeze editing until retry or deliberate cancellation. The migration `0024_instructor_questions` adds only the immutable supplement ownership/retry links; it does not rewrite existing lessons, questions, assignments, or learner records.

The development demo cannot publish real questions and reports that limitation explicitly. Native-device and full end-to-end testing remain separate from the focused checks for this feature.
