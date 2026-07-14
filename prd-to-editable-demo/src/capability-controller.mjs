const MODES = new Set(['professional', 'fast-review']);

export function decideCapabilityReadiness(state) {
  if (!state || !MODES.has(state.mode)) throw new Error('mode must be professional or fast-review');
  if (state.mode === 'fast-review') return { status: 'ready-local', allowLocalFinal: false, formal: false };
  if (!state.cliInstalled) return { status: 'auto-repair', action: 'install-inspire-cli', resumeAt: 'preflight' };
  if (!state.authenticated) return { status: 'user-action-required', action: 'authorize-inspire', resumeAt: 'preflight' };
  if (!state.designSkillVisible) {
    return { status: 'professional-blocked', action: 'resolve-design-skill', allowLocalFinal: false, resumeAt: 'preflight' };
  }
  return { status: 'ready-inspire', allowLocalFinal: false, formal: true };
}
