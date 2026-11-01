# Android bilingual Voice acceptance checklist — Section 7

Prepared 2026-10-30. **Execution status: NOT TESTED on a real Android device.** Automated synthetic checks in `VOICE_BILINGUAL_SECTION7.md` are separate evidence. Do not turn any row into PASS based on mocks, an emulator export, a browser screenshot, or an old benchmark.

Use PASS only when the actual steps and expected observations were recorded; FAIL for an observed deviation; NOT TESTED when not executed, unavailable, or lacking evidence. Record a blocker reason separately rather than inventing a fourth success state.

## Run prerequisites

1. Obtain authorization for the acceptance session, an approved test account, a consenting speaker, and the exact displayed sentence. Do not use research-participant/classroom data as disposable fixtures. Keep evidence restricted and redact names, bearer credentials, private audio locations and spoken personal information.
2. Record date/operator, Android model/OS, FLUENTT build/revision, installed native modules, backend build/endpoint, model revisions, selected language, ordinary personal/class context, and voice engine. Use the existing installed development build if compatible. `expo-audio`/`expo-speech-recognition` require appropriate native modules; a web preview is not native acceptance. Do not rebuild/install or clear app data without separate authorization.
3. Use a dedicated acceptance backend/account, not production. A physical phone's `localhost` means the phone; configure an approved reachable backend address. Production requires HTTPS and correct proxy handling; do not bypass transport/authentication or add insecure credential storage. The local development configuration does not prove production network readiness.
4. Record backend total/available RAM **while the API/client are running**. English cold loading needs at least 5 GiB available; MMS needs at least 8 GiB available at its checks, with import headroom. Keep models sequential and one model-serving API process. **A real MMS run needs separate explicit authorization and safe resources. Section 7 does not authorize one.**
5. For failure cases, use an isolated test backend or controlled test-network failure, not memory pressure tools, changed safety thresholds, damaged caches, or edits to production flags. Model doubles are suitable for automated error-contract tests; label any later device run using them “mock-backed”, not actual inference.
6. Ensure available device voices for English and Tagalog; record whether the voice requires network access. TTS reference audio is synthesized reading, not verified human phonetic gold. Do not redistribute synthesized recordings without provider-specific permission.

Optional workstation precheck (no model inference, repository root):

```powershell
node --test scripts/voice-recorder-privacy.test.cjs scripts/voice-safety.test.cjs scripts/wavlm.test.cjs scripts/native-audio-recorder.test.cjs
npm --prefix apps/mobile run typecheck
```

## Device cases

For every row capture only minimal evidence: case ID, observed screen/error, duration, sanitized request ID/status, and whether a history entry exists. Do not log request bodies or Authorization headers. Restore permissions/network after each fault case.

| ID | Execute on Android | Expected observation | State |
|---|---|---|---|
| A01 | Open Voice; select All, English, Tagalog and a phrase; switch language/back. | List/filter matches; stale phrase/result/recording does not cross language or navigation. English selects WavLM, Tagalog selects MMS. | NOT TESTED |
| A02 | Open model option without ticking consent; try to record. | No recording or upload; consent names the correct processing/saved-output purpose. OS permission is separate from saved-output consent. | NOT TESTED |
| A03 | With consent, tap Record; grant microphone permission when prompted. | Microphone indicator, timer and recording controls agree; capture starts once. Permission request alone does not submit audio. | NOT TESTED |
| A04 | Deny permission; repeat using Android's blocked-permission state on a dedicated test install. | Helpful error/settings guidance; no capture/upload/score; no repeated hidden permission loop. Restore permission manually. | NOT TESTED |
| A05 | Listen to reference in each language, then start recording. | Matching installed voice or explicit missing-voice error; reference playback stops before microphone capture. No scoring of reference playback. | NOT TESTED |
| A06 | On an authorized resource-safe English session, read the exact full sentence and tap Stop and evaluate. | One finished clip/upload; loading state; actual pinned WavLM phone/word/overall feedback, uncertainty disclosure and model provenance. No interim-word grade. | NOT TESTED |
| A07 | On a **separately authorized**, resource-safe MMS session, read the Tagalog reference and Stop and transcribe. | Recognized text/reference differences; null/absent pronunciation number and no phone/stress error claims; saved unscored history. | NOT TESTED |
| A08 | Read different Tagalog words in the authorized MMS session. | Differences described as ASR/text evidence, not verified learner pronunciation errors. No accuracy percentage, even for an exact text match. | NOT TESTED |
| A09 | Record approximately 1–2 seconds of silence under an authorized processing session. | Clear no-usable-speech error, no substitute transcript/score; retry/discard available. Energy detection is not proof that all background noise is speech-free. | NOT TESTED |
| A10 | Stop almost immediately, then make a new normal recording. | Too-short feedback; no successful result/old audio restored; normal retry remains possible. Current client minimum is 0.5 s, but its message recommends at least 1 s. | NOT TESTED |
| A11 | Record through the client limit. | Stop at roughly 29 s (counter displays 30 s limit), no unbounded capture; one final upload only when appropriate. No new request on repeated Stop taps. | NOT TESTED |
| A12 | During recording press Home, lock/unlock, switch app or navigate away. Repeat during pending permission. | Capture/playback stops with lifecycle; return requires deliberate fresh action/consent state; stale callbacks cannot submit/restore a departed take. Inspect microphone indicator and cache. | NOT TESTED |
| A13 | Interrupt with an incoming call/audio-focus change or unplug a microphone/headset. | Graceful stop/error, no silent background recording, no fabricated result; recording can be deliberately restarted. | NOT TESTED |
| A14 | Disconnect network before submit on the dedicated test session. | Connection error; no fake score or automatic retry. Retained local take can be retried/discarded; backend outcome remains unconfirmed where appropriate. | NOT TESTED |
| A15 | Lose connectivity after upload may have reached the backend; restore it; Retry original request and refresh history. | Same request UUID/audio; at most one completed result; history reconciles a committed-but-lost reply. No duplicate attempt from automatic retries. | NOT TESTED |
| A16 | Use an approved unreachable/stopped acceptance backend. | Useful connection/backend error; local practice remains available; no stale protected result represented as new success. | NOT TESTED |
| A17 | Acceptance backend reports model disabled/missing/invalid artifacts. | Model-unavailable state/recheck or failed submission; no fallback engine/number. Do not corrupt actual caches to trigger this case. | NOT TESTED |
| A18 | Acceptance backend safely reports MMS insufficient available RAM. | Unavailable UI explains **8 GiB available**, no cold-load subprocess; local practice/recheck works. Never force a real load or exhaust RAM to test this. | NOT TESTED |
| A19 | Submit while another permitted assessment is running, or use a controlled busy response. | Retryable busy state; no simultaneous large-model load; no invented result. Mark mock-backed evidence separately. | NOT TESTED |
| A20 | Refresh model-specific history, leave/reopen, retry then discard. | Correct authenticated language/context history; stale/legacy ratings masked; no deleted-history claim and no inferred improvement/mastery. | NOT TESTED |
| A21 | Let the test account session expire/revoke on the acceptance backend; return to Voice. | Protected state cleared/gated; no late result exposed to another session; no credential printed or restored by username. | NOT TESTED |
| A22 | With explicit approved ordinary-class fixtures, save to a chosen class; then test removal/revocation. | Context chosen deliberately; backend revalidates membership/owner. No research classroom scoring or permissions inferred from the selected class. | NOT TESTED |
| A23 | After success, failure, discard and leaving, inspect only this app's test cache and this session's backend temp artifacts. | Owned temporary recordings removed on normal cleanup; no new legacy durable recordings. Record native deletion failures/crash remnants as failures/limitations, not guaranteed erasure. Do not delete historical files or unrelated temp directories. | NOT TESTED |
| A24 | Enable TalkBack; navigate filters, consent, Record/Stop, loading, errors, results and history. Increase text size; use switch/keyboard navigation where available. | Correct names/roles/selection/disabled announcements, sensible order, readable contrast/size, focus and status/error announcements. Missing tab selection announcements are a known acceptance gap. | NOT TESTED |
| A25 | In demo/local record-and-play mode, repeat each language without a live engine. | Playback/word recognition only as labeled; no fabricated transcript, confidence or pronunciation number. Online browser-provider behavior, if tested on web separately, requires its separate permission. | NOT TESTED |

## Evidence record and exit

Copy once per run (keep identifying evidence in approved restricted storage):

```text
Run ID / date / operator:
Device model / Android / app build:
Backend revision / deployment mode:
Language / model revision / total and available RAM:
Speaker consent and authorized account confirmed (yes/no; no identity here):
Case ID / PASS | FAIL | NOT TESTED:
Observed behavior / sanitized evidence reference:
Mock-backed or genuine model-backed (or neither):
Cleanup confirmed / known remnants / follow-up:
```

Do not mark real-model cases PASS from synthetic fixtures. If MMS lacks authorization/resources, keep A07/A08 and related genuine-inference cases NOT TESTED and document the blocker; other safe cases may proceed. Any Tagalog pronunciation number, simulated result presented as real, unauthorized data access, unexpected audio retention or continuing microphone capture is an acceptance failure. Stop that case and preserve minimal evidence without collecting more private speech.

Before production: close relevant failures, complete missing device checks, approve privacy/rights/deployment choices, and obtain resource-safe real-model acceptance separately. This checklist authorizes no deployment, retention/deletion policy or new model run.
