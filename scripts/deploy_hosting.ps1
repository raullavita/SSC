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
        # Never share frontend/build with electron/android builds (race wipes landing UI).
        $env:REACT_APP_SSC_PLATFORM = "web"
        $env:REACT_APP_SSC_LANDING_ONLY = "true"
        $env:REACT_APP_SSC_VERSION = "0.4.0"
        $env:REACT_APP_SSC_BUILD = "15"
        $env:REACT_APP_SSC_RELEASE_TAG = "v0.4.0"
        $env:REACT_APP_SSC_REQUIRE_LIBCRYPTO = "false"
        $env:REACT_APP_API_URL = $(if ($env:REACT_APP_API_URL) { $env:REACT_APP_API_URL } else { "https://api.supersecurechat.com" })
        # Absolute asset paths for Firebase Hosting (Electron uses PUBLIC_URL=. separately).
        $env:PUBLIC_URL = "/"
        if (Test-Path "build") {
            Remove-Item "build" -Recurse -Force
        }
        if (Test-Path "yarn.lock") { yarn build } else { npm run build }
        $index = Get-Content "build\index.html" -Raw
        if ($index -notmatch 'static/js/main\.') {
            throw "Hosting build missing main.js in index.html"
        }
        $jsFile = Get-ChildItem "build\static\js\main.*.js" -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notmatch 'LICENSE|\.map$' } |
            Select-Object -First 1
        if (-not $jsFile) { throw "Hosting build missing main.*.js" }
        $jsText = Get-Content $jsFile.FullName -Raw -ErrorAction SilentlyContinue
        if ($jsText -notmatch 'Messaging you can verify') {
            throw "Hosting bundle does not contain landing page content (LANDING_ONLY build failed?)"
        }
        Write-Host "Landing-only build OK: $($jsFile.Name)"
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