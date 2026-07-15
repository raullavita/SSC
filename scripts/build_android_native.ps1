# Build SSC Android release APK (WebView shell + native libsignal bridges).
# Output is tagged SSC-Native-* for distribution; same Gradle target as build_android.ps1.
param(
    [string]$Version = "0.3.1",
    [string]$Build = "12"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$AndroidDir = Join-Path $Root "android"
$ApkOut = Join-Path $AndroidDir "app\build\outputs\apk\release\app-release.apk"
$ReleaseApk = Join-Path $AndroidDir "app\build\outputs\apk\release\SSC-$Version.apk"
$DistDir = Join-Path $Root "dist"
$DistApk = Join-Path $DistDir "SSC-$Version.apk"
$DistNativeApk = Join-Path $DistDir "SSC-Native-$Version-build$Build.apk"

Push-Location $AndroidDir
try {
    & .\gradlew.bat assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "Gradle assembleRelease failed with exit $LASTEXITCODE" }
} finally {
    Pop-Location
}

if (-not (Test-Path $ApkOut)) {
    throw "APK not found at $ApkOut"
}

New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
Copy-Item -Force $ApkOut $ReleaseApk
Copy-Item -Force $ApkOut $DistApk
Copy-Item -Force $ApkOut $DistNativeApk
$sizeMb = [math]::Round((Get-Item $DistApk).Length / 1MB, 1)
Write-Host "Built release APK ($sizeMb MB):"
Write-Host "  $DistApk"
Write-Host "  $DistNativeApk"
Write-Host "Install on phone: adb install -r `"$DistApk`""