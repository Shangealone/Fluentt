# Instructor monitoring student filter scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep lesson or edition scope visible in the route and apply it to the selected student's counts and history while retaining the full roster.

**Architecture:** The existing Expo Router URL carries `lesson_id` or `curriculum_version_id` and a display-only label. The instructor route passes that scope into `MonitoringBrowser`; changing or clearing the scope updates route parameters, and student-history navigation carries the same scope. Existing monitoring APIs continue to enforce access and calculate counts.

**Tech Stack:** Expo Router, React Native, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-30-monitoring-student-filter-scope-design.md`

## Global Constraints

- Keep every current eligible student visible, including students with no activity in the selected scope.
- Treat route parameters as client filter state and display context only; existing authenticated APIs remain authoritative for access and filtered data.
- Add no dependency, migration, endpoint, database behavior, or backend authorization change.
- Preserve existing uncommitted edits in the mobile monitoring files.
- Do not add or run tests; the user will test after implementation.

## Review Focus

- A direct link with a lesson ID and `scopeLabel` restores that lesson scope and display label.
- A direct link with an edition ID and `scopeLabel` restores that edition scope and display label.
- Selecting a lesson after an edition (or an edition after a lesson) leaves only the newest scope active.
- Clearing filters removes both scope IDs and the label from the URL and clears the visible scope.
- Opening a student's history from either the roster or assignment detail preserves the scope; every eligible student remains listed.
- A URL containing both scope IDs is treated as invalid scope and cleared, so the UI never creates an unintended intersection filter.

---

### Task 1: Preserve monitoring scope in route parameters

**Files:**
- Modify: `apps/mobile/src/app/instructor-monitoring.tsx`
- Modify: `apps/mobile/src/features/monitoring/MonitoringBrowser.tsx`
- Modify: `docs/DECISIONS.md` (append the approved behavior)

**Interfaces:**
- The route reads optional `lesson_id`, `curriculum_version_id`, and `scopeLabel` string parameters.
- `MonitoringBrowser` receives the parsed `scope` and `scopeLabel`; these values determine its selected filter display and API query parameters.
- Student history navigation carries `classId`, `studentId`, the active scope ID, and `scopeLabel`.

- [x] **Step 1: Parse and pass scope route parameters**

  Normalize each route parameter to a single string or `undefined`. Pass only one selected scope ID in `scope`; keep `scopeLabel` as display context. If both scope IDs are supplied, clear both IDs and the label from the route.

- [x] **Step 2: Keep scope and URL synchronized**

  Derive the active scope from route props instead of duplicating it in local state. When a lesson or edition is selected, use `router.setParams()` to set its ID and label and clear the other ID. When filters are cleared, remove both IDs and the label. Keep search, tab, and submission-filter state behavior unchanged.

- [x] **Step 3: Preserve scope through student history navigation**

  Pass the active scope and display label from both `StudentCard` and `OutcomeCard` into the student-history route. Preserve the same scope in the detail page's return-to-monitoring route.

- [x] **Step 4: Clarify the Students filter behavior**

  With an active scope, say: “All eligible students remain listed. Counts and history reflect [scope label].” With no scope, say: “All eligible students remain listed. Choose a lesson or edition to scope counts and history.”

- [x] **Step 5: Record the approved behavior**

  Append a dated Section 24 monitoring filter-scope decision to `docs/DECISIONS.md`, preserving its existing content and current working changes.

**User testing after implementation:** Confirm the five cases in Review Focus in the local monitoring page. No automated tests will be added or run in this task.
