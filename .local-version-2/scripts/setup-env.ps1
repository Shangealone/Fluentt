# Create machine-local configuration without overwriting an existing file or printing secrets.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
foreach ($pair in @(@('apps/mobile/.env.example','apps/mobile/.env'), @('apps/admin/.env.example','apps/admin/.env.local'), @('services/api/.env.example','services/api/.env'))) {
    $target = Join-Path $root $pair[1]
    if (!(Test-Path -LiteralPath $target)) { Copy-Item -LiteralPath (Join-Path $root $pair[0]) -Destination $target }
}
$apiEnv = Join-Path $root 'services/api/.env'
$content = [IO.File]::ReadAllText($apiEnv)
if ($content -notmatch '(?m)^FLUENTT_MOBILE_WEB_CSRF_SECRET\s*=\s*\S+') {
    $bytes = New-Object byte[] 48
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $secret = [Convert]::ToBase64String($bytes)
    [IO.File]::AppendAllText($apiEnv, "`nFLUENTT_MOBILE_WEB_CSRF_SECRET=$secret`n", [Text.UTF8Encoding]::new($false))
}
Write-Output 'Local environment files are ready. Set FLUENTT_DATABASE_URL in services/api/.env using your own database credentials. Existing files and configured browser secrets were preserved.'
