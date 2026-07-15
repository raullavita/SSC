# SSC Electron local build — unsigned (no Authenticode / CSC signing).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

# Never sign — avoids signtool failures and keeps builds reproducible on dev machines.
Remove-Item Env:CSC_LINK -ErrorAction SilentlyContinue
Remove-Item Env:WIN_CSC_LINK -ErrorAction SilentlyContinue
Remove-Item Env:CSC_KEY_PASSWORD -ErrorAction SilentlyContinue
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

Write-Host "Building frontend..."
Push-Location "$Root\frontend"
$env:REACT_APP_SSC_PLATFORM = "electron"
$env:REACT_APP_SSC_LANDING_ONLY = "false"
$env:REACT_APP_SSC_VERSION = "0.3.1"
$env:REACT_APP_SSC_BUILD = "14"
$env:REACT_APP_SSC_REQUIRE_LIBCRYPTO = "true"
$env:PUBLIC_URL = "."
$env:REACT_APP_API_URL = $(if ($env:REACT_APP_API_URL) { $env:REACT_APP_API_URL } else { "https://api.supersecurechat.com" })
$env:REACT_APP_GOOGLE_CLIENT_ID = $(if ($env:REACT_APP_GOOGLE_CLIENT_ID) { $env:REACT_APP_GOOGLE_CLIENT_ID } else { "814078411789-o3t5krp2mvoi32rkaug6jmegtb8t1ihf.apps.googleusercontent.com" })
yarn build
Pop-Location

Write-Host "Installing Electron deps..."
Remove-Item "$Root\electron\SSC_COMPAT_MODE" -Force -ErrorAction SilentlyContinue
Push-Location "$Root\electron"
npm install
$env:SSC_PROD_FILE = "$Root\frontend\build\index.html"
Write-Host "Building UNSIGNED Electron installer (signing disabled)."
npm run dist
Pop-Location

$installer = Get-ChildItem "$Root\electron\dist\SSC-Setup-*.exe" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notmatch 'portable' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if ($installer -and $installer.Length -gt 10MB) {
  New-Item -ItemType Directory -Force -Path "$Root\dist" | Out-Null
  Copy-Item $installer.FullName "$Root\dist\SSC-Setup-0.3.1.exe" -Force
  $desktopInstaller = "$env:USERPROFILE\Desktop\SSC-Setup-0.3.1.exe"
  try {
    Copy-Item $installer.FullName $desktopInstaller -Force
    Write-Host "Installer: $desktopInstaller ($([math]::Round($installer.Length/1MB,1)) MB)"
  } catch {
    Write-Host "Installer built at $($installer.FullName) (Desktop copy locked)"
  }
} else {
  throw "NSIS installer not found in electron\dist"
}

Write-Host "Electron build complete (unsigned)."