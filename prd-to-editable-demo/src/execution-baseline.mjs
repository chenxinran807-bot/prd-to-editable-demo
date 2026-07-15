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

export function compileExecutionBaseline(ir, visualReferences, previous = null, options = {}) {
  if (!ir || typeof ir !== 'object' || Array.isArray(ir)) throw new TypeError('Execution baseline requires an IR object');
  if (!Array.isArray(visualReferences)) throw new TypeError('Execution baseline visual references must be an array');

  const blockers = Array.isArray(ir.blockers) ? ir.blockers : [];
  const blocking = blockers.find((item) => !isResolved(item) && ['P0', 'P1'].includes(blockerPriority(item)));
  if (blocking) throw new Error(`Cannot compile execution baseline with unresolved ${blockerPriority(blocking)} blocker ${blocking.id}`);

  const pages = Array.isArray(ir.pages) ? ir.pages : [];
  const regions = Array.isArray(ir.regions) ? ir.regions : [];
  const requirements = Array.isArray(ir.requirements) ? ir.requirements : [];
  const actions = Array.isArray(ir.actions) ? ir.actions : [];
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const regionById = new Map(regions.map((region) => [region.id, region]));

  for (const page of pages) {
    if (!Array.isArray(page.regionIds)) throw new TypeError(`Page ${page.id} regionIds must be an array`);
    for (const regionId of page.regionIds) {
      const region = regionById.get(regionId);
      if (!region) throw new Error(`Page ${page.id} references unknown region ${regionId}`);
      if (region.pageId !== page.id) throw new Error(`Region ${regionId} belongs to page ${region.pageId}, not page ${page.id}`);
    }
  }

  for (const requirement of requirements) {
    if (!Array.isArray(requirement.targetIds)) throw new TypeError(`Requirement ${requirement.id} targetIds must be an array`);
    for (const targetId of requirement.targetIds) {
      if (!pageById.has(targetId) && !regionById.has(targetId)) {
        throw new Error(`Requirement ${requirement.id} references unknown target ${targetId}`);
      }
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
    coreJourneys: clone(ir.coreJourneys ?? []),
    unresolvedNonBlocking: clone(blockers.filter((item) => !isResolved(item) && blockerPriority(item) === 'P2')),
    pages: slices,
  };
  const createdAt = options.createdAt ?? options.clock?.();
  if (createdAt !== undefined) baseline.createdAt = createdAt;
  return deepFreeze(baseline);
}
