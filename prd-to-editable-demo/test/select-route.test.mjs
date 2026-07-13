import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRoute } from '../src/select-route.mjs';

test('engineering delivery wins over other signals', () => {
  assert.equal(selectRoute({ intent: '生成 React 研发交付包', assets: ['flow.png'] }).id, 'vne');
});

test('explicit Inspire intent selects Inspire', () => {
  assert.equal(selectRoute({ intent: '生成到 Inspire 收纳箱', assets: [] }).id, 'inspire');
});

test('explicit Open Design or Huashu Design intent preserves the design workspace route', () => {
  assert.equal(selectRoute({ intent: '用 Open Design 做品牌级视觉探索' }).id, 'open-design');
  assert.equal(selectRoute({ intent: '交给花叔 Design 做高品质界面' }).id, 'open-design');
});

test('complete flow assets plus pixel fidelity select figma flow', () => {
  assert.equal(selectRoute({ intent: '按切图像素级还原', assets: ['01-flow.png', 'button.png'] }).id, 'figma-flow');
  assert.equal(selectRoute({ intent: '按 Figma 切图像素级还原', assets: ['checkout-screen.png', 'button-slice.png'] }).id, 'figma-flow');
});

test('ordinary PRD uses the local fast path', () => {
  assert.equal(selectRoute({ intent: '做一个评审 demo', assets: [] }).id, 'local');
});

test('visual design input routes to the high-fidelity specialist', () => {
  assert.equal(selectRoute({ intent: '根据截图做高保真原型', assets: ['screen.png'] }).id, 'pm-kakaxi');
});

test('a clearly named screen asset routes to high fidelity even without repeated intent words', () => {
  assert.equal(selectRoute({ intent: '做个评审原型', assets: ['checkout-screen.png'] }).id, 'pm-kakaxi');
});

test('a reference URL routes to the specialist that can inspect the real page', () => {
  assert.equal(selectRoute({ intent: '按这个页面做原型', url: 'https://example.com/console' }).id, 'vne');
});

test('complex product journey routes to PRD understanding specialist', () => {
  assert.equal(selectRoute({ intent: '先梳理完整用户旅程和复杂状态', assets: [] }).id, 'prd-generator');
});

test('large PRD source routes away from the low-fidelity fallback', () => {
  const source = `${'## 模块\n需求状态处理中，删除后支持重试。\n'.repeat(5)}`;
  assert.equal(selectRoute({ intent: '', assets: [], source }).id, 'prd-generator');
});

test('complex rich-document PRD uses understanding then high-fidelity stages', () => {
  const source = `${'## 模块\n需求状态处理中，删除后支持重试。\n'.repeat(5)}\n![参考界面](screen.png)`;
  const route = selectRoute({ intent: '', assets: [], source });
  assert.equal(route.id, 'pm-kakaxi');
  assert.deepEqual(route.stages, ['prd-generator', 'pm-kakaxi']);
});
