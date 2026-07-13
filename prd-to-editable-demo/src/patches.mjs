const allowedStyles = new Set(['color', 'backgroundColor', 'fontSize', 'padding', 'margin', 'width', 'height', 'left', 'top']);

export function sanitizePatch(input = {}) {
  const patch = {};
  if (typeof input.text === 'string') patch.text = input.text;
  if (typeof input.hidden === 'boolean') patch.hidden = input.hidden;
  if (typeof input.disabled === 'boolean') patch.disabled = input.disabled;
  if (input.style && typeof input.style === 'object') {
    patch.style = Object.fromEntries(Object.entries(input.style).filter(([key, value]) => allowedStyles.has(key) && typeof value === 'string'));
  }
  if (input.action?.type === 'navigate' && typeof input.action.target === 'string') {
    patch.action = { type: 'navigate', target: input.action.target };
  }
  return patch;
}

export function updateHistory(history, patches) {
  const snapshots = history.snapshots.slice(0, history.index + 1);
  snapshots.push(structuredClone(patches));
  if (snapshots.length > 50) snapshots.shift();
  return { snapshots, index: snapshots.length - 1 };
}

export function undoHistory(history) {
  return { ...history, index: Math.max(0, history.index - 1) };
}

export function redoHistory(history) {
  return { ...history, index: Math.min(history.snapshots.length - 1, history.index + 1) };
}

export function migratePatches(patches, manifest) {
  const validKeys = new Set(manifest.pages.flatMap(page => (page.elements ?? []).map(element => element.key)));
  const applied = {};
  const conflicts = {};
  for (const [key, patch] of Object.entries(patches)) {
    (validKeys.has(key) ? applied : conflicts)[key] = patch;
  }
  return { applied, conflicts };
}
