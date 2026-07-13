export function selectRoute({ intent = '', assets = [], source = '', url } = {}) {
  const normalized = intent.toLowerCase();
  const headingCount = (source.match(/^##\s+/gm) || []).length;
  const stateSignals = (source.match(/已修复|排查中|处理中|成功|失败|删除|重试|状态|异常|空状态/g) || []).length;
  const isComplex = /(完整用户旅程|多角色|复杂状态|产品方案|先梳理需求|需求理解)/i.test(normalized) || headingCount >= 4 || stateSignals >= 6 || source.length > 5000;
  const hasVisualEvidence = assets.some(asset => /(?:screen|screenshot|mockup|figma|设计稿|截图|flow|页面)/i.test(asset)) || /!\[[^\]]*\]\(|<img\b/i.test(source);
  const hasFlow = assets.some(asset => /(flow|流程|页面|screen)/i.test(asset));
  const hasSlices = assets.length >= 2;
  if (/(react|研发交付|内部组件|codebase|工程)/i.test(normalized)) {
    return { id: 'vne', reason: '明确要求工程化或研发交付' };
  }
  if (/(inspire|收纳箱|云端画布)/i.test(normalized)) {
    return { id: 'inspire', reason: '明确要求 Inspire 资产能力' };
  }
  if (/(open\s*design|花叔\s*design|花叔|设计工作区|品牌级视觉探索)/i.test(normalized)) {
    return { id: 'open-design', reason: '明确要求设计工作区或品牌级视觉探索能力' };
  }
  if (url) {
    return { id: 'vne', reason: '提供了真实页面 URL，需要专业页面读取与复刻能力' };
  }
  if (hasFlow && hasSlices && /(像素|还原|切图|figma)/i.test(normalized)) {
    return { id: 'figma-flow', reason: '存在完整流程素材且要求精确还原' };
  }
  if (isComplex && hasVisualEvidence) {
    return { id: 'pm-kakaxi', stages: ['prd-generator', 'pm-kakaxi'], reason: '复杂 PRD 同时包含视觉证据，先完成产品级理解，再进行高保真原型交付' };
  }
  if (/(截图|设计稿|组件库|高保真|视觉还原|kakaxi)/i.test(normalized)) {
    return { id: 'pm-kakaxi', reason: '存在视觉还原或设计稿输入，交给专业高保真能力' };
  }
  if (assets.some(asset => /(?:screen|screenshot|mockup|figma|设计稿|截图)/i.test(asset))) {
    return { id: 'pm-kakaxi', reason: '检测到界面截图或设计稿素材，交给专业高保真能力' };
  }
  if (/(完整用户旅程|多角色|复杂状态|产品方案|先梳理需求|需求理解)/i.test(normalized)) {
    return { id: 'prd-generator', reason: '需求包含复杂旅程或状态，需要先完成产品级需求理解' };
  }
  if (isComplex) {
    return { id: 'prd-generator', reason: 'PRD 规模或状态分支较复杂，先完成产品级需求理解' };
  }
  return { id: 'local', reason: '快速评审原型默认路径' };
}
