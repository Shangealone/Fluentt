# English grammar pilot implementation — 2026-10-29

## Delivered

- Three original English lessons, 37 items: 13 multiple choice, 9 word arrangement, 15 flashcards.
- Explanations before practice, optional lesson tips, and explicit answer checking for opted-in published pilot lessons.
- Feedback checks the authenticated learner's language, published hierarchy, latest locked revision, complete answer, and the lesson's explicit `exact-practice-v1` setting. Returns a correctness flag and message, without a key download or formal grade. Existing classroom/research scoring remains separate.
- Original authored question order retained in pilot lesson metadata. Other lesson ordering is unchanged.
- Operator importer validates all definitions before creating a complete draft hierarchy, competencies, questions and private keys in one transaction. Requires an existing active administrator with curriculum and question editor permissions. Creates no accounts, grants, sessions, publications or migrations. Stable pack identity prevents duplicate imports; a different pack fingerprint requires a new version. Existing records are never overwritten.
- A separate loopback-only educator review at http://localhost:8084 contains the same content pack. It has no user data, login, API fallback or saved activity. Its embedded review keys are never included in the mobile bundle or learner API.

## Current local state and remaining blocker

The connected development database is at migration `0018_personal_history` and has no active administrator. No pilot records were imported into it. No real accounts, lessons or classroom records were changed. Creating/provisioning an administrator and choosing its provider identity is still needed before the operator import can run. The main learner catalog on port 8082 therefore does not yet contain these lessons.

The user approved implementation and clarified that source materials guide lesson ideas rather than define the entire syllabus. This pilot uses original examples based on the supplied summaries. YouTube page retrieval failed; the browser transcript exporter also reported no transcript available for all three videos. Full transcripts and timestamps remain unverified. Transcript reuse is permitted by the user's statement; video audio is excluded.

## Operator use

From `services/api`, validate with no database connection or writes:

```powershell
.venv/Scripts/python -m app.modules.questions.pilot_import
```

After a real separate content administrator is configured with existing editor permissions, import drafts:

```powershell
.venv/Scripts/python -m app.modules.questions.pilot_import --apply --administrator CONTENT_ADMIN_USERNAME
```

Review and publish through the existing protected Curriculum and Question bank screens. The importer does not publish. Personal practice then retrieves only published content. Choose Medium or All levels to see the pilot catalog; Easy retains its built-in starter landing. All levels gives each complete lesson, while a specific difficulty filters its questions.

Run the separate review server from `services/api`:

```powershell
.venv/Scripts/python -m app.modules.questions.pilot_preview --port 8084
```

## Verification

- 28 mobile practice/history tests passed, including introduction gating, explicit checks, failed-check retry, answer retention and late-feedback rejection.
- 4 backend tests passed: pack contracts, disposable PostgreSQL draft import/retry/permissions/publication/feedback, and both existing personal-practice integration checks. The legacy role test's student setup was updated to use a valid class code and preview version, matching current signup rules.
- Mobile typecheck and lint on both changed mobile source files passed.
- Browser review: incorrect answer/retry/correct feedback, a complete sentence, flashcard reveal and return to catalog. The browser reported an actual viewport width of 442 despite requested 320/390 overrides; exact 320/390 coverage is not claimed. Screenshot: `output/pilot-lessons/review.png`.
- No physical Android, offline content download, live video audio, full transcript verification, or real database publication was performed. The server-backed lesson catalog and checking require connectivity. Existing personal history records participation, not mastery or scores.

## Files for this implementation

- `services/api/app/modules/questions/pilot_content.py` — validated original content pack.
- `services/api/app/modules/questions/pilot_import.py` — operator draft importer.
- `services/api/app/modules/questions/pilot_preview.py` — separate loopback review.
- `services/api/app/modules/questions/practice.py` — published introductions, authored ordering and opted-in feedback.
- `apps/mobile/src/services/api/practice.ts` — client contracts and check request.
- `apps/mobile/src/app/question-practice.tsx` — introduction, tip, retry-safe checks and feedback.
- `scripts/personal-practice.test.cjs` — pilot screen checks.
- `services/api/tests/test_pilot_content.py` and `tests/integration/test_pilot_content_postgresql.py` — content/import/feedback verification.
- `services/api/tests/integration/test_personal_practice_postgresql.py` — current class-code signup fixture.
- `docs/CONTENT_SOURCE_REGISTER.md`, `docs/DECISIONS.md`, and this report — scope and evidence.

Pre-existing Learn redesign and setup edits were preserved. No APK, commit or push is included.
