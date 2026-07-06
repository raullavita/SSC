# SSC Windows Authenticode signing setup (Smart App Control / SmartScreen)
#
# Smart App Control blocks unsigned native modules (libsignal-client.node) even when
# the main Electron EXE launches. Releases need an OV/EV code-signing certificate.
#
# Usage before build:
#   $env:CSC_LINK = "C:\path\to\codesign.pfx"
#   $env:CSC_KEY_PASSWORD = "your-cert-password"
#   .\scripts\build_electron.ps1
#
# Or store locally (never commit):
#   Copy this template to %USERPROFILE%\.ssc\windows-codesign.env

$ErrorActionPreference = "Stop"
$sscDir = Join-Path $env:USERPROFILE ".ssc"
$envFile = Join-Path $sscDir "windows-codesign.env"

Write-Host "SSC Windows code signing"
Write-Host ""
Write-Host "Why: Windows 11 Smart App Control blocks unsigned libsignal-client.node."
Write-Host "     Users see a white screen or 'part of this app has been blocked'."
Write-Host ""
Write-Host "Obtain a certificate from:"
Write-Host "  - SSL.com, DigiCert, Sectigo (OV/EV Authenticode, ~`$200-400/yr)"
Write-Host "  - Azure Trusted Signing (cloud HSM, per-signature billing)"
Write-Host ""
Write-Host "Export as .pfx, then set before building:"
Write-Host '  $env:CSC_LINK = "C:\secure\ssc-codesign.pfx"'
Write-Host '  $env:CSC_KEY_PASSWORD = "password"'
Write-Host "  .\scripts\build_electron.ps1"
Write-Host ""

if (-not (Test-Path $sscDir)) {
    New-Item -ItemType Directory -Path $sscDir | Out-Null
}

if (-not (Test-Path $envFile)) {
    @"
# SSC Windows Authenticode - LOCAL ONLY. Do not commit.
# CSC_LINK=C:\path\to\codesign.pfx
# CSC_KEY_PASSWORD=your-password
"@ | Set-Content -Path $envFile -Encoding UTF8
    Write-Host "Created template: $envFile"
} else {
    Write-Host "Env template exists: $envFile"
}

Write-Host ""
Write-Host "Tester workaround (not for production):"
Write-Host "  Windows Security -> App & browser control -> Smart App Control -> Off"
Write-Host "  (Cannot re-enable without Windows reinstall.)"