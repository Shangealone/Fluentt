# Client assessment levels for classes

The client assesses English proficiency and groups students as Beginner, Intermediate, and Advanced. Class creation/edit now offers these optional labels with the instruction to select the level assigned through the school's assessment. The database/API values are beginner, intermediate, advanced, or null; null displays as Level not set. Instructors may clear or correct the label. This records an external assessment result and does not perform or claim to validate that assessment.

Existing class grade IDs are preserved as legacy metadata. New UI requests omit grade. No grades, ages, activity scores, CEFR levels, or Easy/Medium/Challenging preferences are converted to proficiency. Existing classes remain unclassified until an instructor records a result.

## Curriculum and access

School grade no longer filters classroom curriculum browsing, assignment lesson selection, or teacher-lesson sharing. Lesson curriculum grades remain metadata; teachers select suitable content. Proficiency is not a lesson filter because no approved lesson-to-proficiency mapping exists. Subject, language, publication, owner/member, archive, and pinned-version restrictions remain in their existing flows. Updating a class label does not rewrite assignments or learner work, assign research treatments, move students, or change scores.

The label is included in enrollment/registration class previews and their freshness hash. Changing a class label requires old previews to be verified again. Class creation replay compares the original proficiency, including null, and retains the original request identity on retry. Existing legacy-grade/language editing restrictions remain; proficiency is editable independently.

## Local delivery

Migration 0022_class_proficiency makes the class grade reference nullable, adds a nullable checked proficiency field, and additively replaces the old teacher-sharing grade predicate while preserving all other deployed trigger guards. Frozen migrations are unchanged. A private full database backup was made before application. Existing counts (21 users, 3 classes, 45 lessons, 1 assignment, 1 membership) and every saved class grade match the pre-migration snapshot; all three existing classes retain null proficiency.

Thirty focused backend checks passed, including schema/service/replay/authorization contracts, compiled eligibility SQL, exact trigger replacement, and offline migration SQL. Independent combined source review caught the retained database sharing gate; it was fixed and re-reviewed. Mobile typecheck still reports the existing 24 errors; lint retains the existing 3 errors/16 warnings. Hands-on app testing remains with the user. No automatic checkpoint commit/push or APK build is included.
