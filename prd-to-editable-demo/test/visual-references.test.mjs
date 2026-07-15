import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateVisualReferences } from '../src/visual-references.mjs';

const binding = (property, fidelity = 'exact') => ({ property, fidelity });
const reference = (id, property = 'layout', fidelity = 'exact', scope = { pageId: 'page-1' }) => ({
  id, asset: `assets/${id}.png`, scope, bindings: [binding(property, fidelity)], exclude: [],
});

test('accepts separate color-only and layout-only references', () => {
  assert.doesNotThrow(() => validateVisualReferences([
    reference('color-ref', 'color', 'high'),
    reference('layout-ref', 'layout', 'local'),
  ]));
});

test('rejects direct exact conflicts at the same scope', () => {
  assert.throws(() => validateVisualReferences([
    reference('one', 'layout'), reference('two', 'layout'),
  ]), /exact binding conflict.*layout/i);
});

test('rejects an exact page-wide binding overlapping an exact region binding', () => {
  assert.throws(() => validateVisualReferences([
    reference('page', 'spacing'),
    reference('region', 'spacing', 'exact', { pageId: 'page-1', regionId: 'hero' }),
  ]), /exact binding conflict.*spacing/i);
});

test('accepts exact bindings for non-overlapping regions', () => {
  assert.doesNotThrow(() => validateVisualReferences([
    reference('hero', 'spacing', 'exact', { pageId: 'page-1', regionId: 'hero' }),
    reference('footer', 'spacing', 'exact', { pageId: 'page-1', regionId: 'footer' }),
  ]));
});

test('allows high-fidelity references to coexist at one scope', () => {
  assert.doesNotThrow(() => validateVisualReferences([
    reference('one', 'layout', 'high'), reference('two', 'layout', 'high'),
  ]));
});

test('rejects a property that is both bound and excluded', () => {
  const input = reference('one', 'imagery');
  input.exclude = ['imagery'];
  assert.throws(() => validateVisualReferences([input]), /both bound and excluded/i);
});

test('rejects invalid property and fidelity enums', () => {
  assert.throws(() => validateVisualReferences([reference('one', 'shadow')]), /unknown property/i);
  assert.throws(() => validateVisualReferences([reference('one', 'layout', 'pixel-perfect')]), /unknown fidelity/i);
});

test('rejects duplicate IDs, binding properties, and exclusions', () => {
  assert.throws(() => validateVisualReferences([reference('one'), reference('one', 'color')]), /duplicate reference id/i);
  const bindings = reference('one');
  bindings.bindings.push(binding('layout', 'high'));
  assert.throws(() => validateVisualReferences([bindings]), /duplicate binding property/i);
  const exclusions = reference('one');
  exclusions.exclude = ['color', 'color'];
  assert.throws(() => validateVisualReferences([exclusions]), /duplicate excluded property/i);
});

test('resolves page and region ownership against a validated context', () => {
  const context = { pageIds: ['page-1', 'page-2'], regions: [{ id: 'hero', pageId: 'page-1' }] };
  assert.doesNotThrow(() => validateVisualReferences([
    reference('one', 'layout', 'high', { pageId: 'page-1', regionId: 'hero' }),
  ], context));
  assert.throws(() => validateVisualReferences([reference('one', 'layout', 'high', { pageId: 'missing' })], context), /unknown page/i);
  assert.throws(() => validateVisualReferences([
    reference('one', 'layout', 'high', { pageId: 'page-2', regionId: 'hero' }),
  ], context), /belongs to page page-1/i);
  assert.throws(() => validateVisualReferences([], { pageIds: ['page-1', 'page-1'], regions: [] }), /duplicate context page/i);
});

test('validates evidence region labels, purposes, and finite four-number boxes', () => {
  const input = reference('one');
  input.evidenceRegions = [{ label: 'Header', purpose: 'Shows alignment', boundingBox: [0, 2.5, 100, 80] }];
  assert.doesNotThrow(() => validateVisualReferences([input]));
  for (const boundingBox of [[0, 1, 2], [0, 1, 2, Number.POSITIVE_INFINITY], ['0', 1, 2, 3]]) {
    const invalid = structuredClone(input);
    invalid.evidenceRegions[0].boundingBox = boundingBox;
    assert.throws(() => validateVisualReferences([invalid]), /boundingBox/i);
  }
  const blank = structuredClone(input);
  blank.evidenceRegions[0].purpose = '  ';
  assert.throws(() => validateVisualReferences([blank]), /purpose must be a non-empty string/i);
});

test('returns a deep clone without mutating input', () => {
  const input = [reference('one')];
  input[0].evidenceRegions = [{ label: 'Main', purpose: 'Composition', boundingBox: [0, 0, 10, 10] }];
  const before = structuredClone(input);
  const result = validateVisualReferences(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result, before);
  assert.notStrictEqual(result, input);
  assert.notStrictEqual(result[0].scope, input[0].scope);
  assert.notStrictEqual(result[0].evidenceRegions[0].boundingBox, input[0].evidenceRegions[0].boundingBox);
});

test('visual reference manifest schema loads as valid JSON with strict enums and objects', () => {
  const schema = JSON.parse(readFileSync(new URL('../schemas/visual-reference-manifest.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.type, 'array');
  assert.equal(schema.items.additionalProperties, false);
  assert.equal(schema.items.properties.scope.additionalProperties, false);
  assert.equal(schema.$defs.binding.additionalProperties, false);
  assert.equal(schema.$defs.evidenceRegion.additionalProperties, false);
  assert.equal(schema.items.properties.id.pattern, '.*\\S.*');
  assert.deepEqual(schema.$defs.binding.properties.fidelity.enum, ['exact', 'high', 'local', 'inspiration']);
  assert.equal(schema.$defs.binding.properties.property.$ref, '#/$defs/property');
  assert.equal(schema.$defs.property.enum.length, 12);
});
