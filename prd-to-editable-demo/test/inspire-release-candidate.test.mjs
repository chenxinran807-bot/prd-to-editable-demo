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
  assert.equal(pkg.version, '0.1.3');
  assert.deepEqual(pkg.files, ['SKILL.md', 'references/']);
  const evidence = await readdir(new URL('_meta/', root));
  for (const file of ['identify-report.md', 'source-authority-map.md', 'figma-source-manifest.json', 'validation-report.md', 'handoff-notes.md', 'e2e-artifacts.md']) {
    assert.ok(evidence.includes(file), `missing ${file}`);
  }
});

test('Figma evidence manifest is machine-readable and restricted to the selected source', async () => {
  const manifest = JSON.parse(await readFile(new URL('_meta/figma-source-manifest.json', root), 'utf8'));
  assert.equal(manifest.source.fileKey, 'NpDitVIlL1oNuZ3gJMTgM2');
  assert.equal(manifest.source.nodeId, '71:4907');
  assert.equal(manifest.source.name, '【独立端】AI试穿');
  assert.equal(manifest.packaging.includeScreenshots, false);
  assert.ok(manifest.evidence.length >= 5);
  assert.ok(manifest.evidence.every(item => item.rule && item.nodes?.length));
});

test('release candidate is grounded in the owner-selected AI try-on Figma source', async () => {
  const [components, scenarios, authority] = await Promise.all([
    readFile(new URL('references/components.md', root), 'utf8'),
    readFile(new URL('references/scenarios.md', root), 'utf8'),
    readFile(new URL('_meta/source-authority-map.md', root), 'utf8')
  ]);
  assert.match(authority, /NpDitVIlL1oNuZ3gJMTgM2/);
  assert.match(authority, /71:4907/);
  assert.doesNotMatch(authority, /H2hzy9QGoK31fNWOtLg3Gd|激励改版/);
  for (const pattern of ['穿搭', '双列', '骨架屏', '错误', '上滑加载', '试衣间']) {
    assert.match(`${components}\n${scenarios}`, new RegExp(pattern));
  }
  assert.match(components, /375[^\n]*812/);
  assert.match(components, /商品卡[^\n]*(?:2|两)[^\n]*(?:倾斜|叠放)/);
});
