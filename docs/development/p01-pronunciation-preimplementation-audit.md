# P01 Pronunciation & NLP Pre-Implementation Audit

## Executive Summary

**CONFIRMED — Audit date: 2026-10-16, Asia/Manila.** FLUENTT currently has no learner pronunciation activity, microphone-permission flow, audio recorder/player, speech upload, speech/pronunciation endpoint, scoring engine, A/B/C/D pronunciation mapping, pronunciation persistence, or conversation/grammar NLP integration. The checked-in foundation deliberately excluded these capabilities. Existing review correctness and progress accuracy are not pronunciation measurements.

**RECOMMENDED — Best-fit direction:** a short, scripted English pronunciation activity using future SDK-compatible Expo recording, an authenticated FastAPI upload boundary, and a managed pronunciation-assessment adapter. Azure Speech Pronunciation Assessment is a documented candidate with granular acoustic feedback; it is not installed, selected, configured or exercised by this audit. Its published pronunciation-assessment capabilities make it a better candidate for this sprint than inventing acoustic scores from transcript similarity. [Microsoft assessment documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment).

**BLOCKER — Delivery, not audit completeness:** there is no existing audio-to-engine path to extend. Provider access, target locale, real-device recording/format compatibility, approved metric/rubric and category thresholds must be resolved before promising the full adviser walkthrough on **Wednesday, October 21, 2026**. A bounded managed integration is a feasible direction, not a verified delivery estimate. A/B/C/D remain feedback/performance categories, never CEFR or learner proficiency levels. No numeric thresholds are selected here.

**LOCKED RESEARCH BOUNDARY:** pronunciation is evaluated separately from ESR/conventional SRS. Scores, categories and feedback must not change review correctness, intervals, memory or current pointers. There is no final ESR engine in the current code; the untracked D11A document is a specification, not implemented functionality.

**P01 READY FOR DESIGN REVIEW.** This audit creates only this untracked report. It does not install dependencies, add keys, connect to a paid speech service, record/upload audio, query a learner database/device sandbox, implement scoring, alter Chapter 3, commit, push or start Plan E/F.

## Repository Baseline

**CONFIRMED — Requested baseline commands:**

```text
git branch --show-current
main

git rev-parse HEAD
4135cd7334acbdb1b97fc1a8843eaf03cdddd353

git status --short
?? docs/development/d10-timing-fix-review-bundle.txt
?? docs/development/d11-esr-preimplementation-audit.md
?? docs/development/d11a-scheduler-contracts-spec.md

git log -5 --oneline
4135cd7 fix(reviews): isolate per-item timing lifecycle
a52480b fix(auth): harden startup session restoration
7f3a9cb feat(research): harden research logging and integrity
cd01273 feat(research): harden review timing evidence
052985f feat(reviews): add server-authoritative due eligibility
```

**CONFIRMED — Search/inspection coverage:** `mobile/app/**`, `mobile/src/**`, `mobile/package.json`, `mobile/pnpm-lock.yaml`, `mobile/app.json`, `mobile/AGENTS.md`, `backend/app/**`, all eight checked-in Alembic version files through D9, `backend/pyproject.toml`, `backend/uv.lock`, relevant existing tests, seed content and research/development design notes. There is no repository-root `package.json` or root pnpm lockfile; the mobile manifest/lockfile are the relevant pair.

Case-insensitive searches included pronunciation, speech, audio, record/recording, microphone/mic, expo-av/expo-audio, Audio/Speech, phoneme/IPA, ASR/STT/transcription, Whisper, Azure, Google Speech, Deepgram, AssemblyAI, speech recognition, pron_score/pronunciation_score, fluency, accuracy, prosody, feedback, conversational/grammar/chat/LLM terms; separate searches checked A/B/C/D tokens, upload/multipart, temporary-file and binary/object-storage paths. Generic comments containing “record,” review A/B ownership examples, test mocks and lockfile integrity strings are not audio functionality. Existing content `category`/difficulty labels are not A/B/C/D scoring.

Manifest and lockfile inspection corroborates source searches. No `.env`, credentials, API keys, SecureStore values, user audio, live database contents or device filesystem was inspected. Public technical documentation was read; no provider API request or account provisioning occurred. Absence claims below concern the audited repository, not every installed package, external deployment or unrelated host file.

**CONFIRMED — Existing artifacts protected by pre/post SHA-256:**

| Existing untracked artifact | Baseline SHA-256 |
| --- | --- |
| D10 timing review bundle | `52d8bcbdac46b294828c2c687401eb577f5714630de2e9de26f809b448a787c2` |
| D11 preimplementation audit | `85e101ca11b799a8f0c2965d546571ffbceb3f80d90aba3e6cdaf510288b5c26` |
| D11A contracts specification | `5e4f3869fde26b4cc2fda7ab3a097c1005e4cfef89695f2b8c8413550907e1b9` |

## Existing Mobile Audio Capability

**CONFIRMED — Manifest/configuration:** `mobile/package.json` declares Expo `~57.0.24`, React Native `0.86.3`, React `19.2.3` and TypeScript `~6.0.3`. No direct `expo-audio`, `expo-av`, `expo-speech`, speech-recognition, audio-codec or provider SDK dependency exists. `mobile/pnpm-lock.yaml` contains **transitive** `expo-file-system@57.0.7` under Expo; it is not a declared app dependency and no application audio-file workflow imports it. Its presence does not establish recording or cleanup support.

| Capability | Current finding / exact evidence boundary |
| --- | --- |
| Microphone permission / denied-settings recovery | Absent in `mobile/app` and `mobile/src`; no request-recording-permission function. |
| Start / stop recording | Absent; no recorder hook/service or media state machine. |
| Cancel / retry / recording indicator / recording duration | No audio-specific implementation. `common.cancel` and `common.retry` are only reusable copy. |
| Reference/recorded-audio playback | Absent; no audio player or reference-audio control in `VocabularyCard`. |
| Temporary recording URI/file | Absent; no recording URI lifecycle, deletion, recovery or retention policy. |
| Upload/multipart | No `FormData` audio submission; shared client defaults to JSON. |
| Format/container, sample rate, channels, bitrate | **Not defined by the application.** There is no configured recorder/preset to inspect. |
| Android microphone permission | `mobile/app.json` has no app microphone permission/audio plugin. No checked-in/generated `mobile/android` directory is present. No APK-manifest inspection is claimed. |
| iOS permission | No `NSMicrophoneUsageDescription`, audio plugin or configured recording mode in `mobile/app.json`; no `mobile/ios` directory present. |
| Expo plugins | Router, splash-screen, SecureStore, localization and SQLite only; none establishes audio capture. |

**RECOMMENDED — Future mobile library candidate:** SDK 57 documents `expo-audio` recording/playback, runtime permission requests, recorder status and a recording URI. Its config plugin manages platform permissions; native config changes require a rebuilt binary. Recordings default to cache, which is not an explicit deletion guarantee. These are library capabilities, not existing FLUENTT functions. [Expo SDK 57 audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/).

**BLOCKER — Format bridge:** that documentation's high-quality native preset uses M4A/AAC, 44,100 Hz, two channels, 128,000 bit/s; web uses a different container. Do not label that output WAV/PCM by changing its filename. A future recording profile and backend decode/transcode path require real-device verification. The application currently has neither. Keep the adviser scope to the chosen native device/platform; do not infer iOS/web support from Android testing. No background recording is needed for the proposed short foreground activity.

## Existing Pronunciation Workflow

**CONFIRMED — Actual navigation:**

```text
HomeScreen -> lesson list -> LessonDetailScreen -> VocabularyCard text
                                      -> ReviewScreen -> ReviewResultScreen
```

- `mobile/app/(app)/_layout.tsx::AppLayout` registers home, onboarding, settings, lessons, review, sync-status and progress. It registers no pronunciation, recording or conversation route.
- `mobile/app/(app)/home.tsx:16::HomeScreen` exposes lessons, progress, sync status and settings; there is no pronunciation entry.
- `mobile/app/(app)/lessons/[lessonId].tsx:17::LessonDetailScreen` renders `VocabularyCard` and a Start Review action at line 139. It offers no speech activity.
- `mobile/src/content/components/VocabularyCard.tsx:11::VocabularyCard` displays term, translation, definition, optional example sentence, difficulty and content version. It has no audio/reference/recording button.
- `mobile/app/(app)/review/[lessonId].tsx::ReviewScreen` captures self-reported binary vocabulary recall and review timing. Correct/Incorrect is not a speech assessment.
- `mobile/app/(app)/review/result.tsx:8::ReviewResultScreen` displays route-supplied totals/synced/queued counts. It is not a pronunciation result and does not persist a speech score.
- `mobile/app/(app)/progress.tsx:16::ProgressScreen` renders vocabulary-review aggregates from `/analytics/progress`. `backend/app/analytics/service.py::get_learner_progress` computes `accuracy_rate = correct review attempts / all review attempts`; this is not acoustic accuracy.

**CONFIRMED:** there is no unfinished pronunciation screen or hidden mock pronunciation score to repair. Placeholder layout spacers and review test mocks are unrelated. No pronunciation result survives navigation/restart because no such result is produced. There is no pronunciation history/progress API or UI. Reuse layout patterns later, not the semantics of review completion/accuracy.

## Existing Backend Capability

**CONFIRMED — Registered modules:** `backend/app/main.py` mounts auth, users, content, reviews, sync and analytics, plus `/health` and `/health/db`. The checked-in endpoint inventory is:

| Module | Existing routes |
| --- | --- |
| Auth | login, change-password, refresh, logout |
| Users | GET `/users/me`, PATCH preferences |
| Content | languages, lessons, lesson detail with optional exact release |
| Reviews | eligible-items, sessions, attempts |
| Sync | POST `/sync/review-events` |
| Analytics | GET `/analytics/progress` |

No pronunciation/speech/NLP router, audio upload, processing service, result/history endpoint, external speech request, multipart parser configuration, audio validator, storage adapter or cleanup worker exists in `backend/app`. No `UploadFile`, `File`/`Form` request boundary, audio MIME validation, decode/resample service or provider timeout exists there.

**CONFIRMED — Dependencies:** `backend/pyproject.toml` requires Python `>=3.13,<3.14`; runtime dependencies are FastAPI, Uvicorn standard, SQLAlchemy, Alembic, psycopg binary, pydantic-settings, PyJWT, pwdlib Argon2 and email-validator. Development dependencies include pytest, pytest-asyncio, **httpx** and Ruff. `backend/uv.lock` has no speech SDK, ASR model, LLM SDK, phoneme/alignment library, librosa/torch/transformers or `python-multipart`. Uvicorn's networking/websocket dependencies are not an application speech pipeline. Test `httpx` availability is not a declared production provider integration.

`backend/app/core/config.py::Settings` contains application/database/auth settings, no speech-provider setting definitions. This does not establish whether someone possesses an external account; no private environment was searched. No external provider, including Azure, Google Speech, Deepgram, AssemblyAI, Whisper or an LLM, is configured by checked-in application code.

**RECOMMENDED:** retain FastAPI as the provider boundary, consistent with `docs/superpowers/specs/2026-09-21-fluentt-v0.1-design.md` (Architecture / future AI failures). Any future server SDK/runtime requirements must be checked against the actual Python 3.13 deployment before choosing a pin. Microsoft documents native platform prerequisites; a package name alone is not proof of successful integration. [Speech SDK platform setup](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/quickstarts/setup-platform?pivots=programming-language-python).

## Audio Transport

**CONFIRMED — No current end-to-end path:**

```text
mobile recording [MISSING]
  -> authenticated audio upload [MISSING]
  -> FastAPI validation/format conversion [MISSING]
  -> speech/pronunciation adapter [MISSING]
  -> validated derived result/persistence [MISSING]
  -> mobile feedback [MISSING]
```

Reusable pieces and limitations:

| Existing boundary | Reuse / gap |
| --- | --- |
| `mobile/src/api/client.ts:138::apiClient` | Bearer authentication, expected-owner checks, single 401 refresh/retry and JSON error normalization exist. Its `Content-Type: application/json` default at line 147 is not multipart-aware. It accepts a caller signal but has no general request deadline. |
| `apiClient` refresh path | Refresh has its own 30-second deadline, not an audio-processing budget. Automatic upload replay after 401 would need a tested, rebuildable body and stable pronunciation idempotency key; do not assume reusing a FormData/URI is safe after disposal. |
| `mobile/src/offline/syncWorker.ts::drainReviewQueue` | Has a 30-second per-review request deadline and owner/lease controls. This is a review transport implementation, not a speech timeout/retry contract. |
| `backend/app/auth/dependencies.py::get_current_user` | Authenticated/active-owner access and pending-password restrictions can be reused on a new speech boundary; never trust uploaded `user_id`. |
| `mobile/src/reviews/payload.ts::sanitizeReviewAttempt` | Copies only vocabulary-review facts. Audio/provider state is deliberately outside its allowlist. |
| `offline/reviewQueue.ts::enqueuePendingReview`, `offline/migrations.ts` | Queue stores review JSON and operational lease/retry metadata, no binary audio/file-retention semantics. Backend sync schema is `list[ReviewAttemptCreate]`. |

**CONFIRMED:** no application audio size/duration limit, MIME/container allowlist, sample validation, upload budget, audio rate limit or storage quota is defined. Framework/default infrastructure limits must not be presented as a deliberate speech contract; deployed proxy limits were not inspected.

**RECOMMENDED — Adviser pronunciation online-only:** request permission and record only within the separate activity; upload to the authenticated backend; process one short target; return a structured real result. Require backend/provider reachability. On offline failure show unavailable/retry, never queue binary audio into D3 or claim that a cache file means a durable speech job. Recording/retry while remaining in the activity can be considered with a bounded temporary lifetime; background/offline durable speech upload is deferred.

Multipart is a future choice, not implemented infrastructure: let the transport generate its multipart boundary rather than force the JSON header; metadata parts must be validated and the authoritative target resolved on the server. FastAPI documents the need for `python-multipart`, and that `UploadFile` can spool bytes from memory to disk. A multipart request does not simultaneously carry ordinary JSON body parameters without an explicit metadata encoding choice. [FastAPI request files](https://fastapi.tiangolo.com/tutorial/request-files/).

**BLOCKER — Audio compatibility proof:** select either a verified native PCM profile or a validated backend decoder/converter for actual mobile output. The straightforward Speech SDK stream expects signed 16-bit mono PCM at 8/16 kHz; compressed input uses additional decoding support such as GStreamer. No such configured bridge exists here. [Audio stream requirements](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-use-audio-input-streams), [compressed-input dependencies](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-use-codec-compressed-audio-input-streams).

P02 must specify byte/duration limits, MIME plus actual content/decode checks, malformed/container-bomb handling, timeouts/concurrency, safe temp paths and cancellation. MIME/extension alone cannot validate an audio recording. Keep blocking SDK/conversion work out of the async event loop, bound resources and avoid holding database transactions across remote inference. Mobile cancellation does not prove the provider stopped or that no result was stored; future attempt identity must reconcile that case without duplicate processing/results. These are recommendations, not final endpoint or worker design.

Use a dedicated pronunciation idempotency/result boundary; do not overload `AcceptedClientEvent`'s review response cache. Preserve account isolation across refresh, navigation and account switching. Select an appropriate protected transport for learner audio; the current client fallback `http://10.0.2.2:8000` is an emulator development address, not evidence of a deployed secure audio channel. No transport/config changes occur in P01.

## Data Model / Persistence

**CONFIRMED:** no `PronunciationAttempt`, `SpeechAttempt`, `PronunciationResult`, `AudioRecording`, `SpeechScore` or equivalent table/model exists in `backend/app` or checked-in migrations. Existing model families cover accounts/refresh, learner preferences, language/lesson/vocabulary/revision/release, review sessions/attempts/schedules/current pointer, accepted review events and research events. SQLite has content caches and review queue tables only. No audio binary/blob column or pronunciation result JSON is declared.

**RECOMMENDED — Minimum future information to persist; not final tables/DDL:**

| Information | Why required / likely existing provenance reuse |
| --- | --- |
| Pronunciation attempt ID / original submission identity | Ownership, retry/lost-ack reconciliation and a result that survives navigation; distinct from a review answer UUID domain. |
| Authenticated internal owner | Access control and owner-scoped result reads; join immutable `participant_code` for approved research evidence, not credentials. |
| Exact target identity and mode | Logical item, immutable revision/release, and whether the target is term or example sentence; a mutable item ID alone cannot reconstruct target text. |
| Target text/normalization provenance | Derive from the exact revision; record a versioned selection/normalization rule and, if needed, derived target digest. Do not trust arbitrary client replacement text. |
| Original interaction and processing timestamps | Distinguish learner activity from upload/processing latency; define capture boundary and timezone rule in P02 rather than borrowing D8's recall timer. |
| Provider/model/config identity | Provider, locale, SDK/API version, processing configuration, exposed model version when available, application build/adapter identity. Never invent a model version the provider does not expose. |
| Raw metric values and accepted structured issues | Preserve the allowlisted provider numeric measurements and bounded word/phoneme results used for analysis; raw score values do not require keeping raw audio or full provider dumps. |
| Normalized overall score and scoring version | Reconstruct the chosen research measure independently of UI rounding; formula/metric not locked in P01. |
| A/B/C/D and category-policy version | Deterministic mapping only after approved boundaries; invalid/unscorable cases must not receive a category. |
| Feedback / rule version | Preserve why particular word/sound advice was selected; distinguish provider observations from application explanation. |
| Processing status / safe error reason | Distinguish processing, successful/scorable, unscorable, unavailable and failed outcomes; preserve failure facts without fake scores. Exact state machine remains P02 work. |

Durable derived results are a reasonable minimum for an explainable adviser walkthrough and research reconstruction, even if a full history screen is deferred. Do not count an error as a zero score. Do not put pronunciation measures in `ReviewAttempt.correct`, scheduler state or recall accuracy analytics.

**CONFIRMED — Reusable content provenance:** `content/models.py::VocabularyRevision/ContentRelease` and `content/provenance.py:112::resolve_review_content` already verify exact item/revision/release membership. The resolver returns a vocabulary revision, not user enrollment or a speech locale. A future pronunciation service can reuse that primitive after authentication, plus its own English/target/access checks; do not infer that it enforces a research condition or speech protocol.

**CONFIRMED — Research logging boundary:** `research_logging/service.py::record_research_event` accepts only `REVIEW_ANSWERED` / `REVIEW_SCHEDULED` and `ItemAttemptPayload(scope="item_attempt")`; D9 ties those events to review attempts. It is not a generic pronunciation log. Future speech persistence/event scope needs separate specification without changing canonical review pairs or storing speech data in the existing allowlist. No table or migration design is finalized here.

## Raw Audio / Privacy

**CONFIRMED — Repository finding:** no current path captures, sends or stores raw learner audio. Searches found no audio asset files in the audited source tree, recording cache/URI handling, upload directory, binary database column, object-storage client or audio-storage URL field. Existing SQLite files contain application content/review schemas; no live SQLite was opened here. This is source/storage-design evidence, not a forensic claim about every device, server or third-party account.

**RECOMMENDED — Data-minimizing future pipeline:**

```text
foreground recording in temporary app-private storage
  -> bounded authenticated upload / transient processing bytes
  -> provider assessment
  -> persist approved derived metrics, versions and feedback
  -> close resources and remove temporary raw copies
```

Do not permanently store raw audio by default, base64 it into PostgreSQL/SQLite, include it in generic logs, or add a public recording URL. Permanent research audio retention needs a separately approved purpose, access and retention procedure. Derived transcript/phoneme output can also contain sensitive content; store an allowlisted result rather than an unrestricted raw provider response. Do not assume a fixed script prevents a learner from saying something else.

**BLOCKER — No deletion implementation exists.** Future privacy tests must cover success, rejection, retry exhaustion, timeout, app navigation/background, account change, process termination and restart cleanup. Temporary cache placement is not guaranteed prompt deletion. An active recorder/player/upload or SDK file handle must be stopped/closed before unlinking; deleting a file still in use can break retries or fail on the host platform. Bound the allowed same-session retry lifetime and show the user when rerecording is necessary after cleanup.

Server multipart spooling, decoder intermediate files, SDK buffers, worker crashes, reverse-proxy buffering, diagnostic traces, backups and stale app caches all need review. Explicit cleanup on ordinary completion is insufficient for crashes; scoped expiry/recovery is necessary if files are ever created. Unlinking is not a claim of forensic secure erasure. Keep audio and transcripts out of telemetry/error logs; never log provider credentials.

**EXTERNAL DOCUMENTATION / RECOMMENDED VERIFICATION:** Microsoft's published Speech data policy states that pronunciation-assessment customer data is not retained/stored by that service. That does not establish FLUENTT's own cleanup, every tenant setting, logs, region/contract, portal behavior or another provider's policy. Verify the exact selected service path/settings and approved research data handling before real collection; no batch/blob-retention path is assumed. [Microsoft Speech data handling](https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/speech-to-text/data-privacy-security).

No recording/upload/retention approval is inferred from completing this audit. The task explicitly prohibits audio collection now; later integration tests require their own approved test material and procedure.

## Content / Pronunciation Targets

**CONFIRMED — Existing content fields:**

| Target fact | Current source / limitation |
| --- | --- |
| Word/term | `VocabularyItem.term`, immutable `VocabularyRevision.term`; available in API/mobile types. |
| Definition | Present in item/revision and rendered by `VocabularyCard`. |
| Example sentence | Present in item/revision and API; a candidate scripted short phrase. Mobile renders it when present. |
| Translation | Optional text, not an English reference pronunciation. |
| Reference audio | No field, asset, URL or playback implementation. |
| IPA / phoneme lexicon | None in the application/content schema or seeds. Do not invent IPA strings. |
| Language | `Language.code`, lesson language and `ContentRelease.language_code`; sample releases include `en`/`fil`. No speech-specific locale/accent/model field. |
| Provenance | Exact content revision/release IDs and immutable release membership already exist. Legacy cache rows may lack them; those are insufficient to claim an exact pronunciation target. |

Sources: `backend/app/content/models.py:98/136/168`, `content/schemas.py::VocabularyItemResponse/LessonDetailResponse`, `mobile/src/content/types.ts::PublishedVocabularyItem/PublishedLessonDetail`, and `scripts/seed_content/sample-en-v0.1.json`.

**RECOMMENDED:** use approved existing English revisions as pronunciation targets, with an explicit target kind (term versus exact example sentence) and frozen locale/normalization rule. This avoids a separate content-authoring system for P0. For instance, the inspected sample contains the existing greeting term and its example sentence; this is development material, not an approved formal pronunciation test set or equivalent SRS/ESR set assignment. Validate the target from the backend revision; client-supplied target strings are not authority.

UI language preference `en`/`fil` must not choose the speech assessment locale; English targets remain English even when instructions are localized. Content `difficulty` is instructional metadata, not FSRS Difficulty, a pronunciation score or a CEFR classification. Choosing `en-US` or another supported English locale is a research/provider decision, not a conversion of `en` that P01 silently performs. Provider phoneme labels would be assessment outputs under an explicitly chosen alphabet; they do not create a vetted reference lexicon.

Reference playback is useful but optional for the smallest truthful walkthrough. There is no reference recording to play now. If later added, use a vetted/licensed recording or separately configured TTS and identify its origin; never fabricate a “native reference” asset or add a TTS dependency implicitly.

## NLP / Conversational Components

**CONFIRMED — Separate findings:**

| Component | Existing capability | Adviser priority recommendation |
| --- | --- | --- |
| A. Acoustic pronunciation/speech analysis | None: no recording, recognition, acoustic metrics or feedback. | Critical missing P0 for the pronunciation component. |
| B. Conversational/grammar NLP | None: no chat screen/router, text-analysis service, grammar engine, LLM SDK, prompt abstraction or provider configuration. | Defer unless the adviser explicitly makes it part of this walkthrough. |

The foundation design and research implementation spec explicitly leave NLP/conversation and pronunciation to later work. The word “conversational” in vocabulary-set descriptions and English example sentences is not a conversation engine. Existing labels and translation dictionaries are not automated NLP analysis.

**RECOMMENDED:** demonstrate one real speech-assessment task first. A cloud chat feature would introduce a second provider/latency/privacy/evaluation surface without filling the missing acoustic measure. Scripted pronunciation analysis can support the title's pronunciation-modeling component when described accurately, but integrating an external model is not training a novel model or completing every thesis NLP claim. State the actual system contribution and separately evaluate it; do not rename transcript similarity or generic chat as phoneme modeling.

An LLM is unnecessary for authoritative pronunciation scores. Later LLM-generated wording, if approved, may explain validated observations only; it must not invent acoustic findings, modify numeric metrics/categories, access raw audio by default, or become an unversioned research measure.

## Technology Option Fit

**CONFIRMED repository facts:** no candidate provider is already present. **RECOMMENDED comparisons below are architectural judgments**, not installed integrations, measured latency, verified account access, commercial quotes or research-validity certification. Sources are public primary documentation checked during P01.

| Capability | A. Managed pronunciation assessment | B. ASR + custom transcript similarity | C. Self-hosted ASR/alignment/phoneme pipeline | D. Already-present provider |
| --- | --- | --- | --- | --- |
| Phoneme feedback | Candidate services can expose acoustic unit scores; verify selected locale/config and actual response. | Transcript matching alone supplies no acoustic phoneme accuracy. | Alignment can provide phone timing; calibrated acoustic scoring needs additional model/algorithm work. | None found. |
| Word scoring | Documented assessment metric/issue structure in candidate API. | Recognized/reference word edit agreement, not the same construct. | Requires scored acoustic evidence beyond word timestamps. | None. |
| Overall score | Provider-defined measure available; choose and validate its interpretation. | A custom text-match percentage would be an application metric requiring separate validation; not a defensible automatic substitute. | Must select/implement/calibrate a scoring model and aggregation. | None. |
| Fluency / prosody | Feature/locale dependent; do not assume all are available or appropriate for single words. | Not supplied by text similarity. | Separate pause/rhythm/prosody features and validation required. | None. |
| Granular guidance | Structured observations can feed deterministic teacher-reviewed templates. | Can identify transcript discrepancies, not reliably diagnose a sound error. | Potentially rich after substantial engineering/validation. | No shortcut. |

| Operational dimension | A. Managed assessment | B. ASR + text similarity | C. Self-hosted pipeline | D. Existing provider |
| --- | --- | --- | --- | --- |
| Complexity / architecture | Lowest relative scoring-development burden; new capture/upload/provider adapter still required. Fits Expo -> FastAPI -> provider. | Moderate integration but high methodology risk if called pronunciation scoring. | Highest: models/dictionaries/decoding/acoustic score/runtime/inference operations. | No adapter/infrastructure to reuse. |
| Latency | Network + inference + conversion; measure on actual host/device, no numeric promise. | Depends on ASR deployment/model/network; not measured. | Depends on hardware/model/warmup; not measured. | Not applicable. |
| Internet | Backend needs provider connectivity; mobile connects only to FastAPI. | Hosted ASR needs internet; local ASR changes operational scope. | Can run without external internet after provisioning, but device still needs backend connectivity unless a separate on-device design exists. | Not applicable. |
| Privacy | Audio leaves FLUENTT infrastructure; verify service/region/retention. | Hosted service has the same external-data question; local variant has local operational risks. | Can keep processing local; temporary data/model/ops access still need controls. | No current speech transfer. |
| Versioning/reproducibility | Pin SDK/adapter/config; cloud model may not be fully pinnable. Repeated live scores are not guaranteed bit-identical. | Pin model/API plus text-normalizer and similarity algorithm; deterministic text mapping does not validate the acoustic measure. | Best potential control over weights/lexicon/config, with more deployment effort. | No model to freeze. |
| Cost/account | Speech resource/account, server credentials and approved quota/budget; regional/tier/add-on costs must be checked. | Hosted usage/account or local compute costs; not inherently free. | Compute/storage/deployment/model-license and engineering costs, even without per-call billing. | No existing entitlement established. |
| Risk before Oct 21 | Best relative fit, conditional on access, format/runtime proof and rubric approval. | Risk of delivering a real transcript but misleading pronunciation feedback. | Highest schedule risk from building an unvalidated scoring pipeline. | Cannot reduce the missing P0 work. |
| Thesis defensibility | Reasonable external acoustic engine if limitations, expert comparison and configuration are explicit; not proof of intelligibility by itself. | Weak as sole pronunciation/intelligibility measure; acceptable only as honestly labeled transcript/task matching with an approved research role. | Potentially defensible with a validated acoustic method; forced alignment alone is not a score. | No existing method to defend. |

**Primary-source capability checks:** Azure documents scripted assessment, granularity and HundredMark grading; its Accuracy metric is native-reference similarity, and prosody support is locale restricted. That is a material construct-validity issue for FLUENTT's intelligibility focus, not a reason to describe accented speech as inherently incorrect. SDK/model output still needs educator evaluation for the intended pre-intermediate population. [Assessment configuration and metric definitions](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment), [language/feature availability](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=pronunciation-assessment).

Whisper's model card describes recognition/translation tasks, not a validated FLUENTT pronunciation rubric. Therefore a recognized-text match is insufficient evidence for a particular phoneme diagnosis; that conclusion is an audit inference about construct mismatch. [Whisper model card](https://github.com/openai/whisper/blob/main/model-card.md?plain=1). Montreal Forced Aligner describes time alignment using transcription, dictionary and acoustic models; scoring intelligibility would be additional work. [MFA user guide](https://montreal-forced-aligner.readthedocs.io/en/v3.4.0/user_guide/index.html).

**RECOMMENDED — Conditional selection:** take option A into P02, with Azure as the first feasibility candidate; no final provider is locked. Favor short scripted English over unscripted conversational assessment, and defer prosody/long-form features unless specifically needed and verified. Other managed candidates can be evaluated if access/fit fails; this audit does not imply Deepgram/AssemblyAI/Google automatically offer equivalent phoneme assessment. No fallback may fabricate a pronunciation score.

**BLOCKER — Measurement validity and cloud freeze:** commercial acoustic accuracy is not automatically a direct human intelligibility score or accent-neutral proficiency assessment. Approve the research construct and expert/reference comparison before research claims. If the service does not expose a pin-compatible model version, record that limitation, observed service metadata/configuration and a change-control procedure; pinning the client SDK alone does not freeze the hosted engine. Pricing/access must be verified for the selected resource; no free-tier/budget guarantee is made. [Official Speech pricing](https://azure.microsoft.com/en-us/pricing/details/speech/).

## Scoring Gap

**CONFIRMED:** no normalization, grade thresholds, acoustic quality gate, scoring formula, score-version registry or persisted raw metric exists in the application. A/B/C/D cannot be produced honestly today.

**RECOMMENDED — Inputs P02 must obtain from the selected engine and procedure:**

| Decision to lock | Necessary evidence / output |
| --- | --- |
| Research measure / raw metric | Explicit provider metric name, meaning, range, aggregation and limitations; distinguish pronunciation accuracy, completeness, fluency and overall composite. |
| Normalized 0-100 score | Approved direct mapping or explicit versioned formula, precision/rounding and missing-component rules. Prefer an interpretable native metric over invented weighted sums, but do not select the final metric here. |
| Categories | Approved ordered boundaries, inclusive/exclusive edge rules and deterministic mapping version. No values are chosen in P01. |
| Valid/scorable recording | Decodable valid format, nonempty speech, expected task/target and adequate evidence. No fabricated zero/category D for silence, malformed input or provider outage. |
| Confidence / noisy audio | Determine which quality/confidence signals are actually available, how missing signals behave, and pilot criteria. ASR confidence is not automatically acoustic quality or pronunciation confidence. |
| Target mismatch | Reference alignment/recognized-word evidence and explicit omission/insertion/unrelated-speech handling. Do not treat every ASR discrepancy as mispronunciation. |
| Word issues | Stable token positions, scores/error tags, omission/insertion semantics and teacher-approved selection/ordering/cutoffs. Preserve repeated-word positions, not just a dictionary keyed by spelling. |
| Phoneme issues | Verified phoneme alphabet, expected-unit labels/alignment/scores and what the engine actually measures. A low expected-phoneme score does not prove the learner produced a particular replacement phoneme. |
| Retry / repeat behavior | Separate a new practice recording from resubmission of the same attempt; stable idempotency, bounded retry and protocol for which attempts are analyzed. |

Microsoft's reference tool illustrates structured overall/word/phoneme results; those examples are external documentation, not FLUENTT output or threshold validation. Use actual supported adapter responses in later approved testing. [Documented result structure](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/pronunciation-assessment-tool).

**BLOCKER:** exact metric, normalization, score/category boundary semantics, quality gates and feedback selection rules need adviser/educator review and representative pilot evidence. Provider word-error cutoffs must not silently become FLUENTT's A/B/C/D thresholds. Research evaluation also needs reference ratings/criteria and a predeclared treatment of invalid/missing/repeated attempts.

## A/B/C/D Category Gap

**CONFIRMED:** no graded pronunciation result component or A/B/C/D translation namespace exists. `VocabularyCard`'s difficulty badge and content `category` are unrelated. `ReviewResultScreen` cards and `ProgressScreen` numeric layout are reusable presentation patterns only; their metrics/routes are not pronunciation storage.

Reusable components/patterns: `mobile/src/components/AppText.tsx::AppText`, `useTranslation` and `mobile/src/i18n/locales/{en,fil}.json`, SafeAreaView, Pressable, ActivityIndicator, text/error/retry panels and scrollable result cards. There is no reusable speech waveform, grade legend, phoneme issue list or audio playback component.

**DEFERRED — P02 presentation decisions:** exact threshold boundaries; category label meanings and nonjudgmental learner copy; score-versus-rounded-display behavior; color plus text/icon treatment and accessibility; retry encouragement; whether to show word details by default; and unscorable/unavailable copy. These categories are feedback/performance bands, not CEFR, proficiency certification or judgments about accent/ability. Do not use color alone or assume A-D have approved meanings already.

Invalid/unscorable recordings need their own outcome and retry path, with no score/category disguised as failure performance. The requested adviser category step requires an approved mapping first; until then an honest real-metrics preview can show that categories are not configured, but cannot be called a completed A/B/C/D feature.

## Feedback Gap

**RECOMMENDED — Deterministic provider-derived path:** validate the response; retain approved numeric observations; select bounded word/phoneme issues using frozen rules; render teacher-reviewed templates. Template/rule versions must be distinguishable from provider/model/config and category-policy versions. The application, not an LLM, owns the reproducible research score/category.

| Feedback granularity | Feasibility / limitation |
| --- | --- |
| Overall score/category | Feasible after metric/mapping approval; UI rounding cannot change category assignment. |
| Word accuracy / missing words | Can use verified structured word results and target positions. Omission is not an articulatory diagnosis. |
| Phoneme issue | Possible only when selected locale/config produces validated unit evidence; display the actual alphabet correctly. Never invent IPA or certainty about an observed replacement sound. |
| Fluency / completeness | Candidate secondary observations for an appropriate scripted phrase; applicability to a single isolated word must be reviewed. |
| Prosody | Optional scope; do not promise availability or meaningful short-word measurement. Defer P0 unless justified. |
| “Practice this sound” | Requires reliable unit selection plus an educator-approved sound-to-explanation/example mapping. No such pedagogical mapping exists in the content repository. |
| General retry encouragement | Deterministic localized templates can work without another provider. Avoid implying that retries necessarily improve the score. |

**DEFERRED:** an LLM could later paraphrase validated observations, but would need its own privacy, prompt/version, grounding and output checks. Raw generated text must not be the authoritative score, category, phoneme evidence or evaluation rubric. No conversational engine is needed for P0, and no AI explanation is presented as existing.

## Failure / Edge Cases

**CONFIRMED:** no pronunciation-specific failure handling exists. The following is a future audit matrix, not an implemented HTTP/status contract. “User-correctable” refers to remedy; a repeated invalid payload is not automatically network-retryable.

| Case | Recommended classification / response |
| --- | --- |
| Microphone denied / permanently denied | User-correctable permission state; explain the purpose and settings route. No recording/upload, no repeated permission loops or fake result. |
| No file / empty bytes | Invalid submission; user records again. Reject before provider work; no score/category. |
| Too short / too long | User-correctable capture validation after approved limits; stop/bound recording. Do not invent limits in P01. |
| Silence / no recognized speech | Unscorable, user-correctable; invite a clearer recording. Not score zero or category D. |
| Unsupported/corrupt/spoofed format | Invalid unchanged input; validate actual decoder evidence, safe failure and cleanup; recapture or use supported conversion. |
| Network unavailable / upload interrupted | Retryable availability issue while a permitted temp recording still exists; otherwise rerecord. No D3 review-queue insertion. |
| Provider timeout/unavailable/rate limit | Retryable service failure with bounded policy/backoff. No low grade, false success or automatic unbounded paid reprocessing. |
| Provider authentication/config failure | Operator-correctable service error; not learner auth failure. Preserve existing user session; never return a learner 401 solely because the provider key is invalid. |
| Learner auth/owner mismatch | Existing app authentication/ownership rules; pause/require appropriate human authentication. No cross-owner result/read/upload. |
| Malformed provider response / nonfinite/out-of-range metric | Backend integration failure; no partial “successful” result and no clamping/default invented score. Operator diagnostics must be sanitized. |
| Low confidence / noisy audio | Quality/unscorable policy depends on available signals and pilot review; do not confuse microphone quality with learner performance. |
| Target mismatch / unrelated speech | Task/provenance or unscorable outcome under the approved rule; distinguish partial target completion from a recording that does not support a score. |
| Repeated submit / lost acknowledgement | Same pronunciation attempt resolves original status/result without duplicate durable result/provider call where controllable. Fresh practice recording gets a fresh identity; exact policy belongs to P02. |
| Navigation/background during recording | Stop/release microphone and handle temp cleanup; no invisible background capture. Explicitly invalidate or retain only under a documented bounded policy. |
| Navigation during processing / late response | Cancel/ignore stale UI completion; if server work completed, reconcile by owned attempt identity later. Do not show another target/owner's result or assume HTTP cancellation undoes provider processing. |
| App killed during temporary audio/processing | Defined recovery/expiry; no promise that a cache file or in-memory UI state is durable. Derived server result should remain queryable under owner identity if committed. |

**RECOMMENDED:** a service/config outage must not be represented as a permanent bad learner recording. Existing `syncWorker::classifySyncFailure` is evidence about review sync only, not a reason to attach speech to that queue. New error semantics must preserve D3/D8/D9 behavior and avoid credentials/audio in error traces.

## Adviser-Build Minimum

**RECOMMENDED — One P0 vertical slice, English, short scripted target, online-only, real engine:**

1. Open a separate pronunciation activity from an existing released English vocabulary item; display one exact approved term or example sentence with clear instructions.
2. Request microphone permission; provide truthful denied/unavailable handling.
3. Record visibly in the foreground, show duration, stop, cancel/rerecord and release microphone on exit. Optional temporary playback is useful but not a scoring prerequisite.
4. Submit once to authenticated FastAPI with exact target provenance and distinct pronunciation attempt identity; show processing and guard duplicate taps.
5. Validate/convert actual audio and call the approved managed assessment configuration with bounded resources/timeouts.
6. Display a real named overall metric and, **only after approved mapping**, A/B/C/D; show at least one supported specific word/sound observation when an issue exists. If none is supported, do not invent an issue to fill the screen.
7. Permit a fresh practice retry; preserve the derived owned result/versions and clean up raw temporary copies under the approved policy.

The adviser should see one successful real recording, one no-speech/unscorable case and one clear availability/permission failure, with no fabricated score. A short evidence check must demonstrate that pronunciation results leave review attempts/schedules/current pointers and D10 evidence unchanged. This is an acceptance target for later authorized work, not a walkthrough performed by P01.

**BLOCKER — Full demo acceptance:** the provider path and recording-format compatibility must actually work on the adviser device/build, and metric/category/feedback/quality rules must be approved. If thresholds remain unresolved, label the real-metric preview incomplete; do not claim the full category flow is ready. No new real-audio test is performed during this audit.

**DEFERRED:** advanced history UI/charts, offline audio queue/processing, long-form speech, unscripted conversational pronunciation, chat/grammar NLP, custom model training, large datasets, gamification, admin analytics, custom reference-audio libraries, sophisticated prosody teaching and cross-platform parity beyond verified adviser scope. Deferring advanced history does not mean discarding the minimum derived research evidence.

## Test Gap Matrix

**CONFIRMED:** current tests cover the existing auth/content/review/sync/timing/progress foundation. No pronunciation recorder/provider/scoring/category/privacy test suite exists. The cases below are future work only; no new tests are written or executed by P01.

| Area | Future test | Required evidence |
| --- | --- | --- |
| Mobile | Permission granted | Exactly one permission/capture lifecycle; actual recorder becomes ready. |
| Mobile | Denied / permanently denied | Clear corrective state, no upload/capture; settings/retry behavior does not loop. |
| Mobile | Record / stop / cancel / retry | Valid duration/URI, old resource disposal, fresh recording identity, no hidden capture. |
| Mobile | Processing / duplicate taps | Single in-flight attempt; buttons/stale responses guarded. |
| Mobile | Result rendering | Named metric, deterministic category edge behavior, safe word/phoneme rendering, missing optional details handled honestly. |
| Mobile | Request fails / offline | Truthful unavailable/retry, no low-score substitution and no review-queue/audio payload. |
| Mobile | Navigation/background/unmount/account change | Stop/cancel/cleanup, no post-unmount update or cross-owner/target result. |
| Mobile | Native format/permissions | Physical adviser device file decodes with measured actual codec/sample rate/channels; rebuilt native permissions verified. Android does not prove iOS/web. |
| Backend | Authorized request / result lookup | Owner from auth, not request body; user cannot read another user's attempt. |
| Backend | Wrong learner/content/revision/release/locale | Reject unowned result access and invalid exact target provenance before provider invocation. Shared content is not inherently learner-owned. |
| Backend | MIME/container/empty/size/duration | Actual format validation and bounded decode; spoofed header/extension cannot pass by itself; no partial success. |
| Backend | Provider success | Strict parse, supported schema, finite metrics, correct status/provenance/version persistence. |
| Backend | Timeout/unavailable/rate limit/config rejection | Distinct retry/operator failure, bounded calls, no credentials leak or learner-session invalidation. |
| Backend | Malformed response | Missing/nonfinite/out-of-range metrics or bad alignment cannot create successful score/category. |
| Backend | Normalization/category mapping | Exact frozen formula, no missing-value defaults, all inclusive/exclusive boundaries, UI rounding independence. |
| Backend | Word/phoneme feedback mapping | Deterministic issue selection, token positions, expected-versus-observed distinction and template/rule version. |
| Backend | Duplicate/resubmit/lost acknowledgement | Owned idempotency, at most one durable result per original submission; failure recovery does not blindly charge/reprocess duplicates. |
| Backend | Temp/privacy lifecycle | After success/failure/cancel/restart, no retained raw copy beyond the approved lifetime; spooled/conversion files and logs inspected in an isolated test environment. |
| Integration | Approved real test recording + known target | Capture -> upload -> format bridge -> real provider -> parsed result -> UI; retain sanitized derived evidence, no invented screenshot score. |
| Integration | Repeatability / version metadata | Stable schema and deterministic application mapping; record observed cloud variation, SDK/config/provider identities and any unexposed model limitation. No bitwise live-score promise. |
| Integration | Silence / noise / unrelated speech / pronunciation-error example | Proper scorable/unscorable/feedback behavior with educator-reviewed examples; do not equate noise or ASR mismatch with learner inability. |
| Integration | Latency/navigation/timeout | Measured actual performance on target network/device; late result reconciliation and cleanup. |
| Research | Build/provider/model/scoring/category/feedback versions | Every derived result reconstructs applicable settings; unknown hosted model version is explicit, never invented. |
| Research | Threshold/rubric freeze | Adviser/educator-approved categories/quality rules before categorization; separate demo and formal research status. |
| Research | Expert/reference comparison | Defined intelligibility/accuracy reference task, representative recordings/microphones, agreement/limitations and missing/retry treatment. No numerical validation criterion invented by P01. |
| Research | Scheduler independence | Vary pronunciation outcomes with identical review facts; zero review-chain/pointer mutation or engine selection change. |
| Research | Derived evidence preservation | Owned target/version/metric/status provenance survives navigation/restart without permanent audio; D9 canonical review event semantics unchanged. |

Mocks/recorded response fixtures can verify parsing and mapping later, but must not be shown as live learner scores. A real provider/device integration test is an additional gate; prerecorded fixtures do not replace it. Test audio must be approved and not silently retained as production research audio.

## Chapter 3 Alignment

**DEFERRED — Checklist only; manuscript unchanged.** The pronunciation method will need to state:

- Selected engine/provider/model availability, SDK/API/configuration/locale and build freeze; limitations if cloud weights cannot be pinned.
- Scripted target selection, speech capture/format/quality rules and acoustic processing method, distinct from ASR transcript similarity and conversational NLP.
- Named raw measure, normalization/aggregation, score precision and invalid/missing/retry handling.
- Deterministic feedback mechanism and evidence supporting word/phoneme advice.
- Meaning of A/B/C/D as performance feedback, approved thresholds/boundaries and validation; no CEFR/accent-elimination claim.
- Temporary audio processing, retention/deletion/access and derived-data policy.
- Educator/expert/reference evaluation appropriate to intelligibility/accuracy and the learner population; separate pronunciation outcomes from ESR retention and software quality.

Relevant existing authority: `docs/research/fluentt-research-implementation-spec-v1.md`, research-build freeze and unresolved pronunciation/privacy decisions. No externally supplied SDK score substitutes for a validated research instrument by implication.

## Recommended Milestones

**RECOMMENDED — Sequence adjusted to remove the highest-risk dependency early:**

| Milestone | Reviewable scope / exit gate |
| --- | --- |
| **P02 — Architecture, measurement and scoring specification** | Approve provider candidate/access/budget/locale, capture/format route, target provenance, quality/timeout/idempotency/privacy policy, minimum derived evidence, metric/normalization, category thresholds and feedback rules. Add a bounded feasibility gate for actual device format + backend runtime + real provider using separately authorized test material; stop before full UI if this fails. P01 performs none of that probe. |
| **P03 — Recording UI/capture** | Separate foreground activity with permission, record/stop/cancel/retry/cleanup, actual selected native output and target display. Check Expo SDK 57 docs and approved dependency/config changes; preserve D10 review timing. No fake score while provider work is absent. |
| **P04 — Backend/provider integration** | Authenticated bounded upload, provenance/format validation/conversion, selected adapter, strict response handling, owned idempotency/status and minimum derived persistence. Native/runtime/service prerequisites and cleanup proven. |
| **P05 — Deterministic score/category/feedback** | Implement only approved named metric/normalization, A-D boundaries and grounded feedback rules; version and test them, keep invalid/unavailable outcomes distinct. Can overlap P04 fixtures after P02 contract approval. |
| **P06 — Integration/regression/adviser rehearsal** | Real approved recording, silence/noise/error examples, native lifecycle/privacy/ownership/scheduler-isolation checks, device/network latency and sanitized derived evidence. Rehearse the complete adviser flow before Oct 21; explicitly report any unresolved gate rather than fabricate completion. |

This is a recommended handoff, not an implementation plan or authorization to install, provision services, collect audio or edit code. A new pronunciation integration should not be folded into unfinished D11 scheduler implementation or alter accepted D10 evidence. Formal research approval/freeze remains separate from adviser build usability.

## Blocking Decisions

**BLOCKER BEFORE FULL P0 IMPLEMENTATION / DEMO COMPLETION:**

1. Choose/authorize the managed provider candidate, resource/region/locale and acceptable cost/quota; establish private server configuration later without exposing keys. No account entitlement is proven by repository inspection.
2. Approve one short English target mode and exact released content for adviser testing; choose real target device/build and establish audio format/decode/runtime compatibility. Do not assume existing Expo Go/lab APK has newly required native behavior.
3. Select the actual metric and normalization, then approve A/B/C/D meaning, thresholds/boundaries, unscorable/quality rules and deterministic word/phoneme-feedback rules. Do not invent values because the demonstration date is close.
4. Approve recording/upload consent and temporary lifetime/deletion procedure, derived-data allowlist and access policy; define invalid recording, offline/timeout/retry and duplicate handling. This audit does not authorize collection.
5. Decide how to document externally mutable/undisclosed model versions and how adviser/educator reference judgments will assess the intended intelligibility/accuracy construct.

**FORMAL RESEARCH BLOCKERS:** validated rubric/reference procedure, approved representative targets/instruments and repeat/missing-data rules, frozen provider/config/scoring/category/feedback/build identities, pilot evidence, data-governance approval and full regression/native verification. Demonstration success alone does not resolve these.

**DEFERRED, NOT P0 BLOCKERS:** conversational/grammar NLP, offline speech queue, advanced history/analytics, long-form/prosody extensions, custom training and a separate reference-audio content system. If any is later declared a formal research requirement, it needs its own specification/evaluation rather than an implied claim of completion.

## Final Recommendation

**P01 READY FOR DESIGN REVIEW**

Proceed next to P02 specification review, with a managed scripted pronunciation-assessment candidate behind FastAPI and an early authorized capture/format/runtime/provider feasibility gate. Current pronunciation functionality is absent; the reusable foundation is authentication, released English text/provenance, UI conventions and backend persistence infrastructure. Neither transcript matching nor a generated number fills the missing acoustic assessment.

The biggest technical schedule risk is establishing a real native recording-to-provider path, including format conversion and service/runtime access; the biggest research risk is adopting a native-reference metric/category rubric without validating its fit to intelligibility. Both are explicit decision gates. No provider selection, score threshold or latency promise is locked by this audit.

**Verification boundary:** the final checks require the expected branch/HEAD, empty tracked/staged diffs, `git diff --check`, a whitespace/required-section check on this new untracked report, and unchanged SHA-256 values for the three existing untracked artifacts. No application tests are claimed as newly run for this documentation-only audit. Only `docs/development/p01-pronunciation-preimplementation-audit.md` is created; no existing document/source/manifest/lockfile/migration or Chapter 3 file is edited, no audio/service/database operation is executed, and no commit or push occurs.
