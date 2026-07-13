import test from 'node:test';
import assert from 'node:assert/strict';
import { auditNativeDesign } from '../src/native-design-audit.mjs';

const references = {
  icons: [
    { file: 'icons/cart.svg', source: 'project-authored', license: 'MIT', role: 'cart action' },
    { file: 'icons/check.svg', source: 'project-authored', license: 'MIT', role: 'success state' }
  ]
};

test('rejects Emoji and text glyph icons', () => {
  const report = auditNativeDesign('<button>🛒 加购</button><span class="icon">★</span>');
  assert.equal(report.status, 'failed');
  assert.deepEqual(report.failures.map(item => item.rule), ['no-emoji', 'no-text-glyph-icons']);
  assert.equal(report.subjectiveReview.status, 'required');
});

test('rejects generic AI and desktop presentation patterns', () => {
  const report = auditNativeDesign(`
    <nav class="desktop-sidebar">Menu</nav>
    <main class="phone-frame" style="background: linear-gradient(90deg, #7c3aed, #a855f7)"></main>
  `);
  assert.deepEqual(report.failures.map(item => item.rule), [
    'no-generic-purple-gradient',
    'no-desktop-navigation',
    'no-fake-phone-frame'
  ]);
});

test('rejects external assets and icons without provenance', () => {
  const report = auditNativeDesign(`
    <img src="https://example.com/product.png" alt="商品图">
    <img src="icons/unknown.svg" alt="收藏">
  `, { references });
  assert.deepEqual(report.failures.map(item => item.rule), [
    'approved-assets-only',
    'icon-provenance'
  ]);
});

test('requires PRD actions, native components, state coverage and touch labels', () => {
  const report = auditNativeDesign(`
    <header data-component="top-bar">商品详情</header>
    <button data-action="add-to-cart"><img src="icons/cart.svg" alt="加入购物车">加入购物车</button>
    <section data-state="success"><img src="icons/check.svg" alt="成功">已加入购物车</section>
  `, {
    requirements: {
      actions: ['add-to-cart', 'buy-now'],
      components: ['top-bar', 'bottom-nav'],
      states: ['success', 'error'],
      touchLabels: ['加入购物车', '立即购买']
    },
    references
  });
  assert.deepEqual(report.failures.map(item => item.rule), [
    'required-actions',
    'native-components',
    'state-coverage',
    'touch-labels'
  ]);
});

test('passes deterministic checks but always requires subjective visual review', () => {
  const html = `
    <header data-component="top-bar">商品详情</header>
    <article data-component="product-card">精选商品</article>
    <button data-action="add-to-cart"><img src="icons/cart.svg" alt="加入购物车">加入购物车</button>
    <section data-state="success"><img src="icons/check.svg" alt="成功">已加入购物车</section>
  `;
  const report = auditNativeDesign(html, {
    requirements: {
      actions: ['add-to-cart'],
      components: ['top-bar', 'product-card'],
      states: ['success'],
      touchLabels: ['加入购物车']
    },
    references
  });
  assert.equal(report.status, 'passed');
  assert.deepEqual(report.failures, []);
  assert.equal(report.subjectiveReview.status, 'required');
  assert.ok(report.checks.length >= 9);
});
