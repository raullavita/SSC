# Verify GitHub release has both Windows EXE and Android APK attached.
# Usage: .\scripts\check_github_release_assets.ps1 -Tag v0.3.0

param(
    [string]$Tag = "v0.3.0",
    [string]$Repo = "raullavita/SSC"
)

$ErrorActionPreference = "Stop"

$release = gh release view $Tag --repo $Repo --json assets 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Release $Tag not found on $Repo"
}

$json = $release | ConvertFrom-Json
$names = @($json.assets | ForEach-Object { $_.name })

$needExe = "SSC-Setup-0.3.0.exe"
$needApk = "SSC-0.3.0.apk"
$missing = @()

if ($names -notcontains $needExe) { $missing += $needExe }
if ($names -notcontains $needApk) { $missing += $needApk }

if ($missing.Count -gt 0) {
    Write-Host "RELEASE ASSETS INCOMPLETE for $Tag"
    foreach ($m in $missing) { Write-Host "  MISSING: $m" }
    Write-Host "Attached: $($names -join ', ')"
    exit 1
}

Write-Host "Release $Tag has required assets: $needExe, $needApk"
exit 0