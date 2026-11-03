param(
    [Parameter(Mandatory=$true)][ValidateSet('mobile','admin','api')][string]$Service,
    [string]$ApiHost = '127.0.0.1'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    switch ($Service) {
        'mobile' { Set-Location (Join-Path $root 'apps/mobile'); npm run web -- --port 8082 }
        'admin' { Set-Location (Join-Path $root 'apps/admin'); npm run dev -- --hostname 127.0.0.1 --port 3000 }
        'api' {
            # Reuse the existing isolated developer cluster only on a machine that has it.
            # Fresh clones use their own running PostgreSQL/Docker and FLUENTT_DATABASE_URL.
            $localData = Join-Path $root 'private-data/auth-local/pgdata/PG_VERSION'
            if (Test-Path -LiteralPath $localData) { & (Join-Path $PSScriptRoot 'local-postgres.ps1') start }
            Set-Location (Join-Path $root 'services/api')
            $python = Join-Path (Get-Location) '.venv/Scripts/python.exe'
            if (!(Test-Path -LiteralPath $python)) { throw 'Create services/api/.venv and install requirements.lock.txt first; see docs/TEAM_SETUP.md.' }
            & $python scripts/check_runtime.py
            if ($LASTEXITCODE -ne 0) { throw 'Resolve the startup preflight above before starting the API; see docs/TEAM_SETUP.md.' }
            & $python -m uvicorn app.main:app --reload --host $ApiHost --port 8001 --no-access-log
        }
    }
    if ($LASTEXITCODE -ne 0) { throw "$Service stopped with exit code $LASTEXITCODE. Read the preceding output." }
} finally { Pop-Location }
