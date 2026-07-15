import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateRequirementsIrV2 } from '../src/requirements-ir-v2.mjs';

const source = `# Product brief

People can save an item from the detail view.

Market interviews indicate that speed matters.

The save control must remain visible.`;

function validIr() {
  return {
    schemaVersion: 2,
    sourceUnits: [
      { id: 's1', purpose: 'product_requirement', certainty: 'explicit', quote: 'People can save an item from the detail view.' },
      { id: 's2', purpose: 'research_evidence', certainty: 'confirmed', quote: 'Market interviews indicate that speed matters.' },
      { id: 's3', purpose: 'design_constraint', certainty: 'explicit', quote: 'The save control must remain visible.' },
    ],
    sourceCoverage: [
      { quote: 'People can save an item from the detail view.', sourceIds: ['s1'] },
      { quote: 'Market interviews indicate that speed matters.', sourceIds: ['s2'] },
      { quote: 'The save control must remain visible.', sourceIds: ['s3'] },
    ],
    requirements: [
      { id: 'r1', text: 'Save an item', exactCopy: 'Save this item', componentType: 'button', state: 'ready', visibleState: 'enabled', acceptanceCriteria: ['Control is visible'], certainty: 'explicit', targetIds: ['reg1'], sourceIds: ['s1', 's3'], uiEligible: true, taxonomyIds: ['t-child'] },
      { id: 'r2', text: 'Speed is important', acceptanceCriteria: [], certainty: 'confirmed', targetIds: [], sourceIds: ['s2'], uiEligible: false, taxonomyIds: ['t-root'] },
    ],
    taxonomy: [
      { id: 't-root', label: 'Collection', parentId: null },
      { id: 't-child', label: 'Saving', parentId: 't-root' },
    ],
    pages: [{ id: 'p1', name: 'Detail', regionIds: ['reg1'] }],
    regions: [{ id: 'reg1', pageId: 'p1', name: 'Primary', layout: { mode: 'stack', alignment: 'start' }, position: { order: 1, anchor: 'content' }, behavior: { scroll: 'page', sticky: false }, prominence: { level: 'primary', rationale: 'Core action' } }],
    actions: [{ id: 'a1', name: 'Save', trigger: 'click', visibleFeedback: 'Saved state appears', stateChange: 'item becomes saved', fromPageId: 'p1', toPageId: 'p1', regionId: 'reg1', requirementIds: ['r1'] }],
    coreJourneys: [{ id: 'j1', name: 'Save flow', actionIds: ['a1'], startPageId: 'p1', expectedEndPageId: 'p1' }],
    blockers: [{ id: 'b1', text: 'Persistence behavior is unspecified', certainty: 'missing', sourceIds: [], requirementId: 'r1', theme: 'persistence', priority: 'P1', impact: 'Changes visible state', recommendation: 'Keep the item saved', options: ['Keep saved', 'Reset after exit'], resolutions: [{ option: 'Keep saved', patches: [{ entity: 'requirement', id: 'r1', field: 'visibleState', value: 'saved' }] }, { option: 'Reset after exit', patches: [{ entity: 'requirement', id: 'r1', field: 'visibleState', value: 'ready' }] }] }],
  };
}

test('accepts and deep-copies a valid typed v2 IR while preserving hierarchy', () => {
  const input = validIr();
  const before = structuredClone(input);
  const result = validateRequirementsIrV2(input, source);
  assert.deepEqual(result, before);
  assert.notStrictEqual(result, input);
  assert.notStrictEqual(result.taxonomy[0], input.taxonomy[0]);
  assert.equal(result.taxonomy[1].parentId, 't-root');
  assert.equal(result.requirements[0].exactCopy, 'Save this item');
  assert.equal(result.requirements[0].componentType, 'button');
  assert.equal(result.regions[0].position.order, 1);
  assert.equal(result.actions[0].visibleFeedback, 'Saved state appears');
  assert.deepEqual(input, before);
});

test('rejects an unmapped meaningful Markdown block but ignores headings', () => {
  const input = validIr();
  input.sourceCoverage.splice(1, 1);
  assert.throws(() => validateRequirementsIrV2(input, source), /unmapped meaningful source block/i);
});

test('accepts exact multi-line CRLF evidence when checking semantic block coverage', () => {
  const crlfSource = '# Brief\r\n\r\nPeople can save an item.\r\nThe control stays visible.';
  const quote = 'People can save an item.\r\nThe control stays visible.';
  const input = validIr();
  input.sourceUnits = [{ id: 's1', purpose: 'product_requirement', certainty: 'explicit', quote }];
  input.sourceCoverage = [{ quote, sourceIds: ['s1'] }];
  input.requirements = [{ id: 'r1', text: 'Save an item', acceptanceCriteria: [], certainty: 'explicit', targetIds: ['reg1'], sourceIds: ['s1'], uiEligible: true, taxonomyIds: ['t-child'] }];
  input.actions[0].requirementIds = ['r1'];
  input.blockers[0].sourceIds = [];
  assert.doesNotThrow(() => validateRequirementsIrV2(input, crlfSource));
});

test('rejects a coverage mapping whose source evidence is outside the block', () => {
  const input = validIr();
  input.sourceCoverage[0].sourceIds = ['s2'];
  assert.throws(() => validateRequirementsIrV2(input, source), /does not occur in its covered block/i);
});

test('rejects background or research evidence marked UI eligible', () => {
  const input = validIr();
  input.requirements[1].uiEligible = true;
  assert.throws(() => validateRequirementsIrV2(input, source), /product_requirement source/i);
});

test('requires visible requirements to have real targets and validates new metadata strictly', () => {
  const missingTargets = validIr(); missingTargets.requirements[0].targetIds = [];
  assert.throws(() => validateRequirementsIrV2(missingTargets, source), /UI-eligible.*target/i);
  const unknownTarget = validIr(); unknownTarget.requirements[0].targetIds = ['missing'];
  assert.throws(() => validateRequirementsIrV2(unknownTarget, source), /unknown target missing/i);
  const blankCopy = validIr(); blankCopy.requirements[0].exactCopy = '   ';
  assert.throws(() => validateRequirementsIrV2(blankCopy, source), /exactCopy.*non-empty/i);
  const badOrder = validIr(); badOrder.regions[0].position.order = -1;
  assert.throws(() => validateRequirementsIrV2(badOrder, source), /order.*non-negative integer/i);
  const blankFeedback = validIr(); blankFeedback.actions[0].visibleFeedback = ' ';
  assert.throws(() => validateRequirementsIrV2(blankFeedback, source), /visibleFeedback.*non-empty/i);
});

test('rejects a source quote that is absent from the PRD', () => {
  const input = validIr();
  input.sourceUnits[0].quote = 'Not in the source';
  assert.throws(() => validateRequirementsIrV2(input, source), /exact substring/i);
});

test('rejects a missing or whitespace-only source quote', () => {
  const missing = validIr();
  delete missing.sourceUnits[0].quote;
  assert.throws(() => validateRequirementsIrV2(missing, source), /quote must be a non-empty string/i);
  const blank = validIr();
  blank.sourceUnits[0].quote = '   ';
  assert.throws(() => validateRequirementsIrV2(blank, source), /quote must be a non-empty string/i);
});

test('rejects an unknown or cyclic taxonomy parent', () => {
  const unknown = validIr();
  unknown.taxonomy[1].parentId = 'nope';
  assert.throws(() => validateRequirementsIrV2(unknown, source), /unknown parent/i);
  const cyclic = validIr();
  cyclic.taxonomy[0].parentId = 't-child';
  assert.throws(() => validateRequirementsIrV2(cyclic, source), /cycle/i);
});

test('rejects invalid action and journey references and endpoint mismatch', () => {
  const action = validIr();
  action.actions[0].toPageId = 'missing';
  assert.throws(() => validateRequirementsIrV2(action, source), /unknown page/i);
  const journey = validIr();
  journey.coreJourneys[0].actionIds = ['missing'];
  assert.throws(() => validateRequirementsIrV2(journey, source), /unknown action/i);
  const endpoint = validIr();
  endpoint.pages.push({ id: 'p2', name: 'Confirmation', regionIds: [] });
  endpoint.coreJourneys[0].expectedEndPageId = 'p2';
  assert.throws(() => validateRequirementsIrV2(endpoint, source), /expected endpoint/i);
});

test('validates journey endpoints as non-empty strings and reports invalid values', () => {
  const blank = validIr();
  blank.coreJourneys[0].startPageId = '   ';
  assert.throws(() => validateRequirementsIrV2(blank, source), /startPageId must be a non-empty string/i);
  const unknown = validIr();
  unknown.coreJourneys[0].expectedEndPageId = 'missing-page';
  assert.throws(() => validateRequirementsIrV2(unknown, source), /unknown page missing-page/i);
});

test('rejects duplicate IDs, including region IDs', () => {
  const input = validIr();
  input.regions.push({ ...input.regions[0] });
  assert.throws(() => validateRequirementsIrV2(input, source), /duplicate region id/i);
});

test('rejects a page that claims a region owned by another page', () => {
  const input = validIr();
  input.pages.push({ id: 'p2', name: 'Other', regionIds: ['reg1'] });
  assert.throws(() => validateRequirementsIrV2(input, source), /region reg1 belongs to page p1/i);
});

test('requires every blocker to resolve to a real requirement', () => {
  const missing = validIr(); delete missing.blockers[0].requirementId;
  assert.throws(() => validateRequirementsIrV2(missing, source), /requirementId.*non-empty/i);
  const unknown = validIr(); unknown.blockers[0].requirementId = 'missing';
  assert.throws(() => validateRequirementsIrV2(unknown, source), /unknown requirement missing/i);
  const empty = validIr(); empty.requirements = []; empty.actions[0].requirementIds = []; empty.blockers[0].requirementId = 'r1';
  assert.throws(() => validateRequirementsIrV2(empty, source), /unknown requirement r1/i);
});

test('schema rejects whitespace-only persisted strings consistently', () => {
  const schema = JSON.parse(readFileSync(new URL('../schemas/requirements-ir-v2.schema.json', import.meta.url), 'utf8'));
  const nonWhitespace = '.*\\S.*';
  assert.equal(schema.$defs.id.pattern, nonWhitespace);
  for (const [definition, fields] of Object.entries({
    sourceUnit: ['quote'], sourceCoverage: ['quote'], requirement: ['text'],
    taxonomyNode: ['label'], page: ['name'], region: ['name'], action: ['name'],
    coreJourney: ['name'], blocker: ['text'],
  })) {
    for (const field of fields) assert.equal(schema.$defs[definition].properties[field].pattern, nonWhitespace, `${definition}.${field}`);
  }
});
