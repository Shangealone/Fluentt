# D10 — Foundation regression and device verification

## Decision and scope

**Recommendation: BLOCKED for the complete D10 gate.** Automated regression, a real PostgreSQL migration/seed, live FastAPI HTTP health checks and Android-target bundle compilation passed. Physical Android verification was not performed: the researcher confirmed that no phone is available. No emulator run was performed. Automated lifecycle simulations and Node SQLite file tests are explicitly not native-device evidence.

Audit date: **2026-10-07 UTC**. Starting branch was clean `main` at `7f3a9cb` (`feat(research): harden research logging and integrity`). This report covers that commit plus the uncommitted D10 startup-auth correction described below. No commit, experimental scheduler, assignment, ESR/SRS/FSRS, pronunciation or NLP work is included. D1 and all finalized D3–D9 notes were read; their historical deferred statements are interpreted in milestone order.

Execution sequence: audit environment and authority; run the specified full suites; check Android module/build feasibility; prepare isolated sample content; reproduce any actual defect before correcting it; rerun affected/full mobile checks and bundle compilation; document every unavailable native scenario. Formal study readiness is not declared.

## Development/debug note — 2026-10-15 (Asia/Manila)

**ANDROID EMULATOR / EXPO GO — READY FOR MANUAL D10 A01 preparation only.** This follow-up used `F:\FLUENTT`, clean `main` at `a52480b` (`fix(auth): harden startup session restoration`), Pixel_9 / `emulator-5554`, API 36 x86_64, Expo Go 57.0.9, Expo SDK 57.0.24 / CLI 57.0.26, Node 22.18.0 and pnpm 11.9.0. The earlier audit below remains historical; no case status is promoted to PASS by this note.

Two environment defects blocked launch:

1. The existing `expo start --go --localhost --clear` process listened only on `::1:8081`. Node resolved `localhost` to IPv6 first, while the installed Expo CLI constructed `exp://127.0.0.1:8081`. Host IPv4 requests were refused even though IPv6 `/status` returned 200 and the emulator's `tcp:8081` reverse rule existed. Expo Go reproduced the blue screen and reported `java.io.IOException: Failed to download remote update` / `UpdateFailedToLoad`. Starting Metro with `--dns-result-order=ipv4first` produced a `127.0.0.1:8081` listener and HTTP 200 `/status` from both host and emulator.
2. Once transport worked, the Android manifest request returned HTTP 500, `UnexpectedServerError: unable to verify the first certificate`, also printed by Metro. An independent Node HTTPS request to the Expo API reproduced `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; the same request with `--use-system-ca` returned HTTP 200. Adding that flag let manifest generation succeed with SDK `57.0.0`, runtime `exposdk:57.0.0` and the correct IPv4 bundle URL. Certificate verification remained enabled.

The working command, from `F:\FLUENTT\mobile`, is:

```powershell
node --dns-result-order=ipv4first --use-system-ca .\node_modules\expo\bin\cli start --go --localhost --port 8081
```

Only the identified Metro process was replaced. Expo Go was force-stopped/reopened without clearing its data, using explicit emulator targeting:

```powershell
& F:\SDK\platform-tools\adb.exe -s emulator-5554 reverse tcp:8081 tcp:8081
& F:\SDK\platform-tools\adb.exe -s emulator-5554 shell am start -W -a android.intent.action.VIEW -d exp://127.0.0.1:8081 -p host.exp.exponent
```

The existing reverse rule was retained; the first command above is the setup command if it needs restoring. Metro compiled 1,514 Android modules in 23,238 ms. FLUENTT reached the empty login UI, and Reload from the emulator's Expo developer menu returned to the same login UI (75 ms incremental bundle), with no blue/red error screen or fatal JavaScript error. Two require-cycle warnings remain in the existing offline queue/sync modules; no refactor was performed. Offline SDK dependency validation passed against the installed snapshot; online startup advertised newer patch packages, which were not installed. `pnpm exec tsc --noEmit` and `pnpm lint` exited 0; lint retained the two existing i18n warnings. No application source changed, so the full Jest suite was not rerun.

The unchanged backend listens on `0.0.0.0:8000`. An HTTP request from inside Pixel_9 to `http://10.0.2.2:8000/health/db` returned 200 / `{"status":"ok"}`. Mapping the running backend's PostgreSQL client socket to `pg_stat_activity` confirmed **`fluentt_d10_device`**. Read-only queries made through an explicitly D10-targeted connection confirmed Alembic `d9c0de000001` and existing participant codes `D10_A` / `D10_B`; no email/password/token fields were selected. The normal database was not used for these checks. Scheduler constants remain `development` / `dev-0.1`, correct 86,400 seconds and incorrect 600 seconds.

Only this report changed. No source/config/dependency/native-folder changes, credential entry, A01 execution, account reset, research-history mutation, commit or push occurred. Backend and Metro were left running with the login UI ready for the human operator. A01 still requires manual login, mandatory temporary-password change, language selection and opening a published sample lesson. This emulator/Expo Go observation establishes neither physical Android case success nor app-owned native persistence; the overall D10 gate remains BLOCKED, and Plan E/F was not started.

## D10-A02 timing defect — 2026-10-15 (Asia/Manila)

**ANDROID EMULATOR / EXPO GO — READY FOR D10-A02 RERUN; A02 remains BLOCKED pending a fresh manual rerun.** The operator reported three D10_A answers in Essential Daily Greetings / `sample-en-v0.1`: hello (Correct), welcome (Incorrect), gratitude (Correct). Each persisted `response_time_ms=12052` and `client_interaction_at=2026-10-15 11:20:55.617+08`, despite distinct server acceptance times. All three had version-1 `native_performance_now` / `prompt_layout_frame` evidence with zero observed interruptions. The operator verified one acceptance ledger, schedule, current pointer and each canonical research event per answer, with the expected `development/dev-0.1` intervals. These are operator-supplied emulator observations; the accepted rows were not queried, rewritten, deleted or repaired during this correction.

**Root cause:** `ReviewScreen` already changes its context/index/item presentation key, clears its unsaved payload after successful persistence, resets Reveal and remounts the prompt ScrollView. `useReviewTiming`, however, constructed its mutable `createPresentationTimer(clock)` inside a keyed `useMemo`. With React Compiler enabled in the actual Expo build, the installed Babel transform caches that factory result by **clock alone**, then wraps the same timer in each new keyed presentation. After item A commits, its timer's immutable captured duration, interaction timestamp and interruption evidence are returned again for B/C. `captureReviewAttempt` and the wire sanitizer correctly preserve those supplied facts, so unique new answer UUIDs/items can carry the reused timing snapshot. Clock source selection, metadata generation, transport and backend acceptance are not the reset defect.

**Correction:** the hook now memoizes only pure presentation identity (key and clock). Its layout effect creates the mutable timer in `presentationRef` for each new presentation, retaining it only for effect resubscription to the same presentation. Layout/frame/focus/active guards remain; ordinary rerenders, repeated layout, Reveal, resume and same-item retries do not restart a measurement. Commitment still freezes synchronously before authentication/transport/storage, includes interruption time and cannot mutate an earlier capture. No timer/schema/scheduler/backend or review-screen redesign was made.

**Regression evidence:** jest-expo's default caller omits React Compiler, explaining why the prior two-item test passed. `mobile/jest.config.js` now applies the installed Android/Hermes/compiler transform specifically to `useReviewTiming.ts`. Before the fix, both the existing two-item test and a new online A/B/C screen test failed: B received A's 400 ms duration instead of 1,200 ms, A's timestamp and A's `app_blur` evidence. After the fix, A/B/C produce 400 / 1,200 / 2,300 ms, distinct controlled interaction timestamps, independent interruption evidence and event UUIDs, with new-item readiness required and prior payload preserved. The test also repeats render/layout and Reveal within each item. Existing frozen-retry and delayed-save tests now exercise the compiled hook too. Generated Babel output confirms timer construction remains inside the layout effect.

Verification: targeted screen/timer/clock/metadata suites **52 passed / 4 suites**; `pnpm test` **239 passed / 32 suites**; `pnpm exec tsc --noEmit` exit 0; `pnpm lint` exit 0 with the two existing i18n warnings; `git diff --check` passed. Node's existing experimental SQLite warning remains. A read-only code review found no actionable issue. The actual lazy Android project bundle downloaded completely through Metro (HTTP 200, 6,993,306 bytes); inspection confirms the compiled timer constructor is inside the layout effect. Two optional non-lazy Python diagnostic downloads reset; they are not used as successful delivery evidence. The existing Metro `/status` and backend `/health` returned 200; no database operation or authenticated app interaction was performed during this correction. Changed files are this report, `mobile/src/reviews/useReviewTiming.ts`, `mobile/src/reviews/__tests__/reviewScreen.test.tsx`, and `mobile/jest.config.js`. The earlier uncommitted startup note is preserved.

### Manual A02 rerun procedure (stop before B01)

1. Keep the existing D10-targeted backend and corrected Metro command from the startup note. Target only Pixel_9 / `emulator-5554`. Leave any old unfinished review, use Expo Go **Reload** to load the changed hook, then manually log in as D10_A if required. The operator handles all private credentials.
2. Open Essential Daily Greetings under the exact published release `sample-en-v0.1` and start a **fresh** review session. Use at least two, preferably three, items actually returned by server eligibility. Do not reset history, alter schedules/device time or bypass eligibility to force the original items to appear. If the required items are unavailable, wait until server eligibility permits the run. In particular, the reported correct hello/gratitude schedules span 86,400 seconds from the original interaction anchor; their earliest expected due time is 2026-10-16 11:20:55.617+08, subject to the authoritative current schedule.
3. On item A, wait for the prompt/Reveal control to become ready, use a deliberately distinct dwell (for example about 2 seconds), Reveal, then Correct. On B, confirm a new hidden-answer prompt, dwell about 6 seconds, Reveal, then Incorrect. If C is eligible, dwell about 3 seconds, Reveal, then Correct. These dwell examples distinguish measurements; they are not methodological thresholds. Do not interrupt the app during this basic A02 rerun.
4. After acceptance, use the existing read-only internal evidence queries against **`fluentt_d10_device`** to identify only the new client event UUIDs/session. Verify independent per-item commitment timestamps and durations consistent with the separate presentations, version-1 timing evidence, exact original content provenance, and the structural acceptance/schedule/current-pointer/two-event chain. Confirm `development/dev-0.1` and 86,400 / 600-second intervals. Differing server acceptance times alone do not establish correct client timing. Preserve the original three defective rows and compare them read-only if needed.
5. Record the new coded UUIDs/session, timings, evidence and emulator/Expo Go classification in a fresh rerun result. Keep A02/F02 and all physical-device cases unpassed until the relevant manual evidence is reviewed. **Stop after A02; do not execute B01 or later cases.** No commit or push is authorized.

## Emulator operator run — 2026-10-15, 11:50–12:00 Asia/Manila

**ANDROID EMULATOR / EXPO GO — A02 emulator rerun: PASS. Physical Android verification: BLOCKED. Overall D10: BLOCKED.** This is a separate runtime rerun following the failed reproduction above. The operator authorization expanded progression beyond the earlier A02-only handoff, but explicitly required stopping if an app-owned native artifact became necessary. No historical failure or physical-case status below is overwritten.

Preflight confirmed `main` at `a52480b` with the same four unstaged files, Pixel_9 / `emulator-5554` boot complete, the existing Metro IPv4 listener and reverse rule, and backend `0.0.0.0:8000`. Emulator HTTP `/health/db` returned 200. The backend's PostgreSQL socket mapped to **`fluentt_d10_device`**, migration **`d9c0de000001`**, using read-only inspection. Expo Reload loaded the fixed bundle (69 ms incremental compilation); the app restored its existing session and displayed **D10_A** on home. No human credential action was required, no authentication values were retrieved, and no new source change was made.

| Case | Initial conditions / exact operations | Expected result | Actual result / status |
| --- | --- | --- | --- |
| A02 | D10_A online; original English greetings lesson had only `welcome` due, while `hello` / `gratitude` remained due October 16. Start a fresh eligible greetings review, wait 3 seconds after readiness inspection, Reveal, wait 2 seconds, tap Correct once. Then open published Academic & Research Fundamentals, start its two-item eligible review, use 6 / 9-second pre-Reveal waits plus 2 seconds after Reveal, and tap Incorrect / Correct once respectively. Every tap used newly inspected control IDs/bounds and enabled-state checks. | Independent per-presentation timing, original content provenance, exactly-once acceptance structure and unchanged development scheduler. | Three new accepted interactions; the academic pair advanced from Card 1 of 2 to Card 2 of 2 in the same session, with different durations/timestamps. Completed screens reported 1/1 and 2/2 synced, zero queued. **PASS for this emulator rerun.** |
| B01 | Read the next case: already-open approved review, all network disconnected, then native queue inspection before termination. | Verify the exact durable A-owned UUID/payload and honest queued UI. | **BLOCKED / not executed:** no approved app-owned debuggable artifact or verified native SQLite sandbox inspector is available. Expo Go's shared host and UI counts cannot establish the required native row evidence. No network toggling or extra queued answer was performed. Stopped at the explicit app-owned-artifact prerequisite; B02 and later cases were not executed or promoted. |

The three interactions span **two sessions**, because the original lesson could not legally supply three consecutive eligible items. The two consecutive academic items directly exercise the previously failing item transition. This run does not claim a three-item same-session native rerun. D7 eligibility, device time and existing schedules were not changed to force work to appear. UI inspection/orchestration time and post-Reveal dwell are included in the actual durations; the 3/6/9-second waits are diagnostic variation, not expected exact totals or methodological thresholds.

All timestamps in the following table are **2026-10-15, +08:00**:

| Term / answer | New client event UUID | response_time_ms | client_interaction_at | server_acceptance_at |
| --- | --- | ---: | --- | --- |
| welcome / Correct | `2c06263a-6048-424f-8107-e1621f9e9ffa` | 23138 | 11:56:25.840 | 11:56:29.965399 |
| algorithm / Incorrect | `6120b4bf-1167-49d4-8368-e00aa217463b` | 19201 | 11:57:50.999 | 11:57:55.086342 |
| reproducibility / Correct | `2a4c16ab-fdbe-430c-bedf-e087d006d41f` | 22231 | 11:58:13.382 | 11:58:18.004520 |

For each new UUID, read-only queries verified D10_A ownership; exactly one attempt, ledger and historical schedule; the expected current pointer; one `REVIEW_ANSWERED` and one `REVIEW_SCHEDULED`, both `review-events-1` / `{"scope":"item_attempt"}`; and matching revision-to-item and immutable release-manifest membership. All use release **`5d5f3670-c6c9-5e94-b53c-8b753fa74849` / `sample-en-v0.1`**, Android / app version 1.0.0. Revision IDs are welcome `8f896599-1ce3-5e83-ba99-9a46173110a5`, algorithm `b6a4818e-411a-5025-bbab-71a6d887b7fd`, and reproducibility `83ec5508-bcd0-5e70-b05b-9c1d1ec5db0b`. Scheduler/type/version remain `development/dev-0.1`, with 86400 / 600 / 86400 seconds respectively.

The academic pair shares client session `acf2f32d-a163-4a9d-816d-63a499475b5b` and server session `7e6e6c35-c135-403a-9829-b89c9a71a909`. The greeting interaction uses client session `af6868a7-c171-425e-a053-e8c27fc21dd0` and server session `99a4bd3e-f615-4d48-a8d8-e0635b0627b3`. Every new attempt has timing evidence version 1, `native_performance_now`, `prompt_layout_frame`, interruption count 0 and an empty reason list. Reveal-driven rerenders were exercised without losing the pre-Reveal interval. Other harmless-render and controlled delayed-acknowledgement assertions remain separately classified AUTO; no deliberate network-delay gate was installed, so this run does not promote the complete F02/F10 scenarios.

The emulator wall clock was observed approximately 3.96–4.01 seconds behind the host at the final check. It was not adjusted. Therefore the approximately 4-second client/server timestamp gap is **not** treated as measured network latency or subtracted from any duration. The three accepted timing snapshots are distinct; no recurrence of the frozen-snapshot defect was observed. Process-filtered ReactNativeJS/AndroidRuntime/Expo error collection returned zero error lines for the checked runtime window. Metro retained only the existing require-cycle warnings.

The original three failed accepted chains remained byte-equivalent under a canonical read-only comparison (SHA-256 `f4eb4357793b41e76196c5ec3847829d5c058bf129a4a650ac62f719eebb0143`, excluding only the mutable `is_current` observation). The new welcome acceptance legitimately advanced its current pointer without changing its older attempt/schedule/ledger/events. No direct UPDATE/DELETE, sample publication, migration, normal-database operation, native storage inspection, commit or push was performed.

Local sanitized evidence is under `mobile/.expo/`: `d10-operator-baseline.json`, `d10-operator-actions.json`, `d10-operator-verification.json`, `d10-a02-runtime-log-summary.json` and `d10-a02-rerun-result.png`. Ignored local ADB/read-only-query helpers are operational artifacts, not application changes. This operator run changed only this report among tracked files; the existing timing fix/test/Jest changes were retained. No test suite was rerun for this documentation/runtime-only follow-up; the preceding unchanged code passed 239 mobile tests, TypeScript, lint and its compiler-enabled regression checks. Final `git diff --check` passed.

**Stop state:** the emulator remains on the completed academic review screen (2 synced, 0 queued), with D10_A's existing session intact. No human authentication action is pending. B01 requires an approved app-owned test artifact and verified native SQLite row inspection before it can proceed; none was generated automatically. Physical-only cases, the original matrix's unavailable prerequisites and overall D10 remain BLOCKED.

## Disposable Android artifact preparation - 2026-10-15 (Asia/Manila)

**ANDROID EMULATOR / APP-OWNED DEBUG PREPARATION: BLOCKED before APK creation. B01 was not executed; overall D10 remains BLOCKED.** The independently reviewed timing correction was preserved in disposable `F:\FLUENTT-D10-NATIVE`. Before copying, source status/diff and all four reviewed file hashes were captured. All 224 Git-tracked working-tree files matched their copied SHA-256 values; ignored dependencies, Git metadata, environment secrets, ignored operational evidence and the untracked review bundle were excluded. Source HEAD is `a52480b050c3ce2aa26203c29f9d4492d1a0f70a`, captured diff SHA-256 `301a1f50476cccbec7a68288e081884f63f6ef219e8cbef820a65fa54915fa12`. The immutable snapshot manifest is `F:\FLUENTT-D10-NATIVE\d10-lab\source-manifest.json` (SHA-256 `0a9183711a4e630f493bfb5c97f8ba483d6c4443ba78be281597a387ac9a625f`), containing the four reviewed hashes and every copied file hash.

Only the disposable app config gained package `com.fluentt.d10lab`; Expo prebuild also regenerated its Android/iOS run scripts. Android-only prebuild used `--no-install --skip-dependency-update react,react-native`, without `--clean`. Frozen/offline dependency installation retained Expo 57.0.24, React Native 0.86.3, app 1.0.0 / configured versionCode 1, all dependency versions and the lockfile. No dev-client, SQLCipher, schema or application behavior change was introduced. Debug compilation targeted x86_64 / Pixel_9 `emulator-5554`, with `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000` and lab Metro port 8082. Standard debug skips JS embedding and requires Metro; this lane does not establish a Metro-free offline cold start.

Native generation, offline Expo dependency validation, TypeScript and lint passed (two existing i18n warnings). Gradle 9.3.1's final debug build exited 1 after 7m 8s: `react-native-screens` and `react-native-worklets` C++ tasks failed with `ninja: error: manifest 'build.ninja' still dirty after 100 tries`. CMake also warned that object paths exceed its 250-character maximum; an object-directory prefix alone measured 205 characters. Installed CMake is 3.22.1 / Ninja 1.10.2. The [vendor Windows build guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/) recommends Ninja 1.12+ for long-path handling and shorter paths. This is a build-environment blocker; no Ninja replacement, registry modification, dependency downgrade or generated-native patch was applied. Earlier JVM certificate validation was corrected with process-local Windows-root trust, without disabling TLS; a stalled download run was explicitly interrupted before the logged final retry. Detailed evidence is `d10-lab/android-debug-build-info.log` and `build-result.json` in the disposable copy.

No APK exists and `pm path com.fluentt.d10lab` returned no package. Installation, independent native launch/login, debuggable runtime flags, `run-as` and actual SQLite inspection are therefore **unverified**. Expected Expo SQLite path is `/data/user/0/com.fluentt.d10lab/files/SQLite/fluentt.db`, not an observed file. The prepared `d10-lab/SQLITE-SNAPSHOT-PROCEDURE.txt` / `snapshot_sqlite.py` force-stop only the lab package, verify process absence and `run-as`, archive the entire SQLite directory including any WAL/SHM/journal while stopped, then read a host-only consistent backup and report approved metadata/owner codes/payload hashes. The procedure has not been executed or runtime-validated; missing inspection is not an empty-queue result.

Pixel_9 HTTP `/health/db` returned 200. Read-only PostgreSQL socket mapping reconfirmed the existing backend on **`fluentt_d10_device`**, migration `d9c0de000001`, with six D10 accepted attempts. No credentials were accessed, and no native authentication, queue mutation or accepted-evidence change occurred. Lab Metro/compiler processes were stopped and only the added 8082 reverse rule was removed; original backend, Metro 8081 and its reverse rule remain. All original tracked bytes matched the source manifest immediately before adding this note; only this report changed during preparation. The three reviewed mobile files and untracked review bundle remain unchanged. Original app config/dependencies/lockfile remain unchanged, with no original `android/` or `ios/`. No B01/later case, Plan E/F, commit or push occurred. Stop at the native-build prerequisite: **BLOCKED - no installable debug artifact; Windows CMake/Ninja build failure requires resolution before package/authentication/SQLite gates can be verified.**

## Native toolchain recovery - 2026-10-15 (Asia/Manila)

**ANDROID EMULATOR / APP-OWNED DEBUG: BUILD AND INSTALL PASS; B01 prerequisites remain BLOCKED pending human D10_A authentication and actual SQLite inspection.** The failed `F:\FLUENTT-D10-NATIVE` lab was preserved. Fresh `F:\D10N` contains the same 224-file reviewed snapshot at HEAD `a52480b050c3ce2aa26203c29f9d4492d1a0f70a`; all four reviewed file hashes match the prior manifest. New `d10-lab/source-manifest.json` SHA-256 is `28a9c96f3e6a33c51210342f692eca25333ccfda7252b71643c9b3cee376d528`. No old dependencies, native output or build caches were copied. Frozen installation fetched one missing pinned package; versions and lockfile remained unchanged.

Windows `LongPathsEnabled=1`; `_JAVA_OPTIONS` was absent at process/user/machine scopes. No registry/global setting changed. The failed Screens/Worklets caches selected `F:\SDK\cmake\3.22.1\bin\ninja.exe` / 1.10.2. A private CMake 3.22.1 installation at `F:\D10N\t\c` now contains official Ninja 1.12.1; the [documented Android `cmake.dir` override](https://developer.android.com/studio/projects/install-ndk) in the new lab's local.properties selects it. SDK Ninja was preserved. Full build commands and live processes prove Screens, Worklets and Reanimated invoked `F:\D10N\t\c\bin\ninja.exe`, rather than relying on PATH. NDK remains 27.1.12297006 / SDK `F:\SDK`; Java launcher is 23.0.2. Eleven fresh build-cache paths were checked (none existed); no global cache was deleted.

Android-only prebuild used the approved flags and package `com.fluentt.d10lab`. Debug x86_64 compilation **passed, exit 0, 21m 40s**. The dirty-manifest failure did not recur; **five object-path warning lines remain**. APK: `F:\D10N\mobile\android\app\build\outputs\apk\debug\app-debug.apk`, SHA-256 `3baae0d9ddbefa3714e98beaf8baed38420c61d1d342b76b23d976b6b8495b96`. Installed only on Pixel_9 / `emulator-5554`; APK and installed-package checks confirm version 1.0.0 / code 1, x86_64 and DEBUGGABLE. `run-as` succeeds as the app UID and returns `/data/user/0/com.fluentt.d10lab`.

The initial launch wait timed out; the first Metro bundle took 164869 ms for 1514 modules. Later `dumpsys activity` confirmed the lab MainActivity foreground, and the human operator confirmed **Login screen**. Automated hierarchy capture timed out; rendered Login is operator-confirmed evidence. Emulator actions stopped at this authentication boundary. No credentials were entered/retrieved. SQLite directory/file inspection and stopped-app snapshot execution remain pending; `/data/user/0/com.fluentt.d10lab/files/SQLite/fluentt.db` is an expected, unverified path. The new lab's prepared snapshot procedure/helper captures the entire SQLite directory, including WAL/SHM, while stopped and reports only approved metadata/owner codes/payload hashes from a host-only consistent copy. No empty-queue claim is made. The debug APK has no embedded JS bundle and needs lab Metro8082; no Metro-free offline cold-start claim is made.

Emulator `/health/db` returned 200; fresh host health and read-only PostgreSQL socket mapping reconfirmed `fluentt_d10_device`, migration `d9c0de000001`, with six unchanged D10 attempts. Expo dependency validation against the offline SDK snapshot, TypeScript and lint passed (two existing i18n warnings). Full evidence is `F:\D10N\d10-lab\recovery-result.json`, build-manifest.json, android-debug-build.log and installation/launch verification files. Only this report changed in the original checkout during recovery; reviewed mobile files, review bundle, app configuration/dependencies/lockfile and previous report content were preserved, with no original native directories. Metro8081/backend and lab Metro8082 remain running. No B01/later case, Plan E/F, commit or push occurred. **BLOCKED - human D10_A login, followed by actual SQLite inspection, is required before B01 readiness can be established.**

## Native SQLite prerequisite verification - 2026-10-15 (Asia/Manila)

**APP-OWNED DEBUG / D10-B01 prerequisite: READY FOR HUMAN-ASSISTED D10-B01. B01 was not executed; overall D10 remains BLOCKED.** After human-confirmed D10_A authentication, the lab app was restarted and returned to Home. The debug package remains `com.fluentt.d10lab` version 1.0.0 / code 1, debuggable and foreground on Pixel_9 / `emulator-5554`; lab Metro 8082 is running. No review was opened or answered.

Read-only `run-as` inspection observed `/data/user/0/com.fluentt.d10lab/files/SQLite/fluentt.db` in `files/SQLite`, 45,056 bytes. The complete directory contained only `fluentt.db`; no WAL, SHM or journal was present. The prepared helper force-stopped only the lab package, verified it remained stopped, and archived the entire directory (SHA-256 `1fd6ead6db64522cec742ab42b172e41349c1c6ed1bd9dfdad7c67e69b6b9596`). A host-only read-only consistent copy opened with `integrity_check=ok`; all tables and columns required by the current app migrations are present. This app applies idempotent `CREATE`/`ALTER` migrations without a migration-version table. Evidence is under `F:\D10N\d10-lab\snapshots\20261015T101448016122Z\`.

The `pending_review_events` queue table is verified with **0 rows before B01**. The coded owner map has a D10_A mapping; an empty queue provides no local row to compare. The backend still returns HTTP 200 and maps to `fluentt_d10_device`, migration `d9c0de000001`, with six unchanged D10_A accepted attempts. No device or backend SQLite mutation, credential access, B01/later case, Plan E/F, commit or push occurred.

## Environment and build manifest

| Component | Observed value / boundary |
| --- | --- |
| Host | Windows, PowerShell; repository `C:\FLUENTT` |
| Backend / mobile source | `7f3a9cb` plus the D10 AuthProvider/test delta; not a frozen research build |
| Python / uv | 3.13.15 / 0.12.23 |
| FastAPI / Uvicorn | 0.141.1 / 0.53.0; application API version 0.1.0 |
| SQLAlchemy / psycopg / Alembic | 2.0.54 / 3.3.6 / 1.20.0 |
| pytest / Ruff | 9.1.1 / 0.16.8 |
| Docker / PostgreSQL | Docker 29.6.1; Compose `db`, `postgres:17-alpine`, server 17.11; healthy and accepting connections |
| Applied migration | `d9c0de000001` on normal development DB and disposable D10 DB |
| Node / pnpm | v22.23.3 / 11.9.0 |
| Expo package / installed CLI | 57.0.24 / 57.0.26 |
| React Native / React | 0.86.3 / 19.2.3 |
| Expo Router / SQLite / SecureStore | 57.0.22 / 57.0.3 / 57.0.4 |
| NetInfo / Reanimated / Worklets | 12.0.1 / 4.5.1 / 0.10.1 |
| App config | Name/slug `mobile`, app version 1.0.0, scheme `mobile`, React Compiler and typed routes enabled |
| Native build configuration | No `android/` or `ios/` checkout, `eas.json`, `expo-dev-client` dependency, explicit Android application ID, or native build number |
| Java / adb / SDK / emulator | Not discoverable on PATH; Android SDK environment variables unset; usual SDK/Studio/AVD directories absent |
| Connected devices | No phone available by researcher confirmation; adb enumeration could not run because adb is absent |
| Physical model / Android version / host runtime | **Not observed**; must be recorded from an actual device |
| Actual native clock source | **Not observed**; C++ binding inspection and Jest source selection are not runtime observations |
| Current scheduler | `development` / `dev-0.1`; correct 86,400 seconds, incorrect 600 seconds, client-interaction anchor retained |
| Normal backend environment | `.env` present, `APP_ENV=development`, local PostgreSQL `fluentt` on port 5432, JWT secret configured; values/credentials omitted |
| Mobile environment | No mobile `.env*` file found; `EXPO_PUBLIC_API_URL` controls API routing; source fallback is `http://10.0.2.2:8000` |

The normal development database initially had **zero releases, revisions and attempts**. D10 created a separate database **`fluentt_d10_device`** without changing `.env`, applied the complete migration chain, and imported only repository sample English/Filipino content. It now contains **2 releases, 10 revisions, 4 lessons, 10 logical items, 0 users and 0 attempts**. No participant credentials were generated during this audit. Automated tests use the separate `fluentt_test` database; do not point a phone at that database because test fixtures reset it.

Sample data is software test material, not approved research Set A/B. Planned disposable phone codes are `D10_A` and `D10_B`; those accounts have not yet been provisioned. Never use real learners for these scenarios.

## Automated results and evidence classification

All final commands below exited 0. Backend code was unchanged by the subsequent mobile-only correction; the complete backend run remains applicable. Full mobile checks and Android compilation were repeated after the correction.

| Evidence ID | Directory / command | Actual result | Evidence class |
| --- | --- | --- | --- |
| AUTO-01 | Backend: `uv run alembic upgrade head` | Development schema already at head; fresh D10 database migrated through all eight revisions to D9 | Real PostgreSQL / Alembic |
| AUTO-02 | Backend: `uv run pytest -v` | **173 passed**, 60.67 seconds; two dependency deprecation warnings | Real PostgreSQL and in-process FastAPI TestClient; not phone transport |
| AUTO-03 | Backend: `uv run ruff check app tests scripts` | All checks passed | Static analysis |
| AUTO-04 | Mobile: `pnpm test` | Baseline 232 passed; final **238 passed / 32 suites**, 16.262 seconds | Jest; native storage/auth/lifecycle/network are mocked where indicated |
| AUTO-05 | Mobile: `pnpm exec tsc --noEmit` | No diagnostics | Static type check |
| AUTO-06 | Mobile: `pnpm lint` | 0 errors; existing i18n warnings at lines 13 and 24 | Static analysis |
| AUTO-07 | Repository: `git diff --check` | Passed after final documentation/code changes | Tracked diff whitespace check; new note checked separately |
| AUTO-08 | Repository: `git status --short` | Two modified mobile files and this new document; no staged files | Git scope inspection |
| AUTO-09 | Mobile: `pnpm exec expo install --check` with `EXPO_OFFLINE=1` | Exit 0, dependencies up to date against installed SDK snapshot; CLI warns offline validation is unreliable | Local dependency snapshot check, not latest registry validation |
| AUTO-10 | Mobile: `pnpm exec expo export --platform android --output-dir <temporary directory>` | Corrected app compiled 1,350 modules / 27 assets; Android Hermes bundle approximately 3.1 MB | Bundle/bytecode compilation only; no APK, emulator, native modules or UI execution |
| AUTO-11 | Docker: `docker compose exec -T db pg_isready -U fluentt -d fluentt` | Accepting connections | Real service readiness |
| AUTO-12 | Hidden loopback Uvicorn against D10 DB; HTTP requests | `/health` 200, `/health/db` 200, unauthenticated `/content/languages` 401; exact smoke process then stopped | Real local HTTP + database; no authenticated phone flow |
| AUTO-13 | D10 imports via existing `scripts/import_content.py` | Both sample imports succeeded under D9; counts recorded above | Real publication / immutable provenance |
| AUTO-14 | Targeted corrected auth/account suites | **30 passed across 3 suites** | Simulated fetch/SecureStore boundaries, real AuthProvider/API/token-store code |

Warnings: Starlette/httpx and AnyIO deprecations in backend tests; Node experimental SQLite warnings; the two existing i18n named-export warnings. Bundle workers also reported NO_COLOR/FORCE_COLOR environment warnings. No dependency was upgraded to remove a warning. Expo's commands invoked pnpm's already-up-to-date dependency check; Git confirmed no manifest/lockfile changes.

The final bundle is an external temporary artifact at `C:\Users\ranib\AppData\Local\Temp\FLUENTT-D10-android-7f3a9cb`, containing `entry-e3a6c0c4c0e6f03bf03d9212410760e5.hbc` under `_expo/static/js/android`. Its directory names the base commit; its contents include the uncommitted auth correction. It uses the default emulator API fallback and is **not a configured phone APK or study build**.

### What the automated suites actually establish

| Area | Concrete evidence / limits |
| --- | --- |
| Backend acceptance and sync | `backend/tests/reviews/test_review_api.py`, `tests/sync/test_sync_api.py`: normal acceptance, auth/validation, UUID replay, cross-owner identity and lost acknowledgement; partial batch preserves earlier real acceptance |
| Scheduling/current state | `tests/reviews/test_due_review.py`, `test_current_schedule_migration.py`: due boundary, empty/new state, missing-pointer refusal, concurrent distinct/duplicate transitions, original replay and provenance |
| Content | `tests/content/test_provenance.py`, `test_provenance_migration.py`: original release/revision survives publication/edits; unsafe deletion and destructive downgrade rejected |
| D9 integrity | `tests/research_logging/test_integrity.py`, `test_migration.py`: two canonical linked events, ownership/schema/privacy, failed transaction rollback, code immutability, update/delete/cascade/truncate rejection and legacy preservation |
| Normal profile/password paths | `tests/auth/`, `tests/users/`: password changes/resets, authentication, preference updates remain functional with D9 guards |
| SQLite queue | `mobile/src/offline/__tests__/syncRecovery.test.ts`: production migrations/queue SQL with Node's actual SQLite engine, including a real file close/reopen; fetch and SecureStore boundaries are mocked |
| Owner isolation | `accountIsolation.test.ts`, `accountQueueStatus.test.tsx`, `ownershipMigration.test.ts`: owner-scoped mutations/counts, account/token races, legacy ownerless preservation |
| Lifecycle / timing / failure UI | `syncLifecycle.test.ts`, `storageFailure.test.ts`, review screen/timing/clock suites: injected lifecycle, frames, network errors and native-open failure; these do not run Android event delivery or physical disk faults |
| Contracts/cache/navigation | Review/profile/content contract suites and cache/navigation tests: pinned release, exact wire units/identity, no cached offline eligibility fabrication |

## Defect reproduced and correction applied

**D10-AUTH-01 — startup restoration treated any profile failure as credential rejection.** Source tracing showed that `AuthProvider.restoreSession` called unconditional `clearTokens()` in its catch block. Offline fetch failure, HTTP 503 and refresh transport failure therefore erased SecureStore credentials even though the shared API client deliberately preserves them. An old restoration failure could also erase a newer login, while an old successful response could replace that login's displayed identity.

Six regression cases were added before production editing: three transient restoration failures, one genuine refresh rejection, and two late restoration outcomes after another login. The red run had **5 failures / 6 passes** in the provider suite: credential preservation and both late outcomes failed; genuine rejection and existing normal behavior passed.

Small correction in `mobile/src/auth/AuthProvider.tsx`:

- Remove unconditional credential clearing from restoration failure. Genuine refresh rejection retains the API client's existing compare-and-clear behavior.
- Keep the UI signed out/unverified after unsuccessful restoration; preserved tokens alone do not authorize another learner's queue or manufacture backend eligibility.
- A local session-action counter fences initial restoration against later successful login/password change or explicit logout, including the asynchronous language step. This counter is only a UI callback fence, not research metadata or a new queue policy.

No auth retry service, offline authenticated identity, automatic reconnect restoration UI, queue-state redesign, lease/retry change, or storage schema was added. After offline cold startup, reconnect and perform an online app restoration or explicit login before expecting verified identity and drain. D3 normal verified startup/login handling remains unchanged. The native reproduction and reconnect behavior still require the phone cases below.

Affected auth/account tests passed, then the entire mobile suite, TypeScript, lint and Android bundle compilation passed. D2–D9 invariants and tests remain intact. No other implementation defect was reproduced in this run.

## Android runtime choice and blocked build work

The current plain SQLite configuration (`openDatabaseAsync('fluentt.db')`, no SQLCipher/libSQL/custom SQLite build options), SecureStore and NetInfo are supported Expo Go modules in the [SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/), [SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/) and [NetInfo](https://docs.expo.dev/versions/v57.0.0/sdk/netinfo/) documentation. Installed versions also match the local Expo bundled-native-module map, including Reanimated/Worklets. SQLCipher would require a custom native binary; it is not configured here. This supports **Expo Go as the least-changing initial online smoke lane**, subject to recording and checking the actual host's SDK/runtime version on the future phone. It does not prove every native route works.

For reproducible total-network-loss cold restart, prefer an **app-owned native APK with an embedded bundle**, then confirm it actually launches with Metro and internet both unavailable. Do not assume Expo Go/development-server caching provides this. A debug build without an embedded bundle may require Metro after termination. Neither an app-owned APK nor a native debug/dev-client build was created here: SDK/JDK/device are absent, `android.package` is unspecified, and no EAS/dev-client configuration exists.

The installed CLI confirms `expo run:android --device --variant release` and `--variant debug` flags. Expo documents [local native compilation and release variants](https://docs.expo.dev/guides/local-app-development/). Future native generation/build must occur in a disposable source copy, with a recorded operator-selected test application ID in app configuration and a LAN API URL. Do not hand-edit generated native folders or run `prebuild --clean` on the reviewed checkout. Do not assume `--app-id` creates/configures the application's package; it is a launch override. Do not install a different signing identity or uninstall during a persistence case.

For native SQLite row inspection, use an app-owned debuggable test artifact and verified app-sandbox access. The installed Android module defaults to the app files `SQLite` directory. Expo Go's shared, often non-debuggable host and a release APK may deny `run-as`. If exact native queue bytes cannot be inspected, keep the corresponding evidence requirement BLOCKED; UI counts alone do not prove row payload/ownership preservation. A suitable inspection/fault harness remains a device-verification prerequisite, not a new participant feature.

## Repeatable operator setup

Commands in this section are for the future lab run, not evidence that a phone was exercised. Run only against disposable accounts/content and the dedicated D10 database. Temporary credentials printed by provisioning belong in a private console, never in this report, logs, screenshots, command-line password arguments or committed files.

### Host tools, PostgreSQL and backend

On this machine, use a separate PowerShell terminal:

```powershell
$env:Path = 'C:\nvm4w\nodejs;C:\Users\ranib\AppData\Local\Microsoft\WinGet\Packages\astral-sh.uv_Microsoft.Winget.Source_8wekyb3d8bbwe;' + $env:Path
Set-Location C:\FLUENTT
docker compose up -d db
docker compose ps
docker compose exec -T db pg_isready -U fluentt -d fluentt

Set-Location C:\FLUENTT\backend
uv sync
# Capture the configured connection privately; change only its database name.
$env:DATABASE_URL = & uv run python -c "from sqlalchemy.engine import make_url; from app.core.config import get_settings; print(make_url(get_settings().database_url).set(database='fluentt_d10_device').render_as_string(hide_password=False))"
$env:APP_ENV = 'development'
uv run alembic upgrade head
uv run alembic current
uv run python scripts/import_content.py ../scripts/seed_content/sample-en-v0.1.json
uv run python scripts/import_content.py ../scripts/seed_content/sample-fil-v0.1.json
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`fluentt_d10_device` already exists from this audit. On another machine, create it first with `docker compose exec -T db createdb -U fluentt fluentt_d10_device` from the root, only if absent. Do not drop/reset the normal database or accepted research rows. Environment overrides are process-local; do not paste their resolved values into evidence. Keep later terminal launches explicitly pointed at D10 rather than accidentally using `.env`'s `fluentt` database.

In a second backend terminal with the same D10 environment, provision the two test accounts when a phone is available:

```powershell
uv run python scripts/create_participant.py --email '<disposable-test-email-A>' --participant-code D10_A
uv run python scripts/create_participant.py --email '<disposable-test-email-B>' --participant-code D10_B
```

Use generated temporary passwords privately and complete the normal in-app password-change flow. If a test code already exists, inspect/reset it intentionally with `scripts/reset_participant_password.py`; do not delete/replace its accepted history. Record only the disposable code in evidence.

### Phone LAN access and Expo Go smoke

Find the active private LAN address with `Get-NetIPConfiguration`; choose the interface shared with the phone, not loopback/Docker/VPN/emulator. Confirm both devices are on that LAN, that router client isolation is disabled for the lab, and that trusted-network firewall rules allow backend port 8000 and Metro port 8081. No firewall rule was changed during this audit. Verify `http://<PC-LAN-IP>:8000/health` and `/health/db` from the phone browser. PC loopback success is not proof of phone access.

```powershell
Set-Location C:\FLUENTT\mobile
$env:Path = 'C:\nvm4w\nodejs;' + $env:Path
pnpm install --frozen-lockfile
$env:EXPO_PUBLIC_API_URL = 'http://<PC-LAN-IP>:8000'
pnpm exec expo start --go --lan --port 8081
```

Replace the placeholder before executing. Open the QR in an SDK-57-compatible Android Expo Go host and record its actual version. [Expo's startup instructions](https://docs.expo.dev/get-started/start-developing/) require the shared LAN for this path. An Expo tunnel, if used, exposes Metro only; it does not automatically make the private FastAPI URL reachable. The emulator fallback `10.0.2.2` is not a physical-phone LAN address. An exported/release bundle must be rebuilt with its correct API environment; changing a PC environment variable after embedding does not rewrite that bundle.

### Future app-owned APK, device manifest and process control

After installing Android Studio/SDK/platform tools and a compatible JDK per the matching Expo setup docs, record actual paths and versions. Do not assume those tools are currently present. SDK 57 targets the documented Android SDK 36 stack. Create a disposable copy of the reviewed source, retain the base commit/diff manifest, configure only its test `android.package` through `app.json`, and set its API URL before building:

```powershell
# From the disposable copy's mobile directory, with dependencies installed:
$env:EXPO_PUBLIC_API_URL = 'http://<PC-LAN-IP>:8000'
pnpm exec expo run:android --device --variant debug
# Separate app-owned embedded-bundle lane, not proof until cold launch is observed:
pnpm exec expo run:android --device --variant release
```

These native commands were verified as supported CLI options but **not executed**. Debug/release lanes need separate manifests; preserve package/signing/data continuity within each case. A dev-client flavor would require deliberately adding/configuring `expo-dev-client` in the lab copy; no such installation was made here. Building does not require inventing an ESR/assignment/build-freeze ID.

When adb and a lab phone exist:

```powershell
adb version
adb devices -l                       # Do not publish hardware serials.
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
$d10Package = '<actual installed application ID>'
adb shell dumpsys package $d10Package | Select-String 'versionCode=|versionName='
adb shell am force-stop $d10Package
# Relaunch using the phone's launcher icon; record the actual package/build.
```

For Expo Go, determine the installed host package rather than assuming the configured app scheme is an Android package. Its force-stop affects all projects in that host. The [Android adb documentation](https://developer.android.com/tools/adb) distinguishes activity-manager process control from package-manager data operations.

| Operation | Meaning for D10 |
| --- | --- |
| Navigate away/background/resume | Existing process/runtime may survive; tests interruption signals, not durable restart |
| Expo Reload / Fast Refresh | JS restart/update; does not establish actual OS process termination |
| `am force-stop` then launcher restart | Termination/restart of the actual package; retain app data; prove this in evidence |
| Clear application data (`pm clear`) | Deletes app-local state; **not** a queue durability test and not used in this matrix |
| Uninstall | Removes app state; **not** restart and not a permitted substitute for it |

### Sanitized log collection

Use only the disposable package. Capture each phase before/after restart separately because PID changes. No Android logs exist for this audit.

```powershell
$d10Package = '<actual installed application ID>'
$d10AppPid = (& adb shell pidof -s $d10Package).Trim()
if (-not $d10AppPid) { throw 'Start the verified lab app before collecting logs.' }
$d10LogPath = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads\FLUENTT-D10-case-sanitized-log.txt'
$d10Sensitive = '(?i)bearer\s|authorization|access.?token|refresh.?token|password|cookie|jwt|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+'
& adb logcat -d --pid=$d10AppPid -v threadtime '*:W' |
    ForEach-Object { if ($_ -match $d10Sensitive) { '[sensitive log line omitted]' } else { $_ } } |
    Set-Content -Encoding utf8 -LiteralPath $d10LogPath
```

Name each output by the actual test ID/phase. Filtering is defense in depth, not detection of arbitrary secrets/names in free text: review before sharing, omit irrelevant messages, redact account identifiers to test codes, and crop login/profile screens. Do not enable HTTP header/body/SQL-parameter logging or export SecureStore. Timing evidence comes from the accepted attempt or the approved lab inspector, not a claim that logcat emits clock facts it does not log.

## Evidence record and native prerequisites

Every native case below currently has this shared evidence manifest:

| Required field | Current actual value |
| --- | --- |
| Device model / Android OS | Not observed; no device available |
| Build/runtime | No installed native artifact observed; tested JS source is base commit plus D10 correction |
| Backend commit / migration | `7f3a9cb`, `d9c0de000001`; no backend source changes |
| Disposable account | Planned `D10_A`/`D10_B`; not yet provisioned |
| Initial condition | Native setup and scenario-specific precondition below not established |
| Actual observed result | **Not run** |
| Status | **BLOCKED** |
| Native logs/screenshots/SQLite evidence | None captured; cannot substitute AUTO evidence |
| Related correction | D10-AUTH-01 for cold-start/reconnect and stale-account cases; otherwise no reproduced native issue |

For each future execution, copy this record with the case ID, replace every unknown using actual observations, append exact steps/timestamps, expected versus actual result, PASS/FAIL/BLOCKED, sanitized evidence paths and any fix/rerun. Record debugger attachment, network route, Expo Go versus app-owned APK, package/version/signing identity, and whether JS booted without Metro. Model/OS are allowed environment facts; omit unique hardware IDs and account emails/tokens.

Prerequisites beyond a phone: a runtime that can cold-boot in the intended offline condition; a verified native SQLite inspection path; a controlled response-delay/drop facility for lost-ack/partial sync tests; and a reversible native storage-fault setup in a disposable app. If a prerequisite cannot be established, keep that particular case BLOCKED, even if its mock passes. Offline-native snapshots should compare owner code mapping, event UUID and SHA-256 of original `payload_json`, with separate operational columns; do not edit hidden rows to make them visible.

## Physical Android test matrix

All 40 cases are **BLOCKED / not run**. Steps below are instructions, not observations. AUTO references point only to supporting automated evidence in this note.

| ID | Initial conditions and exact reproduction steps | Expected evidence / result | Status / supporting automated evidence |
| --- | --- | --- | --- |
| A01 | D10_A provisioned, backend/Metro reachable. Login, change temporary password, choose learning language, open a published sample lesson. | Normal auth/profile flow; exact published lesson/release; no D9 disruption. | BLOCKED; AUTO-02/13/14 |
| A02 | A01 complete, eligible new item. Open review, wait for presentation, Reveal, Correct/Incorrect, await acceptance, run the internal backend checks below. | One attempt, schedule, ledger, current pointer and two canonical events; original duration/time/content/evidence. | BLOCKED; AUTO-02/04 |
| B01 | Online verified A, already-open approved review. Disconnect both Wi-Fi and cellular, Reveal/answer, inspect native queue before termination. | One durable A-owned UUID/payload; queued UI only after insertion; no manufactured new eligibility. | BLOCKED; AUTO-04 |
| B02 | B01 row captured; offline-capable native artifact. Force-stop actual package, restart while all network/Metro unavailable, inspect native row again. | Identical UUID, owner and payload hash. Unverified cold-start UI may be signed out/count unavailable; no fabricated authenticated count. | BLOCKED; AUTO-04/14; D10-AUTH-01 |
| B03 | B02 retained row. Restore network, perform online restoration/login as A, allow normal D3 drain, inspect backend/local queue. | Exactly one accepted backend chain; local deletion only on matching acknowledgement; original payload facts unchanged. | BLOCKED; AUTO-02/04/14 |
| B04 | Repeat B01/B02 separately with warm background/resume, JS reload and actual force-stop. Record operation and native process state for each. | No conflation of these operations; only actual process restart establishes native persistence evidence. | BLOCKED; AUTO-04 supports file reopen only |
| C01 | A has one queued row. Restore network with controlled drain blocked, logout A and login B. Inspect counts and transmissions. | A work retained and never sent with B credentials; B count zero without B work. | BLOCKED; AUTO-04/14 |
| C02 | C01 state. Obtain fresh B eligibility, queue one B answer, inspect both partitions/status/eligibility. | B count one; A row unchanged; account-specific backend eligibility. | BLOCKED; AUTO-02/04 |
| C03 | Both owners have rows. Switch back to A, verify identity, release A drain. | A count reflects A only; original A UUID can reconcile; B data preserved separately. | BLOCKED; AUTO-02/04/14 |
| C04 | Disposable native SQLite fixture with a separate ownerless legacy row. Login A, B, then signed out; trigger status/drain. | Legacy row is never counted, claimed, reassigned or deleted; no other-owner count exposed. | BLOCKED; AUTO-04 |
| D01 | A queued row; verified inspector/gated request. Start sync, observe `syncing` and lease, terminate in-flight, retain outage until lease expires, restart/reconnect. | Same original payload; stale recovery only after five-minute operational expiry; eventual one accepted chain. | BLOCKED; AUTO-02/04 |
| D02 | A queued row; response gate forwards one request without logging auth/body. Observe backend acceptance, drop acknowledgement before client completion, retry later. | Same UUID replay; one attempt/ledger/schedule and two events; unchanged original schema/linkage/timing. | BLOCKED; AUTO-02/04 |
| D03 | Same as D01 with a live renewed lease. Trigger overlapping manual/lifecycle drains before expiry. | No stale takeover or old-worker completion mutation; owner/lease fencing and one worker. | BLOCKED; AUTO-04 |
| D04 | Two disposable native queue rows: valid first, service-invalid later. Drain sequentially; inspect backend after failure. | First genuine acceptance persists; later event retained as permanent failure; no false all-synced claim. | BLOCKED; AUTO-02/04 |
| D05 | Permanently malformed owned fixture followed by valid new work. Trigger repeated drains. | Invalid row stays preserved/parked; later valid work is accepted; original rejected bytes not repaired. | BLOCKED; AUTO-04 |
| D06 | Controlled network/503/408/429, genuine auth rejection, and 400/422 in separate runs. Record claims/counts/retry times; reverify account for auth case. | D3 transient backoff, auth pause and permanent classification preserved; no learner-attempt inflation. | BLOCKED; AUTO-02/04/14 |
| E01 | Online session and one queued answer. Inspect request/accepted session chain using coded evidence. | Original client session UUID distinct from server session UUID; conflicting pair rejected. | BLOCKED; AUTO-02/04 |
| E02 | Choose release R from lesson list. Navigate detail -> review; publish a newer sample release concurrently; retry navigation/load. | Exact requested R remains pinned; no silent current-release substitution. | BLOCKED; AUTO-02/04 |
| E03 | Queue an answer with exact revision/release. Refresh cache/app content, then inspect pending JSON/hash and sync. | Original revision/release/platform/version/UUID/time unchanged by refresh or drain. | BLOCKED; AUTO-02/04 |
| E04 | An accepted/queued old-release interaction exists. Republish corrected disposable content and reconstruct old attempt. | Old immutable term/context/timing/scheduler result unchanged; new publication does not rewrite history. | BLOCKED; AUTO-02/13 |
| E05 | Accept sample items so their current due times are future; fetch eligibility, then complete all available work. | Server excludes future-due items; empty eligible screen is normal; device time cannot select due work. | BLOCKED; AUTO-02/04 |
| E06 | Cached published lesson, app offline after leaving/restarting review. Reopen or retry initialization. | Explicit unavailable state; no new persisted eligibility grant or cached-word substitution. | BLOCKED; AUTO-04 |
| F01 | Delay eligibility/render and use actual native entry/deep-link. Attempt Reveal/answer before positive layout and guarded next frame; observe visible presentation. | Controls unavailable before start; source boundary remains `prompt_layout_frame`; frame is an operational approximation, not perceptual proof. | BLOCKED; AUTO-04 |
| F02 | At least two eligible items. Answer first, delay its save, present next, observe/render again and commit next. | Fresh timer per item; renders/repeated layout/save time do not reset/inflate it. | BLOCKED; AUTO-04 |
| F03 | Started item. Navigate blur/focus or canceled back transition without committing, then finish the same surviving presentation. | Observed navigation reasons retained; no restart/subtraction; unmounted interaction is not reconstructed. | BLOCKED; AUTO-04 |
| F04 | Started item. Pull Android notification shade, dismiss, finish. | Native blur delivery/readiness observed; `app_blur` when signaled; elapsed retained. | BLOCKED; AUTO-04 is injected AppState only |
| F05 | Started item. Home/background, then foreground, finish. | Delivered lifecycle interruptions retained, controls gated while inactive, original timer start preserved. | BLOCKED; AUTO-04 |
| F06 | Started item. Lock phone, wait, unlock and finish while process survives. | Actual signals and elapsed behavior recorded; no invented lock label; no time subtraction or validity inference. | BLOCKED; AUTO-04 cannot establish lock behavior |
| F07 | Started item on lab phone. Observe documented OS suspension with appropriate device diagnostics, resume, finish; record whether suspension was actually established. | Clock/lifecycle behavior characterized; waiting or Doze alone is not proof of suspension. If unverifiable, retain BLOCKED. | BLOCKED; no native suspension evidence |
| F08 | Record actual native clock label. On a safe disposable phone, record a controlled forward/backward system-clock change, finish, restore automatic time. | Original source/time/evidence preserved; characterize elapsed and operational lease/backoff separately; no skew correction/exclusion invented. | BLOCKED; AUTO-04 clock inputs simulated |
| F09 | Commit an answer, induce save/storage/auth failure, wait and retry same screen. | Same UUID/duration/interaction time/evidence; no second commitment or post-commit interruption mutation. | BLOCKED; AUTO-04/14 |
| F10 | Controlled delayed API/refresh acknowledgement after answer commitment. Compare captured duration before and after accepted response. | Network/backend delay does not inflate learner duration; capture precedes awaits. | BLOCKED; AUTO-04 |
| G01 | Disposable app-owned native test artifact and reversible SQLite-open fault; no production/shared-host data. Launch/load/save, then remove the fault and retry. | Initialization fails explicitly; no in-memory durability fallback; retry can reopen native storage. | BLOCKED; AUTO-04 open rejection is mocked |
| G02 | Already-approved visible item; reversible native write failure isolated to test queue storage. Commit, inspect error UI/native row, restore write access, retry. | No saved/advanced claim on failed insertion; same frozen payload retried once storage works. | BLOCKED; AUTO-04 |
| G03 | G02 unsaved state. Force-stop before any durable insertion or server acceptance; restart and inspect queue/backend. | Explicitly document locally lost committed RAM interaction; no fabricated recovery or successful outcome. | BLOCKED; known crash window by source inspection |
| G04 | Kill in separate windows before commitment, during auth/HTTP wait, after server acceptance but before local queue insertion, and after durable insertion. | Distinguish abandoned/locally lost work, preserved server acceptance, and durable queued replay; no blanket durability claim. | BLOCKED; AUTO-02/04 supports components only |
| H01 | A02/B03 accepted event. Query linked chain and compare coded evidence/privacy allowlist. | Exactly ANSWERED/SCHEDULED, `review-events-1`, same owned attempt, minimal scope payload, original timing/provenance. | BLOCKED native flow; AUTO-02 real DB constraints |
| H02 | Replay same A UUID, then a distinct genuine UUID. Inspect event/attempt counts and original facts. | Replay adds nothing/changes nothing; genuine interaction creates separate evidence. | BLOCKED native flow; AUTO-02/04 |
| H03 | Normal D10 account. Change preferences and password through the app, reauthenticate, inspect coded identity. | Normal operations succeed; provisioned code stays fixed; no research history mutation. | BLOCKED native flow; AUTO-02/14 |
| H04 | Run only isolated PostgreSQL integrity tests below; later repeat the same guarded native-flow evidence checks with a phone. | Ordinary update/delete/cascade/truncate blocked; no policy bypass. Backend portion is verified; phone-created evidence portion remains unavailable. | BLOCKED native portion; AUTO-02 PASS backend portion |

Do not record a native case as PASS from its AUTO column. Controlled partial/failure rows are explicit lab fixtures and must not be confused with new learner interactions. D01's lease and D06's backoff values are existing operational constants, not methodological thresholds.

## Internal evidence checks for the disposable lab

These are verification queries for disposable test records, not a user export endpoint or approved dissemination policy. Run them only in `fluentt_d10_device` after the device cases create records. The database has no such records yet. Reports use participant codes; do not select email, password hashes, tokens or direct names.

```sql
SELECT u.participant_code, a.id AS attempt_id, a.client_event_id,
       rs.client_session_id, a.session_id AS server_session_id,
       a.vocabulary_item_id, a.content_revision_id, a.content_release_id,
       vr.term AS original_term, a.correct, a.response_time_ms,
       a.client_interaction_at, a.server_acceptance_at, a.timing_evidence,
       a.device_platform, a.application_version,
       s.scheduler_type, s.algorithm_version, s.interval_seconds,
       s.due_at, s.scheduler_state, (cur.schedule_id = s.id) AS is_current,
       led.accepted_at,
       (SELECT count(*) FROM research_events e
        WHERE e.review_attempt_id = a.id AND e.user_id = a.user_id
          AND e.schema_version = 'review-events-1'
          AND e.event_type = 'REVIEW_ANSWERED') AS answered_events,
       (SELECT count(*) FROM research_events e
        WHERE e.review_attempt_id = a.id AND e.user_id = a.user_id
          AND e.schema_version = 'review-events-1'
          AND e.event_type = 'REVIEW_SCHEDULED') AS scheduled_events
FROM review_attempts a
JOIN users u ON u.id = a.user_id
JOIN review_sessions rs ON rs.id = a.session_id
JOIN vocabulary_revisions vr ON vr.id = a.content_revision_id
JOIN content_releases rel ON rel.id = a.content_release_id
JOIN review_schedules s ON s.attempt_id = a.id
JOIN accepted_client_events led ON led.attempt_id = a.id AND led.user_id = a.user_id
LEFT JOIN current_review_schedules cur
  ON cur.user_id = a.user_id AND cur.vocabulary_item_id = a.vocabulary_item_id
WHERE u.participant_code IN ('D10_A', 'D10_B')
ORDER BY a.server_acceptance_at, a.id;

SELECT u.participant_code, a.client_event_id, e.event_type,
       e.schema_version, e.payload
FROM research_events e
JOIN review_attempts a ON a.id = e.review_attempt_id AND a.user_id = e.user_id
JOIN users u ON u.id = a.user_id
WHERE u.participant_code IN ('D10_A', 'D10_B');
```

For each UUID, verify one attempt and ledger, one historical schedule, one event of each canonical type/schema, original facts and expected current pointer. Snapshot these values before/after replay/publication; query the exact content release manifest for membership rather than today's pointer. A newer genuine acceptance may supersede the current pointer while old history remains.

For native SQLite, read `client_event_id`, `owner_user_id`, `payload_json`, `status`, `attempt_count`, `failure_kind`, `lease_id`, `next_retry_at`, `created_at`, `updated_at` in the isolated app. Map owner UUID to the test code for reporting; compare raw payload hashes locally. Account B/ownerless rows must remain unchanged when draining A. Do not publish raw DB files or SecureStore. `run-as`/file access failure is an inspection BLOCKER, not proof of an empty queue. Do not assume a host `sqlite3` tool exists on Android, copy a live journal/WAL file incompletely, or clear app data to obtain access.

Use the existing isolated backend tests for destructive operations rather than attacking the phone database or normal backend:

```powershell
Set-Location C:\FLUENTT\backend
uv run pytest -v tests/research_logging/test_integrity.py tests/research_logging/test_migration.py
```

Their configuration forces the separate `*_test` database and transactional test maintenance. Do not set `TEST_DATABASE_URL` to the D10 phone database or normal database. No research deletion/correction workflow is authorized by this checklist.

## Conclusions and remaining gaps

**SQLite durability:** Production initialization/open/migration errors reject and can retry; only Jest's explicit test mode uses memory. Queue SQL/file reopen and immutable payload preservation pass against Node SQLite. Actual Expo SQLite termination, journaling/storage exhaustion/native permissions and cold restart are BLOCKED. No durability-before-insertion claim is made.

**Crash windows:** An unfinished presentation is RAM only. A committed frozen payload is also RAM during account verification and the online request before queue insertion; termination can lose it if the backend has not accepted it. If the backend committed before lost acknowledgement and before a queue row existed, server evidence survives but the client has no durable local UUID to replay. Once SQLite insertion completes, process-restart survival still requires native verification. Same-screen save retry is not recovery after process death. No redesign of these boundaries was undertaken.

**Timing/clock:** Local code prefers `nativePerformanceNow`; inspected RN C++ binds it to `HighResTimeStamp`. Deterministic tests cover source/fallback, readiness, interruptions, frozen commitment and exclusion of pending network time. Native frame/interactive timing, actual source label, notification shade, lock and OS suspension/system-clock behavior remain unobserved. Device wall time separately controls D3 leases/backoff and development-scheduler anchoring; clock jumps can affect those operations. No approved pause/subtraction/skew/exclusion policy is invented.

**Sync/idempotency/account isolation:** Real PostgreSQL acceptance/replay/concurrency and Node SQLite recovery/fencing/metadata tests pass. The startup credential-loss and stale-restoration defects were corrected with regression evidence. Original UUIDs, owner-scoped counts/mutations, legacy blocking, D3 error classifications, D4 facts, D5 provenance and D7 backend eligibility remain. Offline cold-start identity stays unverified; online restoration/login is required. This is not proof of native SecureStore restoration or queue drain after OS kill.

**D9 integrity:** Database guards protect original attempt/timing, schedule, ledger/events, coded identity and required relationships; ordinary profile/password paths pass. Event schema remains `review-events-1` with two item-attempt outcomes. No legacy backfill or export/correction/deletion bypass was introduced. Privileged schema-owner intervention remains outside ordinary-operation protection.

**iOS:** No native iOS build, simulator or physical observation was performed. Windows/local Android-target compilation does not establish iOS behavior. A compatible macOS/Xcode or separately configured build path plus a real iOS device remains necessary if iOS is in scope; EAS was not configured or run here.

**Governance:** Retention, withdrawal/right-to-delete, correction/exclusion, export/access/redaction, approved timing/interruption/skew handling, enrollment/consent/assessments, assignments/algorithms and research-build freeze remain unresolved. Automated integration success does not authorize formal participant collection. The scheduler remains development-only.

## Git scope and stop

Only three repository files are changed: `mobile/src/auth/AuthProvider.tsx`, `mobile/src/auth/__tests__/AuthProvider.test.tsx`, and this new note. No backend code/migration, dependency manifest/lockfile, app configuration, generated native directory, queue/timing/scheduling code or finalized D1–D9 note was changed. External lab state is the dedicated seeded database and temporary Android bundle/smoke diagnostics; the normal backend database/environment file was preserved. The smoke backend was stopped, and no native test process/device was started.

Submit this result for independent review as **automated checks passing, D10 overall BLOCKED**. Reproduce D10-AUTH-01 on a phone, execute and evidence the 40 cases, close remaining build/inspection/fault prerequisites, rerun relevant regression after any further correction, and obtain independent D10 review before proceeding to Plan E/F. No commit was made; work stops here without declaring formal research readiness.

## Android emulator / app-owned debug - B01 (2026-10-15, Asia/Manila)

**B01 EMULATOR / APP-OWNED DEBUG: PASS. PHYSICAL ANDROID B01: BLOCKED / NOT RUN. OVERALL D10: BLOCKED.** This is Pixel_9 emulator evidence and does not promote the physical-device matrix. No B02 or later case was run.

The lab package `com.fluentt.d10lab` (debug, version 1.0.0 / code 1) was foreground on `emulator-5554`. The online-approved prompt was **Academic & Research Fundamentals / algorithm**, release `sample-en-v0.1`, Card 1 of 1, with Show Answer enabled. Sanitized screenshots are under `F:\D10N\d10-lab\b01\` (`academic-review-result.png`, `offline-prompt.png`, `revealed-prompt.png`, `after-correct.png`, `final-after-sigcont.png`); the approval record is `approved-prompt.json`.

Only after that prompt was open, Wi-Fi and mobile data were disabled and the airplane-mode setting was set. Android denied the shell broadcast for `ACTION_AIRPLANE_MODE`; this run therefore claims verified API unreachability, not a literal physical network disconnect. Three Android-side TCP probes to `10.0.2.2:8000` failed before the answer. Host `/health/db` remained HTTP 200 and Metro 8082 remained available, so no backend process was stopped. The prompt remained open. Show Answer was tapped once and **Correct** was selected once.

The app reported “Saved on this device. Sync pending,” with **1 total reviewed, 0 synced, 1 pending**. The same completion screen and counts remained after the native snapshot/resume; the app PID stayed 20431 and foreground. A post-answer read-only backend check mapped the API's PostgreSQL socket (local port 60249) to `fluentt_d10_device`, migration `d9c0de000001`. D10_A remained at **6 accepted events, 6 attempts, 6 schedules and 12 research events**; zero accepted events, attempts, schedule updates or research events were created after the approved-prompt timestamp.

Before process termination, PID 20431 was SIGSTOPed as the app UID and observed with Android process state `T<`. The complete `/data/user/0/com.fluentt.d10lab/files/SQLite` directory was tar-streamed while stopped. The same PID received SIGCONT, resumed as `S<`, remained foreground and displayed the pending-sync completion screen. Snapshot: `F:\D10N\d10-lab\snapshots\20261015T104142Z_B01\sqlite-directory.tar`; host copy: `F:\D10N\d10-lab\snapshots\20261015T104142Z_B01\SQLite\fluentt.db`. The captured directory contained `fluentt.db` only; no WAL, SHM or journal was present. The host copy opened read-only and passed `integrity_check=ok`; `pending_review_events` contains exactly one row, status `pending`, attempt count 0, with no failure kind, lease or retry time. Owner mapping is **D10_A**. The payload SHA-256 is `151f3862f2a2748a30e6fa3e7be29d7f68452fa9d4b571068e13b85abe2268fd` (raw payload not emitted).

Payload semantic validation passed: row/payload event ID match; D10_A owner mapping; term and cached lesson match the approved prompt; revision/release provenance matches `sample-en-v0.1`; client and server session IDs are present; answer is Correct; response duration is positive; interaction timestamp and timing-evidence version 1 are present; Android platform and app version 1.0.0 are present. Sanitized results are in `F:\D10N\d10-lab\b01\snapshot-verification.json` and `backend-after-offline.json`; the event UUID and owner UUID are retained only in the local `b01-event-internal.json` for later comparison.

**Preservation:** B01_EVENT remains queued locally for B02. The API/network condition was not restored, no second item was answered, no accepted D10 evidence was changed, and no source, backend, account, or SQLite row was manually edited. No commit or push was made.

## ANDROID EMULATOR / APP-OWNED OFFLINE-CAPABLE DEBUG — B02 (2026-10-15, Asia/Manila)

**B02 EMULATOR / APP-OWNED OFFLINE-CAPABLE DEBUG: PASS. PHYSICAL ANDROID B02: BLOCKED / NOT RUN. OVERALL D10: BLOCKED.** This result applies only to the Pixel_9 emulator and the disposable app-owned package `com.fluentt.d10lab`; it does not promote physical Android or overall D10 status.

The target was Pixel_9 / `emulator-5554`, current Android user 0, package version 1.0.0 / code 1, debuggable, with successful `run-as`. The installed base APK SHA-256 `7e848676214ea0559f250acb746c5345237b2d2a0c190c3f65128b7114f0d0b1` matched the qualified offline artifact. Before the formal stop the app had no process. Airplane mode was enabled, Android reported no active network, the emulator's TCP probe to `10.0.2.2:8000` failed with “Network is unreachable,” Metro 8082 had no listener or reverse rule, and host `/health/db` remained HTTP 200. The backend socket at client port 60249 mapped through `pg_stat_activity` to `fluentt_d10_device`, migration `d9c0de000001`. Read-only D10_A baseline counts were 6 accepted events, 6 attempts, 6 schedules and 12 research events.

`B02_PRE_FORCESTOP_BASELINE` is `F:\D10N\d10-lab\snapshots\20261015T115136386767Z\`. The approved stopped-app helper confirmed `/data/user/0/com.fluentt.d10lab/files/SQLite/fluentt.db`, archived the complete SQLite directory, and opened a host-only copy with `integrity_check=ok`. The directory contained `fluentt.db` only; no WAL, SHM or journal files were present. Archive SHA-256 was `a827c4b1b409f033e2b6fb09ec6e9c3875bda47a9c7896a392864a2d54f8ca19`. Exactly one queue row existed: client event `eed5c1a9-bbe1-4e97-b946-ee03c5e9f259`, owner D10_A, status `pending`, attempt count 0, no failure kind/lease/retry time, and payload SHA-256 `151f3862f2a2748a30e6fa3e7be29d7f68452fa9d4b571068e13b85abe2268fd`. No backend accepted-event or attempt row exists for this UUID. The raw payload was not emitted.

The formal `am force-stop --user 0 com.fluentt.d10lab` completed; no app PID remained and package state showed `stopped=true` for user 0. One real launcher start with `am start -W --user 0 -n com.fluentt.d10lab/.MainActivity` returned `Status: ok`, `LaunchState: COLD`, `TotalTime: 7265 ms`, `WaitTime: 7283 ms`, PID 3923. The rendered UI was the FLUENTT Log in / Sign In screen from the embedded bundle. Filtered ReactNativeJS/AndroidRuntime error logs contained no errors, Metro/script-load failure or crash. The post-launch screenshot is `F:\D10N\d10-lab\snapshots\20261015T115136386767Z\B02_offline_coldstart.png`. No D10_A verified identity, queue count, other-owner data or review eligibility appeared; no review was started or answered.

For the post-restart snapshot, PID 3923 was sent SIGSTOP as the app UID and observed in `T (stopped)`. The complete SQLite directory was archived while frozen, then the same PID received SIGCONT and resumed in `S (sleeping)`. Evidence and the stopped-process archive are under `F:\D10N\d10-lab\snapshots\20261015T115136386767Z\B02_POSTRESTART_CAPTURE\`; its archive SHA-256 matched the baseline. The host copy passed `integrity_check=ok` and again contained one pending row with the same event ID, D10_A owner, payload hash, status, attempt count and operational metadata. A direct SQLite BLOB comparison confirmed the `payload_json` bytes were identical to the pre-force-stop snapshot, preserving the original timing/provenance bytes. No WAL, SHM or journal files were present, and no new queue row was created.

After restart, the emulator remained offline and Metro remained stopped. The backend still mapped to `fluentt_d10_device` / `d9c0de000001`; D10_A counts remained 6 accepted events, 6 attempts, 6 schedules and 12 research events, and B01_EVENT still had zero accepted-event/attempt rows. No new schedule or research event was created. B01_EVENT remains pending for a later authorized B03. No credentials were accessed, no item was answered, no network/API was restored, no B03 or Plan E/F was started, and no commit or push occurred. The original checkout's only change during this formal B02 step was this report; the existing timing-fix files and review bundle remain as before.

## ANDROID EMULATOR / APP-OWNED OFFLINE-CAPABLE DEBUG — B03 (2026-10-15, Asia/Manila)

**B03 EMULATOR / APP-OWNED OFFLINE-CAPABLE DEBUG: PASS. PHYSICAL ANDROID B03: BLOCKED / NOT RUN. OVERALL D10: BLOCKED.** This is Pixel_9 / `emulator-5554`, Android user 0, package `com.fluentt.d10lab` only. No B04 or later case was run.

The B02 offline variant initially rejected login because its custom manifest did not inherit the debug cleartext policy for the lab API at `10.0.2.2:8000`. In disposable `F:\D10N`, the offline manifest was given the same `usesCleartextTraffic=true` setting as the working debug variant; the app was rebuilt and updated in place without clearing data or uninstalling. The installed lab artifact has SHA-256 `5f6ba1c9b4630e13f960650f3cae6ed2707f6d2e82e9bd6059c42d8d6a5f3252`. The participant completed login privately as D10_A and confirmed Home; no credentials or authentication storage were accessed. The original `F:\FLUENTT` source tree was not changed for this lab-only manifest fix.

After connectivity and normal authenticated foreground lifecycle resumed, the existing worker automatically drained the preserved B01_EVENT. Read-only inspection mapped PostgreSQL client port 60249 to `fluentt_d10_device`, migration `d9c0de000001`; the emulator browser GET to `http://10.0.2.2:8000/health/db` displayed `{"status":"ok"}` (capture: `F:\D10N\d10-lab\snapshots\20261015T124040849428Z_B03_POST_DRAIN\emulator-health-db-2.png`). D10_A moved exactly once from 6 to **7 accepted events, 7 attempts, 7 schedules and 14 research events** (7 `REVIEW_ANSWERED`, 7 `REVIEW_SCHEDULED`). B01_EVENT has exactly one accepted ledger row, linked attempt and historical schedule; its current pointer matches, and its two `review-events-1` events each carry only `{"scope":"item_attempt"}`. The scheduler remains `development` / `dev-0.1`, interval 86400 seconds. All compared payload facts, including answer, duration, interaction timestamp, timing evidence, sessions, content provenance, platform and app version, match the B02 bytes; the payload SHA-256 remains `151f3862f2a2748a30e6fa3e7be29d7f68452fa9d4b571068e13b85abe2268fd`.

**B03 raw-payload hash reconciliation (2026-10-15):** The original B01_EVENT was matched by its recorded `client_event_id` in the B01 archive, B02 archive and B03 pre-reconnect archive. SHA-256 was computed over each SQLite `CAST(payload_json AS BLOB)` value before parsing; each was 689 bytes and produced `151f3862f2a2748a30e6fa3e7be29d7f68452fa9d4b571068e13b85abe2268fd`. The three raw payloads are byte-identical and match their saved B01, B02 and B03 evidence. This corrects the prior B03 entry, which stated `151f3862f2a2748a30e6fa3e7be29d7f68452fa9d4b9801a336c0375ad00e7c8`; that value was a reporting typo. No snapshot or backend data was changed. Separately, the parsed original payload matched all 13 compared semantic fields in the accepted backend attempt.

The normal sync worker requires an accepted response with the same client event ID before calling the owner-, `syncing`-status- and lease-fenced acknowledgement delete. After backend acceptance, a force-stopped snapshot of the complete `/data/user/0/com.fluentt.d10lab/files/SQLite` directory opened host-only with `integrity_check=ok` and contained zero queue rows; `fluentt.db` was the only SQLite file, with no WAL/SHM/journal companions. Snapshot and sanitized evidence are in `F:\D10N\d10-lab\snapshots\20261015T124040849428Z_B03_POST_DRAIN\`. One normal 30-second foreground poll after relaunch left all backend counts unchanged. The same package relaunched to `MainActivity`; the participant confirmed Home showed `Synced / 0 pending` after refresh. Metro was restored on 8082 with its emulator reverse rule; `/status` returned `packager-status:running`. Read-only comparison confirms the three original failed A02 rows retain their baseline digest and all three corrected A02 rerun rows match saved evidence (excluding only mutable `is_current` schedule state). The historical B01/B02 snapshot files and report sections still match their recorded hashes. No review was started or answered, no manual sync or POST was issued, and no SQLite data was manually changed. No commit or push was made.
