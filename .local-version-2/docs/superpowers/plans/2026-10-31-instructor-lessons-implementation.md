# Instructor lessons implementation plan

Approved feature and Canvas: `../specs/2026-10-31-instructor-lessons-design.md`.

Execute inline in the running local workspace. User authorization covers this feature's additive application/schema work. Do not reset existing data, edit frozen migrations, push automatically, or run app tests/automated checks under the user's standing preference.

## Architecture decision

Use dedicated teacher lesson roots, version metadata and class shares. Each teacher version has a typed `lessons` leaf with a NULL curriculum topic and an explicit teacher-source marker. This preserves existing question, assignment, attempt, and evaluation foreign keys. A new constraint distinguishes the two lesson sources; official rows and historical IDs are untouched. Dedicated ownership checks and a source adapter replace official-only assumptions without inventing curriculum editions.

## Tasks

- [x] 1. Add migration 0019, teacher models, validated text/question inputs, immutability/replay/share history guards.
- [x] 2. Add owner-scoped authoring/publishing/revision APIs and live-class sharing/student-reading APIs, with transactional audit and exact request replay.
- [x] 3. Adapt assignment source catalogs, eligibility/context, subject binding, materials, progress/monitoring projections and official-only private/public boundaries.
- [x] 4. Add typed authenticated mobile access, protected routes, matching library/editor/question/sharing/reading UI, and class/home links. Preserve safe retries, focus cleanup and unsaved navigation.
- [x] 5. Inspect changes with a fresh source-only review, resolve significant findings, update docs/tracker, and enable the additive local migration after inspecting the database and preserving a backup.

## Contracts and limits

- Title 1–200; introduction 0–8,000; 0–50 sections, each heading 1–200 and body 1–20,000 Unicode code points; complete lesson request at most 1 MiB.
- Grade 1–12, English/Tagalog, explicit existing subject definition; 0–200 questions using the unchanged V1 definition validators and private answer-key semantics.
- Separate publish and share. Matching grade/language/explicit subject; unbound subjects bind only after retained-history checks and confirmation. Archive blocks new selection; existing shares/assignments retain immutable versions. Replacing/removing a class share retains an append-only event.
- UUID/body replay identity for mutations; If-Match for existing lesson/share edits. Never persist request payloads/keys on the client; retain interrupted request snapshots in memory.
- Public student reads contain text sections/context only. All private question definitions stay owner-only; assigned question content uses the existing capture boundary.

## Ledger

- Initial: spec and Canvas approved. Implementation not yet complete.
- Ruling: use a discriminated shared lesson leaf rather than changing all existing foreign keys — preserves pinned evidence and reduces migration risk; every generic lesson reader must filter or authorize the teacher source.
- Ruling: standing no-testing preference applies; source inspection/review is not functional verification and must be reported separately.
- 2026-11-01: application source implemented. Fresh source review identified account push bypassing unsaved removal protection; fixed with explicit account-exit confirmation and browser reload protection. No further important source findings reported; no runtime verification claimed.
- 2026-11-01: existing local database at 0018 inspected; ignored private backup saved; 0019 applied transactionally. Retained row counts unchanged (21 users, 3 classes, 3 lessons, 37 questions, 1 assignment version, 0 attempts). App/API listeners already active on 8082/8001. Feature documentation and tracker updated. No tests, typecheck, lint, APK build, commit or push.
