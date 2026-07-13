import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('prints usage when required arguments are missing', () => {
  const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--prd <path>/);
  assert.match(result.stderr, /--out <directory>/);
});

test('generates the complete editable demo deliverable', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'editable-demo-')), 'output');
  const result = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', 'fixtures/simple-prd.md', '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  for (const name of ['index.html', 'prototype.manifest.json', 'prototype.patches.json', 'agent-comments.json', 'demo-summary.md', 'assumptions.md']) {
    assert.ok(readFileSync(join(out, name), 'utf8').length > 0, `${name} should exist`);
  }
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /让 Agent 修改/);
  assert.match(result.stdout, /index\.html/);
});

test('stops at a specialist handoff instead of generating a misleading local demo', () => {
  const root = mkdtempSync(join(tmpdir(), 'editable-demo-route-'));
  const prd = join(root, 'strategy-prd.md');
  const out = join(root, 'output');
  writeFileSync(prd, `# 智能试穿方案\n\n## 市场调研\n- 行业快速增长。\n\n## 竞品分析\n- 竞品支持上传服饰。\n\n## 方向判断\n- 优先验证转化。\n\n## 产品方案\n- 用户上传照片并试穿。\n`);
  const result = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', prd, '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

  assert.equal(result.status, 3, result.stderr);
  assert.match(result.stderr, /prd-generator/);
  assert.match(result.stderr, /inspire/);
  assert.throws(() => readFileSync(join(out, 'index.html'), 'utf8'));
  const handoff = JSON.parse(readFileSync(join(out, 'specialist-handoff.json'), 'utf8'));
  const evidenceTemplate = JSON.parse(readFileSync(join(out, 'specialist-evidence.template.json'), 'utf8'));
  assert.equal(handoff.routing.selected, 'inspire');
  assert.ok(handoff.requirements.businessObjects.includes('照片'));
  assert.ok(handoff.requirements.userActions.includes('上传'));
  assert.ok(handoff.specialistBaseline.mustPreserve.length >= 3);
  assert.ok(handoff.specialistBaseline.mustPreserve.every(item => handoff.acceptance.includes(item)));
  assert.deepEqual(handoff.routing.stages, ['prd-generator', 'inspire']);
  assert.deepEqual(handoff.specialistPlan.map(item => item.id), ['prd-generator', 'inspire']);
  assert.ok(handoff.specialistPlan.flatMap(item => item.baseline.mustPreserve).every(criterion => handoff.acceptance.includes(criterion)));
  assert.deepEqual(evidenceTemplate.specialistEvidence.map(item => item.criterion), [...new Set(handoff.specialistPlan.flatMap(item => item.baseline.mustPreserve))]);
  assert.ok(evidenceTemplate.specialistEvidence.every(item => item.evidence === ''));
});

test('resolves repeated specialist asset paths without passing mapper metadata to path.resolve', () => {
  const root = mkdtempSync(join(tmpdir(), 'editable-demo-assets-'));
  const prd = join(root, 'visual-prd.md');
  const asset = join(root, 'checkout-screen.png');
  const out = join(root, 'output');
  writeFileSync(prd, '# 结算页\n\n根据截图生成高保真结算页面。');
  writeFileSync(asset, 'fixture');
  const result = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', prd, '--asset', asset, '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

  assert.equal(result.status, 3, result.stderr);
  const handoff = JSON.parse(readFileSync(join(out, 'specialist-handoff.json'), 'utf8'));
  assert.deepEqual(handoff.inputs.assets, [asset]);
  assert.equal(handoff.routing.selected, 'inspire');
  assert.deepEqual(handoff.routing.stages, ['pm-kakaxi', 'inspire']);
});

test('finalizes a specialist bundle through the public CLI', () => {
  const root = mkdtempSync(join(tmpdir(), 'specialist-cli-'));
  const source = join(root, 'source');
  const out = join(root, 'output');
  const handoff = join(root, 'handoff.json');
  mkdirSync(source, { recursive: true });
  writeFileSync(join(source, 'index.html'), '<!doctype html><html><body><button>专业按钮</button></body></html>');
  writeFileSync(handoff, JSON.stringify({ routing: { selected: 'figma-flow' }, requirements: { title: '活动页' } }));
  const result = spawnSync(process.execPath, [
    'bin/finalize-specialist.mjs', '--source', source, '--handoff', handoff, '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(out, 'index.html'), 'utf8'), /编辑原型/);
  assert.match(result.stdout, /index\.html/);
});
