# SSC release smoke test - production API health + optional local release binaries.
# Used locally after a release and in CI (release.yml / ci.yml).
#
# Usage:
#   .\scripts\release_smoke_test.ps1
#   .\scripts\release_smoke_test.ps1 -ExePath electron\dist\SSC-Setup-0.3.0.exe -ApkPath android\app\build\outputs\apk\release\SSC-0.3.0.apk

param(
    [string]$ApiUrl = "https://api.supersecurechat.com",
    [string]$WebUrl = "https://www.supersecurechat.com",
    [string]$ExpectedVersion = "0.3.0",
    [string]$ExePath = "",
    [string]$ApkPath = ""
)

$ErrorActionPreference = "Stop"
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure([string]$Message) {
    $script:failures.Add($Message) | Out-Null
}

function Assert-Ok([string]$Name, [bool]$Passed, [string]$Detail) {
    if ($Passed) {
        Write-Host "OK: $Name"
    } else {
        Add-Failure "$Name - $Detail"
    }
}

Write-Host "Smoke test: API=$ApiUrl Web=$WebUrl version=$ExpectedVersion"

try {
    $health = Invoke-RestMethod -Uri "$ApiUrl/api/health" -TimeoutSec 45
    Assert-Ok "api.health.status" ($health.status -eq "ok") "status=$($health.status)"
    Assert-Ok "api.health.version" ($health.version -eq $ExpectedVersion) "version=$($health.version)"
    Assert-Ok "api.health.mongo" ($health.mongo.status -eq "ok") "mongo=$($health.mongo | ConvertTo-Json -Compress)"
    Assert-Ok "api.health.redis" ($health.redis.status -eq "ok") "redis=$($health.redis.status)"
    Assert-Ok "api.health.sfu.enabled" ($health.sfu.enabled -eq $true) "sfu disabled"
    Assert-Ok "api.health.sfu.ws_url" ($health.sfu.ws_url -like "wss://*") "ws_url=$($health.sfu.ws_url)"
    Assert-Ok "api.health.push.ready" ($health.push.ready -eq $true) "push not ready"
} catch {
    Add-Failure "api.health - $($_.Exception.Message)"
}

try {
    $web = Invoke-WebRequest -Uri $WebUrl -TimeoutSec 45 -UseBasicParsing
    Assert-Ok "web.status" ($web.StatusCode -eq 200) "HTTP $($web.StatusCode)"
} catch {
    Add-Failure "web - $($_.Exception.Message)"
}

if ($ExePath) {
    if (Test-Path $ExePath) {
        $size = (Get-Item $ExePath).Length
        Assert-Ok "exe.size" ($size -gt 5MB) "only $([math]::Round($size / 1MB, 2)) MB at $ExePath"
    } else {
        Add-Failure "exe - not found at $ExePath"
    }
}

if ($ApkPath) {
    if (Test-Path $ApkPath) {
        $size = (Get-Item $ApkPath).Length
        Assert-Ok "apk.size" ($size -gt 1MB) "only $([math]::Round($size / 1MB, 2)) MB at $ApkPath"
    } else {
        Add-Failure "apk - not found at $ApkPath"
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "SMOKE TEST FAILED - $($failures.Count) check(s):"
    foreach ($item in $failures) {
        Write-Host "  - $item"
    }
    exit 1
}

Write-Host ""
Write-Host "SMOKE TEST PASSED"
exit 0