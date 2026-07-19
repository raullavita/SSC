# SSC Android APK - pure native Jetpack Compose (no WebView / no React bundle)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Version = "0.4.0"
$Build = "15"

$signingLoaded = & "$PSScriptRoot\load_android_signing.ps1"
if ($signingLoaded -and $env:SSC_ANDROID_KEYSTORE) {
    Write-Host "Release signing: $($env:SSC_ANDROID_KEYSTORE)"
} elseif ($env:SSC_ALLOW_DEBUG_RELEASE_SIGNING -eq "1") {
    Write-Host "WARN: SSC_ALLOW_DEBUG_RELEASE_SIGNING=1 - release APK will use debug keystore."
} else {
    Write-Host "ERROR: No release keystore. Run .\scripts\create_android_keystore.ps1"
    Write-Host "       Or set SSC_ALLOW_DEBUG_RELEASE_SIGNING=1 for local free sideload only."
    exit 1
}

Write-Host "Building native Android (Compose) - WebView UI removed per NATIVE_CLIENT_CHARTER..."
Push-Location "$Root\android"
try {
    if (Test-Path ".\gradlew.bat") {
        & .\gradlew.bat assembleRelease
        if ($LASTEXITCODE -ne 0) { throw "gradlew assembleRelease failed: $LASTEXITCODE" }
    } elseif (Get-Command gradle -ErrorAction SilentlyContinue) {
        & gradle assembleRelease
        if ($LASTEXITCODE -ne 0) { throw "gradle assembleRelease failed: $LASTEXITCODE" }
    } else {
        Write-Host "Gradle not found. Install Android SDK + Gradle, or open android/ in Android Studio."
        exit 1
    }
} finally {
    Pop-Location
}

$releaseDir = "$Root\android\app\build\outputs\apk\release"
$srcApk = Get-ChildItem "$releaseDir\*.apk" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $srcApk) {
    Write-Host "No APK found in $releaseDir"
    exit 1
}

$destApk = Join-Path $releaseDir "SSC-$Version.apk"
Copy-Item $srcApk.FullName $destApk -Force

# Also stage under dist/ for distribute + release upload scripts
$distDir = Join-Path $Root "dist"
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }
Copy-Item $destApk (Join-Path $distDir "SSC-$Version.apk") -Force

$sizeMb = [math]::Round((Get-Item $destApk).Length / 1MB, 1)
Write-Host "APK output: $destApk - $sizeMb megabytes (build $Build)"
