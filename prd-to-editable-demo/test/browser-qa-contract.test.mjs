import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrowserQaEvidence } from '../src/browser-qa-contract.mjs';

function validEvidence() {
  return {
    entryUrl: 'https://demo.example/',
    tasks: [{
      id: 'task-1', entryReached: true, directNavigationUsed: false,
      steps: [{ role: 'button', name: '主操作', before: { screen: 'entry' }, after: { screen: 'detail' } }],
      expectedOutcome: '目标内容可见', observedOutcome: '目标内容可见', recoverable: true
    }],
    images: [{ src: 'asset://hero', naturalWidth: 750, naturalHeight: 960 }],
    network: [{ url: 'asset://hero', approved: true, failed: false, aborted: false, status: 200 }],
    console: [],
    controls: [{ name: '主操作', role: 'button', accessible: true, feedbackObserved: true }],
    layout: { horizontalOverflow: false, overlaps: [] }
  };
}

test('accepts entry-reachable tasks with semantic controls and observable feedback', () => {
  const result = validateBrowserQaEvidence(validEvidence());
  assert.equal(result.status, 'passed');
  assert.equal(result.criticalFailures.length, 0);
});

test('fails URL-only or direct-navigation task evidence', () => {
  const direct = validEvidence();
  direct.tasks[0].directNavigationUsed = true;
  assert.match(validateBrowserQaEvidence(direct).criticalFailures.join('\n'), /direct navigation/i);

  const urlOnly = validEvidence();
  urlOnly.tasks[0].steps[0] = { role: 'link', name: 'go', before: { url: '/a' }, after: { url: '/b' } };
  urlOnly.tasks[0].observedOutcome = '';
  assert.match(validateBrowserQaEvidence(urlOnly).criticalFailures.join('\n'), /observable/i);
});

test('fails unusable controls, broken images, and unapproved request failures', () => {
  const evidence = validEvidence();
  evidence.controls[0].role = '';
  evidence.images[0].naturalWidth = 0;
  evidence.network.push({ url: 'https://unknown.example/x', approved: false, failed: true, aborted: false, status: 0 });
  const result = validateBrowserQaEvidence(evidence);
  assert.equal(result.status, 'failed');
  assert.match(result.criticalFailures.join('\n'), /semantic role/i);
  assert.match(result.criticalFailures.join('\n'), /natural dimensions/i);
  assert.match(result.criticalFailures.join('\n'), /unapproved external request/i);
});

test('reports console errors, overflow, and overlap as review failures', () => {
  const evidence = validEvidence();
  evidence.console.push({ level: 'error', message: 'render failed' });
  evidence.layout = { horizontalOverflow: true, overlaps: [{ a: 'cta', b: 'footer' }] };
  const result = validateBrowserQaEvidence(evidence);
  assert.match(result.reviewFailures.join('\n'), /console/i);
  assert.match(result.reviewFailures.join('\n'), /overflow/i);
  assert.match(result.reviewFailures.join('\n'), /overlap/i);
});
