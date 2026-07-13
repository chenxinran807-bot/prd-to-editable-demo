export const specialistRuntimeSource = String.raw`
(() => {
  const config = JSON.parse(document.querySelector('#proto-edit-config').textContent);
  const storageKey = 'prd-specialist-edit:' + config.manifestId;
  let editMode = false;
  let selected = null;
  let patches = JSON.parse(localStorage.getItem(storageKey + ':patches') || '{}');
  let comments = JSON.parse(localStorage.getItem(storageKey + ':comments') || '[]');
  let history = { snapshots: [structuredClone(patches)], index: 0 };
  const $ = selector => document.querySelector(selector);
  const editUi = $('#proto-edit-ui');
  const revealEditor = () => { editUi.hidden = false; };
  const candidateSelector = '[data-proto-key],h1,h2,h3,h4,p,button,a,label,[role="button"]';
  let candidates = [];
  const originals = new Map();
  const save = () => localStorage.setItem(storageKey + ':patches', JSON.stringify(patches));
  const applyOne = element => {
    const original = originals.get(element.dataset.protoKey);
    const patch = patches[element.dataset.protoKey] || {};
    element.textContent = patch.text ?? original.text;
    element.style.color = patch.color ?? original.color;
    element.style.backgroundColor = patch.backgroundColor ?? original.backgroundColor;
    element.hidden = patch.hidden ?? original.hidden;
    if ('disabled' in element && original.disabled !== undefined) element.disabled = patch.disabled ?? original.disabled;
  };
  const refreshCandidates = () => {
    const found = [...document.querySelectorAll(candidateSelector)].filter(element => !element.closest('#proto-edit-ui'));
    found.forEach((element, index) => {
      if (!element.dataset.protoKey) element.dataset.protoKey = 'specialist.' + element.tagName.toLowerCase() + '-' + (index + 1);
      if (!originals.has(element.dataset.protoKey)) {
        originals.set(element.dataset.protoKey, {
          text: element.textContent, color: element.style.color, backgroundColor: element.style.backgroundColor,
          hidden: element.hidden, disabled: 'disabled' in element ? element.disabled : undefined
        });
        if (patches[element.dataset.protoKey]) applyOne(element);
      }
    });
    candidates = found;
  };
  const applyAll = () => candidates.forEach(applyOne);
  const record = () => {
    history.snapshots = history.snapshots.slice(0, history.index + 1);
    history.snapshots.push(structuredClone(patches)); history.index += 1; save();
  };
  const restore = index => {
    history.index = Math.max(0, Math.min(history.snapshots.length - 1, index));
    patches = structuredClone(history.snapshots[history.index]); applyAll(); save();
  };
  const download = (name, value) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const select = element => {
    selected?.classList.remove('proto-edit-selected'); selected = element; selected.classList.add('proto-edit-selected');
    const patch = patches[element.dataset.protoKey] || {};
    $('#proto-selected-key').textContent = element.dataset.protoKey;
    $('#proto-edit-text').value = element.textContent.trim();
    $('#proto-edit-color').value = patch.color || '#172033';
    $('#proto-edit-background').value = patch.backgroundColor || '#ffffff';
    $('#proto-edit-hidden').checked = patch.hidden ?? false;
    $('#proto-edit-disabled').checked = patch.disabled ?? false;
  };
  const update = () => {
    if (!selected) return;
    patches[selected.dataset.protoKey] = {
      text: $('#proto-edit-text').value, color: $('#proto-edit-color').value,
      backgroundColor: $('#proto-edit-background').value,
      hidden: $('#proto-edit-hidden').checked, disabled: $('#proto-edit-disabled').checked
    };
    applyOne(selected); record();
  };
  document.addEventListener('click', event => {
    if (event.target.closest('#proto-edit-ui')) return;
    if (!editMode) return;
    let element = event.target.closest('[data-proto-key]');
    if (!element && event.target.closest(candidateSelector)) {
      refreshCandidates(); element = event.target.closest('[data-proto-key]');
    }
    if (!element) return;
    event.preventDefault(); event.stopImmediatePropagation(); select(element);
  }, true);
  $('#proto-edit-toggle').addEventListener('click', () => {
    editMode = !editMode; document.documentElement.dataset.protoEdit = String(editMode);
    $('#proto-edit-panel').hidden = !editMode; $('#proto-edit-toggle').textContent = editMode ? '退出编辑' : '编辑原型';
  });
  $('#proto-undo').addEventListener('click', () => restore(history.index - 1));
  $('#proto-redo').addEventListener('click', () => restore(history.index + 1));
  $('#proto-export').addEventListener('click', () => download('prototype.patches.json', { schemaVersion: 1, manifestId: config.manifestId, patches }));
  $('#proto-export-comments').addEventListener('click', () => download('agent-comments.json', { schemaVersion: 1, manifestId: config.manifestId, comments }));
  $('#proto-agent-submit').addEventListener('click', () => {
    const request = $('#proto-agent-request').value.trim(); if (!selected || !request) return;
    comments.push({ id: crypto.randomUUID(), protoKey: selected.dataset.protoKey, request, currentPatch: patches[selected.dataset.protoKey] || {}, createdAt: new Date().toISOString(), status: 'open' });
    localStorage.setItem(storageKey + ':comments', JSON.stringify(comments));
    $('#proto-agent-request').value = ''; $('#proto-agent-status').textContent = '修改任务已保存';
  });
  ['proto-edit-text','proto-edit-color','proto-edit-background','proto-edit-hidden','proto-edit-disabled'].forEach(id => $('#' + id).addEventListener('change', update));
  if (new URLSearchParams(location.search).get('edit') === '1' || location.hash === '#edit') revealEditor();
  document.addEventListener('keydown', event => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'e') revealEditor();
  });
  refreshCandidates(); applyAll();
  new MutationObserver(refreshCandidates).observe(document.body, { childList: true, subtree: true });
})();`;
