# Development plan

Section 00 was architecture only. Sections 01–02 now provide runnable application shells and database model/migration source. See SECTION_01_REPORT.md and SECTION_02_REPORT.md for actual implementation and validation; live PostgreSQL tests remain pending infrastructure.

## Dependency gates

The following is a **provisional allocation**, not the unavailable official prompts for Sections 01–39. Each incoming prompt supersedes these suggested slots subject to the approved requirements. Section 02 must refine the database plan. Do not implement a future slot without its prompt.

| Suggested section(s) | Work package | Prerequisites |
|---|---|---|
| 01 | Workspace scaffolding, runtime versions, configuration examples, CI foundation | Actual Section 01 prompt, architecture baseline |
| 02 | Database normalization, SQLAlchemy entities and Alembic | Scaffolding; resolve entity constraints |
| 03–05 | API conventions, profile/device sessions, permissions and admin authentication | Schema, secret/config policy, admin provider choice |
| 06–08 | Mobile onboarding, classes, preview/confirmed enrollment | Identity and class authorization |
| 09–11 | Curriculum/versioning, content administration and question bank | Curriculum schema and source labeling |
| 12–16 | Ten assessment renderers, grading, assignments and monitoring | Question contracts, rubrics, published snapshots |
| 17–19 | Progress, points, notifications, messages and feedback | Graded/event transactions and access policies |
| 20–22 | Vocabulary event store, scheduler adapters and SM-2 baseline | Review contracts, reproducibility fixtures |
| 23–25 | FSRS-6 evaluation, FIFAKT feasibility and proposed ESR | Versioned adapters, approved design and compatibility evidence |
| 26–28 | Audio uploads, ASR, independent pronunciation | Consent/retention, provider validity, storage/jobs |
| 29–30 | Conversation topics, provider integration and feedback | Privacy approval, age-appropriate evaluation |
| 31–34 | Research enrollment, locks, allocation, five levels and assessments | Ethics protocol, consent, schedulers and controlled content |
| 35–36 | Research analytics, coded exports and replay | Complete immutable study event data |
| 37–39 | End-to-end evaluation, accessibility, security, deployment and handover | Relevant features validated; outstanding risks resolved |

## Implementation discipline

Inspect files and Git status before each section; preserve working behavior and consult AGENTS.md. Identify requirements, dependencies, decisions and acceptance checks before coding. Implement only the current prompt. Every feature report distinguishes implemented behavior, simulated output and pending dependencies. Record changes to baseline decisions explicitly.

Build vertical slices with backend authorization and contracts before connecting screens. Use synthetic fixtures, never fabricated research findings. No model training/downloads belong to Section 00. Runtime scaffolding, migrations and dependency installs are deliberately deferred.

## Testing strategy

- Contracts: OpenAPI validation and generated client checks; pagination/error semantics and all ten answer payloads.
- Domain: rubric fixtures, scheduler state transitions, immutable published versions, controlled research progression.
- Integration: PostgreSQL uniqueness races, membership boundaries, session expiration/revocation, atomic submission/review events, migration upgrades.
- UI: personal/student/instructor onboarding, session restore, assignment preview/publish/submit, retry/permission states and admin route protection.
- AI: provider adapters, version capture, simulated labeling, unsupported-language and timeout behavior; pronunciation evaluation separate from ASR transcription quality.
- Research: enrollment/consent gates, 15/15 allocation cap, locked language/content, five-level sequence, pre/post/delayed tests, coded export allowlist and reproducible scheduler replay.
- Release: accessibility, upload limits, secret/log scanning, backup restore, least privilege and representative device performance.

## Section 00 verification

Documentation checks cover file presence, local links, exactly ten method identifiers, required stack and portals, no later-section source implementation, research isolation and unresolved decisions. These are documentation checks only, not application tests. Actual result is recorded in the completion response.

## Accepted Section 01 scope

Section 01 implements mobile/admin shells, API health, configuration, reusable UI and development checks only. Its explicit scheduling of administrator authentication for Section 08 supersedes the provisional row above. Section 02 remains the database gate. Consult SECTION_01_REPORT.md for actual validation; the Section 00 verification above is historical.

## Accepted Section 02 scope

Database models, synchronous session management and Alembic foundation are implemented. The Section 02 prompt explicitly places research enrollment/randomization/execution in Sections 36–38; that supersedes provisional research slots. PostgreSQL live integration checks are pending local infrastructure; see SECTION_02_REPORT.md. Section 03 can build profile/session APIs on the database foundation after applying and validating the initial migration.


## Accepted Section 03 scope

The backend identity module now supports username availability, atomic new-mobile-user creation, Bearer session restoration and revocation, with validation, role restrictions and throttling. Existing schema/migrations are reused. No frontend onboarding, class code/enrollment APIs or admin authentication were implemented. Section 04 can integrate the documented contracts after PostgreSQL migration/live checks are completed; see IDENTITY_AND_SESSIONS.md and SECTION_03_REPORT.md.
