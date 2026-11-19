$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $root 'server'
$envFile = Join-Path $serverDir '.env'
$example = Join-Path $serverDir '.env.example'

if (-not (Test-Path $envFile)) {
  Copy-Item $example $envFile
  Write-Host 'Created server/.env from the example.'
}

$content = Get-Content -Raw $envFile
if ($content -notmatch '(?m)^RESONANCE_ACCESS_KEY=\S+') {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  $key = [Convert]::ToBase64String($bytes)
  if ($content -match '(?m)^RESONANCE_ACCESS_KEY=.*$') {
    $content = [regex]::Replace($content, '(?m)^RESONANCE_ACCESS_KEY=.*$', "RESONANCE_ACCESS_KEY=$key")
  } else {
    $content += "`r`nRESONANCE_ACCESS_KEY=$key`r`n"
  }
  Set-Content -Path $envFile -Value $content -NoNewline
  Write-Host 'Generated a private Resonance access key in server/.env.'
}
Write-Host 'Setup complete. Keep server/.env private.'
