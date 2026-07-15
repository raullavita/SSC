# SSC full-app audit - orchestrates open-source scanners + custom inventory.
#
# Tools used (all OSS):
#   Semgrep      - security + bug patterns (multi-language)
#   Bandit       - Python security
#   Ruff         - Python lint
#   pip-audit    - Python dependency CVEs
#   npm audit    - JavaScript dependency CVEs
#   Knip         - unused exports/files/deps (unwired frontend)
#   depcheck     - unused npm dependencies
#   Vulture      - dead Python code
#   Custom       - audit_ssc_inventory.py (API wiring, stubs, sizes)
#   Existing     - validate_secrets, pytest, yarn test:ci, release_smoke_test
#
# Usage:
#   .\scripts\full_app_audit.ps1
#   .\scripts\full_app_audit.ps1 -SkipInstall -SkipSmoke

param(
    [switch]$SkipInstall,
    [switch]$SkipSmoke,
    [switch]$SkipTests
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$ReportDir = Join-Path $Root "audit-reports"
$Stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$ReportMd = Join-Path $ReportDir "SSC-FULL-AUDIT-$Stamp.md"
$AppPython = Join-Path $Root "backend\venv\Scripts\python.exe"
if (-not (Test-Path $AppPython)) { $AppPython = "python" }
$AuditVenv = Join-Path $Root "backend\.audit-venv"
$AuditPython = Join-Path $AuditVenv "Scripts\python.exe"
function Test-AuditPython {
    param([string]$Exe)
    if (-not (Test-Path $Exe)) { return $false }
    try {
        & $Exe -c "import sys; print(sys.version)" 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}
if (-not (Test-AuditPython $AuditPython)) {
    if (Test-Path $AuditVenv) {
        Remove-Item $AuditVenv -Recurse -Force -ErrorAction SilentlyContinue
    }
    & $AppPython -m venv $AuditVenv
}
$Python = if (Test-AuditPython $AuditPython) { $AuditPython } else { $AppPython }

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$lines = [System.Collections.Generic.List[string]]::new()

function Add-Line([string]$Text) {
    $script:lines.Add($Text) | Out-Null
    Write-Host $Text
}

function Run-Step([string]$Name, [scriptblock]$Block) {
    Add-Line ""
    Add-Line "## $Name"
    Add-Line '```'
    try {
        $output = & $Block 2>&1 | Out-String
        $output = $output.Trim()
        if ($output) { Add-Line $output } else { Add-Line "(no output)" }
        return @{ name = $Name; ok = $true; output = $output }
    } catch {
        Add-Line "ERROR: $($_.Exception.Message)"
        return @{ name = $Name; ok = $false; output = $_.Exception.Message }
    } finally {
        Add-Line '```'
    }
}

Add-Line "# SSC Full App Audit"
Add-Line "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Line "Repo: $Root"
Add-Line ""
Add-Line "Open-source tools: Semgrep, Bandit, Ruff, pip-audit, npm audit, Knip, depcheck, Vulture"
Add-Line "Custom: audit_ssc_inventory.py, validate_secrets.ps1, verify_release_artifacts.ps1"

if (-not $SkipInstall) {
    Run-Step "Install Python audit tools" {
        & $Python -m pip install -q semgrep bandit ruff pip-audit vulture 2>&1
        & $Python -m pip show semgrep bandit ruff pip-audit vulture | Select-String "^Name:|^Version:"
    } | Out-Null
}

Run-Step "Custom inventory (wiring, stubs, sizes)" {
    Push-Location $Root
    & $Python scripts/audit_ssc_inventory.py
    Pop-Location
} | Out-Null

Run-Step "Secrets validation" {
    & (Join-Path $Root "scripts\validate_secrets.ps1")
} | Out-Null

if (-not $SkipTests) {
    Run-Step "Backend tests (pytest)" {
        Push-Location (Join-Path $Root "backend")
        & $AppPython -m pytest -q --tb=no 2>&1 | Select-Object -Last 5
        Pop-Location
    } | Out-Null

    Run-Step "Frontend tests (yarn test:ci)" {
        Push-Location (Join-Path $Root "frontend")
        yarn test:ci 2>&1 | Select-Object -Last 8
        Pop-Location
    } | Out-Null

    Run-Step "Frontend ESLint" {
        Push-Location (Join-Path $Root "frontend")
        yarn eslint src --max-warnings 20 2>&1 | Select-Object -First 40
        Pop-Location
    } | Out-Null
}

Run-Step "Ruff (Python lint)" {
    Push-Location $Root
    & $Python -m ruff check backend --exclude backend/venv,backend/.audit-venv,backend/tests 2>&1 | Select-Object -First 40
    Pop-Location
} | Out-Null

Run-Step "Bandit (Python security)" {
    Push-Location $Root
    & $Python -m bandit -r backend -x backend/venv,backend/.audit-venv,backend/tests -f txt -q 2>&1 | Select-Object -First 40
    Pop-Location
} | Out-Null

Run-Step "Vulture (dead Python code)" {
    Push-Location $Root
    & $Python -m vulture backend --exclude backend/venv,backend/.audit-venv,backend/tests --min-confidence 80 2>&1 | Select-Object -First 30
    Pop-Location
} | Out-Null

Run-Step "pip-audit (Python CVEs)" {
    Push-Location (Join-Path $Root "backend")
    & $Python -m pip_audit -r requirements.txt 2>&1
    Pop-Location
} | Out-Null

Run-Step "yarn audit (frontend CVEs)" {
    Push-Location (Join-Path $Root "frontend")
    yarn audit --level moderate 2>&1 | Select-Object -First 25
    Pop-Location
} | Out-Null

Run-Step "Knip (unused JS exports/files - unwired code)" {
    Push-Location (Join-Path $Root "frontend")
    npx --yes knip@5 --no-progress 2>&1 | Select-Object -First 50
    Pop-Location
} | Out-Null

Run-Step "depcheck (unused npm dependencies)" {
    Push-Location (Join-Path $Root "frontend")
    npx --yes depcheck@1.4.7 2>&1 | Select-Object -First 30
    Pop-Location
} | Out-Null

Run-Step "Semgrep (OSS security rules - auto)" {
    Push-Location $Root
    & $Python -m semgrep scan --config auto --error `
        backend/core backend/routers backend/middleware.py backend/server.py backend/deps.py `
        frontend/src electron android/app/src/main sfu-server `
        --exclude-rule generic.secrets.security.detected-generic-secret `
        --exclude-rule java.android.security.exported_activity.exported_activity `
        --exclude-rule kotlin.lang.security.gcm-detection.gcm-detection `
        --exclude-rule python.lang.security.audit.subprocess-shell-true.subprocess-shell-true `
        --exclude-rule problem-based-packs.insecure-transport.js-node.using-http-server.using-http-server `
        --exclude-rule javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal `
        --exclude-rule javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp `
        --exclude-rule dockerfile.security.missing-user.missing-user `
        2>&1 | Select-Object -First 50
    Pop-Location
} | Out-Null

if (-not $SkipSmoke) {
    Run-Step "Production smoke test" {
        & (Join-Path $Root "scripts\release_smoke_test.ps1")
    } | Out-Null

    Run-Step "Release artifact verification" {
        & (Join-Path $Root "scripts\verify_release_artifacts.ps1")
    } | Out-Null
}

# Append inventory highlights
$invPath = Join-Path $ReportDir "ssc-inventory.json"
if (Test-Path $invPath) {
    Add-Line ""
    Add-Line "## Inventory highlights (JSON)"
    Add-Line '```json'
    $inv = Get-Content $invPath -Raw | ConvertFrom-Json
    $brief = @{
        summary = $inv.summary
        policy_only = $inv.policy_only_features | ForEach-Object { $_.name }
        unwired = $inv.unwired_backend_routes | Select-Object -First 10 method, path, router
        artifacts = $inv.artifacts
    }
    Add-Line ($brief | ConvertTo-Json -Depth 5)
    Add-Line '```'
}

$lines | Set-Content -Path $ReportMd -Encoding utf8
Add-Line ""
Add-Line "Full report written to: $ReportMd"
Add-Line "Inventory JSON: audit-reports/ssc-inventory.json"
Write-Host ""
Write-Host "AUDIT COMPLETE - open $ReportMd"