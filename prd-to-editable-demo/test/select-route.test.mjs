import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRoute } from '../src/select-route.mjs';

test('engineering delivery wins over other signals', () => {
  const route = selectRoute({ intent: '生成 React 研发交付包', assets: ['flow.png'] });
  assert.equal(route.id, 'inspire');
  assert.deepEqual(route.postExports, ['engineering']);
});

test('explicit Inspire intent selects Inspire', () => {
  assert.equal(selectRoute({ intent: '生成到 Inspire 收纳箱', assets: [] }).id, 'inspire');
});

test('explicit design-workspace language still ends in the standalone Inspire route', () => {
  assert.deepEqual(selectRoute({ intent: '用 Open Design 做品牌级视觉探索' }).stages, ['inspire']);
  assert.deepEqual(selectRoute({ intent: '交给花叔 Design 做高品质界面' }).stages, ['inspire']);
});

test('complete flow assets plus pixel fidelity select figma flow', () => {
  assert.deepEqual(selectRoute({ intent: '按切图像素级还原', assets: ['01-flow.png', 'button.png'] }).stages, ['inspire']);
  assert.deepEqual(selectRoute({ intent: '按 Figma 切图像素级还原', assets: ['checkout-screen.png', 'button-slice.png'] }).stages, ['inspire']);
});

test('ambiguous prototype requests default to professional mode', () => {
  const route = selectRoute({ intent: '做一个评审 demo', assets: [] });
  assert.equal(route.id, 'inspire');
  assert.equal(route.deliveryMode, 'professional');
});

test('visual design input routes to the high-fidelity specialist', () => {
  assert.deepEqual(selectRoute({ intent: '根据截图做高保真原型', assets: ['screen.png'] }).stages, ['inspire']);
});

test('routing does not emit a separately installed Kakaxi identity', () => {
  const route = selectRoute({ intent: '使用 kakaxi 生成高保真原型', assets: ['screen.png'] });
  assert.deepEqual(route.stages, ['inspire']);
});

test('a clearly named screen asset routes to high fidelity even without repeated intent words', () => {
  assert.deepEqual(selectRoute({ intent: '做个评审原型', assets: ['checkout-screen.png'] }).stages, ['inspire']);
});

test('a reference URL routes to the specialist that can inspect the real page', () => {
  assert.deepEqual(selectRoute({ intent: '按这个页面做原型', url: 'https://example.com/console' }).stages, ['inspire']);
});

test('complex product journey routes to PRD understanding specialist', () => {
  assert.deepEqual(selectRoute({ intent: '先梳理完整用户旅程和复杂状态', assets: [] }).stages, ['inspire']);
});

test('large PRD source routes away from the low-fidelity fallback', () => {
  const source = `${'## 模块\n需求状态处理中，删除后支持重试。\n'.repeat(5)}`;
  assert.deepEqual(selectRoute({ intent: '', assets: [], source }).stages, ['inspire']);
});

test('complex rich-document PRD uses understanding then high-fidelity stages', () => {
  const source = `${'## 模块\n需求状态处理中，删除后支持重试。\n'.repeat(5)}\n![参考界面](screen.png)`;
  const route = selectRoute({ intent: '', assets: [], source });
  assert.equal(route.id, 'inspire');
  assert.deepEqual(route.stages, ['inspire']);
});

test('native, branded, high-fidelity, and Inspire-editable requests select professional mode', () => {
  for (const intent of ['原生移动端', '品牌高保真', '在 Inspire 编辑']) {
    const route = selectRoute({ intent, source: '# 需求', assets: [] });
    assert.equal(route.deliveryMode, 'professional');
    assert.equal(route.finalContainer, 'inspire');
  }
});

test('explicit speed-first review selects fast-review mode', () => {
  const route = selectRoute({ intent: '快速评审初版，优先速度', source: '# 需求', assets: [] });
  assert.equal(route.id, 'local');
  assert.equal(route.deliveryMode, 'fast-review');
});

test('routing never requires separately installed peer Agent Skills', () => {
  const forbidden = new Set(['prd-generator', 'pm-kakaxi-skills', 'figma-flow', 'vne', 'open-design']);
  for (const route of [
    selectRoute({ intent: '复杂 PRD 高保真', source: '## 流程\n处理中失败后重试'.repeat(20), assets: ['screen.png'] }),
    selectRoute({ intent: '按 Figma 切图还原', assets: ['flow.png', 'slice.png'] }),
    selectRoute({ intent: '品牌级视觉探索' })
  ]) assert.ok((route.stages ?? []).every(stage => !forbidden.has(stage)));
});
