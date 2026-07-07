# SSC Firebase Hosting deploy - Engine 10

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
    Write-Warning ".env.production missing - copy from .env.production.example"
}

if (-not $SkipBuild) {
    Write-Host "Building React production bundle (landing-only; installed clients use build_electron/build_android)..."
    Push-Location $Frontend
    try {
        $env:REACT_APP_SSC_PLATFORM = "web"
        $env:REACT_APP_SSC_LANDING_ONLY = "true"
        $env:REACT_APP_SSC_VERSION = "0.3.1"
        $env:REACT_APP_SSC_BUILD = "10"
        $env:REACT_APP_SSC_RELEASE_TAG = "v0.3.1"
        $env:REACT_APP_SSC_REQUIRE_LIBCRYPTO = "false"
        $env:REACT_APP_API_URL = $(if ($env:REACT_APP_API_URL) { $env:REACT_APP_API_URL } else { "https://api.supersecurechat.com" })
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