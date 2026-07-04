# Deploy coturn TURN/STUN on the SSC SFU GCE instance (Step 3).
# OSS: https://github.com/coturn/coturn
#
# Prereqs:
#   - SFU GCE instance exists (deploy_sfu_gce.ps1)
#   - DNS A record: turn.supersecurechat.com -> SFU public IP
#
# Usage:
#   $env:SSC_TURN_SECRET="your-long-random-secret"
#   .\scripts\deploy_turn_gce.ps1
#   .\scripts\deploy_turn_gce.ps1 -UpdateCloudRun

param(
    [string]$Project = $(if ($env:SSC_GCP_PROJECT) { $env:SSC_GCP_PROJECT } else { "super-chat-b0992" }),
    [string]$Zone = $(if ($env:SSC_SFU_ZONE) { $env:SSC_SFU_ZONE } else { "europe-west1-b" }),
    [string]$Instance = $(if ($env:SSC_SFU_INSTANCE) { $env:SSC_SFU_INSTANCE } else { "ssc-sfu" }),
    [string]$Service = $(if ($env:SSC_CLOUD_RUN_SERVICE) { $env:SSC_CLOUD_RUN_SERVICE } else { "ssc-api" }),
    [string]$Region = $(if ($env:SSC_CLOUD_RUN_REGION) { $env:SSC_CLOUD_RUN_REGION } else { "europe-west1" }),
    [string]$TurnSecret = $(if ($env:SSC_TURN_SECRET) { $env:SSC_TURN_SECRET } else { "" }),
    [switch]$UpdateCloudRun
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$TurnDir = Join-Path $Root "turn"

if (-not $TurnSecret) {
    Write-Error "Set SSC_TURN_SECRET to the same value as static-auth-secret in turnserver.conf"
}

$ip = gcloud compute instances describe $Instance --zone=$Zone --project=$Project `
    --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
Write-Host "SFU/TURN public IP: $ip"

Write-Host "Ensuring firewall allows TURN (3478, 5349)..."
$fwExists = $false
try {
    gcloud compute firewall-rules describe ssc-turn --project=$Project 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $fwExists = $true }
} catch {
    $fwExists = $false
}
if (-not $fwExists) {
    gcloud compute firewall-rules create ssc-turn `
        --project=$Project `
        --direction=INGRESS `
        --priority=1000 `
        --network=default `
        --action=ALLOW `
        --rules=udp:3478,tcp:3478,udp:5349,tcp:5349 `
        --target-tags=ssc-sfu
}

$confPath = Join-Path $env:TEMP "ssc-turnserver.conf"
$conf = Get-Content (Join-Path $TurnDir "turnserver.conf") -Raw
$conf = $conf.Replace("REPLACE_WITH_SSC_TURN_SECRET", $TurnSecret)
$conf = $conf.Replace("REPLACE_WITH_GCE_PUBLIC_IP", $ip)
Set-Content -Path $confPath -Value $conf -NoNewline

Write-Host "Copying coturn config to $Instance..."
gcloud compute scp $confPath "${Instance}:/tmp/turnserver.conf" --zone=$Zone --project=$Project
gcloud compute scp (Join-Path $TurnDir "docker-compose.yml") "${Instance}:/tmp/turn-docker-compose.yml" --zone=$Zone --project=$Project

$remoteScript = @'
set -e
mkdir -p ~/ssc-turn
cp /tmp/turnserver.conf ~/ssc-turn/turnserver.conf
cp /tmp/turn-docker-compose.yml ~/ssc-turn/docker-compose.yml
docker rm -f ssc-coturn 2>/dev/null || true
docker pull coturn/coturn:4.6.2
docker run -d --name ssc-coturn --restart unless-stopped --network host \
  -v ~/ssc-turn/turnserver.conf:/etc/coturn/turnserver.conf:ro \
  coturn/coturn:4.6.2 -c /etc/coturn/turnserver.conf
echo "coturn started on :3478"
'@

Write-Host "Starting coturn on GCE..."
gcloud compute ssh $Instance --zone=$Zone --project=$Project `
    --ssh-flag="-o StrictHostKeyChecking=accept-new" `
    --command=$remoteScript

$turnUris = "turn:turn.supersecurechat.com:3478?transport=udp,turn:turn.supersecurechat.com:3478?transport=tcp"
$stunUris = "stun:turn.supersecurechat.com:3478"

Write-Host ""
Write-Host "=== DNS (one-time) ==="
Write-Host "  turn.supersecurechat.com  A  $ip"
Write-Host ""
Write-Host "=== Cloud Run env ==="
Write-Host "  SSC_TURN_ENABLED=true"
Write-Host "  SSC_TURN_SECRET=$TurnSecret"
Write-Host "  SSC_TURN_URIS=$turnUris"
Write-Host "  SSC_STUN_URIS=$stunUris"
Write-Host "  SSC_TURN_REALM=supersecurechat.com"
Write-Host ""

if ($UpdateCloudRun) {
    Write-Host "Updating Cloud Run TURN env vars..."
    gcloud run services update $Service `
        --project=$Project `
        --region=$Region `
        --update-env-vars "SSC_TURN_ENABLED=true,SSC_TURN_SECRET=$TurnSecret,SSC_TURN_URIS=$turnUris,SSC_STUN_URIS=$stunUris,SSC_TURN_REALM=supersecurechat.com"
    Write-Host "Cloud Run updated."
}