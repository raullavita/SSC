# Upload SSC-Setup exe to GitHub release v0.3.1
param(
    [string]$ExePath = (Join-Path (Split-Path $PSScriptRoot -Parent) "dist\SSC-Setup-0.3.1.exe"),
    [string]$Tag = "v0.3.1",
    [int]$MaxRetries = 3
)

$ErrorActionPreference = "Stop"

$cred = "protocol=https`nhost=github.com`n`n" | git credential fill
$token = ($cred | Where-Object { $_ -like 'password=*' }) -replace '^password=',''
if (-not $token) { throw "No GitHub token from git credential" }
if (-not (Test-Path $ExePath)) { throw "Installer not found: $ExePath" }

$headers = @{
    Authorization = "Bearer $token"
    Accept        = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/raullavita/SSC/releases/tags/$Tag" -Headers $headers
$old = $release.assets | Where-Object { $_.name -eq 'SSC-Setup-0.3.1.exe' } | Select-Object -First 1
if ($old) {
    Invoke-RestMethod -Method Delete -Uri "https://api.github.com/repos/raullavita/SSC/releases/assets/$($old.id)" -Headers $headers | Out-Null
    Write-Host "Removed old asset ($($old.size) bytes)"
}

$uploadUrl = "https://uploads.github.com/repos/raullavita/SSC/releases/$($release.id)/assets?name=SSC-Setup-0.3.1.exe"
$sizeMb = [math]::Round((Get-Item $ExePath).Length / 1MB, 1)
Write-Host "Uploading $ExePath ($sizeMb MB)..."

$uploaded = $false
for ($i = 1; $i -le $MaxRetries; $i++) {
    Write-Host "Attempt $i/$MaxRetries"
    try {
        $result = Invoke-RestMethod -Method Post -Uri $uploadUrl -Headers $headers -ContentType 'application/octet-stream' -InFile $ExePath -TimeoutSec 3600
        $result | Select-Object name, size, updated_at, browser_download_url
        $uploaded = $true
        break
    } catch {
        Write-Warning "Attempt $i failed: $($_.Exception.Message)"
        if ($i -lt $MaxRetries) { Start-Sleep -Seconds 15 }
    }
}

if (-not $uploaded) { throw "Upload failed after $MaxRetries attempts" }

$body = @{
    name = "v0.3.1 build 14"
    body = @"
## v0.3.1 build 14

- Cloud backup: optional encrypted ciphertext stored server-side (free)
- Broadcast lists: contact picker in Settings
- Read receipts and encryption status chip in chat header
- SFU production validation for large group calls

### Downloads
- SSC-Setup-0.3.1.exe (Windows)
- SSC-0.3.1.apk (Android)
"@
} | ConvertTo-Json

Invoke-RestMethod -Method Patch -Uri "https://api.github.com/repos/raullavita/SSC/releases/$($release.id)" -Headers $headers -Body $body -ContentType 'application/json' | Select-Object name, updated_at
Write-Host "GitHub release upload complete."