#!/usr/bin/env bash
# Build SSC iOS shell — requires Xcode on macOS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/ios/SuperSecureChat.xcodeproj"
SCHEME="SuperSecureChat"
if [[ ! -d "$PROJECT" ]]; then
  echo "Open ios/SuperSecureChat in Xcode and create project from sources if xcodeproj missing."
  exit 1
fi
xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Release -destination 'generic/platform=iOS' build
echo "iOS build complete."