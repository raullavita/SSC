# Verify product release binaries (Android APK + Windows Qt) before upload.
# Usage: .\scripts\verify_release_artifacts.ps1

param(
    [string]$ExePath = "",
    [string]$ApkPath = "",
    [string]$QtDir = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure([string]$Message) {
    $script:failures.Add($Message) | Out-Null
}

function Assert-Ok([string]$Name, [bool]$Passed, [string]$Detail) {
    if ($Passed) { Write-Host "OK: $Name" } else { Add-Failure "$Name - $Detail" }
}

if (-not $ExePath) {
    $ExePath = Join-Path $Root "dist\windows-qt\SSC-Desktop-0.4.0.exe"
}
if (-not $ApkPath) {
    $ApkPath = Join-Path $Root "android\app\build\outputs\apk\release\SSC-0.4.0.apk"
    if (-not (Test-Path $ApkPath)) {
        $ApkPath = Join-Path $Root "android\app\build\outputs\apk\release\app-release.apk"
    }
}
if (-not $QtDir) {
    $QtDir = Join-Path $Root "dist\windows-qt"
}

Write-Host "Verifying product release artifacts (v0.4.0)..."

# Windows Qt product
if (Test-Path $ExePath) {
    $exe = Get-Item $ExePath
    Assert-Ok "qt.exe.exists" $true $ExePath
    Assert-Ok "qt.exe.size" ($exe.Length -gt 1MB) "$([math]::Round($exe.Length / 1MB, 2)) MB"
} else {
    Add-Failure "qt.exe - missing at $ExePath (run scripts\build_desktop_windows.ps1)"
}

$cryptoWorker = Join-Path $QtDir "crypto-worker\worker.js"
$mediaWorker = Join-Path $QtDir "media-worker\worker.js"
$nodeRuntime = Join-Path $QtDir "runtime\node\node.exe"
Assert-Ok "qt.crypto-worker" (Test-Path $cryptoWorker) $cryptoWorker
Assert-Ok "qt.media-worker" (Test-Path $mediaWorker) $mediaWorker
Assert-Ok "qt.runtime-node" (Test-Path $nodeRuntime) $nodeRuntime
Assert-Ok "qt.sfuClient" (Test-Path (Join-Path $QtDir "media-worker\sfuClient.js")) "sfuClient.js"
Assert-Ok "qt.sfuSdp" (Test-Path (Join-Path $QtDir "media-worker\sfuSdp.js")) "sfuSdp.js"

# Android native Compose
if (Test-Path $ApkPath) {
    $apk = Get-Item $ApkPath
    Assert-Ok "apk.exists" $true $ApkPath
    $apkMb = [math]::Round($apk.Length / 1MB, 2)
    Assert-Ok "apk.size" ($apk.Length -gt 1MB -and $apk.Length -lt 250MB) "${apkMb} MB"

    $apksigner = Join-Path $env:LOCALAPPDATA "Android\Sdk\build-tools\35.0.0\apksigner.bat"
    if (-not (Test-Path $apksigner)) {
        $apksigner = Get-ChildItem (Join-Path $env:LOCALAPPDATA "Android\Sdk\build-tools") -Filter apksigner.bat -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
    }
    if ($apksigner -and (Test-Path $apksigner)) {
        & $apksigner verify --print-certs $ApkPath 2>&1 | Out-Null
        Assert-Ok "apk.signed" ($LASTEXITCODE -eq 0) "APK must be signed to install on Android"
    } else {
        Write-Host "WARN: apksigner not found - skipping APK signature check"
    }
} else {
    Add-Failure "apk - missing at $ApkPath (run scripts\build_android.ps1)"
}

$smokeScript = Join-Path $Root "scripts\release_smoke_test.ps1"
if (Test-Path $smokeScript) {
    & $smokeScript
    $smokeExit = $LASTEXITCODE
    if ($smokeExit -ne 0) {
        Add-Failure "production smoke test failed (exit $smokeExit)"
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "ARTIFACT VERIFICATION FAILED:"
    foreach ($item in $failures) { Write-Host "  - $item" }
    exit 1
}

Write-Host ""
Write-Host "ARTIFACT VERIFICATION PASSED"
