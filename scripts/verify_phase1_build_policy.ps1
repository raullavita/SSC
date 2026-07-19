# Phase 1 — release builds must use production libsignal (no dev crypto fallbacks).
# Native Android uses libsignal-android; Electron (legacy) still sets REACT_APP_SSC_REQUIRE_LIBCRYPTO.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

# --- Electron (legacy shell; still gated if script exists) ---
$electronBuild = "$Root\scripts\build_electron.ps1"
if (Test-Path $electronBuild) {
    $text = Get-Content $electronBuild -Raw
    if ($text -notmatch 'REACT_APP_SSC_REQUIRE_LIBCRYPTO\s*=\s*"true"') {
        Write-Error "Phase 1 policy: $electronBuild must set REACT_APP_SSC_REQUIRE_LIBCRYPTO=true"
    }
}

# --- Native Android (Compose product path) ---
$androidBuild = "$Root\scripts\build_android.ps1"
if (-not (Test-Path $androidBuild)) {
    Write-Error "Missing Android build script: $androidBuild"
}
$androidGradle = "$Root\android\app\build.gradle.kts"
if (-not (Test-Path $androidGradle)) {
    Write-Error "Missing Android Gradle: $androidGradle"
}
$gradleText = Get-Content $androidGradle -Raw
if ($gradleText -notmatch 'libsignal-android') {
    Write-Error "Phase 1 policy: $androidGradle must depend on libsignal-android"
}
if ($gradleText -match 'REACT_APP_SSC_REQUIRE_LIBCRYPTO\s*=\s*"false"') {
    Write-Error "Phase 1 policy: must not ship REACT_APP_SSC_REQUIRE_LIBCRYPTO=false"
}

Write-Host "PHASE1 BUILD POLICY PASSED"
