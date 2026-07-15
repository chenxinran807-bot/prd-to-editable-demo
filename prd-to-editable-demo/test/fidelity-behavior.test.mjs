import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildClarificationTurn } from '../src/clarification.mjs';
import { compileExecutionBaseline } from '../src/execution-baseline.mjs';
import { validateVisualReferences } from '../src/visual-references.mjs';
import { executionBaselineToModel } from '../src/semantic-to-model.mjs';
import { validateRequirementsIrV2 } from '../src/requirements-ir-v2.mjs';

const source = '# Neutral workflow\n\nShow the exact phrase\n\nInternal research only';

function ir() {
  return {
    schemaVersion: 2,
    sourceUnits: [
      { id: 'visible', purpose: 'product_requirement', certainty: 'explicit', quote: 'Show the exact phrase' },
      { id: 'context', purpose: 'research_evidence', certainty: 'explicit', quote: 'Internal research only' },
    ],
    sourceCoverage: [{ quote: 'Show the exact phrase', sourceIds: ['visible'] }, { quote: 'Internal research only', sourceIds: ['context'] }],
    taxonomy: [{ id: 'root', label: 'Workspace', parentId: null }, { id: 'child', label: 'Request', parentId: 'root' }],
    pages: [{ id: 'start', name: 'Start', regionIds: ['main'] }, { id: 'done', name: 'Done', regionIds: [] }],
    regions: [{ id: 'main', pageId: 'start', name: 'Main', layout: { mode: 'stack', alignment: 'start' }, position: { order: 0, anchor: 'first' }, behavior: { scroll: 'page', sticky: false }, prominence: { level: 'primary', rationale: 'Core task' } }],
    requirements: [
      { id: 'copy', text: 'Show copy', exactCopy: 'Show the exact phrase', componentType: 'heading', state: 'ready', visibleState: 'visible', acceptanceCriteria: ['Exact phrase is visible'], certainty: 'explicit', sourceIds: ['visible'], uiEligible: true, targetIds: ['main'], taxonomyIds: ['child'] },
      { id: 'research', text: 'Internal research only', acceptanceCriteria: [], certainty: 'explicit', sourceIds: ['context'], uiEligible: false, targetIds: [], taxonomyIds: [] },
    ],
    actions: [{ id: 'go', name: 'Continue', trigger: 'click', visibleFeedback: 'Done page appears', stateChange: 'workflow completes', fromPageId: 'start', toPageId: 'done', regionId: 'main', requirementIds: ['copy'] }],
    coreJourneys: [{ id: 'complete', name: 'Complete', startPageId: 'start', actionIds: ['go'], expectedEndPageId: 'done' }],
    blockers: [],
  };
}

test('clear PRD compiles without redundant clarification and preserves hierarchy, copy, and UI eligibility', () => {
  const input = validateRequirementsIrV2(ir(), source);
  assert.equal(buildClarificationTurn(input.blockers), null);
  const baseline = compileExecutionBaseline(input, [], null, { createdAt: 'fixed' });
  const model = executionBaselineToModel(baseline, { name: 'Neutral workspace', goal: 'Complete request' });
  assert.deepEqual(model.taxonomy, input.taxonomy);
  assert.equal(model.pages[0].elements.find(item => item.requirementId === 'copy').text, 'Show the exact phrase');
  assert.equal(model.pages[0].elements.find(item => item.requirementId === 'copy').visibleState, 'visible');
  assert.equal(model.pages[0].elements.find(item => item.actionId === 'go').visibleFeedback, 'Done page appears');
  assert.equal(model.pages.flatMap(page => page.elements).some(item => item.requirementId === 'research'), false);
});

test('public CLI v2 path renders contract-valid exact copy and excludes research', () => {
  const root = mkdtempSync(join(tmpdir(), 'fidelity-public-v2-'));
  const prd = join(root, 'prd.md'); const requirements = join(root, 'requirements.json'); const out = join(root, 'out');
  writeFileSync(prd, source); writeFileSync(requirements, JSON.stringify(ir()));
  const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', requirements, '--intent', '快速评审初版，优先速度', '--out', out], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(readFileSync(join(out, 'prototype.manifest.json'), 'utf8'));
  assert.equal(manifest.pages[0].elements.some(item => item.text === 'Show the exact phrase'), true);
  assert.equal(manifest.pages.flatMap(page => page.elements).some(item => item.text === 'Internal research only'), false);
  assert.deepEqual(manifest.taxonomy, ir().taxonomy);
  assert.equal(manifest.pages[0].elements.find(item => item.actionId === 'go').action.target, 'done');
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
