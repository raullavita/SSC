# SSC Firebase Hosting deploy — Engine 10

param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$Project = $env:SSC_FIREBASE_PROJECT,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

if (-not $Project) { $Project = "super-chat-b0992" }

$Frontend = Join-Path $ProjectRoot "frontend"
$EnvProd = Join-Path $Frontend ".env.production"

if (-not (Test-Path $EnvProd)) {
    Write-Warning ".env.production missing — copy from .env.production.example"
}

if (-not $SkipBuild) {
    Write-Host "Building React production bundle..."
    Push-Location $Frontend
    try {
        if (Test-Path "yarn.lock") { yarn build } else { npm run build }
    } finally {
        Pop-Location
    }
}

Write-Host "Deploying Firebase Hosting (project: $Project)..."
Push-Location $ProjectRoot
try {
    firebase deploy --only hosting --project $Project
    Write-Host "Firebase Hosting deploy complete."
} finally {
    Pop-Location
}