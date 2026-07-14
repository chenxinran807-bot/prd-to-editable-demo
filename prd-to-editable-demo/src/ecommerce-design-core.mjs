function corpus(requirements) {
  return [requirements.title, ...(requirements.screens ?? []), ...(requirements.userActions ?? []), ...(requirements.businessObjects ?? [])].filter(Boolean).join(' ');
}

export function resolveDesignCore({ requirements = {}, core = {} } = {}) {
  const text = corpus(requirements);
  const matched = (core.routes ?? []).filter(route => new RegExp(route.pattern, 'iu').test(text));
  const unique = values => [...new Set(values.flat())];
  return {
    profile: core.profile,
    components: unique(matched.map(route => route.components ?? [])),
    requiredAssetRoles: unique(matched.map(route => route.assetRoles ?? [])),
    tokens: core.tokens,
    qualityRules: core.qualityRules,
    sourceReferences: unique(matched.map(route => route.sourceReferences ?? [])),
    assetPolicy: core.assetPolicy
  };
}
