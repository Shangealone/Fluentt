# Instructor monitoring student filter scope

## Intent

When an instructor selects a lesson or edition in class monitoring, keep the full current eligible student roster visible and scope each student's assignment counts and history to that selection. Carry the selection into student history so the same scope is still active after navigation, refresh, or opening a direct link. Explain that all eligible students remain listed while their counts and history use the selected scope.

## Goals and non-goals

- Preserve all current eligible students, including those with no activity in the selected scope.
- Keep the existing server-side lesson and edition filtering and counts semantics.
- Preserve the selected lesson or edition in route parameters from filter selection through student history and back to the roster.
- Clear the route scope when the instructor clears filters.
- Do not change assignment filtering, search/status behavior, cohort formulas, backend authorization, monitoring data, or persistence.

## Constraints

- Reuse Expo Router and the existing monitoring route; add no dependency, migration, endpoint, or database behavior.
- Treat route parameters as client filter state and display context only. Existing authenticated APIs remain authoritative for access and filtered data.
- Preserve the existing uncommitted edits in `MonitoringBrowser.tsx` and `instructor-monitoring.tsx`.

## Approaches

1. **Route parameters (chosen):** Store the selected lesson or edition ID and its display label in the monitoring URL. Initialize the filter controls from those parameters, carry them into student-history navigation and return navigation, and remove them when filters are cleared. This survives refreshes and supports direct links, using the route mechanism already in the app.
2. **Screen state only:** Pass the selection while navigating within the mounted UI. This keeps the URL shorter, but refreshes and direct links lose the selected scope.

The user approved the full-roster behavior and chose route parameters.

## Implementation details

Use one scope ID at a time (`lesson_id` or `curriculum_version_id`) plus a display label. Selecting one scope clears the other. Initialize `MonitoringBrowser` from the route, keep route state in sync when the selection changes or is cleared, and pass the scope through both student-history entry points. Keep the full roster and update the nearby helper text to state that the selected lesson or edition scopes counts and history.

No backend changes are needed: the roster endpoint already keeps eligible students visible while calculating counts against the selected publication scope, and the student-history endpoint already accepts the same scope filters.

## Remaining builder calls

- Keep existing search, tab, and submission-filter state behavior; only lesson/edition scope is made refreshable and shareable.
- Treat the URL label as presentation text; the IDs alone determine the API scope.
- If a direct URL contains both scope IDs, clear the ambiguous scope so the UI does not turn it into an unintended intersection filter.
