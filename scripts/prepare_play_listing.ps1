# Q.62 — Validate Play Store listing assets before upload.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Aab = "C:\Users\smash\Desktop\SSC\APK\SSC-app-release.aab"
$Apk = "C:\Users\smash\Desktop\SSC\APK\SSC-app-release.apk"
$Graphics = Join-Path $Root "play-store\store_graphics"

Write-Host "=== SSC Play Store listing prep (Q.62) ===" -ForegroundColor Cyan

$ok = $true
if (Test-Path $Aab) {
    Write-Host "OK: AAB found — $Aab" -ForegroundColor Green
} else {
    Write-Host "MISSING: AAB — run SSC-BUILD-APK.bat" -ForegroundColor Red
    $ok = $false
}
if (Test-Path $Apk) {
    Write-Host "OK: APK found (Firebase / sideload)" -ForegroundColor Green
}

foreach ($rel in @(
    "play-store\LISTING_COPY.md",
    "play-store\DATA_SAFETY.json",
    "play-store\GRAPHICS_CHECKLIST.md",
    "scripts\GOOGLE_PLAY_SETUP.txt"
)) {
    $path = Join-Path $Root $rel
    if (Test-Path $path) {
        Write-Host "OK: $rel" -ForegroundColor Green
    } else {
        Write-Host "MISSING: $rel" -ForegroundColor Red
        $ok = $false
    }
}

$icon = Join-Path $Graphics "icon-512.png"
if (Test-Path $icon) {
    Write-Host "OK: store icon" -ForegroundColor Green
} else {
    Write-Host "PENDING: play-store/store_graphics/icon-512.png" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Founder steps: scripts/GOOGLE_PLAY_SETUP.txt" -ForegroundColor Cyan
Write-Host "Play Console: https://play.google.com/console" -ForegroundColor Cyan
if (-not $ok) { exit 1 }