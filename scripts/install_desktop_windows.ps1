# Install SSC Windows Qt client for the current user (portable copy + shortcuts).
# Usage: .\scripts\install_desktop_windows.ps1

param(
    [string]$SourceDir = "",
    [switch]$Launch
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Version = "0.4.0"

if (-not $SourceDir) {
    $SourceDir = Join-Path $Root "dist\windows-qt"
}
if (-not (Test-Path (Join-Path $SourceDir "SSC-Desktop-$Version.exe"))) {
    throw "Missing build at $SourceDir - run .\scripts\build_desktop_windows.ps1 first"
}

$InstallDir = Join-Path $env:LOCALAPPDATA "SSC-Desktop"
Write-Host "Installing SSC Desktop $Version -> $InstallDir"

if (Test-Path $InstallDir) {
    # Stop running instance if possible
    Get-Process -Name "SSC-Desktop-$Version","ssc_desktop" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
# Robocopy mirrors portable tree (runtime, crypto-worker, media-worker, Qt DLLs)
& robocopy $SourceDir $InstallDir /MIR /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
# robocopy exit 0-7 are success
if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }

$exe = Join-Path $InstallDir "SSC-Desktop-$Version.exe"
if (-not (Test-Path $exe)) { throw "Install failed - exe missing" }

# Desktop shortcut
$Wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "SSC Desktop.lnk"
$lnk = $Wsh.CreateShortcut($lnkPath)
$lnk.TargetPath = $exe
$lnk.WorkingDirectory = $InstallDir
$lnk.Description = "Super Secure Chat Desktop $Version"
$lnk.Save()

# Start Menu shortcut
$startDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\SSC"
New-Item -ItemType Directory -Force -Path $startDir | Out-Null
$startLnk = Join-Path $startDir "SSC Desktop.lnk"
$sl = $Wsh.CreateShortcut($startLnk)
$sl.TargetPath = $exe
$sl.WorkingDirectory = $InstallDir
$sl.Description = "Super Secure Chat Desktop $Version"
$sl.Save()

Write-Host "Installed: $exe"
Write-Host "Desktop shortcut: $lnkPath"
Write-Host "Start Menu: $startLnk"

if ($Launch) {
    Write-Host "Launching..."
    Start-Process -FilePath $exe -WorkingDirectory $InstallDir
}

Write-Host "Done."
