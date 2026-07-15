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
  const quoted = [...body.matchAll(/(?:点击|选择|上传|拍照|提交|确认|删除|取消|返回|查看|编辑|刷新|重试|创建|提供|标记)[^“「『\n]{0,8}[“「『](.+?)[”」』]/g)]
    .map(match => cleanHeading(match[1]));
  if (quoted.length) return [...new Set(quoted)].filter(text => text.length >= 2 && text.length <= 24);
  const verbs = [...body.matchAll(/(?:点击|选择|上传|拍照|提交|确认|删除|取消|返回|查看|编辑|刷新|重试|标记)([^，。；\n]{0,12})/g)]
    .flatMap(match => cleanHeading(match[0]).split(/并(?=(?:点击|选择|上传|拍照|提交|确认|删除|取消|返回|查看|编辑|刷新|重试|标记))/g));
  return [...new Set(verbs)].filter(text => text.length >= 2 && text.length <= 24);
}

const ACTION_VERBS = ['创建', '发起', '上传', '拍照', '选择', '查看', '编辑', '提交', '确认', '删除', '取消', '返回', '刷新', '重试', '搜索', '筛选', '分享', '下载', '标记', '喜欢', '不喜欢'];
const STATE_WORDS = ['未开始', '未创建', '处理中', '生成中', '排查中', '已完成', '成功', '失败', '错误', '异常', '为空', '空状态', '已读', '未读', '禁用'];
const OBJECT_WORDS = ['用户', '内容', '照片', '图片', '通知', '任务', '审核', '报告', '文件', '页面', '账号', '方案'];

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
  const experience = extractExperience(analysisSource);
  const traceability = [
    ...businessObjects.map(term => ({ kind: 'business-object', term, evidence: evidenceFor(analysisSource, term) })),
    ...userActions.map(term => ({ kind: 'user-action', term, evidence: evidenceFor(analysisSource, term) })),
    ...states.map(term => ({ kind: 'state', term, evidence: evidenceFor(analysisSource, term === '空' ? '空' : term) }))
  ];
  return {
    extractionMode: 'heuristic-fallback',
    confidence: 'low',
    title: resolvedTitle,
    actor: actor ?? inferActor(analysisSource, resolvedTitle),
    goal: goal ?? inferGoal(analysisSource),
    businessObjects,
    userActions,
    states: [...new Set(states)],
    experienceType: experience.experienceType,
    screens: experience.screens,
    transitions: experience.transitions,
    traceability,
    assumptions: ['页面和流程由确定性规则推断，必须由 Agent 或用户复核'],
    gaps: ['未提供模型语义抽取结果，无法保证理解隐含业务关系']
  };
}

function findTarget(text, pages, currentIndex) {
  const explicit = pages.find(page => text.includes(page.title));
  if (explicit) return explicit.id;
  if (/返回|取消/.test(text)) return pages[0].id;
  return pages[Math.min(currentIndex + 1, pages.length - 1)].id;
}

const DOCUMENT_SECTION_PATTERN = /^(?:市场调研|用户调研|竞品分析|方向判断|产品方案|需求背景|项目背景|业务背景|需求目标|核心目标|需求范围|方案说明|功能说明|需求详情|交互说明|核心流程|实验结论|数据分析|风险|附录)$/i;
const SCREEN_SUFFIX_PATTERN = /(?:页|页面|弹窗|浮层|Feed|列表|清单)$/i;

function normalizeScreenTitle(raw) {
  let title = cleanHeading(raw)
    .replace(/^[-*\d.、\s]+/, '')
    .replace(/^(?:页面与流转|页面流转|核心流程|流程|路径)[：:]\s*/, '')
    .replace(/^(?:[^，。；]{0,18}?)(?:进入|打开|返回|跳转至|跳转到)\s*/, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/(?:，|。|；).*$/, '')
    .trim();
  if (/^(?:审核中|上传中|生成中|处理中|加载中)$/.test(title)) return title;
  if (!SCREEN_SUFFIX_PATTERN.test(title)) return '';
  return title.length >= 2 && title.length <= 28 ? title : '';
}

function extractFlowScreens(source) {
  if (!/[→➜➡]|->/.test(source)) return [];
  const candidates = [];
  const add = raw => {
    const title = normalizeScreenTitle(raw);
    if (title && !DOCUMENT_SECTION_PATTERN.test(title) && !candidates.includes(title)) candidates.push(title);
  };
  for (const line of source.split('\n')) {
    if (!/[→➜➡]|->/.test(line)) continue;
    for (const clause of line.split(/[；;]/)) {
      for (const part of clause.split(/\s*(?:→|➜|➡|->)\s*/)) add(part);
    }
  }
  for (const match of source.matchAll(/(?:进入|打开|返回|跳转至|跳转到)\s*([^，。；\n]{1,28}?(?:页|页面|弹窗|浮层|Feed|列表|清单))/gi)) add(match[1]);
  return candidates;
}

function extractExperience(source) {
  const screens = extractFlowScreens(source);
  const transitions = [];
  for (const line of source.split('\n')) {
    if (!/[→➜➡]|->/.test(line)) continue;
    for (const clause of line.split(/[；;]/)) {
      const chain = clause.split(/\s*(?:→|➜|➡|->)\s*/).map(normalizeScreenTitle).filter(Boolean);
      for (let index = 0; index < chain.length - 1; index += 1) {
        transitions.push({ from: chain[index], action: '继续流程', to: chain[index + 1] });
      }
    }
  }
  const browseSignals = (source.match(/(?:Tab|tab|Feed|信息流|内容流|瀑布流|筛选|推荐流|列表浏览|卡片反馈)/g) ?? []).length;
  return {
    experienceType: browseSignals >= 2 ? 'browse' : transitions.length ? 'linear' : 'unspecified',
    screens,
    transitions
  };
}

function pageState(title) {
  if (/失败|错误|异常/.test(title)) return 'error';
  if (/成功|完成/.test(title)) return 'success';
  if (/空|暂无/.test(title)) return 'empty';
  if (/审核中|上传中|生成中|处理中|加载中/.test(title)) return 'loading';
  return 'default';
}

export function parsePrd(source) {
  const title = cleanHeading(source.match(/^#\s+(.+)$/m)?.[1] ?? '未命名原型');
  const personaText = source.match(/用户[：:]\s*(.+)/)?.[1]?.trim() ?? '目标用户（根据需求推断）';
  const goal = source.match(/目标[：:]\s*(.+)/)?.[1]?.trim() ?? '完成 PRD 描述的核心任务';
  const sections = [...source.matchAll(/^##\s+(.+)\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gm)];
  const flowScreens = extractFlowScreens(source);
  const pageSections = sections.filter(match => !DOCUMENT_SECTION_PATTERN.test(cleanHeading(match[1])));
  const inferred = flowScreens.length < 2 && pageSections.length < 2;
  const inferredSubject = title.replace(/(?:功能|需求|方案|原型)$/u, '').trim() || title;
  const rawPages = flowScreens.length >= 2
    ? flowScreens.map(screenTitle => ({ title: screenTitle, body: evidenceFor(source, screenTitle) }))
    : inferred
    ? [{ title, body: source }, { title: `${inferredSubject}处理结果`, body: `展示${inferredSubject}操作完成结果。` }]
    : pageSections.map(match => ({ title: cleanHeading(match[1]), body: match[2].trim() }));
  const pageIds = new Map();
  const pages = rawPages.map((page, index) => {
    const baseId = slugify(page.title, `page-${index + 1}`);
    const occurrence = (pageIds.get(baseId) ?? 0) + 1;
    pageIds.set(baseId, occurrence);
    return {
      id: occurrence === 1 ? baseId : `${baseId}-${occurrence}`,
      title: page.title,
      state: pageState(page.title),
      elements: []
    };
  });

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
    assumptions: inferred ? [{ id: 'assumption-1', statement: `页面结构由简短需求推断为“${title}”和“${inferredSubject}处理结果”`, source: 'parser' }] : [],
    gaps: inferred ? [{ id: 'gap-1', statement: 'PRD 未明确页面、异常状态和完整跳转规则', impact: 'medium' }] : []
  };
  return validateModel(model);
}
