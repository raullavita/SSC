# Remove personal IPs from Atlas — keep Cloud Run NAT only.
# Requires: setup_atlas_cli.ps1 completed (API keys in atlas-credentials.env)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$AtlasExe = "C:\Program Files (x86)\MongoDB Atlas CLI\atlas.exe"
$Keep = if ($env:SSC_ATLAS_KEEP_CIDR) { $env:SSC_ATLAS_KEEP_CIDR } else { "34.140.240.41/32" }
$Profile = "ssc"

if (-not (Test-Path $AtlasExe)) {
    throw "Atlas CLI not found. Run scripts/setup_atlas_cli.ps1 first."
}

$CredsFile = Join-Path $Root "atlas-credentials.env"
if (Test-Path $CredsFile) {
    Get-Content $CredsFile | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
        $name, $value = $_ -split '=', 2
        $name = $name.Trim()
        $value = $value.Trim().Trim('"')
        if ($name -and $value) { Set-Item -Path "env:$name" -Value $value }
    }
}
if ($env:ATLAS_CLIENT_ID -and $env:ATLAS_CLIENT_SECRET) {
    $env:MONGODB_ATLAS_CLIENT_ID = $env:ATLAS_CLIENT_ID
    $env:MONGODB_ATLAS_CLIENT_SECRET = $env:ATLAS_CLIENT_SECRET
}
if ($env:ATLAS_PUBLIC_KEY -and $env:ATLAS_PRIVATE_KEY) {
    $env:MONGODB_ATLAS_PUBLIC_API_KEY = $env:ATLAS_PUBLIC_KEY
    $env:MONGODB_ATLAS_PRIVATE_API_KEY = $env:ATLAS_PRIVATE_KEY
}
if ($env:ATLAS_GROUP_ID) { $env:MONGODB_ATLAS_PROJECT_ID = $env:ATLAS_GROUP_ID }

$projectFlag = @()
if ($env:ATLAS_GROUP_ID) {
    $projectFlag = @("--projectId", $env:ATLAS_GROUP_ID)
}

$listJson = & $AtlasExe accessLists list --profile $Profile @projectFlag -o json 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $listJson
    throw "Atlas accessLists list failed. Run scripts/setup_atlas_cli.ps1 with valid API keys."
}

$entries = ($listJson | ConvertFrom-Json).results
$removed = 0
foreach ($entry in $entries) {
    $cidr = $entry.cidrBlock
    if (-not $cidr) { continue }
    if ($cidr -eq $Keep) {
        Write-Host "KEEP: $cidr"
        continue
    }
    & $AtlasExe accessLists delete $cidr --profile $Profile @projectFlag --force 2>&1 | Out-Host
    if ($LASTEXITCODE -eq 0) {
        Write-Host "REMOVED: $cidr"
        $removed++
    }
}

Write-Host "Done. Removed $removed entr$(if ($removed -eq 1) { 'y' } else { 'ies' }). Kept $Keep."