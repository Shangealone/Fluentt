# Fluentt: importing the shared lessons on your PC

These instructions are for Windows PowerShell and the `version-5` branch. The shared snapshot contains **45 administrator lessons across 7 published curriculum editions, with 371 question revisions**, reading materials, and competency links.

Git downloads the lesson snapshot. Starting the API with the supplied script imports it into **your own database**. It does not copy your teammate's database, accounts, classes, or credentials. Instructor-created private lessons are separate and are not included.

## 1. Open the correct folder and get version-5

Replace `C:\Projects\FLUENTT` below with the location of your cloned repository. Save or commit your own source changes before switching branches.

```powershell
Set-Location 'C:\Projects\FLUENTT'
git fetch origin
git switch version-5
git pull --ff-only origin version-5
Set-Location '.local-version-2'
Test-Path '.\scripts\start.ps1'
```

The last command must print `True`. All commands in the next sections begin from `.local-version-2` unless stated otherwise.

If you have not cloned the repository yet, use this alternative instead:

```powershell
Set-Location 'C:\Projects'
git clone --branch version-5 https://github.com/BlackKaiser1121/FLUENTT.git
Set-Location 'FLUENTT\.local-version-2'
```

If `git switch version-5` cannot find the local branch after fetching, use `git switch --track origin/version-5`.

## 2. First-time dependencies and configuration

You need Python 3.12, Node.js 22.18+ or Node.js 24 LTS, and PostgreSQL 17. Docker Desktop is an alternative way to run PostgreSQL. GitHub access to the repository is also required.

Skip creating the Python environment if `services/api/.venv` already exists and is working. Otherwise:

```powershell
py -3.12 -m venv services/api/.venv
```

Install dependencies and create missing local environment files:

```powershell
.\services\api\.venv\Scripts\python.exe -m pip install -r services/api/requirements.lock.txt
npm --prefix apps/mobile ci
npm --prefix apps/admin ci
.\scripts\setup-env.ps1
```

The setup script preserves existing configuration. Edit `services/api/.env` and set your own database connection. Keep `FLUENTT_ENVIRONMENT=development` for the shared-library loader. Do not copy someone else's API keys or session secrets.

## 3. Start your database

Choose **one** method.

### A. Existing PostgreSQL installation

Start your PostgreSQL service and use a database and login you own. Set `FLUENTT_DATABASE_URL` in `services/api/.env` to that database. Use your installation's actual port, usually `5432`.

Do not use the author's private port `55432` unless you intentionally configured your own server on that port.

### B. Docker Desktop

Open Docker Desktop first. From `.local-version-2`, enter your own local database password when prompted, then start PostgreSQL:

```powershell
$dbPasswordInput = Read-Host 'Choose your local PostgreSQL password' -AsSecureString
$env:FLUENTT_POSTGRES_PASSWORD = [System.Net.NetworkCredential]::new('', $dbPasswordInput).Password
docker compose -f infra/compose.yaml up -d postgres
docker compose -f infra/compose.yaml exec postgres pg_isready -U fluentt_dev -d fluentt
```

Wait until PostgreSQL reports that it is accepting connections. Configure `services/api/.env` using the same password:

```dotenv
FLUENTT_ENVIRONMENT=development
FLUENTT_DATABASE_URL=postgresql+psycopg://fluentt_dev:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5432/fluentt
```

Replace the password placeholder; URL-encode reserved characters in the password. Do not commit the `.env` file. Keep the same Docker password for an existing data volume; changing the environment variable does not change an already-created database user's password. Re-enter that password in new terminals when running Docker Compose.

## 4. Apply database migrations

```powershell
Set-Location 'services\api'
.\.venv\Scripts\python.exe scripts/check_database.py
```

For a **new, empty database only**, run:

```powershell
.\.venv\Scripts\python.exe -m alembic -x repair_initial_names=true upgrade head
```

For an **existing Fluentt database**, keep a private backup and run this instead:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Do not run both alternatives. Never reset an existing database to fix an import problem.

Confirm the migration revision:

```powershell
.\.venv\Scripts\python.exe -m alembic current
```

This checkpoint expects `0023_teacher_lesson_proficiency`.

## 5. Import the lessons and start the API

Return from `services/api` to `.local-version-2`, then start:

```powershell
Set-Location '..\..'
.\scripts\start.ps1 api
```

The script checks the database and automatically loads the shared lesson library before starting the API. Keep this terminal open.

Look for a message like:

```text
Lesson library loaded: {"inserted": ..., "updated": ..., "lessons": 45, "questions": 371}
```

On later starts, `inserted` and `updated` should normally be zero. Repeated loading does not create duplicates.

API health: <http://localhost:8001/api/v1/health>

API documentation: <http://localhost:8001/docs>

## 6. Open the app or administrator site

In another PowerShell terminal:

```powershell
Set-Location 'C:\Projects\FLUENTT\.local-version-2'
.\scripts\start.ps1 mobile
```

Open <http://localhost:8082>. To start the administrator interface, use another terminal:

```powershell
Set-Location 'C:\Projects\FLUENTT\.local-version-2'
.\scripts\start.ps1 admin
```

Open <http://localhost:3000>. Administrator sign-in still requires your own configured identity and permissions; importing lessons does not create an administrator account. See [ADMIN_AUTH.md](ADMIN_AUTH.md).

Your students and instructors need their own accounts and classes. Existing app permissions and lesson-eligibility rules still determine what each person sees.

## Manual import if you start Uvicorn directly

Direct Uvicorn startup does not run the lesson loader. From `.local-version-2/services/api`, run:

```powershell
.\.venv\Scripts\python.exe -m app.modules.curriculum.library_bundle import
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --no-access-log
```

To check the bundle against your database without retaining changes:

```powershell
.\.venv\Scripts\python.exe -m app.modules.curriculum.library_bundle check
```

## Common problems

| Problem | What to do |
|---|---|
| `start.ps1` is not recognized | Enter `.local-version-2` first. Confirm `Test-Path .\scripts\start.ps1` prints `True`. |
| Script execution is disabled | If your PC policy permits it, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal, then retry. Organization policies may require administrator assistance. |
| Database connection failed | Start PostgreSQL and check your own hostname, port, database name, username, and password in `services/api/.env`. |
| Database revision is behind | Apply the appropriate migration command from section 4. |
| Lesson library conflict | The loader preserves local content and rolls back. Ask the team to review the conflicting content; do not delete or reset your database. |
| Port 8001 is already in use | An API or another service may already be running. Inspect the existing process before starting another instance. |
| Lessons are absent after starting Uvicorn | Run the manual import above, or start through `scripts/start.ps1 api`. |
| Administrator sign-in is unavailable | Configure your own administrator authentication; the lesson bundle intentionally excludes identities and credentials. |

## Future updates

Pull the latest `version-5`, apply any new migrations, and restart through `scripts/start.ps1 api`. New database edits made by a teammate are shared only after the designated source library is re-exported, reviewed, committed, and pushed. See [LESSON_LIBRARY.md](LESSON_LIBRARY.md) for that process and [TEAM_SETUP.md](TEAM_SETUP.md) for full environment setup.
