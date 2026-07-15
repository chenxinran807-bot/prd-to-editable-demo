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
  'references/clarification.md'
  'references/execution-contract.md'
  'references/visual-reference.md'
  'references/fidelity-verification.md'
  'schemas/requirements-ir-v2.schema.json'
  'schemas/visual-reference-manifest.schema.json'
  'src/requirements-ir-v2.mjs'
  'src/clarification.mjs'
  'src/execution-baseline.mjs'
  'src/visual-references.mjs'
  'src/fidelity-verifier.mjs'
  'src/capability-controller.mjs'
)
for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "missing standalone core file: $file" >&2
    exit 1
  fi
done

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/prd-to-editable-demo-package.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

# Runtime allowlist. Nothing outside these paths can enter the release archive.
cp 'SKILL.md' "$STAGE/"
for directory in agents bin src references schemas; do
  cp -R "$directory" "$STAGE/$directory"
done
mkdir -p "$STAGE/scripts"
cp 'scripts/browser-e2e.mjs' "$STAGE/scripts/"
node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync("package.json","utf8")); const runtime={name:p.name,version:p.version,type:p.type,private:p.private,bin:p.bin,scripts:{"verify:delivery":"node scripts/browser-e2e.mjs --verify-delivery"}}; fs.writeFileSync(process.argv[1], JSON.stringify(runtime,null,2)+"\n")' "$STAGE/package.json"

(cd "$STAGE" && zip -qr "$OUT" .)

if ! unzip -l "$OUT" | awk '{print $NF}' | grep -qx 'SKILL.md'; then
  echo "Package validation failed: SKILL.md must be at ZIP root" >&2
  exit 1
fi

skill_count="$(unzip -Z1 "$OUT" | awk '/(^|\/)SKILL\.md$/ { count++ } END { print count + 0 }')"
if [[ "$skill_count" != '1' ]]; then
  echo "Package validation failed: archive must contain exactly one SKILL.md" >&2
  exit 1
fi

echo "$OUT"
