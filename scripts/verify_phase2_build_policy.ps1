# Phase 2 — encrypted stores, cert pinning, native bridge attestation.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

$checks = @(
    @{ Path = "$Root\android\app\src\main\java\com\supersecurechat\app\SscSecureStore.kt"; Pattern = "AndroidKeyStore" },
    @{ Path = "$Root\android\app\src\main\res\xml\network_security_config.xml"; Pattern = "pin-set" },
    @{ Path = "$Root\electron\secureFileStore.js"; Pattern = "safeStorage" },
    @{ Path = "$Root\electron\main.js"; Pattern = "setCertificateVerifyProc" },
    @{ Path = "$Root\electron\preload.js"; Pattern = "__SSC_NATIVE_BRIDGE" },
    @{ Path = "$Root\frontend\src\lib\installedClient.js"; Pattern = "X-SSC-Native-Bridge" },
    @{ Path = "$Root\backend\core\recovery_crypto.py"; Pattern = "argon2" },
    @{ Path = "$Root\backend\core\short_lived_tokens.py"; Pattern = "issue_token" },
    @{ Path = "$Root\backend\requirements.txt"; Pattern = "argon2-cffi" }
)

foreach ($check in $checks) {
    if (-not (Test-Path $check.Path)) {
        Write-Error "Phase 2 policy: missing $($check.Path)"
    }
    $text = Get-Content $check.Path -Raw
    if ($text -notmatch $check.Pattern) {
        Write-Error "Phase 2 policy: $($check.Path) must contain $($check.Pattern)"
    }
}

Write-Host "PHASE2 BUILD POLICY PASSED"