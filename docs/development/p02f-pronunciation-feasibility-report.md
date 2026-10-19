# P02F Pronunciation Feasibility Report

## 1. Scope

Bounded prerequisite/runtime feasibility check on **2026-10-16, Asia/Manila**; final device check at approximately 20:47 +08:00. Authoritative inputs: [P02 specification](p02-pronunciation-architecture-scoring-spec.md) and [P01 audit](p01-pronunciation-preimplementation-audit.md).

**Result: P02F BLOCKED.** One physical USB Android target remains unauthorized; no emulator is connected. ffmpeg/ffprobe are unavailable through PATH and the checked standard locations. Suitable Azure Speech configuration was absent from the checked process/user/machine environments and backend dotenv convention. No capture/conversion/provider result was produced.

This is runtime evidence of prerequisites, not pronunciation implementation. No gate is marked PASS from documentation. The task stopped at the stated prerequisite stop conditions rather than changing FLUENTT or substituting another engine/interface. No production route, models, migrations, dependencies, credentials, scheduler/review code, manuscript or existing evidence was modified. No commit/push.

## 2. Repository Protection

Baseline and final branch: `main`. Baseline and final HEAD:

```text
4135cd7334acbdb1b97fc1a8843eaf03cdddd353
```

Baseline status contained only these five untracked artifacts:

```text
?? docs/development/d10-timing-fix-review-bundle.txt
?? docs/development/d11-esr-preimplementation-audit.md
?? docs/development/d11a-scheduler-contracts-spec.md
?? docs/development/p01-pronunciation-preimplementation-audit.md
?? docs/development/p02-pronunciation-architecture-scoring-spec.md
```

Baseline and final `git diff --check`, tracked comparison against HEAD and staged comparison all exited 0. Final SHA-256 checks matched all five baseline values below. The only added repository artifact is this untracked report.

Protected-file SHA-256 baseline values (rechecked before completion):

| File | SHA-256 |
| --- | --- |
| `d10-timing-fix-review-bundle.txt` | `52d8bcbdac46b294828c2c687401eb577f5714630de2e9de26f809b448a787c2` |
| `d11-esr-preimplementation-audit.md` | `85e101ca11b799a8f0c2965d546571ffbceb3f80d90aba3e6cdaf510288b5c26` |
| `d11a-scheduler-contracts-spec.md` | `5e4f3869fde26b4cc2fda7ab3a097c1005e4cfef89695f2b8c8413550907e1b9` |
| `p01-pronunciation-preimplementation-audit.md` | `e0ad69a496f828fb788b182e23b063e12989b7b13b531f331a85b5c66e9a75c0` |
| `p02-pronunciation-architecture-scoring-spec.md` | `89554623a1eb8712cac3905da8d350606a8da026855bdd15cbded4b34c44011b` |

Paths are relative to `docs/development`. All five existing artifacts remain byte-identical. No tracked/staged changes were present to clean/reset.

## 3. Environment

Actual local checks, without installation or dependency declaration changes:

| Component | Observed availability/version | Qualification |
| --- | --- | --- |
| Node | `v22.18.0` | Executed successfully. |
| pnpm | `11.25.0` | Executed successfully. |
| npx | Direct installed launcher reports `10.9.3` | PATH-resolved launcher failed with a missing `npx-cli.js` under the roaming npm location. Direct invocation through Node of `C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js --version` succeeded. No launcher repair/install. |
| Java | `23.0.2`, 64-bit | Default Java runs. This is availability evidence, not proof of compatibility with a future native probe build. |
| adb | `1.0.41`, platform-tools `37.0.1-15733141` | Executable at `F:\SDK\platform-tools\adb.exe`; version/devices checks succeeded. The ordinary adb daemon started when queried. |
| Android SDK | Existing root `F:\SDK` | Platforms `android-36`, `android-37.0`; build-tools `35.0.0`, `36.0.0`, `37.0.0`. These are installed SDK packages, not a connected device's Android API. |
| Android emulator executable | `37.1.11.0`, build `15917651` | Version command succeeded; no running emulator appeared in adb. None was launched. |
| Python on PATH | Not resolved | Does not mean backend Python is missing. |
| Backend Python | **`3.13.15`** | Executed the existing backend virtual environment's interpreter with isolated/no-bytecode flags. Initial sandboxed uv trampoline invocation failed with OS permission error; the read-only version/import check succeeded outside that restriction. No application was imported or database accessed. |
| uv | `0.12.17` | Executed successfully. |
| httpx | **`0.28.1`** | Actual import/version check succeeded in backend Python, not merely lockfile inference. Its existing development dependency status is unchanged. |
| ffmpeg | Not resolved | `Get-Command` and `where.exe` found none; checked standard `C:\ffmpeg\bin` / `F:\ffmpeg\bin` executable candidates were absent; Chocolatey ffmpeg directory absent. No version command could run. |
| ffprobe | Not resolved | Same PATH/standard-directory checks found none; no version command could run. |

`ANDROID_HOME` is present and points to the existing SDK used above; `ANDROID_SDK_ROOT` is absent. Full environment values were not dumped. No exhaustive whole-disk search is claimed: an already installed converter at another approved path can be supplied for a resumed probe.

Expo package inspection resolved `expo@57.0.24` and `react-native@0.86.3` in the original mobile workspace and existing disposable D10 native lab. Neither resolves `expo-audio`; both local pnpm package directories contain zero `expo-audio@...` entries. The installed Expo bundled-native-module map identifies compatible audio range `~57.0.5`. This is package/configuration evidence only, not recording evidence. Network package installation/resolution was not attempted after the stop conditions; absence locally does not prove the package cannot be fetched later.

## 4. Android Device Status

`adb devices -l` and a second sanitized classification check observed:

| Target class | Count | State | Usable for capture? |
| --- | --- | --- | --- |
| Physical USB Android | 1 | `unauthorized` on both checks | No. User authorization on the device is required. |
| Emulator | 0 | None connected | No emulator evidence generated. |

The device serial is intentionally omitted. Device model, Android release/API and microphone capability were not queried through an unauthorized target or inferred from installed SDK platforms. No physical/emulator target was used to capture audio, install/launch a probe or exercise the existing lab app. Existing app data/authentication and accepted D10 evidence were untouched.

**Gate 1 is BLOCKED:** actual functioning capture on the authorized adviser Android device has not been demonstrated. There is no emulator-only result to classify as preliminary success.

## 5. Azure Configuration Availability

Existing convention inspected first: `backend/app/core/config.py::Settings` reads `.env` for current application/database/auth settings and has no speech-specific settings. Presence-only checks covered these known Azure/Speech names across process, user and machine environments, plus the repository/backend `.env` convention. Only booleans were emitted; no values, fragments or headers were printed or stored.

```text
AZURE_SPEECH_KEY_PRESENT=false
AZURE_SPEECH_ENDPOINT_PRESENT=false
AZURE_SPEECH_REGION_PRESENT=false
```

Equivalent `SPEECH_KEY`, `SPEECH_ENDPOINT`, `SPEECH_REGION` aliases were also absent. Backend/root dotenv presence checks for those Azure/Speech names were false. This is scoped to the checked conventions; it does not claim that no external Azure account exists.

**Gates 5-7 are BLOCKED:** no usable configured test credential/resource endpoint was available. No Azure request, token exchange, credential setup, paid call, redirect or automatic retry occurred. No key was invented, requested in chat or written to a script/file.

## 6. Capture Probe

No disposable Expo probe was created, installed or started. Actual package inspection is recorded in section 3; the next native capture step was stopped because the only physical target was unauthorized, with converter/provider prerequisites also blocked. No attempt to modify FLUENTT manifests, reuse an unverified recorder, substitute expo-av or spend time on an unusable native build was made.

There is **no recording handoff ready**. The user was not asked to record before a controllable probe existed. No microphone permission/capture was triggered, silently or otherwise. No temporary source clip, local recording URI or permanent audio artifact exists from P02F.

After prerequisites are restored, a separately resumed disposable probe must implement the locked foreground controls/profile and release/cleanup behavior outside tracked FLUENTT source. Only when that probe is ready should the human be instructed to record their own short development clip saying the exact intended term, such as `hello`, and return control. That recording/provider step has not occurred here.

## 7. Captured Audio Evidence

**Gate 2: NOT RUN.** There is no actual source file to inspect.

| Required fact | Observed value |
| --- | --- |
| Container / codec | Not measured |
| Sample rate / channels | Not measured |
| Duration / bitrate | Not measured |
| File bytes | Not measured |
| <=262144-byte audio limit | Not tested |
| Self-contained M4A/AAC | Not proved |

The P02 requested M4A/AAC, 44100-Hz, two-channel, 128000-bit/s, <=10-second profile remains a target configuration, not an observed file. No audio was generated synthetically or taken from another person/participant to fill this gap. No bound was loosened.

## 8. Conversion Evidence

**Gate 3: BLOCKED. Gate 4: BLOCKED.** Neither ffmpeg nor ffprobe was available through the checked execution paths, and no captured source exists. No converter was installed/downloaded automatically; no renaming, alternate engine, truncation, loudness processing or fabricated WAV was used.

Independent canonical verification with both ffprobe and Python `wave` is unperformed. RIFF/WAVE validity, channels, sample width, sample rate, frame count, PCM bytes, duration and output bytes are all **not measured**. The frame requirement `1 <= frame_count <= 160000` remains unchanged. Python/httpx availability does not establish audio conversion.

## 9. Azure REST Evidence

**Gates 5/6: BLOCKED.** There is no verified canonical WAV, authorized user development clip or usable Azure test configuration. Zero provider requests were made.

No HTTP status, acceptance, AccuracyScore, secondary metric or provider-call time is available. The locked REST route/configuration was not tested against a live resource. No Speech SDK, other provider, transcript similarity, LLM, mock response or hard-coded Azure JSON was substituted.

## 10. Response Structure Evidence

**Gate 7: BLOCKED.** No real Azure response exists. These facts remain unobserved:

- RecognitionStatus, NBest length and `NBest[0].AccuracyScore` presence/type/value.
- Optional PronScore, CompletenessScore and FluencyScore.
- Ordered word count/labels/AccuracyScore/ErrorType.
- Ordered phoneme labels/AccuracyScore under the expected REST adapter layout.

No raw response or provider request ID was saved. No schema mismatch is claimed because there was no request/response to compare. Successful parsing from documentation alone is not runtime evidence.

The real-score category sanity check is **NOT RUN**, because there is no real score input. The approved rubric is unchanged; NoMatch, InitialSilenceTimeout, BabbleTimeout and provider failures must not become D. No test outcome was persisted as research data or proficiency.

## 11. Cleanup Evidence

**Gate 8: NOT RUN.** No disposable capture app, raw audio, WAV, converter workspace, provider JSON dump or credential-bearing temporary file was created by this task. There was therefore no source/WAV copy or mobile recording to delete. No temporary probe remains for manual use.

This absence is not a passing cleanup test: file-handle closure, normal-path audio deletion and crash/expiry recovery still require a real controlled clip/workspace. Do not claim forensic secure erasure or infer cleanup capability from creating no audio.

Only the requested repository report persists. Existing D10 lab and repository dependencies/configuration were not changed. Runtime version checks used no-bytecode Python and in-memory shell/JavaScript checks; no feasibility script containing credentials/audio was saved.

## 12. Latency Evidence

**Gate 9: NOT RUN.** T0 record finalization through T5 validated real result were not reached. Capture finalization, source readiness, conversion duration, provider duration, parse duration and stop-to-result time are all **not measured**.

Local version-check durations are not speech performance. No UX acceptance target/result is invented. On a resumed real execution, report monotonic stage durations; without prior human acceptance of an observed end-to-end duration, classify that latency gate PARTIAL pending acceptance rather than automatically PASS.

## 13. Gate Matrix

| Gate | Status | Actual evidence / remaining requirement |
| --- | --- | --- |
| Gate 1 — Android capture | **BLOCKED** | Physical USB target remains unauthorized; no connected emulator or actual recording. |
| Gate 2 — M4A/AAC proof | **NOT RUN** | No source file captured; extension/profile documentation is insufficient. |
| Gate 3 — ffmpeg/ffprobe | **BLOCKED** | Both unavailable on PATH/checked standard executable locations; no installation. |
| Gate 4 — canonical WAV | **BLOCKED** | Missing converter and actual source; no ffprobe + wave verification. |
| Gate 5 — Azure acceptance | **BLOCKED** | No suitable checked test configuration/verified WAV; no request sent. |
| Gate 6 — real AccuracyScore | **BLOCKED** | No live assessment response; no numeric result fabricated. |
| Gate 7 — word/phoneme evidence | **BLOCKED** | No live ordered response structure; no adapter workaround. |
| Gate 8 — cleanup | **NOT RUN** | No audio/temp processing assets created; actual deletion/crash tests absent. |
| Gate 9 — latency | **NOT RUN** | No stop-to-result execution or measured speech latency. |

No gate has runtime evidence sufficient for PASS. These blocked/not-run statuses are intentional; prerequisite inspection is not a substitute for the P02 gate.

## 14. Blockers

Required actions before a useful resumed capture/conversion/provider probe:

1. **Authorize the physical Android device:** unlock it, allow USB debugging for this computer and verify adb reports `device`, not `unauthorized`. Reconnect/check the debugging prompt if necessary. Do not send device credentials or record audio yet. Model/Android API can then be inspected safely.
2. **Make ffmpeg and ffprobe available:** supply approved installed executable paths if they already exist elsewhere, or arrange a separately authorized installation. P02F did not install them and does not claim whole-disk absence. Verify both version commands before conversion.
3. **Provide private development/test Azure Speech configuration:** make a suitable key plus approved endpoint/region available through the approved execution environment. Do not paste secrets into chat, scripts, the report or tracked files; no production configuration is needed. Presence/connectivity alone will not prove assessment output.
4. **Then prepare the disposable Expo audio probe:** fetch/resolve compatible packages outside FLUENTT, bound build effort and establish controlled temporary audio cleanup. The working direct npx launcher is an available alternative to the broken PATH wrapper; no original-project changes are needed merely to repair the wrapper.

After the probe is actually ready, stop for the human's own intentional temporary recording, then resume measured inspection/conversion and a single authorized Azure request with matching target. Keep the original P02 limits and strict adapter schema. Any rejection/mismatch/absent phoneme evidence requires an explicit revised decision, not improvisation.

## 15. Recommendation

**P02F BLOCKED — physical Android unauthorized; ffmpeg/ffprobe unavailable; Azure test configuration absent.**

Resolve these prerequisites, then resume the bounded gate. Do not proceed to production P03/P04 implementation based on the current evidence. Backend Python/httpx and SDK tooling availability are useful confirmed prerequisites, but no physical capture, real audio format, canonical WAV, Azure metric/phoneme structure, cleanup behavior or end-to-end latency has been proved.

Final verification confirmed the expected branch/HEAD, empty tracked/staged diffs, unchanged protected SHA-256 values, passing `git diff --check`, all 15 required report sections and all nine explicitly classified gates. Actual final status:

```text
?? docs/development/d10-timing-fix-review-bundle.txt
?? docs/development/d11-esr-preimplementation-audit.md
?? docs/development/d11a-scheduler-contracts-spec.md
?? docs/development/p01-pronunciation-preimplementation-audit.md
?? docs/development/p02-pronunciation-architecture-scoring-spec.md
?? docs/development/p02f-pronunciation-feasibility-report.md
```

Only this report is created; no application feature, dependency/configuration, migration or accepted research evidence changes. No commit or push.
