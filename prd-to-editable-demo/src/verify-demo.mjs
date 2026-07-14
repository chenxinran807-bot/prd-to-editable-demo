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
  const stateCategory = state => {
    if (/失败|错误|异常|驳回/u.test(state)) return 'error';
    if (/成功|完成|通过|已支付|已退款/u.test(state)) return 'success';
    if (/空|暂无/u.test(state)) return 'empty';
    if (/加载|处理中|审核中|生成中|上传中|待审核|待确认/u.test(state)) return 'loading';
    if (/禁用/u.test(state)) return 'disabled';
    return null;
  };
  const coversState = state => {
    if (visibleCopy.includes(state)) return true;
    const category = stateCategory(state);
    if (category === 'disabled') return manifest.pages.flatMap(page => page.elements ?? []).some(element => element.disabled);
    return category ? manifest.pages.some(page => page.state === category) : false;
  };
  for (const state of manifest.requirements?.states ?? []) {
    if (!coversState(state)) throw new Error(`quality check failed: declared state coverage (${state})`);
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
