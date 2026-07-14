# Resolve gcloud.cmd and authenticate via Firebase CLI token when gcloud has no login.

function Resolve-GcloudPath {
    $cmd = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @(
        "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
        "$env:USERPROFILE\.ssc-tools\google-cloud-sdk\google-cloud-sdk\bin\gcloud.cmd",
        "${env:ProgramFiles}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
        "${env:ProgramFiles(x86)}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

function Add-GcloudToPath {
    $bin = Resolve-GcloudPath
    if (-not $bin) { return $false }
    $dir = Split-Path $bin -Parent
    if ($env:Path -split ';' -notcontains $dir) {
        $env:Path = "$dir;$env:Path"
    }
    return $true
}

function Ensure-GcloudAuth {
    param([string]$Gcloud)

    $list = & $Gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
    if ($list) { return $list.Trim() }

    $firebaseConfig = Join-Path $env:USERPROFILE ".config\configstore\firebase-tools.json"
    if (-not (Test-Path $firebaseConfig)) {
        throw "gcloud not logged in and firebase-tools.json missing. Run: firebase login"
    }

    # Refresh Firebase token (updates access_token in configstore).
    $null = firebase projects:list 2>&1

    $fb = Get-Content $firebaseConfig | ConvertFrom-Json
    if (-not $fb.tokens.access_token) {
        throw "Firebase access token missing. Run: firebase login"
    }

    $env:CLOUDSDK_AUTH_ACCESS_TOKEN = $fb.tokens.access_token
    $env:CLOUDSDK_CORE_ACCOUNT = $fb.user.email
    Write-Host "Using Firebase OAuth for gcloud ($($fb.user.email))"
    return $fb.user.email
}