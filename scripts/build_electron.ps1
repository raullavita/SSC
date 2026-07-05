# SSC Electron local build — Engine 11 (no cloud deploy)
#
# Optional Authenticode signing (reduces SmartScreen warnings):
#   $env:CSC_LINK = "C:\path\to\codesign.pfx"   # or base64-encoded PFX
#   $env:CSC_KEY_PASSWORD = "cert-password"
# electron-builder signs automatically when CSC_* is set.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "Building frontend..."
Push-Location "$Root\frontend"
$env:REACT_APP_SSC_PLATFORM = "electron"
$env:REACT_APP_SSC_LANDING_ONLY = "false"
$env:REACT_APP_SSC_VERSION = "0.3.0"
$env:REACT_APP_SSC_BUILD = "8"
$env:REACT_APP_SSC_REQUIRE_LIBCRYPTO = "true"
$env:PUBLIC_URL = "."
$env:REACT_APP_API_URL = $(if ($env:REACT_APP_API_URL) { $env:REACT_APP_API_URL } else { "https://api.supersecurechat.com" })
$env:REACT_APP_GOOGLE_CLIENT_ID = $(if ($env:REACT_APP_GOOGLE_CLIENT_ID) { $env:REACT_APP_GOOGLE_CLIENT_ID } else { "814078411789-o3t5krp2mvoi32rkaug6jmegtb8t1ihf.apps.googleusercontent.com" })
yarn build
Pop-Location

Write-Host "Installing Electron deps..."
Push-Location "$Root\electron"
npm install
$env:SSC_PROD_FILE = "$Root\frontend\build\index.html"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$env:WIN_CSC_LINK = ""
$env:CSC_LINK = ""
npm run dist
Pop-Location

$installer = Get-ChildItem "$Root\electron\dist\SSC-Setup-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$portable = Get-ChildItem "$Root\electron\dist\SSC-*-portable*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($installer -and $installer.Length -gt 10MB) {
  Copy-Item $installer.FullName "$env:USERPROFILE\Desktop\SSC-Setup-latest.exe" -Force
  Write-Host "Installer copied to Desktop\SSC-Setup-latest.exe"
}
if ($portable) {
  Copy-Item $portable.FullName "$env:USERPROFILE\Desktop\SSC-Portable-latest.exe" -Force
  Write-Host "Portable build copied to Desktop\SSC-Portable-latest.exe"
}

Write-Host "Electron installer artifacts in electron\dist"