# Upload SSC Android APK to Firebase App Distribution for testers
param(
    [string]$ApkPath = "",
    [string]$Project = "super-chat-b0992",
    [string]$AppId = "1:814078411789:android:88e548025619ab48c68144",
    [string]$Testers = "raullavita1988@gmail.com,smashmaxxx@gmail.com,velvetnightshub@gmail.com",
    [string]$ReleaseNotes = "SSC v0.3.0 build 5 - matches Windows PC build; Google OAuth + encrypted chat cross-device testing."
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
Write-Host "Distributing $ApkPath ($sizeMb MB) to Firebase App Distribution..."

firebase appdistribution:distribute $ApkPath `
    --app $AppId `
    --project $Project `
    --testers $Testers `
    --release-notes $ReleaseNotes

Write-Host "Firebase App Distribution upload complete. Testers will receive an email invite."