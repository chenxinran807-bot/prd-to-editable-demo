export function compileFrozenTasks(requirements = {}) {
  return (requirements.transitions ?? []).map((transition, index) => ({
    id: `task-${index + 1}`,
    entry: transition.from,
    steps: [{
      action: transition.action,
      expectedDestination: transition.to
    }],
    observableOutcome: {
      kind: 'destination-content',
      value: transition.to,
      urlChangeAloneIsInsufficient: true
    }
  }));
}
