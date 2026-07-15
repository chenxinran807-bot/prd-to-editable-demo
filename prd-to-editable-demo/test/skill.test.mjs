import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function frontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'frontmatter is required');
  return Object.fromEntries(match[1].split('\n').map(line => {
    const at = line.indexOf(':'); return [line.slice(0, at), line.slice(at + 1).trim()];
  }));
}

test('Skill exposes one workflow identity with a concise domain-neutral what-and-when trigger', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  const metadata = frontmatter(source);
  assert.equal(metadata.name, 'prd-to-editable-demo');
  assert.equal(metadata.intent, 'prd-to-editable-demo');
  assert.equal(metadata.type, 'workflow');
  assert.ok(metadata.description.length <= 200, `description is ${metadata.description.length} chars`);
  assert.match(metadata.description, /PRD|requirement/i);
  assert.match(metadata.description, /when|use/i);
  assert.doesNotMatch(metadata.description, /商城|试穿|售后|结算/);
});

test('Skill orders fidelity contracts before generation and Inspire routing', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  const ordered = [
    'requirements-ir.md', 'clarification.md', 'visual-reference.md', 'execution-contract.md',
    'fidelity-verification.md', 'run-inspire-pipeline.mjs',
  ];
  for (const name of ordered) assert.match(source, new RegExp(name.replace('.', '\\.'), 'i'));
  for (let index = 1; index < ordered.length; index++) {
    assert.ok(source.indexOf(ordered[index - 1]) < source.indexOf(ordered[index]), `${ordered[index - 1]} must precede ${ordered[index]}`);
  }
});

test('Skill public workflow invokes only the v2 requirements contract', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /prd-to-editable-demo\.mjs[^\n]*--requirements-v2/);
  assert.doesNotMatch(source, /prd-to-editable-demo\.mjs[^\n]*--requirements(?:\s|=)/);
});

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
