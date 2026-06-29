# Flip desktop signing.config.json when founder certs are live (Q.61).
$ErrorActionPreference = "Stop"
$cfgPath = Join-Path $PSScriptRoot "..\frontend\desktop\signing.config.json"
$cfg = @{
    windows_authenticode = $true
    mac_notarized = $true
    verify_windows_update_signature = $true
} | ConvertTo-Json
Set-Content -Path $cfgPath -Value $cfg -Encoding UTF8
Write-Host "Updated $cfgPath — rebuild desktop installers before publishing." -ForegroundColor Green
Write-Host "Also set in backend/cloud_run.env:" -ForegroundColor Cyan
Write-Host "  SSC_WIN_CODE_SIGNING_ENABLED=true"
Write-Host "  SSC_MAC_NOTARIZE_ENABLED=true"
Write-Host "  SSC_WIN_VERIFY_UPDATE_SIGNATURE=true"