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
    [string]$ReleaseNotes = "SSC v0.3.0 build 6 - signed APK, fixed install (was 400MB unsigned). Matches Windows build 5. Google login + cross-device chat."
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not $ApkPath) {
    $ApkPath = Join-Path $Root "android\app\build\outputs\apk\release\SSC-0.3.0.apk"
}

if (-not (Test-Path $ApkPath)) {
    throw "APK not found: $ApkPath - run .\scripts\build_android.ps1 first"
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
$testerUrl = "https://appdistribution.firebase.google.com/testerapps/$($AppId -replace ':','%3A')/releases"
Write-Host ""
Write-Host "Firebase App Distribution upload complete."
Write-Host "Console (use SSC Installed, not legacy SSC): $consoleUrl"
Write-Host "Tester portal (open on phone, sign in with Google): https://appdistribution.firebase.google.com/"
Write-Host "Testers: $($testerList -join ', ')"