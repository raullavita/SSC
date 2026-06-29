# Q.63 — Validate App Store listing assets (Windows-friendly).
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Graphics = Join-Path $Root "app-store\store_graphics"

Write-Host "=== SSC App Store listing prep (Q.63) ===" -ForegroundColor Cyan

$ok = $true
foreach ($rel in @(
    "app-store\LISTING_COPY.md",
    "app-store\PRIVACY_NUTRITION.json",
    "app-store\GRAPHICS_CHECKLIST.md",
    "scripts\APP_STORE_SETUP.txt",
    "SSC-BUILD-IOS.sh",
    "frontend\ios\App\App\Info.plist"
)) {
    $path = Join-Path $Root $rel
    if (Test-Path $path) {
        Write-Host "OK: $rel" -ForegroundColor Green
    } else {
        Write-Host "MISSING: $rel" -ForegroundColor Red
        $ok = $false
    }
}

$plist = Get-Content (Join-Path $Root "frontend\ios\App\App\Info.plist") -Raw
foreach ($key in @("NSCameraUsageDescription", "NSMicrophoneUsageDescription", "CFBundleURLTypes")) {
    if ($plist -match $key) {
        Write-Host "OK: Info.plist $key" -ForegroundColor Green
    } else {
        Write-Host "MISSING: Info.plist $key" -ForegroundColor Red
        $ok = $false
    }
}

if (Test-Path (Join-Path $Graphics "icon-1024.png")) {
    Write-Host "OK: App Store icon" -ForegroundColor Green
} else {
    Write-Host "PENDING: app-store/store_graphics/icon-1024.png" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "iOS build requires macOS - run ./SSC-BUILD-IOS.sh on a Mac" -ForegroundColor Cyan
Write-Host "Founder guide: scripts/APP_STORE_SETUP.txt" -ForegroundColor Cyan
if (-not $ok) { exit 1 }