# Update SSC_SFU_INTERNAL_URL in local cloudrun-env.yaml from the live GCE SFU IP.
# Run after SFU instance recreate or IP change, then redeploy API.
#
# Usage:
#   .\scripts\update_sfu_internal_url.ps1
#   .\scripts\update_sfu_internal_url.ps1 -Deploy

param(
    [string]$Project = $(if ($env:SSC_GCP_PROJECT) { $env:SSC_GCP_PROJECT } else { "super-chat-b0992" }),
    [string]$Zone = $(if ($env:SSC_SFU_ZONE) { $env:SSC_SFU_ZONE } else { "europe-west1-b" }),
    [string]$Instance = $(if ($env:SSC_SFU_INSTANCE) { $env:SSC_SFU_INSTANCE } else { "ssc-sfu" }),
    [string]$EnvFile = "",
    [switch]$Deploy
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) {
    $EnvFile = Join-Path $Root "backend\cloudrun-env.yaml"
}

if (-not (Test-Path $EnvFile)) {
    Write-Error "Missing $EnvFile — copy from backend/cloudrun-env.yaml.example"
}

$ip = gcloud compute instances describe $Instance --zone=$Zone --project=$Project `
    --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
if (-not $ip) {
    Write-Error "Could not resolve public IP for $Instance"
}

$newUrl = "http://${ip}:4443"
$lines = Get-Content $EnvFile
$updated = $false
$out = foreach ($line in $lines) {
    if ($line -match '^SSC_SFU_INTERNAL_URL:') {
        $updated = $true
        "SSC_SFU_INTERNAL_URL: `"$newUrl`""
    } else {
        $line
    }
}
if (-not $updated) {
    $out += "SSC_SFU_INTERNAL_URL: `"$newUrl`""
}
Set-Content -Path $EnvFile -Value $out -Encoding utf8

Write-Host "Updated SSC_SFU_INTERNAL_URL -> $newUrl in $EnvFile"
Write-Host "Also set SFU_ANNOUNCED_IP=$ip on the SFU container (deploy_sfu_gce.ps1 does this on update)."
Write-Host "DNS A records: sfu.supersecurechat.com and turn.supersecurechat.com -> $ip"

if ($Deploy) {
    Write-Host "Redeploying Cloud Run API..."
    & (Join-Path $Root "scripts\deploy_cloud_run.ps1")
}