# FLUENTT architecture — Section 00

Project: **FLUENTT: An Adaptive Language Learning System with Enhanced Spaced Repetition and NLP-Driven Pronunciation Modeling**. Client: NE Learning Inc. Stage: Undergraduate Computer Science Thesis 1.

## Inspection and scope

Inspected 2026-10-16: C:\Users\shang\Desktop\Fluent was empty (including hidden entries). No manifests, source code, assets, documentation, local or ancestor AGENTS.md files were found. Git reported that this directory is not a repository. There is no implementation or working behavior to preserve. Section 00 creates documentation only; no dependencies installed, database created, models downloaded, or runtime tests claimed.

The supplied Section 00 specification is the product baseline. All capabilities below are planned, not implemented. Later section numbering is unknown except database refinement in Section 02. See DEVELOPMENT_PLAN.md for provisional dependency gates.

## System boundaries

```mermaid
flowchart LR
  M[Expo mobile: student and instructor] -->|HTTPS REST JSON / multipart audio| B[FastAPI backend]
  A[Next.js administrator website] -->|HTTPS REST JSON| B
  B --> P[(PostgreSQL)]
  B --> O[Private audio storage]
  B --> S[Scheduler adapters]
  B --> V[Speech, pronunciation and conversation adapters]
```

Only backend services access PostgreSQL and model credentials. Neither frontend embeds database credentials or vendor-specific model contracts. REST under /api/v1 is the public contract. Start with a modular backend process; introduce background workers only when speech processing duration requires them. No microservices are required.

## Proposed monorepo (future; not scaffolded)

```text
AGENTS.md
docs/
apps/
  mobile/                 # Expo, React Native, TypeScript, Expo Router
    app/                  # onboarding, student, instructor route groups
    src/features/         # profiles, classes, lessons, assessments, reviews,
                          # pronunciation, conversation, progress, messages
    src/components/
    src/services/         # API client, secure device session, audio
  admin/                  # Next.js, React, TypeScript
    src/app/
    src/features/         # users, curriculum, questions, research, operations
    src/components/
packages/
  api-client/             # generated TypeScript client from backend OpenAPI
  assessment-contracts/   # generated/shared method identifiers and payload types
services/
  api/
    app/
      main.py
      core/               # configuration, authorization, security, errors
      db/                 # engine, sessions, model registration
      modules/            # domain router/schema/service/repository/model units
      integrations/       # scheduling, tracing, speech, pronunciation, LLM
    migrations/           # Alembic
    tests/
infra/                    # later local services/deployment configuration
```

Use Python FastAPI, Pydantic, SQLAlchemy 2.x and Alembic with PostgreSQL. Select supported concrete dependency versions and lockfiles at scaffolding time. Use Expo Router consistently, not a second independent navigation system. Shared packages expose contracts, not database models or answer keys.

## Mobile architecture and access

One mobile app contains Student and Instructor portals. A root session gate validates the opaque device credential with the backend before restoring a profile. An expired/revoked credential returns to onboarding without looking up an account by username. A network failure offers retry and must not silently create a duplicate profile.

No valid session → “What will you use FLUENTT for?” → Personal Learning or School Learning.

- Personal: create globally unique username and profile → choose grade 1–12 → English or Tagalog → Student Dashboard. No class code required.
- School Student: create username and profile → enter six-digit class code → server validates and returns limited class information → explicitly confirm enrollment → Student Dashboard. Class supplies grade, subject and language context.
- School Instructor: create username and instructor profile → name first class → configure grade and language → server generates unique six-digit code → Instructor Dashboard. Additional classes follow later.

Profile/session creation is atomic. Onboarding progress is saved server-side so a valid session can resume an incomplete flow. Instructor accounts are self-created per the approved flow; classroom ownership does not grant research or administrative permissions. Personal learning language can change without rewriting historical activity. School assignments retain their class language and curriculum snapshot.

Student routes cover dashboard, lessons, school-only assignments, due vocabulary reviews, progress, scores/points, pronunciation, AI conversation, notifications and profile/settings. Instructor routes cover dashboard counts/pending work/performance, multiple classes, roster, code sharing, assignment builder, submissions/attempts/completion/progress/pronunciation summaries, feedback and messages. Route hiding is presentation only; backend authorization is mandatory.

Feature components use a shared API client and explicit loading, empty, retry and validation states. Keep server data separate from transient UI and recording state. Online submission is the initial reversible default; offline graded attempts require a later conflict/security design.

Assignment builder: class → grade → subject → curriculum version/quarter → topic → lesson → answer methods → select/create questions → points/attempts/timer/deadline → preview → publish. Validate selections against class context. Published assignment content and scoring rules are versioned snapshots.

## Assessments

Exactly ten methods: Multiple Choice, True or False, Identification, Fill in the Blank, Multiple Select, Flashcards, Error Identification, Word Arrangement, Sentence Arrangement, Matching Type. Stable identifiers and payload contracts are in API_DESIGN.md. Curriculum selection and answer-method selection remain independent.

Use a renderer registry plus shared submission envelope. Grade on the backend using versioned method-specific strategies. Objective item scoring, partial credit, accepted-answer normalization and flashcard recall grading need explicit policies before implementation; no hidden default fuzzy grader. Review flashcards use recall outcomes; scored flashcard assessments require a separate approved rubric. Pronunciation and conversation are activities, not additional answer methods.

## Administrator website

Next.js provides separately authenticated administrator routes: dashboard (users, instructors, classes, content, system activity, research overview); user/class/enrollment/permission management; versioned curriculum grades 1–12, subjects, quarters, topics, lessons and competencies; publish/archive; question bank with keys, difficulty and points; reference audio/practice phrases/conversation topics/model configuration; research enrollment, eligibility, consent/assent, codes, groups, tests and scheduler configuration; analytics and coded CSV exports; audit logs, permissions, data handling and settings.

Use server-controlled admin sessions, explicit permissions and audited mutations. Do not expose administrator selection in mobile onboarding. The website calls FastAPI for business operations; Next.js is not a second database access layer.

## Backend modules

Modules: identity, administration, classrooms, curriculum, assessments, assignments, progress, vocabulary, pronunciation, conversations, research, communications, audit. Each has Pydantic schemas, router, service and repository where needed. Transactions and authorization belong in services; routers translate HTTP, repositories perform persistence. SQLAlchemy sessions are request-scoped. Alembic is the sole schema migration path once implementation begins.

Research orchestration can invoke vocabulary and assessment services through explicit research context. Ordinary classroom services cannot mutate locked research fixtures. Integration interfaces return versioned results independent of vendors. Notifications use durable records; delivery channels remain a later decision.

## Security, privacy and research

See DECISIONS.md for session security, DATABASE_PLAN.md for identity separation and AI_INTEGRATION_PLAN.md for reproducibility. Protect enrollment previews and code validation with throttling; class codes are enumerable and never authentication or research consent. Restrict instructor reads to owned classes and relevant student activity, never all personal activity. Minimize student data, especially audio and conversation retention; durations and consent processes remain unresolved and must be approved before real collection.

Formal research is separate from classroom use: explicit approved enrollment, eligibility and required consent/assent; 30 participants, balanced 15 SM-2/15 ESR; controlled language, five learning levels, fixed assessment conditions, pre/post/delayed retention and optional separately approved pronunciation assessments. Group allocation and content lock versions are audited. Never silently substitute a scheduler for a research participant. Synthetic data only during early development.

## Quality and operations

Future checks: formatting/type checks and unit tests; API/OpenAPI contract checks; real PostgreSQL integration tests for uniqueness, transactions and access boundaries; migration upgrade tests; mobile/admin flow tests; provider contract and simulated-result labeling tests; research isolation, coded export and deterministic replay tests. Test the ten methods via meaningful grading fixtures, authorization and resubmission cases. Include device-session revocation, duplicate usernames, expired codes, deadline/timezone handling, audio failures and provider outages.

CI should run relevant checks for each change. Logs use request IDs and avoid tokens, raw audio and identifying research data. Monitor errors, provider latency/cost and failed jobs without collecting unnecessary text. Before deployment, define encrypted backups, restore verification, secrets rotation, HTTPS, restricted origins and environment-specific credentials. No operational controls have been implemented.

## Section 01 status

Foundation now lives in apps/mobile, apps/admin and services/api; see ../README.md and SECTION_01_REPORT.md for setup and validation. The proposed folder layout above is retained. Domain features described in this architecture remain planned. Only the public health API and initial frontend shells are implemented. The Section 01 prompt schedules admin authentication for Section 08.

## Section 02 database foundation

Implemented SQLAlchemy models live in services/api/app/models, grouped by domain, with shared metadata in app/db/base.py and synchronous request sessions in app/db/session.py. Alembic migrations live under services/api/migrations. The lifespan prepares an optional lazy engine and session factory without connecting, creating tables or applying migrations. Models and migration guards support the planned domains; ownership/authentication, grading, scheduling, AI and formal research services remain unimplemented. See DATABASE_SCHEMA.md for the complete implemented ERD and MIGRATIONS.md for setup and privacy boundaries.

The architecture's original schema inventory is conceptual history, not an assertion that every future service exists. Section 02 contains 58 domain tables, no populated curriculum/participant data and no frontend changes. Live PostgreSQL checks are blocked by unavailable local infrastructure; offline migration compilation and non-database tests are distinguished in SECTION_02_REPORT.md.

## Section 03 status

Implemented mobile username checking/creation and opaque device-session restoration/revocation through app/modules/identity, with shared username/security/throttling helpers in app/core. Public mobile roles are restricted; no administrator authentication or business-feature authorization is added. Existing PostgreSQL schema and migrations are unchanged. IDENTITY_AND_SESSIONS.md describes actual contracts and Section 04 integration; SECTION_03_REPORT.md distinguishes passing dependency-double tests from pending PostgreSQL verification.

## Section 04 onboarding

The mobile app now uses a root session provider and protected Expo Router screens. Startup validates the SecureStore credential before showing any profile. A network or storage error holds the startup gate with Retry; an HTTP 401 clears the invalid credential. Personal setup persists through PATCH /api/v1/users/me/preferences; restoration includes grade and language. School profiles remain at class-code/first-class boundaries until the later backend features actually complete onboarding.

The web build is a navigation preview: SecureStore is native-only, so web profile creation is blocked before POST /users. No browser-storage credential fallback is used. Android/iOS remains the intended onboarding runtime.

## Section 05 classrooms

The instructor form now creates classes through app/modules/classrooms and displays actual server-generated codes. My Classes lists owned records; details and edits enforce ownership in the backend. Authenticated session validation is shared transactionally with the class service. GET /sessions/me derives instructor completion from owned class records, preserving incomplete first-class restoration and avoiding duplicate profile creation. Student enrollment remains unimplemented.

Revision 0002_class_creation preserves 0001 and existing records, makes curriculum subject optional until explicitly configured, adds owner/request UUID deduplication and permanently unique historical invitation codes. See CLASSROOMS.md for contracts and Section 06 boundaries, MIGRATIONS.md for upgrade constraints, and SECTION_05_REPORT.md for validation limits.
