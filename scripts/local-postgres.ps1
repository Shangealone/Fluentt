param([ValidateSet('start', 'stop', 'status')][string]$Action = 'start')

# Operates only on the isolated development cluster prepared during verification.
# Does not download, initialize, migrate, reset, or remove any database.
$ErrorActionPreference = 'Stop'
$taskRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'private-data/verification'
$taskControl = Join-Path $taskRoot 'runtime/pgsql/bin/pg_ctl.exe'
$taskData = Join-Path $taskRoot 'pgdata'
if (!(Test-Path -LiteralPath $taskControl) -or !(Test-Path -LiteralPath (Join-Path $taskData 'PG_VERSION'))) {
    throw 'The isolated PostgreSQL runtime is absent. Follow docs/MIGRATIONS.md for another local installation.'
}
& $taskControl -D $taskData status
$taskRunning = $LASTEXITCODE -eq 0
switch ($Action) {
    'start' {
        if (!$taskRunning) {
            & $taskControl -D $taskData -l (Join-Path $taskRoot 'postgres.log') -o '-h 127.0.0.1 -p 55432' -w start
            if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL failed to start; inspect its ignored log.' }
        }
    }
    'stop' {
        if ($taskRunning) {
            & $taskControl -D $taskData -m smart -w stop
            if ($LASTEXITCODE -ne 0) { throw 'Stop did not complete; close local API and test connections first.' }
        }
    }
    'status' { if (!$taskRunning) { Write-Output 'The isolated local PostgreSQL cluster is stopped.' } }
}
