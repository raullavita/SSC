# Upload product release assets to GitHub Releases (v0.4.0).
# Product Windows client is Qt (SSC-Desktop-*.exe), not Electron SSC-Setup-*.
param(
    [string]$Tag = "v0.4.0",
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [int]$MaxRetries = 3
)

$ErrorActionPreference = "Stop"

$cred = "protocol=https`nhost=github.com`n`n" | git credential fill
$token = ($cred | Where-Object { $_ -like 'password=*' }) -replace '^password=', ''
if (-not $token) { throw "No GitHub token from git credential" }

$headers = @{
    Authorization          = "Bearer $token"
    Accept                 = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

function Ensure-Release {
    try {
        return Invoke-RestMethod -Uri "https://api.github.com/repos/raullavita/SSC/releases/tags/$Tag" -Headers $headers
    } catch {
        Write-Host "Creating release $Tag..."
        $bodyObj = @{
            tag_name   = $Tag
            name       = "SSC $Tag"
            body       = "SSC $Tag - Android Compose + Windows Qt 0.4.0/15. See CHANGELOG.md."
            draft      = $false
            prerelease = $false
        }
        $body = $bodyObj | ConvertTo-Json
        return Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/raullavita/SSC/releases" -Headers $headers -Body $body -ContentType "application/json"
    }
}

$release = Ensure-Release

function Upload-Asset {
    param(
        [string]$Path,
        [string]$Name
    )
    if (-not (Test-Path $Path)) {
        Write-Warning "Skip missing: $Path"
        return
    }
    $old = $release.assets | Where-Object { $_.name -eq $Name } | Select-Object -First 1
    if ($old) {
        Invoke-RestMethod -Method Delete -Uri "https://api.github.com/repos/raullavita/SSC/releases/assets/$($old.id)" -Headers $headers | Out-Null
        Write-Host "Removed old $Name ($($old.size) bytes)"
        $script:release = Invoke-RestMethod -Uri "https://api.github.com/repos/raullavita/SSC/releases/tags/$Tag" -Headers $script:headers
    }
    $uploadUrl = "https://uploads.github.com/repos/raullavita/SSC/releases/$($release.id)/assets?name=$([uri]::EscapeDataString($Name))"
    $sizeMb = [math]::Round((Get-Item $Path).Length / 1MB, 1)
    Write-Host "Uploading $Name ($sizeMb MB) from $Path..."
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $result = Invoke-RestMethod -Method Post -Uri $uploadUrl -Headers $headers -ContentType 'application/octet-stream' -InFile $Path -TimeoutSec 3600
            $result | Select-Object name, size, updated_at
            return
        } catch {
            Write-Warning "Attempt $i failed for $Name : $($_.Exception.Message)"
            if ($i -lt $MaxRetries) { Start-Sleep -Seconds 15 }
            else { throw }
        }
    }
}

$qtExe = Join-Path $ProjectRoot "dist\windows-qt\SSC-Desktop-0.4.0.exe"
$qtZip = Join-Path $ProjectRoot "dist\SSC-Desktop-0.4.0-windows.zip"
if ((Test-Path $qtExe) -and -not (Test-Path $qtZip)) {
    Write-Host "Creating portable zip from dist\windows-qt..."
    Compress-Archive -Path (Join-Path $ProjectRoot "dist\windows-qt\*") -DestinationPath $qtZip -Force
}

$apk = Join-Path $ProjectRoot "android\app\build\outputs\apk\release\SSC-0.4.0.apk"
if (-not (Test-Path $apk)) {
    $apk = Join-Path $ProjectRoot "dist\SSC-0.4.0.apk"
}
if (-not (Test-Path $apk)) {
    $apk = Join-Path $ProjectRoot "android\app\build\outputs\apk\release\app-release.apk"
}

if (Test-Path $qtZip) {
    Upload-Asset -Path $qtZip -Name "SSC-Desktop-0.4.0-windows.zip"
}
if (Test-Path $qtExe) {
    Upload-Asset -Path $qtExe -Name "SSC-Desktop-0.4.0.exe"
}
if (Test-Path $apk) {
    Upload-Asset -Path $apk -Name "SSC-0.4.0.apk"
} else {
    Write-Warning "Android APK not found - skip APK upload"
}

Write-Host "Release assets upload complete for $Tag"
Write-Host "https://github.com/raullavita/SSC/releases/tag/$Tag"
