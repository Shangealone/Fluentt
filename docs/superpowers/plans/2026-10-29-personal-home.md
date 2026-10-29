# Personal Home and Logo B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Apply the approved illustrated personal Home and selected Open dialogue logo to the existing app.
**Architecture:** Keep the current Expo Router and session boundaries. Bundle native-compatible raster assets from the approved art and vector logo; a reusable brand component and existing PersonalScreen support a Home presentation variant.
**Tech Stack:** Expo 58, React Native 0.88, TypeScript, existing React Native Image/Pressable/StyleSheet; no new packages.
**Spec:** docs/superpowers/specs/2026-10-29-personal-home-design.md

## Global Constraints
- Use logo B, not the superseded A.
- Preserve existing route identities and audio/session/data behavior.
- Keep all art in the app bundle; no new native dependency.
- Preserve the current working checkout and user changes; no reset, cleanup, or commit of the untracked project.

## Review Focus
- 320px headers and long/larger text must reflow without horizontal clipping.
- Home must use the saved learning language and route through existing settings.
- Every activity and bottom tab must open its original protected destination.
- Shared backDisabled and notification access must remain functional.
- Assets must load natively through static require; browser verification is not APK verification.

### Task 1: Bundle the approved assets and implement Home/brand
**Files:** assets/brand/fluentt-mark.{svg,png}; assets/illustrations/home-neighborhood.jpg and activity SVG/PNG assets; src/components/FluenttLogo.tsx; src/components/PersonalScreen.tsx; src/features/dashboard/PersonalHome.tsx; src/app/student.tsx; src/theme/personal.ts.
**Interfaces:** FluenttLogo({size?:number}); PersonalScreen gains home?:boolean; PersonalHome consumes existing profile.language and router actions.
- [x] Start Expo at localhost:8082; write a browser flow check and verify the new Home/brand check fails against the old screen.
- [x] Snapshot changed source files for review because this checkout is untracked.
- [x] Generate small bundled PNG/JPEG assets and retain editable SVG sources. Implement the approved Home card/hero layout and a reusable logo B header; preserve non-Home back boundaries.
- [x] Check 320/390px layouts, assets, large text, all card destinations, language flow and logo presence.

### Task 2: Match navigation and preserve account access
**Files:** src/components/PersonalIcon.tsx; src/components/PersonalBottomNavigation.tsx; src/app/account.tsx; bundled navigation PNG/SVG assets.
**Interfaces:** Keep PersonalIconName route/icon identities; use explicit icon mappings instead of deriving them from new labels.
- [x] Rename displayed personal tabs to Home/Learn/Speak/Chat/My progress, keeping routes and accessibility selection correct.
- [x] Match white navigation/green selected state and add My account notification entry when the Home header removes its bell.
- [x] Run the full Home browser check, typecheck and lint; review changed TSX against React checklist and request a fresh scoped review.
- [x] Record actual results and changed files in the implementation report. Open the actual localhost app for the user; do not build an APK or change other pages.
