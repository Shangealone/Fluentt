param([Parameter(Mandatory=$true)][ValidateSet('mobile','admin','api')][string]$Service)
$root = Split-Path -Parent $PSScriptRoot
switch ($Service) {
  'mobile' { Set-Location (Join-Path $root 'apps/mobile'); npm start -- --port 8082 }
  'admin' { Set-Location (Join-Path $root 'apps/admin'); npm run dev }
  'api' { & (Join-Path $PSScriptRoot 'local-postgres.ps1') start; Set-Location (Join-Path $root 'services/api'); & .venv/Scripts/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001 --no-access-log }
}


