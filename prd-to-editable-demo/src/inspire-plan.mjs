function list(value) {
  return Array.isArray(value) && value.length ? value.join('、') : '未明确';
}

function renderInspirePrompt({ requirements, stages }) {
  return [
    `产品：${requirements.title ?? '未命名产品'}`,
    `用户：${requirements.actor ?? '未明确'}`,
    `目标：${requirements.goal ?? '未明确'}`,
    `业务对象：${list(requirements.businessObjects)}`,
    `关键动作：${list(requirements.userActions)}`,
    `必须覆盖的状态：${list(requirements.states)}`,
    `前置专业阶段：${stages.filter(stage => stage !== 'inspire').join(' → ') || '无'}`,
    '',
    '交付一个可运行、可在 Inspire 中继续编辑的移动端交互原型。',
    '保持 PRD 事实与推断分离，关键动作必须可点击，异常与中间状态不得遗漏。',
    '使用所选业务设计 Skill 的正式组件、SVG Icon、字体、间距和移动端布局规则。',
    'Emoji 数量必须为 0；不得用文字字符冒充 Icon；不得生成通用紫色渐变、桌面侧栏、伪手机外壳或无来源品牌标识。'
  ].join('\n');
}

export function buildInspirePlan({ route, requirements = {}, inputs = {}, designSkill, parentAssetId = null }) {
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
    prompt: renderInspirePrompt({ requirements, stages }),
    stages,
    acceptance: {
      finalContainer: 'inspire',
      noEmoji: true,
      preserveAcceptedParent: true,
      manualEditing: ['image', 'icon', 'position', 'size', 'text', 'color']
    }
  };
}
