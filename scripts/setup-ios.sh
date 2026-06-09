#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v pod >/dev/null 2>&1; then
  echo "Install CocoaPods: brew install cocoapods" >&2
  exit 1
fi

if ! xcode-select -p 2>/dev/null | grep -q "Xcode.app"; then
  echo "Full Xcode is required (not Command Line Tools only)." >&2
  echo "Install Xcode, then: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  exit 1
fi

if [[ ! -d ios ]]; then
  npx cap add ios
fi

npx cap sync ios
cd ios/App && pod install
echo "Done. Open with: npm run cap:ios"
