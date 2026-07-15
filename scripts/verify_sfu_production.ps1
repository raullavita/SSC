# Verify production SFU is enabled and reachable.
#
# Uses public /api/health (SFU block) — /api/sfu/config requires an authenticated session.
#
# Usage:
#   .\scripts\verify_sfu_production.ps1
#   .\scripts\verify_sfu_production.ps1 -ApiBase "https://api.supersecurechat.com"

param(
    [string]$ApiBase = $env:SSC_API_BASE
)

$ErrorActionPreference = "Stop"

if (-not $ApiBase) {
    $ApiBase = "https://api.supersecurechat.com"
}
$ApiBase = $ApiBase.TrimEnd("/")

Write-Host "SSC SFU production check"
Write-Host "API: $ApiBase"
Write-Host ""

$healthUrl = "$ApiBase/api/health"
try {
    $resp = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 20
} catch {
    Write-Error "Failed to fetch $healthUrl : $($_.Exception.Message)"
}

$sfu = $resp.sfu
if (-not $sfu) {
    Write-Error "Health response missing sfu block"
}

$enabled = [bool]$sfu.enabled
$wsUrl = [string]$sfu.ws_url
Write-Host "enabled: $enabled"
Write-Host "ws_url:  $wsUrl"

if (-not $enabled) {
    Write-Host ""
    Write-Host "SFU is disabled in production API config."
    Write-Host "Enable on Cloud Run:"
    Write-Host "  SSC_SFU_ENABLED=true"
    Write-Host "  SSC_SFU_WS_URL=wss://sfu.supersecurechat.com"
    Write-Host "Deploy SFU host: .\scripts\deploy_sfu_gce.ps1 then .\scripts\deploy_sfu_tls.ps1"
    exit 1
}

if (-not $wsUrl -or $wsUrl -notmatch '^wss?://') {
    Write-Error "Invalid ws_url in SFU health config"
}

Write-Host ""
Write-Host "OK: production API reports SFU enabled."
Write-Host "Group calls with >8 participants will use SFU mode."
exit 0