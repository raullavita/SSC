# Verify release binaries before upload (P0 #4 local substitute for clean-machine test).
# Usage: .\scripts\verify_release_artifacts.ps1

param(
    [string]$ExePath = "",
    [string]$ApkPath = "",
    [string]$UnpackedDir = ""
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
    $ExePath = Join-Path $Root "electron\dist\SSC-Setup-0.3.0.exe"
}
if (-not $ApkPath) {
    $ApkPath = Join-Path $Root "android\app\build\outputs\apk\release\SSC-0.3.0.apk"
}
if (-not $UnpackedDir) {
    $UnpackedDir = Join-Path $Root "electron\dist\win-unpacked"
}

Write-Host "Verifying release artifacts..."

if (Test-Path $ExePath) {
    $exe = Get-Item $ExePath
    Assert-Ok "exe.exists" $true $ExePath
    Assert-Ok "exe.size" ($exe.Length -gt 5MB) "$([math]::Round($exe.Length / 1MB, 2)) MB"
} else {
    Add-Failure "exe - missing at $ExePath"
}

$indexCandidates = @(
    (Join-Path $UnpackedDir "resources\app\index.html"),
    (Join-Path $UnpackedDir "resources\app\build\index.html")
)
$indexFound = $false
foreach ($candidate in $indexCandidates) {
    if (Test-Path $candidate) {
        $indexFound = $true
        $html = Get-Content $candidate -Raw
        Assert-Ok "electron.index.html" $true $candidate
        Assert-Ok "electron.react_root" ($html -match 'id="root"') "index.html missing React root"
        break
    }
}
if (-not $indexFound) {
    Add-Failure "electron.index.html - not found under $UnpackedDir (rebuild electron to populate win-unpacked)"
}

if (Test-Path $ApkPath) {
    $apk = Get-Item $ApkPath
    Assert-Ok "apk.exists" $true $ApkPath
    Assert-Ok "apk.size" ($apk.Length -gt 1MB) "$([math]::Round($apk.Length / 1MB, 2)) MB"

    Write-Host "OK: apk.unsigned_sideload (signing not required)"
} else {
    Add-Failure "apk - missing at $ApkPath"
}

$smokeScript = Join-Path $Root "scripts\release_smoke_test.ps1"
& $smokeScript -ExePath $ExePath -ApkPath $ApkPath
$smokeExit = $LASTEXITCODE
if ($smokeExit -ne 0) {
    Add-Failure "production smoke test failed (exit $smokeExit)"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "ARTIFACT VERIFICATION FAILED:"
    foreach ($item in $failures) { Write-Host "  - $item" }
    exit 1
}

Write-Host ""
Write-Host "ARTIFACT VERIFICATION PASSED"