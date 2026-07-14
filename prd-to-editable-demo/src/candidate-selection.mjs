import { createSelectionLineage } from './inspire-lineage.mjs';

function normalizeChoice(choice) {
  const value = String(choice ?? '').trim();
  if (/^[abc]$/iu.test(value)) return `candidate-${value.toLowerCase()}`;
  return value;
}

export function selectCandidate(comparison, choice, metadata = {}) {
  if (comparison?.status !== 'comparison-ready' || !Array.isArray(comparison.candidates)) {
    throw new Error('comparison is not ready for candidate selection');
  }
  const normalized = normalizeChoice(choice);
  const candidate = comparison.candidates.find(item =>
    item.candidateBrief?.id === normalized || item.assetId === normalized
  );
  if (!candidate) throw new Error('choice does not identify a candidate');
  if (candidate.audit?.status !== 'passed') throw new Error('candidate has not passed acceptance');
  const selectedAt = metadata.selectedAt ?? new Date().toISOString();
  const lineage = createSelectionLineage({
    candidates: comparison.candidates,
    selectedAssetId: candidate.assetId,
    designSkill: comparison.designSkill,
    previousSelection: metadata.previousSelection
  });
  return {
    schemaVersion: 1,
    status: 'selected',
    selectedAt,
    selectedCandidateId: candidate.candidateBrief.id,
    currentAssetId: candidate.assetId,
    designSkill: comparison.designSkill,
    reason: metadata.reason ?? null,
    previousSelection: metadata.previousSelection ?? null,
    lineage,
    candidates: comparison.candidates.map(item => ({
      candidateId: item.candidateBrief.id,
      assetId: item.assetId,
      selectionStatus: item.assetId === candidate.assetId ? 'selected' : 'not-selected'
    }))
  };
}
