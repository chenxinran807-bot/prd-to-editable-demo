import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeRequirements, parsePrd } from '../src/parse-prd.mjs';

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
  assert.ok(model.pages.flatMap(page => page.elements).some(element => /标记已读/.test(element.text)));
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
  const model = parsePrd(`# 智能排班\n\n用户：值班主管\n\n目标：维护排班表。\n\n## 排班工作台\n- 展示排班表和班次。\n- 点击“新增班次”后保存排班表。\n- 保存失败时允许重试。\n`);

  assert.ok(model.requirements.businessObjects.includes('排班表'));
  assert.ok(model.requirements.businessObjects.includes('班次'));
  assert.ok(model.pages.some(page => page.state === 'error'));
  assert.ok(model.pages.flatMap(page => page.elements).some(element => element.type === 'button' && element.text === '重试'));
});

test('keeps rich-document image narration out of the specialist requirements brief', () => {
  const source = `# AI试穿 - 迭代需求【WIP】

## 需求背景
AI试穿需要由独立端方案改成传统 tryon 方案，让用户感受到是自己在试穿。
<grid><img alt="图片展示了一位站在户外的女性，该图片展示了抖音直播界面" href="https://example.com/a.png" /></grid>
![图片展示的是抖音商城穿搭页面，该图片用于辅助说明](https://example.com/b.png)

## 需求详情
- 创建形象：引导用户上传全身图。
- 删除形象后，试穿中任务完成时按钮从“查看”变为“试穿”。
- 支持下滑刷新和反馈入口。
`;
  const requirements = analyzeRequirements(source);

  assert.equal(requirements.actor, 'AI试穿用户');
  assert.match(requirements.goal, /传统 tryon 方案/);
  assert.ok(requirements.businessObjects.includes('形象'));
  assert.ok(requirements.businessObjects.includes('全身图'));
  assert.ok(requirements.businessObjects.every(term => !/图片展示|抖音直播|站在户外|该图片/.test(term)));
  assert.ok(requirements.traceability.every(item => !/图片展示|抖音直播|站在户外|该图片/.test(item.evidence)));
});

test('does not turn research chapters into pages and recovers screens from a complex product flow', () => {
  const model = parsePrd(`# 穿搭 Tab 迭代

## 市场调研
用户希望快速理解一套穿搭包含哪些商品。

## 竞品分析
竞品使用内容流承接搭配发现。

## 方向判断
采用多 Tab 浏览与详情承接方案。

## 产品方案
- 页面与流转：穿搭 Tab Feed → 穿搭详情页 → AI 试穿弹窗 → 商品清单；详情页也可以打开 AI 搭配弹窗。
- 穿搭 Tab 支持推荐、日常切换；卡片支持喜欢和不喜欢反馈。
`);

  const titles = model.pages.map(page => page.title);
  assert.ok(titles.includes('穿搭 Tab Feed'));
  assert.ok(titles.includes('穿搭详情页'));
  assert.ok(titles.includes('AI 试穿弹窗'));
  assert.ok(titles.includes('商品清单'));
  assert.ok(titles.includes('AI 搭配弹窗'));
  assert.ok(!titles.some(title => ['市场调研', '竞品分析', '方向判断', '产品方案'].includes(title)));
  assert.ok(model.requirements.userActions.includes('喜欢'));
  assert.ok(model.requirements.userActions.includes('不喜欢'));
});

test('recovers a complete linear state machine from an arrow-delimited PRD flow', () => {
  const model = parsePrd(`# AI 试穿拍照输入

## 需求背景
用户需要通过拍照创建自己的试穿形象。

## 核心流程
入口页 → 拍照方式浮层 → 相机拍照页 → 照片预览页 → 审核中 → 创建成功页；审核失败时进入创建失败页，用户可以重试并返回相机拍照页。
`);

  const titles = model.pages.map(page => page.title);
  for (const title of ['入口页', '拍照方式浮层', '相机拍照页', '照片预览页', '审核中', '创建成功页', '创建失败页']) {
    assert.ok(titles.includes(title), `missing ${title}`);
  }
  assert.ok(!titles.includes('需求背景'));
  assert.ok(!titles.includes('核心流程'));
  assert.equal(model.pages.find(page => page.title === '创建成功页')?.state, 'success');
  assert.equal(model.pages.find(page => page.title === '创建失败页')?.state, 'error');
  assert.ok(model.pages.flatMap(page => page.elements).some(element => element.text === '重试'));
});

test('classifies experience shape and emits screen transitions for specialist handoff', () => {
  const requirements = analyzeRequirements(`# 内容发现

## 产品方案
穿搭 Tab Feed → 穿搭详情页 → 商品清单；详情页可以打开 AI 试穿弹窗。
支持推荐、日常 Tab 切换和卡片喜欢反馈。
`);

  assert.equal(requirements.experienceType, 'browse');
  assert.deepEqual(requirements.screens.slice(0, 3), ['穿搭 Tab Feed', '穿搭详情页', '商品清单']);
  assert.ok(requirements.transitions.some(item => item.from === '穿搭 Tab Feed' && item.to === '穿搭详情页'));
});
