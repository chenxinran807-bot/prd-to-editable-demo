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
