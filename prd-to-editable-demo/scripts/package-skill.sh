#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/dist/prd-to-editable-demo-skill.zip}"
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

cd "$ROOT"
zip -qr "$OUT" . \
  -x 'node_modules/*' \
  -x 'dist/*' \
  -x '.git/*'

if ! unzip -l "$OUT" | awk '{print $NF}' | grep -qx 'SKILL.md'; then
  echo "Package validation failed: SKILL.md must be at ZIP root" >&2
  exit 1
fi

echo "$OUT"
