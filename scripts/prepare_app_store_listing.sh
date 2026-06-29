#!/usr/bin/env bash
# Q.63 — Validate App Store listing assets (run on Mac).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GRAPHICS="$ROOT/app-store/store_graphics"

echo "=== SSC App Store listing prep (Q.63) ==="

ok=true
for rel in \
  "app-store/LISTING_COPY.md" \
  "app-store/PRIVACY_NUTRITION.json" \
  "app-store/GRAPHICS_CHECKLIST.md" \
  "scripts/APP_STORE_SETUP.txt" \
  "SSC-BUILD-IOS.sh" \
  "frontend/ios/App/App/Info.plist"
do
  if [[ -f "$ROOT/$rel" ]]; then
    echo "OK: $rel"
  else
    echo "MISSING: $rel"
    ok=false
  fi
done

if [[ -f "$GRAPHICS/icon-1024.png" ]]; then
  echo "OK: App Store icon"
else
  echo "PENDING: app-store/store_graphics/icon-1024.png"
fi

if [[ "$(uname -s)" == "Darwin" ]] && [[ -d "$ROOT/frontend/ios/App/App.xcworkspace" ]]; then
  echo "OK: Xcode workspace present"
else
  echo "NOTE: Xcode workspace — run SSC-BUILD-IOS.sh on Mac"
fi

echo ""
echo "Founder guide: scripts/APP_STORE_SETUP.txt"
$ok || exit 1