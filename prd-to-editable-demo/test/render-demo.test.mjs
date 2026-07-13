import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrd } from '../src/parse-prd.mjs';
import { renderDemo } from '../src/render-demo.mjs';

const model = parsePrd(`# 示例\n\n用户：产品经理。\n目标：完成评审。\n\n## 首页\n点击“开始评审”进入结果页。\n\n## 结果页\n点击“返回”回到首页。`);

test('renders a zero-dependency editable HTML document', () => {
  const html = renderDemo(model);
  assert.match(html, /<!doctype html>/i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i);
  assert.match(html, /type="application\/json" id="prototype-manifest"/);
  assert.match(html, /data-proto-key="/);
  assert.match(html, /data-mode="preview"/);
  assert.match(html, /data-mode="edit"/);
  assert.match(html, /id="editor-panel"/);
  assert.match(html, /id="edit-text"/);
  assert.match(html, /id="edit-target"/);
  assert.match(html, /id="undo-edit"/);
  assert.match(html, /id="review-scenario"/);
  assert.match(html, /localStorage/);
  assert.match(html, /让 Agent 修改/);
});

test('escapes PRD text before embedding it into HTML', () => {
  const unsafe = structuredClone(model);
  unsafe.pages[0].elements[0].text = '<img src=x onerror=alert(1)>';
  const html = renderDemo(unsafe);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
