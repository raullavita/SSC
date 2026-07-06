# Copy latest electron\dist build into the installed SSC app folder (no installer needed).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $Root "electron\dist\win-unpacked"
$inst = Join-Path $env:LOCALAPPDATA "Programs\Super Secure Chat"

if (-not (Test-Path $src)) {
    throw "Build first: .\scripts\build_electron.ps1"
}
if (-not (Test-Path $inst)) {
    throw "SSC not installed at $inst - run SSC-Setup-0.3.1.exe first"
}

Get-Process -Name "Super Secure Chat" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Copy-Item (Join-Path $src "resources\app.asar") (Join-Path $inst "resources\app.asar") -Force
Copy-Item (Join-Path $src "resources\app.asar.unpacked\*") (Join-Path $inst "resources\app.asar.unpacked\") -Recurse -Force
Copy-Item (Join-Path $src "resources\app\*") (Join-Path $inst "resources\app\") -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $src "Super Secure Chat.exe") (Join-Path $inst "Super Secure Chat.exe") -Force

Write-Host "Updated installed SSC at: $inst"
Write-Host "Launch from Start Menu: Super Secure Chat"