export function selectRoute({ intent = '', assets = [], source = '' } = {}) {
  const normalized = intent.toLowerCase();
  if (/(react|研发交付|内部组件|codebase|工程)/i.test(normalized)) {
    return { id: 'vne', reason: '明确要求工程化或研发交付' };
  }
  if (/(inspire|收纳箱|云端画布)/i.test(normalized)) {
    return { id: 'inspire', reason: '明确要求 Inspire 资产能力' };
  }
  if (/(截图|设计稿|组件库|高保真|视觉还原|kakaxi)/i.test(normalized)) {
    return { id: 'pm-kakaxi', reason: '存在视觉还原或设计稿输入，交给专业高保真能力' };
  }
  if (/(完整用户旅程|多角色|复杂状态|产品方案|先梳理需求|需求理解)/i.test(normalized)) {
    return { id: 'prd-generator', reason: '需求包含复杂旅程或状态，需要先完成产品级需求理解' };
  }
  const headingCount = (source.match(/^##\s+/gm) || []).length;
  const stateSignals = (source.match(/已修复|排查中|处理中|成功|失败|删除|重试|状态|异常|空状态/g) || []).length;
  if (headingCount >= 4 || stateSignals >= 6 || source.length > 5000) {
    return { id: 'prd-generator', reason: 'PRD 规模或状态分支较复杂，先完成产品级需求理解' };
  }
  const hasFlow = assets.some(asset => /(flow|流程|页面|screen)/i.test(asset));
  const hasSlices = assets.length >= 2;
  if (hasFlow && hasSlices && /(像素|还原|切图|figma)/i.test(normalized)) {
    return { id: 'figma-flow', reason: '存在完整流程素材且要求精确还原' };
  }
  return { id: 'local', reason: '快速评审原型默认路径' };
}
