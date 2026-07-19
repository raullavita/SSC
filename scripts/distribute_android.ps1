# Upload SSC Android APK to Firebase App Distribution for testers
# Firebase console: project super-chat-b0992 -> App Distribution -> app "SSC Installed" (com.supersecurechat.app)
# Do NOT use the legacy "SSC" app (chat.ssc.secure) or "SSC Web".
param(
    [string]$ApkPath = "",
    [string]$Project = "super-chat-b0992",
    [string]$AppId = "1:814078411789:android:88e548025619ab48c68144",
    [string]$AppDisplayName = "SSC Installed",
    [string]$PackageName = "com.supersecurechat.app",
    [string]$TesterGroup = "ssc-testers",
    [string]$Testers = "raullavita1988@gmail.com,smashmaxxx@gmail.com,velvetnightshub@gmail.com",
    [string]$ReleaseNotes = "SSC v0.4.0 build 15 - native Jetpack Compose, libsignal 0.96.4, multi-device Sesame, SFU group calls, E2EE Android-Windows Qt interop."
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Version = "0.4.0"

if (-not $ApkPath) {
    $candidates = @(
        (Join-Path $Root "dist\SSC-$Version.apk"),
        (Join-Path $Root "android\app\build\outputs\apk\release\SSC-$Version.apk"),
        (Join-Path $Root "android\app\build\outputs\apk\release\app-release.apk")
    )
    $ApkPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $ApkPath -or -not (Test-Path $ApkPath)) {
    throw "APK not found - run .\scripts\build_android.ps1 first"
}

$sizeMb = [math]::Round((Get-Item $ApkPath).Length / 1MB, 1)
Write-Host "Distributing $ApkPath ($sizeMb MB)"
Write-Host "Firebase app: $AppDisplayName ($PackageName)"
Write-Host "App ID: $AppId"

$testerList = $Testers.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
if ($TesterGroup) {
    firebase appdistribution:testers:add --group-alias $TesterGroup @testerList --project $Project 2>$null
}

$distArgs = @(
    "appdistribution:distribute", $ApkPath,
    "--app", $AppId,
    "--project", $Project,
    "--release-notes", $ReleaseNotes
)
if ($TesterGroup) {
    $distArgs += @("--groups", $TesterGroup)
} else {
    $distArgs += @("--testers", $Testers)
}

firebase @distArgs

$consoleUrl = "https://console.firebase.google.com/project/$Project/appdistribution/app/android:$($AppId.Split(':')[-1])/releases"
Write-Host ""
Write-Host "Firebase App Distribution upload complete."
Write-Host "Console (use SSC Installed, not legacy SSC): $consoleUrl"
Write-Host "Tester portal: https://appdistribution.firebase.google.com/"
Write-Host "Testers: $($testerList -join ', ')"
