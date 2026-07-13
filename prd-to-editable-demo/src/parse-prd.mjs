import { validateModel } from './validate-model.mjs';

function slugify(text, fallback) {
  const ascii = text.toLowerCase().match(/[a-z0-9]+/g)?.join('-');
  if (ascii) return ascii;
  const known = { '待提交列表': 'pending-list', '审核确认': 'review', '提交成功': 'success' };
  return known[text] ?? fallback;
}

function findTarget(text, pages, currentIndex) {
  const explicit = pages.find(page => text.includes(page.title));
  if (explicit) return explicit.id;
  if (/返回|取消/.test(text)) return pages[0].id;
  return pages[Math.min(currentIndex + 1, pages.length - 1)].id;
}

function parseTryonPrd(title, source) {
  const page = (id, title, state, elements) => ({ id, title, state, elements });
  const button = (key, text, target) => ({ key, type: 'button', text, editable: ['text', 'style', 'hidden', 'disabled', 'action'], action: target ? { type: 'navigate', target } : undefined });
  const pages = [
    page('outfit-feed', '穿搭', 'default', [
      { key: 'outfit-feed.title', type: 'heading', text: '穿搭推荐', editable: ['text', 'style'] },
      { key: 'outfit-feed.refresh', type: 'button', text: '下拉刷新 / 双击刷新', editable: ['text', 'style'] },
      { key: 'outfit-feed.card-1', type: 'heading', text: 'BLTX 与 M-BOUD｜夏日轻薄穿搭', editable: ['text', 'style'] },
      button('outfit-feed.tryon-1', '试穿', 'create-avatar'),
      { key: 'outfit-feed.card-2', type: 'heading', text: '奶油杏运动短裤｜宽松休闲', editable: ['text', 'style'] },
      button('outfit-feed.tryon-2', '试穿', 'create-avatar')
    ]),
    page('create-avatar', '创建形象', 'default', [
      { key: 'create-avatar.title', type: 'heading', text: '创建我的形象', editable: ['text', 'style'] },
      { key: 'create-avatar.tip', type: 'heading', text: '上传本人正面全身图，建议膝盖及以上、背景干净', editable: ['text', 'style'] },
      button('create-avatar.camera', '拍照'), button('create-avatar.album', '从相册选择'),
      button('create-avatar.submit', '开始识别', 'tryon-progress')
    ]),
    page('tryon-progress', '试穿中', 'loading', [
      { key: 'tryon-progress.title', type: 'heading', text: '正在生成试穿效果…', editable: ['text', 'style'] },
      { key: 'tryon-progress.status', type: 'heading', text: '请稍候，完成后会自动更新穿搭卡片状态', editable: ['text', 'style'] },
      button('tryon-progress.done', '查看试穿结果', 'tryon-result'),
      button('tryon-progress.delete', '删除形象')
    ]),
    page('tryon-result', '试穿结果', 'success', [
      { key: 'tryon-result.title', type: 'heading', text: '试穿完成', editable: ['text', 'style'] },
      { key: 'tryon-result.image', type: 'heading', text: 'AI 生成效果图（保留本人身材，更换试穿服装）', editable: ['text', 'style'] },
      { key: 'tryon-result.product', type: 'heading', text: '夏日轻薄连衣裙｜¥152.9', editable: ['text', 'style'] },
      button('tryon-result.add-cart', '加购'), button('tryon-result.back', '返回穿搭', 'outfit-feed')
    ])
  ];
  return validateModel({ schemaVersion: 1, id: slugify(title, 'ai-tryon'), product: { name: title, goal: '完成 AI 试穿并让用户感知是自己在穿' }, persona: { name: '想查看自己穿衣效果的用户', need: '上传形象、试穿服装、查看结果' }, startPage: 'outfit-feed', pages, assumptions: [{ id: 'tryon-assumption-1', statement: '以穿搭 Feed → 创建形象 → 试穿中 → 试穿结果作为一期可演示主链路', source: 'parser' }], gaps: [{ id: 'tryon-gap-1', statement: '真实图片生成服务与审核接口未接入，原型使用占位效果区域', impact: 'medium' }] });
}

export function parsePrd(source) {
  const title = source.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '未命名原型';
  if (/AI试穿|AI 试穿|tryon/i.test(source)) return parseTryonPrd(title, source);
  const personaText = source.match(/用户[：:]\s*(.+)/)?.[1]?.trim() ?? '目标用户（根据需求推断）';
  const goal = source.match(/目标[：:]\s*(.+)/)?.[1]?.trim() ?? '完成 PRD 描述的核心任务';
  const sections = [...source.matchAll(/^##\s+(.+)\n([\s\S]*?)(?=^##\s+|$)/gm)];
  const inferred = sections.length < 2;
  const rawPages = inferred
    ? [{ title: '功能首页', body: source }, { title: '操作结果', body: '展示操作完成结果。' }]
    : sections.map(match => ({ title: match[1].trim(), body: match[2].trim() }));
  const pages = rawPages.map((page, index) => ({
    id: slugify(page.title, `page-${index + 1}`),
    title: page.title,
    state: /成功|完成/.test(page.title) ? 'success' : 'default',
    elements: []
  }));

  rawPages.forEach((rawPage, pageIndex) => {
    const page = pages[pageIndex];
    const buttonLabels = [...rawPage.body.matchAll(/[“「](.+?)[”」]/g)].map(match => match[1]);
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
