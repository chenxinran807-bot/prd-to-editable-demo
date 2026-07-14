const FOUNDATION_ROLES = new Set(['solution', 'product', 'brand']);
const REFINEMENT_ROLES = new Set(['competitor', 'context']);
const SUPPORTED_ROLES = new Set([...FOUNDATION_ROLES, ...REFINEMENT_ROLES]);

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export function planAssetStages(assets = [], { maxFiles = 10 } = {}) {
  if (!Number.isInteger(maxFiles) || maxFiles < 1) throw new Error('maxFiles must be a positive integer');
  for (const [index, asset] of assets.entries()) {
    if (!asset?.path) throw new Error(`asset ${index} requires a path`);
    if (!SUPPORTED_ROLES.has(asset.role)) throw new Error(`unsupported asset role: ${asset.role}`);
  }
  if (!assets.length) {
    return [{ id: 'stage-1', kind: 'foundation', requiresParent: false, files: [] }];
  }
  const foundation = assets.filter(asset => FOUNDATION_ROLES.has(asset.role));
  const refinement = assets.filter(asset => REFINEMENT_ROLES.has(asset.role));
  const groups = [
    ...chunks(foundation, maxFiles).map(files => ({ kind: 'foundation', files })),
    ...chunks(refinement, maxFiles).map(files => ({ kind: 'refinement', files }))
  ];
  return groups.map((stage, index) => ({
    id: `stage-${index + 1}`,
    kind: index === 0 ? 'foundation' : stage.kind === 'refinement' ? 'refinement' : 'continuation',
    requiresParent: index > 0,
    files: stage.files
  }));
}
