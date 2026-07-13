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
  try { return lines.map(line => JSON.parse(line)); } catch {
    throw new InspireClientError('malformed_output', 'generation returned malformed NDJSON');
  }
}

function parseSkillRef(reference) {
  const match = /^(built-in|private|workspace|public):([^@]+)(?:@(\d+))?$/.exec(reference ?? '');
  if (!match) throw new InspireClientError('invalid_skill_ref', 'design Skill must use source:key or source:key@version');
  return { source: match[1], skillKey: match[2], version: match[3] ? Number(match[3]) : null };
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
      const identity = await client.whoami();
      const visible = await client.visibleSkills();
      const wanted = parseSkillRef(designSkillRef);
      const designSkill = visible.find(item => {
        const key = item.skillKey ?? item.key;
        return item.source === wanted.source && key === wanted.skillKey
          && (wanted.version === null || Number(item.version) === wanted.version);
      });
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
      args.push('--type', plan.outputType ?? 'html', '--wait', '--report', 'both', '--fail-on-generation-error', '--json');
      const events = parseNdjson(await execute(args));
      const rawDone = [...events].reverse().find(event => event.type === 'done');
      const done = rawDone?.result ?? rawDone;
      if (!done) throw new InspireClientError('malformed_output', 'generation NDJSON is missing a done event');
      if (done.status !== 'success') throw new InspireClientError('generation_failed', 'Inspire prototype generation did not succeed', { status: done.status, assetId: done.assetId });
      if (!done.assetId) throw new InspireClientError('malformed_output', 'successful generation is missing assetId');
      return { ...done, events };
    },
    async asset(assetId) {
      if (!assetId) throw new InspireClientError('invalid_asset', 'assetId is required');
      return parseJson(await execute(['asset', assetId, '--json']), 'asset');
    }
  };
  return client;
}
