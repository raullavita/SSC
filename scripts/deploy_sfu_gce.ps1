# Deploy SSC mediasoup SFU to GCE (UDP required — Cloud Run cannot host WebRTC media).
# OSS stack: mediasoup https://github.com/versatica/mediasoup
#
# Usage:
#   $env:SSC_GCP_PROJECT="super-chat-b0992"
#   $env:SSC_SFU_ZONE="europe-west1-b"
#   $env:SFU_INTERNAL_SECRET="your-rotated-secret"
#   .\scripts\deploy_sfu_gce.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Project = if ($env:SSC_GCP_PROJECT) { $env:SSC_GCP_PROJECT } else { "super-chat-b0992" }
$Zone = if ($env:SSC_SFU_ZONE) { $env:SSC_SFU_ZONE } else { "europe-west1-b" }
$Instance = if ($env:SSC_SFU_INSTANCE) { $env:SSC_SFU_INSTANCE } else { "ssc-sfu" }
$Image = "gcr.io/$Project/ssc-sfu"
$Secret = if ($env:SFU_INTERNAL_SECRET) { $env:SFU_INTERNAL_SECRET } else { "ssc-sfu-dev-secret" }

Write-Host "Building SFU image: $Image"
Push-Location "$Root\sfu-server"
try {
    gcloud builds submit --tag $Image --project $Project .
} finally {
    Pop-Location
}

$describeOut = gcloud compute instances describe $Instance --zone=$Zone --project=$Project 2>&1
$exists = $LASTEXITCODE -eq 0
if (-not $exists) {
    Write-Host "Creating GCE instance $Instance..."
    gcloud compute instances create-with-container $Instance `
        --zone=$Zone `
        --project=$Project `
        --machine-type=e2-small `
        --tags=ssc-sfu `
        --container-image=$Image `
        --container-env="SFU_PORT=4443,SFU_INTERNAL_SECRET=$Secret" `
        --boot-disk-size=20GB
} else {
    Write-Host "Updating container on $Instance..."
    $ip = gcloud compute instances describe $Instance --zone=$Zone --project=$Project `
        --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
    gcloud compute instances update-container $Instance `
        --zone=$Zone `
        --project=$Project `
        --container-image=$Image `
        --container-env="SFU_PORT=4443,SFU_ALLOW_HTTP=1,SFU_INTERNAL_SECRET=$Secret,SFU_ANNOUNCED_IP=$ip"
}

Write-Host "Ensuring firewall rules..."
gcloud compute firewall-rules describe ssc-sfu-media --project=$Project 2>$null
if ($LASTEXITCODE -ne 0) {
    gcloud compute firewall-rules create ssc-sfu-media `
        --project=$Project `
        --direction=INGRESS `
        --priority=1000 `
        --network=default `
        --action=ALLOW `
        --rules=udp:40000-49999,tcp:4443 `
        --target-tags=ssc-sfu
}

$ip = gcloud compute instances describe $Instance --zone=$Zone --project=$Project `
    --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
Write-Host ""
Write-Host "SFU external IP: $ip"
Write-Host "Set on API (Cloud Run env):"
Write-Host "  SSC_SFU_ENABLED=true"
Write-Host "  SSC_SFU_WS_URL=wss://sfu.supersecurechat.com"
Write-Host "  SSC_SFU_INTERNAL_URL=http://${ip}:4443"
Write-Host "  SSC_SFU_INTERNAL_SECRET=$Secret"
Write-Host "  SFU_ANNOUNCED_IP=$ip  (on SFU container)"
Write-Host ""
Write-Host "Point sfu.supersecurechat.com DNS A record to $ip"
Write-Host "TLS: SSH to instance and run:"
Write-Host "  cd /opt/ssc && docker compose -f docker-compose.tls.yml up -d"
Write-Host "(Copy sfu-server/Caddyfile + docker-compose.tls.yml to the instance first)"