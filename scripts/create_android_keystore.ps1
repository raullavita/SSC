# Create SSC Android release keystore (free - no Play Store required).
# Run once. BACK UP the .jks file and password; losing them blocks future app updates.
#
# Usage:
#   .\scripts\create_android_keystore.ps1
#   .\scripts\create_android_keystore.ps1 -Force   # overwrite existing keystore

param(
    [switch]$Force,
    [switch]$GeneratePassword
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

$sscDir = Join-Path $env:USERPROFILE ".ssc"
$keystorePath = Join-Path $sscDir "ssc-release.jks"
$envFile = Join-Path $sscDir "android-signing.env"
$keyAlias = "ssc-release"

if ((Test-Path $keystorePath) -and -not $Force) {
    Write-Host "Keystore already exists: $keystorePath"
    Write-Host "Use -Force to recreate (old keystore will be replaced - only do this on a fresh app)."
    exit 0
}

$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
    throw "keytool not found. Install JDK 17+ (Android Studio bundles one)."
}

New-Item -ItemType Directory -Path $sscDir -Force | Out-Null

Write-Host ""
Write-Host "SSC Android release keystore setup"
Write-Host "=================================="
Write-Host "Keystore path: $keystorePath"
Write-Host ""
if ($GeneratePassword) {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $storePasswordPlain = [Convert]::ToBase64String($bytes) -replace '[^a-zA-Z0-9]', 'x'
    $keyPasswordPlain = $storePasswordPlain
    Write-Host "Generated a random password (saved to android-signing.env only)."
} else {
    Write-Host "Choose a STRONG password (min 8 chars). You need it for every release build."
    Write-Host "If you lose the keystore OR password, you cannot ship updates to existing installs."
    Write-Host ""

    $storePassword = Read-Host "Enter keystore password" -AsSecureString
    $storePasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($storePassword)
    )
    if ($storePasswordPlain.Length -lt 8) {
        throw "Password must be at least 8 characters."
    }

    $keyPasswordPlain = $storePasswordPlain
    $useDifferentKeyPass = Read-Host "Use a different key password? (y/N)"
    if ($useDifferentKeyPass -match '^[Yy]') {
        $keyPassword = Read-Host "Enter key password" -AsSecureString
        $keyPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPassword)
        )
    }
}

$dname = "CN=Super Secure Chat, OU=Mobile, O=Super Secure Chat, L=NA, ST=NA, C=US"

if (Test-Path $keystorePath) {
    Remove-Item $keystorePath -Force
}

& keytool -genkeypair -v `
    -keystore $keystorePath `
    -alias $keyAlias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storepass $storePasswordPlain `
    -keypass $keyPasswordPlain `
    -dname $dname

if ($LASTEXITCODE -ne 0) {
    throw "keytool failed (exit $LASTEXITCODE)"
}

@"
# SSC Android release signing - LOCAL ONLY. Do not commit.
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
SSC_ANDROID_KEYSTORE=$keystorePath
SSC_ANDROID_KEYSTORE_PASSWORD=$storePasswordPlain
SSC_ANDROID_KEY_ALIAS=$keyAlias
SSC_ANDROID_KEY_PASSWORD=$keyPasswordPlain
"@ | Set-Content -Path $envFile -Encoding UTF8

Write-Host ""
Write-Host "Keystore created."
Write-Host "Credentials saved to: $envFile"
Write-Host ""
Write-Host "BACK UP NOW (required):"
Write-Host "  1. Copy $keystorePath to USB / encrypted backup"
Write-Host "  2. Store the password in your password manager"
Write-Host "  3. Never commit the .jks or android-signing.env to git"
Write-Host ""
Write-Host "Next: .\scripts\build_android.ps1"