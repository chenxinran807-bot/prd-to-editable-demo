import { createHash } from 'node:crypto';

function invariant(requirements) {
  return {
    screens: requirements.screens ?? [],
    actions: requirements.userActions ?? [],
    states: requirements.states ?? [],
    transitions: requirements.transitions ?? [],
    pageContent: requirements.pageContent ?? [],
    informationArchitecture: requirements.informationArchitecture ?? []
  };
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildCandidateBriefs(requirements = {}) {
  const mustPreserve = invariant(requirements);
  const requirementsHash = hash(mustPreserve);
  const contextual = requirements.experienceType === 'browse'
    ? {
        label: '内容发现优先',
        structuralStrategy: '先建立浏览上下文，再逐步进入核心任务。',
        visualStrategy: '强化内容层级、关联线索和渐进式入口。'
      }
    : {
        label: '分步引导优先',
        structuralStrategy: '以明确阶段和反馈引导用户完成主任务。',
        visualStrategy: '强化当前步骤、完成进度和下一动作。'
      };
  const outcome = requirements.experienceType === 'browse'
    ? {
        label: '决策转化优先',
        structuralStrategy: '围绕决策证据组织内容并突出核心完成动作。',
        visualStrategy: '强化关键信息对比、信任信息和完成动作。'
      }
    : {
        label: '对象状态优先',
        structuralStrategy: '围绕业务对象及其状态变化组织页面。',
        visualStrategy: '强化对象信息、状态反馈和恢复动作。'
      };
  const strategies = [
    {
      label: '任务效率优先',
      structuralStrategy: '减少非必要跳转并前置主任务入口。',
      visualStrategy: '强化主次层级和最短完成路径。'
    },
    contextual,
    outcome
  ];
  return strategies.map((strategy, index) => ({
    id: `candidate-${String.fromCharCode(97 + index)}`,
    ...strategy,
    requirementsHash,
    mustPreserve
  }));
}
