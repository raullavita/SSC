# SSC Electron local build — unsigned (no Authenticode / CSC signing).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

# Never sign — avoids signtool failures and keeps builds reproducible on dev machines.
Remove-Item Env:CSC_LINK -ErrorAction SilentlyContinue
Remove-Item Env:WIN_CSC_LINK -ErrorAction SilentlyContinue
Remove-Item Env:CSC_KEY_PASSWORD -ErrorAction SilentlyContinue
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

# LEGACY: Electron installer is NOT the Windows product UI.
# Prefer: .\scripts\build_desktop_windows.ps1  (native Qt + crypto-worker)
# Kept only for emergency/historical rebuilds.
$Version = "0.4.0"
$Build = "15"
Write-Host "WARN: Electron is retired as the Windows product path. Use build_desktop_windows.ps1 for Qt."

Write-Host "Building frontend for Windows installed client v$Version/$Build..."
Push-Location "$Root\frontend"
$env:REACT_APP_SSC_PLATFORM = "windows"
$env:REACT_APP_SSC_LANDING_ONLY = "false"
$env:REACT_APP_SSC_VERSION = $Version
$env:REACT_APP_SSC_BUILD = $Build
$env:REACT_APP_SSC_REQUIRE_LIBCRYPTO = "true"
$env:PUBLIC_URL = "."
$env:REACT_APP_API_URL = $(if ($env:REACT_APP_API_URL) { $env:REACT_APP_API_URL } else { "https://api.supersecurechat.com" })
$env:REACT_APP_GOOGLE_CLIENT_ID = $(if ($env:REACT_APP_GOOGLE_CLIENT_ID) { $env:REACT_APP_GOOGLE_CLIENT_ID } else { "814078411789-o3t5krp2mvoi32rkaug6jmegtb8t1ihf.apps.googleusercontent.com" })
yarn build
if ($LASTEXITCODE -ne 0) { throw "frontend yarn build failed" }
Pop-Location

Write-Host "Installing Electron deps..."
Remove-Item "$Root\electron\SSC_COMPAT_MODE" -Force -ErrorAction SilentlyContinue
Push-Location "$Root\electron"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
$env:SSC_PROD_FILE = "$Root\frontend\build\index.html"
Write-Host "Building UNSIGNED Windows installer SSC-Setup-$Version.exe (signing disabled)."
npm run dist
if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }
Pop-Location

$installer = Get-ChildItem "$Root\electron\dist\SSC-Setup-*.exe" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notmatch 'portable' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if ($installer -and $installer.Length -gt 10MB) {
  New-Item -ItemType Directory -Force -Path "$Root\dist" | Out-Null
  $named = "$Root\dist\SSC-Setup-$Version.exe"
  Copy-Item $installer.FullName $named -Force
  $desktopInstaller = "$env:USERPROFILE\Desktop\SSC-Setup-$Version.exe"
  try {
    Copy-Item $installer.FullName $desktopInstaller -Force
    Write-Host "Installer: $desktopInstaller ($([math]::Round($installer.Length/1MB,1)) MB)"
  } catch {
    Write-Host "Installer built at $($installer.FullName) (Desktop copy locked)"
  }
  Write-Host "Repo copy: $named"
} else {
  throw "NSIS installer not found in electron\dist"
}

Write-Host "Windows Electron build complete (unsigned) - libsignal E2EE enabled, client windows/$Version/$Build."