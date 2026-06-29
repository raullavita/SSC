#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/frontend"
echo "== Building React bundle for desktop =="
yarn build:desktop
cd desktop
echo "== Installing desktop dependencies =="
yarn install
echo "== Building Mac dmg (requires macOS) =="
if [ -z "${CSC_LINK:-}" ] && [ -z "${CSC_NAME:-}" ]; then
  export CSC_IDENTITY_AUTO_DISCOVERY=false
else
  echo "Signing enabled: CSC_LINK or CSC_NAME is set"
  unset CSC_IDENTITY_AUTO_DISCOVERY
fi
yarn build:mac
echo ""
echo "DONE: frontend/desktop/dist/SSC-1.0.0-*.dmg"