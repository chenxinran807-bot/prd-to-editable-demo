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
  assert.match(source, /需求模型/);
  assert.match(source, /业务对象/);
  assert.match(source, /不得.*降级/);
  assert.match(source, /specialist-handoff\.json/);
  assert.match(source, /finalize-specialist\.mjs/);
  assert.match(source, /index\.original\.html/);
});

test('Skill makes Inspire the only professional final container', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /Inspire.*最终.*容器/);
  assert.match(source, /run-inspire-pipeline\.mjs/);
  assert.match(source, /--ref.*assetId/);
  assert.match(source, /直接在 Inspire/);
  assert.match(source, /不得.*导出.*任务.*Agent/);
  assert.match(source, /Emoji.*0/);
  assert.match(source, /主观视觉验收/);
});

test('Skill separates host orchestration identity from Inspire Builder design identity', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /外部 Agent 编排 Skill/);
  assert.match(source, /Inspire Builder 业务设计 Skill/);
  assert.match(source, /不得.*private:prd-to-editable-demo.*--skill/);
  assert.doesNotMatch(source, /douyin-mall-independent-app-prototype-guidance@\d+/);
  assert.match(source, /activatedSkills/);
  assert.match(source, /openedSkills/);
  assert.match(source, /未.*激活.*打开.*失败/);
});

test('Skill requires model-semantic extraction and treats heuristics only as low-confidence fallback', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /model-semantic/);
  assert.match(source, /--requirements/);
  assert.match(source, /原文证据/);
  assert.match(source, /低置信|low-confidence/);
  assert.match(source, /不得.*词表.*核心/);
  assert.doesNotMatch(source, /AI 试穿的入口|拍照浮层|相机拍照页/);
});

test('Skill is a standalone core and treats discovered tools only as optional enhancements', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /单一安装|单 Skill/);
  assert.match(source, /capability-policy\.md/);
  assert.match(source, /未安装.*不影响.*核心|不依赖.*其他.*Skill/);
  assert.match(source, /专业模式.*Inspire/);
  assert.doesNotMatch(source, /`prd-generator`、`pm-kakaxi-skills`/);
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

test('Skill defines the three-candidate professional success contract', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /3\s*个|三个/);
  assert.match(source, /同一.*需求.*验收合同/);
  assert.match(source, /歧义.*用户选择/);
  assert.match(source, /candidate-comparison\.json/);
  assert.match(source, /prd-to-editable-demo-select/);
  assert.match(source, /currentAssetId/);
  assert.match(source, /交接包.*不.*成功|仅.*handoff.*不.*成功/i);
  assert.match(source, /预览.*截图.*高保真/);
  assert.doesNotMatch(source, /状态码\s*3.*专业接管信号/);
});

test('Skill prevents structured prompts from compressing away page detail and hierarchy', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /pageContent/);
  assert.match(source, /informationArchitecture/);
  assert.match(source, /完整 PRD 原文/);
  assert.match(source, /信息保留率/);
});
