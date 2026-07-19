# Build release APK and print free sideload instructions (no Play Store).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "SSC free sideload build"
Write-Host "======================="
Write-Host "No Google Play fee required. Uses your free keystore if configured."
Write-Host ""

& "$PSScriptRoot\build_android.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Get-ChildItem "$Root\android\app\build\outputs\apk\release\*.apk" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $apk) {
    Write-Host "No release APK found. Check build logs."
    exit 1
}

Write-Host ""
Write-Host "APK ready: $($apk.FullName)"
Write-Host "Size: $([math]::Round($apk.Length / 1MB, 1)) MB"
Write-Host ""
Write-Host "Install on phone:"
Write-Host "  1. Copy APK to phone (USB / Drive / website)"
Write-Host "  2. Enable Install unknown apps for that app"
Write-Host "  3. Open APK and install"
Write-Host ""
Write-Host "Docs: docs\FREE_DISTRIBUTION.md"
