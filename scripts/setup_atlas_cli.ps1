# Configure MongoDB Atlas CLI for SSC automation.
# Supports Service Account (client id/secret) or legacy API keys.
# Usage: .\scripts\setup_atlas_cli.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$AtlasExe = "C:\Program Files (x86)\MongoDB Atlas CLI\atlas.exe"
$CredsFile = Join-Path $Root "atlas-credentials.env"
$Profile = "ssc"

if (-not (Test-Path $AtlasExe)) {
    throw "Atlas CLI not found. Install: winget install MongoDB.MongoDBAtlasCLI"
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$atlasDir = Split-Path $AtlasExe -Parent
if ($userPath -notlike "*$atlasDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$atlasDir", "User")
    $env:Path = "$env:Path;$atlasDir"
    Write-Host "Added Atlas CLI to user PATH: $atlasDir"
}

if (-not (Test-Path $CredsFile)) {
    Copy-Item (Join-Path $Root "atlas-credentials.env.example") $CredsFile
    Write-Host "Created $CredsFile - add credentials, then re-run."
    exit 1
}

Get-Content $CredsFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $name, $value = $_ -split '=', 2
    $name = $name.Trim()
    $value = $value.Trim().Trim('"')
    if ($name -and $value -and $value -notmatch 'your-') {
        Set-Item -Path "env:$name" -Value $value
    }
}

$useServiceAccount = $env:ATLAS_CLIENT_ID -and $env:ATLAS_CLIENT_SECRET
$useApiKey = $env:ATLAS_PUBLIC_KEY -and $env:ATLAS_PRIVATE_KEY

if (-not $useServiceAccount -and -not $useApiKey) {
    Write-Host "FAIL: set ATLAS_CLIENT_ID + ATLAS_CLIENT_SECRET (service account)"
    Write-Host "   or ATLAS_PUBLIC_KEY + ATLAS_PRIVATE_KEY (legacy API keys) in atlas-credentials.env"
    exit 1
}

if ($useServiceAccount) {
    $env:MONGODB_ATLAS_CLIENT_ID = $env:ATLAS_CLIENT_ID
    $env:MONGODB_ATLAS_CLIENT_SECRET = $env:ATLAS_CLIENT_SECRET
    & $AtlasExe config set client_id $env:ATLAS_CLIENT_ID --profile $Profile | Out-Null
    & $AtlasExe config set client_secret $env:ATLAS_CLIENT_SECRET --profile $Profile | Out-Null
    Write-Host "Using Service Account auth."
} else {
    $env:MONGODB_ATLAS_PUBLIC_API_KEY = $env:ATLAS_PUBLIC_KEY
    $env:MONGODB_ATLAS_PRIVATE_API_KEY = $env:ATLAS_PRIVATE_KEY
    & $AtlasExe config set public_api_key $env:ATLAS_PUBLIC_KEY --profile $Profile | Out-Null
    & $AtlasExe config set private_api_key $env:ATLAS_PRIVATE_KEY --profile $Profile | Out-Null
    Write-Host "Using legacy API key auth."
}

if ($env:ATLAS_GROUP_ID) {
    & $AtlasExe config set project_id $env:ATLAS_GROUP_ID --profile $Profile | Out-Null
    $env:MONGODB_ATLAS_PROJECT_ID = $env:ATLAS_GROUP_ID
}
if ($env:ATLAS_ORG_ID) {
    & $AtlasExe config set org_id $env:ATLAS_ORG_ID --profile $Profile | Out-Null
    $env:MONGODB_ATLAS_ORG_ID = $env:ATLAS_ORG_ID
}
& $AtlasExe config set service cloud --profile $Profile | Out-Null
& $AtlasExe config set output json --profile $Profile | Out-Null

Write-Host "Atlas CLI profile $Profile configured."
& $AtlasExe auth whoami --profile $Profile 2>&1
& $AtlasExe projects list --profile $Profile --limit 5 2>&1