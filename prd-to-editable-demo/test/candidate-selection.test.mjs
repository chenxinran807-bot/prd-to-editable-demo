import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCandidate } from '../src/candidate-selection.mjs';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const comparison = {
  status: 'comparison-ready',
  designSkill: 'public:native-mobile@2',
  candidates: [
    { candidateBrief: { id: 'candidate-a', label: '方向 A' }, assetId: 'asset-a', audit: { status: 'passed' } },
    { candidateBrief: { id: 'candidate-b', label: '方向 B' }, assetId: 'asset-b', audit: { status: 'passed' } },
    { candidateBrief: { id: 'candidate-c', label: '方向 C' }, assetId: 'asset-c', audit: { status: 'passed' } }
  ]
};

test('selects by letter, candidate id, or asset id and promotes one parent only', () => {
  for (const choice of ['B', 'candidate-b', 'asset-b']) {
    const selected = selectCandidate(comparison, choice, { reason: '更符合评审目标', selectedAt: '2026-07-14T00:00:00.000Z' });
    assert.equal(selected.currentAssetId, 'asset-b');
    assert.equal(selected.selectedCandidateId, 'candidate-b');
    assert.equal(selected.reason, '更符合评审目标');
    assert.deepEqual(selected.candidates.map(item => item.selectionStatus), ['not-selected', 'selected', 'not-selected']);
    assert.equal(selected.lineage.currentAssetId, 'asset-b');
    assert.deepEqual(selected.lineage.versions.map(item => item.acceptanceStatus), ['not-selected', 'accepted', 'not-selected']);
  }
});

test('rejects unknown, failed, or unaudited candidates', () => {
  assert.throws(() => selectCandidate(comparison, 'D'), /does not identify a candidate/);
  assert.throws(() => selectCandidate({
    ...comparison,
    candidates: comparison.candidates.map((item, index) => index === 0 ? { ...item, audit: { status: 'failed' } } : item)
  }, 'A'), /has not passed acceptance/);
});

test('records an explicit reselection without mutating the comparison', () => {
  const before = JSON.stringify(comparison);
  const selected = selectCandidate(comparison, 'C', {
    previousSelection: { currentAssetId: 'asset-a', selectedCandidateId: 'candidate-a' },
    selectedAt: '2026-07-14T01:00:00.000Z'
  });
  assert.equal(selected.previousSelection.currentAssetId, 'asset-a');
  assert.equal(JSON.stringify(comparison), before);
});

test('public selection CLI writes the accepted parent artifact', () => {
  const root = mkdtempSync(join(tmpdir(), 'candidate-selection-cli-'));
  const source = join(root, 'comparison.json');
  const output = join(root, 'selected.json');
  writeFileSync(source, JSON.stringify(comparison));
  const result = spawnSync(process.execPath, [
    'bin/select-candidate.mjs', '--comparison', source, '--choice', 'C', '--out', output
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(readFileSync(output, 'utf8')).currentAssetId, 'asset-c');
});
