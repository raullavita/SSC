# Configure Google OAuth for SSC Cloud Run production API.
# Requires a Web application OAuth client JSON downloaded from Google Cloud Console.
#
# Usage:
#   .\scripts\setup_google_oauth.ps1
#   .\scripts\setup_google_oauth.ps1 -ClientSecretJson "C:\path\client_secret_....json"
#   .\scripts\setup_google_oauth.ps1 -Deploy

param(
    [string]$ClientSecretJson = "",
    [string]$ClientId = "",
    [string]$ClientSecret = "",
    [string]$Project = "super-chat-b0992",
    [string]$ApiHost = "https://api.supersecurechat.com",
    [switch]$Deploy,
    [switch]$OpenConsole
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root "backend\cloudrun-env.yaml"
$ConsoleUrl = "https://console.cloud.google.com/auth/clients/create?project=$Project"

function Find-ClientSecretJson {
    param([string]$ExplicitPath)
    if ($ExplicitPath -and (Test-Path $ExplicitPath)) {
        return (Resolve-Path $ExplicitPath).Path
    }
    $searchRoots = @(
        [Environment]::GetFolderPath("Desktop"),
        [Environment]::GetFolderPath("Downloads"),
        $Root
    )
    foreach ($dir in $searchRoots) {
        if (-not (Test-Path $dir)) { continue }
        $match = Get-ChildItem $dir -Filter "client_secret*.json" -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($match) { return $match.FullName }
    }
    return $null
}

function Read-OAuthJson([string]$Path) {
    $json = Get-Content $Path -Raw | ConvertFrom-Json
    $web = $json.web
    if (-not $web) { throw "OAuth JSON missing .web section: $Path" }
    if (-not $web.client_id) { throw "OAuth JSON missing client_id" }
    if (-not $web.client_secret) { throw "OAuth JSON missing client_secret" }
    return @{
        ClientId = [string]$web.client_id
        ClientSecret = [string]$web.client_secret
    }
}

function Update-CloudRunEnvFile {
    param(
        [string]$Path,
        [string]$ClientId,
        [string]$ClientSecret,
        [string]$RedirectUri,
        [string]$FrontendUrl
    )
    if (-not (Test-Path $Path)) {
        throw "Missing $Path - copy backend/cloudrun-env.yaml.example first"
    }
    $lines = Get-Content $Path
    $map = [ordered]@{
        GOOGLE_CLIENT_ID = $ClientId
        GOOGLE_CLIENT_SECRET = $ClientSecret
        GOOGLE_REDIRECT_URI = $RedirectUri
        FRONTEND_URL = $FrontendUrl
    }
    $seen = @{}
    $out = foreach ($line in $lines) {
        $updated = $false
        foreach ($key in $map.Keys) {
            if ($line -match "^\s*$key\s*:") {
                $seen[$key] = $true
                $val = $map[$key]
                '{0}: "{1}"' -f $key, ($val -replace '"', '\"')
                $updated = $true
                break
            }
        }
        if (-not $updated) { $line }
    }
    foreach ($key in $map.Keys) {
        if (-not $seen[$key]) {
            $out += ('{0}: "{1}"' -f $key, ($map[$key] -replace '"', '\"'))
        }
    }
    Set-Content -Path $Path -Value $out -Encoding UTF8
}

if (-not $ClientSecretJson) {
    $ClientSecretJson = Find-ClientSecretJson -ExplicitPath ""
}

if (-not $ClientSecretJson) {
    if ($OpenConsole -or -not $Deploy) {
        Write-Host "No client_secret JSON found."
        Write-Host "Opening Google Auth client creation page:"
        Write-Host "  $ConsoleUrl"
        Write-Host ""
        Write-Host "Create a Web application client with:"
        Write-Host "  Redirect URI: $ApiHost/api/auth/google/callback"
        Write-Host "  JS origins:   $ApiHost"
        Write-Host "                  https://www.supersecurechat.com"
        Write-Host ""
        Write-Host "Download the JSON, then rerun:"
        Write-Host "  .\scripts\setup_google_oauth.ps1 -ClientSecretJson `"<path>`" -Deploy"
        Start-Process $ConsoleUrl | Out-Null
        exit 2
    }
    throw "OAuth client secret JSON not found. Run without -Deploy to open the Console."
}

if ($ClientId -and $ClientSecret) {
    $creds = @{ ClientId = $ClientId; ClientSecret = $ClientSecret }
    Write-Host "Using OAuth credentials from parameters."
} else {
    Write-Host "Using OAuth credentials from $ClientSecretJson"
    $creds = Read-OAuthJson -Path $ClientSecretJson
}
$redirectUri = "$ApiHost/api/auth/google/callback"
$frontendUrl = $ApiHost

Update-CloudRunEnvFile -Path $EnvFile `
    -ClientId $creds.ClientId `
    -ClientSecret $creds.ClientSecret `
    -RedirectUri $redirectUri `
    -FrontendUrl $frontendUrl

Write-Host "Updated $EnvFile with Google OAuth settings."
Write-Host "  GOOGLE_CLIENT_ID=$($creds.ClientId)"
Write-Host "  GOOGLE_REDIRECT_URI=$redirectUri"
Write-Host "  FRONTEND_URL=$frontendUrl"

if ($Deploy) {
    Write-Host "Deploying Cloud Run..."
    & (Join-Path $Root "scripts\deploy_cloud_run.ps1")
}

Write-Host "Google OAuth setup complete."