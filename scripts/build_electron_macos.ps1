# SSC Electron macOS build — unsigned local dmg (run on macOS with Xcode CLI tools).
# Reference: scripts/build_electron.ps1 (Windows NSIS).
#
# Signing: set CSC_LINK + CSC_KEY_PASSWORD for Apple Developer ID, or leave unset for ad-hoc local builds.
# On non-macOS hosts this script validates frontend/electron deps only and prints next steps.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Test-IsMacOS {
    return [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
        [System.Runtime.InteropServices.OSPlatform]::OSX
    )
}

Write-Host "Building frontend for Electron (macOS)..."
Push-Location "$Root\frontend"
$env:REACT_APP_SSC_PLATFORM = "electron"
$env:REACT_APP_SSC_LANDING_ONLY = "false"
$env:REACT_APP_SSC_VERSION = "0.3.1"
$env:REACT_APP_SSC_BUILD = "10"
$env:REACT_APP_SSC_REQUIRE_LIBCRYPTO = "true"
$env:PUBLIC_URL = "."
$env:REACT_APP_API_URL = $(if ($env:REACT_APP_API_URL) { $env:REACT_APP_API_URL } else { "https://api.supersecurechat.com" })
$env:REACT_APP_GOOGLE_CLIENT_ID = $(if ($env:REACT_APP_GOOGLE_CLIENT_ID) { $env:REACT_APP_GOOGLE_CLIENT_ID } else { "814078411789-o3t5krp2mvoi32rkaug6jmegtb8t1ihf.apps.googleusercontent.com" })
if (Get-Command yarn -ErrorAction SilentlyContinue) {
    yarn build
} else {
    npm run build
}
Pop-Location

Write-Host "Installing Electron deps..."
Remove-Item "$Root\electron\SSC_COMPAT_MODE" -Force -ErrorAction SilentlyContinue
Push-Location "$Root\electron"
if (Get-Command yarn -ErrorAction SilentlyContinue) {
    yarn install
} else {
    npm install
}
$env:SSC_PROD_FILE = "$Root\frontend\build\index.html"
Pop-Location

if (-not (Test-IsMacOS)) {
    Write-Host ""
    Write-Host "Frontend + electron deps are ready. macOS dmg packaging requires a Mac host."
    Write-Host "On macOS, run:"
    Write-Host "  cd electron"
    Write-Host "  npm run dist -- --mac dmg"
    Write-Host ""
    Write-Host "Optional signing: export CSC_LINK (Developer ID Application .p12) and CSC_KEY_PASSWORD."
    Write-Host "Output: electron/dist/SSC-0.3.1.dmg (per electron-builder.yml)"
    exit 0
}

Push-Location "$Root\electron"
if (-not $env:CSC_LINK) {
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "true"
    Write-Host "Building macOS dmg (auto-discover signing identity if configured)..."
} else {
    Write-Host "Building macOS dmg with CSC_LINK signing certificate..."
}
npm run dist -- --mac dmg
Pop-Location

$dmg = Get-ChildItem "$Root\electron\dist\SSC-*.dmg" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if ($dmg) {
    New-Item -ItemType Directory -Force -Path "$Root\dist" | Out-Null
    Copy-Item $dmg.FullName "$Root\dist\$($dmg.Name)" -Force
    Write-Host "macOS build complete: $($dmg.FullName) ($([math]::Round($dmg.Length / 1MB, 1)) MB)"
} else {
    throw "dmg artifact not found in electron\dist"
}