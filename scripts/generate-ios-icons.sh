#!/usr/bin/env bash
# Regenerate iOS App Store icon (1024×1024) from public/icon-512.png.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/icon-512.png"
ICONSET="$ROOT/ios/App/App/Assets.xcassets/AppIcon.appiconset"
OUT="$ICONSET/AppIcon-512@2x.png"

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC" >&2
  exit 1
fi

if [[ ! -d "$ICONSET" ]]; then
  echo "Missing $ICONSET — run: npm run ios:setup" >&2
  exit 1
fi

# iOS requires 1024×1024 for the universal App Icon (Xcode 14+).
sips -z 1024 1024 "$SRC" --out "$OUT" >/dev/null

echo "Wrote $OUT"
echo "Rebuild the iOS app in Xcode (or npm run cap:run:ios) to see the new icon."
