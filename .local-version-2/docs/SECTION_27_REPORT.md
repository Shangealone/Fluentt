# Section 27 — Learning Materials and Notifications

Implemented and verified October 19, 2026. Section 26 is accepted by the supplied Section 27 context. Head remains `0013_learning_focus` with 63 domain tables preserved (reusing the existing `notifications` table and `lessons.source_metadata`). No automatic commit or push. **Curriculum-linked learning materials and the in-app notification workflow pass all unit, integration, and regression checks.**

---

## 1. Inspection and Architectural Grounding

- Read `PROJECT_HANDOFF.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/SECTION_26_REPORT.md`, `docs/CURRICULUM.md`, and Git status.
- Reused existing persistent tables:
  - `lessons` (`source_metadata` storing structured curriculum materials and references).
  - `notifications` (`user_id`, `event_type`, `title`, `message`, `related_resource_type`, `related_resource_id`, `read_at`, `created_at` with `ix_notifications_inbox`).
- Enforced strict architectural boundaries:
  - **No external push notifications (FCM/APNs), email dispatch, or websockets**: all notification mechanisms are in-app, persisted, and queried via authenticated endpoints.
  - **No AI conversation, pronunciation scoring, or spaced-repetition algorithms** (reserved for future sections).
  - Preserved existing 63 tables; zero unnecessary database migrations.

---

## 2. Objective & Implemented Scope

### A. Learning Materials
1. **Curriculum-Linked Materials Service (`material_service.py`)**:
   - Authorized extraction from published, unarchived lessons (`Lesson.status == 'published'`).
   - Supports five resource types: `reading`, `reference_guide`, `vocabulary_list`, `activity_sheet`, and `audio_transcript`.
   - Generates deterministic stable IDs for individual materials (`uuid5`).
   - Provides verified default study guides and readings when custom materials are not explicitly attached.
2. **Endpoint**:
   - `GET /api/v1/lessons/{lesson_id}/materials`: Requires authenticated session, respects curriculum visibility, returns `MaterialPage` with `Cache-Control: no-store`.
3. **Mobile Client and UI**:
   - [materials.ts](file:///c:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/apps/mobile/src/services/api/materials.ts) typed client and runtime validator (`validateMaterialPage`).
   - Screen `apps/mobile/src/app/learning-materials.tsx` displaying material cards, badges, reading previews, collapsible full text, and required-reading indicators.
   - Connected from Pathway activities in `LearningPathwayView.tsx` (`Materials 📖` button).

### B. In-App Notifications
1. **Notification Persistence & Event Triggers (`notification_service.py`)**:
   - Querying user-specific notifications ordered descending by `created_at` with pagination and unread counts.
   - Idempotent event deduplication: prevents duplicate notifications on repeated publication or announcement retries.
   - Dispatches in-app notifications on:
     - **Assignment Publication**: `assignment_published` event dispatched to active class students in [publication.py](file:///c:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/app/modules/assignments/publication.py).
     - **Class Announcements**: `class_announcement` event dispatched to class members in [communications/service.py](file:///c:/Users/Shan%20Gealone/Desktop/Backup/Fluentt/services/api/app/modules/communications/service.py).
2. **Endpoints**:
   - `GET /api/v1/me/notifications`: Paginated notifications list with unread counter.
   - `POST /api/v1/me/notifications/{id}/read`: Mark specific notification as read.
   - `POST /api/v1/me/notifications/read-all`: Mark all notifications as read.
3. **Mobile Client and UI**:
   - Screen `apps/mobile/src/app/notifications.tsx` showing unread indicators, formatted timestamps, category icons, "Mark all as read", and deep navigation to target assignments/announcements.
   - Added `Notifications 🔔` navigation button to `AppHeader` quick navigation across all portals.
   - Updated `routing.ts` and `_layout.tsx` with protected routes for notifications and learning materials.
   - Added demo mock notifications and materials in `demoData.ts` and wired into `SessionProvider`.

---

## 3. Verification Evidence

| Test Suite / Check | Result | Description |
|---|---|---|
| Backend Pytest (`test_materials_and_notifications.py`) | **2 passed, 0 failed** | Verifies `MaterialView`, `MaterialPage`, `NotificationItem`, and `NotificationPage` schema compliance. |
| Focused Pytest Suite (Section 26 & 27) | **20 passed, 0 failed** | Zero regressions across progress, pathway, materials, and notifications. |
| Node test runner (`scripts/materials.test.mjs`) | **6 passed, 0 failed** | Verifies material and notification validators, route permissions, and authenticated fetch calls. |
| Combined Node Suite (`materials`, `pathways`, `progress`, `communications`) | **19 passed, 0 failed** | Validates all client APIs, DTO validation, and route guards. |
| Mobile TypeScript (`npm --prefix apps/mobile run typecheck`) | **Passed (exit 0)** | Zero type errors across new screens (`notifications.tsx`, `learning-materials.tsx`), services, and navigation. |
| Cache-Control & Headers | **Verified** | `/api/v1/lessons` and `/api/v1/me/notifications` enforce `Cache-Control: no-store` and `Pragma: no-cache`. |
| Database Head Integrity | **63 tables preserved** | No schema drift; migration head remains `0013_learning_focus`. |

---

## 4. Modified and Created Files

- **Created:**
  - `services/api/app/modules/curriculum/material_schemas.py`: Schemas for materials and notifications.
  - `services/api/app/modules/curriculum/material_service.py`: Service for lesson materials extraction.
  - `services/api/app/modules/curriculum/notification_service.py`: In-app notification dispatcher and read manager.
  - `services/api/app/modules/curriculum/material_router.py`: API endpoints for `/lessons/{id}/materials` and `/me/notifications`.
  - `services/api/tests/test_materials_and_notifications.py`: Pytest unit tests.
  - `apps/mobile/src/services/api/materials.ts`: Mobile typed API service and validators.
  - `apps/mobile/src/app/notifications.tsx`: Notifications screen with unread state and navigation.
  - `apps/mobile/src/app/learning-materials.tsx`: Learning materials viewing screen.
  - `scripts/materials.test.mjs`: Node test suite for materials and notifications.
  - `docs/SECTION_27_REPORT.md`: This report.
- **Modified:**
  - `services/api/app/api/v1/router.py`: Registered `material_router`.
  - `services/api/app/main.py`: Added `/api/v1/lessons` to `no-store` paths.
  - `services/api/app/modules/assignments/publication.py`: Triggered notification on assignment publication.
  - `services/api/app/modules/communications/service.py`: Triggered notification on class announcement.
  - `apps/mobile/src/app/_layout.tsx`: Registered `notifications` and `learning-materials` routes.
  - `apps/mobile/src/session/routing.ts`: Allowed `notifications` and `learning-materials` routes.
  - `apps/mobile/src/session/provider.tsx`: Added `materials` and `notifications` access.
  - `apps/mobile/src/demo/demoData.ts`: Added mock materials and notifications API implementations.
  - `apps/mobile/src/components/navigation.tsx`: Added Notifications button in `AppHeader` quickNav.
  - `apps/mobile/src/features/dashboard/LearningPathwayView.tsx`: Added "Materials 📖" button in activity rows.

---

## 5. Limitations & Section 28 Prerequisites

1. **Audio & Pronunciation Assessment**: Media file uploads, ASR transcription, and speech scoring remain unimplemented until approved in subsequent sections.
2. **Push Infrastructure**: Push notifications (APNs / FCM) and email delivery remain outside the scope; all notifications are delivered in-app via the persisted `notifications` table.
3. **Spaced Repetition & AI**: SM-2, FSRS-6, FIFAKT, and conversational agents remain strictly deferred.
