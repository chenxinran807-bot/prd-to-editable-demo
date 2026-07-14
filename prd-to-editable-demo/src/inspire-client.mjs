import { spawn } from 'node:child_process';

export class InspireClientError extends Error {
  constructor(kind, message, details = {}) {
    super(message);
    this.name = 'InspireClientError';
    this.kind = kind;
    this.details = details;
  }
}

function defaultRun(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function parseJson(source, label) {
  try { return JSON.parse(source.trim()); } catch {
    throw new InspireClientError('malformed_output', `${label} returned malformed JSON`);
  }
}

function parseNdjson(source) {
  const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new InspireClientError('malformed_output', 'generation returned empty NDJSON');
  const events = [];
  const ignoredOutput = [];
  for (const line of lines) {
    try { events.push(JSON.parse(line)); } catch { ignoredOutput.push(line); }
  }
  if (!events.length) throw new InspireClientError('malformed_output', 'generation returned malformed NDJSON');
  return { events, ignoredOutput };
}

function parseSkillRef(reference) {
  const match = /^(built-in|private|workspace|public):([^@]+)(?:@(\d+))?$/.exec(reference ?? '');
  if (!match) throw new InspireClientError('invalid_skill_ref', 'design Skill must use source:key or source:key@version');
  return { source: match[1], skillKey: match[2], version: match[3] ? Number(match[3]) : null };
}

function isHostOrchestrationSkill(skill) {
  return skill.skillKey === 'prd-to-editable-demo';
}

function normalizedSkillIdentity(value) {
  if (typeof value === 'string') {
    try { return parseSkillRef(value); } catch { return null; }
  }
  if (!value || typeof value !== 'object') return null;
  return {
    source: value.source,
    skillKey: value.skillKey ?? value.key ?? value.ref ?? value.name,
    version: value.version == null ? null : Number(value.version),
    packageHash: value.packageHash ?? value.package_hash ?? null
  };
}

function sameSkillPackage(actual, expected) {
  const candidate = normalizedSkillIdentity(actual);
  const wanted = normalizedSkillIdentity(expected);
  if (!candidate || !wanted) return false;
  if (candidate.source !== wanted.source || candidate.skillKey !== wanted.skillKey) return false;
  if (wanted.version !== null && candidate.version !== wanted.version) return false;
  if (wanted.packageHash && candidate.packageHash !== wanted.packageHash) return false;
  return true;
}

function assertExactSkillOpened(done, expectedDesignSkill) {
  if (!expectedDesignSkill) return;
  const trace = done.skillTrace ?? done.skill_trace ?? {};
  const opened = trace.openedSkills ?? trace.opened_skills ?? [];
  const activated = trace.activatedSkills ?? trace.activated_skills ?? [];
  if (!opened.some(item => sameSkillPackage(item, expectedDesignSkill))
      || !activated.some(item => sameSkillPackage(item, expectedDesignSkill))) {
    throw new InspireClientError(
      'design_skill_not_opened',
      'Inspire generated an asset without activating and opening the pinned business design Skill',
      { assetId: done.assetId, expectedDesignSkill, skillTrace: trace }
    );
  }
}

function safeCliError(result) {
  throw new InspireClientError('cli_failed', `Inspire CLI exited with code ${result.code}`, { exitCode: result.code });
}

export function createInspireClient({ run = defaultRun, command = 'inspire-prototype' } = {}) {
  const execute = async args => {
    const result = await run(command, args);
    if (result.code !== 0) safeCliError(result);
    return result.stdout;
  };
  const client = {
    async whoami() {
      return parseJson(await execute(['whoami', '--json']), 'whoami');
    },
    async visibleSkills() {
      const value = parseJson(await execute(['skills', 'visible', '--json']), 'skills visible');
      if (!Array.isArray(value.list)) throw new InspireClientError('malformed_output', 'skills visible response must contain list');
      return value.list;
    },
    async preflight(designSkillRef) {
      const wanted = parseSkillRef(designSkillRef);
      if (isHostOrchestrationSkill(wanted)) {
        throw new InspireClientError(
          'orchestration_skill_misrouted',
          'prd-to-editable-demo is the host Agent orchestration Skill and cannot be passed to Inspire Builder as --skill'
        );
      }
      const identity = await client.whoami();
      const visible = await client.visibleSkills();
      const designSkill = visible.find(item => sameSkillPackage(item, wanted));
      if (!designSkill) throw new InspireClientError('design_skill_not_visible', 'the pinned Inspire business design Skill is not visible');
      return { identity, designSkill, reference: wanted };
    },
    async generate(plan) {
      if (!plan?.prompt || !plan?.designSkill) throw new InspireClientError('invalid_plan', 'generation plan requires prompt and designSkill');
      const args = ['generate', 'prototype', '--prompt', plan.prompt];
      if (plan.name) args.push('--name', plan.name);
      if (plan.parentAssetId) args.push('--ref', plan.parentAssetId);
      args.push('--skill', plan.designSkill);
      for (const file of plan.files ?? []) args.push('--file', file);
      args.push('--type', plan.outputType ?? 'html', '--wait', '--report', 'json', '--fail-on-generation-error', '--json');
      const { events, ignoredOutput } = parseNdjson(await execute(args));
      const rawDone = [...events].reverse().find(event =>
        event.type === 'done' || (event.status && (event.assetId || event.e2eReport?.assetId))
      );
      const direct = rawDone?.result ?? rawDone;
      const done = direct?.e2eReport
        ? { ...direct.e2eReport, ...direct, skillTrace: direct.skillTrace ?? direct.e2eReport.skillTrace }
        : direct;
      if (!done) throw new InspireClientError('malformed_output', 'generation NDJSON is missing a done event');
      if (done.status !== 'success') throw new InspireClientError('generation_failed', 'Inspire prototype generation did not succeed', { status: done.status, assetId: done.assetId });
      if (!done.assetId) throw new InspireClientError('malformed_output', 'successful generation is missing assetId');
      assertExactSkillOpened(done, plan.expectedDesignSkill);
      return { ...done, events, ignoredOutput };
    },
    async asset(assetId) {
      if (!assetId) throw new InspireClientError('invalid_asset', 'assetId is required');
      return parseJson(await execute(['asset', assetId, '--json']), 'asset');
    }
  };
  return client;
}
