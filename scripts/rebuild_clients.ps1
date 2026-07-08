# SSC - rebuild installed clients (one UI: React bundle in Electron + Android WebView).
#
# Usage:
#   .\scripts\rebuild_clients.ps1                    # prod API, both platforms
#   .\scripts\rebuild_clients.ps1 -ElectronOnly
#   .\scripts\rebuild_clients.ps1 -AndroidOnly
#   $env:REACT_APP_API_URL = "http://192.168.1.5:8000"; .\scripts\rebuild_clients.ps1

param(
    [switch]$ElectronOnly,
    [switch]$AndroidOnly,
    [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "SSC client rebuild - shared React UI (v0.3.1 build 10)"
if ($env:REACT_APP_API_URL) {
    Write-Host "API override: $($env:REACT_APP_API_URL)"
} else {
    Write-Host "API: https://api.supersecurechat.com (production)"
}

$buildElectron = -not $AndroidOnly
$buildAndroid = -not $ElectronOnly

if ($buildElectron) {
    Write-Host ""
    Write-Host "=== Electron (Windows) ==="
    & "$PSScriptRoot\build_electron.ps1"
}

if ($buildAndroid) {
    Write-Host ""
    Write-Host "=== Android (WebView APK) ==="
    & "$PSScriptRoot\build_android.ps1"
}

$LatestBuilds = Join-Path $Root "latest-builds"
New-Item -ItemType Directory -Force -Path $LatestBuilds | Out-Null

Write-Host ""
Write-Host "=== Copy to latest-builds ==="
if ($buildElectron) {
    $exe = Get-ChildItem (Join-Path $Root "electron/dist/SSC-Setup-*.exe") -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch 'portable' } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($exe) {
        Copy-Item $exe.FullName (Join-Path $LatestBuilds $exe.Name) -Force
        Write-Host "  $($exe.Name) ($([math]::Round($exe.Length/1MB,1)) MB)"
    }
}
if ($buildAndroid) {
    $apk = Join-Path $Root "android/app/build/outputs/apk/release/SSC-0.3.1.apk"
    if (Test-Path $apk) {
        Copy-Item $apk (Join-Path $LatestBuilds "SSC-0.3.1.apk") -Force
        $apkSize = (Get-Item $apk).Length
        Write-Host "  SSC-0.3.1.apk ($([math]::Round($apkSize/1MB,1)) MB)"
    }
}

if (-not $SkipSmoke) {
    Write-Host ""
    Write-Host "=== Production smoke (API + web) ==="
    $smokeArgs = @()
    if ($buildElectron) {
        $exe = Get-ChildItem (Join-Path $Root "electron/dist/SSC-Setup-*.exe") -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($exe) { $smokeArgs += "-ExePath"; $smokeArgs += $exe.FullName }
    }
    if ($buildAndroid) {
        $apk = Join-Path $Root "android/app/build/outputs/apk/release/SSC-0.3.1.apk"
        if (Test-Path $apk) { $smokeArgs += "-ApkPath"; $smokeArgs += $apk }
    }
    & "$PSScriptRoot\release_smoke_test.ps1" @smokeArgs
}

Write-Host ""
Write-Host "Done. Latest builds:"
if ($buildElectron) { Write-Host "  Laptop: latest-builds/SSC-Setup-0.3.1.exe" }
if ($buildAndroid) { Write-Host "  Phone:  latest-builds/SSC-0.3.1.apk" }