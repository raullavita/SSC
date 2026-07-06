# Phase 3 — fortress mode: iOS crypto, attestation, WS subscribe tokens, Argon2 passwords, SFU HMAC.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

$checks = @(
    @{ Path = "$Root\ios\SuperSecureChat\LibsignalSession.swift"; Pattern = "LibSignalClient" },
    @{ Path = "$Root\ios\SuperSecureChat\SscSecureStore.swift"; Pattern = "keychainService" },
    @{ Path = "$Root\android\app\src\main\java\com\supersecurechat\app\SscDeviceAttest.kt"; Pattern = "Play Integrity" },
    @{ Path = "$Root\backend\core\ws_subscribe_tokens.py"; Pattern = "ws_subscribe" },
    @{ Path = "$Root\backend\core\password_crypto.py"; Pattern = "argon2" },
    @{ Path = "$Root\backend\core\captcha.py"; Pattern = "turnstile" },
    @{ Path = "$Root\backend\core\sfu_internal_auth.py"; Pattern = "sign_sfu_request" },
    @{ Path = "$Root\sfu-server\internalAuth.js"; Pattern = "verifyInternalAuth" },
    @{ Path = "$Root\frontend\src\lib\wsSubscribe.js"; Pattern = "subscribe_token" },
    @{ Path = "$Root\backend\tests\test_phase3_security.py"; Pattern = "Phase 3" }
)

foreach ($check in $checks) {
    if (-not (Test-Path $check.Path)) {
        Write-Error "Phase 3 policy: missing $($check.Path)"
    }
    $text = Get-Content $check.Path -Raw
    if ($text -notmatch $check.Pattern) {
        Write-Error "Phase 3 policy: $($check.Path) must contain $($check.Pattern)"
    }
}

Write-Host "PHASE3 BUILD POLICY PASSED"