import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptSpecialistHtml } from '../src/adapt-specialist.mjs';

test('adds a non-destructive edit layer without replacing specialist markup or styles', () => {
  const source = '<!doctype html><html><head><style>.hero{color:red}</style></head><body><main class="hero"><h1>专业原型</h1><button data-proto-key="buy">立即购买</button></main></body></html>';
  const adapted = adaptSpecialistHtml(source, { manifestId: 'specialist-demo', specialist: 'pm-kakaxi' });

  assert.match(adapted, /<main class="hero"><h1>专业原型<\/h1>/);
  assert.match(adapted, /\.hero\{color:red\}/);
  assert.match(adapted, /data-proto-key="buy"/);
  assert.match(adapted, /id="proto-edit-toggle"/);
  assert.match(adapted, /specialist-demo/);
  assert.doesNotMatch(adapted, /<iframe/i);
});

test('rejects fragments that are not complete HTML documents', () => {
  assert.throws(() => adaptSpecialistHtml('<div>fragment</div>', { manifestId: 'x', specialist: 'unknown' }), /complete HTML document/);
});
