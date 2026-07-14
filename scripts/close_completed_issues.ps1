# Close completed SSC help-wanted issues.
# Requires: gh auth login  OR  GH_TOKEN / GITHUB_TOKEN with repo scope.
#
# Usage: .\scripts\close_completed_issues.ps1

$ErrorActionPreference = "Stop"

$Skip = @()
$Close = @(
    1, 3, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
    71, 72, 73, 74, 75
)

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh) is required. Run: gh auth login"
}

$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "gh is not authenticated. Run: gh auth login"
}

foreach ($n in $Close) {
    if ($Skip -contains $n) { continue }
    Write-Host "Closing issue #$n..."
    gh issue close $n --comment "Completed on main — verified by audit and CI." 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to close #$n (may already be closed)"
    }
}

Write-Host "Done."