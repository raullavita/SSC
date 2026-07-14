# SSC Cloud Run deploy - Engine 10
# Uses gcloud from PATH or known install locations; auth via gcloud login or Firebase CLI token.

param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$Project = $env:SSC_GCP_PROJECT,
    [string]$Region = $env:SSC_CLOUD_RUN_REGION,
    [string]$Service = $env:SSC_CLOUD_RUN_SERVICE,
    [string]$EnvFile = "",
    [switch]$UseLocalDocker
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "resolve_gcloud.ps1")

if (-not $Project) { $Project = "super-chat-b0992" }
if (-not $Region) { $Region = "europe-west1" }
if (-not $Service) { $Service = "ssc-api" }

$Gcloud = Resolve-GcloudPath
if (-not $Gcloud) {
    throw "gcloud not found. Install to %LOCALAPPDATA%\Google\Cloud SDK or run scripts that install to .ssc-tools\google-cloud-sdk"
}

Write-Host "gcloud: $Gcloud"
$null = Ensure-GcloudAuth -Gcloud $Gcloud
& $Gcloud config set project $Project | Out-Null

$Backend = Join-Path $ProjectRoot "backend"
if (-not $EnvFile) {
    $EnvFile = Join-Path $Backend "cloudrun-env.yaml"
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
$useDocker = $UseLocalDocker -and $docker

Push-Location $Backend
try {
    if ($useDocker) {
        $Image = "gcr.io/$Project/$Service"
        Write-Host "Building Docker image locally: $Image"
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
        }

        $VpcConnector = if ($env:SSC_VPC_CONNECTOR) { $env:SSC_VPC_CONNECTOR } else { "ssc-connector" }
        $deployArgs += @("--vpc-connector", $VpcConnector, "--vpc-egress", "all-traffic")

        Write-Host "Deploying to Cloud Run: $Service / $Region ..."
        & $Gcloud @deployArgs
    } else {
        Write-Host "Deploying from source (Cloud Build - no local Docker required)..."
        $deployArgs = @(
            "run", "deploy", $Service,
            "--source", ".",
            "--region", $Region,
            "--project", $Project,
            "--allow-unauthenticated",
            "--port", "8080",
            "--quiet"
        )
        if (Test-Path $EnvFile) {
            Write-Host "Applying env from $EnvFile"
            $deployArgs += @("--env-vars-file", $EnvFile)
        } else {
            Write-Warning "No $EnvFile — deploy will use existing Cloud Run env only. Copy cloudrun-env.yaml.example to cloudrun-env.yaml."
        }
        $VpcConnector = if ($env:SSC_VPC_CONNECTOR) { $env:SSC_VPC_CONNECTOR } else { "ssc-connector" }
        $deployArgs += @("--vpc-connector", $VpcConnector, "--vpc-egress", "all-traffic")
        & $Gcloud @deployArgs
    }
    Write-Host "Cloud Run deploy complete."
} finally {
    Pop-Location
}