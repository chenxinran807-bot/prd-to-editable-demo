import { rm, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '../../work/prd-to-editable-demo-smoke');
await rm(output, { recursive: true, force: true });
const result = spawnSync(process.execPath, [
  'bin/prd-to-editable-demo.mjs', '--prd', 'fixtures/simple-prd.md', '--out', output
], { cwd: root, encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr);
for (const name of ['index.html', 'prototype.manifest.json', 'prototype.patches.json', 'agent-comments.json', 'demo-summary.md', 'assumptions.md']) {
  await access(resolve(output, name));
}
process.stdout.write(`${resolve(output, 'index.html')}\n`);
