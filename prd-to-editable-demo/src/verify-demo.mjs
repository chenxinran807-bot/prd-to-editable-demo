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
  const stateCoverage = {
    '失败': () => manifest.pages.some(page => page.state === 'error') || visibleCopy.includes('失败'),
    '错误': () => manifest.pages.some(page => page.state === 'error') || visibleCopy.includes('错误'),
    '异常': () => manifest.pages.some(page => page.state === 'error') || visibleCopy.includes('异常'),
    '成功': () => manifest.pages.some(page => page.state === 'success') || visibleCopy.includes('成功'),
    '空': () => manifest.pages.some(page => page.state === 'empty') || /暂无|为空|空状态/.test(visibleCopy),
    '处理中': () => visibleCopy.includes('处理中'),
    '排查中': () => visibleCopy.includes('排查中'),
    '未开始': () => visibleCopy.includes('未开始'),
    '已读': () => visibleCopy.includes('已读'),
    '未读': () => visibleCopy.includes('未读'),
    '禁用': () => visibleCopy.includes('禁用') || manifest.pages.flatMap(page => page.elements ?? []).some(element => element.disabled)
  };
  for (const state of manifest.requirements?.states ?? []) {
    if (stateCoverage[state] && !stateCoverage[state]()) throw new Error(`quality check failed: declared state coverage (${state})`);
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
