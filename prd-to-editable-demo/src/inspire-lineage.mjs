function clone(value) {
  return structuredClone(value);
}

function now() {
  return new Date().toISOString();
}

function findVersion(lineage, assetId) {
  const index = lineage.versions.findIndex(version => version.assetId === assetId);
  if (index < 0) throw new Error(`asset ${assetId} is not present in lineage`);
  return index;
}

export function startLineage({ prdSha256, designSkill, currentAssetId = null }) {
  if (!prdSha256) throw new Error('prdSha256 is required');
  if (!/^(built-in|private|workspace|public):/.test(designSkill ?? '')) throw new Error('designSkill must be source-qualified');
  return { schemaVersion: 1, prdSha256, designSkill, currentAssetId, versions: [] };
}

export function addCandidate(lineage, candidate) {
  if (!candidate?.assetId) throw new Error('candidate assetId is required');
  if (candidate.status !== 'success') throw new Error('candidate requires a successful generation');
  if (lineage.versions.some(version => version.assetId === candidate.assetId) || lineage.currentAssetId === candidate.assetId) {
    throw new Error(`asset ${candidate.assetId} already exists`);
  }
  const parentAssetId = candidate.parentAssetId ?? lineage.currentAssetId;
  if (parentAssetId !== lineage.currentAssetId) throw new Error('candidate parent must be the current accepted asset');
  const timestamp = now();
  const next = clone(lineage);
  next.versions.push({
    assetId: candidate.assetId,
    parentAssetId,
    status: 'success',
    previewUrl: candidate.previewUrl ?? null,
    inboxDeepLink: candidate.inboxDeepLink ?? null,
    qualityStatus: 'pending',
    acceptanceStatus: 'candidate',
    quality: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  return next;
}

export function markVerified(lineage, assetId, quality) {
  if (quality?.status !== 'passed') throw new Error('candidate requires a passed quality report');
  const next = clone(lineage);
  const version = next.versions[findVersion(next, assetId)];
  if (version.status !== 'success') throw new Error('only successful generations can be verified');
  version.qualityStatus = 'verified';
  version.quality = clone(quality);
  version.updatedAt = now();
  return next;
}

export function acceptCandidate(lineage, assetId) {
  const next = clone(lineage);
  const version = next.versions[findVersion(next, assetId)];
  if (version.qualityStatus !== 'verified') throw new Error('candidate must pass quality verification before acceptance');
  next.versions.forEach(item => {
    if (item.acceptanceStatus === 'accepted') item.acceptanceStatus = 'candidate';
  });
  version.acceptanceStatus = 'accepted';
  version.updatedAt = now();
  next.currentAssetId = assetId;
  return next;
}
