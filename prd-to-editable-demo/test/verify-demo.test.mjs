import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyDemo } from '../src/verify-demo.mjs';
import { renderDemo } from '../src/render-demo.mjs';

test('rejects an HTML artifact without editor capabilities', () => {
  assert.throws(() => verifyDemo({ html: '<!doctype html><main></main>', manifest: { startPage: 'home', pages: [{ id: 'home', elements: [] }] } }), /embedded manifest/);
});

test('rejects a demo that replaces PRD actions with generic placeholders', () => {
  const manifest = {
    id: 'restock', product: { name: '补货提醒', goal: '创建补货单' }, persona: { name: '店长', need: '补货' },
    startPage: 'home', assumptions: [], gaps: [],
    requirements: { actor: '店长', goal: '创建补货单', businessObjects: ['库存', '补货单'], userActions: ['创建', '提交'], states: [] },
    traceability: [{ kind: 'user-action', term: '创建', evidence: '点击创建补货单' }],
    pages: [{ id: 'home', title: '库存列表', state: 'default', elements: [
      { key: 'home.title', type: 'heading', text: '库存列表' },
      { key: 'home.next', type: 'button', text: '继续', action: { type: 'navigate', target: 'home' } }
    ] }]
  };

  assert.throws(() => verifyDemo({ html: renderDemo(manifest), manifest }), /generic action copy/);
});

test('rejects a demo that drops all business objects from the experience', () => {
  const manifest = {
    id: 'review', product: { name: '工作台', goal: '完成任务' }, persona: { name: '运营', need: '完成任务' },
    startPage: 'home', assumptions: [], gaps: [],
    requirements: { actor: '运营', goal: '提交审核', businessObjects: ['审核单'], userActions: ['提交'], states: [] },
    traceability: [{ kind: 'business-object', term: '审核单', evidence: '查看审核单' }],
    pages: [{ id: 'home', title: '工作台', state: 'default', elements: [
      { key: 'home.title', type: 'heading', text: '工作台' },
      { key: 'home.submit', type: 'button', text: '提交', action: { type: 'navigate', target: 'home' } }
    ] }]
  };

  assert.throws(() => verifyDemo({ html: renderDemo(manifest), manifest }), /business object coverage/);
});

test('rejects a demo that recognizes a declared state but never renders it', () => {
  const manifest = {
    id: 'save', product: { name: '排班', goal: '保存排班表' }, persona: { name: '主管', need: '排班' },
    startPage: 'home', assumptions: [], gaps: [],
    requirements: { actor: '主管', goal: '保存排班表', businessObjects: ['排班表'], userActions: ['保存'], states: ['失败'] },
    traceability: [{ kind: 'state', term: '失败', evidence: '保存失败时允许重试' }],
    pages: [{ id: 'home', title: '排班表', state: 'default', elements: [
      { key: 'home.title', type: 'heading', text: '排班表' },
      { key: 'home.save', type: 'button', text: '保存', action: { type: 'navigate', target: 'home' } }
    ] }]
  };
  assert.throws(() => verifyDemo({ html: renderDemo(manifest), manifest }), /declared state coverage/);
});

test('rejects missing compound ecommerce states instead of silently ignoring them', () => {
  const manifest = {
    schemaVersion: 1, id: 'compound-state', product: { name: '订单支付' }, persona: { name: '消费者' },
    requirements: { businessObjects: ['订单'], userActions: ['支付'], states: ['支付成功', '支付失败', '审核中'] },
    traceability: [], startPage: 'pay',
    pages: [{ id: 'pay', title: '订单支付', state: 'default', elements: [
      { key: 'pay.order', type: 'heading', text: '订单', editable: ['text'] },
      { key: 'pay.action', type: 'button', text: '支付', editable: ['text'] }
    ] }]
  };
  assert.throws(() => verifyDemo({ html: renderDemo(manifest), manifest }), /declared state coverage \(支付成功\)/);
});

test('accepts compound ecommerce states when semantic page states or visible evidence cover them', () => {
  const manifest = {
    schemaVersion: 1, id: 'covered-state', product: { name: '订单支付' }, persona: { name: '消费者' },
    requirements: { businessObjects: ['订单'], userActions: ['支付'], states: ['支付成功', '支付失败', '审核中'] },
    traceability: [], startPage: 'pay',
    pages: [
      { id: 'pay', title: '订单', state: 'default', elements: [{ key: 'pay.action', type: 'button', text: '支付', editable: ['text'] }] },
      { id: 'success', title: '支付结果', state: 'success', elements: [{ key: 'success.copy', type: 'heading', text: '订单支付成功', editable: ['text'] }] },
      { id: 'failure', title: '支付失败', state: 'error', elements: [{ key: 'failure.copy', type: 'heading', text: '支付失败，请重试', editable: ['text'] }] },
      { id: 'review', title: '审核进度', state: 'loading', elements: [{ key: 'review.copy', type: 'heading', text: '订单审核中', editable: ['text'] }] }
    ]
  };
  assert.doesNotThrow(() => verifyDemo({ html: renderDemo(manifest), manifest }));
});

function baselineManifest() {
  const executionBaseline = {
    taxonomy: [],
    coreJourneys: [{ id: 'flow', startPageId: 'start', actionIds: ['go'], expectedEndPageId: 'done' }],
    pages: [
      { id: 'start', name: 'Start', regions: [], requirements: [], visualReferences: [], actions: [{ id: 'go', fromPageId: 'start', toPageId: 'done' }] },
      { id: 'done', name: 'Done', regions: [], requirements: [], visualReferences: [], actions: [] },
    ],
  };
  return {
    schemaVersion: 1, id: 'baseline', product: { name: 'Flow' }, persona: { name: 'User' },
    taxonomy: [], coreJourneys: structuredClone(executionBaseline.coreJourneys), executionBaseline,
    requirements: { businessObjects: [], userActions: [], states: [] }, traceability: [], startPage: 'start',
    pages: [
      { id: 'start', title: 'Start', elements: [{ key: 'go', type: 'button', text: 'Go', actionId: 'go', action: { type: 'navigate', target: 'done' } }] },
      { id: 'done', title: 'Done', elements: [] },
    ],
  };
}

test('keeps legacy verifyDemo checks unchanged without an execution baseline', () => {
  const manifest = {
    schemaVersion: 1, id: 'legacy', product: { name: 'Legacy' }, persona: { name: 'User' }, startPage: 'home',
    requirements: { businessObjects: [], userActions: [], states: [] }, traceability: [],
    pages: [{ id: 'home', title: 'Home', elements: [{ key: 'title', type: 'heading', text: 'Home' }] }],
  };
  const checks = verifyDemo({ html: renderDemo(manifest), manifest });
  assert.equal(checks.length, 8);
  assert.equal(checks.some(check => check.name === 'pages'), false);
});

test('includes execution baseline fidelity checks and propagates failures', () => {
  const manifest = baselineManifest();
  const checks = verifyDemo({ html: renderDemo(manifest), manifest });
  assert.equal(checks.find(check => check.name === 'core journeys')?.passed, true);
  manifest.pages[0].elements[0].action.target = 'start';
  assert.throws(() => verifyDemo({ html: renderDemo(manifest), manifest }), /action go.*target done/i);
});
