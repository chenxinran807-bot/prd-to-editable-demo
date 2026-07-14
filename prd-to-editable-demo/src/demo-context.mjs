function confidence(value, fallback = 'medium') {
  return ['high', 'medium', 'low'].includes(value) ? value : fallback;
}

export function buildDemoContext({ requirements = {}, source = '', visualEvidence = [] } = {}) {
  const transitions = requirements.transitions ?? [];
  return {
    schemaVersion: 1,
    mode: 'professional-direct',
    product: {
      title: requirements.title ?? '未命名原型',
      actor: requirements.actor ?? '未明确',
      goal: requirements.goal ?? '未明确',
      businessObjects: requirements.businessObjects ?? []
    },
    completeness: {
      semantic: confidence(requirements.confidence, requirements.extractionMode === 'model-semantic' ? 'high' : 'medium'),
      interaction: transitions.length ? 'high' : 'low',
      state: (requirements.states ?? []).length ? 'medium' : 'low',
      visual: visualEvidence.length ? 'medium' : 'low'
    },
    pageUnits: (requirements.screens ?? []).map((name, index) => ({
      id: `P-${String(index + 1).padStart(2, '0')}`, name, type: 'screen', source: 'PRD', confidence: 'high'
    })),
    visualInventory: visualEvidence.map((evidence, index) => ({
      id: `V-${String(index + 1).padStart(2, '0')}`, ...evidence, source: evidence.source ?? evidence.type, confidence: evidence.confidence ?? 'high'
    })),
    interactionInventory: transitions.map((transition, index) => ({
      id: `I-${String(index + 1).padStart(2, '0')}`,
      from: transition.from, trigger: transition.action, behavior: `进入${transition.to}`, to: transition.to,
      source: transition.evidence ? 'PRD' : '默认推断', evidence: transition.evidence ?? null,
      confidence: transition.evidence ? 'high' : 'medium'
    })),
    stateMatrix: (requirements.states ?? []).map((label, index) => ({
      id: `S-${String(index + 1).padStart(2, '0')}`, key: `state-${index + 1}`, label, source: 'PRD', mustHave: [label]
    })),
    assumptions: requirements.assumptions ?? [],
    openQuestions: (requirements.gaps ?? []).map((question, index) => ({
      id: `Q-${String(index + 1).padStart(2, '0')}`, question, impact: '影响正式视觉或业务完整度', blockingLevel: 'soft'
    })),
    doNotInfer: [
      '不得编造 PRD 未提供的价格、销量、优惠、库存或营销承诺',
      '不得把文档章节标题机械生成为页面',
      '不得用 Emoji 或文字字符冒充正式图标'
    ],
    evidenceSources: [
      ...(requirements.evidence ?? []).map((item, index) => ({ id: `E-${String(index + 1).padStart(2, '0')}`, type: 'PRD证据', ...item })),
      ...visualEvidence.map((item, index) => ({ id: `VE-${String(index + 1).padStart(2, '0')}`, type: item.type ?? '视觉证据', scope: item.scope ?? item.id })),
      { id: 'E-PRD', type: '完整PRD', content: source }
    ]
  };
}
