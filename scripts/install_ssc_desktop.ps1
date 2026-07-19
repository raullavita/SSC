# Proper per-user install of SSC Desktop (Qt) with protocol handler + shortcuts + uninstaller.
# Usage:
#   .\scripts\install_ssc_desktop.ps1
#   .\scripts\install_ssc_desktop.ps1 -SourceDir "C:\path\to\windows-qt" -Launch
#   .\scripts\install_ssc_desktop.ps1 -Uninstall

param(
    [string]$SourceDir = "",
    [switch]$Launch,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Version = "0.4.0"
$ProductName = "SSC Desktop"
$Publisher = "Super Secure Chat"
$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\SSC"
$ExeName = "SSC-Desktop-$Version.exe"
$UninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SSC-Desktop"

function Stop-Ssc {
    Get-Process -Name "SSC-Desktop-0.4.0","ssc_desktop" -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "Super Secure Chat" -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

function Unregister-SscProtocol {
    Remove-Item -Path "HKCU:\Software\Classes\ssc" -Recurse -Force -ErrorAction SilentlyContinue
}

function Register-SscProtocol([string]$ExePath) {
    $base = "HKCU:\Software\Classes\ssc"
    New-Item -Path $base -Force | Out-Null
    Set-ItemProperty -Path $base -Name "(default)" -Value "URL:Super Secure Chat"
    # URL Protocol must exist (empty string) for Windows to treat as protocol
    New-ItemProperty -Path $base -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
    New-Item -Path "$base\DefaultIcon" -Force | Out-Null
    Set-ItemProperty -Path "$base\DefaultIcon" -Name "(default)" -Value "`"$ExePath`",0"
    New-Item -Path "$base\shell\open\command" -Force | Out-Null
    Set-ItemProperty -Path "$base\shell\open\command" -Name "(default)" -Value "`"$ExePath`" `"%1`""
}

function Write-Uninstaller([string]$Dir) {
    $ps1 = Join-Path $Dir "Uninstall-SSC-Desktop.ps1"
    $content = @"
# Uninstall SSC Desktop (per-user)
`$ErrorActionPreference = 'Continue'
Get-Process -Name 'SSC-Desktop-0.4.0','ssc_desktop','Super Secure Chat' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 400
Remove-Item -Path 'HKCU:\Software\Classes\ssc' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SSC-Desktop' -Recurse -Force -ErrorAction SilentlyContinue
`$desk = [Environment]::GetFolderPath('Desktop')
Remove-Item (Join-Path `$desk 'SSC Desktop.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path `$env:APPDATA 'Microsoft\Windows\Start Menu\Programs\SSC') -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath '$Dir' -Recurse -Force -ErrorAction SilentlyContinue
`$legacy = Join-Path `$env:LOCALAPPDATA 'SSC-Desktop'
if (Test-Path `$legacy) { Remove-Item `$legacy -Recurse -Force -ErrorAction SilentlyContinue }
Write-Host 'SSC Desktop uninstalled.'
"@
    Set-Content -Path $ps1 -Value $content -Encoding UTF8
    return $ps1
}

if ($Uninstall) {
    Stop-Ssc
    Unregister-SscProtocol
    Remove-Item -Path $UninstallKey -Recurse -Force -ErrorAction SilentlyContinue
    $desk = [Environment]::GetFolderPath("Desktop")
    Remove-Item (Join-Path $desk "SSC Desktop.lnk") -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\SSC") -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue }
    $legacy = Join-Path $env:LOCALAPPDATA "SSC-Desktop"
    if (Test-Path $legacy) { Remove-Item $legacy -Recurse -Force -ErrorAction SilentlyContinue }
    Write-Host "Uninstalled SSC Desktop."
    exit 0
}

if (-not $SourceDir) {
    $SourceDir = Join-Path $Root "dist\windows-qt"
}
$srcExe = Join-Path $SourceDir $ExeName
if (-not (Test-Path $srcExe)) {
    throw "Product build missing: $srcExe - run scripts\build_desktop_windows.ps1"
}

Write-Host "=== Installing $ProductName $Version ==="
Write-Host "From: $SourceDir"
Write-Host "To:   $InstallDir"

Stop-Ssc

# Remove ALL old SSC installs so only one remains
$legacy = Join-Path $env:LOCALAPPDATA "SSC-Desktop"
if (Test-Path $legacy) {
    Write-Host "Removing legacy portable folder..."
    Remove-Item $legacy -Recurse -Force -ErrorAction SilentlyContinue
}
$oldElectron = Join-Path $env:LOCALAPPDATA "Programs\Super Secure Chat"
if (Test-Path $oldElectron) {
    Write-Host "Removing leftover Electron Super Secure Chat..."
    Remove-Item $oldElectron -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path $InstallDir) {
    Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

& robocopy $SourceDir $InstallDir /MIR /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copy failed (robocopy $LASTEXITCODE)" }

$exe = Join-Path $InstallDir $ExeName
if (-not (Test-Path $exe)) { throw "Install failed - exe missing" }

$iconPath = Join-Path $InstallDir "ssc.ico"
if (-not (Test-Path $iconPath)) {
    $srcIco = Join-Path $Root "desktop\resources\ssc.ico"
    if (Test-Path $srcIco) { Copy-Item $srcIco $iconPath -Force }
}

# Critical: ssc:// must open THIS exe (Google OAuth return)
Unregister-SscProtocol
Register-SscProtocol -ExePath $exe
$uninstPs1 = Write-Uninstaller -Dir $InstallDir

$Wsh = New-Object -ComObject WScript.Shell
$desk = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desk "SSC Desktop.lnk"
$lnk = $Wsh.CreateShortcut($lnkPath)
$lnk.TargetPath = $exe
$lnk.WorkingDirectory = $InstallDir
$lnk.WindowStyle = 1
$lnk.Description = "$ProductName $Version - Super Secure Chat"
if (Test-Path $iconPath) { $lnk.IconLocation = "$iconPath,0" } else { $lnk.IconLocation = "$exe,0" }
$lnk.Save()

$smDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\SSC"
New-Item -ItemType Directory -Force -Path $smDir | Out-Null
$sm = $Wsh.CreateShortcut((Join-Path $smDir "SSC Desktop.lnk"))
$sm.TargetPath = $exe
$sm.WorkingDirectory = $InstallDir
$sm.Description = $ProductName
if (Test-Path $iconPath) { $sm.IconLocation = "$iconPath,0" } else { $sm.IconLocation = "$exe,0" }
$sm.Save()
$smU = $Wsh.CreateShortcut((Join-Path $smDir "Uninstall SSC Desktop.lnk"))
$smU.TargetPath = "powershell.exe"
$smU.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$uninstPs1`""
$smU.WorkingDirectory = $InstallDir
$smU.Save()

New-Item -Path $UninstallKey -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name "DisplayName" -Value "$ProductName $Version" -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name "DisplayVersion" -Value $Version -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name "Publisher" -Value $Publisher -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name "InstallLocation" -Value $InstallDir -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name "DisplayIcon" -Value $(if (Test-Path $iconPath) { $iconPath } else { $exe }) -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name "UninstallString" -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstPs1`"" -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name "NoModify" -PropertyType DWord -Value 1 -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name "NoRepair" -PropertyType DWord -Value 1 -Force | Out-Null
$sizeKb = [int]((Get-ChildItem $InstallDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1KB)
New-ItemProperty -Path $UninstallKey -Name "EstimatedSize" -PropertyType DWord -Value $sizeKb -Force | Out-Null

Write-Host ""
Write-Host "Installed: $exe"
Write-Host "Protocol:  ssc://  -> this EXE (Google sign-in return)"
Write-Host "Desktop:   SSC Desktop"
Write-Host "Uninstall: Settings Apps, or Start Menu SSC / Uninstall SSC Desktop"

if ($Launch) {
    Start-Process -FilePath $exe -WorkingDirectory $InstallDir
    Write-Host "Launched."
}
Write-Host "Done."
