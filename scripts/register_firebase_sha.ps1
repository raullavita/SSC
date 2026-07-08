# Register Android SHA-256 fingerprints in Firebase (SSC Installed app).
# Requires service account JSON at ssc-firebase-key.json or GOOGLE_APPLICATION_CREDENTIALS.
#
# Usage:
#   .\scripts\register_firebase_sha.ps1
#   .\scripts\print_android_sha256.ps1   # view fingerprints only

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root "backend\venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    $Python = "C:\Users\smash\.ssc-tools\python-embed\python.exe"
}
if (-not (Test-Path $Python)) { $Python = "python" }

& $Python (Join-Path $Root "scripts\register_firebase_sha.py") @args
exit $LASTEXITCODE