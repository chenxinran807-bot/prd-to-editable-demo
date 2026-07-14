import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Skill metadata clearly triggers PRD editable prototype requests', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /^---\nname: prd-to-editable-demo\n/m);
  assert.match(source, /PRD/);
  assert.match(source, /可编辑/);
  assert.match(source, /交互原型/);
  assert.match(source, /评审/);
});

test('Skill requires a requirements brief and forbids silent specialist fallback', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /demo-context|语义需求/);
  assert.match(source, /业务对象/);
  assert.match(source, /不得.*降级/);
  assert.match(source, /demo-context/);
  assert.match(source, /index\.html/);
  assert.match(source, /design-profile\.json/);
});

test('Skill makes direct embedded generation the default and Inspire optional', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /默认.*直接生成/);
  assert.match(source, /Inspire.*可选/);
  assert.match(source, /run-inspire-pipeline\.mjs/);
  assert.match(source, /--ref.*assetId/);
  assert.match(source, /直接嵌入 Agent/);
  assert.match(source, /不要求.*外部平台/);
  assert.match(source, /Emoji.*0/);
  assert.match(source, /同视口截图|多模态审查/);
});

test('Skill separates host orchestration identity from Inspire Builder design identity', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /宿主 Agent Skill/);
  assert.match(source, /不能作为 Inspire Builder.*--skill/);
  assert.doesNotMatch(source, /douyin-mall-independent-app-prototype-guidance@\d+/);
  assert.match(source, /activatedSkills/);
  assert.match(source, /openedSkills/);
  assert.match(source, /activatedSkills/);
});

test('Skill requires model-semantic extraction and treats heuristics only as low-confidence fallback', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /model-semantic/);
  assert.match(source, /--requirements/);
  assert.match(source, /原文证据/);
  assert.match(source, /低置信|low-confidence/);
  assert.match(source, /不得把章节标题机械生成为页面/);
  assert.doesNotMatch(source, /AI 试穿的入口|拍照浮层|相机拍照页/);
});

test('Skill is a standalone core and treats discovered tools only as optional enhancements', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /单一安装|单 Skill/);
  assert.match(source, /capability-policy\.md/);
  assert.match(source, /未安装.*不影响.*核心|不依赖.*其他.*Skill/);
  assert.match(source, /Inspire.*按需|可选 Inspire/);
  assert.match(source, /不依赖用户另行安装/);
});

test('Skill ships domain-neutral professional design references', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  for (const name of ['interaction-design.md', 'visual-quality.md', 'quality-gates.md']) assert.match(source, new RegExp(name));
  for (const name of ['interaction-design.md', 'visual-quality.md', 'quality-gates.md']) {
    const reference = await readFile(new URL(`../references/${name}`, import.meta.url), 'utf8');
    assert.match(reference, /状态|交互|视觉|验收/);
    assert.doesNotMatch(reference, /AI 试穿的入口|拍照浮层|相机拍照页/);
  }
});

test('Skill defaults to one best result and only shows meaningful alternatives', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /单一最佳方案/);
  assert.match(source, /显著.*可感知.*差异/);
  assert.match(source, /只有.*才展示备选/);
  assert.match(source, /同视口截图|多模态审查/);
});

test('Skill prevents structured prompts from compressing away page detail and hierarchy', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /pageContent/);
  assert.match(source, /informationArchitecture/);
  assert.match(source, /完整 PRD 原文/);
  assert.match(source, /不会压缩掉页面内容和信息架构/);
});
