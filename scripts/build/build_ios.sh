#!/usr/bin/env bash
# Q.63 — Build SSC iOS shell (requires macOS + Xcode).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/frontend"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: iOS builds require macOS and Xcode."
  echo "See scripts/APP_STORE_SETUP.txt"
  exit 1
fi

echo "== Building React bundle for iOS =="
yarn build:firebase

echo "== Capacitor sync iOS =="
yarn cap sync ios

echo ""
echo "DONE — open Xcode workspace:"
echo "  open ios/App/App.xcworkspace"
echo ""
echo "Then: select Team → Product → Archive → Distribute (TestFlight / App Store)"
echo "Guide: scripts/APP_STORE_SETUP.txt"