import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInspirePlan } from '../src/inspire-plan.mjs';
import { selectRoute } from '../src/select-route.mjs';

test('professional rich PRDs default to direct generation', () => {
  const source = `${'## 状态\n失败后重试。\n'.repeat(8)}\n![界面](screen.png)`;
  const route = selectRoute({ source });
  assert.equal(route.id, 'direct');
  assert.equal(route.finalContainer, 'embedded-html');
  assert.ok(route.stages.includes('browser-qa'));
});

test('builds a reproducible first-generation Inspire plan', () => {
  const route = { id: 'inspire', stages: ['prd-generator', 'pm-kakaxi-skills', 'inspire'], finalContainer: 'inspire', reason: '复杂富媒体 PRD' };
  const requirements = {
    title: 'AI 试穿', actor: '商城用户', goal: '创建形象并试穿',
    businessObjects: ['形象', '照片'], userActions: ['上传', '试穿'], states: ['未创建', '试穿中']
  };
  const plan = buildInspirePlan({
    route, requirements,
    inputs: { prd: '/tmp/prd.md', assets: ['/tmp/screen.png'], referenceUrl: null },
    designSkill: 'workspace:douyin-mall-native-design@1'
  });
  assert.equal(plan.command, 'generate prototype');
  assert.equal(plan.mode, 'create');
  assert.equal(plan.outputType, 'html');
  assert.equal(plan.designSkill, 'workspace:douyin-mall-native-design@1');
  assert.deepEqual(plan.files, ['/tmp/screen.png']);
  assert.match(plan.prompt, /Emoji 数量必须为 0/);
  assert.match(plan.prompt, /上传、试穿/);
});

test('iteration plans preserve the accepted parent asset', () => {
  const plan = buildInspirePlan({
    route: { id: 'inspire', stages: ['inspire'], finalContainer: 'inspire', reason: '继续迭代' },
    requirements: { title: '设置页', actor: '用户', goal: '修改通知', businessObjects: ['通知'], userActions: ['编辑'], states: [] },
    inputs: { prd: '/tmp/prd.md', assets: [], referenceUrl: null },
    designSkill: 'workspace:douyin-mall-native-design@2',
    parentAssetId: 'asset-accepted'
  });
  assert.equal(plan.mode, 'iterate');
  assert.equal(plan.parentAssetId, 'asset-accepted');
});

test('refuses professional generation without the business design Skill', () => {
  assert.throws(() => buildInspirePlan({
    route: { id: 'inspire', stages: ['inspire'] }, requirements: {}, inputs: { assets: [] }
  }), /business design Skill is required/);
});

test('renders browse-type pages and transitions directly into the Inspire prompt', () => {
  const plan = buildInspirePlan({
    route: { id: 'inspire', stages: ['prd-generator', 'inspire'], finalContainer: 'inspire' },
    requirements: {
      title: '穿搭 Tab', actor: '商城用户', goal: '发现穿搭并试穿', experienceType: 'browse',
      businessObjects: ['穿搭', '商品'], userActions: ['喜欢', '试穿'], states: ['加载中', '错误'],
      screens: ['穿搭 Tab Feed', '穿搭详情页', 'AI 试穿弹窗', '商品清单'],
      transitions: [
        { from: '穿搭 Tab Feed', action: '点击卡片', to: '穿搭详情页' },
        { from: '穿搭详情页', action: '点击试穿', to: 'AI 试穿弹窗' }
      ]
    },
    inputs: { assets: [] }, designSkill: 'private:douyin-skill@6'
  });

  assert.match(plan.prompt, /PRD 类型：多入口浏览型/);
  assert.match(plan.prompt, /页面\/浮层：穿搭 Tab Feed、穿搭详情页、AI 试穿弹窗、商品清单/);
  assert.match(plan.prompt, /穿搭 Tab Feed --点击卡片--> 穿搭详情页/);
  assert.match(plan.prompt, /优先保证 Tab、卡片反馈、详情和弹层的覆盖广度/);
});

test('professional prompt contains interaction, visual, editability, and quality contracts', () => {
  const plan = buildInspirePlan({
    route: { id: 'inspire', stages: ['inspire'], finalContainer: 'inspire' },
    requirements: { title: '预约服务', actor: '访客', goal: '完成预约', screens: ['预约表单', '预约结果'], transitions: [] },
    inputs: { assets: [] }, designSkill: 'private:test@1'
  });
  assert.match(plan.prompt, /状态矩阵/);
  assert.match(plan.prompt, /图片、Icon、位置、大小/);
  assert.match(plan.prompt, /主观视觉审查/);
  assert.match(plan.prompt, /触发条件.*系统行为.*用户反馈/);
});

test('preserves original PRD detail, page content, and information architecture in the prompt', () => {
  const plan = buildInspirePlan({
    route: { id: 'inspire', stages: ['inspire'], finalContainer: 'inspire' },
    requirements: {
      title: '商品内容', actor: '用户', goal: '理解并决策', screens: ['内容列表', '内容详情'],
      pageContent: [{ screen: '内容详情', elements: ['核心说明', '规格提醒', '对象清单'] }],
      informationArchitecture: [{ parent: '内容列表', children: ['分类甲', '分类乙', '分类丙'] }]
    },
    inputs: { assets: [], prdSource: '这是一段不得被压缩丢失的 PRD 详细原文。' },
    designSkill: 'public:business-system@2'
  });
  assert.match(plan.prompt, /页面内容清单：内容详情/);
  assert.match(plan.prompt, /核心说明、规格提醒、对象清单/);
  assert.match(plan.prompt, /信息架构：内容列表/);
  assert.match(plan.prompt, /分类甲、分类乙、分类丙/);
  assert.match(plan.prompt, /不得被压缩丢失的 PRD 详细原文/);
});

test('renders one candidate direction while preserving the shared requirements contract', () => {
  const candidateBrief = {
    id: 'candidate-b', label: '内容发现优先',
    structuralStrategy: '先建立上下文，再逐步进入核心任务。',
    visualStrategy: '强化内容层级，但不改变业务事实。',
    requirementsHash: 'shared-hash',
    mustPreserve: { screens: ['入口', '结果'], actions: ['提交'], states: ['成功'], transitions: [] }
  };
  const plan = buildInspirePlan({
    route: { id: 'inspire', stages: ['inspire'], finalContainer: 'inspire' },
    requirements: { title: '通用任务', actor: '用户', goal: '完成任务', screens: ['入口', '结果'], userActions: ['提交'], states: ['成功'], transitions: [] },
    inputs: { assets: [] }, designSkill: 'public:business-system@2', candidateBrief
  });
  assert.equal(plan.candidateBrief, candidateBrief);
  assert.match(plan.prompt, /候选方向：内容发现优先/);
  assert.match(plan.prompt, /共享需求契约：shared-hash/);
  assert.match(plan.prompt, /不得删除、替换或虚构需求/);
});
