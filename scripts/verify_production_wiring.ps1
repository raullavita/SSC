# Verify production wiring: API health, config, security env, web deploy.
#
# Usage: .\scripts\verify_production_wiring.ps1

param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$ApiUrl = "https://api.supersecurechat.com",
    [string]$WebUrl = "https://www.supersecurechat.com",
    [string]$Project = "super-chat-b0992",
    [string]$Region = "europe-west1",
    [string]$Service = "ssc-api"
)

$ErrorActionPreference = "Stop"
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure([string]$Message) { $script:failures.Add($Message) | Out-Null }
function Assert-Ok([string]$Name, [bool]$Passed, [string]$Detail) {
    if ($Passed) { Write-Host "OK: $Name" }
    else { Add-Failure "$Name - $Detail" }
}

Write-Host "=== Production wiring check ==="

& (Join-Path $PSScriptRoot "release_smoke_test.ps1") -ApiUrl $ApiUrl -WebUrl $WebUrl
if ($LASTEXITCODE -ne 0) {
    Add-Failure "release_smoke_test.ps1 failed"
}

. (Join-Path $PSScriptRoot "resolve_gcloud.ps1")
$Gcloud = Resolve-GcloudPath
if ($Gcloud) {
    $null = Ensure-GcloudAuth -Gcloud $Gcloud
    $envYaml = & $Gcloud run services describe $Service --region $Region --project $Project `
        --format="yaml(spec.template.spec.containers[0].env)" 2>&1 | Out-String

    Assert-Ok "cloudrun.password_pepper" ($envYaml -match "SSC_PASSWORD_PEPPER") "SSC_PASSWORD_PEPPER not set"
    Assert-Ok "cloudrun.frontend_url" ($envYaml -match "www\.supersecurechat\.com") "FRONTEND_URL should be www.supersecurechat.com"

    $captchaOn = $envYaml -match "(?ms)- name: SSC_CAPTCHA_REQUIRED\s+value: 'true'"
    if ($captchaOn) {
        Assert-Ok "cloudrun.turnstile_secret" ($envYaml -match "SSC_TURNSTILE_SECRET") "CAPTCHA on but no secret"
        Assert-Ok "cloudrun.turnstile_site_key" ($envYaml -match "SSC_TURNSTILE_SITE_KEY") "CAPTCHA on but no site key"
    } else {
        Write-Host "WARN: SSC_CAPTCHA_REQUIRED is false - enable when Turnstile keys are in production-secrets.env"
        Assert-Ok "cloudrun.captcha_off_safe" $true "CAPTCHA intentionally off until Turnstile keys added"
    }
} else {
    Write-Host "WARN: gcloud not available - skipping Cloud Run env checks"
}

$headers = @{
    "X-SSC-Client" = "android/0.4.0/15"
    "X-SSC-Native-Bridge" = "v1"
    "X-SSC-Device-Attest" = "ssc-attest-test-v1"
}
try {
    $cfg = Invoke-RestMethod -Uri "$ApiUrl/api/config" -Headers $headers -TimeoutSec 45
    Assert-Ok "config.translation_flag" ($null -ne $cfg.translation_enabled) "translation_enabled missing"
    Assert-Ok "config.translation_off_launch" ($cfg.translation_enabled -eq $false) "translation should be off until LIBRETRANSLATE_URL is set"
    if ($cfg.captcha_required) {
        Assert-Ok "config.turnstile_site_key" ([bool]$cfg.turnstile_site_key) "captcha_required but no turnstile_site_key"
    }
} catch {
    Add-Failure "api.config probe - $($_.Exception.Message)"
}

try {
    & (Join-Path $PSScriptRoot "verify_sfu_production.ps1") -ApiBase $ApiUrl
    if ($LASTEXITCODE -ne 0) {
        Add-Failure "verify_sfu_production.ps1 failed"
    }
} catch {
    Add-Failure "sfu.production - $($_.Exception.Message)"
}

try {
    $web = Invoke-WebRequest -Uri $WebUrl -TimeoutSec 45 -UseBasicParsing
    $body = $web.Content
    Assert-Ok "web.no_api_key_ui" (-not ($body -match "Google Translate API|DeepL API|translation API key")) "landing still mentions user API keys"
} catch {
    Add-Failure "web.content - $($_.Exception.Message)"
}

Write-Host ""
if ($failures.Count -gt 0) {
    Write-Host "WIRING CHECK FAILED - $($failures.Count) issue(s):"
    foreach ($item in $failures) { Write-Host "  - $item" }
    exit 1
}

Write-Host "WIRING CHECK PASSED"
exit 0