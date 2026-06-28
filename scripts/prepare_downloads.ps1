# Copy release binaries into frontend/public/downloads for Firebase Hosting (TASK N.4 / Q.4)
# Run before: yarn build:firebase  /  firebase deploy --only hosting

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$Dest = Join-Path $RepoRoot "frontend\public\downloads"
$DesktopDest = Join-Path $Dest "desktop"
$ApkSrc = "C:\Users\smash\Desktop\SSC\APK\SSC-app-release.apk"
$WinSrc = "C:\Users\smash\Desktop\SSC\SSC-Setup-1.0.12.exe"
$LatestYmlSrc = Join-Path $RepoRoot "frontend\desktop\dist\latest.yml"

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
New-Item -ItemType Directory -Force -Path $DesktopDest | Out-Null

if (-not (Test-Path $ApkSrc)) {
    Write-Warning "APK not found: $ApkSrc - build with SSC-BUILD-APK.bat first"
} else {
    Copy-Item -Force $ApkSrc (Join-Path $Dest "SSC-app-release.apk")
    $mb = [math]::Round((Get-Item $ApkSrc).Length / 1MB, 1)
    Write-Host "OK: APK copied (${mb} MB)"
}

if (-not (Test-Path $WinSrc)) {
    Write-Warning "Windows installer not found: $WinSrc - build with SSC-BUILD-DESKTOP-WIN.bat first"
} else {
    Copy-Item -Force $WinSrc (Join-Path $Dest "SSC-Setup-1.0.12.exe")
    Copy-Item -Force $WinSrc (Join-Path $DesktopDest "SSC-Setup-1.0.12.exe")
    $mbWin = [math]::Round((Get-Item $WinSrc).Length / 1MB, 1)
    Write-Host "OK: Windows installer copied (${mbWin} MB)"
}

if (-not (Test-Path $LatestYmlSrc)) {
    Write-Warning "latest.yml not found: $LatestYmlSrc - run desktop yarn build:win to generate electron-updater feed"
} else {
    Copy-Item -Force $LatestYmlSrc (Join-Path $DesktopDest "latest.yml")
    Write-Host "OK: latest.yml copied to desktop feed"
}

Write-Host "Downloads folder: $Dest"
Write-Host "Desktop update feed: $DesktopDest"