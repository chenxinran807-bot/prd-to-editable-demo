#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/dist/prd-to-editable-demo-skill.zip}"
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

cd "$ROOT"
required_files=(
  'SKILL.md'
  'references/requirements-ir.md'
  'references/capability-policy.md'
  'references/interaction-design.md'
  'references/visual-quality.md'
  'references/quality-gates.md'
  'src/capability-controller.mjs'
)
for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "missing standalone core file: $file" >&2
    exit 1
  fi
done

zip -qr "$OUT" . \
  -x 'node_modules/*' \
  -x 'dist/*' \
  -x '.git/*'

if ! unzip -l "$OUT" | awk '{print $NF}' | grep -qx 'SKILL.md'; then
  echo "Package validation failed: SKILL.md must be at ZIP root" >&2
  exit 1
fi

echo "$OUT"
