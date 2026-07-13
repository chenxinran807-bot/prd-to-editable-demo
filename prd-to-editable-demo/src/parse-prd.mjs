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

function extractBullets(body) {
  return [...body.matchAll(/^\s*[-*]\s+(.+)$/gm)]
    .map(match => cleanHeading(match[1]).replace(/\*\*/g, ''))
    .filter(text => text.length > 2 && text.length < 140);
}

function extractActions(body) {
  const quoted = [...body.matchAll(/[“「『](.+?)[”」』]/g)].map(match => cleanHeading(match[1]));
  const verbs = [...body.matchAll(/(?:点击|选择|上传|拍照|提交|确认|删除|取消|返回|查看|编辑|刷新|重试|试穿|加购)([^，。；\n]{0,12})/g)]
    .map(match => cleanHeading(match[0]));
  return [...new Set([...quoted, ...verbs])].filter(text => text.length >= 2 && text.length <= 24);
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
  const sections = [...source.matchAll(/^##\s+(.+)\n([\s\S]*?)(?=^##\s+|$)/gm)];
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

  const hasEmptyState = /空状态|为空|没有内容/.test(source);
  if (hasEmptyState) {
    pages.push({
      id: 'empty-state', title: '暂无内容', state: 'empty', elements: [
        { key: 'empty-state.title', type: 'heading', text: '暂无内容', editable: ['text', 'style'] },
        { key: 'empty-state.back', type: 'button', text: '返回', editable: ['text', 'style', 'action'], action: { type: 'navigate', target: pages[0].id } }
      ]
    });
  }

  const model = {
    schemaVersion: 1,
    id: slugify(title, 'editable-demo'),
    product: { name: title, goal },
    persona: { name: personaText, need: goal },
    startPage: pages[0].id,
    pages,
    assumptions: inferred ? [{ id: 'assumption-1', statement: '页面结构由简短需求推断为首页和结果页', source: 'parser' }] : [],
    gaps: inferred ? [{ id: 'gap-1', statement: 'PRD 未明确页面、异常状态和完整跳转规则', impact: 'medium' }] : []
  };
  return validateModel(model);
}
