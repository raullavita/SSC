# Install native SSC APK via adb (uses Android SDK platform-tools).
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Apk = Join-Path $Root "dist\SSC-Native-0.3.1-build9.apk"
$AdbCandidates = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\adb.exe"
)

$Adb = $AdbCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Adb) {
    throw "adb not found. Install Android Studio or platform-tools, then retry."
}
if (-not (Test-Path $Apk)) {
    throw "APK not found: $Apk`nRun scripts\build_android_native.ps1 first."
}

Write-Host "Using adb: $Adb"
& $Adb devices

$devices = (& $Adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" })
if (-not $devices) {
    Write-Host "No device detected — starting emulator..."
    & (Join-Path $PSScriptRoot "start_android_emulator.ps1")
}

Write-Host "Installing $Apk ..."
& $Adb install -r $Apk
if ($LASTEXITCODE -ne 0) { throw "adb install failed with exit $LASTEXITCODE" }
Write-Host "Installed SSC native app successfully."