import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { matchDesignSkill } from '../src/design-skill-matcher.mjs';

const visible = [
  { name: 'mobile-shell', category: 'design-util', source: 'built-in', active: true },
  {
    name: 'tiktok-design-system', category: 'design-system', source: 'built-in',
    description: 'TikTok-native mobile product UI', intentKeywords: ['tiktok', 'mobile']
  },
  {
    name: 'consumer-commerce-mobile', category: 'design-system', source: 'private', version: '5',
    packageHash: 'commerce-5', description: 'Consumer commerce mobile app product patterns'
  },
  {
    name: 'merchant-console', category: 'design-system', source: 'public', version: '2',
    description: 'Merchant commerce desktop admin console'
  }
];

const registry = {
  'private:consumer-commerce-mobile': {
    domains: ['commerce'], platforms: ['mobile'], surfaces: ['consumer'],
    capabilities: ['browse', 'transaction'], exclusions: ['merchant', 'desktop'], qualityLevel: 'brand-native'
  },
  'built-in:tiktok-design-system': {
    domains: ['social'], platforms: ['mobile'], surfaces: ['consumer'],
    capabilities: ['browse'], exclusions: [], qualityLevel: 'native'
  },
  'public:merchant-console': {
    domains: ['commerce'], platforms: ['desktop'], surfaces: ['merchant'],
    capabilities: ['transaction'], exclusions: ['consumer', 'mobile'], qualityLevel: 'brand-native'
  }
};

const requirements = {
  title: '移动商城商品发现与下单', actor: '消费者', goal: '浏览商品并完成购买',
  businessObjects: ['推荐商品', '订单'], userActions: ['浏览', '提交订单'],
  screens: ['商品推荐', '确认订单'], states: ['支付成功'], experienceType: 'browse'
};

test('selects one owner-approved private business Skill with explainable evidence', () => {
  const result = matchDesignSkill({
    requirements, visibleSkills: visible, registry,
    privateAllowlist: ['private:consumer-commerce-mobile']
  });

  assert.equal(result.status, 'selected');
  assert.equal(result.candidate.reference, 'private:consumer-commerce-mobile@5');
  assert.equal(result.candidate.packageHash, 'commerce-5');
  assert.ok(result.evidence.some(item => item.dimension === 'platform'));
  assert.ok(result.evidence.some(item => item.dimension === 'surface'));
});

test('never treats a shell or design utility as the final business Skill', () => {
  const result = matchDesignSkill({
    requirements, visibleSkills: [visible[0]], registry, privateAllowlist: []
  });
  assert.deepEqual(result, {
    status: 'unavailable', candidates: [], reason: 'no eligible business design Skill is visible'
  });
});

test('excludes private Skills unless explicitly selected or allowlisted', () => {
  const result = matchDesignSkill({
    requirements, visibleSkills: [visible[1], visible[2]], registry, privateAllowlist: []
  });
  assert.equal(result.status, 'selected');
  assert.equal(result.candidate.reference, 'built-in:tiktok-design-system');
});

test('returns ranked ambiguity instead of guessing when candidates are too close', () => {
  const twinRegistry = {
    'public:alpha': registry['private:consumer-commerce-mobile'],
    'workspace:beta': registry['private:consumer-commerce-mobile']
  };
  const result = matchDesignSkill({
    requirements,
    visibleSkills: [
      { name: 'alpha', source: 'public', category: 'design-system', version: 3 },
      { name: 'beta', source: 'workspace', category: 'design-system', version: 3 }
    ],
    registry: twinRegistry,
    privateAllowlist: []
  });
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.candidates.map(item => item.reference), ['public:alpha@3', 'workspace:beta@3']);
});

test('ships a registry that distinguishes consumer, merchant, creator and support surfaces', async () => {
  const shipped = JSON.parse(await readFile(new URL('../references/design-skill-registry.json', import.meta.url), 'utf8'));
  assert.deepEqual(shipped['private:douyin-mall-independent-app-prototype-guidance'].surfaces, ['consumer']);
  assert.deepEqual(shipped['public:aurora-design-system'].surfaces, ['merchant']);
  assert.deepEqual(shipped['public:daren-prototype'].surfaces, ['creator']);
  assert.deepEqual(shipped['public:feige-prototype'].surfaces, ['support']);
});
