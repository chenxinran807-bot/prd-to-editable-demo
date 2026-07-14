import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRoute } from '../src/select-route.mjs';

test('engineering delivery wins over other signals', () => {
  const route = selectRoute({ intent: '生成 React 研发交付包', assets: ['flow.png'] });
  assert.equal(route.id, 'inspire');
  assert.deepEqual(route.postExports, ['vne']);
});

test('explicit Inspire intent selects Inspire', () => {
  assert.equal(selectRoute({ intent: '生成到 Inspire 收纳箱', assets: [] }).id, 'inspire');
});

test('explicit Open Design or Huashu Design intent preserves the design workspace route', () => {
  assert.deepEqual(selectRoute({ intent: '用 Open Design 做品牌级视觉探索' }).stages, ['open-design', 'inspire']);
  assert.deepEqual(selectRoute({ intent: '交给花叔 Design 做高品质界面' }).stages, ['open-design', 'inspire']);
});

test('complete flow assets plus pixel fidelity select figma flow', () => {
  assert.deepEqual(selectRoute({ intent: '按切图像素级还原', assets: ['01-flow.png', 'button.png'] }).stages, ['figma-flow', 'inspire']);
  assert.deepEqual(selectRoute({ intent: '按 Figma 切图像素级还原', assets: ['checkout-screen.png', 'button-slice.png'] }).stages, ['figma-flow', 'inspire']);
});

test('ordinary PRD uses the local fast path', () => {
  assert.equal(selectRoute({ intent: '做一个评审 demo', assets: [] }).id, 'local');
});

test('visual design input routes to the high-fidelity specialist', () => {
  assert.deepEqual(selectRoute({ intent: '根据截图做高保真原型', assets: ['screen.png'] }).stages, ['pm-kakaxi-skills', 'inspire']);
});

test('routing emits the installed Kakaxi Skill identity rather than an unresolvable alias', () => {
  const route = selectRoute({ intent: '使用 kakaxi 生成高保真原型', assets: ['screen.png'] });
  assert.ok(route.stages.includes('pm-kakaxi-skills'));
  assert.ok(!route.stages.includes('pm-kakaxi'));
});

test('a clearly named screen asset routes to high fidelity even without repeated intent words', () => {
  assert.deepEqual(selectRoute({ intent: '做个评审原型', assets: ['checkout-screen.png'] }).stages, ['pm-kakaxi-skills', 'inspire']);
});

test('a reference URL routes to the specialist that can inspect the real page', () => {
  assert.deepEqual(selectRoute({ intent: '按这个页面做原型', url: 'https://example.com/console' }).stages, ['vne', 'inspire']);
});

test('complex product journey routes to PRD understanding specialist', () => {
  assert.deepEqual(selectRoute({ intent: '先梳理完整用户旅程和复杂状态', assets: [] }).stages, ['prd-generator', 'inspire']);
});

test('large PRD source routes away from the low-fidelity fallback', () => {
  const source = `${'## 模块\n需求状态处理中，删除后支持重试。\n'.repeat(5)}`;
  assert.deepEqual(selectRoute({ intent: '', assets: [], source }).stages, ['prd-generator', 'inspire']);
});

test('complex rich-document PRD uses understanding then high-fidelity stages', () => {
  const source = `${'## 模块\n需求状态处理中，删除后支持重试。\n'.repeat(5)}\n![参考界面](screen.png)`;
  const route = selectRoute({ intent: '', assets: [], source });
  assert.equal(route.id, 'inspire');
  assert.deepEqual(route.stages, ['prd-generator', 'pm-kakaxi-skills', 'inspire']);
});
