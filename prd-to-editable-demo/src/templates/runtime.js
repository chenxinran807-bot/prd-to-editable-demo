export const runtimeSource = String.raw`
(() => {
  const manifest = JSON.parse(document.querySelector('#prototype-manifest').textContent);
  const storageKey = 'prd-editable-demo:' + manifest.id;
  let currentPage = manifest.startPage;
  let mode = 'preview';
  let selected = null;
  let patches = JSON.parse(localStorage.getItem(storageKey + ':patches') || '{}');
  let comments = JSON.parse(localStorage.getItem(storageKey + ':comments') || '[]');
  let history = { snapshots: [structuredClone(patches)], index: 0 };
  const $ = selector => document.querySelector(selector);

  const save = () => localStorage.setItem(storageKey + ':patches', JSON.stringify(patches));
  const record = () => {
    history.snapshots = history.snapshots.slice(0, history.index + 1);
    history.snapshots.push(structuredClone(patches));
    if (history.snapshots.length > 50) history.snapshots.shift();
    history.index = history.snapshots.length - 1;
    save();
  };
  const applyOne = (element, patch = {}) => {
    const original = manifest.pages.flatMap(page => page.elements).find(item => item.key === element.dataset.protoKey);
    element.textContent = patch.text ?? original?.text ?? element.textContent;
    element.hidden = patch.hidden ?? false;
    if ('disabled' in element) element.disabled = patch.disabled ?? false;
    const styles = ['color','backgroundColor','fontSize','padding','margin','width','height','left','top'];
    styles.forEach(key => element.style[key] = patch.style?.[key] || '');
    const action = patch.action ?? original?.action;
    if (action) element.dataset.action = JSON.stringify(action); else delete element.dataset.action;
  };
  const applyAll = () => document.querySelectorAll('[data-proto-key]').forEach(element => applyOne(element, patches[element.dataset.protoKey]));
  const showPage = id => {
    currentPage = id;
    document.querySelectorAll('.proto-page').forEach(page => page.hidden = page.dataset.pageId !== id);
    $('#current-page-label').textContent = manifest.pages.find(page => page.id === id)?.title || id;
  };
  const bindNavigationFallback = () => {
    document.querySelectorAll('[data-proto-key]').forEach(element => {
      if (element.dataset.navigationBound === 'true') return;
      element.dataset.navigationBound = 'true';
      element.addEventListener('click', () => {
        if (mode !== 'preview') return;
        const action = element.dataset.action ? JSON.parse(element.dataset.action) : null;
        if (action?.type === 'navigate') showPage(action.target);
      });
    });
  };
  const fillEditor = element => {
    selected = element;
    const patch = patches[element.dataset.protoKey] || {};
    $('#selected-key').textContent = element.dataset.protoKey;
    $('#edit-text').value = element.textContent.trim();
    $('#edit-color').value = patch.style?.color || '#172033';
    $('#edit-background').value = patch.style?.backgroundColor || '#4f46e5';
    $('#edit-hidden').checked = Boolean(patch.hidden);
    $('#edit-disabled').checked = Boolean(patch.disabled);
    const action = element.dataset.action ? JSON.parse(element.dataset.action) : null;
    $('#edit-target').innerHTML = '<option value="">无跳转</option>' + manifest.pages.map(page => '<option value="' + page.id + '">' + page.title + '</option>').join('');
    $('#edit-target').value = action?.target || '';
  };
  const updateSelected = () => {
    if (!selected) return;
    const key = selected.dataset.protoKey;
    const target = $('#edit-target').value;
    patches[key] = {
      text: $('#edit-text').value,
      hidden: $('#edit-hidden').checked,
      disabled: $('#edit-disabled').checked,
      style: { color: $('#edit-color').value, backgroundColor: $('#edit-background').value },
      ...(target ? { action: { type: 'navigate', target } } : {})
    };
    applyOne(selected, patches[key]);
    record();
  };
  const restoreHistory = index => {
    history.index = Math.max(0, Math.min(history.snapshots.length - 1, index));
    patches = structuredClone(history.snapshots[history.index]);
    applyAll(); save();
  };
  const download = (name, value) => {
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    anchor.download = name; anchor.click(); URL.revokeObjectURL(anchor.href);
  };

  document.addEventListener('click', event => {
    const modeButton = event.target.closest('[data-mode]');
    if (modeButton) {
      mode = modeButton.dataset.mode; document.body.dataset.mode = mode;
      $('#editor-panel').hidden = mode !== 'edit'; return;
    }
    if (event.target.id === 'undo-edit') return restoreHistory(history.index - 1);
    if (event.target.id === 'redo-edit') return restoreHistory(history.index + 1);
    if (event.target.id === 'restore-element' && selected) {
      delete patches[selected.dataset.protoKey]; applyOne(selected); record(); fillEditor(selected); return;
    }
    if (event.target.id === 'export-patches') return download('prototype.patches.json', { schemaVersion: 1, manifestId: manifest.id, patches });
    if (event.target.id === 'agent-submit') {
      if (!selected || !$('#agent-request').value.trim()) return;
      comments.push({ id: crypto.randomUUID(), pageId: currentPage, protoKey: selected.dataset.protoKey, request: $('#agent-request').value.trim(), currentPatch: patches[selected.dataset.protoKey] || {}, createdAt: new Date().toISOString(), status: 'open' });
      localStorage.setItem(storageKey + ':comments', JSON.stringify(comments));
      $('#agent-request').value = ''; $('#agent-status').textContent = '修改任务已保存'; return;
    }
    if (event.target.id === 'export-comments') return download('agent-comments.json', { schemaVersion: 1, manifestId: manifest.id, comments });
    const element = event.target.closest('[data-proto-key]');
    if (!element) return;
    if (mode === 'edit') {
      document.querySelectorAll('.is-selected').forEach(node => node.classList.remove('is-selected'));
      element.classList.add('is-selected'); fillEditor(element); return;
    }
    const action = element.dataset.action ? JSON.parse(element.dataset.action) : null;
    if (action?.type === 'navigate') showPage(action.target);
  });
  ['edit-text','edit-color','edit-background','edit-hidden','edit-disabled','edit-target'].forEach(id => $('#' + id).addEventListener('change', updateSelected));
  applyAll(); bindNavigationFallback(); showPage(currentPage);
})();`;
