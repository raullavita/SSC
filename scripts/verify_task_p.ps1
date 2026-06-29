# TASK P — production infra verification (read-only checks)
$ErrorActionPreference = "Continue"
$ApiUrl = $env:SSC_API_URL
if (-not $ApiUrl) {
    $ApiUrl = "https://ssc-api-4jp3wuccwa-ew.a.run.app"
}
$SiteUrl = "https://www.supersecurechat.com"
$ApiDomain = "https://api.supersecurechat.com"

Write-Host "=== TASK P verification ===" -ForegroundColor Cyan
Write-Host "API: $ApiUrl"

function Test-UrlOk($label, $url) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
        Write-Host "OK: $label -> $($r.StatusCode)" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "FAIL: $label -> $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

Test-UrlOk "API health" "$ApiUrl/api/health" | Out-Null

try {
    $cfg = Invoke-RestMethod -Uri "$ApiUrl/api/config" -TimeoutSec 20
    $ts = $cfg.turnstile_sitekey
    if ($ts) {
        Write-Host "OK: Turnstile sitekey exposed in /api/config" -ForegroundColor Green
    } else {
        Write-Host "PENDING: Turnstile disabled - complete TASK P.1-P.2" -ForegroundColor Yellow
    }
    if ($cfg.ice_servers -and $cfg.ice_servers.Count -gt 0) {
        Write-Host "OK: TURN/STUN ICE servers present ($($cfg.ice_servers.Count))" -ForegroundColor Green
    } else {
        Write-Host "WARN: No ICE servers in config" -ForegroundColor Yellow
    }
} catch {
    Write-Host "FAIL: /api/config -> $($_.Exception.Message)" -ForegroundColor Red
}

Test-UrlOk "Marketing site" $SiteUrl | Out-Null
Test-UrlOk "Privacy page" "$SiteUrl/privacy" | Out-Null
Test-UrlOk "Terms page" "$SiteUrl/terms" | Out-Null

try {
    $r = Invoke-WebRequest -Uri "$ApiDomain/api/health" -UseBasicParsing -TimeoutSec 15
    Write-Host "OK: API custom domain api.supersecurechat.com" -ForegroundColor Green
} catch {
    Write-Host "PENDING: api.supersecurechat.com not live - complete TASK P.3 DNS + Cloud Run mapping" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Founder manual checks still required:" -ForegroundColor Cyan
Write-Host "  P.6 / Q.31 TURN off-LAN call test - run .\scripts\verify_turn_off_lan.ps1 then fill test_reports/Q31_TURN_OFF_LAN_MATRIX.md"
Write-Host "  P.7 Porkbun email: verify contact@supersecurechat.com in Porkbun + DNS fix button"