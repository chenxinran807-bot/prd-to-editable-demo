function identity(skill) {
  const key = skill.skillKey ?? skill.key ?? skill.name;
  return `${skill.source}:${key}`;
}

function reference(skill) {
  const base = identity(skill);
  return skill.version == null ? base : `${base}@${Number(skill.version)}`;
}

function requirementText(requirements) {
  return [
    requirements.title, requirements.actor, requirements.goal, requirements.experienceType,
    ...(requirements.businessObjects ?? []), ...(requirements.userActions ?? []),
    ...(requirements.screens ?? []), ...(requirements.states ?? [])
  ].filter(Boolean).join(' ').toLowerCase();
}

function inferredContext(requirements) {
  const text = requirementText(requirements);
  const collect = definitions => definitions
    .filter(([, pattern]) => pattern.test(text))
    .map(([value]) => value);
  return {
    domains: collect([
      ['commerce', /商品|订单|购买|商城|电商|commerce|shop/u],
      ['social', /内容|关注|社交|feed|social/u],
      ['local-life', /本地生活|到店|团购|local life/u]
    ]),
    platforms: collect([
      ['mobile', /移动|手机|app|h5|mobile/u],
      ['desktop', /后台|工作台|控制台|desktop|console/u]
    ]),
    surfaces: collect([
      ['consumer', /消费者|用户|买家|consumer/u],
      ['merchant', /商家|运营|管理员|merchant|admin/u]
    ]),
    capabilities: collect([
      ['browse', /浏览|推荐|发现|列表|browse|feed/u],
      ['transaction', /购买|下单|订单|支付|提交|transaction|checkout/u],
      ['after-sales', /售后|退款|退货|after.?sales/u]
    ])
  };
}

function overlap(left = [], right = []) {
  const wanted = new Set(right);
  return left.filter(value => wanted.has(value));
}

function rankCandidate(skill, metadata, context) {
  const weights = { domains: 4, platforms: 4, surfaces: 4, capabilities: 2 };
  const evidence = [];
  let score = 0;
  for (const [field, weight] of Object.entries(weights)) {
    const matches = overlap(metadata[field], context[field]);
    if (!matches.length) continue;
    score += matches.length * weight;
    evidence.push({ dimension: field.replace(/s$/u, ''), matches, score: matches.length * weight });
  }
  const conflicts = overlap(metadata.exclusions, [
    ...context.domains, ...context.platforms, ...context.surfaces, ...context.capabilities
  ]);
  if (conflicts.length) {
    score -= conflicts.length * 8;
    evidence.push({ dimension: 'exclusion', matches: conflicts, score: conflicts.length * -8 });
  }
  if (metadata.qualityLevel === 'brand-native') {
    score += 1;
    evidence.push({ dimension: 'quality', matches: ['brand-native'], score: 1 });
  }
  return {
    reference: reference(skill), source: skill.source,
    skillKey: skill.skillKey ?? skill.key ?? skill.name,
    version: skill.version == null ? null : Number(skill.version),
    packageHash: skill.packageHash ?? skill.package_hash ?? null,
    score, evidence
  };
}

export function matchDesignSkill({ requirements = {}, visibleSkills = [], registry = {}, privateAllowlist = [] }) {
  const allowedPrivate = new Set(privateAllowlist);
  const context = inferredContext(requirements);
  const ranked = visibleSkills
    .filter(skill => skill.category === 'design-system')
    .filter(skill => skill.source !== 'private' || allowedPrivate.has(identity(skill)))
    .map(skill => rankCandidate(skill, registry[identity(skill)] ?? {}, context))
    .filter(candidate => candidate.score >= 4)
    .sort((left, right) => right.score - left.score || left.reference.localeCompare(right.reference));

  if (!ranked.length) {
    return { status: 'unavailable', candidates: [], reason: 'no eligible business design Skill is visible' };
  }
  if (ranked[1] && ranked[0].score - ranked[1].score < 2) {
    return { status: 'ambiguous', candidates: ranked.slice(0, 3), reason: 'top business design Skills are too close to select safely' };
  }
  return { status: 'selected', candidate: ranked[0], evidence: ranked[0].evidence, ranked };
}
