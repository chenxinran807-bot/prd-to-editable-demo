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
    requirements.states
      .filter((_, stateIndex) => stateIndex % requirements.screens.length === pageIndex)
      .forEach((state, stateIndex) => elements.push({
        key: `${id}.state-${stateIndex + 1}`, type: 'heading', text: state, editable: ['text', 'style']
      }));
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

export function executionBaselineToModel(baseline, product) {
  const pages = baseline.pages.map((page) => {
    const regionRank = new Map(page.regions.map((region, index) => [region.id, index]));
    const requirements = page.requirements
      .map((requirement, index) => ({ requirement, index }))
      .sort((left, right) => {
        const rank = ({ requirement }) => {
          const targets = requirement.targetIds.filter((id) => regionRank.has(id));
          return targets.length ? Math.min(...targets.map((id) => regionRank.get(id))) : -1;
        };
        return rank(left) - rank(right) || left.index - right.index;
      })
      .map(({ requirement }) => requirement);
    const elements = requirements.map((requirement) => ({
      key: `${page.id}.requirement.${requirement.id}`,
      type: requirement.componentType ?? 'heading',
      text: requirement.exactCopy ?? requirement.text,
      editable: ['text', 'style'],
      requirementId: requirement.id,
      regionId: requirement.targetIds.find((id) => regionRank.has(id)),
      sourceIds: structuredClone(requirement.sourceIds ?? []),
      certainty: requirement.certainty,
      state: requirement.state,
      visibleState: requirement.visibleState,
      acceptanceCriteria: structuredClone(requirement.acceptanceCriteria ?? []),
      requirement: structuredClone(requirement),
    }));
    for (const action of page.actions) {
      elements.push({
        key: `${page.id}.action.${action.id}`,
        type: 'button',
        text: action.exactCopy ?? action.name,
        editable: ['text', 'style', 'hidden', 'disabled', 'action'],
        actionId: action.id,
        regionId: action.regionId,
        trigger: action.trigger,
        visibleFeedback: action.visibleFeedback,
        stateChange: action.stateChange,
        requirementIds: structuredClone(action.requirementIds ?? []),
        action: { type: 'navigate', target: action.toPageId },
      });
    }
    return { id: page.id, title: page.name, state: 'default', elements };
  });
  const model = {
    schemaVersion: 1,
    id: 'execution-baseline-editable-demo',
    product: structuredClone(product),
    taxonomy: structuredClone(baseline.taxonomy),
    coreJourneys: structuredClone(baseline.coreJourneys),
    executionBaseline: baseline,
    startPage: pages[0]?.id,
    pages,
  };
  return validateModel(model);
}
