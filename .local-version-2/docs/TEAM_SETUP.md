# Team setup and checkpoint updates

This checkpoint is on `version-5`. Run commands from `.local-version-2`, not the older top-level backend/mobile folders. Commands below target Windows PowerShell. Node 22.18+ (or Node 24 LTS), npm 11, Python 3.12, and PostgreSQL 17 are supported by this checkpoint's local checks. Android device builds also need the Android SDK/JDK; a browser setup does not require them.

## 1. Clone and install

```powershell
git clone --branch version-5 https://github.com/BlackKaiser1121/FLUENTT.git
Set-Location FLUENTT/.local-version-2
npm --prefix apps/mobile ci
npm --prefix apps/admin ci
py -3.12 -m venv services/api/.venv
.\services\api\.venv\Scripts\python.exe -m pip install -r services/api/requirements.lock.txt
.\scripts\setup-env.ps1
```

If `py` is unavailable, use a Python 3.12 executable to create the virtual environment. Use `npm ci` with each committed lockfile. The setup script copies only missing environment files and generates a browser CSRF secret locally without printing it. It preserves existing configuration and secrets when rerun.

## 2. Configure your own database

Use an existing local PostgreSQL 17 installation, or start Docker Desktop and the supplied compose service. For Docker, set `FLUENTT_POSTGRES_PASSWORD` in your current terminal to your own development password, then run:

```powershell
docker compose -f infra/compose.yaml up -d postgres
docker compose -f infra/compose.yaml exec postgres pg_isready -U fluentt_dev -d fluentt
```

Edit the ignored `services/api/.env`: set `FLUENTT_DATABASE_URL` to your own PostgreSQL URL, for example `postgresql+psycopg://fluentt_dev:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5432/fluentt`. The Docker service uses port5432. The author's existing isolated native cluster uses55432, but that private cluster is not part of a clone. URL-encode reserved password characters. Keep credentials in your local ignored file.

The generated templates already align these addresses:

| Service | Address |
|---|---|
| Learner/instructor web app | http://localhost:8082 |
| Administrator web app | http://localhost:3000 |
| API origin | http://localhost:8001 |
| API health | http://localhost:8001/api/v1/health |

`apps/mobile/.env` has `EXPO_PUBLIC_API_URL=http://localhost:8001`. `apps/admin/.env.local` has both API origins on8001. API CORS and mobile-browser origins include localhost8082; administrator origin is localhost3000. The API environment must contain a unique `FLUENTT_MOBILE_WEB_CSRF_SECRET` for cookie sign-in; setup-env generates one if missing. Never put credentials in EXPO_PUBLIC_* or NEXT_PUBLIC_* variables.

## 3. Migrate explicitly

From `.local-version-2/services/api`, check connectivity:

```powershell
.\.venv\Scripts\python.exe scripts/check_database.py
```

For a **new, empty database only**, use the reviewed initial constraint-name adapter:

```powershell
.\.venv\Scripts\python.exe -m alembic -x repair_initial_names=true upgrade head
```

For an **existing Fluentt database**, preserve a private backup and run the normal forward upgrade instead:

```powershell
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Confirm the revision is `0029_online_class_assessments`. The initial adapter rejects a populated database. Never reset/stamp an existing database or edit frozen migrations to bypass an error. Current head includes migrations that inspect existing PostgreSQL functions; a successful online fresh migration is the relevant check. Startup does not silently run migrations. [MIGRATIONS.md](MIGRATIONS.md) contains the historical naming explanation and maintenance guidance.

## 4. Start the services

Return to `.local-version-2` and run each command in a separate terminal:

```powershell
.\scripts\start.ps1 api
.\scripts\start.ps1 mobile
.\scripts\start.ps1 admin
```

Keep these terminals open. On the author's machine, the API helper can reuse its existing isolated local cluster; on a fresh clone it uses your already-running database from the configured URL. The helper checks database connectivity, migration head, and browser-session configuration before serving the API. It reports missing setup instead of silently serving a partially configured app. It binds to127.0.0.1:8001. For an explicitly configured physical-phone LAN setup, `start.ps1 api -ApiHost 0.0.0.0` is available; use the computer's reachable LAN API address in the mobile configuration and appropriate private-network firewall rules. Android emulator uses10.0.2.2:8001. Restart Expo/Next after environment changes.

A listening health endpoint establishes API liveness. `check_database.py` separately verifies the configured database connection. `python scripts/check_runtime.py` also checks migration head and browser-session configuration. A port-in-use error means inspect the process already serving that port instead of starting duplicates; avoid stopping unrelated services. A browser-only blank page can also come from an unavailable API, missing migrations, or inconsistent environment origins.

## 5. Accounts, content, and optional services

Create a Teacher account at `/auth`, create a class, and share its server-issued code with students. Student registration verifies the class code before creating/joining the account. Proficiency is the school's external Beginner/Intermediate/Advanced assessment label; existing classes are not automatically classified. New personal-learner signup is disabled by default; existing personal accounts keep sign-in. [PERSONAL_LEARNER_REGISTRATION.md](PERSONAL_LEARNER_REGISTRATION.md) explains restoration.

A fresh database has no copy of the author's accounts, join codes, assignments, administrator mappings, or research participants. The administrator lesson library is bundled separately: after migration, `scripts/start.ps1 api` automatically loads it in development, preserving its publication status and avoiding duplicates. See [LESSON_LIBRARY.md](LESSON_LIBRARY.md) for direct-Uvicorn startup, conflict handling, and refreshing the shared content. Each groupmate still configures their own accounts and administrator access. Teacher-owned lessons remain separate; publishing and class sharing are explicit actions. Original source packs also remain versioned in `services/api/app/modules/questions/*_content.py`; `python -m app.modules.questions.school_clubs_import --administrator YOUR_PROVISIONED_ADMIN --pack PACK_NAME` creates drafts for new source packs. Follow [TEACHER_LESSONS.md](TEACHER_LESSONS.md) and [CONTENT_SOURCE_REGISTER.md](CONTENT_SOURCE_REGISTER.md).

Real administrator access requires your own OIDC provider/MFA configuration and operator-provisioned identity/permissions; see [ADMIN_AUTH.md](ADMIN_AUTH.md). An absent provider should show a configuration-required sign-in state. It is not solved by sharing a teammate's API keys or session cookies. Optional mock administrator UI is explicitly development-only and off by default; it does not create real backend accounts or publish real content.

Speech/conversation providers, local model assets, and a trained FIFAKT artifact have their own setup requirements; they are not copied by Git. Keep service-unavailable states honest. ESR remains gated until its documented trained-model and study-workflow prerequisites are met; see [ESR_IMPLEMENTATION.md](ESR_IMPLEMENTATION.md). No production model availability or study readiness is implied by a successful local web build.

## Pulling later checkpoints

Commit/stash your own source edits, switch to `version-5`, pull `origin version-5`, and preserve your ignored environment/database files. Run `npm ci` in a client if its lockfile changed; reinstall the pinned API requirements if its lock changed. Back up an existing database before `alembic upgrade head`, then restart all affected servers. Run migrations before using screens that depend on new columns. Start the API with `scripts/start.ps1 api` to load the shared administrator lesson library.

## Verification and known limits

```powershell
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile run lint
npm --prefix apps/admin run typecheck
npm --prefix apps/admin run lint
npm --prefix apps/admin run build
Set-Location services/api
.\.venv\Scripts\python.exe -m pytest -m "not postgresql" -q
```

This checkpoint also exercises fresh migrations and focused cross-layer contracts in an isolated disposable database. PostgreSQL tests require a separate maintenance test URL and create their own UUID-named database; see MIGRATIONS.md. Frontend dependency dry-runs and web bundles establish lockfile/compile feasibility, not a fresh install on every operating system or manual acceptance of every workflow. Consult CHECKPOINT_READINESS.md for the exact checks and unresolved limitations of this checkpoint.

### Windows registry certificate trust

If `npm ci` reports UNABLE_TO_VERIFY_LEAF_SIGNATURE on a machine whose required certificate authority is already trusted by Windows, Node22.18+ supports the system trust store:

```powershell
$env:NODE_OPTIONS = (($env:NODE_OPTIONS + ' --use-system-ca').Trim())
```

Retry `npm ci` in that terminal. This keeps certificate validation enabled. If your system does not trust the required authority, obtain the correct certificate/setup from your network administrator; do not set strict-ssl=false or NODE_TLS_REJECT_UNAUTHORIZED=0. The checkpoint's isolated clean mobile install succeeded with the Windows trust store enabled.
