# SSC SFU TLS — Caddy WSS on GCE + firewall + Cloud Run env hint
#
# YOU must add DNS first (one-time):
#   Type: A    Name: sfu    Value: <SFU_PUBLIC_IP>    TTL: 300
#   At your DNS provider for supersecurechat.com
#
# Usage:
#   .\scripts\deploy_sfu_tls.ps1
#   .\scripts\deploy_sfu_tls.ps1 -UpdateCloudRun

param(
    [string]$Project = $(if ($env:SSC_GCP_PROJECT) { $env:SSC_GCP_PROJECT } else { "super-chat-b0992" }),
    [string]$Zone = $(if ($env:SSC_SFU_ZONE) { $env:SSC_SFU_ZONE } else { "europe-west1-b" }),
    [string]$Instance = $(if ($env:SSC_SFU_INSTANCE) { $env:SSC_SFU_INSTANCE } else { "ssc-sfu" }),
    [string]$Service = $(if ($env:SSC_CLOUD_RUN_SERVICE) { $env:SSC_CLOUD_RUN_SERVICE } else { "ssc-api" }),
    [string]$Region = $(if ($env:SSC_CLOUD_RUN_REGION) { $env:SSC_CLOUD_RUN_REGION } else { "europe-west1" }),
    [switch]$UpdateCloudRun
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$SfuDir = Join-Path $Root "sfu-server"

$ip = gcloud compute instances describe $Instance --zone=$Zone --project=$Project `
    --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
Write-Host "SFU public IP: $ip"

Write-Host "Ensuring firewall allows HTTPS (443)..."
$fwExists = $false
try {
    gcloud compute firewall-rules describe ssc-sfu-https --project=$Project 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $fwExists = $true }
} catch {
    $fwExists = $false
}
if (-not $fwExists) {
    gcloud compute firewall-rules create ssc-sfu-https `
        --project=$Project `
        --direction=INGRESS `
        --priority=1000 `
        --network=default `
        --action=ALLOW `
        --rules=tcp:443 `
        --target-tags=ssc-sfu
}

Write-Host "Copying Caddy files to $Instance..."
gcloud compute scp "$SfuDir\Caddyfile" "${Instance}:/tmp/Caddyfile" --zone=$Zone --project=$Project
gcloud compute scp "$SfuDir\docker-compose.tls.yml" "${Instance}:/tmp/docker-compose.tls.yml" --zone=$Zone --project=$Project

$remoteScript = @'
set -e
mkdir -p ~/ssc-sfu
cp /tmp/Caddyfile ~/ssc-sfu/Caddyfile
docker rm -f ssc-caddy 2>/dev/null || true
docker pull caddy:2-alpine
docker run -d --name ssc-caddy --restart unless-stopped --network host \
  -v ~/ssc-sfu/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v caddy_data:/data -v caddy_config:/config \
  caddy:2-alpine
echo "Caddy TLS proxy started on :443"
'@

Write-Host "Starting Caddy on GCE..."
gcloud compute ssh $Instance --zone=$Zone --project=$Project `
    --ssh-flag="-o StrictHostKeyChecking=accept-new" `
    --command=$remoteScript

Write-Host ""
Write-Host "=== Manual step (DNS) ==="
Write-Host "Add an A record at your DNS provider:"
Write-Host "  Host: sfu"
Write-Host "  Points to: $ip"
Write-Host "  Domain: sfu.supersecurechat.com"
Write-Host ""
Write-Host "After DNS propagates (5-30 min), verify:"
Write-Host "  curl https://sfu.supersecurechat.com/health"
Write-Host ""

if ($UpdateCloudRun) {
    Write-Host "Updating Cloud Run SSC_SFU_WS_URL to wss://sfu.supersecurechat.com ..."
    gcloud run services update $Service `
        --project=$Project `
        --region=$Region `
        --update-env-vars "SSC_SFU_WS_URL=wss://sfu.supersecurechat.com"
    Write-Host "Cloud Run updated. Re-check /api/health for wss URL."
}