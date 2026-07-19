# SSC - rebuild product clients (native only).
# Electron / WebView hybrid builds are retired (NATIVE_CLIENT_CHARTER).
#
# Usage:
#   .\scripts\rebuild_clients.ps1
#   .\scripts\rebuild_clients.ps1 -AndroidOnly

param(
    [switch]$AndroidOnly,
    [switch]$ElectronOnly,
    [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if ($ElectronOnly) {
    Write-Host "ERROR: Electron is removed from the product plan (no WebView/Electron UI)."
    Write-Host "Desktop target is Qt Quick/QML. See memory/NATIVE_CLIENT_CHARTER.md"
    exit 1
}

Write-Host "SSC client rebuild - native Android Compose (v0.4.0)"
Write-Host "iOS SwiftUI + Qt desktop: not in this script yet."

Write-Host ""
Write-Host "=== Android (native Compose) ==="
& "$PSScriptRoot\build_android.ps1"

if (-not $SkipSmoke -and (Test-Path "$PSScriptRoot\release_smoke_test.ps1")) {
    Write-Host ""
    Write-Host "=== Smoke (optional) ==="
    try {
        & "$PSScriptRoot\release_smoke_test.ps1"
    } catch {
        Write-Host "WARN: smoke test skipped or failed: $_"
    }
}
