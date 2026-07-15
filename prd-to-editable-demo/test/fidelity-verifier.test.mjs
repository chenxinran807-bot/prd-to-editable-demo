import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyFidelity } from '../src/fidelity-verifier.mjs';

function fixture() {
  const baseline = {
    taxonomy: [
      { id: 'root', label: 'Root', parentId: null },
      { id: 'child', label: 'Child', parentId: 'root' },
    ],
    coreJourneys: [{ id: 'journey', startPageId: 'start', actionIds: ['next'], expectedEndPageId: 'done' }],
    pages: [
      {
        id: 'start', name: 'Start', regions: [{ id: 'hero', pageId: 'start' }],
        requirements: [
          { id: 'copy', text: 'Greeting', exactCopy: 'Hello exactly', uiEligible: true, targetIds: ['hero'] },
          { id: 'rendered', text: 'Useful content', uiEligible: true, targetIds: ['start'] },
        ],
        actions: [{ id: 'next', name: 'Continue', fromPageId: 'start', toPageId: 'done', regionId: 'hero' }],
        visualReferences: [{ id: 'visual', scope: { pageId: 'start', regionId: 'hero' }, bindings: [{ property: 'layout', fidelity: 'exact' }], exclude: ['color'] }],
      },
      { id: 'done', name: 'Done', regions: [], requirements: [], actions: [], visualReferences: [] },
    ],
    nonUiRequirements: [{ id: 'background', text: 'Market research', uiEligible: false, purpose: 'research_evidence', sourceIds: ['source-background'], targetIds: ['start'] }],
  };
  const model = {
    taxonomy: structuredClone(baseline.taxonomy), coreJourneys: structuredClone(baseline.coreJourneys), startPage: 'start',
    appliedVisualReferences: [{ id: 'visual', scope: { pageId: 'start', regionId: 'hero' }, bindings: [{ property: 'layout', fidelity: 'exact' }], excludedProperties: ['color'], elementKeys: ['copy'] }],
    pages: [
      { id: 'start', title: 'Start', elements: [
        { key: 'copy', type: 'heading', text: 'Hello exactly', requirementId: 'copy', regionId: 'hero' },
        { key: 'rendered', type: 'heading', text: 'Useful content', requirementId: 'rendered' },
        { key: 'next', type: 'button', text: 'Continue', actionId: 'next', regionId: 'hero', action: { type: 'navigate', target: 'done' } },
      ] },
      { id: 'done', title: 'Done', elements: [] },
    ],
  };
  return { baseline, model };
}

test('passes and returns machine-readable traceability without mutation', () => {
  const { baseline, model } = fixture();
  const before = structuredClone({ baseline, model });
  const result = verifyFidelity({ baseline, model });
  assert.equal(result.status, 'passed');
  assert.ok(result.checks.every(check => check.passed));
  assert.deepEqual(result.traceability.find(item => item.id === 'copy'), { kind: 'requirement', id: 'copy', pageId: 'start', elementKeys: ['copy'] });
  assert.deepEqual(result.traceability.find(item => item.id === 'next'), { kind: 'action', id: 'next', pageId: 'start', elementKeys: ['next'] });
  assert.deepEqual({ baseline, model }, before);
});

test('rejects missing and unexplained extra product pages but allows generated pages', () => {
  const missing = fixture(); missing.model.pages.pop();
  assert.throws(() => verifyFidelity(missing), /missing required page done/i);
  const extra = fixture(); extra.model.pages.push({ id: 'marketing', elements: [] });
  assert.throws(() => verifyFidelity(extra), /unexplained extra page marketing/i);
  extra.model.pages.at(-1).generated = true;
  assert.doesNotThrow(() => verifyFidelity(extra));
});

test('requires exact copy in its assigned page and region and traces other requirements', () => {
  const wrongRegion = fixture(); wrongRegion.model.pages[0].elements[0].regionId = undefined;
  assert.throws(() => verifyFidelity(wrongRegion), /exact copy.*copy.*region hero/i);
  const wrongPage = fixture(); wrongPage.model.pages[0].elements.shift(); wrongPage.model.pages[1].elements.push({ key: 'elsewhere', text: 'Hello exactly', requirementId: 'copy', regionId: 'hero' });
  assert.throws(() => verifyFidelity(wrongPage), /exact copy.*copy.*page start/i);
  const missingTrace = fixture(); delete missingTrace.model.pages[0].elements[1].requirementId;
  assert.throws(() => verifyFidelity(missingTrace), /requirement rendered.*traceable/i);
});

test('rejects flattened, reparented, extra, and reordered taxonomy nodes', () => {
  for (const mutate of [
    model => { model.taxonomy = [{ id: 'root', label: 'Root', parentId: null }]; },
    model => { model.taxonomy[1].parentId = null; },
    model => { model.taxonomy.push({ id: 'extra', parentId: 'root' }); },
    model => { model.taxonomy.reverse(); },
  ]) {
    const data = fixture(); mutate(data.model);
    assert.throws(() => verifyFidelity(data), /taxonomy/i);
  }
});

test('rejects notice, wrong target, duplicate, and undeclared rendered actions', () => {
  const notice = fixture(); notice.model.pages[0].elements[2].action = { type: 'notice', message: 'done' };
  assert.throws(() => verifyFidelity(notice), /action next.*navigate/i);
  const wrong = fixture(); wrong.model.pages[0].elements[2].action.target = 'start';
  assert.throws(() => verifyFidelity(wrong), /action next.*target done/i);
  const duplicate = fixture(); duplicate.model.pages[0].elements.push({ ...duplicate.model.pages[0].elements[2], key: 'duplicate' });
  assert.throws(() => verifyFidelity(duplicate), /action next.*exactly one/i);
  const undeclared = fixture(); undeclared.model.pages[1].elements.push({ key: 'surprise', type: 'button', actionId: 'surprise', action: { type: 'navigate', target: 'start' } });
  assert.throws(() => verifyFidelity(undeclared), /undeclared action surprise/i);
});

test('simulates complete journeys and rejects model-level discontinuity', () => {
  assert.doesNotThrow(() => verifyFidelity(fixture()));
  const data = fixture();
  data.baseline.coreJourneys[0].actionIds.push('back');
  data.baseline.pages[1].actions.push({ id: 'back', fromPageId: 'done', toPageId: 'start' });
  data.model.pages[1].elements.push({ key: 'back', type: 'button', actionId: 'back', action: { type: 'navigate', target: 'start' } });
  assert.throws(() => verifyFidelity(data), /journey journey.*expected end done.*reached start/i);
});

test('requires visual binding metadata and rejects claims for excluded properties', () => {
  const missing = fixture(); missing.model.appliedVisualReferences = [];
  assert.throws(() => verifyFidelity(missing), /visual reference visual.*missing/i);
  const conflict = fixture(); conflict.model.appliedVisualReferences[0].bindings.push({ property: 'color', fidelity: 'exact' });
  assert.throws(() => verifyFidelity(conflict), /visual reference visual.*excluded property color/i);
});

test('requires real in-scope element keys for every applied visual reference', () => {
  const missing = fixture(); missing.model.appliedVisualReferences[0].elementKeys = [];
  assert.throws(() => verifyFidelity(missing), /visual reference visual.*non-empty elementKeys/i);
  const fictional = fixture(); fictional.model.appliedVisualReferences[0].elementKeys = ['fictional'];
  assert.throws(() => verifyFidelity(fictional), /visual reference visual.*unknown element key fictional/i);
  const wrongRegion = fixture(); wrongRegion.model.pages[0].elements.push({ key: 'other', text: 'Other', regionId: 'other-region' }); wrongRegion.model.appliedVisualReferences[0].elementKeys = ['other'];
  assert.throws(() => verifyFidelity(wrongRegion), /visual reference visual.*element key other.*region hero/i);
  const wrongPage = fixture(); wrongPage.model.pages[1].elements.push({ key: 'done-key', text: 'Done' }); wrongPage.model.appliedVisualReferences[0].elementKeys = ['done-key'];
  assert.throws(() => verifyFidelity(wrongPage), /visual reference visual.*element key done-key.*page start/i);
});

test('requires exact exclusions and bindings with no extra visual claims', () => {
  const missingExclude = fixture(); missingExclude.model.appliedVisualReferences[0].excludedProperties = [];
  assert.throws(() => verifyFidelity(missingExclude), /visual reference visual.*excluded properties.*baseline/i);
  const extraExclude = fixture(); extraExclude.model.appliedVisualReferences[0].excludedProperties.push('typography');
  assert.throws(() => verifyFidelity(extraExclude), /visual reference visual.*excluded properties.*baseline/i);
  const extraBinding = fixture(); extraBinding.model.appliedVisualReferences[0].bindings.push({ property: 'spacing', fidelity: 'exact' });
  assert.throws(() => verifyFidelity(extraBinding), /visual reference visual.*bindings.*baseline/i);
});

test('requires subjective review metadata for high, local, and inspiration fidelity', () => {
  for (const fidelity of ['high', 'local', 'inspiration']) {
    const missing = fixture(); missing.baseline.pages[0].visualReferences[0].bindings[0].fidelity = fidelity; missing.model.appliedVisualReferences[0].bindings[0].fidelity = fidelity;
    assert.throws(() => verifyFidelity(missing), new RegExp(`visual reference visual.*${fidelity}.*subjective review`, 'i'));
    missing.model.appliedVisualReferences[0].subjectiveReview = 'required';
    const result = verifyFidelity(missing);
    assert.equal(result.checks.find(check => check.name === 'visual references').reviewRequired, true);
  }
});

test('rejects explicit background requirement traces but ignores incidental words', () => {
  const leaked = fixture(); leaked.model.pages[0].elements.push({ key: 'leak', text: 'Market research', requirementId: 'background' });
  assert.throws(() => verifyFidelity(leaked), /background requirement background.*rendered/i);
  const incidental = fixture(); incidental.model.pages[0].elements.push({ key: 'plain', text: 'Research your options' });
  assert.doesNotThrow(() => verifyFidelity(incidental));
});

test('rejects canonical background source IDs even without a requirementId', () => {
  const data = fixture();
  data.model.pages[0].elements.push({ key: 'leaked-source', text: 'Unrelated visible words', sourceIds: ['source-background'] });
  assert.throws(() => verifyFidelity(data), /protected source source-background.*rendered/i);
  const clean = fixture(); clean.model.pages[0].elements.push({ key: 'same-words', text: 'Market research', sourceIds: ['source-ui'] });
  assert.doesNotThrow(() => verifyFidelity(clean));
});

test('requires unique non-empty element keys for requirement and action traceability', () => {
  const missingRequirement = fixture(); delete missingRequirement.model.pages[0].elements[0].key;
  assert.throws(() => verifyFidelity(missingRequirement), /requirement copy.*non-empty.*key/i);
  const blankAction = fixture(); blankAction.model.pages[0].elements[2].key = '   ';
  assert.throws(() => verifyFidelity(blankAction), /action next.*non-empty.*key/i);
  const ambiguousRequirement = fixture(); ambiguousRequirement.model.pages[1].elements.push({ key: 'copy', text: 'Other' });
  assert.throws(() => verifyFidelity(ambiguousRequirement), /requirement copy.*unique.*key copy/i);
  const ambiguousAction = fixture(); ambiguousAction.model.pages[1].elements.push({ key: 'next', text: 'Other' });
  assert.throws(() => verifyFidelity(ambiguousAction), /action next.*unique.*key next/i);
});
