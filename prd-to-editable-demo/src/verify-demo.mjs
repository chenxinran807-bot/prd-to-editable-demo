import { validateModel } from './validate-model.mjs';

export function verifyDemo({ html, manifest }) {
  validateModel(manifest);
  const visibleCopy = manifest.pages.flatMap(page => [page.title, ...(page.elements ?? []).map(element => element.text)]).join('\n');
  const buttons = manifest.pages.flatMap(page => page.elements ?? []).filter(element => element.type === 'button');
  const genericActions = new Set(['继续', '下一步', '操作', '确认', '完成', '返回首页']);
  if ((manifest.requirements?.userActions?.length ?? 0) > 0 && buttons.length > 0 && buttons.every(button => genericActions.has(button.text))) {
    throw new Error('quality check failed: generic action copy');
  }
  const objects = manifest.requirements?.businessObjects ?? [];
  if (objects.length > 0 && !objects.some(object => visibleCopy.includes(object))) {
    throw new Error('quality check failed: business object coverage');
  }
  if ((manifest.traceability ?? []).some(item => !item.evidence?.trim())) {
    throw new Error('quality check failed: traceability evidence');
  }
  const checks = [
    ['doctype', /<!doctype html>/i],
    ['embedded manifest', /id="prototype-manifest"/],
    ['stable element keys', /data-proto-key="/],
    ['preview control', /data-mode="preview"/],
    ['edit control', /data-mode="edit"/],
    ['editor panel', /id="editor-panel"/],
    ['patch persistence', /localStorage/],
    ['Agent comments', /id="agent-submit"/]
  ];
  for (const [name, pattern] of checks) {
    if (!pattern.test(html)) throw new Error(`quality check failed: ${name}`);
  }
  return checks.map(([name]) => ({ name, passed: true }));
}
