# SSC Android APK — pure native Jetpack Compose (no WebView / no React bundle)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Version = "0.4.0"
$Build = "15"

$signingLoaded = & "$PSScriptRoot\load_android_signing.ps1"
if ($signingLoaded -and $env:SSC_ANDROID_KEYSTORE) {
    Write-Host "Release signing: $($env:SSC_ANDROID_KEYSTORE)"
} else {
    Write-Host "WARN: No release keystore - using debug keystore (fine for dev, not for releases)."
    Write-Host "      Run .\scripts\create_android_keystore.ps1 first."
}

Write-Host "Building native Android (Compose) — WebView UI removed per NATIVE_CLIENT_CHARTER..."
Push-Location "$Root\android"
if (Test-Path ".\gradlew.bat") {
    .\gradlew.bat assembleRelease
} elseif (Get-Command gradle -ErrorAction SilentlyContinue) {
    gradle assembleRelease
} else {
    Write-Host "Gradle not found. Install Android SDK + Gradle, or open android/ in Android Studio."
    exit 1
}
Pop-Location

$releaseDir = "$Root\android\app\build\outputs\apk\release"
$srcApk = Get-ChildItem "$releaseDir\*.apk" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $srcApk) {
    Write-Host "No APK found in $releaseDir"
    exit 1
}

$destApk = Join-Path $releaseDir "SSC-$Version.apk"
Copy-Item $srcApk.FullName $destApk -Force
$sizeMb = [math]::Round((Get-Item $destApk).Length / 1MB, 1)
Write-Host "APK output: $destApk - $sizeMb megabytes (build $Build)"
