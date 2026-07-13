import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyDemo } from '../src/verify-demo.mjs';

test('rejects an HTML artifact without editor capabilities', () => {
  assert.throws(() => verifyDemo({ html: '<!doctype html><main></main>', manifest: { startPage: 'home', pages: [{ id: 'home', elements: [] }] } }), /embedded manifest/);
});
