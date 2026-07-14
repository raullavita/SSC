# Close GitHub issue #59 — LinkedDevicesPanel wiring (completed on main, Step 15).
# Requires: gh auth login  OR  GH_TOKEN with repo scope.
$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "Install GitHub CLI: https://cli.github.com/"
}

$comment = @"
Completed on main (Step 15, Jul 2026):

- LinkedDevicesPanel + DeviceLinkQr wired into DeviceLink.jsx (/link-device)
- Settings Advanced and ChatHome sidebar link to linked devices
- QR generation, expiry countdown, device list, revoke flow
- Tests: DeviceLink.test.js, LinkedDevicesPanel.test.js (12 passing)

Knip concern resolved — components are used in production, not test-only.
Closing — no further contributor work needed.
"@

Write-Host "Closing issue #59..."
gh issue close 59 --repo raullavita/SSC --comment $comment
gh issue edit 59 --repo raullavita/SSC --remove-assignee tripathi2003 2>$null
Write-Host "Issue #59 closed."