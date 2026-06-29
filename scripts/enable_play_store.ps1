param(
    [Parameter(Mandatory = $true)]
    [string]$StoreUrl
)
# Wire Google Play store URL after listing is live (Q.62).
$ErrorActionPreference = "Stop"
if ($StoreUrl -notmatch "^https://play\.google\.com/") {
    Write-Host "Expected a play.google.com store URL." -ForegroundColor Red
    exit 1
}

Write-Host "Add to backend/cloud_run.env (then redeploy API):" -ForegroundColor Cyan
Write-Host "SSC_GOOGLE_PLAY_STORE_URL=$StoreUrl"
Write-Host "SSC_ANDROID_PREFER_PLAY_STORE=true"
Write-Host ""
Write-Host "Add to frontend/.env.production.local (then rebuild hosting):" -ForegroundColor Cyan
Write-Host "REACT_APP_GOOGLE_PLAY_STORE_URL=$StoreUrl"
Write-Host ""
Write-Host "Package id: chat.ssc.secure" -ForegroundColor Green