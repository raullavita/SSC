# SSC deploy validation — Engine 13 (dry-run, no live push)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

$checks = @()

function Add-Check($name, $passed, $detail) {
    $script:checks += [pscustomobject]@{ name = $name; passed = $passed; detail = $detail }
}

$required = @(
    "backend/Dockerfile",
    "firebase.json",
    ".firebaserc",
    "scripts/deploy_cloud_run.ps1",
    "scripts/deploy_hosting.ps1",
    "sfu-server/server.js"
)
foreach ($rel in $required) {
    $path = Join-Path $Root $rel
    Add-Check "file:$rel" (Test-Path $path) $path
}

$docker = Get-Content (Join-Path $Root "backend/Dockerfile") -Raw
Add-Check "dockerfile_uvicorn" ($docker -match "uvicorn server:app") ""

$firebase = Get-Content (Join-Path $Root "firebase.json") -Raw -ErrorAction SilentlyContinue
Add-Check "firebase_hosting" ($firebase -match "hosting") ""

. (Join-Path $PSScriptRoot "resolve_gcloud.ps1")
$gcloudPath = Resolve-GcloudPath
$firebaseCli = Get-Command firebase -ErrorAction SilentlyContinue
Add-Check "gcloud_installed" ([bool]$gcloudPath) $(if ($gcloudPath) { $gcloudPath } else { "optional for live deploy" })
Add-Check "firebase_cli_installed" ([bool]$firebaseCli) "optional for live deploy"

$allRequired = $checks | Where-Object { $_.name -like "file:*" -or $_.name -eq "dockerfile_uvicorn" -or $_.name -eq "firebase_hosting" }
$passed = ($allRequired | Where-Object { -not $_.passed }).Count -eq 0

$result = @{ passed = $passed; checks = $checks; note = "validation only, no cloud deploy performed" }
$result | ConvertTo-Json -Depth 4
if ($passed) { Write-Host "DEPLOY VALIDATION PASSED" } else { Write-Host "DEPLOY VALIDATION FAILED"; exit 1 }