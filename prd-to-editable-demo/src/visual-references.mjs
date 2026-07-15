const PROPERTIES = new Set([
  'layout', 'relative-position', 'proportion', 'spacing', 'color', 'typography',
  'iconography', 'imagery', 'crop', 'component', 'copy-style', 'interaction-feedback',
]);
const FIDELITIES = new Set(['exact', 'high', 'local', 'inspiration']);

function fail(message) { throw new TypeError(`Invalid visual references: ${message}`); }
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object`);
}
function string(value, name) {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} must be a non-empty string`);
}
function keys(value, allowed, name) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${name} has unknown property ${key}`);
}
function property(value, name) {
  string(value, name);
  if (!PROPERTIES.has(value)) fail(`${name} has unknown property ${value}`);
}

function validateContext(context) {
  if (context === undefined) return undefined;
  object(context, 'context');
  keys(context, ['pageIds', 'regions'], 'context');
  if (!Array.isArray(context.pageIds)) fail('context.pageIds must be an array');
  if (!Array.isArray(context.regions)) fail('context.regions must be an array');
  const pageIds = new Set();
  for (const [index, id] of context.pageIds.entries()) {
    string(id, `context.pageIds[${index}]`);
    if (pageIds.has(id)) fail(`duplicate context page id ${id}`);
    pageIds.add(id);
  }
  const regions = new Map();
  for (const [index, region] of context.regions.entries()) {
    object(region, `context.regions[${index}]`);
    keys(region, ['id', 'pageId'], `context.regions[${index}]`);
    string(region.id, `context.regions[${index}].id`);
    string(region.pageId, `context.regions[${index}].pageId`);
    if (regions.has(region.id)) fail(`duplicate context region id ${region.id}`);
    if (!pageIds.has(region.pageId)) fail(`context region ${region.id} references unknown page ${region.pageId}`);
    regions.set(region.id, region.pageId);
  }
  return { pageIds, regions };
}

export function validateVisualReferences(references, context) {
  if (!Array.isArray(references)) fail('references must be an array');
  const resolvedContext = validateContext(context);
  const ids = new Set();
  const exactBindings = [];

  for (const [index, reference] of references.entries()) {
    object(reference, `references[${index}]`);
    keys(reference, ['id', 'asset', 'scope', 'bindings', 'exclude', 'evidenceRegions'], `reference ${index}`);
    string(reference.id, `references[${index}].id`);
    if (ids.has(reference.id)) fail(`duplicate reference id ${reference.id}`);
    ids.add(reference.id);
    string(reference.asset, `reference ${reference.id} asset`);

    object(reference.scope, `reference ${reference.id} scope`);
    keys(reference.scope, ['pageId', 'regionId'], `reference ${reference.id} scope`);
    string(reference.scope.pageId, `reference ${reference.id} scope.pageId`);
    if (reference.scope.regionId !== undefined) string(reference.scope.regionId, `reference ${reference.id} scope.regionId`);
    if (resolvedContext) {
      if (!resolvedContext.pageIds.has(reference.scope.pageId)) fail(`reference ${reference.id} scope references unknown page ${reference.scope.pageId}`);
      if (reference.scope.regionId !== undefined) {
        if (!resolvedContext.regions.has(reference.scope.regionId)) fail(`reference ${reference.id} scope references unknown region ${reference.scope.regionId}`);
        const owner = resolvedContext.regions.get(reference.scope.regionId);
        if (owner !== reference.scope.pageId) fail(`region ${reference.scope.regionId} belongs to page ${owner}, not page ${reference.scope.pageId}`);
      }
    }

    if (!Array.isArray(reference.bindings) || !reference.bindings.length) fail(`reference ${reference.id} bindings must be a non-empty array`);
    const bound = new Set();
    for (const [bindingIndex, item] of reference.bindings.entries()) {
      object(item, `reference ${reference.id} bindings[${bindingIndex}]`);
      keys(item, ['property', 'fidelity'], `reference ${reference.id} bindings[${bindingIndex}]`);
      property(item.property, `reference ${reference.id} binding`);
      if (bound.has(item.property)) fail(`reference ${reference.id} has duplicate binding property ${item.property}`);
      bound.add(item.property);
      string(item.fidelity, `reference ${reference.id} binding fidelity`);
      if (!FIDELITIES.has(item.fidelity)) fail(`reference ${reference.id} has unknown fidelity ${item.fidelity}`);
      if (item.fidelity === 'exact') exactBindings.push({
        referenceId: reference.id, property: item.property,
        pageId: reference.scope.pageId, regionId: reference.scope.regionId,
      });
    }

    if (!Array.isArray(reference.exclude)) fail(`reference ${reference.id} exclude must be an array`);
    const excluded = new Set();
    for (const [excludeIndex, item] of reference.exclude.entries()) {
      property(item, `reference ${reference.id} exclude[${excludeIndex}]`);
      if (excluded.has(item)) fail(`reference ${reference.id} has duplicate excluded property ${item}`);
      if (bound.has(item)) fail(`reference ${reference.id} property ${item} is both bound and excluded`);
      excluded.add(item);
    }

    if (reference.evidenceRegions !== undefined) {
      if (!Array.isArray(reference.evidenceRegions)) fail(`reference ${reference.id} evidenceRegions must be an array`);
      for (const [regionIndex, region] of reference.evidenceRegions.entries()) {
        object(region, `reference ${reference.id} evidenceRegions[${regionIndex}]`);
        keys(region, ['label', 'purpose', 'boundingBox'], `reference ${reference.id} evidenceRegions[${regionIndex}]`);
        string(region.label, `reference ${reference.id} evidence region label`);
        string(region.purpose, `reference ${reference.id} evidence region purpose`);
        if (!Array.isArray(region.boundingBox) || region.boundingBox.length !== 4
          || region.boundingBox.some((number) => typeof number !== 'number' || !Number.isFinite(number))) {
          fail(`reference ${reference.id} evidence region boundingBox must contain four finite numbers`);
        }
      }
    }
  }

  for (let left = 0; left < exactBindings.length; left++) {
    for (let right = left + 1; right < exactBindings.length; right++) {
      const a = exactBindings[left]; const b = exactBindings[right];
      const overlaps = a.pageId === b.pageId && a.property === b.property
        && (a.regionId === undefined || b.regionId === undefined || a.regionId === b.regionId);
      if (overlaps && a.referenceId !== b.referenceId) {
        fail(`exact binding conflict for ${a.property} between references ${a.referenceId} and ${b.referenceId}`);
      }
    }
  }
  const normalized = structuredClone(references);
  for (const reference of normalized) reference.evidenceRegions ??= [];
  return normalized;
}
