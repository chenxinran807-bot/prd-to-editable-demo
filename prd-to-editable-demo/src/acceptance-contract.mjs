import { compileFrozenTasks } from './frozen-task-contract.mjs';

const EDITABLE_DIMENSIONS = [
  'image', 'icon', 'position', 'size', 'text', 'color', 'visibility', 'state', 'navigation'
];

function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

export function compileAcceptanceContract(requirements = {}) {
  const transitions = requirements.transitions ?? [];
  const actions = unique([
    ...(requirements.userActions ?? []),
    ...transitions.map(transition => transition.action)
  ]);
  return {
    screens: unique(requirements.screens),
    actions,
    states: unique(requirements.states),
    transitions,
    components: unique(requirements.requiredComponents),
    touchLabels: actions,
    editableDimensions: EDITABLE_DIMENSIONS,
    frozenTasks: compileFrozenTasks(requirements)
  };
}
