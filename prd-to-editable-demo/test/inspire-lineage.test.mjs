import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptCandidate, addCandidate, markVerified, startLineage } from '../src/inspire-lineage.mjs';

const base = () => startLineage({
  prdSha256: 'abc123', designSkill: 'workspace:douyin-mall-native-design@1', currentAssetId: 'asset-accepted'
});

test('starts lineage with the accepted asset and immutable metadata', () => {
  const lineage = base();
  assert.equal(lineage.currentAssetId, 'asset-accepted');
  assert.equal(lineage.prdSha256, 'abc123');
  assert.deepEqual(lineage.versions, []);
});

test('does not promote an unverified child asset', () => {
  const lineage = addCandidate(base(), {
    assetId: 'asset-child', parentAssetId: 'asset-accepted', status: 'success',
    previewUrl: 'https://inspire/preview/child', inboxDeepLink: 'https://inspire/inbox/child'
  });
  assert.throws(() => acceptCandidate(lineage, 'asset-child'), /quality verification/);
  assert.equal(lineage.currentAssetId, 'asset-accepted');
});

test('promotes only a verified candidate and retains its parent', () => {
  const candidate = addCandidate(base(), {
    assetId: 'asset-child', parentAssetId: 'asset-accepted', status: 'success',
    previewUrl: 'https://inspire/preview/child', inboxDeepLink: 'https://inspire/inbox/child'
  });
  const verified = markVerified(candidate, 'asset-child', { status: 'passed', report: 'native-design-report.json' });
  const accepted = acceptCandidate(verified, 'asset-child');

  assert.equal(accepted.currentAssetId, 'asset-child');
  assert.equal(accepted.versions[0].parentAssetId, 'asset-accepted');
  assert.equal(accepted.versions[0].qualityStatus, 'verified');
  assert.equal(accepted.versions[0].acceptanceStatus, 'accepted');
  assert.equal(candidate.currentAssetId, 'asset-accepted');
});

test('rejects duplicate assets, failed generations and failed quality reports', () => {
  const candidate = addCandidate(base(), { assetId: 'asset-child', parentAssetId: 'asset-accepted', status: 'success' });
  assert.throws(() => addCandidate(candidate, { assetId: 'asset-child', status: 'success' }), /already exists/);
  assert.throws(() => addCandidate(base(), { assetId: 'failed', status: 'error' }), /successful generation/);
  assert.throws(() => markVerified(candidate, 'asset-child', { status: 'failed' }), /passed quality report/);
});

test('rejects a candidate whose parent is not the currently accepted asset', () => {
  assert.throws(() => addCandidate(base(), {
    assetId: 'asset-child', parentAssetId: 'stale-parent', status: 'success'
  }), /current accepted asset/);
});
