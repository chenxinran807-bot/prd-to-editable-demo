export function selectRoute({ intent = '', assets = [] } = {}) {
  const normalized = intent.toLowerCase();
  if (/(react|研发交付|内部组件|codebase|工程)/i.test(normalized)) {
    return { id: 'vne', reason: '明确要求工程化或研发交付' };
  }
  if (/(inspire|收纳箱|云端画布)/i.test(normalized)) {
    return { id: 'inspire', reason: '明确要求 Inspire 资产能力' };
  }
  const hasFlow = assets.some(asset => /(flow|流程|页面|screen)/i.test(asset));
  const hasSlices = assets.length >= 2;
  if (hasFlow && hasSlices && /(像素|还原|切图|figma)/i.test(normalized)) {
    return { id: 'figma-flow', reason: '存在完整流程素材且要求精确还原' };
  }
  return { id: 'local', reason: '快速评审原型默认路径' };
}
