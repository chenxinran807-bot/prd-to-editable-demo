import { runtimeSource } from './templates/runtime.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function renderElement(element) {
  const attributes = `data-proto-key="${escapeHtml(element.key)}"${element.action ? ` data-action="${escapeHtml(JSON.stringify(element.action))}"` : ''}`;
  if (element.type === 'heading') return `<h2 ${attributes}>${escapeHtml(element.text)}</h2>`;
  return `<button class="primary-action" type="button" ${attributes}>${escapeHtml(element.text)}</button>`;
}

export function renderDemo(model) {
  const manifestJson = JSON.stringify(model).replaceAll('<', '\\u003c');
  const pages = model.pages.map(page => `<section class="proto-page" data-page-id="${escapeHtml(page.id)}" hidden>
    <div class="phone-header"><span>${escapeHtml(model.product.name)}</span><span class="status-chip">${escapeHtml(page.state)}</span></div>
    <div class="page-content">${page.elements.map(renderElement).join('\n')}</div>
  </section>`).join('\n');
  const scenarioOptions = model.pages.map(page => `<option value="${escapeHtml(page.id)}">${escapeHtml(page.title)} · ${escapeHtml(page.state)}</option>`).join('');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(model.product.name)} · 可编辑原型</title>
<style>
:root{font-family:Inter,"PingFang SC",sans-serif;color:#172033;background:#eef1f6}*{box-sizing:border-box}body{margin:0;min-height:100vh}.topbar{height:64px;background:#fff;border-bottom:1px solid #dde2ea;display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:3}.brand{font-weight:700}.mode-switch{display:flex;background:#f0f2f6;border-radius:10px;padding:4px}.mode-switch button,.toolbar button{border:0;background:transparent;padding:8px 14px;border-radius:7px;cursor:pointer}.toolbar{display:flex;align-items:center;gap:6px}.toolbar select{max-width:210px;padding:7px 9px;border:1px solid #ccd3df;border-radius:8px;background:#fff}body[data-mode="preview"] [data-mode="preview"],body[data-mode="edit"] [data-mode="edit"]{background:#fff;box-shadow:0 1px 5px #0002}.workspace{display:grid;grid-template-columns:1fr 340px;min-height:calc(100vh - 64px)}body[data-mode="preview"] .workspace{grid-template-columns:1fr}.canvas{padding:36px;display:grid;place-items:center}.device{width:min(390px,100%);min-height:720px;background:#fff;border-radius:32px;box-shadow:0 20px 60px #23304b26;overflow:hidden;border:8px solid #20242c}.phone-header{height:64px;padding:20px;display:flex;justify-content:space-between;border-bottom:1px solid #edf0f4;font-weight:600}.status-chip{font-size:12px;color:#526078;background:#f0f3f8;border-radius:999px;padding:4px 8px}.page-content{padding:28px 22px;display:flex;flex-direction:column;gap:16px}.page-content h2{font-size:28px;margin:18px 0}.primary-action{border:0;border-radius:12px;background:#4f46e5;color:#fff;padding:14px 18px;font-size:16px;cursor:pointer}.primary-action:active{transform:scale(.98)}.is-selected{outline:3px solid #f59e0b!important;outline-offset:3px}.editor{background:#fff;border-left:1px solid #dde2ea;padding:22px;overflow:auto}.editor h3{margin:18px 0 10px}.field{padding:10px;background:#f5f7fa;border-radius:8px;font-family:ui-monospace,monospace;word-break:break-all}.control{display:grid;gap:6px;margin:12px 0}.control input,.control select,.control textarea{width:100%;padding:9px;border:1px solid #ccd3df;border-radius:8px}.checks{display:flex;gap:16px}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions button{border:1px solid #ccd3df;background:#fff;border-radius:8px;padding:9px 11px;cursor:pointer}.actions .accent{background:#4f46e5;color:#fff;border-color:#4f46e5}.footer-status{position:fixed;left:20px;bottom:18px;background:#172033;color:#fff;border-radius:10px;padding:9px 13px;font-size:13px}@media(max-width:760px){.topbar{height:auto;min-height:64px;gap:8px;flex-wrap:wrap;padding:10px 14px}.toolbar{order:3;width:100%;overflow:auto}.workspace{grid-template-columns:1fr}.editor{position:fixed;left:0;right:0;bottom:0;max-height:48vh;z-index:4;border-top:1px solid #ddd}.canvas{padding:18px}.device{min-height:650px}}
</style></head>
<body data-mode="preview"><header class="topbar"><div class="brand">${escapeHtml(model.product.name)} <small>评审原型</small></div><div class="toolbar"><label>评审场景 <select id="review-scenario">${scenarioOptions}</select></label><button id="undo-edit">撤销</button><button id="redo-edit">重做</button><button id="export-patches">导出修改</button></div><div class="mode-switch"><button data-mode="preview">预览</button><button data-mode="edit">编辑</button></div></header>
<main class="workspace"><div class="canvas"><div class="device">${pages}</div></div><aside id="editor-panel" class="editor" hidden><h3>编辑元素</h3><div id="selected-key" class="field">尚未选择</div><label class="control">文案<input id="edit-text"></label><div class="checks"><label>文字色 <input id="edit-color" type="color" value="#172033"></label><label>背景色 <input id="edit-background" type="color" value="#4f46e5"></label></div><label class="control">点击跳转<select id="edit-target"><option value="">无跳转</option></select></label><div class="checks"><label><input id="edit-hidden" type="checkbox"> 隐藏</label><label><input id="edit-disabled" type="checkbox"> 禁用</label></div><div class="actions"><button id="restore-element">恢复元素</button></div><hr><h3>让 Agent 修改</h3><label class="control">修改要求<textarea id="agent-request" rows="4" placeholder="例如：增加审核失败后的重新提交入口"></textarea></label><div class="actions"><button id="agent-submit" class="accent">保存修改任务</button><button id="export-comments">导出任务</button></div><p id="agent-status"></p></aside></main>
<div class="footer-status">当前页面：<span id="current-page-label"></span></div>
<script type="application/json" id="prototype-manifest">${manifestJson}</script><script>${runtimeSource}</script></body></html>`;
}
