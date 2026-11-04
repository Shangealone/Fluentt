# Externally assessed student proficiency

Fluentt records the client's assessment outcomes. It does not administer the placement assessment, infer ability from practice, or move students between classes automatically.

## Teacher and student access

In Class overview, open Students, View history, then Record assessment outcome. The owning teacher of an active class can record an outcome for an eligible, active school student enrolled in that class. Access is rechecked on every request.

Beginner, Intermediate, and Advanced require the actual assessment date (YYYY-MM-DD, no future dates in Philippine time). Not assessed yet has no assessment date. The current record is shared across that student's classes in the same language; English and Tagalog remain separate. A class's configured proficiency level is unchanged.

School students can read their own record and history under Account. They cannot edit it. Teachers cannot use this feature to inspect students outside their eligible classes. Source class identifiers are not disclosed to other teachers or students.

## History and safe updates

Each save appends an immutable entry containing the level, assessment date, server recording time, and recording teacher's username snapshot. The newest recorded entry is current, even when it records an older assessment date. Selecting Not assessed yet appends an entry without deleting earlier outcomes. History is paginated in newest-recorded order.

Writes require the previously viewed event identity and an idempotency key. Concurrent changes return a reload conflict. Interrupted retries retain their original request identity and details; replaying an older successful request returns the latest record rather than restoring the older level. A transaction-level student/language lock keeps current records and history consistent.

The editor retains unsaved details in memory, prevents conflicting actions while saving, and warns before leaving or reloading unsaved or uncertain work. No proficiency data is stored in the shared lesson-library bundle.

## Database and verification

Migration `0025_assessed_proficiency` adds `student_proficiency_events` and a database trigger preventing updates or deletions. It does not alter existing class, lesson, assignment, or result data. Downgrade refuses to remove occupied history.

From `services/api`, apply migrations with `.venv/Scripts/python.exe -m alembic upgrade head`. Startup checks the migration head but does not silently migrate an existing database.

Focused PostgreSQL integration coverage lives in `services/api/tests/integration/test_assessed_proficiency_postgresql.py`. It uses a disposable database, not developer student records. Full end-to-end and native testing remain separate.
