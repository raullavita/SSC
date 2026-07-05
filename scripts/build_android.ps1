# SSC Android local APK build — Engine 11 (unsigned sideload, no Play Store)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Version = "0.3.0"

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
$srcApk = Get-ChildItem "$releaseDir\*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $srcApk) {
    Write-Host "No APK found in $releaseDir"
    exit 1
}

$destApk = Join-Path $releaseDir "SSC-$Version.apk"
Copy-Item $srcApk.FullName $destApk -Force
Write-Host "APK output: $destApk"