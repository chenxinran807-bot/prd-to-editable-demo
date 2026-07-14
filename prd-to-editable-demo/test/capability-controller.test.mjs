import test from 'node:test';
import assert from 'node:assert/strict';
import { decideCapabilityReadiness } from '../src/capability-controller.mjs';

test('professional mode asks only for authorization that cannot be automated', () => {
  assert.deepEqual(decideCapabilityReadiness({ mode: 'professional', cliInstalled: true, authenticated: false, designSkillVisible: false }), {
    status: 'user-action-required',
    action: 'authorize-inspire',
    resumeAt: 'preflight'
  });
});

test('professional mode automatically repairs a missing CLI', () => {
  assert.deepEqual(decideCapabilityReadiness({ mode: 'professional', cliInstalled: false, authenticated: false, designSkillVisible: false }), {
    status: 'auto-repair',
    action: 'install-inspire-cli',
    resumeAt: 'preflight'
  });
});

test('professional mode never silently downgrades when the design Skill is unavailable', () => {
  const result = decideCapabilityReadiness({ mode: 'professional', cliInstalled: true, authenticated: true, designSkillVisible: false });
  assert.equal(result.status, 'professional-blocked');
  assert.equal(result.allowLocalFinal, false);
});

test('fast review remains available without Inspire but is not a formal delivery', () => {
  assert.deepEqual(decideCapabilityReadiness({ mode: 'fast-review', cliInstalled: false, authenticated: false, designSkillVisible: false }), {
    status: 'ready-local',
    allowLocalFinal: false,
    formal: false
  });
});
