import test from 'node:test';
import assert from 'node:assert/strict';
import { planAssetStages } from '../src/asset-staging.mjs';

test('builds a solution parent before reference refinement within the platform limit', () => {
  const assets = [
    ...Array.from({ length: 5 }, (_, index) => ({ path: `/solution-${index + 1}.png`, role: 'solution', sha256: `s${index}` })),
    ...Array.from({ length: 8 }, (_, index) => ({ path: `/reference-${index + 1}.png`, role: 'competitor', sha256: `r${index}` }))
  ];
  const stages = planAssetStages(assets, { maxFiles: 10 });

  assert.equal(stages.length, 2);
  assert.equal(stages[0].kind, 'foundation');
  assert.deepEqual(stages[0].files, assets.slice(0, 5));
  assert.equal(stages[1].kind, 'refinement');
  assert.equal(stages[1].requiresParent, true);
  assert.deepEqual(stages[1].files, assets.slice(5));
});

test('chunks excess files into an explicit parent chain without dropping assets', () => {
  const assets = Array.from({ length: 23 }, (_, index) => ({
    path: `/asset-${index + 1}.png`, role: 'solution', sha256: `hash-${index}`
  }));
  const stages = planAssetStages(assets, { maxFiles: 10 });

  assert.deepEqual(stages.map(stage => stage.files.length), [10, 10, 3]);
  assert.deepEqual(stages.flatMap(stage => stage.files), assets);
  assert.equal(stages[0].requiresParent, false);
  assert.ok(stages.slice(1).every(stage => stage.requiresParent));
});

test('rejects unknown asset roles instead of inferring intent from filenames', () => {
  assert.throws(() => planAssetStages([
    { path: '/competitor-looking-name.png', role: 'mystery', sha256: 'hash' }
  ]), /unsupported asset role/);
});
