# Q.64 / TASK J — release-candidate preflight + founder matrix instructions
$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ApiUrl = $env:SSC_API_URL
if (-not $ApiUrl) {
    $ApiUrl = "https://api.supersecurechat.com"
}
$ApiUrl = $ApiUrl.TrimEnd("/")

Write-Host "=== Q.64 TASK J device matrix preflight ===" -ForegroundColor Cyan
Write-Host "API: $ApiUrl"
Write-Host ""

$smoke = Join-Path $RepoRoot "backend\scripts\device_matrix_smoke.py"
if (-not (Test-Path $smoke)) {
    Write-Host "FAIL: missing $smoke" -ForegroundColor Red
    exit 1
}

$env:SSC_API_URL = $ApiUrl
$env:REACT_APP_BACKEND_URL = $ApiUrl
python $smoke
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Host "FAIL: device_matrix_smoke.py" -ForegroundColor Red
    exit $exitCode
}

Write-Host ""
Write-Host "Founder manual matrix (required to close TASK J):" -ForegroundColor Cyan
Write-Host "  Primary: tester-win (Windows) + tester-android (Android)"
Write-Host "  Checklist: device-matrix/MATRIX.md"
Write-Host "  Log results: test_reports/Q64_DEVICE_MATRIX.md"
Write-Host "  Calls submatrix: test_reports/Q31_TURN_OFF_LAN_MATRIX.md"
Write-Host "  Release metadata: device-matrix/RELEASE_CANDIDATE.json"
Write-Host ""
Write-Host "OK: preflight passed — run the manual matrix on devices" -ForegroundColor Green
exit 0