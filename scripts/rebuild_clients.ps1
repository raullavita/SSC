# SSC - rebuild product clients (native only).
# Electron UI is retired; Windows product is Qt (desktop/).
#
# Usage:
#   .\scripts\rebuild_clients.ps1
#   .\scripts\rebuild_clients.ps1 -AndroidOnly
#   .\scripts\rebuild_clients.ps1 -WindowsOnly

param(
    [switch]$AndroidOnly,
    [switch]$WindowsOnly,
    [switch]$ElectronOnly,
    [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if ($ElectronOnly) {
    Write-Host "ERROR: Electron is removed from the product plan (no WebView/Electron UI)."
    Write-Host "Desktop target is Qt Quick/QML. See docs/ELECTRON_RETIRED.md and docs/WINDOWS_CLIENT.md"
    exit 1
}

Write-Host "SSC client rebuild - product paths v0.4.0 / build 15"
Write-Host "  Android: Jetpack Compose"
Write-Host "  Windows: Qt Quick (desktop/)"

if (-not $WindowsOnly) {
    Write-Host ""
    Write-Host "=== Android (native Compose) ==="
    & "$PSScriptRoot\build_android.ps1"
}

if (-not $AndroidOnly) {
    Write-Host ""
    Write-Host "=== Windows (Qt desktop) ==="
    & "$PSScriptRoot\build_desktop_windows.ps1"
}

if (-not $SkipSmoke -and (Test-Path "$PSScriptRoot\release_smoke_test.ps1")) {
    Write-Host ""
    Write-Host "=== Smoke (optional) ==="
    try {
        & "$PSScriptRoot\release_smoke_test.ps1"
    } catch {
        Write-Host "WARN: smoke test skipped or failed: $_"
    }
}

Write-Host ""
Write-Host "Done. Artifacts:"
Write-Host "  Android: android\app\build\outputs\apk\release\SSC-0.4.0.apk"
Write-Host "  Windows: dist\windows-qt\SSC-Desktop-0.4.0.exe"
