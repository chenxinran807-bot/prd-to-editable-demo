import { validateModel } from './validate-model.mjs';

function slugify(text, fallback) {
  const ascii = text.toLowerCase().match(/[a-z0-9]+/g)?.join('-');
  if (ascii) return ascii;
  const known = { '待提交列表': 'pending-list', '审核确认': 'review', '提交成功': 'success' };
  return known[text] ?? fallback;
}

function cleanHeading(text) {
  return text.replace(/<!--.*?-->/g, '').replace(/\s+/g, ' ').trim();
}

function requirementText(source) {
  return source
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/!\[[\s\S]*?\]\([^\n]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .split('\n')
    .filter(line => !/^\s*(?:图片展示|该图片|这张图片|画面中|caption=|href=)/.test(line))
    .join('\n')
    .replace(/&(?:#x?[0-9a-f]+|\w+);/gi, ' ');
}

function inferActor(source, title) {
  const explicit = source.match(/用户[：:]\s*(.+)/)?.[1]?.trim();
  if (explicit) return explicit;
  if (/用户|本人|内测/.test(source)) {
    const product = title.replace(/[【[].*?[】\]]/g, '').replace(/[-—–].*$/, '').trim();
    return product ? `${product}用户` : '产品用户';
  }
  return '未明确';
}

function inferGoal(source) {
  const explicit = source.match(/目标[：:]\s*(.+)/)?.[1]?.trim();
  if (explicit) return explicit;
  const candidates = source.split(/\n|。|；/).map(cleanHeading).filter(Boolean);
  const need = candidates.find(line => /(?:需要|改成|改为|补齐|立即|引导用户)/.test(line) && line.length >= 8 && line.length <= 100);
  return need?.replace(/^[-*\d.、\s]+/, '') ?? '未明确';
}

function extractBullets(body) {
  return [...body.matchAll(/^\s*[-*]\s+(.+)$/gm)]
    .map(match => cleanHeading(match[1]).replace(/\*\*/g, ''))
    .filter(text => text.length > 2 && text.length < 140);
}

function extractActions(body) {
  const quoted = [...body.matchAll(/(?:点击|选择|上传|拍照|提交|确认|删除|取消|返回|查看|编辑|刷新|重试|试穿|加购|创建|提供|标记)[^“「『\n]{0,8}[“「『](.+?)[”」』]/g)]
    .map(match => cleanHeading(match[1]));
  if (quoted.length) return [...new Set(quoted)].filter(text => text.length >= 2 && text.length <= 24);
  const verbs = [...body.matchAll(/(?:点击|选择|上传|拍照|提交|确认|删除|取消|返回|查看|编辑|刷新|重试|试穿|加购|标记)([^，。；\n]{0,12})/g)]
    .map(match => cleanHeading(match[0]));
  return [...new Set(verbs)].filter(text => text.length >= 2 && text.length <= 24);
}

const ACTION_VERBS = ['创建', '上传', '拍照', '选择', '查看', '编辑', '提交', '确认', '删除', '取消', '返回', '刷新', '重试', '试穿', '加购', '搜索', '筛选', '分享', '下载', '标记'];
const STATE_WORDS = ['未开始', '未创建', '处理中', '生成中', '试穿中', '排查中', '已完成', '成功', '失败', '错误', '异常', '为空', '空状态', '已读', '未读', '禁用'];
const OBJECT_WORDS = ['用户', '商品', '内容', '照片', '图片', '服饰', '订单', '库存', '补货单', '通知', '任务', '审核', '报告', '文件', '页面', '账号', '门店', '方案'];

function matchingTerms(source, terms) {
  return terms.filter(term => source.includes(term));
}

function evidenceFor(source, term) {
  return source.split(/\n|。|；/).map(line => cleanHeading(line).replace(/^[-*]\s*/, '')).find(line => line.includes(term)) ?? term;
}

function extractBusinessObjects(source) {
  const objectVerbs = ['展示', '维护', '保存', ...ACTION_VERBS, '新增'];
  const phrases = [...source.matchAll(/(?:展示|维护|保存|查看|选择|上传|创建|新增|编辑|提交|删除|搜索|筛选|标记)(?:“|「)?([^”，。；\n]{1,24})/g)]
    .map(match => match[1]);
  const inferred = phrases.flatMap(phrase => phrase.split(/和|及|、|并|后|时/))
    .map(rawTerm => {
      let term = rawTerm
      .replace(/^点击[“「]?/, '')
      .replace(/^(?:一个|新的|该|当前|目标|了)/, '')
      .replace(/(?:✅|❌|目前|已经).*$/, '')
      .replace(/[的之]$/, '')
      .replace(/(?:入口|按钮|功能|信息|状态)$/, '')
      .replace(/(?:进入|允许|支持|可以).*$/, '')
      .trim();
      const nestedAction = objectVerbs.reduce((found, verb) => {
        const index = term.lastIndexOf(verb);
        return index > found.index ? { index, verb } : found;
      }, { index: -1, verb: '' });
      if (nestedAction.index >= 0) term = term.slice(nestedAction.index + nestedAction.verb.length).trim();
      return term;
    })
    .filter(term => term.length >= 2 && term.length <= 12)
    .filter(term => !ACTION_VERBS.includes(term))
    .filter(term => !STATE_WORDS.some(state => term.includes(state)))
    .filter(term => !/^(?:需|应|会|还|就|则|可|能)/.test(term))
    .filter(term => !/(?:人员|用户)$/.test(term));
  return [...new Set([...matchingTerms(source, OBJECT_WORDS), ...inferred])]
    .filter(term => term !== '用户' && term !== '页面');
}

export function analyzeRequirements(source, { title, actor, goal } = {}) {
  const analysisSource = requirementText(source);
  const resolvedTitle = title ?? cleanHeading(source.match(/^#\s+(.+)$/m)?.[1] ?? '未命名原型');
  const userActions = matchingTerms(analysisSource, ACTION_VERBS);
  const states = matchingTerms(analysisSource, STATE_WORDS).map(state => state === '为空' || state === '空状态' ? '空' : state);
  const businessObjects = extractBusinessObjects(analysisSource);
  const traceability = [
    ...businessObjects.map(term => ({ kind: 'business-object', term, evidence: evidenceFor(analysisSource, term) })),
    ...userActions.map(term => ({ kind: 'user-action', term, evidence: evidenceFor(analysisSource, term) })),
    ...states.map(term => ({ kind: 'state', term, evidence: evidenceFor(analysisSource, term === '空' ? '空' : term) }))
  ];
  return {
    title: resolvedTitle,
    actor: actor ?? inferActor(analysisSource, resolvedTitle),
    goal: goal ?? inferGoal(analysisSource),
    businessObjects,
    userActions,
    states: [...new Set(states)],
    traceability
  };
}

function findTarget(text, pages, currentIndex) {
  const explicit = pages.find(page => text.includes(page.title));
  if (explicit) return explicit.id;
  if (/返回|取消/.test(text)) return pages[0].id;
  return pages[Math.min(currentIndex + 1, pages.length - 1)].id;
}

export function parsePrd(source) {
  const title = cleanHeading(source.match(/^#\s+(.+)$/m)?.[1] ?? '未命名原型');
  const personaText = source.match(/用户[：:]\s*(.+)/)?.[1]?.trim() ?? '目标用户（根据需求推断）';
  const goal = source.match(/目标[：:]\s*(.+)/)?.[1]?.trim() ?? '完成 PRD 描述的核心任务';
  const sections = [...source.matchAll(/^##\s+(.+)\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gm)];
  const inferred = sections.length < 2;
  const rawPages = inferred
    ? [{ title: '功能首页', body: source }, { title: '操作结果', body: '展示操作完成结果。' }]
    : sections.map(match => ({ title: cleanHeading(match[1]), body: match[2].trim() }));
  const pages = rawPages.map((page, index) => ({
    id: slugify(page.title, `page-${index + 1}`),
    title: page.title,
    state: /成功|完成/.test(page.title) ? 'success' : 'default',
    elements: []
  }));

  rawPages.forEach((rawPage, pageIndex) => {
    const page = pages[pageIndex];
    const bullets = extractBullets(rawPage.body).slice(0, 5);
    bullets.forEach((text, elementIndex) => page.elements.push({ key: `${page.id}.detail-${elementIndex + 1}`, type: 'heading', text, editable: ['text', 'style'] }));
    const buttonLabels = extractActions(rawPage.body);
    const labels = buttonLabels.length ? buttonLabels : pageIndex < pages.length - 1 ? ['继续'] : ['返回首页'];
    page.elements.push({
      key: `${page.id}.title`, type: 'heading', text: page.title, editable: ['text', 'style']
    });
    labels.forEach((label, elementIndex) => {
      page.elements.push({
        key: `${page.id}.action-${elementIndex + 1}`,
        type: 'button',
        text: label,
        editable: ['text', 'style', 'hidden', 'disabled', 'action'],
        action: { type: 'navigate', target: findTarget(label + rawPage.body, pages, pageIndex) }
      });
    });
  });

  const errorClause = source.split(/\n|。|；/).map(line => cleanHeading(line).replace(/^[-*]\s*/, '')).find(line => /失败|错误|异常/.test(line));
  if (errorClause && !pages.some(page => page.state === 'error')) {
    const sourceIndex = rawPages.findIndex(page => /失败|错误|异常/.test(page.body));
    const title = cleanHeading(errorClause.match(/(.{1,16}?(?:失败|错误|异常))/)?.[1] ?? '操作失败');
    pages.push({
      id: 'error-state', title, state: 'error', elements: [
        { key: 'error-state.title', type: 'heading', text: title, editable: ['text', 'style'] },
        { key: 'error-state.detail', type: 'heading', text: errorClause, editable: ['text', 'style'] },
        { key: 'error-state.retry', type: 'button', text: /重试/.test(errorClause) ? '重试' : '返回', editable: ['text', 'style', 'action'], action: { type: 'navigate', target: pages[Math.max(0, sourceIndex)]?.id ?? pages[0].id } }
      ]
    });
  }

  const hasEmptyState = /空状态|为空|没有内容/.test(source);
  if (hasEmptyState) {
    pages.push({
      id: 'empty-state', title: '暂无内容', state: 'empty', elements: [
        { key: 'empty-state.title', type: 'heading', text: '暂无内容', editable: ['text', 'style'] },
        { key: 'empty-state.back', type: 'button', text: '返回', editable: ['text', 'style', 'action'], action: { type: 'navigate', target: pages[0].id } }
      ]
    });
  }

  const requirements = analyzeRequirements(source, { title, actor: personaText, goal });
  const model = {
    schemaVersion: 1,
    id: slugify(title, 'editable-demo'),
    product: { name: title, goal },
    persona: { name: personaText, need: goal },
    requirements: {
      actor: requirements.actor,
      goal: requirements.goal,
      businessObjects: requirements.businessObjects,
      userActions: requirements.userActions,
      states: requirements.states
    },
    traceability: requirements.traceability,
    startPage: pages[0].id,
    pages,
    assumptions: inferred ? [{ id: 'assumption-1', statement: '页面结构由简短需求推断为首页和结果页', source: 'parser' }] : [],
    gaps: inferred ? [{ id: 'gap-1', statement: 'PRD 未明确页面、异常状态和完整跳转规则', impact: 'medium' }] : []
  };
  return validateModel(model);
}
