# SSC Cloud Run deploy — Engine 10
# Requires: gcloud CLI authenticated, Docker available

param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$Project = $env:SSC_GCP_PROJECT,
    [string]$Region = $env:SSC_CLOUD_RUN_REGION,
    [string]$Service = $env:SSC_CLOUD_RUN_SERVICE
)

$ErrorActionPreference = "Stop"

if (-not $Project) { $Project = "super-chat-b0992" }
if (-not $Region) { $Region = "us-central1" }
if (-not $Service) { $Service = "ssc-api" }

$Backend = Join-Path $ProjectRoot "backend"
$Image = "gcr.io/$Project/$Service"

Write-Host "Building Docker image: $Image"
Push-Location $Backend
try {
    docker build -t $Image .
    Write-Host "Pushing to GCR..."
    docker push $Image
    Write-Host "Deploying to Cloud Run ($Service @ $Region)..."
    gcloud run deploy $Service `
        --image $Image `
        --platform managed `
        --region $Region `
        --project $Project `
        --allow-unauthenticated `
        --set-env-vars "SSC_ENV=production,SSC_ENFORCE_INSTALLED_CLIENT=true" `
        --port 8080
    Write-Host "Cloud Run deploy complete."
} finally {
    Pop-Location
}