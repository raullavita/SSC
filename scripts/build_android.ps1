# SSC Android APK build — bundles the installed-app UI (same shell as Electron)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Version = "0.3.0"
$Build = "6"

Write-Host "Building frontend for Android..."
Push-Location "$Root\frontend"
$env:REACT_APP_SSC_PLATFORM = "android"
$env:REACT_APP_SSC_LANDING_ONLY = "false"
$env:REACT_APP_SSC_VERSION = $Version
$env:REACT_APP_SSC_BUILD = $Build
$env:REACT_APP_SSC_REQUIRE_LIBCRYPTO = "true"
$env:PUBLIC_URL = "."
$env:REACT_APP_API_URL = $(if ($env:REACT_APP_API_URL) { $env:REACT_APP_API_URL } else { "https://api.supersecurechat.com" })
$env:REACT_APP_GOOGLE_CLIENT_ID = $(if ($env:REACT_APP_GOOGLE_CLIENT_ID) { $env:REACT_APP_GOOGLE_CLIENT_ID } else { "814078411789-o3t5krp2mvoi32rkaug6jmegtb8t1ihf.apps.googleusercontent.com" })
yarn build
Pop-Location

$assetsDir = "$Root\android\app\src\main\assets\www"
Write-Host "Syncing web bundle to Android assets..."
if (Test-Path $assetsDir) {
    Remove-Item $assetsDir -Recurse -Force
}
New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
Copy-Item "$Root\frontend\build\*" $assetsDir -Recurse -Force

Write-Host "Assembling Android release APK..."
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
$sizeMb = [math]::Round((Get-Item $destApk).Length / 1MB, 1)
Write-Host "APK output: $destApk ($sizeMb MB)"