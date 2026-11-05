# FLUENTT Online Android APK
Date: 2026-11-05 (Asia/Manila). Status: APK BUILD / INSTALL / SCOPED NATIVE ONLINE ACCEPTANCE PASSED. Overall feature acceptance PARTIAL; boundaries below remain.

## App and backend
Source app: versions/fluentt-version5-combined/.local-version-2/apps/mobile.
Android build source: 3ced06659fbb07adbfa88dc70b594b7d4e5abd79 on codex/class-learning-online.
GitHub run: https://github.com/Shangealone/Fluentt/actions/runs/42043719436

The online-demo variant is FLUENTT Online, version 1.0.8/code 8, package com.shangealone.fluentt.classlearning, ARM64. Its explicit HTTPS API is https://fluentt-team-demo.onrender.com . It uses the existing upgraded Supabase team-test accounts through FastAPI, not a direct database credential in the APK.

A new package identity preserves the installed com.shangealone.fluentt.teamdemo app and its secure local data. The online variant uses scheme fluentt-online to avoid conflicting with old deep links. Users sign in again in the new app; sessions are not copied across package sandboxes.

The app configuration rejects an online-demo build unless the Android API URL is the exact verified team HTTPS origin. Default builds retain the original identity/plugins. No model, recording, database connection or provider key is bundled. New Personal Learning signup stays hidden; authorized existing personal accounts retain their role-specific screens.

## Build and resource verification
SDK 58 documentation and official Android signing/ADB documentation were read. This PC measured 15.86 GiB total / 2.72 GiB available physical RAM, so compilation was sent to the existing GitHub-hosted runner rather than forcing a local Gradle/native build. No user applications were terminated.

The Galaxy A56 was detected after the user enabled/authorized USB debugging. It reports SM_A566B, Android API 36 and arm64-v8a. Package listing is limited to the normal user 0; an initial unscoped query hit Samsung's restricted user 150, and no attempt was made to access that profile.

The workflow is at the repository root .github/workflows/android-class-learning-online.yml, with the correct nested app directory. It installs locked dependencies, checks types/config, runs Expo prebuild and Gradle assembleRelease for ARM64. The APK bundles JavaScript and is intended to run without Metro/Expo Go. It still needs internet and the hosted backend.

Build artifacts are verified against the expected source commit, inner APK checksum and GitHub artifact digest when supplied. The planned final demo signing identity is retained only in an ignored local folder for future compatible updates; no signing key is uploaded.

## Personal Learning and Class Learning are related, but not identical

| Area | Personal Learning | Class Learning |
|---|---|---|
| Learning direction | Learner selects self-directed practice | Teacher organizes the class and assigns work |
| Content | Eligible predefined/published practice content | Teacher-created lessons/questions plus eligible predefined administrator content |
| Account access | Existing personal accounts; new signup hidden | School account/class-code enrollment and current membership |
| Level | Personal starting preferences are not assessed placement | Optional client-assessed Beginner/Intermediate/Advanced label; no teacher grade selector |
| Delivery and records | Own practice/history under its existing contracts | Versioned shared lessons, assignments, submissions, teacher visibility/release and class history |
| Communication | Does not acquire class messaging by being personal | Class announcements and teacher/student messages within permitted class context |
| Speak/Chat | Shared components, own role/service limits | Shared components, own role/service limits |

Reading a lesson is not submission, mastery or research participation. Ordinary assignments do not automatically become FSRS reviews or academic grades. The model-validation and explicit result-release rules remain unchanged.

## Feature availability boundaries
- The website's scoped HTTPS teacher/student class-and-reading acceptance passed in the previous release.
- WavLM/MMS inference is not hosted on the free team service. English numerical pronunciation scoring remains unavailable there; Tagalog pronunciation ratings stay disabled.
- Groq AI Chat retains the existing explicit test-account allowlist and provider availability/rate limits. New accounts are not automatically granted AI use.
- Live FIFAKT/research treatment stays blocked. Both research flags are forced off by the hosted team launcher.
- The separate Next administrator website is not part of this Android APK.
- The free Render service can sleep; a cold start may require waiting and retrying. This is not a paid always-on service.
- No microphone access will be silently granted and no ambient voice recorded during verification.

## Automated checks already executed
- Public Expo online configuration resolved the intended package/name/version/scheme and retained plugins.
- Mobile typecheck passed.
- Mobile lint: zero errors, six existing hook-dependency warnings.
- Mobile suite: 11 passed, including endpoint misconfiguration refusal and preservation of default app identity.
- Additional broader legacy screen regression selection: 34 executed, 28 passed, 6 failed. All six failures dereferenced a missing button with the old label `Record`; the current screen uses `Start recording`. Other stale expectations include old heard-state accessibility labels and a simulated-demo score. These tests were not rewritten or reported as passing. Log: ignored `private-data/android-native-regressions.log`. The current simulation policy always returns false, and the passing unified-auth regression confirms a public environment flag cannot enable it for normal accounts.
- Physical install/launch/native-session verification will be recorded below only after it occurs.

## Changed files
- apps/mobile/app.config.js (new online variant)
- apps/mobile/tests/online-build-config.test.mjs (new regression checks)
- repository-root .github/workflows/android-class-learning-online.yml (new build workflow)
- docs/ANDROID_ONLINE_APK.md (this report)

Private download/signing scripts, build receipts, credentials, screenshots and APK output remain ignored. No new backend grants, Supabase migration, participant enrollment, model activation or paid service is part of this APK task.

## Explicit app-preservation requirement
The user explicitly requested a different APK and no deletion of their current app. ADB confirmed the existing `com.shangealone.fluentt.teamdemo`; its version/install/update baseline was saved privately before installation. The new `com.shangealone.fluentt.classlearning` does not replace it. No uninstall or app-data clearing is authorized or required.

## Actual APK and installation evidence
GitHub run 42043719436 completed successfully. Artifact ID 13425220137, official ZIP SHA-256 `ec82f80cefbb9e0f024f4e11195709a92db7288ef77c850a47644ce1d2b59998` verified against GitHub metadata. The archive's source marker and inner APK checksum matched the pinned build. Original runner APK: 32,408,520 bytes, SHA-256 `3950c887b627cae9a7e470ccf4a65e80ddb60b9c31deaf77c1e97e2d2e5f45ee`.

The final locally signed demo APK is `private-data/android-online-apk/FLUENTT-Online-1.0.8-arm64.apk`, 32,526,819 bytes (31.02 MiB), SHA-256 `2ac9200bd25c4c33cb359c7d1761684aa64349e83f0308f3eb94cca1f06584ac`. Android apksigner verification passed. The first signing attempt failed because apksigner consumed a shared password-file stream twice; corrected the private signing helper to supply the key password separately through a child-process environment, then successfully verified the signature. No password/key was printed or uploaded.

AAPT verified package/name/version/code, minimum SDK 24, target SDK 36 and ARM64-only native libraries. `assets/index.android.bundle` is present (3,265,892 bytes) and contains the intended HTTPS cloud origin. ADB install for normal user 0 returned Success. Both old `com.shangealone.fluentt.teamdemo` and new `com.shangealone.fluentt.classlearning` remain installed. The old app's version, first-install timestamp, last-update timestamp and normal-user installation state matched the saved pre-install baseline. No uninstall or data clear occurred.

### Executed physical Galaxy A56 checks
- PASS: new app opens its bundled welcome screen; Class Learning and Teach a class are present; no new Personal Learning signup button.
- PASS after retry: signed in using the previously created synthetic online student test account. The first request timed out; the retry succeeded after a server request. A free-service cold start is plausible but not proven as the root cause. An initial `/health` request returned the SPA, not health JSON; the documented API health route is `/api/v1/health`, so that SPA response was not treated as API health evidence.
- PASS: online membership/class dashboard displayed the existing synthetic class.
- PASS: class lessons fetched the teacher's synthetic shared reading, and opening it displayed the correct hosted content/version.
- PASS: force-stopped only the new app, relaunched it, and the secure student session restored with its online class. No development-server connection or app-data clearing was needed.
- PASS: explicit sign-out confirmation returned to welcome. The new app is left ready for the user's own sign-in, not inside the synthetic account.
- OBSERVATION: one post-restart dumpsys snapshot reported total PSS 170,397 KiB (166.4 MiB), RSS 265,440 KiB (259.2 MiB). This is a point measurement, not peak memory or speech-model memory.
- NOT TESTED in this native acceptance: original users' passwords, teacher native editing, all assignment methods/submission/release, messaging, progress, personal-role screens, actual microphone recordings, reference playback and live Groq responses. Prior browser/API checks are separate evidence, not native coverage.
- UNAVAILABLE by deployment configuration: WavLM/MMS inference, Tagalog pronunciation scoring, live FIFAKT/research treatment. No scores were invented and no large models loaded.

Private evidence: `artifact-verification.json`, `signed-apk.json`, `signature-verification.txt`, `existing-app-before.json`, `native-memory.txt`, and screenshots `native-welcome.png`, `native-class-lessons.png`, `native-shared-reading.png`, `native-session-restored.png`, `native-ready-for-user.png` under the ignored APK directory. One screenshot named native-student-dashboard captured the initial timeout and is failure evidence, not a successful dashboard.

### Installation / repeat updates
The APK is already installed. For another compatible ARM64 Android phone, copy only the final APK and open it, approving Android's install-from-that-source prompt if necessary. Internet is required for hosted features. The current app can coexist. Future updates to this new package must use the retained private signing identity and an appropriate version code; do not distribute its signing folder, database credentials or private QA files. The final locally signed APK differs from the runner-signed artifact available in GitHub Actions; use the local final APK for consistent updates to this installed build.
