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
  assert.match(source, /douyin-mall-independent-app-prototype-guidance@3/);
  assert.match(source, /activatedSkills/);
  assert.match(source, /openedSkills/);
  assert.match(source, /未.*激活.*打开.*失败/);
});
