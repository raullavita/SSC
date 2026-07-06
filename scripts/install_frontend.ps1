# SSC frontend install — Node 22 is required by CI and some deps (e.g. awaitqueue).
# On Node 20 locally, use --ignore-engines until you upgrade Node.
$ErrorActionPreference = "Stop"
Push-Location (Join-Path (Split-Path -Parent $PSScriptRoot) "frontend")
try {
    $nodeMajor = [int]((node -v) -replace '^v(\d+).*', '$1')
    if ($nodeMajor -lt 22) {
        Write-Host "Node $(node -v) detected — running yarn install --ignore-engines (upgrade to Node 22 for CI parity)."
        yarn install --ignore-engines
    } else {
        yarn install --frozen-lockfile
    }
} finally {
    Pop-Location
}