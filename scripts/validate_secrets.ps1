# SSC secrets hygiene - fail if tracked files contain production secrets or env files are staged.
# Run before commit/release: .\scripts\validate_secrets.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure([string]$Message) {
    $script:failures.Add($Message) | Out-Null
}

$forbiddenTracked = @(
    "backend/cloudrun-env.yaml",
    "production-secrets.env",
    "atlas-credentials.env",
    "ssc-firebase-key.json",
    "google-services.json",
    "google-services-web.json"
)

Push-Location $Root
try {
    $tracked = git ls-files 2>$null
    if (-not $tracked) {
        Add-Failure "git ls-files returned no files (not a git repo?)"
    } else {
        foreach ($rel in $forbiddenTracked) {
            if ($tracked -contains $rel) {
                Add-Failure "tracked secret file: $rel (must be gitignored and removed from index)"
            }
        }
    }

    # Split scheme literals so this script's own pattern definitions do not self-match.
    $mongoSrvScheme = 'mongodb' + '+srv://'
    $redisTlsScheme = 'redis' + 's://default:'
    $patterns = @(
        @{ name = "mongodb+srv credentials"; regex = $mongoSrvScheme + '[^:]+:[^@\s"]+@' },
        @{ name = "JWT secret literal"; regex = 'JWT_SECRET:\s*"[A-Za-z0-9_\-]{32,}"' },
        @{ name = "Upstash rediss URL"; regex = $redisTlsScheme + '[^@\s"]+@' },
        @{ name = "Firebase private key"; regex = '"private_key":\s*"-----BEGIN' },
        @{ name = "Firebase/Google API key"; regex = 'AIzaSy[A-Za-z0-9_\-]{20,}' }
    )

    $scanExclude = @(
        'scripts/validate_secrets.ps1',
        'scripts/rotate_production_secrets.py',
        'scripts/rotate_redis_only.py',
        'scripts/secret_url_builders.py'
    )

    $scanFiles = $tracked | Where-Object {
        $_ -notin $scanExclude -and
        $_ -match '\.(py|js|jsx|ts|tsx|json|ya?ml|ps1|sh|md|kt|kts|conf|env\.example)$' -and
        $_ -notmatch '^backend/venv/' -and
        $_ -notmatch 'cloudrun-env\.yaml\.example$' -and
        $_ -notmatch 'atlas-credentials\.env\.example$'
    }

    foreach ($rel in $scanFiles) {
        $path = Join-Path $Root $rel
        if (-not (Test-Path $path)) { continue }
        $content = Get-Content $path -Raw -ErrorAction SilentlyContinue
        if (-not $content) { continue }
        foreach ($pattern in $patterns) {
            if ($content -match $pattern.regex) {
                Add-Failure "$($pattern.name) in tracked file: $rel"
            }
        }
    }

    $gitignorePath = Join-Path $Root ".gitignore"
    $gitignore = Get-Content $gitignorePath -Raw
    foreach ($rel in $forbiddenTracked) {
        $escaped = [regex]::Escape($rel)
        if ($gitignore -notmatch $escaped) {
            Add-Failure ".gitignore missing entry for $rel"
        }
    }
} finally {
    Pop-Location
}

if ($failures.Count -gt 0) {
    Write-Host "SECRETS VALIDATION FAILED:"
    foreach ($item in $failures) {
        Write-Host "  - $item"
    }
    Write-Host ""
    Write-Host "Fix: keep secrets in gitignored local files only (.example templates in git)."
    Write-Host "Rotate: python scripts/rotate_production_secrets.py"
    exit 1
}

Write-Host ""
Write-Host "SECRETS VALIDATION PASSED"