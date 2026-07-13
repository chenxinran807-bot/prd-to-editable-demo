import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInspirePlan } from '../src/inspire-plan.mjs';
import { selectRoute } from '../src/select-route.mjs';

test('professional rich PRDs end in Inspire while preserving understanding and visual stages', () => {
  const source = `${'## 状态\n失败后重试。\n'.repeat(8)}\n![界面](screen.png)`;
  const route = selectRoute({ source });
  assert.equal(route.id, 'inspire');
  assert.equal(route.finalContainer, 'inspire');
  assert.deepEqual(route.stages, ['prd-generator', 'pm-kakaxi', 'inspire']);
});

test('builds a reproducible first-generation Inspire plan', () => {
  const route = { id: 'inspire', stages: ['prd-generator', 'pm-kakaxi', 'inspire'], finalContainer: 'inspire', reason: '复杂富媒体 PRD' };
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
