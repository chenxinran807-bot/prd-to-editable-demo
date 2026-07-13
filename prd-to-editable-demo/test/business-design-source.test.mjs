import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../inspire-business-skill/', import.meta.url);

async function loadSource() {
  const [skill, tokens, components, negatives, references, iconFiles] = await Promise.all([
    readFile(new URL('SKILL.md', root), 'utf8'),
    readFile(new URL('design-tokens.json', root), 'utf8'),
    readFile(new URL('components.md', root), 'utf8'),
    readFile(new URL('negative-rules.md', root), 'utf8'),
    readFile(new URL('references.json', root), 'utf8'),
    readdir(new URL('icons/', root))
  ]);
  return {
    text: [skill, tokens, components, negatives].join('\n'),
    tokens: JSON.parse(tokens), references: JSON.parse(references),
    components: new Set([...components.matchAll(/^## component: ([a-z0-9-]+)$/gm)].map(match => match[1])),
    iconFiles: iconFiles.filter(file => file.endsWith('.svg'))
  };
}

const emoji = /\p{Extended_Pictographic}/gu;

test('business design source has no Emoji and every icon has provenance', async () => {
  const source = await loadSource();
  assert.deepEqual(source.text.match(emoji) ?? [], []);
  assert.ok(source.iconFiles.length >= 12);
  const icons = source.references.icons;
  assert.equal(icons.length, source.iconFiles.length);
  for (const file of source.iconFiles) {
    const record = icons.find(icon => icon.file === `icons/${file}`);
    assert.ok(record, `missing provenance for ${file}`);
    assert.ok(record.source);
    assert.ok(record.license);
    assert.ok(record.role);
  }
});

test('covers required native mobile component families and token groups', async () => {
  const source = await loadSource();
  for (const family of ['top-bar', 'bottom-nav', 'product-card', 'primary-button', 'dialog', 'bottom-sheet', 'state-feedback']) {
    assert.ok(source.components.has(family), `missing ${family}`);
  }
  for (const group of ['color', 'typography', 'spacing', 'radius', 'shadow', 'motion', 'touch']) {
    assert.ok(source.tokens[group], `missing token group ${group}`);
  }
});

test('records accepted visual references and blocks publication on missing brand assets', async () => {
  const source = await loadSource();
  assert.ok(source.references.visualReferences.filter(item => item.status === 'accepted').length >= 3);
  assert.equal(source.references.publicationGate.status, 'blocked');
  assert.ok(source.references.publicationGate.missing.some(item => /brand/i.test(item)));
});

test('every SVG is self-contained and does not embed text or external URLs', async () => {
  const files = await readdir(new URL('icons/', root));
  for (const file of files.filter(name => name.endsWith('.svg'))) {
    const svg = await readFile(new URL(`icons/${file}`, root), 'utf8');
    assert.match(svg, /^<svg[\s\S]*<\/svg>\s*$/);
    assert.doesNotMatch(svg, /<text\b|<(?:image|script|use)\b[^>]+(?:href|src)\s*=|url\s*\(|data:/i);
    assert.match(svg, /currentColor/);
  }
});
