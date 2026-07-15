import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClarificationTurn } from '../src/clarification.mjs';
import { compileExecutionBaseline } from '../src/execution-baseline.mjs';
import { validateVisualReferences } from '../src/visual-references.mjs';
import { executionBaselineToModel } from '../src/semantic-to-model.mjs';

function ir() {
  return {
    schemaVersion: 2,
    sourceUnits: [
      { id: 'visible', purpose: 'product_requirement', quote: 'Show the exact phrase' },
      { id: 'context', purpose: 'research_evidence', quote: 'Internal research only' },
    ],
    taxonomy: [{ id: 'root', label: 'Workspace', parentId: null }, { id: 'child', label: 'Request', parentId: 'root' }],
    pages: [{ id: 'start', name: 'Start', regionIds: ['main'] }, { id: 'done', name: 'Done', regionIds: [] }],
    regions: [{ id: 'main', pageId: 'start', name: 'Main' }],
    requirements: [
      { id: 'copy', text: 'Show copy', exactCopy: 'Show the exact phrase', sourceIds: ['visible'], uiEligible: true, targetIds: ['main'], taxonomyIds: ['child'] },
      { id: 'research', text: 'Internal research only', sourceIds: ['context'], uiEligible: false, targetIds: ['start'], taxonomyIds: [] },
    ],
    actions: [{ id: 'go', name: 'Continue', fromPageId: 'start', toPageId: 'done', regionId: 'main', requirementIds: ['copy'] }],
    coreJourneys: [{ id: 'complete', name: 'Complete', startPageId: 'start', actionIds: ['go'], expectedEndPageId: 'done' }],
    blockers: [],
  };
}

test('clear PRD compiles without redundant clarification and preserves hierarchy, copy, and UI eligibility', () => {
  const input = ir();
  assert.equal(buildClarificationTurn(input.blockers), null);
  const baseline = compileExecutionBaseline(input, [], null, { createdAt: 'fixed' });
  const model = executionBaselineToModel(baseline, { name: 'Neutral workspace', goal: 'Complete request' });
  assert.deepEqual(model.taxonomy, input.taxonomy);
  assert.equal(model.pages[0].elements.find(item => item.requirementId === 'copy').text, 'Show the exact phrase');
  assert.equal(model.pages.flatMap(page => page.elements).some(item => item.requirementId === 'research'), false);
});

test('consequential blockers are progressive: recommendation first, one theme, at most three decisions', () => {
  const blockers = Array.from({ length: 5 }, (_, index) => ({
    id: `b${index}`, theme: index === 4 ? 'secondary' : 'core-flow', priority: index ? 'P1' : 'P0',
    requirementId: 'copy', question: `Recommended: choose path ${index}`, options: ['Recommended path', 'Alternative'],
  }));
  const turn = buildClarificationTurn(blockers);
  assert.equal(turn.theme, 'core-flow');
  assert.ok(turn.questions.length <= 3);
  assert.ok(turn.questions.every(question => question.theme === 'core-flow' && question.question.startsWith('Recommended:')));
});

test('multiple visual references keep property scopes distinct instead of moodboard blending', () => {
  const refs = validateVisualReferences([
    { id: 'colors', asset: 'colors.png', scope: { pageId: 'start' }, bindings: [{ property: 'color', fidelity: 'high' }], exclude: ['layout'] },
    { id: 'layout', asset: 'layout.png', scope: { pageId: 'start' }, bindings: [{ property: 'layout', fidelity: 'exact' }], exclude: ['color'] },
  ], { pageIds: ['start'], regions: [] });
  assert.deepEqual(refs[0].bindings.map(item => item.property), ['color']);
  assert.deepEqual(refs[0].exclude, ['layout']);
  assert.deepEqual(refs[1].bindings.map(item => item.property), ['layout']);
  assert.deepEqual(refs[1].exclude, ['color']);
});
