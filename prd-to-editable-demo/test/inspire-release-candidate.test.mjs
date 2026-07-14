import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../inspire-business-skill-release/candidate/', import.meta.url);

test('release candidate is explicitly scoped and safe for Builder', async () => {
  const files = ['SKILL.md', 'references/foundations.md', 'references/components.md', 'references/scenarios.md', 'references/review.md'];
  const content = (await Promise.all(files.map(file => readFile(new URL(file, root), 'utf8')))).join('\n');
  assert.match(content, /name: douyin-mall-independent-app-prototype-guidance/);
  assert.match(content, /category: design-system/);
  assert.match(content, /not an official Douyin brand design system/i);
  assert.doesNotMatch(content, /\p{Extended_Pictographic}/u);
  assert.doesNotMatch(content, /https?:\/\/(?:picsum|placehold|unsplash)/i);
  assert.doesNotMatch(content, /\/Users\/|node_modules|npm install|pnpm add/);
});

test('release candidate keeps maintainer evidence outside package files', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(pkg.version, '0.1.2');
  assert.deepEqual(pkg.files, ['SKILL.md', 'references/']);
  const evidence = await readdir(new URL('_meta/', root));
  for (const file of ['identify-report.md', 'source-authority-map.md', 'validation-report.md', 'handoff-notes.md', 'e2e-artifacts.md']) {
    assert.ok(evidence.includes(file), `missing ${file}`);
  }
});
