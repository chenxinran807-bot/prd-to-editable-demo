import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('packaged Skill installs without a wrapper directory and runs independently', () => {
  const root = mkdtempSync(join(tmpdir(), 'prd-demo-install-'));
  const archive = join(root, 'skill.zip');
  const installed = join(root, 'installed');
  const output = join(root, 'output');
  const packageResult = spawnSync('bash', ['scripts/package-skill.sh', archive], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(packageResult.status, 0, packageResult.stderr);
  const unzipResult = spawnSync('unzip', ['-q', archive, '-d', installed], { encoding: 'utf8' });
  assert.equal(unzipResult.status, 0, unzipResult.stderr);
  assert.match(readFileSync(join(installed, 'SKILL.md'), 'utf8'), /name: prd-to-editable-demo/);
  assert.match(readFileSync(join(installed, 'bin', 'verify-specialist.mjs'), 'utf8'), /verifySpecialistRender/);
  assert.match(readFileSync(join(installed, 'bin', 'run-inspire-pipeline.mjs'), 'utf8'), /createInspireClient/);
  const skillFiles = readdirSync(installed, { recursive: true }).filter(file => /(^|\/)SKILL\.md$/.test(file));
  assert.deepEqual(skillFiles, ['SKILL.md']);
  assert.equal(existsSync(join(installed, 'inspire-business-skill')), false);
  assert.equal(existsSync(join(installed, 'inspire-business-skill-release')), false);
  for (const file of [
    'references/requirements-ir.md',
    'references/capability-policy.md',
    'references/interaction-design.md',
    'references/visual-quality.md',
    'references/quality-gates.md',
    'references/clarification.md',
    'references/execution-contract.md',
    'references/visual-reference.md',
    'references/fidelity-verification.md',
    'schemas/requirements-ir-v2.schema.json',
    'schemas/visual-reference-manifest.schema.json',
    'src/requirements-ir-v2.mjs',
    'src/clarification.mjs',
    'src/execution-baseline.mjs',
    'src/visual-references.mjs',
    'src/fidelity-verifier.mjs',
    'src/capability-controller.mjs'
  ]) assert.ok(existsSync(join(installed, file)), `${file} must ship`);
  assert.match(readFileSync(join(installed, 'scripts', 'package-skill.sh'), 'utf8'), /missing standalone core file/);

  const emptyHome = join(root, 'empty-home');
  const run = spawnSync(process.execPath, [
    join(installed, 'bin', 'prd-to-editable-demo.mjs'),
    '--prd', resolve(new URL('../fixtures/simple-prd.md', import.meta.url).pathname),
    '--intent', '快速评审初版，优先速度',
    '--out', output
  ], { encoding: 'utf8', env: { ...process.env, HOME: emptyHome, CODEX_HOME: join(emptyHome, '.codex') } });
  assert.equal(run.status, 0, run.stderr);
  assert.match(readFileSync(join(output, 'index.html'), 'utf8'), /去审核/);
});
