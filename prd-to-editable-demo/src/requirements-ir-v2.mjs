const PURPOSES = new Set([
  'product_requirement', 'acceptance_criterion', 'design_constraint',
  'business_context', 'research_evidence', 'delivery_metadata',
]);
const CERTAINTIES = new Set(['explicit', 'derived', 'confirmed', 'assumed', 'missing', 'conflicting']);

function fail(message) { throw new TypeError(`Invalid requirements IR v2: ${message}`); }
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object`);
}
function string(value, name, { empty = false } = {}) {
  if (typeof value !== 'string' || (!empty && !value.trim())) fail(`${name} must be a non-empty string`);
}
function strings(value, name) {
  if (!Array.isArray(value)) fail(`${name} must be an array`);
  value.forEach((item, index) => string(item, `${name}[${index}]`));
}
function keys(value, allowed, name) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${name} has unknown property ${key}`);
}
function uniqueIds(items, name) {
  const ids = new Set();
  items.forEach((item, index) => {
    object(item, `${name}[${index}]`); string(item.id, `${name}[${index}].id`);
    if (ids.has(item.id)) fail(`duplicate ${name.replace(/s$/, '')} id ${item.id}`);
    ids.add(item.id);
  });
  return ids;
}
function references(values, ids, name, kind) {
  strings(values, name);
  for (const value of values) if (!ids.has(value)) fail(`${name} references unknown ${kind} ${value}`);
}

// Markdown blocks, rather than sentences, are the stable evidence boundary. A
// heading or formatting-only block carries structure but no independently
// actionable meaning, so it does not need a source mapping.
function semanticBlocks(source) {
  return source.replace(/\r\n?/g, '\n').split(/\n\s*\n+/).map((block) => {
    const lines = block.trim().split('\n').filter((line) => {
      const text = line.trim();
      return text && !/^#{1,6}(?:\s+.*)?$/.test(text) && !/^(?:[-*_]\s*){3,}$/.test(text)
        && !/^```/.test(text) && !/^<!--.*-->$/.test(text);
    });
    return lines.join('\n').trim();
  }).filter(Boolean);
}

export function validateRequirementsIrV2(input, source) {
  object(input, 'input');
  keys(input, ['schemaVersion', 'sourceUnits', 'sourceCoverage', 'requirements', 'taxonomy', 'pages', 'regions', 'actions', 'coreJourneys', 'blockers'], 'input');
  if (typeof source !== 'string') fail('source must be a string');
  if (input.schemaVersion !== 2) fail('schemaVersion must be 2');
  const arrayNames = ['sourceUnits', 'sourceCoverage', 'requirements', 'taxonomy', 'pages', 'regions', 'actions', 'coreJourneys', 'blockers'];
  for (const name of arrayNames) if (!Array.isArray(input[name])) fail(`${name} must be an array`);

  const sourceIds = uniqueIds(input.sourceUnits, 'sourceUnits');
  for (const unit of input.sourceUnits) {
    keys(unit, ['id', 'purpose', 'certainty', 'quote'], `sourceUnit ${unit.id}`);
    if (!PURPOSES.has(unit.purpose)) fail(`unknown sourceUnit purpose ${unit.purpose}`);
    if (!CERTAINTIES.has(unit.certainty)) fail(`unknown sourceUnit certainty ${unit.certainty}`);
    string(unit.quote, `sourceUnit ${unit.id} quote`);
    if (!source.includes(unit.quote)) fail(`sourceUnit ${unit.id} quote must be a non-empty exact substring of source`);
  }

  for (const [index, coverage] of input.sourceCoverage.entries()) {
    object(coverage, `sourceCoverage[${index}]`); string(coverage.quote, `sourceCoverage[${index}].quote`);
    keys(coverage, ['quote', 'sourceIds'], `sourceCoverage[${index}]`);
    if (!source.includes(coverage.quote)) fail(`sourceCoverage[${index}].quote must be an exact substring of source`);
    references(coverage.sourceIds, sourceIds, `sourceCoverage[${index}].sourceIds`, 'sourceUnit');
    if (!coverage.sourceIds.length) fail(`sourceCoverage[${index}].sourceIds cannot be empty`);
    for (const id of coverage.sourceIds) {
      const unit = input.sourceUnits.find((candidate) => candidate.id === id);
      if (!coverage.quote.includes(unit.quote)) fail(`sourceUnit ${id} does not occur in its covered block`);
    }
  }
  const covered = new Set(input.sourceCoverage.map(({ quote }) => quote));
  for (const block of semanticBlocks(source)) if (!covered.has(block)) fail(`unmapped meaningful source block: ${block}`);

  const requirementIds = uniqueIds(input.requirements, 'requirements');
  const taxonomyIds = uniqueIds(input.taxonomy, 'taxonomy');
  for (const requirement of input.requirements) {
    keys(requirement, ['id', 'text', 'sourceIds', 'uiEligible', 'taxonomyIds'], `requirement ${requirement.id}`);
    string(requirement.text, `requirement ${requirement.id} text`);
    references(requirement.sourceIds, sourceIds, `requirement ${requirement.id} sourceIds`, 'sourceUnit');
    if (typeof requirement.uiEligible !== 'boolean') fail(`requirement ${requirement.id} uiEligible must be boolean`);
    references(requirement.taxonomyIds, taxonomyIds, `requirement ${requirement.id} taxonomyIds`, 'taxonomy node');
    if (requirement.uiEligible && !requirement.sourceIds.some((id) => input.sourceUnits.find((unit) => unit.id === id)?.purpose === 'product_requirement')) {
      fail(`UI-eligible requirement ${requirement.id} must have a product_requirement source`);
    }
  }
  for (const node of input.taxonomy) {
    keys(node, ['id', 'label', 'parentId'], `taxonomy ${node.id}`);
    string(node.label, `taxonomy ${node.id} label`);
    if (node.parentId !== null) {
      string(node.parentId, `taxonomy ${node.id} parentId`);
      if (!taxonomyIds.has(node.parentId)) fail(`taxonomy ${node.id} has unknown parent ${node.parentId}`);
    }
  }
  const parents = new Map(input.taxonomy.map((node) => [node.id, node.parentId]));
  for (const id of taxonomyIds) {
    const path = new Set(); let cursor = id;
    while (cursor !== null) {
      if (path.has(cursor)) fail(`taxonomy cycle involving ${cursor}`);
      path.add(cursor); cursor = parents.get(cursor);
    }
  }

  const pageIds = uniqueIds(input.pages, 'pages');
  const regionIds = uniqueIds(input.regions, 'regions');
  for (const page of input.pages) {
    keys(page, ['id', 'name', 'regionIds'], `page ${page.id}`);
    string(page.name, `page ${page.id} name`);
    references(page.regionIds, regionIds, `page ${page.id} regionIds`, 'region');
  }
  for (const region of input.regions) {
    keys(region, ['id', 'pageId', 'name'], `region ${region.id}`);
    string(region.name, `region ${region.id} name`); string(region.pageId, `region ${region.id} pageId`);
    if (!pageIds.has(region.pageId)) fail(`region ${region.id} references unknown page ${region.pageId}`);
    const page = input.pages.find(({ id }) => id === region.pageId);
    if (!page.regionIds.includes(region.id)) fail(`region ${region.id} is not listed by page ${region.pageId}`);
  }

  const actionIds = uniqueIds(input.actions, 'actions');
  for (const action of input.actions) {
    keys(action, ['id', 'name', 'fromPageId', 'toPageId', 'regionId', 'requirementIds'], `action ${action.id}`);
    string(action.name, `action ${action.id} name`);
    for (const field of ['fromPageId', 'toPageId']) {
      string(action[field], `action ${action.id} ${field}`);
      if (!pageIds.has(action[field])) fail(`action ${action.id} ${field} references unknown page ${action[field]}`);
    }
    string(action.regionId, `action ${action.id} regionId`);
    if (!regionIds.has(action.regionId)) fail(`action ${action.id} references unknown region ${action.regionId}`);
    const region = input.regions.find(({ id }) => id === action.regionId);
    if (region.pageId !== action.fromPageId) fail(`action ${action.id} region is not on its from page`);
    references(action.requirementIds, requirementIds, `action ${action.id} requirementIds`, 'requirement');
  }

  uniqueIds(input.coreJourneys, 'coreJourneys');
  for (const journey of input.coreJourneys) {
    keys(journey, ['id', 'name', 'actionIds', 'startPageId', 'expectedEndPageId'], `journey ${journey.id}`);
    string(journey.name, `journey ${journey.id} name`);
    references(journey.actionIds, actionIds, `journey ${journey.id} actionIds`, 'action');
    if (!journey.actionIds.length) fail(`journey ${journey.id} actionIds cannot be empty`);
    for (const field of ['startPageId', 'expectedEndPageId']) if (!pageIds.has(journey[field])) fail(`journey ${journey.id} ${field} references unknown page`);
    const actions = journey.actionIds.map((id) => input.actions.find((action) => action.id === id));
    if (actions[0].fromPageId !== journey.startPageId) fail(`journey ${journey.id} start endpoint is inconsistent`);
    for (let index = 1; index < actions.length; index++) if (actions[index - 1].toPageId !== actions[index].fromPageId) fail(`journey ${journey.id} has discontinuous action endpoints`);
    if (actions.at(-1).toPageId !== journey.expectedEndPageId) fail(`journey ${journey.id} expected endpoint is inconsistent`);
  }

  uniqueIds(input.blockers, 'blockers');
  for (const blocker of input.blockers) {
    keys(blocker, ['id', 'text', 'certainty', 'sourceIds'], `blocker ${blocker.id}`);
    string(blocker.text, `blocker ${blocker.id} text`);
    if (!CERTAINTIES.has(blocker.certainty)) fail(`unknown blocker certainty ${blocker.certainty}`);
    references(blocker.sourceIds, sourceIds, `blocker ${blocker.id} sourceIds`, 'sourceUnit');
  }
  return structuredClone(input);
}
