# Apply free P0 production hardening on Cloud Run (pepper, FRONTEND_URL, optional Turnstile).
# Reads optional production-secrets.env (gitignored) for Turnstile keys.
#
# Usage:
#   .\scripts\apply_production_hardening.ps1
#   .\scripts\apply_production_hardening.ps1 -DryRun

param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$Project = "super-chat-b0992",
    [string]$Region = "europe-west1",
    [string]$Service = "ssc-api",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "resolve_gcloud.ps1")

$Gcloud = Resolve-GcloudPath
if (-not $Gcloud) { throw "gcloud not found" }
$null = Ensure-GcloudAuth -Gcloud $Gcloud
& $Gcloud config set project $Project | Out-Null

$SecretsFile = Join-Path $ProjectRoot "production-secrets.env"
$updates = [ordered]@{
    FRONTEND_URL = "https://www.supersecurechat.com"
}

$envYaml = & $Gcloud run services describe $Service --region $Region --project $Project `
    --format="yaml(spec.template.spec.containers[0].env)" 2>&1 | Out-String

if ($envYaml -notmatch "SSC_PASSWORD_PEPPER") {
    $pepper = python -c "import secrets; print(secrets.token_urlsafe(48))"
    if (-not $pepper) { throw "Failed to generate SSC_PASSWORD_PEPPER" }
    $updates["SSC_PASSWORD_PEPPER"] = $pepper.Trim()
    Write-Host "Will set SSC_PASSWORD_PEPPER (new secret generated)."
} else {
    Write-Host "SSC_PASSWORD_PEPPER already set - leaving unchanged."
}

if ($envYaml -match "FRONTEND_URL" -and $envYaml -match "api\.supersecurechat\.com") {
    Write-Host "Will fix FRONTEND_URL (was pointing at API host)."
}

if (Test-Path $SecretsFile) {
    Get-Content $SecretsFile | ForEach-Object {
        if ($_ -match "^\s*#" -or $_ -notmatch "=") { return }
        $name, $value = $_ -split "=", 2
        $name = $name.Trim()
        $value = $value.Trim().Trim('"')
        if ($name -in @("SSC_TURNSTILE_SECRET", "SSC_TURNSTILE_SITE_KEY") -and $value -and $value -notmatch "REPLACE") {
            $updates[$name] = $value
        }
    }
    if ($updates.Contains("SSC_TURNSTILE_SECRET") -and $updates.Contains("SSC_TURNSTILE_SITE_KEY")) {
        $updates["SSC_CAPTCHA_REQUIRED"] = "true"
        Write-Host "Turnstile keys found in production-secrets.env - will enable CAPTCHA."
    }
} else {
    Write-Host "No production-secrets.env - CAPTCHA stays as-is (add Turnstile keys to enable)."
}

$pairList = New-Object System.Collections.Generic.List[string]
foreach ($key in $updates.Keys) {
    $pairList.Add("$key=$($updates[$key])")
}
$pairs = $pairList -join ","
Write-Host ("Cloud Run update keys: " + ($updates.Keys -join ", "))

if ($DryRun) {
    Write-Host "Dry run - no changes applied."
    exit 0
}

& $Gcloud run services update $Service `
    --region $Region `
    --project $Project `
    --update-env-vars $pairs

Write-Host "Production hardening applied. Run .\scripts\verify_production_wiring.ps1 to confirm."