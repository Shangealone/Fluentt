# Personal activity history — 2026-10-21

The user explicitly requests a History feature under personal Stats showing lessons/questions practised in Learn, Voice and Tutor. This authorizes a new personal-only activity writer; it does not authorize academic grades, mastery, scheduler activity, classroom monitoring or research outcomes.

## What the learner sees

Open **Stats → History** in `/personal-stats`. Overview remains available, and the bottom navigation stays on Stats. All activity / Learn / Voice / Tutor filters, dates, empty/loading/error states, refresh and bounded newer/older paging are available. Question previews can expand for longer text. History starts with actions after this feature is enabled; earlier unsaved practice cannot be reconstructed.

| Source | Receipt trigger | Saved display |
|---|---|---|
| Learn starter word/sentence | First deliberate Check answer for that question visit, including an incorrect answer | Activity title, public spoken question/phrase, language, source ID/version, receipt time |
| Learn published question | Next/Finish with an entered answer; skipped/empty questions do not count | Lesson title and public question prompt, revision ID/version, language/time |
| Learn lesson set | Finish a starter activity or a published set with an entered answer | Activity/lesson title and time; no academic completion claim |
| Voice | Final whole-phrase recognition settles, or a complete recording receives genuine provider assessment | Reference phrase and activity/version; no learner transcript, audio or score |
| Tutor | A reply is successfully accepted; an ended scenario with turns also receives a separate receipt | Scenario title/session reference and activity time; no dialogue text |

Retrying a checked starter answer does not create another receipt for the same question visit. Repeating a new visit can create a new entry. Flashcard reveal alone is not an answered question; a deliberate recall choice can be recorded when continuing. Actual answer values, private keys/backs, correctness/grades, voice files, transcripts and Tutor messages are not copied. Existing conversation message-retention rules are not expanded. Activity logging is separate from the optional Azure evaluator, which remains disabled until its own prerequisites are configured.

These are **client-reported-activity-v1** receipts, not independently verified performance evidence. The server authenticates ownership and validates bounded metadata; it cannot prove a client actually answered or spoke. Source strings are display references, not permission to retrieve another resource. Published content identifiers/versions are retained where available, and prompt/title snapshots remain visible in the owner's log without substituting newer questions. No backfill or synthesis of historical events occurs.

## Data/API boundary

New `personal_activity_events` is separate from LearningContext, LearnerProgress, review state/events, assignments, conversations and research tables. No academic/scheduler/progress aggregation or existing progress writer is introduced. The original `/me/progress` and `/me/learning-history` personal responses remain unavailable/NULL as before; they are not repurposed to produce statistics from this log.

- `POST /api/v1/me/personal-history`: UUID `event_key`, whitelisted kind, bounded source/title/public prompt, language and optional content version. Unknown owner/class/study/participant/answer/score/audio/time fields are refused. Tutor prompts are specifically forbidden. Server supplies receipt time and owner.
- `GET /api/v1/me/personal-history?area=all|learn|voice|tutor&offset=0&limit=20`: owner-only deterministic time/UUID ordering; default 20, maximum 50, bounded offset. Mobile pages 20 rows and validates DTOs.
- Current active personal role and device session are checked inside the existing authenticated user/session transaction. No arbitrary user selector, classroom route or researcher permission is added. Existing transport/throttle and no-store policies apply.
- Unique owner/event-key plus exact request fingerprint makes an identical retry idempotent and changed-body replay a 409. Existing owner locks serialize concurrent retries. Database trigger requires active personal ownership and prevents update/delete of receipts. PUBLIC grants are revoked; production non-owner runtime grants/retention or erasure operations require separate operator review.
- The client records only actual interaction callbacks, ignores stale responses after blur/account/set changes, and displays a failed-save notice with an explicit retry using the same UUID/body. It does not invent a saved record or silently retry. Learning remains usable during a history outage. Pending receipts are memory-only and are discarded on leaving; offline history/recovery after process termination is not implemented.
- History requests have a scoped 45-second client timeout so a concurrent whole-phrase provider request holding the same authenticated-owner lock does not trigger the ordinary eight-second timeout. Other API timeouts are unchanged.
- No new browser/device history cache or credentials store is added. Real-account records persist in PostgreSQL and were verified through a fresh API instance. The explicitly synthetic demo starts empty, records only actual sample actions, keeps receipts only in provider memory, and resets on preview reload/demo reset. It never falls back to live or fabricated records.

## Migration and local runtime

Source head is **0018_personal_history**, **71 registered domain tables**. New migration follows frozen 0017, adds only the personal ledger/indexes/guards, and does not alter old tables or backfill rows. Downgrade refuses retained history and succeeds when the new ledger is empty. Existing migrations were not edited. The schema comparison test now recognizes the one additive table; a research migration guard test compares rollback to the current source head rather than a stale hardcoded 0017.

Migration tests used generated disposable UUID PostgreSQL databases only. After those tests passed, the verified localhost development database (port 55432, environment=development, initial revision 0016) received its normal cumulative forward upgrade to 0018. This also applies the previously pending, default-off 0017 research schema prerequisite; its tables receive no study/participant/consent records. Row counts for every pre-existing public/research-private table were checked before/after in the transaction and remained unchanged. No production database, research activation or human outcome was modified.

The hidden local API/Expo preview processes were restarted. The ignored API `.env` now adds the exact `http://localhost:8096` CORS origin alongside existing origins; no wildcard, credential value or Azure setting was changed. Actual History preflight is HTTP 200 with that exact allowed origin; unauthenticated GET remains 401. No commit, push or deployment occurred.

## Exact verification

| Check | Actual result |
|---|---|
| `node --test scripts/personal-history.test.cjs scripts/personal-practice.test.cjs scripts/dashboard-components.test.cjs scripts/live-pronunciation.test.cjs scripts/conversation.test.mjs scripts/whole-phrase.test.mjs scripts/pronunciation.test.mjs` | **65 passed**, none failed/skipped; existing Node module-type warnings |
| API `.venv/Scripts/python.exe -m pytest tests/test_personal_history.py tests/test_schema.py -q --tb=short --maxfail=2` | **32 passed, 1 pre-existing failure** |
| API `.venv/Scripts/python.exe -m pytest -m 'not postgresql' -q --tb=short --maxfail=2` | **775 passed, 1 pre-existing failure, 204 deselected**, 2 dependency warnings |
| Disposable PostgreSQL via `pytest.main(['tests/integration/test_personal_history_postgresql.py','tests/integration/test_whole_phrase_postgresql.py','tests/integration/test_personal_practice_postgresql.py','tests/integration/test_research_final_verification_postgresql.py','-q','--tb=short','--maxfail=2'])` | **11 passed**, 2 dependency warnings |
| Separate disposable PostgreSQL `tests/integration/test_research_classrooms_postgresql.py::test_database_immutability_cross_study_guards_and_safe_downgrade -q --tb=short` | **1 passed**, 2 dependency warnings |
| API `.venv/Scripts/python.exe -m ruff check app/models/personal_history.py app/modules/personal_history migrations/versions/0018_personal_history.py tests/test_personal_history.py tests/integration/test_personal_history_postgresql.py` | Passed |
| Mobile `npm run typecheck`; `npm run lint` | Passed; lint 0 errors / 29 existing warnings |
| Mobile `node node_modules/expo/bin/cli export --platform all --no-bytecode --max-workers 2 --output-dir <unique temporary path>` with offline/CI settings | Web, Android and iOS JavaScript exports passed; not a native binary/device test |
| Actual browser synthetic personal demo | Empty history → checked Tagalog question → accepted/ended simulated Tutor conversation → corresponding metadata entries. Learn/Voice filters verified; Voice correctly empty without real speech. Screenshots in `output/personal-history/`. |

The sole full-suite failure remains the older exact-column assertion in `test_schema.py::test_learning_focus_is_additive_and_retains_grade_history`, which omits pre-existing `learning_experience`. It was not changed to conceal the disagreement. Initial new UI-test harness failures were corrected (component-prop inspection and React import interop); subsequent checks above passed. All test keys/identities/content/events are explicitly synthetic. Real microphone/native recording, live Azure, deployment grants and offline recovery were not claimed or tested.

## Changed files for this request

- Backend: new `services/api/app/models/personal_history.py`, `app/modules/personal_history/{__init__.py,router.py}`, `migrations/versions/0018_personal_history.py`; additive registry/router changes in `app/models/__init__.py`, `app/api/v1/router.py` (paths relative to `services/api/`).
- Mobile: new `apps/mobile/src/services/api/personalHistory.ts`, `src/demo/personalHistory.ts`, `src/features/history/{useActivityHistory.ts,HistorySaveNotice.tsx,PersonalHistory.tsx}`; edits to `src/session/provider.tsx`, `src/app/{personal-stats.tsx,question-practice.tsx,pronunciation.tsx}`, `src/features/learning/BeginnerPractice.tsx`, `src/features/pronunciation/LivePronunciationPractice.tsx`, `src/features/conversation/ConversationPractice.tsx` (remaining paths relative to `apps/mobile/`).
- Tests: new `scripts/personal-history.test.cjs`, `services/api/tests/test_personal_history.py`, `services/api/tests/integration/test_personal_history_postgresql.py`; modified `scripts/{personal-practice.test.cjs,live-pronunciation.test.cjs,dashboard-components.test.cjs}`, `services/api/tests/test_schema.py`, and the current-head assertion in `services/api/tests/integration/test_research_classrooms_postgresql.py`.
- Docs/artifacts: this document, `docs/{PERSONAL_LEARNING.md,PROGRESS.md,PRONUNCIATION.md,DATABASE_SCHEMA.md,MIGRATIONS.md,DECISIONS.md}`, `PROJECT_HANDOFF.md`, `output/personal-history/{activity-history.png,learn-history.png}`; ignored local API `.env` exact-origin configuration. Existing unrelated working-tree edits are preserved.
