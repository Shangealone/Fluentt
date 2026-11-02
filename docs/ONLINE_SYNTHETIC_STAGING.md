# FLUENTT online synthetic staging

This configuration is for a temporary, internet-reachable **synthetic-account test**, not a real-student deployment. The single Render web service serves the Expo web export and FastAPI at one HTTPS origin so the existing host-only, `SameSite=Lax` browser session cookie works. Render's free service has public reachability and sleeps on idle; possession of the URL is not an access control.

## Scope and status

- The web export and API route hosting were verified locally. The service has not yet been created or tested on Render.
- Use a separate empty PostgreSQL database containing synthetic records only. Never connect this service to the existing FLUENTT Supabase project that holds real accounts.
- English WavLM and Tagalog MMS are **off** in `render.yaml`. Their checkpoints, memory requirements, and rights are not met by the free web service. No speech score is promised online.
- Groq is **off** initially. A hosted synthetic-only gate may be enabled only after a separate staging database and an explicit synthetic account allowlist are configured. A Groq key must stay in Render's secret environment settings, never in Git or an `EXPO_PUBLIC_` variable. This does not authorize real-student conversations.
- `FLUENTT_ENVIRONMENT=production` provides secure transport/cookies and hides API docs. It does not mean educational, research, licensing, privacy, or performance production readiness.

## Deployment sequence

1. Use the dedicated staging branch containing `render.yaml`; keep existing version branches unchanged. Connect that branch to a Render web service with the Free plan. Automatic deployments are off.
2. The Blueprint creates a **new** free Render PostgreSQL database named `fluentt_synthetic_staging` and connects it with Render's private connection reference. It is not a schema inside the current student database. Render supplies the connection secret; do not print or commit it. A separate Supabase project is a later alternative if a durable staging database is approved.
3. Set `FLUENTT_MOBILE_WEB_ORIGINS` to a JSON array containing the exact resulting HTTPS Render origin, for example `["https://YOUR-SERVICE.onrender.com"]`. The service URL must be known before this can be finalized. Keep `FLUENTT_CORS_ORIGINS=[]`. Render generates a random browser CSRF secret.
4. At first startup, `scripts/init_render_staging_db.py` accepts only the exact `fluentt_synthetic_staging` database name, reuses the repository's empty-database guard, and applies the existing bootstrap migration adapter. On restart it accepts only the exact current Alembic head; any other version or unexpected object blocks startup for manual review. It never upgrades a pre-existing database.
5. Build and start the service using `scripts/build-render-staging.sh` and `scripts/start-render-staging.sh`. The build installs pinned Python dependencies, uses `npm ci`, and exports Expo web with dotenv loading disabled. No local `localhost` API address is embedded. The web client uses the current HTTPS origin by default; existing explicit local/native API URLs still take precedence.
6. Verify `/api/v1/health`, `/login`, browser registration/login/session renewal, one synthetic conversation, errors, and logout on the actual HTTPS URL. Check Render logs for secret or transcript exposure. Health is liveness only and does **not** prove database connectivity.
7. If Groq is needed for the synthetic test, set `GROQ_TUTOR_ENABLED=true`, `GROQ_TUTOR_SYNTHETIC_STAGING=true`, `GROQ_TUTOR_ALLOWED_USER_IDS` to only synthetic account UUIDs, and `GROQ_API_KEY` as a Render secret. The application refuses hosted synthetic mode without an allowlist. Do not enable it for real accounts. The limiter is process-local and conversation deletion/consent policy is unresolved.

Do not share the staging link as a student release. Render Free web services spin down after inactivity; a first request may take about a minute. The free Render Postgres database expires after 30 days and has no backups, so it is unsuitable for durable accounts. A separate Supabase staging project would avoid that particular expiry but needs its own access and retention decisions.

## Local verification (2026-11-02)

| Check | Actual result |
| --- | --- |
| `EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL= npx expo export --platform web` | PASS: 39 web bundles and 48 assets exported to ignored `apps/mobile/dist` |
| Scan export for local API URLs | PASS: no `localhost:8003`, `localhost:8083`, or `10.0.2.2:8003` found |
| FastAPI `TestClient` against actual export (`/`, `/login`, `/conversation`, `/api/v1/health`) | PASS: four HTTP 200 responses; no database or provider call |
| `pytest tests/test_web_host.py tests/test_groq_tutor.py tests/test_conversation_practice.py -q` | PASS: 24 mocked/isolated checks, two dependency deprecation warnings; no Groq or database inference |
| `ruff check` on changed backend modules and tests | PASS |
| Focused ESLint on `apps/mobile/src/services/api/client.ts` | PASS |
| Render database initialization guard | Code review and isolated tests pending; no cloud database has been created yet |
| Live Render, real phone, separate database, online Groq | NOT TESTED / NOT CREATED |

Render build uses the pinned `services/api/requirements.lock.txt` and Python 3.12.10. The service starts one Uvicorn process with proxy headers for Render's HTTPS termination, access logs off, and the existing application-level non-content request logs. TLS, account privacy and browser behavior need live verification before calling the test ready.

## Changed files for staging preparation

- `apps/mobile/src/services/api/client.ts`: same-origin browser API fallback and prior tutor error labels.
- `services/api/app/core/config.py`: opt-in web hosting and synthetic hosted tutor gate.
- `services/api/app/main.py`: serve the exported SPA and assets after API routes.
- `services/api/app/modules/conversation/groq_provider.py`: keep allowlisted Groq access closed unless development or explicit production-transport synthetic staging.
- `services/api/tests/test_web_host.py`, `services/api/tests/test_groq_tutor.py`: route and gate regressions.
- `scripts/build-render-staging.sh`, `scripts/start-render-staging.sh`, `services/api/scripts/init_render_staging_db.py`, `render.yaml`: deployment commands, isolated database guard, and disabled-by-default flags.

The existing uncommitted Section 10A Groq implementation files are separate prerequisite changes. No migration, model, scheduler, research, production database or saved student record was changed by this staging preparation.
