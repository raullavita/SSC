# SSC release smoke test - production API health + installed-client probes + optional local binaries.
# Used locally after a release and in CI (release.yml / ci.yml).
#
# Usage:
#   .\scripts\release_smoke_test.ps1
#   .\scripts\release_smoke_test.ps1 -StrictVersionMatch
#   .\scripts\release_smoke_test.ps1 -ExePath electron\dist\SSC-Setup-0.3.1.exe -ApkPath android\app\build\outputs\apk\release\SSC-0.3.1.apk

param(
    [string]$ApiUrl = "https://api.supersecurechat.com",
    [string]$WebUrl = "https://www.supersecurechat.com",
    [string]$ExpectedVersion = "0.3.1",
    [string]$ClientBuild = "10",
    [switch]$StrictVersionMatch,
    [switch]$StrictInstalledClient,
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

function Get-InstalledClientHeaders {
    return @{
        "X-SSC-Client" = "electron/$ExpectedVersion/$ClientBuild"
        "X-SSC-Native-Bridge" = "v1"
        "X-SSC-Device-Attest" = "ssc-attest-test-v1"
    }
}

function Read-ErrorBody($Exception) {
    $status = 0
    $detail = $null
    $raw = $null
    if ($Exception.Response) {
        $status = [int]$Exception.Response.StatusCode
        try {
            $stream = $Exception.Response.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $raw = $reader.ReadToEnd()
                $reader.Close()
            }
        } catch {
            $raw = $null
        }
    }
    if ($raw) {
        try {
            $parsed = $raw | ConvertFrom-Json
            $detail = $parsed.detail
        } catch {
            $detail = $raw
        }
    }
    if (-not $detail -and $Exception.ErrorDetails -and $Exception.ErrorDetails.Message) {
        $raw = $Exception.ErrorDetails.Message
        try {
            $parsed = $raw | ConvertFrom-Json
            $detail = $parsed.detail
        } catch {
            $detail = $raw
        }
    }
    if (-not $detail) {
        $detail = $Exception.Message
    }
    return @{ status = $status; detail = $detail; raw = $raw }
}

function Get-CurlExecutable {
    if ($IsWindows -or $env:OS -eq "Windows_NT") {
        if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
            return "curl.exe"
        }
    }
    if (Get-Command curl -ErrorAction SilentlyContinue) {
        return "curl"
    }
    return $null
}

function Parse-HttpJsonProbeResult {
    param(
        [int]$Status,
        [string]$BodyText
    )
    $detail = $null
    if ($BodyText) {
        try {
            $parsed = $BodyText | ConvertFrom-Json
            $detail = $parsed.detail
        } catch {
            $detail = $BodyText
        }
    }
    return @{ status = $Status; detail = $detail; body = $BodyText }
}

function Invoke-CurlJsonProbe {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Url,
        [hashtable]$Headers,
        [string]$Body = ""
    )
    $curl = Get-CurlExecutable
    if ($curl) {
        $curlArgs = @("-s", "-w", "`nHTTP:%{http_code}", "-X", $Method)
        foreach ($key in $Headers.Keys) {
            $curlArgs += "-H"
            $curlArgs += ("{0}: {1}" -f $key, $Headers[$key])
        }
        if ($Body) {
            $curlArgs += "-d"
            $curlArgs += $Body
        }
        $curlArgs += $Url
        $raw = & $curl @curlArgs 2>&1 | Out-String
        $lines = $raw.Trim() -split "`n"
        $httpLine = $lines | Where-Object { $_ -match '^HTTP:' } | Select-Object -Last 1
        $status = 0
        if ($httpLine -match 'HTTP:(\d+)') {
            $status = [int]$Matches[1]
        }
        $bodyText = ($lines | Where-Object { $_ -notmatch '^HTTP:' }) -join "`n"
        return Parse-HttpJsonProbeResult -Status $status -BodyText $bodyText
    }

    $iwrParams = @{
        Uri             = $Url
        Method          = $Method
        TimeoutSec      = 45
        UseBasicParsing = $true
    }
    if ($PSVersionTable.PSVersion.Major -ge 7) {
        $iwrParams.SkipHttpErrorCheck = $true
    }
    if ($Headers) {
        $iwrParams.Headers = $Headers
    }
    if ($Body) {
        $iwrParams.Body = $Body
        $iwrParams.ContentType = "application/json"
    }
    try {
        $response = Invoke-WebRequest @iwrParams
        return Parse-HttpJsonProbeResult -Status ([int]$response.StatusCode) -BodyText $response.Content
    } catch {
        $errInfo = Read-ErrorBody $_
        $bodyText = $errInfo.raw
        if (-not $bodyText) {
            $bodyText = $errInfo.detail
        }
        return Parse-HttpJsonProbeResult -Status $errInfo.status -BodyText $bodyText
    }
}

function Invoke-SscConfigProbe {
    $headers = Get-InstalledClientHeaders
    $result = Invoke-CurlJsonProbe -Name "config" -Url "$ApiUrl/api/config" -Headers $headers
    if ($result.status -eq 200) {
        Assert-Ok "api.config.status" $true "HTTP 200"
        try {
            $cfg = $result.body | ConvertFrom-Json
            if ($cfg.release_version) {
                if ($StrictVersionMatch) {
                    Assert-Ok "api.config.release_version" ($cfg.release_version -eq $ExpectedVersion) "release_version=$($cfg.release_version)"
                } elseif ($cfg.release_version -ne $ExpectedVersion) {
                    Write-Host "WARN: api.config.release_version=$($cfg.release_version) (code=$ExpectedVersion, deploy pending)"
                } else {
                    Assert-Ok "api.config.release_version" $true "release_version=$($cfg.release_version)"
                }
            }
        } catch {
            Add-Failure "api.config.json - invalid JSON"
        }
        return
    }
    if ($result.status -eq 403 -and "$($result.detail)" -match 'device_attest') {
        if ($StrictInstalledClient) {
            Add-Failure "api.config.installed_client - blocked by attestation: $($result.detail)"
        } else {
            Write-Host "WARN: api.config blocked by device attestation ($($result.detail)) - set SSC_REQUIRE_DEVICE_ATTEST=false or deploy SSC_DESKTOP_ATTEST_SECRET in Phase 4"
            Assert-Ok "api.config.attest_reachable" $true "HTTP 403 detail=$($result.detail)"
        }
        return
    }
    Add-Failure "api.config.installed_client - HTTP $($result.status) $($result.detail)"
}

function Invoke-SscLoginProbe {
    $headers = Get-InstalledClientHeaders
    $headers["Content-Type"] = "application/json"
    $body = '{"email":"smoke-nonexistent@ssc.invalid","password":"not-a-real-password"}'
    $result = Invoke-CurlJsonProbe -Name "login" -Method "POST" -Url "$ApiUrl/api/auth/login" -Headers $headers -Body $body
    $status = $result.status
    $detail = "$($result.detail)"
    if ($status -in 400, 401, 422) {
        Assert-Ok "api.login.installed_client" $true "auth layer reached HTTP $status"
        return
    }
    if ($status -eq 403 -and $detail -match 'device_attest') {
        if ($StrictInstalledClient) {
            Add-Failure "api.login.installed_client - blocked by attestation: $detail"
        } else {
            Write-Host "WARN: api.login blocked by device attestation ($detail) - Phase 4 Cloud Run toggle required"
            Assert-Ok "api.login.attest_reachable" $true "HTTP 403 detail=$detail"
        }
        return
    }
    if ($status -eq 403 -and $detail -match 'installed_client_required') {
        Add-Failure "api.login.installed_client - missing/invalid client headers: $detail"
        return
    }
    if ($status -ge 200 -and $status -lt 300) {
        Add-Failure "api.login.installed_client - unexpected success HTTP $status"
        return
    }
    Add-Failure "api.login.installed_client - HTTP $status $detail"
}

Write-Host "Smoke test: API=$ApiUrl Web=$WebUrl version=$ExpectedVersion build=$ClientBuild"

try {
    $health = Invoke-RestMethod -Uri "$ApiUrl/api/health" -TimeoutSec 45
    Assert-Ok "api.health.status" ($health.status -eq "ok") "status=$($health.status)"
    if ($StrictVersionMatch) {
        Assert-Ok "api.health.version" ($health.version -eq $ExpectedVersion) "version=$($health.version)"
    } elseif ($health.version -ne $ExpectedVersion) {
        Write-Host "WARN: api.health.version=$($health.version) (code=$ExpectedVersion, deploy pending)"
        Assert-Ok "api.health.version.semver" ($health.version -match '^\d+\.\d+\.\d+$') "version=$($health.version)"
    } else {
        Assert-Ok "api.health.version" ($health.version -eq $ExpectedVersion) "version=$($health.version)"
    }
    Assert-Ok "api.health.mongo" ($health.mongo.status -eq "ok") "mongo=$($health.mongo | ConvertTo-Json -Compress)"
    Assert-Ok "api.health.redis" ($health.redis.status -eq "ok") "redis=$($health.redis.status)"
    Assert-Ok "api.health.sfu.enabled" ($health.sfu.enabled -eq $true) "sfu disabled"
    Assert-Ok "api.health.sfu.ws_url" ($health.sfu.ws_url -like "wss://*") "ws_url=$($health.sfu.ws_url)"
    Assert-Ok "api.health.push.ready" ($health.push.ready -eq $true) "push not ready"
} catch {
    Add-Failure "api.health - $($_.Exception.Message)"
}

Invoke-SscConfigProbe
Invoke-SscLoginProbe

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