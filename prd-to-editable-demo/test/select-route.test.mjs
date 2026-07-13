import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRoute } from '../src/select-route.mjs';

test('engineering delivery wins over other signals', () => {
  assert.equal(selectRoute({ intent: '生成 React 研发交付包', assets: ['flow.png'] }).id, 'vne');
});

test('explicit Inspire intent selects Inspire', () => {
  assert.equal(selectRoute({ intent: '生成到 Inspire 收纳箱', assets: [] }).id, 'inspire');
});

test('complete flow assets plus pixel fidelity select figma flow', () => {
  assert.equal(selectRoute({ intent: '按切图像素级还原', assets: ['01-flow.png', 'button.png'] }).id, 'figma-flow');
});

test('ordinary PRD uses the local fast path', () => {
  assert.equal(selectRoute({ intent: '做一个评审 demo', assets: [] }).id, 'local');
});
