function toInspire(stages, reason, extra = {}) {
  const normalizedStages = [...new Set([...stages.filter(stage => stage !== 'inspire'), 'inspire'])];
  return { id: 'inspire', stages: normalizedStages, finalContainer: 'inspire', deliveryMode: 'professional', reason, ...extra };
}

export function selectRoute({ intent = '', assets = [], source = '', url } = {}) {
  const normalized = intent.toLowerCase();
  const headingCount = (source.match(/^##\s+/gm) || []).length;
  const stateSignals = (source.match(/已修复|排查中|处理中|成功|失败|删除|重试|状态|异常|空状态/g) || []).length;
  const isComplex = /(完整用户旅程|多角色|复杂状态|产品方案|先梳理需求|需求理解)/i.test(normalized) || headingCount >= 4 || stateSignals >= 6 || source.length > 5000;
  const hasVisualEvidence = assets.some(asset => /(?:screen|screenshot|mockup|figma|设计稿|截图|flow|页面)/i.test(asset)) || /!\[[^\]]*\]\(|<img\b/i.test(source);
  const hasFlow = assets.some(asset => /(flow|流程|页面|screen)/i.test(asset));
  const hasSlices = assets.length >= 2;
  if (/(快速评审|优先速度|可演示初版|低保真|草模)/i.test(normalized)) {
    return { id: 'local', deliveryMode: 'fast-review', finalContainer: 'local-html', reason: '用户明确选择速度优先的快速评审初版' };
  }
  if (/(react|研发交付|内部组件|codebase|工程)/i.test(normalized)) {
    return toInspire([], '先在 Inspire 完成可编辑原型，再生成工程交付', { postExports: ['engineering'] });
  }
  if (/(inspire|收纳箱|云端画布)/i.test(normalized)) {
    return toInspire(['inspire'], '明确要求 Inspire 资产能力');
  }
  if (/(open\s*design|花叔\s*design|花叔|设计工作区|品牌级视觉探索)/i.test(normalized)) {
    return toInspire([], '使用随包视觉协议完成品牌级视觉约束，再交付到 Inspire');
  }
  if (url) {
    return toInspire([], '读取参考页面证据并交付到 Inspire');
  }
  if (hasFlow && hasSlices && /(像素|还原|切图|figma)/i.test(normalized)) {
    return toInspire([], '按完整流程素材形成还原约束，再交付到 Inspire');
  }
  if (isComplex && hasVisualEvidence) {
    return toInspire([], '使用随包语义与视觉协议处理复杂 PRD 和视觉证据，再交付到 Inspire');
  }
  if (/(截图|设计稿|组件库|高保真|视觉还原|kakaxi)/i.test(normalized)) {
    return toInspire([], '根据视觉证据生成高保真结果并交付到 Inspire');
  }
  if (assets.some(asset => /(?:screen|screenshot|mockup|figma|设计稿|截图)/i.test(asset))) {
    return toInspire([], '检测到界面截图或设计稿素材，按视觉证据生成并交付到 Inspire');
  }
  if (/(完整用户旅程|多角色|复杂状态|产品方案|先梳理需求|需求理解)/i.test(normalized)) {
    return toInspire([], '使用随包语义与交互协议完成复杂旅程和状态理解，再交付到 Inspire');
  }
  if (isComplex) {
    return toInspire([], 'PRD 规模或状态分支较复杂，使用随包能力理解后交付到 Inspire');
  }
  return toInspire([], '默认采用最佳效果的 Inspire 专业交付');
}
