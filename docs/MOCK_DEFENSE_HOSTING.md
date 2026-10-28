# Mock-defense hosting setup — October 27, 2026

**Superseded cost constraint:** the user subsequently requires $0 service plans. See FREE_DEMO_SERVICES.md. The proposed database is now Neon Free, and Lingolix Free is the researched non-commercial English-scoring candidate. Do not create paid Azure resources or treat the earlier Azure/account proposal below as the current instruction. The existing Azure adapter remains disabled, and neither a Groq nor Lingolix integration is live.

Status: prepared locally, not deployed, not pushed. No hosting account, provider key, cloud database, live AI call or phone-only end-to-end check exists yet.

## Chosen setup and account steps

1. Sign into [Render](https://dashboard.render.com/) using the GitHub account with access to `BlackKaiser1121/FLUENTT`. Keep deployment on `version-2`; do not select or change main. Start with the dashboard/account step; no paid purchase is required by this preparation.
2. Create a [Groq account](https://console.groq.com/) for conversation. Its [quickstart](https://console.groq.com/docs/quickstart) explains API keys and its [rate limits](https://console.groq.com/docs/rate-limits) describe free-plan limits. Enter the eventual key only in server secret management. The existing FLUENTT conversation registry still uses scripted replies; a genuine provider adapter and phone UI disclosure must be implemented/tested before describing it as live AI.
3. Use an [Azure Speech resource](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/pronunciation-assessment-tool) for the already prepared English whole-recording assessment. Resource, key and audio-processing configuration remain server-only. Review actual portal pricing before choosing a billable resource; no free usage or valid Tagalog acoustic score is promised.

For this short synthetic demo, Render can host the API and a dedicated new PostgreSQL database. [Free-plan limits](https://render.com/docs/free): web services sleep after 15 idle minutes and can take about a minute to wake; free PostgreSQL expires after 30 days. Record the actual database expiry and rehearse after waking the service. This is a mock-defense proposal, not a production recommendation or guaranteed free service.

## Prepared files

- `infra/render-demo.yaml`: Singapore free web-service template, exact version-2 source branch, automatic deployment off, native-only CORS list empty, Azure assessment off and secret database URL supplied separately.
- `services/api/.python-version`: Python 3.11 family for Render's build root.
- `services/api/scripts/start_render.py`: Render/production-only startup, conversion of provider PostgreSQL URLs to the existing psycopg contract, hidden credentials, bounded port and single worker. Uvicorn trusts proxy headers only in this explicitly Render-only entry point, relying on Render's managed ingress to supply forwarded HTTPS. Do not reuse this adapter on a directly exposed generic host.
- `services/api/tests/test_render_start.py`: synthetic configuration checks, no network/database writes.

The template is reviewable locally and has not been validated by an authenticated Render API or deployed. Existing API endpoints, session requirements, administrative roles and research gates are unchanged. Liveness `/api/v1/health` means the process runs; it does not prove database connectivity, initialized tables or functioning AI.

## Deployment sequence after accounts exist

1. Finish and verify the selected real conversation-provider integration, retaining genuine provider/model provenance, access checks and explicit failure states. Do not silently substitute scripted output on provider failure. Fix personal Tutor's sample audio-transcript/score path before calling voice conversation real. Keep ordinary school/research behavior isolated.
2. Publish the reviewed changes to `version-2` only when requested/authorized. Then review/import `infra/render-demo.yaml` or create the equivalent Render web service with root `services/api`, build `pip install -r requirements.lock.txt`, start `python -m scripts.start_render` and the documented production environment.
3. Create a separate empty mock-defense database, keep its URL in the server's `DATABASE_URL` secret and set up reviewed migration/runtime permissions. Existing databases must not be reset/stamped or bootstrapped blindly. Run the already documented `alembic -x repair_initial_names=true upgrade head` only against a verified newly empty database, with explicit operator authorization; use normal upgrade for a verified existing database. No migration is run by application startup or the build template. See MIGRATIONS.md.
4. Configure genuine model credentials and the optional Azure resource on the backend, then verify authenticated account and provider paths through its real HTTPS address. Never put provider secrets into EXPO_PUBLIC variables, screenshots, source or chat.
5. Rebuild the native APK with only the public HTTPS API URL. Preview adapters are local simulations and do not automatically use the hosted backend. Verify the actual account/demo entry path for the three target features rather than declaring preview responses live AI.
6. Rehearse Learn audio/card answers, local microphone permissions/language setup, genuine English full-recording assessment, and real scenario replies on the actual phone with the laptop disconnected. Record what remains unavailable; do not claim human research outcomes or acoustic validation from mock responses.

## Local verification

`services/api/.venv/Scripts/python.exe -m pytest tests/test_render_start.py -q` from the API project: 9 passed. `python -m ruff check scripts/start_render.py tests/test_render_start.py`: passed. These validate source configuration only, not Render ingress, cloud grants/migrations, subscription availability, cold-start behavior or a live model.
