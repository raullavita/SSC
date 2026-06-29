#!/usr/bin/env bash
# Q.61 — Signed + notarized Mac desktop build (requires Apple Developer creds).
set -euo pipefail
if [[ -z "${APPLE_ID:-}" || -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" || -z "${APPLE_TEAM_ID:-}" ]]; then
  echo "Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID. See scripts/CODE_SIGNING_SETUP.txt"
  exit 1
fi
if [[ -z "${CSC_NAME:-}" && -z "${CSC_LINK:-}" ]]; then
  echo "Set CSC_NAME (Keychain identity) or CSC_LINK (.p12 path)."
  exit 1
fi
export SSC_WIN_VERIFY_UPDATE_SIGNATURE=true
unset CSC_IDENTITY_AUTO_DISCOVERY
exec "$(dirname "$0")/../SSC-BUILD-DESKTOP-MAC.sh"