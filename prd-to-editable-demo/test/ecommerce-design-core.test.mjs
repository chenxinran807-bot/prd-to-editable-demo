import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveDesignCore } from '../src/ecommerce-design-core.mjs';

test('routes ecommerce requirements to a minimal component and token set', async () => {
  const core = JSON.parse(await readFile(new URL('../references/ecommerce-design-core.json', import.meta.url), 'utf8'));
  const result = resolveDesignCore({
    requirements: { title: '商品搜索', screens: ['搜索结果页'], userActions: ['搜索', '筛选', '查看商品'], businessObjects: ['商品', '价格'] },
    core
  });
  assert.ok(result.components.includes('search-bar'));
  assert.ok(result.components.includes('filter-bar'));
  assert.ok(result.components.includes('product-card'));
  assert.ok(result.tokens.colors.includes('text-primary'));
  assert.ok(result.tokens.colors.includes('commerce-red'));
  assert.ok(result.requiredAssetRoles.includes('product-image'));
  assert.ok(result.sourceReferences.length > 0);
});

test('the lightweight design core contains no bundled binary asset paths', async () => {
  const source = await readFile(new URL('../references/ecommerce-design-core.json', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.(?:png|jpe?g|webp|mp4|mov|otf|ttf)\b/iu);
  assert.ok(Buffer.byteLength(source) < 50_000);
});
