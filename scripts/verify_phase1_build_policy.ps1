# Phase 1 — release builds must require production libsignal (no dev crypto in APK/EXE).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

$required = @(
    "$Root\scripts\build_electron.ps1",
    "$Root\scripts\build_android.ps1"
)

foreach ($path in $required) {
    if (-not (Test-Path $path)) {
        Write-Error "Missing build script: $path"
    }
    $text = Get-Content $path -Raw
    if ($text -notmatch 'REACT_APP_SSC_REQUIRE_LIBCRYPTO\s*=\s*"true"') {
        Write-Error "Phase 1 policy: $path must set REACT_APP_SSC_REQUIRE_LIBCRYPTO=true"
    }
}

Write-Host "PHASE1 BUILD POLICY PASSED"