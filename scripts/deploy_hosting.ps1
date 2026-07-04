# SSC Firebase hosting deploy (Phase 5 — stub)
# Copies release artifacts to frontend/public/downloads then runs firebase deploy.

param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = "Stop"
Write-Host "deploy_hosting.ps1 — stub for Phase 0. Implement in Phase 5."
Write-Host "Project root: $ProjectRoot"
exit 0