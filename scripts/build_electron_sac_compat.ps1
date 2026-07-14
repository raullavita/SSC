# SSC Windows SAC compat build — no native libsignal (.node) so Smart App Control does not block.
# Messages are NOT end-to-end encrypted in this build. Use only for testing on SAC-locked PCs.
# Production releases need Authenticode signing (see setup_windows_codesign.ps1).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Electron = Join-Path $Root "electron"
$CompatFlag = Join-Path $Electron "SSC_COMPAT_MODE"

Write-Host "Building SAC compat Electron (no native libsignal)..."
New-Item -ItemType File -Path $CompatFlag -Force | Out-Null

try {
    Push-Location "$Root\frontend"
    $env:REACT_APP_SSC_PLATFORM = "electron"
    $env:REACT_APP_SSC_LANDING_ONLY = "false"
    $env:REACT_APP_SSC_VERSION = "0.3.1"
    $env:REACT_APP_SSC_BUILD = "12"
    $env:REACT_APP_SSC_REQUIRE_LIBCRYPTO = "false"
    $env:REACT_APP_SSC_SAC_COMPAT = "true"
    $env:PUBLIC_URL = "."
    $env:REACT_APP_API_URL = $(if ($env:REACT_APP_API_URL) { $env:REACT_APP_API_URL } else { "https://api.supersecurechat.com" })
    $env:REACT_APP_GOOGLE_CLIENT_ID = $(if ($env:REACT_APP_GOOGLE_CLIENT_ID) { $env:REACT_APP_GOOGLE_CLIENT_ID } else { "814078411789-o3t5krp2mvoi32rkaug6jmegtb8t1ihf.apps.googleusercontent.com" })
    yarn build
    Pop-Location

    Push-Location $Electron
    npm install
    $libsignalDir = Join-Path $Electron "node_modules\@signalapp"
    $libsignalBackup = Join-Path $Electron "node_modules\_signalapp_backup"
    if (Test-Path $libsignalDir) {
        if (Test-Path $libsignalBackup) { Remove-Item $libsignalBackup -Recurse -Force }
        Rename-Item $libsignalDir $libsignalBackup
    }
    try {
        $env:SSC_PROD_FILE = "$Root\frontend\build\index.html"
        $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
        npm run dist
    } finally {
        if (Test-Path $libsignalBackup) {
            if (Test-Path $libsignalDir) { Remove-Item $libsignalDir -Recurse -Force }
            Rename-Item $libsignalBackup (Join-Path $Electron "node_modules\@signalapp")
        }
    }
    Pop-Location

    $installer = Get-ChildItem "$Electron\dist\SSC-Setup-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($installer) {
        $dest = "$env:USERPROFILE\Desktop\SSC-Setup-0.3.1-SAC-COMPAT.exe"
        Copy-Item $installer.FullName $dest -Force
        Write-Host "SAC compat installer: $dest"
        Write-Host "WARNING: This build has NO end-to-end encryption. For SAC-locked PCs only."
    }
} finally {
    Remove-Item $CompatFlag -Force -ErrorAction SilentlyContinue
}