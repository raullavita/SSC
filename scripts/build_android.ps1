# SSC Android local APK build — Engine 11 (no Play Store deploy)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command gradle -ErrorAction SilentlyContinue)) {
    Write-Host "Gradle not found. Install Android SDK + Gradle, or open android/ in Android Studio."
    exit 1
}

Push-Location "$Root\android"
gradle assembleRelease
Pop-Location

Write-Host "APK output: android\app\build\outputs\apk\release\"