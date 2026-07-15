function list(value) {
  return Array.isArray(value) && value.length ? value.join('、') : '未明确';
}

function experienceLabel(type) {
  if (type === 'browse') return '多入口浏览型';
  if (type === 'linear') return '线性流程型';
  return '未明确';
}

function transitionList(value) {
  if (!Array.isArray(value) || !value.length) return '未明确';
  return value.map(item => `${item.from} --${item.action || '操作'}--> ${item.to}`).join('\n');
}

function renderInspirePrompt({ requirements, stages }) {
  return [
    `产品：${requirements.title ?? '未命名产品'}`,
    `用户：${requirements.actor ?? '未明确'}`,
    `目标：${requirements.goal ?? '未明确'}`,
    `业务对象：${list(requirements.businessObjects)}`,
    `关键动作：${list(requirements.userActions)}`,
    `必须覆盖的状态：${list(requirements.states)}`,
    `PRD 类型：${experienceLabel(requirements.experienceType)}`,
    `页面/浮层：${list(requirements.screens)}`,
    '流转规则：',
    transitionList(requirements.transitions),
    `前置专业阶段：${stages.filter(stage => stage !== 'inspire').join(' → ') || '无'}`,
    '',
    requirements.experienceType === 'browse'
      ? '这是多入口浏览型 PRD：优先保证 Tab、卡片反馈、详情和弹层的覆盖广度，并保持各入口返回上下文。'
      : requirements.experienceType === 'linear'
        ? '这是线性流程型 PRD：按状态机逐步实现主路径、分支、失败重试和回流，不为增加截图数虚构页面。'
        : '先依据明确证据组织页面与状态；不把文档章节标题机械生成为页面。',
    '交付一个可运行、可在 Inspire 中继续编辑的移动端交互原型。',
    '保持 PRD 事实与推断分离；按任务推导页面，不把文档章节机械变成页面。',
    '交互必须写清触发条件 → 系统行为 → 用户反馈，主流程、返回路径和适用的状态矩阵必须可演示。',
    '状态矩阵按需覆盖默认、加载、空、错误、禁用、权限和成功；不适用时说明原因，不虚构页面。',
    '使用所选业务设计 Skill 的正式组件、SVG Icon、字体、间距和移动端布局规则。',
    'Emoji 数量必须为 0；不得用文字字符冒充 Icon；不得生成通用紫色渐变、桌面侧栏、伪手机外壳或无来源品牌标识。',
    '图片、Icon、位置、大小、文字、颜色、显隐、状态和跳转必须可继续编辑并支持撤销。',
    '生成后提供业务覆盖、流转、素材来源和可编辑性的证据；确定性规则通过后仍需主观视觉审查。'
  ].join('\n');
}

function renderV2Prompt(baseline, visualReferences, stages) {
  const taxonomy = baseline.taxonomy.map(node => `${node.id}:${node.label} parent=${node.parentId ?? 'root'}`).join('\n');
  const pages = baseline.pages.map(page => [
    `PAGE ${page.id} ${page.name}`,
    ...page.regions.map(region => `REGION ${region.id} order=${page.regions.indexOf(region)} layout=${JSON.stringify(region.layout ?? {})} behavior=${JSON.stringify(region.behavior ?? {})} prominence=${JSON.stringify(region.prominence ?? {})}`),
    ...page.requirements.map(req => `REQUIREMENT ${req.id} exactCopy=${JSON.stringify(req.exactCopy ?? req.text)} component=${req.componentType ?? 'default'} state=${req.state ?? ''} visibleState=${req.visibleState ?? ''}`),
    ...page.actions.map(action => `ACTION ${action.id} trigger=${action.trigger} feedback=${action.visibleFeedback} stateChange=${action.stateChange} next=${action.toPageId}`),
  ].join('\n')).join('\n');
  const journeys = baseline.coreJourneys.map(j => `${j.id}: ${j.startPageId} --${j.actionIds.join(' -> ')}--> ${j.expectedEndPageId}`).join('\n');
  const refs = visualReferences.map(ref => `IMAGE ${ref.id} asset=${ref.asset} scope=${JSON.stringify(ref.scope)} bindings=${JSON.stringify(ref.bindings)} exclusions=${JSON.stringify(ref.exclude)}`).join('\n');
  return [`Frozen v2 execution baseline. Do not reinterpret or optimize exact copy, layout, hierarchy, or flow.`, `Taxonomy hierarchy:\n${taxonomy}`, `Page slices:\n${pages}`, `Core journeys:\n${journeys}`, `Unresolved P2:\n${JSON.stringify(baseline.unresolvedNonBlocking ?? [])}`, `Visual references (apply each only to its declared scope/property/fidelity; never blend images into a moodboard):\n${refs || 'none'}`, `Stages: ${stages.join(' -> ')}`].join('\n\n');
}

export function buildInspirePlan({ route, requirements = {}, inputs = {}, executionBaseline, visualReferences = [], designSkill, parentAssetId = null }) {
  if (!designSkill) throw new Error('Inspire business design Skill is required for professional delivery');
  if (route?.finalContainer && route.finalContainer !== 'inspire') throw new Error('professional prototype finalContainer must be inspire');
  const stages = route?.stages?.length ? route.stages : ['inspire'];
  return {
    schemaVersion: 1,
    command: 'generate prototype',
    mode: parentAssetId ? 'iterate' : 'create',
    parentAssetId,
    designSkill,
    outputType: 'html',
    files: inputs.assets ?? [],
    referenceUrl: inputs.referenceUrl ?? null,
    prompt: executionBaseline ? renderV2Prompt(executionBaseline, visualReferences, stages) : renderInspirePrompt({ requirements, stages }),
    stages,
    acceptance: {
      finalContainer: 'inspire',
      noEmoji: true,
      preserveAcceptedParent: true,
      manualEditing: ['image', 'icon', 'position', 'size', 'text', 'color', 'visibility', 'state', 'navigation']
    }
  };
}
