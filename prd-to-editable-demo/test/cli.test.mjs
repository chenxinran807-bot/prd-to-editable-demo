import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseArgs } from '../bin/prd-to-editable-demo.mjs';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function blockedInspire(root) {
  const executable = join(root, 'no-visible-skills.mjs');
  writeFileSync(executable, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'skills') console.log(JSON.stringify({ list: [] }));
else if (args[0] === 'whoami') console.log(JSON.stringify({ userId: 'tester' }));
else process.exit(4);
`);
  chmodSync(executable, 0o755);
  return executable;
}

test('accepts an explicit previously-approved Inspire business design Skill', () => {
  const options = parseArgs(['--prd', 'prd.md', '--out', 'out', '--design-skill', 'private:consumer-mobile@5']);
  assert.equal(options.designSkill, 'private:consumer-mobile@5');
});

test('accepts repeatable candidate recovery mappings', () => {
  const options = parseArgs(['--prd', 'prd.md', '--out', 'out', '--resume', 'A=asset-a', '--resume', 'candidate-b=asset-b']);
  assert.deepEqual(options.resumeCandidates, { A: 'asset-a', 'candidate-b': 'asset-b' });
});

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
    'bin/prd-to-editable-demo.mjs', '--prd', 'fixtures/simple-prd.md', '--intent', '快速评审初版，优先速度', '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  for (const name of ['index.html', 'prototype.manifest.json', 'prototype.patches.json', 'agent-comments.json', 'demo-summary.md', 'assumptions.md']) {
    assert.ok(readFileSync(join(out, name), 'utf8').length > 0, `${name} should exist`);
  }
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /让 Agent 修改/);
  assert.match(result.stdout, /index\.html/);
});

test('keeps the internal handoff but blocks professional delivery when no business Skill is visible', () => {
  const root = mkdtempSync(join(tmpdir(), 'editable-demo-route-'));
  const prd = join(root, 'strategy-prd.md');
  const out = join(root, 'output');
  writeFileSync(prd, `# 智能试穿方案\n\n核心流程：形象入口页 → 图片上传页 → 试穿结果页\n\n## 市场调研\n- 行业快速增长。\n\n## 竞品分析\n- 竞品支持上传服饰。\n\n## 方向判断\n- 优先验证转化。\n\n## 产品方案\n- 用户上传照片并试穿。\n`);
  const result = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', prd, '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { ...process.env, INSPIRE_PROTOTYPE_BIN: blockedInspire(root) } });

  assert.equal(result.status, 6, result.stderr);
  assert.match(result.stderr, /少于两个/);
  assert.throws(() => readFileSync(join(out, 'index.html'), 'utf8'));
  const handoff = JSON.parse(readFileSync(join(out, 'specialist-handoff.json'), 'utf8'));
  const evidenceTemplate = JSON.parse(readFileSync(join(out, 'specialist-evidence.template.json'), 'utf8'));
  assert.equal(handoff.routing.selected, 'inspire');
  assert.ok(handoff.requirements.businessObjects.includes('照片'));
  assert.ok(handoff.requirements.userActions.includes('上传'));
  assert.ok(handoff.specialistBaseline.mustPreserve.length >= 3);
  assert.ok(handoff.specialistBaseline.mustPreserve.every(item => handoff.acceptance.includes(item)));
  assert.deepEqual(handoff.routing.stages, ['inspire']);
  assert.deepEqual(handoff.specialistPlan.map(item => item.id), ['semantic-understanding', 'interaction-design', 'visual-quality', 'editable-runtime', 'inspire']);
  assert.ok(handoff.specialistPlan.flatMap(item => item.baseline.mustPreserve).every(criterion => handoff.acceptance.includes(criterion)));
  assert.deepEqual(evidenceTemplate.specialistEvidence.map(item => item.criterion), [...new Set(handoff.specialistPlan.flatMap(item => item.baseline.mustPreserve))]);
  assert.ok(evidenceTemplate.specialistEvidence.every(item => item.evidence === ''));
});

test('resolves repeated specialist asset paths without passing mapper metadata to path.resolve', () => {
  const root = mkdtempSync(join(tmpdir(), 'editable-demo-assets-'));
  const prd = join(root, 'visual-prd.md');
  const asset = join(root, 'checkout-screen.png');
  const out = join(root, 'output');
  writeFileSync(prd, '# 结算页\n\n购物车页 → 确认订单页 → 支付结果页\n\n根据截图生成高保真结算页面。');
  writeFileSync(asset, 'fixture');
  const result = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', prd, '--asset', asset, '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { ...process.env, INSPIRE_PROTOTYPE_BIN: blockedInspire(root) } });

  assert.equal(result.status, 6, result.stderr);
  const handoff = JSON.parse(readFileSync(join(out, 'specialist-handoff.json'), 'utf8'));
  assert.deepEqual(handoff.inputs.assets, [asset]);
  assert.equal(handoff.routing.selected, 'inspire');
  assert.deepEqual(handoff.routing.stages, ['inspire']);
});

test('uses agent-produced semantic IR instead of heuristic dictionaries for specialist handoff', () => {
  const root = mkdtempSync(join(tmpdir(), 'semantic-handoff-'));
  const prd = join(root, 'prd.md');
  const requirements = join(root, 'requirements.json');
  const out = join(root, 'output');
  writeFileSync(prd, '# 量子样品舱\n研究员提交样品，舱主审核后分配舱位。');
  writeFileSync(requirements, JSON.stringify({
    schemaVersion: 1, extractionMode: 'model-semantic', confidence: 'high',
    title: '量子样品舱', actor: '研究员', goal: '获得样品舱位',
    businessObjects: ['样品', '舱位'], userActions: ['提交', '审核', '分配'], states: ['待审核', '已分配'],
    screens: ['样品提交', '舱位审核', '分配结果'],
    transitions: [{ from: '样品提交', action: '提交', to: '舱位审核', evidence: '研究员提交样品' }],
    evidence: [
      { kind: 'actor', term: '研究员', quote: '研究员提交样品' },
      { kind: 'business-object', term: '样品', quote: '研究员提交样品' },
      { kind: 'business-object', term: '舱位', quote: '分配舱位' },
      { kind: 'user-action', term: '提交', quote: '研究员提交样品' },
      { kind: 'user-action', term: '审核', quote: '舱主审核' },
      { kind: 'user-action', term: '分配', quote: '分配舱位' }
    ], assumptions: [], gaps: []
  }));
  const result = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements', requirements, '--intent', '高保真原型', '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { ...process.env, INSPIRE_PROTOTYPE_BIN: blockedInspire(root) } });

  assert.equal(result.status, 6, result.stderr);
  const handoff = JSON.parse(readFileSync(join(out, 'specialist-handoff.json'), 'utf8'));
  assert.equal(handoff.requirements.extractionMode, 'model-semantic');
  assert.deepEqual(handoff.requirements.screens, ['样品提交', '舱位审核', '分配结果']);
  assert.deepEqual(handoff.auditRequirements.actions, ['提交', '审核', '分配']);
  assert.deepEqual(handoff.auditRequirements.states, ['待审核', '已分配']);
  assert.deepEqual(handoff.auditRequirements.screens, ['样品提交', '舱位审核', '分配结果']);
  assert.deepEqual(handoff.auditRequirements.frozenTasks[0].observableOutcome, {
    kind: 'destination-content', value: '舱位审核', urlChangeAloneIsInsufficient: true
  });
});

test('uses semantic screens and transitions on the local editable path', () => {
  const root = mkdtempSync(join(tmpdir(), 'semantic-local-'));
  const prd = join(root, 'prd.md');
  const requirements = join(root, 'requirements.json');
  const out = join(root, 'output');
  writeFileSync(prd, '# 古籍修复预约\n访客提交古籍信息，馆员确认后生成送修凭证。');
  writeFileSync(requirements, JSON.stringify({
    schemaVersion: 1, extractionMode: 'model-semantic', confidence: 'high',
    title: '古籍修复预约', actor: '访客', goal: '获得送修凭证',
    businessObjects: ['古籍信息', '送修凭证'], userActions: ['提交', '确认'], states: ['待确认', '已确认'],
    screens: ['古籍信息提交', '馆员确认', '送修凭证'],
    transitions: [
      { from: '古籍信息提交', action: '提交', to: '馆员确认', evidence: '访客提交古籍信息' },
      { from: '馆员确认', action: '确认', to: '送修凭证', evidence: '馆员确认后生成送修凭证' }
    ],
    evidence: [
      { kind: 'business-object', term: '古籍信息', quote: '访客提交古籍信息' },
      { kind: 'business-object', term: '送修凭证', quote: '生成送修凭证' },
      { kind: 'user-action', term: '提交', quote: '访客提交古籍信息' },
      { kind: 'user-action', term: '确认', quote: '馆员确认' }
    ], assumptions: [], gaps: []
  }));
  const result = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements', requirements, '--intent', '快速评审初版，优先速度', '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(readFileSync(join(out, 'prototype.manifest.json'), 'utf8'));
  assert.deepEqual(manifest.pages.map(page => page.title), ['古籍信息提交', '馆员确认', '送修凭证']);
  assert.equal(manifest.requirements.extractionMode, 'model-semantic');
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

test('professional handoff forbids silent downgrade and fast review is marked non-formal', () => {
  const professionalRoot = mkdtempSync(join(tmpdir(), 'professional-mode-'));
  writeFileSync(join(professionalRoot, 'prd.md'), '# 专业原型\n申请入口页 → 申请提交页 → 申请结果页\n用户提交申请并查看结果。');
  const professional = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', join(professionalRoot, 'prd.md'), '--intent', '原生高保真', '--out', join(professionalRoot, 'out')
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { ...process.env, INSPIRE_PROTOTYPE_BIN: blockedInspire(professionalRoot) } });
  assert.equal(professional.status, 6, professional.stderr);
  const handoff = JSON.parse(readFileSync(join(professionalRoot, 'out', 'specialist-handoff.json'), 'utf8'));
  assert.deepEqual(handoff.qualityAssurance, {
    mode: 'professional', finalContainer: 'inspire', silentDowngradeAllowed: false, readiness: 'preflight-required'
  });

  const fastRoot = mkdtempSync(join(tmpdir(), 'fast-mode-'));
  writeFileSync(join(fastRoot, 'prd.md'), '# 快速评审\n用户提交申请并查看结果。');
  const fast = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', join(fastRoot, 'prd.md'), '--intent', '快速评审初版，优先速度', '--out', join(fastRoot, 'out')
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(fast.status, 0, fast.stderr);
  const manifest = JSON.parse(readFileSync(join(fastRoot, 'out', 'prototype.manifest.json'), 'utf8'));
  assert.deepEqual(manifest.delivery, { mode: 'fast-review', formal: false });
});

test('professional mode blocks empty heuristic screens and transitions before Inspire', () => {
  const root = mkdtempSync(join(tmpdir(), 'empty-semantic-professional-'));
  const prd = join(root, 'prd.md');
  const out = join(root, 'out');
  writeFileSync(prd, '# 电商创新方案\n用户可以发现商品并完成转化。');
  const result = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', prd, '--intent', '原生高保真', '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

  assert.equal(result.status, 4, result.stderr);
  assert.throws(() => readFileSync(join(out, 'specialist-handoff.json'), 'utf8'));
  const blocker = JSON.parse(readFileSync(join(out, 'requirements-blocker.json'), 'utf8'));
  assert.equal(blocker.status, 'semantic-requirements-required');
  assert.deepEqual(blocker.missing, ['screens', 'transitions']);
});
