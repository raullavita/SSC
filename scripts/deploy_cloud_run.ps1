# SSC Cloud Run deploy — Engine 10
# Requires: gcloud CLI authenticated, Docker available

param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$Project = $env:SSC_GCP_PROJECT,
    [string]$Region = $env:SSC_CLOUD_RUN_REGION,
    [string]$Service = $env:SSC_CLOUD_RUN_SERVICE,
    [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"

if (-not $Project) { $Project = "super-chat-b0992" }
if (-not $Region) { $Region = "us-central1" }
if (-not $Service) { $Service = "ssc-api" }

$Backend = Join-Path $ProjectRoot "backend"
$Image = "gcr.io/$Project/$Service"

if (-not $EnvFile) {
    $EnvFile = Join-Path $Backend "cloudrun-env.yaml"
}

Write-Host "Building Docker image: $Image"
Push-Location $Backend
try {
    docker build -t $Image .
    Write-Host "Pushing to GCR..."
    docker push $Image

    $deployArgs = @(
        "run", "deploy", $Service,
        "--image", $Image,
        "--platform", "managed",
        "--region", $Region,
        "--project", $Project,
        "--allow-unauthenticated",
        "--port", "8080"
    )

    if (Test-Path $EnvFile) {
        Write-Host "Applying env from $EnvFile"
        $deployArgs += @("--env-vars-file", $EnvFile)
    } else {
        Write-Warning "No env file at $EnvFile — using minimal env vars"
        $deployArgs += @("--set-env-vars", "SSC_ENV=production,SSC_ENFORCE_INSTALLED_CLIENT=true")
    }

    Write-Host "Deploying to Cloud Run ($Service @ $Region)..."
    & gcloud @deployArgs
    Write-Host "Cloud Run deploy complete."
} finally {
    Pop-Location
}