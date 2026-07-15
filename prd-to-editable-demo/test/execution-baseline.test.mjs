import test from 'node:test';
import assert from 'node:assert/strict';
import { compileExecutionBaseline } from '../src/execution-baseline.mjs';
import { executionBaselineToModel, semanticRequirementsToModel } from '../src/semantic-to-model.mjs';

function fixture() {
  return {
    schemaVersion: 2,
    taxonomy: [{ id: 'tax-1', label: 'Account', parentId: null }],
    coreJourneys: [{ id: 'journey-1', name: 'Complete', actionIds: ['act-1'], startPageId: 'page-a', expectedEndPageId: 'page-b' }],
    pages: [
      { id: 'page-a', name: 'Start', regionIds: ['region-first', 'region-late'] },
      { id: 'page-b', name: 'Done', regionIds: ['region-done'] },
    ],
    regions: [
      { id: 'region-late', pageId: 'page-a', name: 'Later' },
      { id: 'region-first', pageId: 'page-a', name: 'First' },
      { id: 'region-done', pageId: 'page-b', name: 'Result' },
    ],
    requirements: [
      { id: 'req-page', text: 'Page message', exactCopy: 'Exact page copy', sourceIds: ['src-1'], certainty: 'explicit', evidence: [{ quote: 'q' }], acceptance: ['visible'], uiEligible: true, targetIds: ['page-a'], taxonomyIds: ['tax-1'] },
      { id: 'req-first', text: 'First requirement', exactCopy: 'First exact', sourceIds: ['src-1'], certainty: 'confirmed', evidence: [], acceptance: ['present'], uiEligible: true, targetIds: ['region-first'], taxonomyIds: [] },
      { id: 'req-late', text: 'Later requirement', sourceIds: ['src-1'], certainty: 'derived', evidence: [], acceptance: [], uiEligible: true, targetIds: ['region-late'], taxonomyIds: [] },
      { id: 'req-background', text: 'Business context', sourceIds: ['src-2'], certainty: 'explicit', evidence: [], acceptance: [], uiEligible: false, targetIds: ['page-a'], taxonomyIds: [] },
      { id: 'req-unassigned', text: 'Not rendered', sourceIds: ['src-1'], certainty: 'explicit', evidence: [], acceptance: [], uiEligible: true, targetIds: [], taxonomyIds: [] },
    ],
    actions: [{ id: 'act-1', name: 'Continue exactly', fromPageId: 'page-a', toPageId: 'page-b', regionId: 'region-late', requirementIds: ['req-late'] }],
    blockers: [{ id: 'p2', text: 'Minor unknown', priority: 'P2', resolved: false }],
  };
}

const visuals = [{ id: 'visual-1', asset: 'screen.png', scope: { pageId: 'page-a', regionId: 'region-first' }, bindings: [{ property: 'layout', fidelity: 'high' }], exclude: [] }];

test('compiles ordered frozen page slices without background requirements', () => {
  const ir = fixture();
  const baseline = compileExecutionBaseline(ir, visuals, null, { createdAt: 'fixed' });
  assert.equal(baseline.schemaVersion, 1);
  assert.equal(baseline.version, 1);
  assert.equal(baseline.createdAt, 'fixed');
  assert.deepEqual(baseline.taxonomy, ir.taxonomy);
  assert.deepEqual(baseline.coreJourneys, ir.coreJourneys);
  assert.deepEqual(baseline.unresolvedNonBlocking, ir.blockers);
  assert.deepEqual(baseline.pages[0].regions.map(({ id }) => id), ['region-first', 'region-late']);
  assert.deepEqual(baseline.pages[0].requirements.map(({ id }) => id), ['req-page', 'req-first', 'req-late']);
  assert.deepEqual(baseline.pages[0].visualReferences[0].scope, { pageId: 'page-a', regionId: 'region-first' });
  assert.equal(baseline.pages[0].requirements[0].exactCopy, 'Exact page copy');
  assert.ok(Object.isFrozen(baseline));
  assert.ok(Object.isFrozen(baseline.pages[0].requirements[0].evidence));
  ir.taxonomy[0].label = 'mutated';
  assert.equal(baseline.taxonomy[0].label, 'Account');
});

test('blocks unresolved P0/P1, retains P2, and increments previous version', () => {
  for (const priority of ['P0', 'P1']) {
    const ir = fixture(); ir.blockers = [{ id: 'block', text: 'stop', priority, resolved: false }];
    assert.throws(() => compileExecutionBaseline(ir, []), new RegExp(priority));
  }
  const baseline = compileExecutionBaseline(fixture(), [], { version: 7 }, { clock: () => 'clocked' });
  assert.equal(baseline.version, 8);
  assert.equal(baseline.createdAt, 'clocked');
});

test('rejects unknown requirement targets and invalid visual region ownership', () => {
  const badTarget = fixture(); badTarget.requirements[0].targetIds = ['missing'];
  assert.throws(() => compileExecutionBaseline(badTarget, []), /unknown target missing/);
  const badVisual = structuredClone(visuals); badVisual[0].scope.pageId = 'page-b';
  assert.throws(() => compileExecutionBaseline(fixture(), badVisual), /belongs to page page-a/);
});

test('rejects duplicate or empty graph entity IDs with entity diagnostics', () => {
  for (const collection of ['pages', 'regions', 'requirements', 'actions', 'coreJourneys']) {
    const ir = fixture();
    ir[collection].push(structuredClone(ir[collection][0]));
    assert.throws(() => compileExecutionBaseline(ir, visuals), new RegExp(`duplicate ${collection.slice(0, -1)} id`, 'i'));
    ir[collection].pop();
    ir[collection][0].id = '   ';
    assert.throws(() => compileExecutionBaseline(ir, visuals), new RegExp(`${collection.slice(0, -1)}.*id`, 'i'));
  }
  const duplicateVisuals = [visuals[0], structuredClone(visuals[0])];
  assert.throws(() => compileExecutionBaseline(fixture(), duplicateVisuals), /duplicate visual reference id visual-1/i);
});

test('rejects ambiguous IDs shared by a page and region', () => {
  const ir = fixture();
  ir.pages[1].id = 'region-first';
  ir.regions[2].pageId = 'region-first';
  ir.actions[0].toPageId = 'region-first';
  ir.coreJourneys[0].expectedEndPageId = 'region-first';
  assert.throws(() => compileExecutionBaseline(ir, visuals), /page and region share ambiguous id region-first/i);
});

test('rejects orphan regions and invalid action graph references', () => {
  const orphan = fixture();
  orphan.regions.push({ id: 'region-orphan', pageId: 'page-a', name: 'Orphan' });
  assert.throws(() => compileExecutionBaseline(orphan, visuals), /region region-orphan.*not listed.*page page-a/i);

  for (const [field, value, message] of [
    ['fromPageId', 'missing', /action act-1.*unknown from page missing/i],
    ['toPageId', 'missing', /action act-1.*unknown to page missing/i],
    ['regionId', 'missing', /action act-1.*unknown region missing/i],
    ['regionId', 'region-done', /action act-1.*region region-done.*page page-b.*from page page-a/i],
  ]) {
    const ir = fixture(); ir.actions[0][field] = value;
    assert.throws(() => compileExecutionBaseline(ir, visuals), message);
  }
});

test('rejects dangling or inconsistent journey graphs', () => {
  const dangling = fixture(); dangling.coreJourneys[0].actionIds = ['missing'];
  assert.throws(() => compileExecutionBaseline(dangling, visuals), /journey journey-1.*unknown action missing/i);
  const endpoint = fixture(); endpoint.coreJourneys[0].expectedEndPageId = 'missing';
  assert.throws(() => compileExecutionBaseline(endpoint, visuals), /journey journey-1.*unknown expected end page missing/i);
  const inconsistent = fixture(); inconsistent.coreJourneys[0].startPageId = 'page-b';
  assert.throws(() => compileExecutionBaseline(inconsistent, visuals), /journey journey-1.*start.*action act-1/i);
});

test('builds model in baseline order with exact copy and declared actions only', () => {
  const baseline = compileExecutionBaseline(fixture(), visuals);
  const model = executionBaselineToModel(baseline, { name: 'Neutral product', goal: 'Complete a flow' });
  assert.deepEqual(model.pages.map(({ id }) => id), ['page-a', 'page-b']);
  assert.deepEqual(model.pages[0].elements.map(({ text }) => text), ['Exact page copy', 'First exact', 'Later requirement', 'Continue exactly']);
  assert.deepEqual(model.pages[0].elements[0].requirement, baseline.pages[0].requirements[0]);
  assert.deepEqual(model.pages[0].elements[1].requirement.taxonomyIds, []);
  assert.deepEqual(model.pages[0].elements[1].requirement.targetIds, ['region-first']);
  assert.equal(model.pages[0].elements[1].requirement.uiEligible, true);
  assert.equal(model.pages[0].elements[1].requirement.exactCopy, 'First exact');
  assert.equal(model.pages[0].elements[3].actionId, 'act-1');
  assert.deepEqual(model.pages[0].elements[3].action, { type: 'navigate', target: 'page-b' });
  assert.deepEqual(model.taxonomy, baseline.taxonomy);
  assert.deepEqual(model.coreJourneys, baseline.coreJourneys);
  assert.equal(model.executionBaseline, baseline);
  assert.equal(model.pages[1].elements.length, 0);
});

test('keeps the v1 semantic adapter behavior', () => {
  const model = semanticRequirementsToModel({
    title: 'Legacy', goal: 'Work', actor: 'User', screens: ['One', 'Two'], states: [], businessObjects: [],
    transitions: [{ from: 'One', to: 'Two', action: 'Go' }], evidence: [], assumptions: [], gaps: [],
  });
  assert.equal(model.pages[0].elements.at(-1).text, 'Go');
  assert.equal(model.pages[1].elements.at(-1).text, '返回');
});
