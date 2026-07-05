# SSC Electron local build — Engine 11 (no cloud deploy)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "Building frontend..."
Push-Location "$Root\frontend"
$env:REACT_APP_SSC_PLATFORM = "electron"
$env:REACT_APP_SSC_VERSION = "0.3.0"
$env:REACT_APP_SSC_BUILD = "3"
$env:REACT_APP_SSC_REQUIRE_LIBCRYPTO = "true"
$env:PUBLIC_URL = "."
$env:REACT_APP_API_URL = $(if ($env:REACT_APP_API_URL) { $env:REACT_APP_API_URL } else { "https://api.supersecurechat.com" })
yarn build
Pop-Location

Write-Host "Installing Electron deps..."
Push-Location "$Root\electron"
npm install
$env:SSC_PROD_FILE = "$Root\frontend\build\index.html"
npm run dist
Pop-Location

Write-Host "Electron installer artifacts in electron\dist"