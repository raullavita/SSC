# Start the SSC Android emulator (creates AVD on first run if missing).
$ErrorActionPreference = "Stop"

$Sdk = "$env:LOCALAPPDATA\Android\Sdk"
$Adb = Join-Path $Sdk "platform-tools\adb.exe"
$Emulator = Join-Path $Sdk "emulator\emulator.exe"
$SdkManager = Join-Path $Sdk "cmdline-tools\latest\bin\sdkmanager.bat"
$AvdManager = Join-Path $Sdk "cmdline-tools\latest\bin\avdmanager.bat"
$AvdName = "SSC_Emulator"
$SystemImage = "system-images;android-35;google_apis;x86_64"

if (-not (Test-Path $Emulator)) {
    Write-Host "Installing emulator + system image (first run, may take several minutes)..."
    "y" * 20 | & $SdkManager --install "emulator" $SystemImage | Out-Host
}

$avds = & $Emulator -list-avds 2>$null
if ($avds -notcontains $AvdName) {
    Write-Host "Creating AVD $AvdName ..."
    echo "no" | & $AvdManager create avd -n $AvdName -k $SystemImage -d pixel_6 --force | Out-Host
}

$running = Get-Process qemu-system-x86_64, emulator -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "Emulator already running."
} else {
    Write-Host "Starting $AvdName ..."
    Start-Process -FilePath $Emulator -ArgumentList "-avd", $AvdName, "-no-snapshot-load", "-gpu", "auto", "-no-audio"
}

Write-Host "Waiting for boot..."
& $Adb wait-for-device | Out-Null
$deadline = (Get-Date).AddMinutes(10)
do {
    Start-Sleep -Seconds 4
    $boot = (& $Adb shell getprop sys.boot_completed 2>$null).Trim()
} while ($boot -ne "1" -and (Get-Date) -lt $deadline)

if ($boot -ne "1") { throw "Emulator did not finish booting in time." }
Write-Host "Emulator ready: $AvdName"
& $Adb devices