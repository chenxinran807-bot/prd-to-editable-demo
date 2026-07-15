import assert from 'node:assert/strict';

const BACKGROUND_PURPOSES = new Set(['business_context', 'research_evidence', 'delivery_metadata']);

function fail(message) {
  throw new Error(`fidelity check failed: ${message}`);
}

function same(left, right) {
  try { assert.deepStrictEqual(left, right); return true; } catch { return false; }
}

function allowedExtra(item) {
  return item?.generated === true || item?.allowed === true || item?.fidelity?.generated === true || item?.fidelity?.allowed === true;
}

function allElements(model) {
  return (model.pages ?? []).flatMap(page => (page.elements ?? []).map(element => ({ page, element })));
}

function baselineRequirements(baseline) {
  return (baseline.pages ?? []).flatMap(page => (page.requirements ?? []).map(requirement => ({ page, requirement })));
}

function baselineActions(baseline) {
  return (baseline.pages ?? []).flatMap(page => (page.actions ?? []).map(action => ({ page, action })));
}

function baselineVisuals(baseline) {
  return (baseline.pages ?? []).flatMap(page => (page.visualReferences ?? []).map(reference => ({ page, reference })));
}

function appliedVisuals(model) {
  return model.appliedVisualReferences ?? model.visualTrace ?? [];
}

function excludedProperties(reference) {
  return reference.exclude ?? reference.excludedProperties ?? [];
}

function sortedStrings(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function bindingSignatures(bindings) {
  return sortedStrings((bindings ?? []).map(binding => `${binding.property}\u0000${binding.fidelity}`));
}

export function verifyFidelity({ baseline, model }) {
  if (!baseline || typeof baseline !== 'object') throw new TypeError('verifyFidelity requires a baseline');
  if (!model || typeof model !== 'object') throw new TypeError('verifyFidelity requires a model');
  const checks = [];
  const traceability = [];
  const pageById = new Map((model.pages ?? []).map(page => [page.id, page]));

  for (const page of baseline.pages ?? []) if (!pageById.has(page.id)) fail(`missing required page ${page.id}`);
  const baselinePageIds = new Set((baseline.pages ?? []).map(page => page.id));
  for (const page of model.pages ?? []) {
    if (!baselinePageIds.has(page.id) && !allowedExtra(page)) fail(`unexplained extra page ${page.id}`);
  }
  checks.push({ name: 'pages', passed: true });

  const elements = allElements(model);
  const protectedRequirements = [
    ...(baseline.nonUiRequirements ?? []),
    ...baselineRequirements(baseline).map(({ requirement }) => requirement)
      .filter(requirement => requirement.uiEligible === false || BACKGROUND_PURPOSES.has(requirement.purpose)),
  ];
  const protectedRequirementIds = new Set(protectedRequirements.map(requirement => requirement.id));
  const protectedSourceIds = new Set(protectedRequirements.flatMap(requirement => requirement.sourceIds ?? []));
  for (const { element } of elements) {
    if (protectedRequirementIds.has(element.requirementId)) fail(`background requirement ${element.requirementId} was rendered`);
    for (const sourceId of element.sourceIds ?? []) {
      if (protectedSourceIds.has(sourceId)) fail(`protected source ${sourceId} was rendered`);
    }
  }
  const validateTraceKeys = (kind, id, rendered) => {
    for (const { element } of rendered) {
      if (typeof element.key !== 'string' || !element.key.trim()) fail(`${kind} ${id} requires a non-empty element key`);
      if (elements.filter(item => item.element.key === element.key).length !== 1) fail(`${kind} ${id} requires unique element key ${element.key}`);
    }
  };
  for (const { page, requirement } of baselineRequirements(baseline)) {
    const rendered = elements.filter(item => item.element.requirementId === requirement.id);
    const isBackground = requirement.uiEligible === false || BACKGROUND_PURPOSES.has(requirement.purpose);
    if (isBackground) {
      if (rendered.length) fail(`background requirement ${requirement.id} was rendered`);
      const evidence = requirement.evidence ?? [];
      const leakedEvidence = elements.some(({ element }) => {
        const renderedEvidence = Array.isArray(element.evidence) ? element.evidence : [];
        return evidence.some(source => renderedEvidence.some(candidate => same(candidate, source)));
      });
      if (leakedEvidence) fail(`background requirement ${requirement.id} evidence was rendered`);
      continue;
    }
    const onPage = rendered.filter(item => item.page.id === page.id);
    validateTraceKeys('requirement', requirement.id, onPage);
    if (requirement.exactCopy !== undefined) {
      if (!onPage.length) fail(`exact copy requirement ${requirement.id} is missing from page ${page.id}`);
      const targetRegions = (requirement.targetIds ?? []).filter(id => (page.regions ?? []).some(region => region.id === id));
      const exact = onPage.filter(item => item.element.text?.includes(requirement.exactCopy));
      if (!exact.length) fail(`exact copy requirement ${requirement.id} is not verbatim on page ${page.id}`);
      for (const regionId of targetRegions) {
        if (!exact.some(item => item.element.regionId === regionId)) fail(`exact copy requirement ${requirement.id} is missing from region ${regionId}`);
      }
    } else if (!onPage.length) {
      fail(`requirement ${requirement.id} has no rendered element traceable by requirementId on page ${page.id}`);
    }
    traceability.push({ kind: 'requirement', id: requirement.id, pageId: page.id, elementKeys: onPage.map(item => item.element.key) });
  }
  checks.push({ name: 'requirements', passed: true });

  if (!same(model.taxonomy ?? [], baseline.taxonomy ?? [])) fail('taxonomy hierarchy, nodes, or order differs from baseline');
  checks.push({ name: 'taxonomy', passed: true });

  const declaredActions = baselineActions(baseline);
  const declaredIds = new Set(declaredActions.map(({ action }) => action.id));
  for (const { page, action } of declaredActions) {
    const matches = elements.filter(item => item.element.actionId === action.id);
    if (matches.length !== 1) fail(`action ${action.id} must have exactly one rendered actionable element`);
    validateTraceKeys('action', action.id, matches);
    const match = matches[0];
    if (match.page.id !== action.fromPageId || match.page.id !== page.id) fail(`action ${action.id} must be rendered on from page ${action.fromPageId}`);
    if (match.element.disabled || match.element.hidden) fail(`action ${action.id} must be enabled and visible`);
    if (match.element.action?.type !== 'navigate') fail(`action ${action.id} must use navigate, not notice, alert, disabled, or static copy`);
    if (match.element.action.target !== action.toPageId) fail(`action ${action.id} must target ${action.toPageId}`);
    traceability.push({ kind: 'action', id: action.id, pageId: page.id, elementKeys: [match.element.key] });
  }
  for (const { element } of elements) {
    if ((element.actionId || element.action) && !declaredIds.has(element.actionId) && !allowedExtra(element)) {
      fail(`undeclared action ${element.actionId ?? element.key}`);
    }
  }
  checks.push({ name: 'actions', passed: true });

  const actionById = new Map(declaredActions.map(({ action }) => [action.id, action]));
  for (const journey of baseline.coreJourneys ?? []) {
    let current = journey.startPageId;
    for (const actionId of journey.actionIds ?? []) {
      const action = actionById.get(actionId);
      if (!action) fail(`journey ${journey.id} references missing action ${actionId}`);
      if (action.fromPageId !== current) fail(`journey ${journey.id} is discontinuous at action ${actionId}: expected from ${current}`);
      const rendered = elements.find(item => item.element.actionId === actionId);
      if (!rendered || rendered.page.id !== current) fail(`journey ${journey.id} cannot take action ${actionId} from ${current}`);
      current = rendered.element.action.target;
    }
    if (current !== journey.expectedEndPageId) fail(`journey ${journey.id} expected end ${journey.expectedEndPageId} but reached ${current}`);
  }
  checks.push({ name: 'core journeys', passed: true });

  let reviewRequired = false;
  const applied = appliedVisuals(model);
  for (const { page, reference } of baselineVisuals(baseline)) {
    const matches = applied.filter(item => item.id === reference.id);
    if (matches.length !== 1) fail(`visual reference ${reference.id} is missing or duplicated`);
    const match = matches[0];
    if (!same(match.scope, reference.scope)) fail(`visual reference ${reference.id} scope differs from baseline`);
    if (!Array.isArray(match.elementKeys) || !match.elementKeys.length) fail(`visual reference ${reference.id} requires non-empty elementKeys`);
    for (const key of match.elementKeys) {
      const resolved = elements.filter(item => item.element.key === key);
      if (!resolved.length) fail(`visual reference ${reference.id} has unknown element key ${key}`);
      if (resolved.length > 1) fail(`visual reference ${reference.id} has ambiguous element key ${key}`);
      if (resolved[0].page.id !== reference.scope.pageId) fail(`visual reference ${reference.id} element key ${key} is outside page ${reference.scope.pageId}`);
      if (reference.scope.regionId !== undefined && resolved[0].element.regionId !== reference.scope.regionId) {
        fail(`visual reference ${reference.id} element key ${key} is outside region ${reference.scope.regionId}`);
      }
    }
    const baselineExcluded = excludedProperties(reference);
    const appliedExcluded = excludedProperties(match);
    if (!same(sortedStrings(appliedExcluded), sortedStrings(baselineExcluded))) {
      fail(`visual reference ${reference.id} excluded properties differ from baseline`);
    }
    const excluded = new Set(baselineExcluded);
    for (const binding of match.bindings ?? []) {
      if (excluded.has(binding.property)) fail(`visual reference ${reference.id} claims excluded property ${binding.property}`);
    }
    if (!same(bindingSignatures(match.bindings), bindingSignatures(reference.bindings))) {
      fail(`visual reference ${reference.id} bindings differ from baseline`);
    }
    const subjectiveFidelity = (reference.bindings ?? []).find(binding => ['high', 'local', 'inspiration'].includes(binding.fidelity));
    if (subjectiveFidelity) {
      if (match.subjectiveReview !== 'required') {
        fail(`visual reference ${reference.id} ${subjectiveFidelity.fidelity} fidelity requires subjective review`);
      }
      reviewRequired = true;
    }
    traceability.push({ kind: 'visual-reference', id: reference.id, pageId: page.id, elementKeys: [...match.elementKeys] });
  }
  checks.push({ name: 'visual references', passed: true, ...(reviewRequired ? { reviewRequired: true } : {}) });

  return { status: 'passed', checks, traceability };
}
