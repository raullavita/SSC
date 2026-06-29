param(
    [string]$StoreUrl = "",
    [string]$TestFlightUrl = ""
)
# Wire iOS App Store / TestFlight URLs after listing is live (Q.63).
$ErrorActionPreference = "Stop"
if (-not $StoreUrl -and -not $TestFlightUrl) {
    Write-Host "Provide -StoreUrl and/or -TestFlightUrl." -ForegroundColor Red
    exit 1
}
if ($StoreUrl -and $StoreUrl -notmatch "^https://apps\.apple\.com/") {
    Write-Host "StoreUrl should be an apps.apple.com link." -ForegroundColor Yellow
}
if ($TestFlightUrl -and $TestFlightUrl -notmatch "^https://testflight\.apple\.com/") {
    Write-Host "TestFlightUrl should be a testflight.apple.com link." -ForegroundColor Yellow
}

Write-Host "Add to backend/cloud_run.env (then redeploy API):" -ForegroundColor Cyan
if ($StoreUrl) { Write-Host "SSC_IOS_APP_STORE_URL=$StoreUrl" }
if ($TestFlightUrl) { Write-Host "SSC_IOS_TESTFLIGHT_URL=$TestFlightUrl" }
Write-Host ""
Write-Host "Add to frontend/.env.production.local (then rebuild hosting):" -ForegroundColor Cyan
if ($StoreUrl) { Write-Host "REACT_APP_IOS_APP_STORE_URL=$StoreUrl" }
if ($TestFlightUrl) { Write-Host "REACT_APP_IOS_TESTFLIGHT_URL=$TestFlightUrl" }
Write-Host ""
Write-Host "Bundle id: chat.ssc.secure" -ForegroundColor Green