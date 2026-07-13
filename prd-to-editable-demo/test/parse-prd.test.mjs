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
  const actionCopy = model.pages.flatMap(page => page.elements).filter(element => element.type === 'button').map(element => element.text);
  assert.ok(actionCopy.includes('去审核'));
  assert.ok(actionCopy.includes('提交审核'));
  assert.ok(actionCopy.includes('返回列表'));
  assert.ok(!actionCopy.includes('继续'));
  assert.ok(actionCopy.every(label => !label.includes('点击')));
  assert.ok(!actionCopy.includes('已提交审核'));
});

test('incomplete PRD generates a reviewable model with assumptions', async () => {
  const source = await readFile(new URL('../fixtures/incomplete-prd.md', import.meta.url), 'utf8');
  const model = parsePrd(source);

  assert.ok(model.pages.length >= 2);
  assert.ok(model.assumptions.length >= 1);
  assert.ok(model.gaps.length >= 1);
});

test('extracts auditable requirements before composing pages', () => {
  const model = parsePrd(`# 补货提醒\n\n用户：门店店长\n\n目标：库存不足时补货。\n\n## 库存列表\n- 展示商品和库存。\n- 店长点击“创建补货单”。\n- 提交失败时允许重试。\n`);

  assert.equal(model.requirements.actor, '门店店长');
  assert.ok(model.requirements.businessObjects.includes('库存'));
  assert.ok(model.requirements.userActions.includes('创建'));
  assert.ok(model.requirements.states.includes('失败'));
  assert.ok(model.traceability.every(item => item.evidence.length > 0));
});

test('extracts previously unseen business objects without a product dictionary', () => {
  const model = parsePrd(`# 智能排班\n\n用户：值班主管\n\n目标：维护排班表。\n\n## 排班工作台\n- 展示排班表和班次。\n- 点击“新增班次”后保存排班表。\n`);

  assert.ok(model.requirements.businessObjects.includes('排班表'));
  assert.ok(model.requirements.businessObjects.includes('班次'));
});
