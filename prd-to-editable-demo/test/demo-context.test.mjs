import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoContext } from '../src/demo-context.mjs';

const requirements = {
  extractionMode: 'model-semantic', confidence: 'high', title: '商品搜索', actor: '消费者', goal: '找到商品',
  screens: ['推荐页', '搜索页', '详情页'], businessObjects: ['商品', '关键词'],
  userActions: ['搜索', '筛选', '查看'], states: ['加载中', '加载失败', '搜索为空'],
  transitions: [
    { from: '推荐页', action: '搜索', to: '搜索页', evidence: '用户可以搜索关键词' },
    { from: '搜索页', action: '点击商品', to: '详情页', evidence: '点击商品进入详情' }
  ],
  evidence: [{ kind: 'user-action', term: '搜索', quote: '搜索关键词' }],
  assumptions: ['默认从推荐页进入'], gaps: ['未提供商品素材']
};

test('builds one platform-neutral context before code generation', () => {
  const context = buildDemoContext({ requirements, source: '# 商品搜索\n用户可以搜索关键词。' });
  assert.equal(context.schemaVersion, 1);
  assert.equal(context.mode, 'professional-direct');
  assert.equal(context.product.title, '商品搜索');
  assert.deepEqual(context.pageUnits.map(item => item.name), requirements.screens);
  assert.deepEqual(context.interactionInventory.map(item => item.trigger), ['搜索', '点击商品']);
  assert.deepEqual(context.stateMatrix.map(item => item.label), requirements.states);
  assert.equal(context.evidenceSources.at(-1).type, '完整PRD');
  assert.match(context.evidenceSources.at(-1).content, /用户可以搜索关键词/u);
});

test('keeps assumptions, gaps, and do-not-infer separate', () => {
  const context = buildDemoContext({ requirements, source: '原文' });
  assert.deepEqual(context.assumptions, ['默认从推荐页进入']);
  assert.deepEqual(context.openQuestions.map(item => item.question), ['未提供商品素材']);
  assert.ok(context.doNotInfer.includes('不得编造 PRD 未提供的价格、销量、优惠、库存或营销承诺'));
});

test('marks visual fidelity incomplete when approved design evidence is absent', () => {
  const context = buildDemoContext({ requirements, source: '原文' });
  assert.equal(context.completeness.visual, 'low');
  assert.equal(context.completeness.semantic, 'high');
  const grounded = buildDemoContext({ requirements, source: '原文', visualEvidence: [{ type: 'design-system', id: 'commerce-core-v1' }] });
  assert.equal(grounded.completeness.visual, 'medium');
});
