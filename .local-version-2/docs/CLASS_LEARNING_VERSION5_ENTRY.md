# Version-5 Class Learning entry integration

2026-11-05. Local source implementation; not an online deployment or APK release.

## Source verification

Fetched https://github.com/BlackKaiser1121/FLUENTT/tree/version-5 at d49a23919e05290b0eb3cf7b81c888970f1f3cdc. Current checkout is versions/fluentt-version5-combined/.local-version-2, branch version-8, based on saved 81f3f54.

The following current files already match version 5 exactly (git diff origin/version-5 returns no differences for this list):
- apps/mobile/src/app/student.tsx
- apps/mobile/src/app/my-classes.tsx
- apps/mobile/src/app/class-lessons.tsx
- apps/mobile/src/app/published-assignments.tsx
- apps/mobile/src/features/dashboard/ClassroomHome.tsx
- apps/mobile/src/features/dashboard/SchoolHomeClasses.tsx
- apps/mobile/src/features/dashboard/SchoolHomeLearning.tsx
- apps/mobile/src/components/ClassroomBottomNavigation.tsx

They were merged in the earlier version-5 combination. No second copy or wholesale branch replacement is necessary. Existing deployed services and APK do not automatically follow the current checkout.

## Implemented presentation

Welcome now explicitly labels its primary school button Class Learning. It opens the existing version-5 school signup flow, which requires a teacher's class code; existing learners use Sign in. No anonymous classroom-dashboard shortcut or role conversion.

The welcome route never supplies a Personal Learning button. The existing registration-options hook keeps personal signup hidden throughout loading, failure and successful policy responses, even if an older server advertises personal registration. This also prevents the shared signup page from advertising a personal pathway. Teacher signup and normal account sign-in remain.

After authenticated school sign-in, the unchanged role-aware student route renders the version-5 SchoolHomeScreen/ClassroomHome: joined classes, class lessons, assignments, class messages, progress, Speak and Chat. Instructor ownership, class-code checks and protected routes remain unchanged. Existing personal accounts retain their own authorized dashboard/history; they are not silently relabeled school accounts.

No backend flag/configuration, database, speech/Tutor code, FSRS/FIFAKT calculation or research gate was changed. Live experimental activities remain blocked.

## Files changed in this task

- apps/mobile/src/app/index.tsx
- apps/mobile/src/features/welcome/WelcomeScreen.tsx
- apps/mobile/src/features/auth/useRegistrationOptions.ts
- apps/mobile/tests/class-learning-entry.test.mjs (new)
- docs/PERSONAL_LEARNER_REGISTRATION.md
- docs/DECISIONS.md
- docs/CLASS_LEARNING_VERSION5_ENTRY.md (this report)

## Verification

| Check | Actual result |
|---|---|
| npm run typecheck, apps/mobile | PASS |
| npm run lint, apps/mobile | 0 errors / 6 existing warnings |
| node --test tests/*.test.mjs, apps/mobile | 9 passed (including no-grade teacher-form regression) |
| pytest tests/test_registration_policy.py tests/test_version5_combination.py -q --tb=short | 14 passed / 3 dependency deprecation warnings |
| git diff --check | PASS |
| Browser welcome/teacher-signup navigation | PASS observed in the new local preview; Android/full class UI walkthrough not run |
| APK build / online deployment | NOT PERFORMED |

New tests execute the welcome element tree/callback wiring, school-only signup behavior under an older permissive or unavailable API, and actual role-aware dashboard/route selection. They use mocked UI/session dependencies; they do not establish native rendering or real authentication acceptance. Existing backend checks exercise cookie/native signup policy, class-code-first refusal, legacy personal sign-in/restoration and merged-app safeguards using isolated fixtures. No real account/database was changed.

Expo package major 58 was inspected; official routing reference read before changes: https://docs.expo.dev/versions/v58.0.0/sdk/router/ . No new dependency or routing API added.

Remaining: complete local/device acceptance, then separately rebuild the APK and redeploy the intended online service to expose these changes there. No commit, push or online deployment occurred for this follow-up edit.

## Correct running preview — follow-up diagnosis

The user correctly identified a grade-selector mismatch. Read-only inspection confirmed the running API launchers used fluentt-groupmate/.local-version-2, whose CreateClassView still has grade_level and grades choices, and whose welcome route unconditionally advertises Personal Learning. Its configured Supabase database is at 0018_personal_history. No Supabase migration or write was performed during this diagnosis. Changing combined source alone did not update that old application.

The correct combined preview now runs at http://127.0.0.1:8084/ with API http://127.0.0.1:8004/ . Both returned HTTP 200. These are different ports from the old app, which remains untouched. Using 127.0.0.1 also separates its browser cookie host from the old localhost preview.

A newly generated local loopback fluentt_classdemo_<UUID> database was initialized through 0027 using the explicit fresh-empty bootstrap adapter; it is not Supabase and cannot satisfy the test-only research namespace guard. The committed version-5 content bundle imported 45 lessons and 371 questions. No accounts were copied from Supabase. Only one generated synthetic teacher and local class were created for verification. Both research flags and new personal signup remain disabled. Speech settings/resources are reused from ignored local configuration without loading models; no inference or external AI call was performed.

Actual HTTP browser-transport checks on this isolated database: instructor signup 201, class creation with proficiency_level=beginner and no grade_level in the request 201, stored grade NULL, authenticated session restoration 200. The in-app browser visibly shows Class Learning, Teach a class and Sign in; teacher signup shows username/password/confirmation and no grade field. A separate component regression exercises Beginner/Intermediate/Advanced choices and verifies no grade selector or grade payload. This does not claim a full physical-device acceptance pass.

Ignored local operational files: services/api/.env, apps/mobile/.env, private-data/prepare-class-preview.py, run-class-preview-api.py, class-preview.json, class-preview-processes.json, class-preview-verification.json, synthetic-login JSON and process logs. No secret values are in this report or source. Environment files and private-data were verified ignored. The new web process was restarted once with Node --dns-result-order=ipv4first to bind the intended loopback preview address; the old application was not stopped.

Use Teach a class or Sign in on this preview. Existing Supabase accounts are intentionally absent; create a local test teacher for acceptance. Moving existing accounts to this code requires a separately reviewed Supabase migration/release plan, not another welcome-label change.
