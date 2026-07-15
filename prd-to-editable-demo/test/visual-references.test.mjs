import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateVisualReferences } from '../src/visual-references.mjs';

const binding = (property, fidelity = 'exact') => ({ property, fidelity });
const reference = (id, property = 'layout', fidelity = 'exact', scope = { pageId: 'page-1' }) => ({
  id, asset: `assets/${id}.png`, scope, bindings: [binding(property, fidelity)], exclude: [],
});

function validateWithSchema(schema, instance) {
  const errors = [];
  function visit(rule, value, path = '$') {
    if (rule.$ref) return visit(rule.$ref.split('/').slice(1).reduce((node, key) => node[key], schema), value, path);
    if (rule.type === 'array') {
      if (!Array.isArray(value)) return errors.push(`${path} must be array`);
      if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${path} too short`);
      if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${path} too long`);
      if (rule.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${path} duplicates`);
      value.forEach((item, index) => visit(rule.items, item, `${path}[${index}]`));
    } else if (rule.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return errors.push(`${path} must be object`);
      for (const required of rule.required ?? []) if (!(required in value)) errors.push(`${path}.${required} required`);
      if (rule.additionalProperties === false) for (const key of Object.keys(value)) if (!(key in (rule.properties ?? {}))) errors.push(`${path}.${key} unknown`);
      for (const [key, child] of Object.entries(rule.properties ?? {})) if (key in value) visit(child, value[key], `${path}.${key}`);
    } else if (rule.type === 'string') {
      if (typeof value !== 'string') errors.push(`${path} must be string`);
      else if (rule.pattern && !new RegExp(rule.pattern).test(value)) errors.push(`${path} pattern`);
    } else if (rule.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) errors.push(`${path} must be finite number`);
    if (rule.enum && !rule.enum.includes(value)) errors.push(`${path} enum`);
  }
  visit(schema, instance);
  return errors;
}

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

test('allows exact and non-exact bindings to coexist at one scope', () => {
  assert.doesNotThrow(() => validateVisualReferences([
    reference('exact', 'layout'), reference('high', 'layout', 'high'),
  ]));
});

test('allows exact bindings on different pages', () => {
  assert.doesNotThrow(() => validateVisualReferences([
    reference('one', 'layout', 'exact', { pageId: 'page-1' }),
    reference('two', 'layout', 'exact', { pageId: 'page-2' }),
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
  assert.throws(() => validateVisualReferences([
    reference('one', 'layout', 'high', { pageId: 'page-1', regionId: 'missing' }),
  ], context), /unknown region/i);
  assert.throws(() => validateVisualReferences([], {
    pageIds: ['page-1'], regions: [{ id: 'hero', pageId: 'page-1' }, { id: 'hero', pageId: 'page-1' }],
  }), /duplicate context region/i);
});

test('rejects missing required fields and unknown reference fields', () => {
  for (const field of ['id', 'asset', 'scope', 'bindings', 'exclude']) {
    const input = reference('one');
    delete input[field];
    assert.throws(() => validateVisualReferences([input]), new RegExp(field, 'i'));
  }
  const input = reference('one');
  input.unexpected = true;
  assert.throws(() => validateVisualReferences([input]), /unknown property unexpected/i);
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
  for (const field of ['label', 'purpose']) {
    const missing = structuredClone(input);
    delete missing.evidenceRegions[0][field];
    assert.throws(() => validateVisualReferences([missing]), new RegExp(`${field} must be a non-empty string`, 'i'));
    const blankField = structuredClone(input);
    blankField.evidenceRegions[0][field] = '   ';
    assert.throws(() => validateVisualReferences([blankField]), new RegExp(`${field} must be a non-empty string`, 'i'));
  }
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

test('normalizes an omitted evidenceRegions collection to an empty array', () => {
  const input = [reference('one')];
  const result = validateVisualReferences(input);
  assert.deepEqual(result[0].evidenceRegions, []);
  assert.equal('evidenceRegions' in input[0], false);
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
  assert.equal(schema.items.properties.bindings.uniqueItems, true);
  assert.equal(schema.items.properties.exclude.uniqueItems, true);
});

test('schema structure accepts a valid manifest and rejects representative structural errors', () => {
  const schema = JSON.parse(readFileSync(new URL('../schemas/visual-reference-manifest.schema.json', import.meta.url), 'utf8'));
  const valid = [reference('one')];
  valid[0].evidenceRegions = [{ label: 'Header', purpose: 'Alignment evidence', boundingBox: [0, 0, 100, 80] }];
  assert.deepEqual(validateWithSchema(schema, valid), []);

  const invalid = [];
  const missing = reference('missing'); delete missing.asset; invalid.push([missing]);
  const whitespace = reference('blank'); whitespace.scope.pageId = '   '; invalid.push([whitespace]);
  const nestedExtra = structuredClone(valid); nestedExtra[0].scope.extra = true; invalid.push(nestedExtra);
  const evidenceExtra = structuredClone(valid); evidenceExtra[0].evidenceRegions[0].extra = true; invalid.push(evidenceExtra);
  const shortBox = structuredClone(valid); shortBox[0].evidenceRegions[0].boundingBox = [0, 1, 2]; invalid.push(shortBox);
  const nonNumberBox = structuredClone(valid); nonNumberBox[0].evidenceRegions[0].boundingBox = [0, 1, 2, '3']; invalid.push(nonNumberBox);
  const badProperty = [reference('property', 'shadow')]; invalid.push(badProperty);
  const badFidelity = [reference('fidelity', 'layout', 'pixel-perfect')]; invalid.push(badFidelity);
  const duplicateBindings = [reference('bindings')]; duplicateBindings[0].bindings.push(binding('layout')); invalid.push(duplicateBindings);
  const duplicateExclusions = [reference('exclude')]; duplicateExclusions[0].exclude = ['color', 'color']; invalid.push(duplicateExclusions);
  for (const instance of invalid) assert.notDeepEqual(validateWithSchema(schema, instance), [], JSON.stringify(instance));
});

test('schema documents the mandatory semantic validation stage', () => {
  const schema = JSON.parse(readFileSync(new URL('../schemas/visual-reference-manifest.schema.json', import.meta.url), 'utf8'));
  assert.match(schema.description, /structur/i);
  assert.match(schema.$comment, /validateVisualReferences.*mandatory/i);
  assert.match(schema.items.properties.bindings.description, /binding\.property.*runtime/i);
  assert.match(schema.items.properties.scope.description, /overlap.*runtime/i);
});

test('canonical runtime rejects semantic conflicts that remain structurally schema-valid', () => {
  const schema = JSON.parse(readFileSync(new URL('../schemas/visual-reference-manifest.schema.json', import.meta.url), 'utf8'));
  const duplicateProperty = [reference('one')];
  duplicateProperty[0].bindings.push(binding('layout', 'high'));
  const duplicateIds = [reference('same', 'layout', 'high'), reference('same', 'color', 'local', { pageId: 'page-2' })];
  const boundAndExcluded = [reference('excluded', 'imagery', 'local')];
  boundAndExcluded[0].exclude = ['imagery'];

  for (const [instance, runtimeError] of [
    [duplicateProperty, /duplicate binding property/i],
    [duplicateIds, /duplicate reference id/i],
    [boundAndExcluded, /both bound and excluded/i],
  ]) {
    assert.deepEqual(validateWithSchema(schema, instance), [], 'case must pass structural schema validation');
    assert.throws(() => validateVisualReferences(instance), runtimeError);
  }
});
