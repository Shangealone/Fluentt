# Welcome Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved revised welcome design in the real app.
**Architecture:** A presentational WelcomeScreen receives existing route/sample callbacks from src/app/index.tsx. Reuse FluenttLogo, PersonalIcon, homeColors, native Image/Modal/SafeAreaView; bundle the welcome artwork and school illustration.
**Tech Stack:** Expo 58, React Native 0.88, TypeScript; no new packages.
**Spec:** docs/superpowers/specs/2026-10-29-welcome-design.md

## Global Constraints
- Remove English & Tagalog from welcome; use filled Home-style icons.
- Keep the existing personal/classroom/sign-in/sample destinations and session behavior.
- Preserve the current untracked checkout; no Git reset, commit or cleanup.

## Review Focus
- Narrow phones and enlarged text: entry cards must wrap and remain reachable.
- Short screens: the sample chooser must scroll and retain a usable close action.
- A selected sample must close the chooser and switch to the correct existing role/destination.
- Native Back and web Escape must close the chooser without routing away.
- Hide Demo Hub only on welcome; retain it on its existing non-personal destinations.

### Task 1: Welcome view and assets
**Files:** src/features/welcome/WelcomeScreen.tsx; src/app/index.tsx; assets/illustrations/welcome-neighborhood.jpg; activity-class.svg/png.
- [x] Capture the old welcome baseline and snapshot changed source files.
- [x] Bundle approved assets and implement the exact welcome copy, layout and sample chooser using existing callbacks.
- [x] Verify personal/classroom/sign-in navigation, all sample roles, modal close/Escape and responsive asset/layout behavior.

### Task 2: Integration and final verification
**Files:** src/components/DemoNavigator.tsx; docs/DECISIONS.md; docs/WELCOME_DESIGN.md.
- [x] Suppress duplicate Demo Hub on the welcome route only; retain all other guards.
- [x] Run browser regression, typecheck and lint; review React structure and request one scoped fresh review using the user's required GPT-6 Luna with extra high reasoning.
- [x] Resolve important findings, document actual results/changed files and open the real localhost welcome page.
