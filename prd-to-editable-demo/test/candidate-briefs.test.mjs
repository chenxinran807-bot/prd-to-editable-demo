import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidateBriefs } from '../src/candidate-briefs.mjs';

const requirements = {
  title: '服务发现与预约', actor: '访客', goal: '发现合适服务并完成预约',
  businessObjects: ['服务', '预约单'], userActions: ['浏览', '提交预约'],
  states: ['提交中', '预约成功', '预约失败'],
  screens: ['服务推荐', '预约填写', '预约结果'],
  transitions: [
    { from: '服务推荐', action: '浏览', to: '预约填写' },
    { from: '预约填写', action: '提交预约', to: '预约结果' }
  ],
  experienceType: 'browse'
};

test('builds three distinct directions that share one immutable requirements contract', () => {
  const briefs = buildCandidateBriefs(requirements);
  assert.equal(briefs.length, 3);
  assert.equal(new Set(briefs.map(item => item.id)).size, 3);
  assert.equal(new Set(briefs.map(item => item.label)).size, 3);
  assert.equal(new Set(briefs.map(item => item.requirementsHash)).size, 1);
  for (const brief of briefs) {
    assert.deepEqual(brief.mustPreserve.screens, requirements.screens);
    assert.deepEqual(brief.mustPreserve.actions, requirements.userActions);
    assert.deepEqual(brief.mustPreserve.states, requirements.states);
    assert.deepEqual(brief.mustPreserve.transitions, requirements.transitions);
  }
});

test('derives direction labels from the experience shape without product-specific copy', () => {
  const browse = buildCandidateBriefs(requirements);
  const linear = buildCandidateBriefs({ ...requirements, experienceType: 'linear' });
  assert.deepEqual(browse.map(item => item.label), ['任务效率优先', '内容发现优先', '决策转化优先']);
  assert.deepEqual(linear.map(item => item.label), ['任务效率优先', '分步引导优先', '对象状态优先']);
});
