# Configure MongoDB Atlas CLI for SSC automation (API key profile).
# Usage: .\scripts\setup_atlas_cli.ps1
# Requires: atlas-credentials.env at repo root (see atlas-credentials.env.example)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$AtlasExe = "C:\Program Files (x86)\MongoDB Atlas CLI\atlas.exe"
$CredsFile = Join-Path $Root "atlas-credentials.env"

if (-not (Test-Path $AtlasExe)) {
    throw "Atlas CLI not found. Install: winget install MongoDB.MongoDBAtlasCLI"
}

# Persist Atlas CLI on user PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$atlasDir = Split-Path $AtlasExe -Parent
if ($userPath -notlike "*$atlasDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$atlasDir", "User")
    $env:Path = "$env:Path;$atlasDir"
    Write-Host "Added Atlas CLI to user PATH: $atlasDir"
}

if (-not (Test-Path $CredsFile)) {
    Copy-Item (Join-Path $Root "atlas-credentials.env.example") $CredsFile
    Write-Host "Created $CredsFile - add ATLAS_PUBLIC_KEY and ATLAS_PRIVATE_KEY, then re-run."
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

$public = $env:ATLAS_PUBLIC_KEY
$private = $env:ATLAS_PRIVATE_KEY
if (-not $public -or -not $private) {
    Write-Host "FAIL: set ATLAS_PUBLIC_KEY and ATLAS_PRIVATE_KEY in atlas-credentials.env"
    exit 1
}

$profile = "ssc"
& $AtlasExe config set public_api_key $public --profile $profile | Out-Null
& $AtlasExe config set private_api_key $private --profile $profile | Out-Null
if ($env:ATLAS_GROUP_ID) {
    & $AtlasExe config set project_id $env:ATLAS_GROUP_ID --profile $profile | Out-Null
}
if ($env:ATLAS_ORG_ID) {
    & $AtlasExe config set org_id $env:ATLAS_ORG_ID --profile $profile | Out-Null
}
& $AtlasExe config set service cloud --profile $profile | Out-Null
& $AtlasExe config set output json --profile $profile | Out-Null

Write-Host "Atlas CLI profile $profile configured."
& $AtlasExe auth whoami --profile $profile 2>&1
& $AtlasExe projects list --profile $profile --limit 5 2>&1