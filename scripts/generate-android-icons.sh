#!/usr/bin/env bash
# Regenerate Android launcher icons from public/icon-512.png (Venzio brand).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/icon-512.png"
RES="$ROOT/android/app/src/main/res"

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC" >&2
  exit 1
fi

gen() {
  local size="$1"
  local out="$2"
  sips -z "$size" "$size" "$SRC" --out "$out" >/dev/null
}

DENSITIES=(mdpi:48:108 hdpi:72:162 xhdpi:96:216 xxhdpi:144:324 xxxhdpi:192:432)

for entry in "${DENSITIES[@]}"; do
  IFS=':' read -r dpi launcher fg <<<"$entry"
  dir="$RES/mipmap-$dpi"
  mkdir -p "$dir"
  gen "$launcher" "$dir/ic_launcher.png"
  gen "$launcher" "$dir/ic_launcher_round.png"
  gen "$fg" "$dir/ic_launcher_foreground.png"
  echo "wrote mipmap-$dpi"
done

echo "Done. Rebuild APK: npm run cap:build:android:debug"
