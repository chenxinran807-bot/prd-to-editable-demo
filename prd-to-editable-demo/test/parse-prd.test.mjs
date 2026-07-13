import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePrd } from '../src/parse-prd.mjs';

test('extracts explicit pages and creates navigable review model', async () => {
  const source = await readFile(new URL('../fixtures/simple-prd.md', import.meta.url), 'utf8');
  const model = parsePrd(source);

  assert.equal(model.product.name, '审核中心');
  assert.ok(model.persona.name.includes('运营'));
  assert.ok(model.pages.length >= 3);
  assert.ok(model.pages.some(page => page.id === model.startPage));
  assert.ok(model.pages.some(page => page.state === 'success'));
  assert.ok(model.pages.some(page => page.state === 'empty'));
  assert.ok(model.pages.flatMap(page => page.elements).some(element => element.action?.type === 'navigate'));
});

test('incomplete PRD generates a reviewable model with assumptions', async () => {
  const source = await readFile(new URL('../fixtures/incomplete-prd.md', import.meta.url), 'utf8');
  const model = parsePrd(source);

  assert.ok(model.pages.length >= 2);
  assert.ok(model.assumptions.length >= 1);
  assert.ok(model.gaps.length >= 1);
});
