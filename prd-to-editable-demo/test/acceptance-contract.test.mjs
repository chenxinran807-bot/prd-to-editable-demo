import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAcceptanceContract } from '../src/acceptance-contract.mjs';

const requirements = {
  screens: ['对象列表', '编辑对象', '处理结果'],
  userActions: ['选择对象', '提交修改', '重新处理'],
  states: ['提交中', '处理成功', '处理失败'],
  transitions: [
    { from: '对象列表', action: '选择对象', to: '编辑对象', evidence: '选择对象后进入编辑' },
    { from: '编辑对象', action: '提交修改', to: '处理结果', evidence: '提交修改并查看结果' }
  ]
};

test('compiles semantic requirements into a complete production audit contract', () => {
  const contract = compileAcceptanceContract(requirements);

  assert.deepEqual(contract.screens, requirements.screens);
  assert.deepEqual(contract.actions, requirements.userActions);
  assert.deepEqual(contract.states, requirements.states);
  assert.deepEqual(contract.touchLabels, requirements.userActions);
  assert.deepEqual(contract.editableDimensions, [
    'image', 'icon', 'position', 'size', 'text', 'color', 'visibility', 'state', 'navigation'
  ]);
  assert.deepEqual(contract.transitions, requirements.transitions);
});

test('derives UI-only frozen tasks with observable outcomes from transitions', () => {
  const contract = compileAcceptanceContract(requirements);

  assert.deepEqual(contract.frozenTasks, [
    {
      id: 'task-1',
      entry: '对象列表',
      steps: [{ action: '选择对象', expectedDestination: '编辑对象' }],
      observableOutcome: {
        kind: 'destination-content',
        value: '编辑对象',
        urlChangeAloneIsInsufficient: true
      }
    },
    {
      id: 'task-2',
      entry: '编辑对象',
      steps: [{ action: '提交修改', expectedDestination: '处理结果' }],
      observableOutcome: {
        kind: 'destination-content',
        value: '处理结果',
        urlChangeAloneIsInsufficient: true
      }
    }
  ]);
});

test('deduplicates actions shared by explicit actions and transitions', () => {
  const contract = compileAcceptanceContract({
    ...requirements,
    userActions: ['选择对象'],
    transitions: [
      ...requirements.transitions,
      { from: '处理结果', action: '重新处理', to: '编辑对象', evidence: '重新处理' }
    ]
  });

  assert.deepEqual(contract.actions, ['选择对象', '提交修改', '重新处理']);
});

test('keeps page content and information hierarchy as acceptance requirements', () => {
  const contract = compileAcceptanceContract({
    screens: ['列表', '详情'], userActions: [], states: [], transitions: [],
    pageContent: [{ screen: '详情', elements: ['说明', '提醒', '清单'] }],
    informationArchitecture: [{ parent: '列表', children: ['分类一', '分类二'] }]
  });
  assert.deepEqual(contract.pageContent[0].elements, ['说明', '提醒', '清单']);
  assert.deepEqual(contract.informationArchitecture[0].children, ['分类一', '分类二']);
});
