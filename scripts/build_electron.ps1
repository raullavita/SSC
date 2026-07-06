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
$env:REACT_APP_SSC_VERSION = "0.3.1"
$env:REACT_APP_SSC_BUILD = "9"
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
if ($env:CSC_LINK -or $env:WIN_CSC_LINK) {
    Write-Host "Authenticode signing enabled (CSC_LINK set) - required for Windows Smart App Control."
} else {
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
    Write-Host "WARN: Building UNSIGNED - Windows Smart App Control will block libsignal-client.node."
    Write-Host "      Set CSC_LINK + CSC_KEY_PASSWORD before build, or run .\scripts\setup_windows_codesign.ps1"
}
npm run dist
Pop-Location

$installer = Get-ChildItem "$Root\electron\dist\SSC-Setup-*.exe" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notmatch 'portable' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$portable = Get-ChildItem "$Root\electron\dist\SSC-*-portable*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($installer -and $installer.Length -gt 10MB) {
  $desktopInstaller = "$env:USERPROFILE\Desktop\SSC-Setup-0.3.1.exe"
  try {
    Copy-Item $installer.FullName $desktopInstaller -Force
    Write-Host "NSIS installer copied to Desktop\SSC-Setup-0.3.1.exe ($([math]::Round($installer.Length/1MB,1)) MB)"
  } catch {
    $alt = "$env:USERPROFILE\Desktop\SSC-Setup-0.3.1-v2.exe"
    Copy-Item $installer.FullName $alt -Force
    Write-Host "Desktop copy locked - wrote $alt instead. Close the running SSC app and rename if needed."
  }
} else {
  Write-Host "WARN: NSIS installer not found - check electron\dist for SSC-Setup-0.3.1.exe (not portable)"
}
if ($portable) {
  Write-Host "Portable build (no installer): $($portable.FullName)"
}

Write-Host "Electron installer artifacts in electron\dist"