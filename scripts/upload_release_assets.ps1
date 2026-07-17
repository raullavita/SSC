# Upload Windows installer, latest.yml, blockmap, and optional Android APK to GitHub release v0.3.1
param(
    [string]$Tag = "v0.3.1",
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

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/raullavita/SSC/releases/tags/$Tag" -Headers $headers

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
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/raullavita/SSC/releases/tags/$Tag" -Headers $script:headers
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

$exe = Join-Path $ProjectRoot "dist\SSC-Setup-0.3.1.exe"
if (-not (Test-Path $exe)) {
    $exe = Join-Path $ProjectRoot "electron\dist\SSC-Setup-0.3.1.exe"
}
$latestYml = Join-Path $ProjectRoot "electron\dist\latest.yml"
$blockmap = Join-Path $ProjectRoot "electron\dist\SSC-Setup-0.3.1.exe.blockmap"
$apk = Join-Path $ProjectRoot "android\app\build\outputs\apk\release\SSC-0.3.1.apk"
if (-not (Test-Path $apk)) {
    $apk = Join-Path $ProjectRoot "android\app\build\outputs\apk\release\app-release.apk"
}

Upload-Asset -Path $exe -Name "SSC-Setup-0.3.1.exe"
Upload-Asset -Path $latestYml -Name "latest.yml"
Upload-Asset -Path $blockmap -Name "SSC-Setup-0.3.1.exe.blockmap"
if (Test-Path $apk) {
    $apkDestName = "SSC-0.3.1.apk"
    if ((Split-Path $apk -Leaf) -ne $apkDestName) {
        $copy = Join-Path $env:TEMP $apkDestName
        Copy-Item $apk $copy -Force
        Upload-Asset -Path $copy -Name $apkDestName
    } else {
        Upload-Asset -Path $apk -Name $apkDestName
    }
} else {
    Write-Warning "Android APK not found - skip APK upload"
}

$body = @{
    name = "v0.3.1 build 14"
    body = @"
## v0.3.1 build 14

- Cloud backup with panic wipe
- Broadcast list create/edit/delete with contact picker
- Read receipts + encryption status chip
- Electron auto-update feed (latest.yml)
- Android client build 14

### Downloads
- SSC-Setup-0.3.1.exe (Windows)
- SSC-0.3.1.apk (Android)
"@
} | ConvertTo-Json

Invoke-RestMethod -Method Patch -Uri "https://api.github.com/repos/raullavita/SSC/releases/$($release.id)" -Headers $headers -Body $body -ContentType 'application/json' | Select-Object name, updated_at
Write-Host "GitHub release assets upload complete."
