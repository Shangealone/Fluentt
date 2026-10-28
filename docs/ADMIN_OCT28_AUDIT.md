# Administrator application audit — 2026-10-28

The authoritative request is the user's pasted administrator implementation prompt. This audit precedes its incremental implementation; earlier reports are evidence pointers, not proof of working features. Existing unrelated changes remain in the checkout. A SHA-256 baseline of tracked mobile files was saved under ignored `private-data/admin-oct28-mobile-baseline.json` before this task's edits.

## Actual architecture

- Expo SDK 58 / React Native 0.88 / Expo Router, TypeScript: `apps/mobile/src/app`; role/session policy in `apps/mobile/src/session`, live typed clients in `src/services/api`. Existing student/instructor workflows are not in scope for redesign.
- Separate Next.js 16.4.2 / React 19.3 App Router administrator: `apps/admin/src/app`, BFF routes under `api/admin`, explicit server `requireAdmin`/`backend` in `src/services/admin-server.ts`. Reviewed installed Next route-handler documentation. Existing OIDC/MFA sessions and explicit backend grants are authoritative. A pre-existing UI demo cookie is not real authorization and must be rejected by all new live-data routes.
- FastAPI/Pydantic/SQLAlchemy 2, PostgreSQL only: `services/api/app`; migrations under `services/api/alembic`. Current source head `0018_personal_history`, 71 domain tables. Never migrate or reset the application database as a side effect of administration.
- Ordinary classroom assignment/capture/results/progress are distinct from personal receipts and from coded research contexts. Existing admin content APIs use explicit permissions and transactions. Instructor ownership remains enforced by classroom APIs.

## Baseline coverage

| Administrator module | Status before this request | Source and constraint |
| --- | --- | --- |
| Dashboard | PARTIAL | `app/dashboard/page.tsx`, `components/performance-monitor.tsx`, backend `administration/performance.py`: personal client-reported activity only, not general school counts or mastery |
| Users | MISSING web oversight | `models/users.py`, `identity`, admin operator CLI; no authorized web mobile-user lifecycle contract |
| Classes | MISSING admin oversight | `classrooms`, `enrollment`, `assignments`, `monitoring` already implement owned-class mobile flows |
| Curriculum/questions | IMPLEMENTED authoring foundation | Current `/curriculum`, `/questions`, versioned backend services; explicit grants and frozen content; vocabulary/general material web authoring is not complete |
| Algorithms | MISSING admin page; PARTIAL implementations | `spaced_repetition/fsrs6.py`, `registry.py`, `fifakt.py`, `fifakt_model.py`; FSRS-6 registered, FIFAKT simulated; actual configuration rows in `models/research.py` |
| Experiment setup | PARTIAL | Existing `/research`, `research/classroom_*`, `models/research_classrooms.py`: versioned drafts, manager grants, clearance checks; preserve this page |
| Enrollment/allocation | BLOCKED live | Missing approved consent/privacy/minor materials and allocation concealment/procedure; target 30 and 15:15 are planning parameters, not participants |
| Study calendar and assessment | PARTIAL drafts / BLOCKED execution | `classroom_schemas.py` has dates, timezone, weekdays, daily windows and assessment drafts. No verified managed treatment/assessment runner or approved instruments |
| Research analytics/questionnaires/CSV | PARTIAL availability / BLOCKED actual collection/export | `research/reporting_*` and current Research page; null means unavailable, exports refuse rather than fabricate |
| Speech analytics | MISSING admin page / simulated existing evaluator | `pronunciation`, `speech/evaluator.py`; personal whole-phrase Azure adapter default-off, not new research evidence |
| Audit/settings | MISSING general admin pages | Existing `AuditLog` and environment-based configuration; safe allowlisted fields only, never credentials/messages/recordings |

## Methodological differences and readiness

The new intended design is standalone FSRS-6 versus proposed FSRS-6 + FIFAKT, one calendar month, Monday–Friday, daily local 00:00–23:59 access, 5–10 minutes, immediate posttest and seven-calendar-day retention. The managed research contract currently uses immutable `sm2_control` / `esr_experimental` identifiers and checks SM-2 configuration identity. These must not be renamed or silently converted. Store the new plan as a separately versioned **non-executable proposal**, clearly show the mismatch, and keep activation blocked until the actual FSRS research binding, trained FIFAKT, approved instruments, consent/minor permissions, exposure/missed-day/timeout rules and authorization exist. No ordinary or personal scheduler may be changed to make a draft appear executable.

Historical benchmark figures supplied by the user are external historical observations, not verified FLUENTT runtime records. No local artifact has yet been matched to those exact figures. They must stay separate from live outcome dashboards. No educational superiority, ISO validation or legal compliance claim follows from this request.

## Minimal implementation contracts

Add explicit operator-granted read modules for current school users, school class metadata, registered algorithm/configuration inventory, classroom-only speech provenance, safe audits and operational summary; no implicit default/admin promotion. Add a tightly constrained, confirmed/audited/idempotent school-user status transition, without passwords, role editing, personal-account mutation or teaching-content edits. Reuse current Research/content tools; expose genuine blocked states instead of duplicate mock execution pages. New operational CSV must have its own export permission, safe columns and audit; existing research exports keep their gates.

Likely files: new `administration/oversight.py` and tests, existing `administration/cli.py` and v1 router registration; new fixed Next BFF/contracts and oversight pages/components, existing nav/dashboard integration, existing research draft schema/form/contract for the proposed methodology only; documentation/tests. No new database entities are needed for this first compatible increment: existing users/classes/configuration/audit/protocol JSON records suffice. Exact implemented versus blocked scope and verification will be recorded in ADMIN_OCT28_REPORT.md.
