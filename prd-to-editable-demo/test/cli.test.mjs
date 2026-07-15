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
  assert.match(result.stderr, /--requirements-v2/);
  assert.match(result.stderr, /--confirmations/);
  assert.match(result.stderr, /--visual-references/);
});

function writeV2Fixture(root, { blockers = [], background = true } = {}) {
  const source = `# Workflow\n\nPeople submit a request.\n\n${background ? 'Internal research context must not appear in the interface.' : 'The result must be visible.'}`;
  const prd = join(root, 'prd.md');
  const requirements = join(root, 'requirements-v2.json');
  writeFileSync(prd, source);
  writeFileSync(requirements, JSON.stringify({
    schemaVersion: 2,
    sourceUnits: [
      { id: 's1', purpose: 'product_requirement', certainty: 'explicit', quote: 'People submit a request.' },
      { id: 's2', purpose: background ? 'business_context' : 'product_requirement', certainty: 'explicit', quote: background ? 'Internal research context must not appear in the interface.' : 'The result must be visible.' }
    ],
    sourceCoverage: [
      { quote: 'People submit a request.', sourceIds: ['s1'] },
      { quote: background ? 'Internal research context must not appear in the interface.' : 'The result must be visible.', sourceIds: ['s2'] }
    ],
    requirements: [
      { id: 'r1', text: 'Submit request', exactCopy: 'Submit exactly', componentType: 'button', state: 'ready', visibleState: 'enabled', acceptanceCriteria: ['Submission is reachable'], certainty: 'explicit', targetIds: ['primary'], sourceIds: ['s1'], uiEligible: true, taxonomyIds: [] },
      { id: 'r2', text: background ? 'Internal research context must not appear in the interface.' : 'Show result', acceptanceCriteria: [], certainty: 'explicit', targetIds: background ? [] : ['main'], sourceIds: ['s2'], uiEligible: !background, taxonomyIds: [] }
    ], taxonomy: [],
    pages: [{ id: 'main', name: 'Request', regionIds: ['primary'] }],
    regions: [{ id: 'primary', pageId: 'main', name: 'Primary' }],
    actions: [{ id: 'submit', name: 'Submit', trigger: 'activate submit', visibleFeedback: 'submitted state appears', stateChange: 'request becomes submitted', fromPageId: 'main', toPageId: 'main', regionId: 'primary', requirementIds: ['r1'] }],
    coreJourneys: [{ id: 'journey', name: 'Submit', actionIds: ['submit'], startPageId: 'main', expectedEndPageId: 'main' }],
    blockers
  }));
  return { prd, requirements };
}

test('v2 blocker removes stale output and emits a bounded clarification artifact', () => {
  const root = mkdtempSync(join(tmpdir(), 'v2-blocker-'));
  const { prd, requirements } = writeV2Fixture(root, { blockers: [
    { id: 'b1', text: 'Choose persistence behavior', certainty: 'missing', sourceIds: [], requirementId: 'r1' },
    { id: 'b2', text: 'Choose retry behavior', certainty: 'missing', sourceIds: [], requirementId: 'r1' },
    { id: 'b3', text: 'Choose completion behavior', certainty: 'missing', sourceIds: [], requirementId: 'r1' },
    { id: 'b4', text: 'Choose cancellation behavior', certainty: 'missing', sourceIds: [], requirementId: 'r1' }
  ] });
  const out = join(root, 'out'); mkdirSync(out); writeFileSync(join(out, 'index.html'), 'stale');
  const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', requirements, '--out', out], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 5, result.stderr);
  assert.throws(() => readFileSync(join(out, 'index.html'), 'utf8'));
  const blocker = JSON.parse(readFileSync(join(out, 'clarification-required.json'), 'utf8'));
  assert.equal(blocker.status, 'clarification-required');
  assert.equal(blocker.turn.questions.length, 3);
  assert.equal(blocker.remaining, 4);
  assert.equal(JSON.stringify(blocker).includes('sourceCoverage'), false);
});

test('confirmed v2 local generation writes fidelity artifacts and excludes background copy', () => {
  const root = mkdtempSync(join(tmpdir(), 'v2-local-'));
  const { prd, requirements } = writeV2Fixture(root);
  const out = join(root, 'out');
  const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', requirements, '--intent', '快速评审初版，优先速度', '--out', out], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  for (const name of ['prd-source-map.json', 'requirements-ir.json', 'page-flow-graph.json', 'visual-reference-manifest.json', 'confirmation-record.json', 'requirements-baseline.json', 'traceability-matrix.json', 'fidelity-report.md']) assert.ok(readFileSync(join(out, name), 'utf8').length);
  const manifest = JSON.parse(readFileSync(join(out, 'prototype.manifest.json'), 'utf8'));
  assert.ok(manifest.executionBaseline);
  assert.equal(manifest.pages.flatMap(page => page.elements).some(element => /Internal research context/.test(element.text)), false);
  assert.match(readFileSync(join(out, 'fidelity-report.md'), 'utf8'), /passed/);
  assert.match(readFileSync(join(out, 'fidelity-report.md'), 'utf8'), /requirements/);
});

test('rejects malformed confirmations and visual references as arrays', () => {
  for (const [flag, name, value] of [
    ['--confirmations', 'confirmations', {}], ['--confirmations', 'confirmations', null],
    ['--confirmations', 'confirmations', 'invalid'], ['--visual-references', 'visual references', {}],
    ['--visual-references', 'visual references', null]
  ]) {
    const root = mkdtempSync(join(tmpdir(), 'v2-malformed-'));
    const { prd, requirements } = writeV2Fixture(root);
    const input = join(root, 'input.json'); writeFileSync(input, JSON.stringify(value));
    const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', requirements, flag, input, '--out', join(root, 'out')], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`${name}.*array`, 'i'));
  }
});

test('v2 professional handoff carries the frozen baseline and visual contracts', () => {
  const root = mkdtempSync(join(tmpdir(), 'v2-handoff-'));
  const { prd, requirements } = writeV2Fixture(root);
  const visuals = join(root, 'visuals.json');
  writeFileSync(visuals, JSON.stringify([{ id: 'ref-1', asset: 'screen.png', scope: { pageId: 'main', regionId: 'primary' }, bindings: [{ property: 'layout', fidelity: 'high' }], exclude: [] }]));
  const out = join(root, 'out');
  const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', requirements, '--visual-references', visuals, '--intent', '原生高保真', '--out', out], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 3, result.stderr);
  const handoff = JSON.parse(readFileSync(join(out, 'specialist-handoff.json'), 'utf8'));
  assert.equal(handoff.executionBaseline.pages[0].visualReferences[0].id, 'ref-1');
  assert.equal(handoff.visualReferences[0].bindings[0].fidelity, 'high');
  assert.equal(handoff.fidelity, undefined);
});

test('fidelity artifacts use the actual subjective-review verification result', () => {
  const root = mkdtempSync(join(tmpdir(), 'v2-review-'));
  const { prd, requirements } = writeV2Fixture(root);
  const visuals = join(root, 'visuals.json');
  writeFileSync(visuals, JSON.stringify([{ id: 'ref-1', asset: 'screen.png', scope: { pageId: 'main', regionId: 'primary' }, bindings: [{ property: 'layout', fidelity: 'high' }], exclude: [] }]));
  const out = join(root, 'out');
  const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', requirements, '--visual-references', visuals, '--intent', '快速评审初版，优先速度', '--out', out], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = readFileSync(join(out, 'fidelity-report.md'), 'utf8');
  const matrix = JSON.parse(readFileSync(join(out, 'traceability-matrix.json'), 'utf8'));
  assert.match(report, /Status: review-required/);
  assert.match(report, /visual references.*subjective review required/i);
  assert.equal(matrix.status, 'review-required');
  assert.equal(matrix.checks.find(check => check.name === 'visual references').reviewRequired, true);
  assert.ok(matrix.traceability.some(item => item.kind === 'visual-reference' && item.id === 'ref-1'));
});

test('confirmations update only the blocker-linked requirements', () => {
  const root = mkdtempSync(join(tmpdir(), 'v2-links-'));
  const { prd, requirements } = writeV2Fixture(root, { blockers: [
    { id: 'b1', text: 'Confirm submit', certainty: 'missing', sourceIds: [], requirementId: 'r1' },
    { id: 'b2', text: 'Confirm context', certainty: 'missing', sourceIds: [], requirementId: 'r2' }
  ] });
  const confirmations = join(root, 'confirmations.json');
  writeFileSync(confirmations, JSON.stringify([{ blockerId: 'b1', answer: 'yes', answeredAt: 'now' }]));
  const first = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', requirements, '--confirmations', confirmations, '--out', join(root, 'blocked')], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(first.status, 5, first.stderr);
  const turn = JSON.parse(readFileSync(join(root, 'blocked', 'clarification-required.json'), 'utf8')).turn;
  assert.equal(turn.questions[0].requirementId, 'r2');
  writeFileSync(confirmations, JSON.stringify([
    { blockerId: 'b1', answer: 'yes', answeredAt: 'now' }, { blockerId: 'b2', answer: 'no', answeredAt: 'later' }
  ]));
  const out = join(root, 'out');
  const second = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', requirements, '--confirmations', confirmations, '--intent', '快速评审初版，优先速度', '--out', out], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(second.status, 0, second.stderr);
  const ir = JSON.parse(readFileSync(join(out, 'requirements-ir.json'), 'utf8'));
  assert.deepEqual(ir.requirements.find(item => item.id === 'r1').confirmations.map(item => item.blockerId), ['b1']);
  assert.deepEqual(ir.requirements.find(item => item.id === 'r2').confirmations.map(item => item.blockerId), ['b2']);
});

test('rejects dangerous output paths without touching inputs or the package', () => {
  const packageDir = new URL('..', import.meta.url);
  for (const kind of ['root', 'package', 'input-parent', 'input-file']) {
    const root = mkdtempSync(join(tmpdir(), 'v2-path-'));
    const { prd, requirements } = writeV2Fixture(root);
    const before = readFileSync(requirements, 'utf8');
    const out = kind === 'root' ? '/' : kind === 'package' ? packageDir.pathname : kind === 'input-parent' ? root : requirements;
    const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', requirements, '--out', out], { cwd: packageDir, encoding: 'utf8' });
    assert.equal(result.status, 1, `${kind}: ${result.stderr}`);
    assert.match(result.stderr, /Unsafe output path/i);
    assert.equal(readFileSync(requirements, 'utf8'), before);
  }
});

test('allows a safe output below multiple nonexistent parent directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'v2-nested-'));
  const { prd, requirements } = writeV2Fixture(root);
  const out = join(root, 'new-parent', 'new-child', 'output');
  const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', requirements, '--intent', '快速评审初版，优先速度', '--out', out], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(readFileSync(join(out, 'index.html'), 'utf8').length > 0);
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

test('stops at a specialist handoff instead of generating a misleading local demo', () => {
  const root = mkdtempSync(join(tmpdir(), 'editable-demo-route-'));
  const prd = join(root, 'strategy-prd.md');
  const out = join(root, 'output');
  writeFileSync(prd, `# 智能试穿方案\n\n核心流程：形象入口页 → 图片上传页 → 试穿结果页\n\n## 市场调研\n- 行业快速增长。\n\n## 竞品分析\n- 竞品支持上传服饰。\n\n## 方向判断\n- 优先验证转化。\n\n## 产品方案\n- 用户上传照片并试穿。\n`);
  const result = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', prd, '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

  assert.equal(result.status, 3, result.stderr);
  assert.match(result.stderr, /inspire/);
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
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

  assert.equal(result.status, 3, result.stderr);
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
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

  assert.equal(result.status, 3, result.stderr);
  const handoff = JSON.parse(readFileSync(join(out, 'specialist-handoff.json'), 'utf8'));
  assert.equal(handoff.requirements.extractionMode, 'model-semantic');
  assert.deepEqual(handoff.requirements.screens, ['样品提交', '舱位审核', '分配结果']);
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
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(professional.status, 3, professional.stderr);
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
