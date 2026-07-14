import test from 'node:test';
import assert from 'node:assert/strict';
import { runProfessionalWorkflow } from '../src/professional-workflow.mjs';

const requirements = {
  title: '内容提交', actor: '用户', goal: '提交内容并看到结果', experienceType: 'linear',
  businessObjects: ['内容'], userActions: ['提交'], states: ['成功'],
  screens: ['编辑内容', '提交结果'],
  transitions: [{ from: '编辑内容', action: '提交', to: '提交结果' }]
};
const auditRequirements = {
  screens: ['编辑内容', '提交结果'], actions: ['submit'], states: ['success'],
  components: ['top-bar'], touchLabels: ['提交'], editableDimensions: []
};
const visibleSkills = [{ name: 'native-mobile', source: 'public', version: 2, category: 'design-system' }];
const registry = {
  'public:native-mobile': {
    domains: [], platforms: ['mobile'], surfaces: ['consumer'], capabilities: [], exclusions: [], qualityLevel: 'brand-native'
  }
};
const markup = '<header data-component="top-bar">编辑内容</header><button data-action="submit">提交</button><section data-state="success">提交结果 成功</section>';

function client({ fail = [] } = {}) {
  let count = 0;
  return {
    async preflight(reference) { return { designSkill: { source: 'public', name: 'native-mobile', version: 2 }, reference }; },
    async generate(plan) {
      count += 1;
      if (fail.includes(count)) throw new Error(`candidate ${count} failed`);
      return { assetId: `asset-${count}`, previewUrl: `https://preview/${count}`, inboxDeepLink: `inspire://inbox/${count}` };
    },
    async asset(assetId) { return { assetId, markup }; }
  };
}

test('generates three valid candidates with one exact Skill and shared contract', async () => {
  const result = await runProfessionalWorkflow({
    requirements, auditRequirements, inputs: { assets: [] }, visibleSkills,
    registry, privateAllowlist: [], client: client(), references: { icons: [] }
  });
  assert.equal(result.status, 'comparison-ready');
  assert.equal(result.candidates.length, 3);
  assert.ok(result.candidates.every(item => item.audit.status === 'passed'));
  assert.equal(new Set(result.candidates.map(item => item.candidateBrief.requirementsHash)).size, 1);
  assert.ok(result.candidates.every(item => item.designSkill === 'public:native-mobile@2'));
});

test('returns selection-required before generation when Skill matching is ambiguous', async () => {
  const twins = [
    { name: 'alpha', source: 'public', version: 1, category: 'design-system' },
    { name: 'beta', source: 'workspace', version: 1, category: 'design-system' }
  ];
  const twinRegistry = {
    'public:alpha': { domains: [], platforms: ['mobile'], surfaces: ['consumer'], capabilities: [], exclusions: [], qualityLevel: 'native' },
    'workspace:beta': { domains: [], platforms: ['mobile'], surfaces: ['consumer'], capabilities: [], exclusions: [], qualityLevel: 'native' }
  };
  const result = await runProfessionalWorkflow({
    requirements, auditRequirements, inputs: { assets: [] }, visibleSkills: twins,
    registry: twinRegistry, privateAllowlist: [], client: client(), references: { icons: [] }
  });
  assert.equal(result.status, 'selection-required');
  assert.equal(result.skillCandidates.length, 2);
});

test('allows one retryable candidate failure but blocks when fewer than two remain', async () => {
  const partial = await runProfessionalWorkflow({
    requirements, auditRequirements, inputs: { assets: [] }, visibleSkills,
    registry, privateAllowlist: [], client: client({ fail: [2] }), references: { icons: [] }
  });
  assert.equal(partial.status, 'comparison-ready');
  assert.equal(partial.candidates.length, 2);
  assert.equal(partial.failures.length, 1);

  const blocked = await runProfessionalWorkflow({
    requirements, auditRequirements, inputs: { assets: [] }, visibleSkills,
    registry, privateAllowlist: [], client: client({ fail: [1, 2] }), references: { icons: [] }
  });
  assert.equal(blocked.status, 'generation-blocked');
  assert.equal(blocked.candidates.length, 1);
});
