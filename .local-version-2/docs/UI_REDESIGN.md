# UI refresh — 2026-10-19

The user requested clearer navigation, an easier-to-understand layout, and improved graphic design. This refresh covers the mobile welcome page, student/instructor home screens, class cards, assignment summary, shared mobile controls/header, admin landing/dashboard, and shared admin styling.

## Design decisions

- Consistent blue, slate, white, and restrained amber accents; calmer badges and borders.
- Code-native language-card artwork on the welcome page; compact dashboard banners keep actual tasks closer to the top on phones.
- Student/instructor home navigation uses existing routes. Forms and attempts do not opt into the new shortcut row.
- Main actions use plain labels: View assignments, Class messages, Open class, Curriculum, Question bank.
- Responsive cards and wrapping action rows; 44-pixel minimum small buttons and keyboard focus outlines.
- Personal preferences are described as profile settings. No fabricated activity counts, mastery claims, instructor names, compliance claims, or administrator operational totals.
- Existing authenticated services, focus cleanup, request generation checks, submission/result semantics, demo implementations, and protected routes are retained.

## Files changed by this refresh

- apps/mobile/src/theme/tokens.ts
- apps/mobile/src/components/ui.tsx
- apps/mobile/src/components/navigation.tsx
- apps/mobile/src/components/LearningBanner.tsx (new decorative artwork)
- apps/mobile/src/app/_layout.tsx
- apps/mobile/src/app/index.tsx
- apps/mobile/src/app/student.tsx
- apps/mobile/src/app/instructor.tsx
- apps/mobile/src/features/enrollment/MyClasses.tsx
- apps/mobile/src/features/progress/ProgressSummary.tsx
- apps/admin/src/styles/tokens.css
- apps/admin/src/app/globals.css
- apps/admin/src/app/page.tsx
- apps/admin/src/app/dashboard/page.tsx
- scripts/dashboard-components.test.cjs
- docs/DECISIONS.md
- docs/UI_REDESIGN.md
- output/ui-redesign/student-phone.jpg
- output/ui-redesign/admin-home.jpg

The checkout already contained extensive modified/untracked implementation files before this task. They were retained; the list above identifies this task’s edits rather than all Git changes.

## Verification

- Mobile TypeScript check: passed. Mobile lint: zero errors, 19 warnings in existing demo/session/capture code.
- Admin TypeScript check: passed. Admin lint: zero errors, one existing unused-type warning in admin-demo.ts.
- Dashboard component, navigation/session, and progress checks: 28 passed, zero failures.
- Browser: current mobile preview rendered and student sample navigation worked. Checked at 390-pixel width with document width equal to scroll width (no horizontal document overflow). Revised the dashboard banner after visual inspection to reduce scrolling before class actions.
- Browser: current admin landing rendered with the revised desktop composition. Screenshots saved under output/ui-redesign.
- Native Android/iOS execution and full screen-reader behavior were not tested. No production deployment or backend/database validation is claimed for this presentation-only change.
- Existing admin HTTP/BFF integration suite: 12 passed, zero failures, including permissions, cookie forwarding, Origin/CSRF enforcement, logout/revocation, and fail-closed outage handling.
- Browser: admin sample sign-in reached the redesigned dashboard; desktop screenshot saved as output/ui-redesign/admin-dashboard.jpg. Also visually checked the dashboard at 390-pixel width without horizontal overflow. This additional screenshot is a generated artifact from this refresh.
