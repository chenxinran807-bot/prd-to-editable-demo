const emojiPattern = /\p{Extended_Pictographic}/u;
const glyphIconPattern = /<(?:span|i|b)[^>]*(?:class|data-role)=["'][^"']*icon[^"']*["'][^>]*>\s*[★☆●○◆◇■□▶◀▲▼✓✔✕✖＋+−-]\s*<\//iu;
const purpleGradientPattern = /(?:linear|radial)-gradient\([^)]*(?:#(?:7c3aed|8b5cf6|9333ea|a855f7|6d28d9)|\b(?:purple|violet)\b)[^)]*\)/iu;
const desktopNavigationPattern = /<(?:nav|aside)[^>]*(?:class|data-component)=["'][^"']*(?:desktop|sidebar|left-nav|top-menu)[^"']*["']/iu;
const fakePhonePattern = /(?:class|data-component)=["'][^"']*(?:phone-frame|device-frame|iphone-frame|mobile-mockup)[^"']*["']/iu;

function failure(rule, message, evidence = []) {
  return { rule, message, evidence };
}

function valuesOf(requirements, key) {
  return Array.isArray(requirements?.[key]) ? requirements[key].filter(Boolean) : [];
}

function missingFromMarkup(markup, values, attribute) {
  return values.filter(value => {
    if (attribute && new RegExp(`${attribute}\\s*=\\s*["']${escapeRegExp(value)}["']`, 'iu').test(markup)) return false;
    return !markup.includes(value);
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assetUrls(markup) {
  return [...markup.matchAll(/<(?:img|image|script|link|source)\b[^>]*(?:src|href)\s*=\s*["']([^"']+)["']/giu)]
    .map(match => match[1]);
}

function isExternal(value) {
  return /^(?:https?:)?\/\//iu.test(value) || /^data:/iu.test(value);
}

function normalizeAsset(value) {
  return value.replace(/^\.\//u, '').split(/[?#]/u)[0];
}

export function auditNativeDesign(markup, options = {}) {
  const source = typeof markup === 'string' ? markup : JSON.stringify(markup ?? {});
  const requirements = options.requirements ?? {};
  const references = options.references ?? {};
  const failures = [];
  const checks = [];

  const run = (rule, violation, message, evidence = []) => {
    const passed = !violation;
    checks.push({ rule, status: passed ? 'passed' : 'failed' });
    if (!passed) failures.push(failure(rule, message, evidence));
  };

  run('no-emoji', emojiPattern.test(source), '界面包含 Emoji，应改为经过授权的 SVG 或原生图标。');
  run('no-text-glyph-icons', glyphIconPattern.test(source), '检测到用文字字符模拟图标。');
  run('no-generic-purple-gradient', purpleGradientPattern.test(source), '检测到通用 AI 风格紫色渐变。');
  run('no-desktop-navigation', desktopNavigationPattern.test(source), '移动端原型包含桌面侧栏或桌面导航模式。');
  run('no-fake-phone-frame', fakePhonePattern.test(source), '最终 Inspire 画布不应再嵌套假手机外框。');

  const urls = assetUrls(source);
  const approvedOrigins = options.approvedOrigins ?? [];
  const unapprovedExternal = urls.filter(url => isExternal(url) && !approvedOrigins.some(origin => url.startsWith(origin)));
  run('approved-assets-only', unapprovedExternal.length > 0, '检测到未经批准的外部或内嵌资源。', unapprovedExternal);

  const referencedIcons = new Set((references.icons ?? []).map(icon => normalizeAsset(icon.file)));
  const usedIcons = urls.map(normalizeAsset).filter(url => /\.svg$/iu.test(url));
  const iconsWithoutProvenance = usedIcons.filter(icon => !referencedIcons.has(icon));
  run('icon-provenance', iconsWithoutProvenance.length > 0, '存在没有来源与许可记录的图标。', iconsWithoutProvenance);

  const missingActions = missingFromMarkup(source, valuesOf(requirements, 'actions'), 'data-action');
  run('required-actions', missingActions.length > 0, 'PRD 必要操作未完整实现。', missingActions);

  const missingComponents = missingFromMarkup(source, valuesOf(requirements, 'components'), 'data-component');
  run('native-components', missingComponents.length > 0, '缺少必要的移动端原生组件。', missingComponents);

  const missingStates = missingFromMarkup(source, valuesOf(requirements, 'states'), 'data-state');
  run('state-coverage', missingStates.length > 0, '关键成功、失败或空状态覆盖不完整。', missingStates);

  const missingLabels = missingFromMarkup(source, valuesOf(requirements, 'touchLabels'));
  run('touch-labels', missingLabels.length > 0, '必要触控操作缺少可理解的文字标签。', missingLabels);

  return {
    status: failures.length === 0 ? 'passed' : 'failed',
    failures,
    checks,
    subjectiveReview: {
      status: 'required',
      reason: '视觉层级、品牌原生感和业务语义需要对照参考图进行人工或多模态评审，确定性规则不得自动放行。'
    }
  };
}
