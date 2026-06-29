# Q.31 / TASK P.6 - TURN config smoke + founder off-LAN matrix instructions
$ErrorActionPreference = "Continue"
$ApiUrl = $env:SSC_API_URL
if (-not $ApiUrl) {
    $ApiUrl = "https://api.supersecurechat.com"
}
$ApiUrl = $ApiUrl.TrimEnd("/")

Write-Host "=== Q.31 TURN off-LAN verification ===" -ForegroundColor Cyan
Write-Host "API: $ApiUrl"

$configOk = $false
try {
    $cfg = Invoke-RestMethod -Uri "$ApiUrl/api/config" -TimeoutSec 20
    $calls = $cfg.calls
    $relayEntries = @($cfg.ice_servers | Where-Object { $_.urls -match 'turn' })
    $credentialedRelay = @($relayEntries | Where-Object { $_.username -and $_.credential })
    $turnConfigured = $false
    if ($calls -and ($null -ne $calls.turn_configured)) {
        $turnConfigured = [bool]$calls.turn_configured
    } else {
        $turnConfigured = ($credentialedRelay.Count -gt 0)
    }

    if ($turnConfigured) {
        Write-Host "turn_configured: True" -ForegroundColor Green
    } else {
        Write-Host "turn_configured: False" -ForegroundColor Red
    }
    Write-Host "relay_urls_found: $($relayEntries.Count)"
    Write-Host "credentialed_relay_urls: $($credentialedRelay.Count)"
    if ($credentialedRelay.Count -gt 0) {
        Write-Host "OK: credentialed TURN relay ICE entries present" -ForegroundColor Green
    } else {
        Write-Host "FAIL: no credentialed TURN relay entries" -ForegroundColor Red
    }
    $configOk = $turnConfigured -and ($credentialedRelay.Count -gt 0)
}
catch {
    Write-Host "FAIL: /api/config -> $($_.Exception.Message)" -ForegroundColor Red
}

if ($configOk) {
    Write-Host "OK: TURN relay ICE is configured on the server" -ForegroundColor Green
}
else {
    Write-Host "FAIL: TURN not ready - set TURN_USERNAME/TURN_CREDENTIAL and redeploy API" -ForegroundColor Red
}

Write-Host ""
Write-Host "Founder device matrix (required to close Q.31 / P.6 / I.3):" -ForegroundColor Cyan
Write-Host "  Devices: tester-win (desktop) + tester-android (phone)"
Write-Host "  Record ICE path shown in call UI during connected call"
Write-Host ""
Write-Host "  1 Wi-Fi -> Cellular Audio"
Write-Host "  2 Wi-Fi -> Cellular Video"
Write-Host "  3 Cellular -> Wi-Fi Audio"
Write-Host "  4 Cellular -> Wi-Fi Video"
Write-Host ""
Write-Host "Log results in test_reports/Q31_TURN_OFF_LAN_MATRIX.md"

if (-not $configOk) { exit 1 }
exit 0