# Live Tutor laptop demonstration — 2026-10-28

## Scope and readiness

The existing personal Tutor page now offers **Open live AI Tutor** in the browser demo. The existing scripted simulator remains separately labeled. Generated conversations run through the Python backend and Groq; they do not load a model on this low-memory laptop. The user supplied a key, saved only in ignored backend configuration. The restarted running API was verified with real model calls: a two-turn fictional Tagalog market exchange and one English cafe reply returned HTTP 200, simulated=false and saved=false. This is a smoke test, not validation of language quality, safety or sustained free quota.

This is deliberately a local presentation mode, not an authenticated saved classroom conversation. It performs no database reads/writes and does not create research, consent, classroom, personal-history, scheduler or pronunciation records. Only development mode and loopback callers can reach its endpoints. Existing authenticated conversation routes and normal classroom behavior are unchanged. Remote phones/hosting are not enabled by this implementation; those need a separately authenticated deployment, provider/data permissions and integration.

## Set up

1. Create a Groq account on its Free plan and a key at https://console.groq.com/keys . Do not post keys in chat or put them in Expo/public variables. No billing upgrade or payment was configured.
2. In ignored `services/api/.env`, set `FLUENTT_TUTOR_GROQ_KEY` to the key and `FLUENTT_TUTOR_DEMO_ENABLED=true`. The current local file already has the enable flag. Configured model/default: `openai/gpt-oss-120b`, listed in the Groq free-plan limits on the review date. Initial Qwen testing produced poor Tagalog wording and a follow-up failure; the explicit model configuration was changed and strict JSON schema output plus low reasoning effort were added. There is no runtime automatic model substitution. Model access/availability can change; use the account limits page as authoritative. Do not silently substitute another model.
3. Ensure `FLUENTT_CORS_ORIGINS` includes the exact local frontend origin, currently `http://localhost:8096`. It is already present locally.
4. Restart this checkout's API from `services/api`: `.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log`. The backend reads `.env` at startup. Do not start a competing listener if it is already running.
5. The existing Expo public API URL must point to `http://localhost:8000`; no provider key belongs there. Reload the browser demo, select the personal learner, open Tutor, choose **Open live AI Tutor**, then **Check AI connection**.
6. Read/check the text-processing permission, choose a scenario and type a reply. The authored greeting is labeled. Later replies and one practice tip come from the model. **Listen to reply** uses installed device text-to-speech voices and is subject to voice availability.

Try: select the English cafe scenario, ask for an unsweetened drink, then ask about a different size. Confirm the second generated reply uses the prior exchange. For Tagalog, try the market scenario and ask about prices then quantities. These are manual demonstration instructions; the final backend smoke covered two related Tagalog market turns and one English cafe turn.

## Data, limits and failures

- The user's opt-in sends only scenario instructions and this demonstration's message text/history to Groq. Use fictional details. Backend safety patterns reject some sensitive/instruction-like text, but are not a guarantee of PII detection or model safety.
- Chat and tips stay in component memory; navigation/background clears them and resets permission. A request already sent may finish at the provider, but late results are discarded. The backend does not store the transcript; provider terms/data controls still apply.
- `GET /api/v1/demo/tutor/capabilities` exposes nonsecret readiness, provider/model and fixed public sample scenarios. `POST /api/v1/demo/tutor/reply` requires explicit permission, a listed scenario, alternating bounded user/assistant messages and an allowed Origin; it rejects system-role messages and extra identity/study fields.
- Bounded request body (48 KB), at most 19 messages/6,500 content characters, 768 completion tokens, one concurrent call, 6 calls/minute and 100/day per process. These are local key-protection ceilings, not promises of Groq capacity. No tools, arbitrary destination URLs, automatic retries, model switches or scripted fallback on failure. Restarting resets the process-local budget; it is unsuitable for public deployment.
- HTTP/provider failures keep the draft available for manual retry. Invalid/truncated/oversized/empty model output is an error. No invented grammar grade, pronunciation score, calibrated confidence, superiority or research result.
- AI language tips can be inaccurate. Tagalog quality has not been evaluated. First delivery is typed text plus optional reply playback; microphone conversational dictation is not implemented in this new mode.

## Files

Backend: `app/modules/conversation/live_demo.py`, `app/core/config.py`, `app/api/v1/router.py`, `app/main.py`, `.env.example` (under `services/api`). Existing model/schema/migrations are untouched.

Frontend: `apps/mobile/src/services/api/liveTutor.ts`, `apps/mobile/src/features/conversation/LiveTutorPractice.tsx`, existing `apps/mobile/src/app/conversation.tsx`.

Checks: `services/api/tests/test_live_tutor_demo.py`, `scripts/live-tutor.test.cjs`; existing conversation tests reused. Local ignored `.env` changed only to enable the local demo; no key was supplied by the agent. Logs/PID are ignored under `private-data/tutor-api.*`.

## Verification

- `.venv/Scripts/python.exe -m pytest tests/test_live_tutor_demo.py tests/test_conversation_practice.py -q --tb=short`: 24 passed, 2 dependency deprecation warnings. Synthetic HTTP provider transport only; no genuine inference. Windows TestClient required execution outside sandbox; sandbox attempts stalled and were interrupted, not counted as passes.
- `node scripts/live-tutor.test.cjs`: 5 passed. Synthetic UI/API fixtures verify permission, multi-turn history, failure retention, late/background cleanup, strict provenance and no client secret.
- Mobile `npm run typecheck`: passed. `npm run lint`: passed, 0 errors/29 existing warnings. Targeted Ruff checks passed.
- No PostgreSQL migration/integration was necessary for this stateless demonstration; no application database data was modified.
- No automated real browser/microphone/model-quality claim. All provider response fixtures above are explicitly synthetic. Genuine provider access was subsequently verified using the supplied key, as recorded below.

Reviewed primary sources: https://console.groq.com/docs/rate-limits , https://console.groq.com/docs/models , https://console.groq.com/docs/text-chat , https://console.groq.com/docs/your-data .

## Real-provider verification update

After key configuration and restart, the actual running HTTP API returned these successful fictional QA exchanges using `openai/gpt-oss-120b`:

- Tagalog turn 1: quoted P80 per kilo of mangoes; observed request round trip 869 ms.
- Tagalog turn 2: the learner requested half a kilo, and the reply retained the item/price context and quoted P40; 557 ms.
- English cafe: the learner asked for unsweetened tea, and the reply offered hot/iced unsweetened tea; 671 ms.

All three were HTTP 200, `simulated=false`, `saved=false`. These are single observations, not performance benchmarks or human research data. The generated coaching is still model advice and may be inaccurate. The 24 backend regression tests passed again after the strict-schema/text-only coaching fix. No account, classroom, scheduler or research records were created. No browser microphone or end-to-end UI test was claimed. The user should rotate the key because it was posted in chat; its value is never recorded in this report or source.
