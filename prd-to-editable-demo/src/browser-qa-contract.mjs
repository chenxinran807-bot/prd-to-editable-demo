function withoutUrl(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'url'));
}

function hasObservableStepChange(step = {}) {
  return JSON.stringify(withoutUrl(step.before)) !== JSON.stringify(withoutUrl(step.after));
}

export function validateBrowserQaEvidence(evidence = {}) {
  const criticalFailures = [];
  const reviewFailures = [];
  const tasks = Array.isArray(evidence.tasks) ? evidence.tasks : [];
  if (!evidence.entryUrl) criticalFailures.push('entry URL is missing');
  if (tasks.length === 0) criticalFailures.push('no frozen tasks were executed');

  for (const task of tasks) {
    const label = task.id ?? 'unnamed task';
    if (!task.entryReached) criticalFailures.push(`${label}: entry route was not reached`);
    if (task.directNavigationUsed) criticalFailures.push(`${label}: direct navigation bypassed the current UI`);
    if (!task.observedOutcome || !(task.steps ?? []).some(hasObservableStepChange)) {
      criticalFailures.push(`${label}: no observable UI or state feedback was recorded`);
    }
  }

  for (const control of evidence.controls ?? []) {
    if (!control.role || !control.accessible) criticalFailures.push(`${control.name ?? 'control'}: usable semantic role is missing`);
    if (!control.feedbackObserved) criticalFailures.push(`${control.name ?? 'control'}: observable feedback is missing`);
  }
  for (const image of evidence.images ?? []) {
    if (!(image.naturalWidth > 0) || !(image.naturalHeight > 0)) {
      criticalFailures.push(`${image.src ?? 'image'}: natural dimensions are zero or unavailable`);
    }
  }
  for (const request of evidence.network ?? []) {
    if (!request.approved && (request.failed || request.aborted || request.status === 0)) {
      criticalFailures.push(`${request.url ?? 'request'}: unapproved external request failed or aborted`);
    }
  }
  for (const entry of evidence.console ?? []) {
    if (entry.level === 'error') reviewFailures.push(`console error: ${entry.message ?? 'unknown error'}`);
  }
  if (evidence.layout?.horizontalOverflow) reviewFailures.push('horizontal overflow detected');
  if ((evidence.layout?.overlaps ?? []).length > 0) reviewFailures.push('visible component overlap detected');

  return {
    status: criticalFailures.length || reviewFailures.length ? 'failed' : 'passed',
    criticalFailures,
    reviewFailures,
    taskCount: tasks.length,
    passedTaskCount: tasks.filter(task => task.entryReached && !task.directNavigationUsed && task.observedOutcome && (task.steps ?? []).some(hasObservableStepChange)).length
  };
}
