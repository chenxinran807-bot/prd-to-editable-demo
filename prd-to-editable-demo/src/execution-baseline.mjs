function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function blockerPriority(blocker) {
  return blocker.priority ?? blocker.severity;
}

function isResolved(blocker) {
  return blocker.resolved === true || blocker.status === 'resolved';
}

function indexUnique(items, entity) {
  if (!Array.isArray(items)) throw new TypeError(`Execution baseline ${entity} collection must be an array`);
  const indexed = new Map();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError(`Execution baseline ${entity} must be an object`);
    if (typeof item.id !== 'string' || !item.id.trim()) throw new TypeError(`Execution baseline ${entity} id must be a non-empty string`);
    if (indexed.has(item.id)) throw new Error(`Execution baseline has duplicate ${entity} id ${item.id}`);
    indexed.set(item.id, item);
  }
  return indexed;
}

export function compileExecutionBaseline(ir, visualReferences, previous = null, options = {}) {
  if (!ir || typeof ir !== 'object' || Array.isArray(ir)) throw new TypeError('Execution baseline requires an IR object');
  if (!Array.isArray(visualReferences)) throw new TypeError('Execution baseline visual references must be an array');

  const blockers = Array.isArray(ir.blockers) ? ir.blockers : [];
  const blocking = blockers.find((item) => !isResolved(item) && ['P0', 'P1'].includes(blockerPriority(item)));
  if (blocking) throw new Error(`Cannot compile execution baseline with unresolved ${blockerPriority(blocking)} blocker ${blocking.id}`);

  const pages = ir.pages ?? [];
  const regions = ir.regions ?? [];
  const requirements = ir.requirements ?? [];
  const actions = ir.actions ?? [];
  const coreJourneys = ir.coreJourneys ?? [];
  const pageById = indexUnique(pages, 'page');
  const regionById = indexUnique(regions, 'region');
  for (const id of pageById.keys()) {
    if (regionById.has(id)) throw new Error(`Execution baseline page and region share ambiguous id ${id}`);
  }
  const requirementById = indexUnique(requirements, 'requirement');
  const actionById = indexUnique(actions, 'action');
  indexUnique(coreJourneys, 'coreJourney');
  indexUnique(visualReferences, 'visual reference');

  for (const page of pages) {
    if (!Array.isArray(page.regionIds)) throw new TypeError(`Page ${page.id} regionIds must be an array`);
    const listed = new Set();
    for (const regionId of page.regionIds) {
      if (listed.has(regionId)) throw new Error(`Page ${page.id} lists region ${regionId} more than once`);
      listed.add(regionId);
      const region = regionById.get(regionId);
      if (!region) throw new Error(`Page ${page.id} references unknown region ${regionId}`);
      if (region.pageId !== page.id) throw new Error(`Region ${regionId} belongs to page ${region.pageId}, not page ${page.id}`);
    }
  }
  for (const region of regions) {
    const owner = pageById.get(region.pageId);
    if (!owner) throw new Error(`Region ${region.id} references unknown page ${region.pageId}`);
    const occurrences = owner.regionIds.filter((id) => id === region.id).length;
    if (occurrences !== 1) throw new Error(`Region ${region.id} is not listed exactly once by page ${region.pageId}`);
  }

  for (const requirement of requirements) {
    if (!Array.isArray(requirement.targetIds)) throw new TypeError(`Requirement ${requirement.id} targetIds must be an array`);
    for (const targetId of requirement.targetIds) {
      if (!pageById.has(targetId) && !regionById.has(targetId)) {
        throw new Error(`Requirement ${requirement.id} references unknown target ${targetId}`);
      }
    }
  }
  for (const action of actions) {
    if (!pageById.has(action.fromPageId)) throw new Error(`Action ${action.id} references unknown from page ${action.fromPageId}`);
    if (!pageById.has(action.toPageId)) throw new Error(`Action ${action.id} references unknown to page ${action.toPageId}`);
    if (action.regionId !== undefined) {
      const region = regionById.get(action.regionId);
      if (!region) throw new Error(`Action ${action.id} references unknown region ${action.regionId}`);
      if (region.pageId !== action.fromPageId) {
        throw new Error(`Action ${action.id} region ${region.id} belongs to page ${region.pageId}, not from page ${action.fromPageId}`);
      }
    }
    if (action.requirementIds !== undefined) {
      if (!Array.isArray(action.requirementIds)) throw new TypeError(`Action ${action.id} requirementIds must be an array`);
      for (const requirementId of action.requirementIds) {
        if (!requirementById.has(requirementId)) throw new Error(`Action ${action.id} references unknown requirement ${requirementId}`);
      }
    }
  }
  for (const journey of coreJourneys) {
    if (!Array.isArray(journey.actionIds) || !journey.actionIds.length) throw new TypeError(`Journey ${journey.id} actionIds must be a non-empty array`);
    const journeyActions = journey.actionIds.map((actionId) => {
      const action = actionById.get(actionId);
      if (!action) throw new Error(`Journey ${journey.id} references unknown action ${actionId}`);
      return action;
    });
    if (!pageById.has(journey.startPageId)) throw new Error(`Journey ${journey.id} references unknown start page ${journey.startPageId}`);
    if (!pageById.has(journey.expectedEndPageId)) throw new Error(`Journey ${journey.id} references unknown expected end page ${journey.expectedEndPageId}`);
    if (journeyActions[0].fromPageId !== journey.startPageId) {
      throw new Error(`Journey ${journey.id} start page is inconsistent with action ${journeyActions[0].id}`);
    }
    for (let index = 1; index < journeyActions.length; index += 1) {
      if (journeyActions[index - 1].toPageId !== journeyActions[index].fromPageId) {
        throw new Error(`Journey ${journey.id} is discontinuous at action ${journeyActions[index].id}`);
      }
    }
    if (journeyActions.at(-1).toPageId !== journey.expectedEndPageId) {
      throw new Error(`Journey ${journey.id} expected end page is inconsistent with action ${journeyActions.at(-1).id}`);
    }
  }
  for (const reference of visualReferences) {
    const page = pageById.get(reference?.scope?.pageId);
    if (!page) throw new Error(`Visual reference ${reference?.id} scope references unknown page ${reference?.scope?.pageId}`);
    if (reference.scope.regionId !== undefined) {
      const region = regionById.get(reference.scope.regionId);
      if (!region) throw new Error(`Visual reference ${reference.id} scope references unknown region ${reference.scope.regionId}`);
      if (region.pageId !== page.id) throw new Error(`Visual reference region ${region.id} belongs to page ${region.pageId}, not page ${page.id}`);
    }
  }

  const slices = pages.map((page) => {
    const orderedRegions = page.regionIds.map((regionId) => clone(regionById.get(regionId)));
    const regionRank = new Map(orderedRegions.map((region, index) => [region.id, index]));
    const selected = requirements
      .map((requirement, index) => ({ requirement, index }))
      .filter(({ requirement }) => requirement.uiEligible && requirement.targetIds.some((targetId) => targetId === page.id || regionById.get(targetId)?.pageId === page.id))
      .sort((left, right) => {
        const rank = ({ requirement }) => {
          if (requirement.targetIds.includes(page.id)) return -1;
          return Math.min(...requirement.targetIds.filter((id) => regionRank.has(id)).map((id) => regionRank.get(id)));
        };
        return rank(left) - rank(right) || left.index - right.index;
      })
      .map(({ requirement }) => clone(requirement));
    return {
      id: page.id,
      name: page.name,
      regions: orderedRegions,
      requirements: selected,
      actions: clone(actions.filter((action) => action.fromPageId === page.id)),
      visualReferences: clone(visualReferences.filter((reference) => reference.scope.pageId === page.id)),
    };
  });

  const baseline = {
    schemaVersion: 1,
    version: (previous?.version ?? 0) + 1,
    taxonomy: clone(ir.taxonomy ?? []),
    coreJourneys: clone(coreJourneys),
    nonUiRequirements: clone(requirements.filter((requirement) => requirement.uiEligible === false
      || ['business_context', 'research_evidence', 'delivery_metadata'].includes(requirement.purpose))),
    unresolvedNonBlocking: clone(blockers.filter((item) => !isResolved(item) && blockerPriority(item) === 'P2')),
    pages: slices,
  };
  const createdAt = options.createdAt ?? options.clock?.();
  if (createdAt !== undefined) baseline.createdAt = createdAt;
  return deepFreeze(baseline);
}
