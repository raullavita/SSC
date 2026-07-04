# Mount Firebase service account on Cloud Run for FCM push (firebase-admin OSS SDK).
param(
    [string]$Project = "super-chat-b0992",
    [string]$Region = "europe-west1",
    [string]$Service = "ssc-api",
    [string]$KeyFile = (Join-Path (Split-Path $PSScriptRoot -Parent) "ssc-firebase-key.json")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $KeyFile)) {
    throw "Firebase key not found: $KeyFile"
}

$secretName = "ssc-firebase-sa"
$createOut = & gcloud secrets create $secretName --project=$Project --data-file=$KeyFile 2>&1
if ($LASTEXITCODE -ne 0) {
    if ($createOut -match "already exists") {
        & gcloud secrets versions add $secretName --project=$Project --data-file=$KeyFile | Out-Null
    } else {
        throw $createOut
    }
}

& gcloud run services update $Service `
    --region=$Region `
    --project=$Project `
    --set-secrets="/secrets/firebase/key=$secretName:latest" `
    --update-env-vars="GOOGLE_APPLICATION_CREDENTIALS=/secrets/firebase/key" | Out-Null

Write-Host "Cloud Run $Service updated with Firebase credentials for FCM push."