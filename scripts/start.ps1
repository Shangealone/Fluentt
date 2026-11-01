param(
  [Parameter(Mandatory=$true)][ValidateSet('mobile','admin','api')][string]$Service,
  [string]$ApiPython = $env:FLUENTT_API_PYTHON
)
$root = Split-Path -Parent $PSScriptRoot
switch ($Service) {
  'mobile' { Set-Location (Join-Path $root 'apps/mobile'); npm start }
  'admin' { Set-Location (Join-Path $root 'apps/admin'); npm run dev }
  'api' {
    $apiRoot = Join-Path $root 'services/api'
    if (-not $ApiPython) {
      $preparedRuntime = Join-Path $apiRoot 'private-data/api-runtime/.venv/Scripts/python.exe'
      $ApiPython = if (Test-Path -LiteralPath $preparedRuntime) { $preparedRuntime } else { Join-Path $apiRoot '.venv/Scripts/python.exe' }
    }
    $ApiPython = (Get-Command $ApiPython -CommandType Application -ErrorAction Stop).Source
    & $ApiPython -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 2)'
    if ($LASTEXITCODE -ne 0) { throw 'version-3 requires Python 3.12 or later. Select a compatible API environment with -ApiPython.' }
    Set-Location $apiRoot
    & $ApiPython -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --no-access-log
  }
}
