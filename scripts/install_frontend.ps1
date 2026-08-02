# SSC frontend install - Node 22 is required by CI and some deps (e.g. awaitqueue).
# On Node 20 locally, use --ignore-engines until you upgrade Node.
$ErrorActionPreference = "Stop"
Push-Location (Join-Path (Split-Path -Parent $PSScriptRoot) "frontend")
try {
    $nodeMajor = [int]((node -v) -replace '^v(\d+).*', '$1')
    if ($nodeMajor -lt 22) {
        $nodeVersion = node -v
        Write-Host ("Node {0} detected; running yarn install --ignore-engines. Upgrade to Node 22 for CI parity." -f $nodeVersion)
        yarn install --ignore-engines
    } else {
        yarn install --frozen-lockfile
    }
} finally {
    Pop-Location
}