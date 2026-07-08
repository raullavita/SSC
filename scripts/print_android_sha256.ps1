# Print SHA-256 certificate fingerprints for Firebase / Google Sign-In.
#
# Add the release SHA-256 in Firebase Console:
#   Project settings -> Your apps -> SSC Installed (com.supersecurechat.app) -> Add fingerprint
#
# Usage:
#   .\scripts\print_android_sha256.ps1
#   .\scripts\print_android_sha256.ps1 -Keystore "C:\path\to\release.keystore" -Alias ssc

param(
    [string]$Keystore = $env:SSC_ANDROID_KEYSTORE,
    [string]$Alias = $env:SSC_ANDROID_KEY_ALIAS,
    [string]$StorePassword = $env:SSC_ANDROID_STORE_PASSWORD
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

. (Join-Path $PSScriptRoot "load_android_signing.ps1") | Out-Null

if (-not $Keystore) {
    $Keystore = $env:SSC_ANDROID_KEYSTORE
}
if (-not $Alias) {
    $Alias = $env:SSC_ANDROID_KEY_ALIAS
}
if (-not $StorePassword) {
    $StorePassword = $env:SSC_ANDROID_STORE_PASSWORD
}

$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
    Write-Error "keytool not found. Install JDK 17+ and ensure keytool is on PATH."
}

Write-Host "SSC Android SHA-256 fingerprints"
Write-Host "Package: com.supersecurechat.app (SSC Installed)"
Write-Host ""

if ($Keystore -and (Test-Path $Keystore)) {
    Write-Host "Release keystore: $Keystore (alias: $Alias)"
    if (-not $StorePassword) {
        $secure = Read-Host "Keystore password" -AsSecureString
        $StorePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        )
    }
    & keytool -list -v -keystore $Keystore -alias $Alias -storepass $StorePassword 2>&1 |
        Select-String "SHA256:"
} else {
    Write-Host "No release keystore configured."
    Write-Host "Create one: .\scripts\create_android_keystore.ps1"
    Write-Host "Or set SSC_ANDROID_KEYSTORE in %USERPROFILE%\.ssc\android-signing.env"
    Write-Host ""
    Write-Host "Debug keystore (emulator/dev only):"
    $debugKs = Join-Path $env:USERPROFILE ".android\debug.keystore"
    if (Test-Path $debugKs) {
        & keytool -list -v -keystore $debugKs -alias androiddebugkey -storepass android -keypass android 2>&1 |
            Select-String "SHA256:"
    } else {
        Write-Host "  (debug.keystore not found - build Android once in Android Studio)"
    }
}