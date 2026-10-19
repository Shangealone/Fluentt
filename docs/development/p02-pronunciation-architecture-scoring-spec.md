# P02 Pronunciation Architecture, Scoring & Feedback Specification

## 1. Scope and Status

**LOCKED — Specification only, 2026-10-16, Asia/Manila.** This specification defines the pronunciation vertical slice for the October 21, 2026 adviser build. It authorizes no source edit, installation, migration, credential configuration, provider request, audio recording/upload, manuscript edit, commit or push. Runtime feasibility remains unverified; specification readiness is not feature completion or formal-research approval.

**CONFIRMED — Baseline:** `F:\FLUENTT`, branch `main`, HEAD `4135cd7334acbdb1b97fc1a8843eaf03cdddd353`. Initial status contains only these untracked artifacts: D10 timing review bundle, D11 preimplementation audit, D11A scheduler contracts specification and P01 pronunciation audit. Preserve all four byte-for-byte. Create only this fifth untracked document.

The approved [P01 audit](p01-pronunciation-preimplementation-audit.md) establishes that capture, speech upload/processing, scoring and pronunciation persistence do not exist. Existing reuse boundaries are authenticated FastAPI access, immutable released English vocabulary, UI/localization conventions and PostgreSQL infrastructure. This document supersedes P01's then-unresolved provider, target, metric and rubric decisions through the user's explicit P02 choices; P01 remains historical and unchanged.

**LOCKED:** pronunciation does not affect review correctness, scheduling/assignment, interval, memory, current pointer or `response_time_ms`. Existing D1-D10 contracts/evidence and the D11A scheduler specification remain intact. P0 uses real provider-derived measurements, never mock/hard-coded learner results or an LLM-generated score.

## 2. Provider / Assessment Architecture

**LOCKED — Select Microsoft Azure Speech Pronunciation Assessment, scripted reading, via backend short-audio REST.** Mobile talks only to FLUENTT FastAPI. The backend converts the uploaded M4A/AAC to canonical PCM WAV, invokes Azure, validates/adapts the response and persists an application-owned derived result.

```text
Expo foreground recorder -> authenticated FastAPI multipart
  -> bounded private temporary M4A -> verified ffmpeg conversion
  -> verified 16-kHz / 16-bit / mono PCM WAV
  -> Azure short-audio REST pronunciation assessment
  -> strict FLUENTT adapter -> derived PostgreSQL result -> feedback
  -> raw/intermediate cleanup on all completion paths
```

REST is selected over the native Speech SDK for this bounded, at-most-ten-second P0 request: it supports the required assessment parameters and avoids adding SDK native-runtime/GStreamer requirements to the current Python 3.13 backend. The converter remains a separate native prerequisite. This is a design judgment, not a measured latency claim. Azure documents narrower REST audio support and final-only responses; those fit this flow. [Short-audio REST contract](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short).

**LOCKED — Integration identities:**

| Identity | Exact value |
| --- | --- |
| Provider | `azure_speech_pronunciation` |
| Provider configuration | `azure-pa-en-us-term-v1` |
| Backend adapter | `azure-short-rest-adapter-v1` |
| Normalized response schema | `pronunciation-result-v1` |
| Capture profile | `expo57-term-m4a-v1` |
| Conversion profile | `ffmpeg-pcm16k-mono-v1` |
| Category policy | `pronunciation-category-v1` |
| Feedback policy | `pronunciation-feedback-v1` |

Future backend HTTP transport: promote the already locked `httpx==0.28.1` from development-only availability to an explicitly declared runtime dependency during authorized P04 work; verify that pin on Python 3.13. No SDK dependency is selected. Package/config changes do not occur in P02. A feasibility failure requires architecture review, not a silent switch to SDK, transcript matching or invented scores.

The implementation must add its own pronunciation service/router; `backend/app/main.py` currently has none. `backend/app/research_logging/service.py` remains the narrow canonical review-event service, not a pronunciation logger.

## 3. Target and Locale Contract

**LOCKED:** one exact released English vocabulary **term**, `target_kind = "term"`, locale `en-US`. Example-sentence reading, arbitrary client reference text, free speech and client locale/provider selection are outside P0.

The server resolves `(content_release_id, vocabulary_item_id, content_revision_id)` through immutable `ContentRelease` / `VocabularyRevision` and `content/provenance.py::resolve_review_content`. Additionally require release language `en` with consistent immutable manifest language, valid released membership and a nonempty supported term. Reference text is the exact `VocabularyRevision.term`, not the mutable item, translation, example sentence, route label or upload filename. A vocabulary term can contain multiple lexical tokens; it is still one content target, not permission to submit a sentence or arbitrary text.

Reject absent/wrong provenance or non-English content before provider dispatch. The existing resolver proves content membership, not learner enrollment or pronunciation consent; the pronunciation service separately enforces authenticated ownership and deployment access. Pronunciation does not resolve an ESR condition. UI language `en`/`fil` only controls instructions; it cannot change the assessment locale.

For target-evidence matching only, define a deterministic token function: Unicode NFKC, casefold, normalize typographic apostrophes to ASCII apostrophe; split into maximal Unicode letter/number runs, allowing an apostrophe only between letters. Hyphens/other punctuation/whitespace are separators. Apply the same function to term and provider word labels. This function never changes the exact `ReferenceText` sent to Azure. Empty token output is an unsupported target. Matching is exact after this rule; no fuzzy/LLM similarity, phonetic guess or language detection is introduced.

The feasibility test must confirm this rule and provider word alignment on the actual approved P0 terms, including any contractions or multi-token terms. Unsupported tokenization/alignment is a target-evidence limitation requiring review, not permission to fabricate a match or alter published content. No IPA/reference recording is invented.

## 4. Audio Capture Contract

**LOCKED — Future native module:** Expo-SDK-57-compatible `expo-audio`, installed only in later authorized work using the SDK-compatible installer. Explicitly configure the native profile `expo57-term-m4a-v1`: M4A container/AAC, requested sample rate 44,100 Hz, two channels and bitrate 128,000 bit/s, app-private cache. These follow the SDK 57 high-quality native profile; they are not current FLUENTT functionality or proof every device honors requested settings. Verify actual output in section 18. [SDK 57 recorder documentation](https://docs.expo.dev/versions/v57.0.0/sdk/audio/).

Foreground recording only; disable background recording/playback capabilities for this activity. Configure Android microphone permission and iOS purpose text later through app configuration/plugins, never by hand-adding generated native projects. The adviser gate is the actual Android device/build. No iOS/web parity is inferred. Optional playback must not delay the core slice or retain extra copies.

**LOCKED — Exact UI states and principal transitions:**

| State | Behavior / transitions |
| --- | --- |
| `idle` | Load authoritative released target and permission status; no active microphone. |
| `permission_required` | Record action requests OS permission explicitly; grant -> `ready`, denial stays corrective with settings guidance. Grant alone does not automatically begin capture. |
| `ready` | Record starts a new foreground capture -> `recording`. |
| `recording` | Show active indicator/duration; Stop -> finalize -> `recorded`; Cancel -> stop/release/delete -> `ready`. |
| `recorded` | Display captured duration; submit automatically once finalization succeeds and owner/target are unchanged -> `uploading`; Cancel discards; Try Again discards and returns `ready`. |
| `uploading` | One guarded request; Stop/Record disabled. Cancel/navigation aborts local transport and removes local raw copy after handles close; it does not promise server rollback. |
| `processing` | Await/reconcile the owned attempt, no microphone; no second submit/provider call. |
| `scored` | Real primary score/category/general feedback; supported issue details only; Try Again -> fresh capture lifecycle. |
| `unscorable` | Corrective message, no numeric performance/category; Try Again -> fresh capture. |
| `error` | Safe corrective/service/auth message and permitted recovery; no manufactured score. |

Required controls: Record, Stop, Cancel, Try Again. Disable inappropriate controls by state. Permission permanently denied must not loop the OS prompt. Stop releases capture before any processing; leaving/unmounting/backgrounding the activity stops/releases it and prevents late updates from another target/owner. A generation/attempt guard must fence asynchronous completions.

**LOCKED — Maximum recording duration: 10 seconds.** Use native duration-limited recording plus visible status; a JavaScript timer alone is insufficient. SDK 57 documents `record({ forDuration: seconds })`; prove behavior on the target device. No pause/resume or concatenation in P0. Backend decoded-sample validation remains authoritative; there is no hidden duration tolerance, silence trimming, speed change or truncation to make an oversized recording pass.

After Stop successfully finalizes the file, freeze `original_interaction_at` as that finalization UTC instant, a fresh `client_pronunciation_attempt_id`, original owner, target IDs and capture profile. Freeze before upload/authentication awaits. Ordinary rerenders/GET polling retain that identity and timestamp. These are pronunciation facts, independent of the review timing hook and `response_time_ms`. A fresh Try Again/recording gets a new ID, including after an unscorable/service-failed attempt.

## 5. Audio Transport / Conversion Contract

**LOCKED — Future application endpoints:**

```text
POST /pronunciation/attempts
  authenticated multipart/form-data; exactly two parts:
    metadata: application/json UTF-8 text, maximum 4096 bytes
    audio: one bounded M4A file

GET /pronunciation/attempts/by-client/{client_pronunciation_attempt_id}
  authenticated owner-scoped reconciliation; never dispatches Azure
```

Exact metadata keys, all required, extra keys forbidden:

```text
client_pronunciation_attempt_id: UUID
content_release_id: UUID
vocabulary_item_id: UUID
content_revision_id: UUID
original_interaction_at: aware timestamp (normalized UTC)
capture_profile_version: literal "expo57-term-m4a-v1"
device_platform: literal "android" for the initial adviser lane
application_version: nonempty string, maximum 32 characters
```

There is no owner, target text, score, condition, reference audio, provider configuration or locale input. Authentication supplies the owner. Reject duplicate/unexpected multipart fields and non-UUID/naive timestamp metadata. Appending metadata JSON to a multipart part is deliberate; it is not an ordinary JSON body alongside `UploadFile`. Future `python-multipart` is needed, not installed here. Framework upload spooling itself can write raw temporary bytes. [FastAPI upload behavior](https://fastapi.tiangolo.com/tutorial/request-files/).

**LOCKED — Calculated bounds, not guessed sizes:**

```text
Selected nominal AAC profile: 128000 bits/s, at most 10 s
Nominal audio bytes = 128000 * 10 / 8 = 160000
50% bitrate variability margin = 80000
Container allowance = 16384
Calculated requirement = 256384 bytes
Round upward to 256 KiB = 262144 bytes: maximum audio part

Multipart metadata/framing allowance = 16384 bytes
Maximum entire multipart body = 278528 bytes (272 KiB)
Metadata content itself remains limited to 4096 bytes.
```

The margin is a conservative transport allowance, not a claim AAC has a guaranteed maximum bitrate. Gate tests must measure actual device files at/near the duration ceiling and confirm these bounds; if the selected profile exceeds them, stop and review the profile/limit together. Never silently accept a higher bitrate/longer recording as if already verified. Reject empty input. Enforce actual streamed byte counts even without/trusting `Content-Length`, before unbounded parsing/spooling; enforce per-part limits too. No durable offline speech queue, background upload or binary/base64 use of D3 review storage.

Allow declared native audio MIME `audio/mp4`, `audio/m4a` or `audio/x-m4a` with an M4A upload, but never trust MIME/extension as proof. Generated private server filenames replace client filenames. Inspect actual container/streams with bounded ffprobe, then require successful decode. Require an MP4/M4A audio container, exactly one AAC audio stream and no video/other media stream; record actual sample rate/channels internally for gate evidence. Reject encrypted, external-reference, playlist and unsupported input. No URL/path may come from a client field.

**LOCKED — Converter candidate selected for feasibility:** server-side `ffmpeg` plus `ffprobe`, absolute configured executable paths, fixed argument arrays, no shell and no client-controlled flags/filters. Future verified conversion profile, conceptually:

```text
ffmpeg -nostdin -hide_banner -loglevel error
  -protocol_whitelist file -f mov -enable_drefs 0 -use_absolute_path 0
  -i <generated-private-upload-path>
  -map 0:a:0 -vn -sn -dn -map_metadata -1 -map_chapters -1
  -ac 1 -ar 16000 -c:a pcm_s16le
  -t 11 -f wav -n <generated-private-output-path>
```

The **11-second decode guard is a rejection sentinel, never an accepted recording length**: accepted canonical PCM must contain 1..160000 mono samples (at most 10 s). If decoding yields >160000 samples, reject; do not clip to ten seconds and assess it. An input longer than ten seconds must not become a valid attempt by `-t`. Require a positive finite probed source duration <=10 seconds as well as the decoded frame bound; neither check overrides the other, and missing/invalid duration fails closed. No numeric discrepancy tolerance is introduced. Native encoder padding that breaks the limit is a feasibility problem to resolve in capture, not an invented backend tolerance.

After conversion independently verify RIFF/WAVE PCM, 16,000 Hz, 16-bit signed little-endian, mono, nonempty frames and the frame ceiling (for example, using the standard-library WAV reader plus checked counts). Accepted PCM payload is <=320000 bytes; allow up to 4096 bytes of container overhead, maximum canonical WAV 324096 bytes. The eleven-second rejection sentinel permits at most 352000 PCM bytes plus 4096 overhead during conversion; enforce a 356096-byte temporary output cap. Do not merely rename `.m4a` to `.wav`. Do not normalize loudness/remove pauses or otherwise change the measured performance beyond decode/downmix/resample/encoding.

The argument profile is an application proposal that must work with the selected ffmpeg build. Both probe and converter must keep MOV external-track loading and absolute external paths disabled (`enable_drefs=0`, `use_absolute_path=0`); explicitly apply the same input restrictions to the probe. Protocol restriction alone is not a decoder sandbox: verify self-contained media, run with least privilege and no outbound decoder access, restrict resource/output size and kill/wait for the child on wall timeout. Cap diagnostic capture to sanitized operational data; do not persist raw stderr/media metadata. External process deadlines must be wall-clock deadlines; ffmpeg CPU-time options alone are insufficient. Record verified ffmpeg build/version and conversion profile. [FFmpeg options](https://ffmpeg.org/ffmpeg.html), [MOV input controls](https://ffmpeg.org/ffmpeg-formats.html), [protocol controls](https://ffmpeg.org/ffmpeg-protocols.html), [ffprobe structured inspection](https://ffmpeg.org/ffprobe.html).

**LOCKED — P0 operational budgets (not research-quality thresholds or latency guarantees):** upload body deadline 10 s; each probe <=2 s; conversion <=5 s; Azure absolute total request deadline 20 s; backend processing absolute deadline 40 s after receiving the complete bounded body; mobile overall submit/reconciliation network deadline 60 s per foreground operation. These are ceilings; actual acceptable demonstration latency must pass section 18. No call holds a database transaction through conversion/network waits. Bound concurrency to one in-flight pronunciation attempt per owner and two active conversions/provider jobs per backend instance; reject capacity exhaustion as retryable 503 before dispatch. Database claims still prevent cross-instance duplicate dispatch.

Shared `mobile/src/api/client.ts` currently forces JSON headers and refresh-replays requests. Future audio transport must reuse its owner/auth safety while explicitly supporting multipart-generated boundaries, rebuildable body/URI and cancellation/deadlines. A transport retry must reconcile the original pronunciation ID first. Do not change existing review JSON behavior or blindly replay a consumed audio body after token refresh. No upload work survives as an offline queue.

## 6. Provider Configuration

**LOCKED — Backend-only REST request:** use the approved Speech resource's configured HTTPS endpoint, documented route `/stt/speech/recognition/conversation/cognitiveservices/v1`, query `language=en-US&format=detailed`. No client endpoint, redirects or unapproved host. Record the actual approved resource region privately in deployment provenance. The endpoint/service setting is not configured during P02.

Send the complete verified WAV as a bounded binary POST body (not multipart to Azure), with `Content-Type: audio/wav; codecs=audio/pcm; samplerate=16000`, `Accept: application/json`, and server-only `Ocp-Apim-Subscription-Key`. Use a known content length; chunked streaming is optional and not needed for this bounded P0 file. TLS certificate validation stays enabled. No key/query/header/provider token is returned to mobile or placed in logs. Azure HTTP 401/403 must not become FLUENTT learner-auth 401/403.

`Pronunciation-Assessment` is base64 of UTF-8 JSON built with a real JSON serializer, containing these exact typed semantic fields:

```json
{
  "ReferenceText": "<exact server-resolved immutable term>",
  "GradingSystem": "HundredMark",
  "Granularity": "Phoneme",
  "Dimension": "Comprehensive",
  "EnableMiscue": true,
  "EnableProsodyAssessment": false
}
```

The angle-bracket value describes per-request server substitution, not literal text to send. No `ScenarioId`, custom grading, unscripted mode, optimizer, LLM, prosody or spoken-phoneme candidate configuration is enabled. This static configuration excluding per-request ReferenceText is `azure-pa-en-us-term-v1`. The user supplied these research settings; public Microsoft REST documentation and examples verify how they map to the interface. [Microsoft REST pronunciation example](https://github.com/Azure-Samples/Cognitive-Speech-TTS/blob/master/PronunciationAssessment/Python/sample.py), [REST phoneme/configuration reference](https://github.com/microsoft/skills/blob/main/.github/plugins/azure-sdk-python/skills/azure-speech-to-text-rest-py/references/pronunciation-assessment.md).

Use one explicitly bounded HTTP attempt: disable automatic HTTP/status retries and redirects. Set connect/pool/write/read timeouts within the 20-second absolute application deadline; per-I/O inactivity timeouts alone do not enforce a total deadline. Cancel/close the HTTP stream on timeout, then record the outcome uncertainty under section 11; closing does not prove Azure did not process/bill it. [HTTPX timeout distinctions](https://www.python-httpx.org/advanced/timeouts/).

**LOCKED — REST adapter field paths:** inspect root `RecognitionStatus`; choose `NBest[0]` only, never the highest-score alternate. Expected P0 REST primary is `NBest[0].AccuracyScore`; optional global secondary fields are `PronScore`, `CompletenessScore`, `FluencyScore` on that same candidate. Ordered `Words[i]` carries `Word`, `AccuracyScore`, `ErrorType`, alignment evidence, and optional ordered `Phonemes[j]` with `Phoneme` / `AccuracyScore`. This is the REST layout, not implicit acceptance of SDK-style nested `PronunciationAssessment` layouts. Prove exact successful/phoneme paths with a sanitized real fixture during feasibility. If the actual supported response differs, update/review the adapter contract/version before coding around it; never search arbitrary JSON for a convenient score.

Retain only allowlisted derived fields. Bound the provider response body to 262144 bytes while reading, before JSON parsing; an oversized body is `PROVIDER_RESPONSE_INVALID`, not a partial result. Missing optional secondary metrics are null; a present invalid numeric/type/range or structurally malformed observation is an integration failure. Unknown provider JSON fields may be ignored without logging/persisting them. Unsupported recognition/error enum values require adapter review; no silent score/default coercion. Prosody and NBest spoken-phoneme guesses are ignored in P0. Provider expected-phoneme labels are labeled provider units, not fabricated IPA; the adapter must identify any documented alphabet limitation in gate evidence.

## 7. Primary Metric

**LOCKED:** authoritative learner-performance measure is **full-text AccuracyScore**, range 0..100, from the selected top REST assessment candidate. It is not PronScore, word-score average, transcript match, confidence, completeness, fluency, an LLM score or a weighted FLUENTT composite. No rescaling, clipping or rounding occurs before category selection.

Parse valid JSON numeric tokens with lossless decimal semantics; reject bools, strings masquerading as numbers, NaN/Infinity and values outside [0,100]. Preserve the primary decimal numeric value without quantization in persistence and JSON numeric serialization. Do not convert to binary64 and round before category comparison. PostgreSQL exact numeric storage or an equivalently lossless representation is required; final physical DDL belongs to P04 review.

UI display is exactly two fractional digits, decimal half-up, from a server-produced `accuracy_score_display` string. This is display only. A raw 89.995 is B even when displayed as `90.00`; a raw value just below 60 stays D even if displayed as `60.00`. Mobile displays the supplied category and never recomputes it from a floating-point/rounded display. Valid zero with sufficient target evidence is D; invalid/no-speech is not zero.

For scorable results preserve valid full-precision optional PronScore/CompletenessScore/FluencyScore and ordered word/phoneme AccuracyScore as secondary observations only. They cannot influence the category or scheduler. In unscorable/failed outcomes they are not legitimate learner-performance measurements: performance score fields are null, never fallback zeros. Provider recognition status remains operational evidence.

Azure's metric compares acoustic pronunciation to its reference models; do not call it a direct accent-neutral intelligibility score. Formal validation must address the intended learner population and educator/reference judgments. No provider metric definition alone establishes a validated thesis instrument.

## 8. A/B/C/D Category Policy

**LOCKED — `pronunciation-category-v1`, applied to the unrounded valid primary only:**

| Category | Exact interval | Meaning |
| --- | --- | --- |
| A | `90.00 <= score <= 100.00` | Highly accurate pronunciation |
| B | `75.00 <= score < 90.00` | Generally accurate pronunciation; minor practice recommended |
| C | `60.00 <= score < 75.00` | Developing pronunciation accuracy; noticeable practice areas |
| D | `0.00 <= score < 60.00` | Significant pronunciation practice recommended |

These are FLUENTT feedback/performance bands, not Microsoft grades, accent classifications, CEFR or learner proficiency levels. Invalid/unscorable/failed/processing results have no numeric performance score and no category. No imputation, default D or “network failure = zero.” The adviser build may use this user-locked rubric; formal participant collection still requires educator/adviser validation of these boundaries.

Display category text plus accessible visual treatment; do not rely on color alone or imply certification. Localized label wording may be refined without changing semantics or thresholds. A later boundary change requires a new category-policy version and cohort/freeze review, not reinterpretation of old results.

## 9. Scorable / Unscorable Policy

**LOCKED — Decision order:** authenticate -> receive bounded file/validate metadata and provenance -> reconcile/reserve attempt -> validate/decode audio -> provider request/status/structure -> target evidence -> primary numeric validation -> category/feedback. Reservation precedes converter/provider work to fence duplicates as section 11 specifies; no provider work precedes the claim. Request rejection before a durable claim may have no pronunciation row.

| Evidence / outcome | Normalized status and behavior |
| --- | --- |
| Azure `Success`, valid structure/finite primary, sufficient target evidence and supported valid audio/provenance | `scored`; raw primary/category present. |
| `InitialSilenceTimeout`, `BabbleTimeout`, `NoMatch` | `unscorable`; no performance numbers/category, regardless of absent incidental score fields. |
| `Success` but target omitted, unmatched reference tokens, missing positive target duration or otherwise insufficient aligned target evidence | `unscorable`, reason `TARGET_EVIDENCE_INSUFFICIENT` or `TARGET_OMITTED`; no D. |
| `Success` claims an assessment but lacks required primary/candidate/word structure, or contains invalid/nonfinite/out-of-range required scores | `failed`, `SERVER_CONFIGURATION / PROVIDER_RESPONSE_INVALID`; not a fabricated score. |
| Explicit provider unscorable status with no required primary | `unscorable`; absence is expected in this status, unlike malformed Success. |
| Azure HTTP failure, `RecognitionStatus=Error`, timeout/rate limit/service/configuration/converter integration failure | `failed` with the appropriate service/configuration reason; no learner performance. |
| Malformed/unsupported client recording | USER_CORRECTABLE rejection/failed attempt, not an acoustic grade. |

**LOCKED — Sufficient target evidence v1:** use provider ordered reference-aligned word observations. Normalize labels/tokens as section 3; remove only explicitly `Insertion` observations from target-coverage matching. Remaining observations must cover the expected target tokens in order with no `Omission`; each matched target observation needs a valid finite word accuracy and positive provider duration. A provider word spanning multiple normalized tokens can cover the corresponding contiguous token sequence. Mere root Success/full-text score or matching `DisplayText` is insufficient.

Accept `Mispronunciation` as target evidence when the target is aligned and actually attempted; otherwise poor pronunciation would be filtered out instead of receiving a legitimate D. Extra `Insertion` observations do not by themselves erase a sufficiently attempted target, but are preserved as word issues. If any target token is omitted for a multi-token term, the term outcome is unscorable. Do not use fuzzy transcript similarity or force an arbitrary recognized word to count as the target.

No new numeric ASR-confidence/SNR, minimum-duration or noise cutoff is invented in P02. Nonempty decoded audio is necessary, not sufficient; the locked provider statuses and actual target evidence supply the P0 quality decision. Pilot evidence may require a separately approved future quality-policy change before formal research. Numeric zero is accepted only when a real target attempt satisfies these gates.

## 10. Word / Phoneme Feedback Policy

**LOCKED — `pronunciation-feedback-v1`, deterministic, no LLM:**

| Category | General feedback key | English semantic wording |
| --- | --- | --- |
| A | `pronunciation.feedback.A` | Your pronunciation was highly accurate. |
| B | `pronunciation.feedback.B` | Your pronunciation was generally accurate. Practice the highlighted sound if shown. |
| C | `pronunciation.feedback.C` | Your pronunciation is developing. Focus on the highlighted pronunciation area and try again. |
| D | `pronunciation.feedback.D` | Practice this pronunciation again, focusing on the highlighted sound or word. |

Exact localized phrasing may be refined, preserving semantics. These phrases do not authorize inventing highlights. If no supported issue exists, show general feedback only. Unscorable/failed statuses use separate corrective/service keys, not a category message.

Selection algorithm:

1. Preserve provider word array order and original zero-based indices. Preserve phoneme order/index within each word. Never key observations only by spelling or merge repeated units.
2. First include supported provider word issues `Mispronunciation`, `Omission`, `Insertion` in provider order, each tied to its word index. They take presentation priority over phoneme practice suggestions; `None` is not an issue. No reordering of words by severity/score.
3. For a **scored** target, collect finite scored expected phonemes under attempted target words (exclude inserted/omitted words) with AccuracyScore **strictly below 60**.
4. Select at most two globally lowest scores. Break equal-score ties by provider word index, then phoneme index. Present selected sounds in their original provider position order; their evidence keeps the original raw score.
5. Label this group **Sounds to practice**. Do not claim a particular sound substitution or show “You definitely pronounced X as Y.” P0 does not enable/persist spoken-phoneme candidates. No fabricated IPA, articulation diagnosis or replacement sound.
6. No qualifying phoneme -> no phoneme issue. No supported word issue either -> empty issues and general category feedback only. Scores from optional secondary globals do not create issues.
7. An omitted target is unscorable first. It may show a word-level omission/corrective message with null score, but no category or phoneme diagnosis. Unscorable/failed results never render numeric performance feedback.

**LOCKED — Technical bounds:** at most 64 provider word observations; at most 64 phonemes per word and 256 total phonemes; word labels <=255 characters, phoneme labels <=32. Preserve order/positions; never silently truncate evidence to manufacture target coverage. A provider result exceeding bounds fails as an unsupported integration response. At most 64 word issues plus two phoneme issues (66 total); there are at most two specific phoneme-practice suggestions even if more low-scoring units exist. These are resource limits, not research grade cutoffs.

Word observations use only the known four ErrorType values (`None`, `Mispronunciation`, `Omission`, `Insertion`). Provider-supplied strings are plain escaped text, not executable markup/prompts. Grounded guidance can use teacher-reviewed templates; no new unsupported sound-to-articulation mapping is created by this spec. If the only issue is extra speech, describe it as extra speech, not a defect in the target phoneme.

## 11. Attempt Identity / Idempotency

**LOCKED — Separate UUID domain:** unique `(authenticated user_id, client_pronunciation_attempt_id)` in pronunciation persistence. Do not reuse `review client_event_id`, `AcceptedClientEvent`, review sessions, research review pairs or D3 queue semantics. A client pronunciation UUID is generated once per finalized recording; new Try Again/rerecord -> new UUID. Mere rerender, token refresh, transport retry or GET reconciliation -> same UUID.

Bind the original ID to owner, exact target IDs, original interaction, capture profile and original app/platform facts. A reused ID with conflicting metadata returns 409 `PRONUNCIATION_ATTEMPT_CONFLICT`, never overwrites existing work or dispatches a new request. P0 does not persist an audio fingerprint; its guarantee is original submission-identity idempotence, not detection of identical sound bytes across new IDs. A client sending different audio under the same metadata/ID cannot obtain a new assessment; it receives the original attempt's outcome. No global deduplication across recordings/owners.

**LOCKED — Durable claim/dispatch barrier, two-table design:**

```text
authenticate + parse bounded request + validate exact target
short transaction:
    insert/lookup owner/client-ID unique PronunciationAttempt
    lock that pronunciation attempt row (not User/review pointer)
    conflicting metadata -> reject
    terminal -> return original derived outcome
    active claim -> 202 processing; no conversion/provider re-entry
    otherwise reserve original attempt with processing token/deadline; commit

bounded conversion / validation outside DB transaction
short transaction under the same attempt's token/row lock:
    if no terminal result and no prior dispatch marker:
        durably set provider_dispatch_started_at and dispatch token; commit
    otherwise do not dispatch
make one bounded REST call, with HTTP retries disabled
short transaction:
    fence by token/deadline, insert exactly one terminal Result
    set Attempt terminal status/completed timestamp atomically; commit
finally close handles and clean raw/intermediate files
```

Reservation may precede final audio validity; a reserved bad recording can produce a durable failed USER_CORRECTABLE outcome. Do not keep a transaction open over upload, conversion or provider work. Losing concurrent duplicate requests clean their own temp files; they cannot overwrite/delete the winning job's files. Per-attempt row lock/unique claim is independent of the D11 per-learner scheduler lock.

**LOCKED — Ambiguous paid-call outcome:** once the durable dispatch marker is committed, **never automatically dispatch Azure again for that owner/original ID**, even after timeout, process crash, connection reset or a lost commit acknowledgement. The marker intentionally favors avoiding duplicate paid inference over guessing that a call was never sent. A crash between marker commit and network send can therefore leave an unassessed failed attempt; report it honestly. REST provides no application-owned transactional exactly-once guarantee across Azure and PostgreSQL.

Use a processing token and a 60-second maximum claim lifetime with a processing deadline no later than the 40-second backend budget. A startup/periodic reaper fences expired workers and atomically creates a failed terminal result: `PROCESSING_INTERRUPTED` if never marked dispatched, or `PROVIDER_OUTCOME_UNKNOWN` after dispatch. Expiry never triggers another provider request. A late worker cannot overwrite a finalized/expired outcome. Terminal Result is unique by attempt and write-once through ordinary application access.

Same-ID POST/GET after completion returns/reconciles the original scored/unscorable/failed outcome. Processing GET/POST returns 202; GET is side-effect-free and never drives job execution. Poll every two seconds for at most twenty seconds within the foreground deadline, then show a truthful still-processing/unavailable state with later check capability. Do not generate a new ID to hide uncertainty. A fresh user-initiated Try Again means a new recording/ID, potentially a new paid call, after service recovery; no automatic cross-ID resubmission of the old audio.

For HTTP failure before acceptance, bounded same-session transport retry is permitted under the same ID after GET reconciliation; only an authoritative 404 with no accepted attempt permits initial POST again. A failed GET/network timeout is not proof of absence. No local persistent audio job is created. A minimal owner/ID/target-only recovery handle may be kept separately from audio for GET-only reconciliation; after restart never automatically upload cached audio. Derived server evidence remains owned/durable regardless of local cache loss.

## 12. Normalized Result Contract

**LOCKED — Application-owned, independent of unrestricted Azure JSON.** All listed keys are required; nullable types explicitly permit null; additional properties are forbidden in the normalized contract. Ordinary successful/reconciliation responses carry this object directly:

```text
PronunciationResponse = {
  schema_version: "pronunciation-result-v1",
  status: "scored" | "unscorable" | "processing" | "failed",
  attempt_id: server UUID,
  client_pronunciation_attempt_id: original UUID,
  target: {
    vocabulary_item_id: UUID,
    content_revision_id: UUID,
    content_release_id: UUID,
    target_kind: "term",
    term: exact authoritative string
  },
  assessment: {
    accuracy_score: finite JSON number [0,100] | null,
    accuracy_score_display: two-decimal string | null,
    category: "A" | "B" | "C" | "D" | null,
    category_policy_version: "pronunciation-category-v1",
    pronunciation_score: finite JSON number [0,100] | null,
    completeness_score: finite JSON number [0,100] | null,
    fluency_score: finite JSON number [0,100] | null
  },
  word_observations: ordered bounded WordObservation[],
  issues: ordered bounded Issue[],
  feedback: {
    general_feedback_key: approved key | null,
    selected_issue_refs: ordered Issue.id[],
    feedback_policy_version: "pronunciation-feedback-v1"
  },
  provider_metadata: {
    provider: "azure_speech_pronunciation",
    locale: "en-US",
    assessment_config_version: "azure-pa-en-us-term-v1",
    integration: "short_audio_rest",
    api_contract: "cognitiveservices/v1",
    adapter_version: "azure-short-rest-adapter-v1",
    http_client_version: actual version | null,
    sdk_version: null,
    hosted_model_version: reported version | null,
    recognition_status: supported provider status | null,
    capture_profile_version: "expo57-term-m4a-v1",
    converter_profile_version: "ffmpeg-pcm16k-mono-v1",
    converter_version: actual build/version | null
  },
  reason: {
    category: "USER_CORRECTABLE" | "RETRYABLE_SERVICE" |
              "SERVER_CONFIGURATION",
    code: stable safe code,
    recovery: "rerecord" | "check_status" | "retry_later" |
              "operator_action"
  } | null,
  timestamps: {
    original_interaction_at: aware UTC datetime,
    received_at: aware UTC datetime,
    processing_started_at: aware UTC datetime | null,
    completed_at: aware UTC datetime | null
  }
}
```

`api_contract` identifies the documented route version, not a fabricated hosted model/API date version. Hosted model version remains null unless actually exposed through a documented response. SDK version is null because REST is chosen; record the actual HTTP dependency/converter/build elsewhere as shown. Do not substitute a request ID, SDK version, date or app version as a cloud model version. Mobile/backend commit/build identities bind these results through deployment provenance.

Exact nested observation forms:

```text
WordObservation = {
  word_index: nonnegative strict integer (original Azure position),
  target_unit: bounded provider word label,
  is_target: strict boolean,
  accuracy_score: valid finite [0,100] number | null,
  provider_error_type: "None" | "Mispronunciation" | "Omission" | "Insertion",
  offset_100ns: nonnegative strict integer | null,
  duration_100ns: nonnegative strict integer | null,
  phonemes: ordered bounded {
    phoneme_index: nonnegative strict integer,
    target_unit: bounded expected-provider-unit label,
    accuracy_score: valid finite [0,100] number
  }[]
}

Issue = {
  id: "word:<word_index>" | "phoneme:<word_index>:<phoneme_index>",
  level: "word" | "phoneme",
  word_index: original strict integer,
  phoneme_index: original strict integer | null,
  target_unit: bounded label,
  accuracy_score: valid finite [0,100] number | null,
  provider_error_type: supported word ErrorType | null
}
```

Word/phoneme indices are stable contiguous original-array positions; references must resolve to those observations. Phoneme issue error type is null; word issues retain the supported provider tag. `selected_issue_refs` equals displayed `issues` IDs in the specified order, with no dangling/duplicate reference. All numeric fields reject bool/coercive strings and nonfinite values. Ignore unapproved upstream fields instead of copying them through.

Status consistency:

- `scored`: primary/display/category required and mutually consistent, reason null, category general key required; optional secondaries may be null.
- `unscorable`: all assessment performance numbers/display/category null; no numeric word/phoneme performance detail. Keep only supported corrective word tags/positions with null scores if needed; phoneme lists empty. General key explains the unscorable reason; reason USER_CORRECTABLE. No A-D feedback.
- `failed`: all performance numbers/display/category null, observations/issues empty, safe error feedback/reason required.
- `processing`: all performance numbers/display/category null, observations/issues empty, feedback key null, reason null, completed timestamp null. Provider recognition/runtime fields can be null if not known yet.

New completed scored/unscorable POST returns 201, completed replay 200, in-progress 202. GET returns 200 for terminal outcomes or 202 processing; absent owned ID is 404. First terminal failure can use the status in section 15 with the safe error envelope below. Replaying an already stored failure returns 200 plus `status=failed`; 200 is not a score and must be parsed by status.

HTTP error envelope: `{"detail":"<safe localized-message fallback>","code":"<stable code>","category":"<failure category>","result":<normalized response or null>}`. The dedicated pronunciation client parses a non-null result without assuming a successful score; existing generic string-detail normalization stays compatible. Preacceptance/auth failures may have no result; preserve existing auth bodies. Do not extend D3's review acknowledgement parser with this contract.

## 13. Persistence Contract

**LOCKED — Select two future tables/concepts:** an operational `PronunciationAttempt` and a unique write-once terminal `PronunciationResult`. This separates short processing-claim transitions from final measurement evidence. No table or migration is created during P02; physical names/constraints are implemented/reviewed later.

| Concept | Minimum fields / invariants |
| --- | --- |
| Attempt | Server UUID PK; authenticated owner FK; unique owner/client pronunciation UUID; exact release/item/revision; fixed term target kind; original interaction; capture profile/platform/app version; received/processing/completed timestamps; status; internal processing token/deadline/phase; durable provider-dispatch marker/token. No raw path/bytes needed for durable inference retry. |
| Result | PK/FK pronunciation attempt, at most one terminal row; provider/config/API/adapter/known runtime/model/locale metadata; raw full-precision primary and valid optional secondaries for scored status; category/policy; bounded ordered derived word/phoneme observations; selected issues/general feedback/feedback version; terminal status and safe reason. |

Target text remains reconstructible from immutable revision, rather than an arbitrary client text field. The normalized response can include that exact term after the authoritative join. Store exact numeric metric values without quantization (for example PostgreSQL NUMERIC); JSON observations require lossless numeric handling too. The serialized result must not inadvertently convert Decimal to a string or rounded float. Category and feedback are the frozen outcome under their original policy, not recomputed on future reads after a policy change.

Maintain matching owner/provenance, Result/Attempt terminal-status agreement, status/nullability consistency and unique outcome at the database/service boundary. Enforce the one-active-attempt-per-owner limit with a pronunciation-table partial unique constraint/index on owner while status is processing; check original-ID replay first, and map a genuinely different active attempt to `CAPACITY_UNAVAILABLE` without another dispatch. This does not lock or update User/review rows. Initial state is processing with no Result; terminal result insertion and attempt completion commit atomically under its token. A rollback must not leave half a terminal outcome. Do not interpret an arbitrary IntegrityError as accepted replay; return an existing original only after verifying the owner/client unique winner. GET ownership is mandatory.

No raw audio bytes, base64, public/private durable raw-audio URL, unrestricted provider JSON, subscription key, full transcript dump or arbitrary client reference text is persisted. Bounded word/phoneme observations are derived speech data and require the approved consent/access policy; they are not anonymous merely because raw audio was deleted. Ordinary service access cannot rewrite terminal research measurements; approved retention/withdrawal procedures need separate governance and must not modify D9 review evidence.

Do not reuse review `AcceptedClientEvent`, `ReviewAttempt`, `ReviewSchedule`, `CurrentReviewSchedule` or canonical ResearchEvent pairs for speech persistence. No conventional/ESR condition FK or schedule state is a pronunciation input. Existing content provenance and authenticated owner IDs are reusable without coupling the subsystems.

## 14. Temporary Audio / Privacy Policy

**LOCKED — Raw learner audio is temporary processing data.** Persist only the approved derived measurements/provenance above. No permanent audio retention is enabled for P0; formal collection still requires approved participant consent/data handling.

Mobile uses a dedicated app-private cache subdirectory. No document/library/gallery export, public URI, cloud backup workflow, durable offline queue or SecureStore audio. Close the recorder/player/upload handles and delete after terminal result, cancellation, navigation/background/account change where possible. For a network failure before/requiring reconciliation, allow original-file use only within the same foreground activity for at most two minutes after finalization; never extend that lifetime by retrying. After expiry, delete and require a fresh recording. Reconciliation GET needs no audio.

Cleanup known pronunciation cache files on startup/reentry and account changes. A killed app cannot guarantee immediate execution/deletion; cache is not proof of erasure. A metadata-only recovery handle may retain owner/client/target IDs for GET but no audio path/bytes or automatic job. Do not adopt a background audio queue to make cleanup/retry convenient.

Backend uses a dedicated non-public per-job temporary directory, least-privilege access and generated paths. Each process/request owns its own files; duplicate cleanup cannot delete an active winner's directory. Always close/wait/terminate recorder/converter/provider streams before `finally` deletion of upload/WAV/intermediates, including unscorable/error/timeout paths. No file-serving/static route or logged temp URI. Multipart parser spooling and converter diagnostic files are part of cleanup, not exceptions.

Crash cleanup scans only this dedicated root at startup and periodically; expire orphan jobs after five minutes, checking/fencing the associated claim before deleting anything active. No raw file may be reused for a new inference after expiry. A host that is down cannot perform deletion until restart; document this operational limitation rather than claim instant forensic secure erasure. Bound disk usage/output/concurrency even when cleanup fails; inability to guarantee normal-path cleanup blocks the feasibility gate.

No audio/provider body/keys in database, research/error/access logs, tracing or exception dumps. Keep only safe error codes/versions/operational IDs. Review decoder/proxy buffering and backup/telemetry policies before real learner use. Microsoft publishes data-handling terms for pronunciation assessment, but FLUENTT's temporary files, transport and exact selected resource settings remain its own responsibility. [Microsoft Speech data handling](https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/speech-to-text/data-privacy-security).

## 15. Failure Taxonomy

**LOCKED — Infrastructure failures never receive D/zero.** Stable application category and response recommendations:

| Category / code | HTTP when first rejected/failed | Outcome / recovery |
| --- | --- | --- |
| USER_CORRECTABLE `MICROPHONE_DENIED` | Local UI, no request | Permission/settings; no result/grade. |
| USER_CORRECTABLE `EMPTY_RECORDING`, `INVALID_METADATA`, `INVALID_TARGET`, `DURATION_LIMIT` | 422 (content provenance can preserve existing 400 convention) | Correct/rerecord; no provider invocation. |
| USER_CORRECTABLE `UPLOAD_LIMIT` | 413 | Rerecord with supported profile; no provider call. |
| USER_CORRECTABLE `UNSUPPORTED_AUDIO` | 415 | Unsupported/corrupt actual decode; never merely extension-based rejection. |
| USER_CORRECTABLE `NO_MATCH`, `INITIAL_SILENCE`, `BABBLE`, `TARGET_OMITTED`, `TARGET_EVIDENCE_INSUFFICIENT` | 201 initial / 200 replay | `unscorable`, null score/category, fresh recording. |
| USER_CORRECTABLE `PRONUNCIATION_ATTEMPT_CONFLICT` | 409 | No overwrite/provider call; original ID facts conflict. |
| RETRYABLE_SERVICE `NETWORK_UNAVAILABLE` | Local transport error | Check original status, bounded same-ID transport retry only if absence proven. |
| RETRYABLE_SERVICE `AZURE_TIMEOUT`, `BACKEND_TIMEOUT` | 504 | `failed` if reserved; no blind provider redispatch; check original or fresh recording later. |
| RETRYABLE_SERVICE `AZURE_RATE_LIMIT`, `AZURE_UNAVAILABLE`, `CAPACITY_UNAVAILABLE`, `PROCESSING_INTERRUPTED`, `PROVIDER_OUTCOME_UNKNOWN` | 503 | No performance; original failed result remains; service recovery then explicit fresh recording. |
| SERVER_CONFIGURATION `AZURE_CREDENTIALS_INVALID`, `AZURE_CONFIG_MISSING`, `CONVERTER_UNAVAILABLE`, `PROVIDER_CONFIG_UNSUPPORTED` | 503 | Operator repair, not learner logout or bad pronunciation. |
| SERVER_CONFIGURATION `PROVIDER_RESPONSE_INVALID`, `CONVERTER_INTEGRATION_ERROR` | 502 | Invalid upstream/adapter contract; operator review, no guessed result. |
| AUTH | Existing 401/403 | Existing FLUENTT owner/session/refresh behavior; no provider key exposure. |

Malformed conversion input that reproducibly fails a healthy decoder is USER_CORRECTABLE; missing executable, broken configured command or canonical-output verification failure is SERVER_CONFIGURATION. A general provider 400 after validated canonical input/configuration is an integration/configuration fault, not automatically a learner recording error. Root provider `Error` is RETRYABLE_SERVICE; unknown/malformed status is SERVER_CONFIGURATION. Capacity rejection before durable reservation may have no result; it cannot consume a provider attempt.

Absent owned GET ID returns 404 without disclosing another owner's attempt. Existing terminal failure replay is HTTP 200 with normalized failed status/reason; the pronunciation client must interpret that status explicitly. Authentication follows current app behavior. Provider 401/403 is remapped to SERVER_CONFIGURATION, never returned as learner AUTH. Error text is sanitized and localized through approved keys; no Azure body/token trace is forwarded.

This subsystem does not use the D3 queue classifier. Its HTTP choices nevertheless preserve the distinction between permanent client-input failures and temporary/operator service failures. “Retryable service” permits later recovery/new practice, **not** automatic repeat inference for a dispatch-marked original ID.

## 16. Scheduler Isolation

**LOCKED — Zero write/call dependency on review scheduling:** pronunciation must not mutate `ReviewAttempt.correct`, `ReviewSchedule`, `CurrentReviewSchedule`, scheduler memory, ESR/SM-2 assignment, review event ledger/pairs or `response_time_ms`. It must not call `record_review_attempt`, eligibility/state transition, either engine, or edit D10 evidence.

No pronunciation score/category/word/phoneme/prosody feature enters D11 mathematical input/config selection. New pronunciation duration/timestamps are separate from review response-time evidence. A pronunciation attempt does not count toward `analytics/service.py::get_learner_progress` review accuracy or vocabulary scheduling history. Reusing a content revision/owner ID does not imply a review transaction.

Future tests snapshot review attempts/schedules/pointers/ledger/events/assignment and timing fields before every speech success/unscorable/failure/retry/replay; afterward values/counts/digests remain identical and scheduling spies have zero calls. Verify both algorithm conditions in isolated fixtures when available; current development behavior and historical replay remain unchanged. Pronunciation attempt locking is its own row authority, not a reason to hold the D11 user lock during inference.

## 17. Adviser P0 Flow

**LOCKED — Completed acceptance walkthrough:**

1. From a lesson/vocabulary item, open Pronunciation Practice with exact released English term; show clear microphone/temporary-processing instructions.
2. Explicit microphone permission, including a denied/settings state; no hidden capture.
3. Record with visible duration and ten-second limit, Stop/release or Cancel.
4. Submit the finalized original recording once; show uploading/processing, guard duplicate taps and owner changes.
5. Show **real Azure full-text AccuracyScore**, two-decimal display and server-assigned FLUENTT A/B/C/D category; do not call PronScore the primary.
6. Show general feedback and only supported word/Sounds-to-practice details; at most two phoneme suggestions, no invented weakness.
7. Try Again creates a fresh recording/attempt; cleanup completes under policy and derived evidence remains owned/persisted.

Also demonstrate microphone denial, silence/NoMatch and provider/network failure with no score/category. Use separately approved test material/consent and real target Android build. Test doubles may prove parser/unit logic later but are never shown as a live scored learner recording. No arbitrary text, example-sentence mode, conversation feature or durable offline queue is part of this walkthrough.

## 18. Feasibility Gate

**BLOCKER BEFORE FULL P03/P04 — Every gate is NOT RUN in P02.** Later separately authorized bounded feasibility work must prove:

| Gate | Required actual evidence |
| --- | --- |
| 1. Capture | SDK-57 `expo-audio` foreground permission/record/stop/release works on actual adviser Android device/build, including ten-second behavior. |
| 2. Source format | File is genuine self-contained M4A/AAC; measured duration/codec/sample rate/channels/bytes and near-limit profile fit section 5. |
| 3. Converter | Selected absolute ffmpeg/ffprobe executables work on actual backend runtime with fixed flags, least privilege, wall deadlines and bounded files. No installation is done now. |
| 4. Canonical format | Independent WAV reader/probe proves PCM 16 kHz, 16-bit, mono, nonempty <=10 s; no renaming/hidden trimming. |
| 5. Provider acceptance | Approved resource/auth/region accepts that canonical WAV under locked REST configuration; no credentials exposed. |
| 6. Primary metric | Real successful response contains the exact expected finite full-text AccuracyScore and supported structure; no substituted metric. |
| 7. Granular evidence | At least representative scorable test responses contain usable ordered target word and phoneme data under the selected REST adapter/alphabet. Capture a sanitized derived fixture, not raw audio/provider dumps. |
| 8. Cleanup | Success/unscorable/failure/cancel and stale-job paths remove all temporary raw/intermediate/spooled files; confirm normal-path deletion and crash-expiry handling. |
| 9. Latency / rehearsal | Measure stop/upload/process/result duration on actual network/device within hard budgets, and obtain adviser/operator acceptance of observed demonstration latency. No promise is inferred from documentation. |

If any gate 1-7 fails, stop the implementation path and revisit the architecture/versioned contract. Do not move forward with fake scoring, an unverified nested JSON fallback, transcript match or an SDK substitution. Cleanup/latency failures also block declaring the P0 flow ready. Gate 7 proves a capability on representative clips; it does not authorize inventing issues when a particular valid response has no supported low-scoring phoneme.

Record actual native app/build, Expo/audio dependency versions, backend Python/OS, ffmpeg/ffprobe build, HTTP client pin, resource locale/config and observed response schema. Raw test audio follows the same approved temporary policy; use consented/approved material only. Keys are provisioned privately in future authorized work, not in P02 or the report.

## 19. Acceptance-Test Oracles

**LOCKED — Future tests only; none implemented/executed as product tests during P02.** Unit fixtures must be clearly labeled fixtures, not hard-coded live scores.

| Input / test | Exact required outcome |
| --- | --- |
| Primary 59.99 / 60.00 / 74.99 / 75.00 / 89.99 / 90.00 / 100.00 | D / C / C / B / B / A / A respectively under `pronunciation-category-v1`. |
| Valid primary 0 with sufficient target evidence | Scored D, distinct from silence/error. |
| Raw 89.995 | Display `90.00`, category B; neither API formatting nor JS float/display recomputes category. Include decimal values arbitrarily just below 60/75/90. |
| Negative, >100, bool, string, NaN/Infinity primary | No category; Success with invalid primary is provider integration failure; no clipping/default zero. |
| NoMatch/InitialSilenceTimeout/BabbleTimeout without score | Unscorable, all performance fields/category null, corrective key, no phantom failure score. |
| Success without required AccuracyScore or malformed NBest/Words | Failed SERVER_CONFIGURATION; not PronScore/word-average fallback. |
| Provider outage/429/timeout/root Error | Failed RETRYABLE_SERVICE, no D; provider 401/403 -> SERVER_CONFIGURATION, learner auth/session unchanged. |
| Omitted/missing target or nonpositive/missing target duration | Unscorable even if provider includes overall score; null performance, no phoneme diagnosis. |
| Attempted target tagged Mispronunciation with valid evidence | Remains scorable, including a real low/zero accuracy; do not exclude poor pronunciation by exact transcript text. |
| Insertions with valid target coverage | Preserve word positions/tags; still use full-text primary, no invented target-sound defect. |
| Phonemes [59, 10, 10, 60, 80] at stable indices | Only the two score-10 expected units selected, stable tie/position rules; no third phoneme, no score-60 issue. |
| All phonemes >=60 / missing optional phonemes | No phoneme issue; supported word tags may remain; otherwise general category feedback only. |
| Repeated word/phoneme labels | Distinct original indices/references retained; no spelling-key merge or reorder. |
| Changing PronScore/Fluency/Completeness only | Category/general grade remains determined by the unchanged primary. |
| Same-owner original ID concurrent POSTs | Unique attempt/outcome, one claim, at most one application Azure dispatch; loser processing/original replay, no second paid request. |
| Lost success acknowledgement / same-ID POST or GET | Original result unchanged, zero new provider calls/result rows. GET never initiates work. |
| Crash before/after durable dispatch marker | Before: interrupted terminal or original active claim, no unguarded retry; after: unknown-outcome failure/reconciliation, never automatic redispatch. Late workers fenced. |
| Fresh Try Again | New recording and UUID; no automatic old-audio/new-ID resubmission. |
| Changed target/timestamp under same ID / different owner | 409 conflict for same owner; cross-owner GET cannot reveal result. |
| Actual 0-byte / >262144-byte file / >278528-byte request | Reject empty/upload limit before conversion/provider; missing Content-Length cannot bypass streamed cap. |
| Declared M4A with corrupt/WAV/video/playlist/external-reference content | Actual validation fails; extension/MIME cannot authorize decode/assessment. No decoder network access. |
| Decoded <=10s / >10s | At most 160000 frames accepted; any larger decode rejected even if sentinel output is capped. No ten-second truncation path. |
| Canonical WAV | PCM 16 kHz, 16-bit mono, exact frame/byte checks and size bound; output verification failure cannot call Azure. |
| Converter missing/hanging/bad output | Safe SERVER_CONFIGURATION or bounded failure; subprocess killed/waited, no lingering temp file/provider call. |
| Permission grant/denial, Record/Stop/Cancel/Retry, background/unmount | Truthful UI states, explicit permission, release microphone, raw cleanup, generation/owner guard and no duplicate submission. |
| Normalized schema / optional metrics | Exact keys/status/nullability and finite numeric validation; optional absence null; no unrestricted upstream JSON leaks. Lossless metric round trip. |
| Privacy after success/failure/retry expiry/restart | No raw upload/WAV/intermediate/cache beyond the approved cleanup path/lifetime; no raw/keys/log dumps or D3 audio queue. Verify crash cleanup in an isolated environment. |
| Scheduler independence | All review/assignment/pointer/timing evidence identical before/after every speech outcome, zero scheduler/acceptance calls. |

Add real approved-recording integration fixtures for known target, silence, noise and an educator-reviewed pronunciation-error example; source inspection/mock response does not pass gates 1-9. Preserve derived evidence and actual runtime/provider metadata; document cloud-output variability rather than assert identical live numeric scores. Run appropriate complete backend/mobile/type/lint/native regression gates after actual implementation, preserving D1-D10 and scheduler isolation.

## 20. Formal Research Validation Gates

**LOCKED — Adviser implementation can use this rubric; formal collection cannot yet.** Before participant collection:

- Educator/adviser validates A-D meanings/boundaries and target/locale choice for pre-intermediate English learners.
- Pilot representative learner recordings/microphones/noise conditions under approved consent, compare raw AccuracyScore against explicit expert/reference accuracy/intelligibility criteria and document agreement/limitations.
- Freeze invalid/noisy/missing/omission/repeat/retry handling, scoring precision, category/feedback/target rules and formal analysis treatment. Do not invent pilot success criteria in implementation.
- Freeze/document provider resource/locale/config, REST route/adapter/dependency, converter/capture, application/backend/build/schema and category/feedback identities.
- Disclose hosted model version null/unpinnability when applicable; SDK/HTTP pinning does not freeze cloud weights. Define service-change detection/revalidation procedure.
- Approve temporary audio/derived-data retention/access/withdrawal procedures and verify cleanup/security before collection.
- Complete real-device/provider, privacy, ownership, duplicate/outage and scheduler-isolation regression/review gates.

No claim that Azure AccuracyScore is a direct accent-neutral intelligibility measure, proficiency level or accent-elimination target. FLUENTT's categories are application-defined feedback bands subject to validation; demonstration completion is not formal study approval.

## 21. Chapter 3 Alignment

**DEFERRED — Checklist only; manuscript untouched:**

- Azure scripted reading assessment of exact released English terms, en-US, HundredMark, Phoneme/Comprehensive, miscue on, prosody off.
- Full-text AccuracyScore as primary, secondary provider measures separately identified, no invented composite or text-match proxy.
- FLUENTT A-D rubric, unrounded comparison/display independence and invalid/unscorable distinction.
- Deterministic word/phoneme feedback, at most two low-scoring expected sounds, no unsupported replacement-sound claim.
- Temporary raw processing, verified cleanup, approved derived evidence and participant consent/data handling.
- Version/build/configuration freeze and hosted-model limitations; educator/reference validation of metric/category interpretation.
- Complete separation from ESR/conventional SRS and recall response-time measures.

## 22. Deferred Scope

**DEFERRED:** example-sentence/arbitrary/free-speech targets; other locales; prosody; spoken-phoneme candidate diagnoses; LLM explanations/conversation/grammar; custom acoustic training; reference-audio/IPA content authoring; offline speech inference/durable audio queue; background recording; long-form audio; advanced history/charts/admin analytics; iOS/web parity beyond verified native scope.

Physical DDL/migration, future dependency installation and server credentials are implementation work, not missing specification decisions. Actual ffmpeg build/resource region/device and observed REST phoneme structure must be proved by the gate, never fabricated now. Formal validation/consent/service-drift procedures remain research-readiness gates. Any necessity to change the selected interface/limits/metric requires explicit versioned specification review.

## 23. Implementation Handoff

**LOCKED — No implementation starts within P02:**

1. Obtain independent specification review, then a separate authorized implementation plan. Keep the four prior untracked artifacts and this spec intact unless later explicitly authorized to revise the relevant document.
2. Execute only the bounded feasibility gate first in authorized test scope: actual device capture, byte/format/limit proof, selected ffmpeg runtime, real REST metric/phoneme schema, cleanup and measured latency. No fake score on failure. Necessary temporary probe work needs its own approved scope; P02 does none.
3. P03: separate recording route/UI, SDK-compatible audio dependency/config, permission/lifecycle/cleanup and exact term provenance. Preserve `mobile/src/reviews/useReviewTiming.ts` and review-screen behavior.
4. P04: new backend pronunciation router/service/adapter, bounded multipart + converter, runtime HTTP dependency, private configuration and additive two-table persistence/claims/reconciliation. Preserve existing auth behavior; no changes to review queue/event tables.
5. P05: pure decimal category/display and deterministic word/phoneme feedback under the locked policy IDs; normalized result schema/strict parsing and owned persistence. Unit fixtures cannot replace provider gate evidence.
6. P06: real end-to-end adviser rehearsal and no-speech/denied/outage cases, cleanup/ownership/idempotency/scheduler-isolation evidence and full regression gate. Report readiness separately from formal-research validation.

Relevant existing edit boundaries, when later approved: `mobile/app/(app)/lessons/[lessonId].tsx`, `content/components/VocabularyCard.tsx`, auth-aware transport/localization, and new pronunciation modules; `backend/app/main.py`, new pronunciation modules, reused `content/provenance.py` read validation, and reviewed future manifests/migrations. This list is not permission to edit them now. Do not start Plan E/F or conflate this work with D11 scheduler implementation.

## 24. Final Recommendation

**P02 READY FOR SPEC REVIEW**

The provider/interface, English term target, capture/conversion/limits, primary metric/rubric, quality/feedback rules, separate attempt identity/dispatch barrier, normalized result, two-table persistence, temporary-audio policy and scheduler isolation are specified for review. The system is not implemented and no runtime gate is passed. Real-device/ffmpeg/REST feasibility and later formal validation remain explicit blockers to their respective readiness claims.

Only this untracked specification is created. Final verification checks expected branch/HEAD, empty tracked/staged diff, `git diff --check`, all 24 required sections/whitespace and unchanged hashes of the four prior artifacts. No application test or live Azure/audio result is claimed by this document, and no source, migration, dependency, credential, manuscript or existing evidence file is changed. No commit or push.
