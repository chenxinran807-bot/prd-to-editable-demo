import { validateModel } from './validate-model.mjs';

function stateFor(title, states) {
  const text = `${title} ${states.join(' ')}`;
  if (/失败|错误|异常|驳回/.test(text) && /失败|错误|异常|驳回/.test(title)) return 'error';
  if (/成功|完成|已确认|已批准|结果|凭证/.test(title)) return 'success';
  if (/空|暂无/.test(title)) return 'empty';
  if (/审核中|处理中|生成中|加载中|待确认|待审批/.test(title)) return 'loading';
  return 'default';
}

export function semanticRequirementsToModel(requirements) {
  const pageIds = new Map(requirements.screens.map((title, index) => [title, `page-${index + 1}`]));
  const outgoing = new Map();
  for (const transition of requirements.transitions) {
    if (!outgoing.has(transition.from)) outgoing.set(transition.from, []);
    outgoing.get(transition.from).push(transition);
  }
  const pages = requirements.screens.map((title, pageIndex) => {
    const id = pageIds.get(title);
    const elements = [{ key: `${id}.title`, type: 'heading', text: title, editable: ['text', 'style'] }];
    if (pageIndex === 0) {
      requirements.businessObjects.slice(0, 5).forEach((term, index) => elements.push({
        key: `${id}.object-${index + 1}`, type: 'heading', text: term, editable: ['text', 'style']
      }));
    }
    for (const [index, transition] of (outgoing.get(title) ?? []).entries()) {
      elements.push({
        key: `${id}.action-${index + 1}`, type: 'button', text: transition.action,
        editable: ['text', 'style', 'hidden', 'disabled', 'action'],
        action: { type: 'navigate', target: pageIds.get(transition.to) }
      });
    }
    if (!outgoing.has(title) && pageIndex > 0) {
      elements.push({
        key: `${id}.back`, type: 'button', text: '返回', editable: ['text', 'style', 'action'],
        action: { type: 'navigate', target: pageIds.get(requirements.screens[0]) }
      });
    }
    return { id, title, state: stateFor(title, requirements.states), elements };
  });
  const model = {
    schemaVersion: 1,
    id: 'semantic-editable-demo',
    product: { name: requirements.title, goal: requirements.goal },
    persona: { name: requirements.actor, need: requirements.goal },
    requirements,
    traceability: requirements.evidence.map(item => ({ kind: item.kind, term: item.term, evidence: item.quote })),
    startPage: pages[0]?.id,
    pages,
    assumptions: requirements.assumptions.map((statement, index) => ({ id: `assumption-${index + 1}`, statement, source: 'model-semantic' })),
    gaps: requirements.gaps.map((statement, index) => ({ id: `gap-${index + 1}`, statement, impact: 'medium' }))
  };
  return validateModel(model);
}
