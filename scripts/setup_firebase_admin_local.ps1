# Place Firebase Admin service account key for local backend push (FCM).
#
# Cloud Run production uses Secret Manager via deploy_push_cloudrun.ps1.
# Local dev: copy your service account JSON to repo-root ssc-firebase-key.json (gitignored).
#
# Usage:
#   .\scripts\setup_firebase_admin_local.ps1
#   .\scripts\setup_firebase_admin_local.ps1 -Source "C:\Users\you\Downloads\super-chat-b0992-firebase-adminsdk.json"

param(
    [string]$Source = (Join-Path $env:USERPROFILE "Desktop\ssc-firebase-key.json")
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Target = Join-Path $Root "ssc-firebase-key.json"
$sscDir = Join-Path $env:USERPROFILE ".ssc"
$envFile = Join-Path $sscDir "firebase-admin.env"

Write-Host "SSC Firebase Admin — local push credentials"
Write-Host ""
Write-Host "Firebase project: super-chat-b0992"
Write-Host "Target (gitignored): $Target"
Write-Host ""

if (Test-Path $Target) {
    Write-Host "OK: $Target already exists."
} elseif (Test-Path $Source) {
    Copy-Item -Path $Source -Destination $Target -Force
    Write-Host "Copied: $Source -> $Target"
} else {
    Write-Host "No key file found."
    Write-Host "Download a service account JSON from Firebase Console -> Project settings -> Service accounts"
    Write-Host "Save as Desktop\ssc-firebase-key.json or pass -Source, then re-run."
    exit 1
}

if (-not (Test-Path $sscDir)) {
    New-Item -ItemType Directory -Path $sscDir | Out-Null
}

@"
# SSC Firebase Admin — LOCAL ONLY. Do not commit.
GOOGLE_APPLICATION_CREDENTIALS=$Target
"@ | Set-Content -Path $envFile -Encoding utf8

Write-Host ""
Write-Host "Wrote $envFile"
Write-Host "Before running the backend locally:"
Write-Host "  Get-Content `"$envFile`" | ForEach-Object { if (`$_ -match '^([^#=]+)=(.+)$') { Set-Item Env:`$matches[1] `$matches[2] } }"
Write-Host ""
Write-Host "Verify: backend push module loads credentials from GOOGLE_APPLICATION_CREDENTIALS"