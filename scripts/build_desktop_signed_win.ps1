# Q.61 — Signed Windows desktop build (requires CSC_LINK + CSC_KEY_PASSWORD).
$ErrorActionPreference = "Stop"
if (-not $env:CSC_LINK) {
    Write-Host "Set CSC_LINK to your .pfx path first. See scripts/CODE_SIGNING_SETUP.txt" -ForegroundColor Red
    exit 1
}
if (-not $env:CSC_KEY_PASSWORD) {
    Write-Host "Set CSC_KEY_PASSWORD for your .pfx." -ForegroundColor Red
    exit 1
}
$env:SSC_WIN_VERIFY_UPDATE_SIGNATURE = "true"
Remove-Item Env:CSC_IDENTITY_AUTO_DISCOVERY -ErrorAction SilentlyContinue
& "$PSScriptRoot\..\SSC-BUILD-DESKTOP-WIN.bat"