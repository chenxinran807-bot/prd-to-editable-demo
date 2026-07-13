import test from 'node:test';
import assert from 'node:assert/strict';
import { validateModel } from '../src/validate-model.mjs';

test('rejects duplicate proto keys', () => {
  assert.throws(() => validateModel({
    startPage: 'home',
    pages: [{ id: 'home', elements: [{ key: 'home.cta' }, { key: 'home.cta' }] }]
  }), /duplicate proto key: home.cta/);
});

test('rejects navigation to missing pages', () => {
  assert.throws(() => validateModel({
    startPage: 'home',
    pages: [{ id: 'home', elements: [{ key: 'home.cta', action: { type: 'navigate', target: 'missing' } }] }]
  }), /unknown navigation target: missing/);
});
