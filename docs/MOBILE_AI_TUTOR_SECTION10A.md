# Section 10A — GroqCloud AI Tutor backend

**Status: PARTIAL (2026-11-02).** The redesigned application at `.local-version-2` now has a real, opt-in Groq adapter for authenticated English and Tagalog scenario turns. Three synthetic live requests reached Groq after a replacement key was entered locally. English and Tagalog first-turn roleplay succeeded; the English follow-up repeated its prior reply, so context-sensitive continuity did **not** pass. Production student use remains disabled.

## Active application and existing contract

The active redesigned app uses `apps/mobile` and `services/api`. Its FastAPI conversation routes are under `/api/v1/me/conversation`. Supabase is used through the existing PostgreSQL connection and existing mobile account/session logic; this section did not change signup, login, account tables, schema, migrations or production records. The older top-level `mobile/backend` checkout and the older WavLM project were not changed.

Existing routes were retained:

| Operation | Route | Behavior |
| --- | --- | --- |
| Browse scenarios | `GET /me/conversation/topics?language=english|tagalog` | Existing published scenario definitions |
| Start | `POST /me/conversation/sessions` | Authenticated, approved development-account gate; existing scripted starter is labeled `simulated=true` |
| Resume/read | `GET /me/conversation/sessions/{id}` | Existing owner check via `LearningContext.student_id` |
| Send | `POST /me/conversation/sessions/{id}/messages` | Authenticated owner, sends latest message and bounded prior turns to Groq; returns a real reply only on actual provider success |
| End | `POST /me/conversation/sessions/{id}/end` | Existing formative summary; not a proficiency grade |

The send response retains its existing fields and adds `provider="groq"` and the configured `model_version`. `simulated=false` is returned only after successful provider output. `feedback.summary`, `corrections` and `suggestions` are generated separately from `assistant_message.content`. Numerical relevance/confidence fields are null for Groq output; the model is not asked for or treated as an academic rating. Malformed provider output gives an error, never a scripted replacement. The starter prompt and end summary remain existing scripted content. Historical feedback details are not persisted by the current `ConversationMessage` table; resumed sessions return the dialogue, not previous correction cards.

## Provider and limits

Official SDK `groq==1.7.0`, model `openai/gpt-oss-20b` by default (`GROQ_MODEL` configurable). Groq's documented Chat Completions interface supports `max_completion_tokens`, `reasoning_effort="low"` for this model and JSON object responses ([model](https://console.groq.com/docs/model/openai/gpt-oss-20b), [API](https://console.groq.com/docs/api-reference), [Python SDK](https://github.com/groq/groq-python)). Only the backend reads `GROQ_API_KEY`; the key is never returned or logged.

- Feature is off by default and fails closed outside `FLUENTT_ENVIRONMENT=development`.
- An authenticated user's UUID must be in `GROQ_TUTOR_ALLOWED_USER_IDS`, intended only for synthetic test accounts. No client-supplied learner ID is trusted.
- Maximum eight recent messages, each at most 1,000 characters, and 300 completion tokens. Backend scenario instructions are sent as a separate system message; learner turns are only user messages.
- In-process limit: five requests per user per minute and two concurrent requests by default. These are not distributed limits; shared/global rate limiting is needed before multi-worker deployment.
- SDK timeout is 20 seconds per attempt by default and one SDK retry handles transient failures including 429 with provider `Retry-After`. Provider 429 returns a bounded `Retry-After` header. Network, timeout, provider authorization, quota and malformed output errors return safe, distinct error codes. Logs contain status, elapsed milliseconds and model ID only, with no prompt or key.
- A repeated reply identical to the previous assistant message is now rejected with `tutor_repeated_reply` instead of being saved as a successful turn. This guard was added after the live pilot and has only mocked-test verification so far.
- Existing request middleware sets `Cache-Control: no-store` for `/api/v1/me/` success and error responses.

## Data handling and deployment blocker

The pre-existing service stores user and assistant dialogue in `conversation_messages`, associates it with the authenticated user's learning context, and marks a 30-day retention deadline on `conversation_sessions`. There is no verified deletion worker or approved live-student consent/retention policy in this section. Groq would receive the recent messages and scenario context. Because the user's retention policy choice was deferred, enabling this for real student conversations is **blocked**. Only synthetic development accounts/messages may be allowlisted. A future section must settle consent, third-party data handling, actual deletion enforcement and production rate limiting before live student use. This section did not delete or alter existing conversations.

## Configuration and local startup

Example-only values are in `services/api/.env.example`. Put the real key solely in ignored `services/api/.env` or a deployment secret manager. Development setup needs `GROQ_TUTOR_ENABLED=true`, `GROQ_API_KEY`, and `GROQ_TUTOR_ALLOWED_USER_IDS` containing only synthetic test account UUIDs. The selected model, timeouts and limits are configurable there. The first key was pasted into chat, so it must be revoked. A replacement was entered via an ignored, hidden-input local script. Presence was verified without displaying it.

From `services/api` (after configuring the existing database connection and installing `requirements.lock.txt`):

```powershell
& .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8003
```

This starts the API only; it does not authorize or prove a live Groq call. The existing mobile `apps/mobile` project may use its usual Expo startup for later Section 10B testing.

## Changed files

- `services/api/app/core/config.py`: Groq configuration fields.
- `services/api/app/modules/conversation/groq_provider.py`: backend-only adapter, JSON validation, rate/concurrency limits and provider error mapping.
- `services/api/app/modules/conversation/provider.py`: registry now routes real turns through Groq without a simulated fallback; local heuristic engine remains available for legacy tests only.
- `services/api/app/modules/conversation/router.py`: authenticated development-account gate and settings propagation.
- `services/api/app/modules/conversation/service.py`: real model metadata, transaction-safe `flush()` in conversation writes, owner-bound context/history.
- `services/api/app/modules/conversation/schemas.py`: nullable unvalidated numerical feedback fields and response metadata.
- `services/api/.env.example`, `requirements.txt`, `requirements.lock.txt`: placeholder configuration and pinned SDK. Also pinned `python-multipart==0.0.33` because existing audio endpoints prevented FastAPI app import without it.
- `services/api/tests/test_conversation_practice.py`, `tests/test_groq_tutor.py`: updated transaction/contract tests and synthetic provider cases.
- `apps/mobile/src/services/api/conversation.ts`: response type compatibility only; no mobile UI redesign.
- `apps/mobile/src/services/api/client.ts`: tutor-specific unavailable, provider and retry messages so an intentionally disabled tutor is not mislabeled as a backend outage.
- This report.

No WavLM, MMS, Allosaurus, pronunciation, scheduling, research allocation, Admin, migration, production database, commit, push or deployment change was made.

## Verification actually run

| Command | Result |
| --- | --- |
| `python -m pytest tests/test_conversation_practice.py tests/test_groq_tutor.py -q` | **21 passed**, mocked/synthetic; no Groq network call in tests |
| `python -m ruff check app/core/config.py app/modules/conversation tests/test_conversation_practice.py tests/test_groq_tutor.py` | All checks passed |
| `python -c "from app.main import create_app; app=create_app(); print(type(app).__name__)"` | Passed: `CORSMiddleware` app created; no database or provider request |
| `node --test scripts/conversation.test.mjs` | **3 passed** |
| `npm run lint` in `apps/mobile` | Passed with no reported errors |
| `npm run typecheck` in `apps/mobile` | Failed: 21 existing errors in accessibility and assignment/auth/materials/research/setup screens; none in modified conversation API type file |
| `python -m pytest tests/test_identity_security.py -q` | 11 passed, 4 failed in pre-existing `CreateUserRequest.class_code` contract mismatch; outside Section 10A |
| `python -m pytest tests/test_identity_api.py -vv -x` | Stalled on first database-dependent test; interrupted. No PASS claimed |

No disposable PostgreSQL test URL was configured. No end-to-end Android acceptance is claimed.

### Browser test setup after the pilot

The app and API were started locally on ports 8083 and 8003. Both responded with HTTP 200. An existing signed-in account received HTTP 503 on `POST /me/conversation/sessions` because the tutor was disabled; the mobile client had incorrectly rendered this as a generic backend outage. `apps/mobile/src/services/api/client.ts` now maps tutor-specific errors to honest test-access/provider messages; focused lint on that file passed. Full mobile lint now reports 3 errors and 14 warnings in unrelated files; mobile typecheck still reports 21 unrelated errors.

One synthetic personal-student account was created through the normal browser registration endpoint in the configured development database. Its language was set to English, its UUID is the **only** local Groq allowlist entry, and the local development feature flag is now enabled. Credentials are stored only in ignored `private-data/groq-browser-test-account.txt`; they were not printed in logs or committed. Only fictional messages are authorized for this account. This was an additive test record, with no migration or existing-record modification. Using this account, browser login, English conversation start and session end each returned HTTP 200. The starter is correctly marked simulated. No message was sent to Groq in that check, and no real-device evidence is claimed.

### Synthetic live Groq pilot (three requests; no student account, database or real conversations)

The ignored `private-data/groq-synthetic-smoke.py` loaded the replacement key from ignored `.env` without printing it. It called the real `openai/gpt-oss-20b` model through the backend adapter. All three requests returned `simulated=false` and valid structured output:

| Case | Latency | Functional result |
| --- | ---: | --- |
| English cafe first turn | 1,365 ms | PASS: acknowledged an iced-coffee order and asked a relevant follow-up |
| Tagalog market first turn | 481 ms | PASS: answered a mango price question in Tagalog; the quoted price was invented roleplay content, not a real market price |
| English follow-up with prior dialogue and a new pastry request | 969 ms | FAIL: repeated its earlier coffee reply and did not address the pastry |

The outgoing follow-up included the prior learner turn, prior assistant reply and new learner turn; the mock context test also checks the message order. The failure is therefore observed model behavior, not evidence of proven continuity. The prompt was strengthened and exact duplicate replies are now rejected after this pilot. The three-request limit was reached, so the changed prompt/guard has **not** received a fourth live verification. **LIVE GROQ INFERENCE: PARTIAL** — provider connectivity and two language responses passed; follow-up quality failed. No academic language-feedback validation is claimed.

## Section 10B needs

Connect the Android Chat screen to this response metadata and retry/error states; test an allowlisted synthetic account on a real device; reverify follow-up continuity under a separately authorized live-test budget; establish approved consent, data retention/deletion and provider terms before allowing real student messages. Resolve unrelated mobile typecheck and identity test failures separately.
