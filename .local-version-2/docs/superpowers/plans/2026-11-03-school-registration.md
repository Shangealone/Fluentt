# School-focused registration implementation plan

Goal: execute the user-approved reversible registration restriction for the school client, retaining existing personal learner access.

Approved design: hide personal signup and reject it in the API; preserve backend functionality and all stored data. Existing personal accounts retain sign-in. UI-only hiding was considered but permits direct API signup. Deleting the role was considered but makes restoration costly. Use one server configuration switch and a public account-options response.

Architecture: default-false Settings flag; guard the shared identity creation service used by browser and native routes; return public role capabilities without database access; React capability hook feeds welcome and signup. Preserve role types and all existing login/recovery logic.

Tasks:
- [x] API flag, public options endpoint, shared write guard, environment example.
- [x] Public welcome/signup options, safe default selection and old-link handling; preserve recovery.
- [x] Document restoration and retained-data policy.
- [x] Focused policy checks and mobile typecheck/lint, then restart API and check live options.

Ruling: execute inline in the current workspace after the requested checkpoint. No automatic commit/push of this new work. Hands-on app testing remains with the user; focused isolated checks exercise registration security without writing local user data.

## Delivery evidence

- Nine focused in-memory policy checks pass: both registration transports, on/off options, default-off guard before repository access, teacher signup, existing personal bearer/browser login and restoration. No local account writes from these checks.
- Mobile typecheck attempted: 24 diagnostics, matching the committed-source baseline; no new diagnostics.
- Mobile lint attempted: existing render-ref errors and warnings remain. Changed-source lint comparison finds the same two existing auth render-ref violations in both versions; the new hook has no lint findings.
- Independent source review found no important bugs.
- Local API restarted; live registration options returns only school_student and instructor; localhost:8082 returns HTTP 200.
- Existing tests that intentionally create personal accounts explicitly enable the retained feature. No broad integration suite or hands-on app testing was run.
