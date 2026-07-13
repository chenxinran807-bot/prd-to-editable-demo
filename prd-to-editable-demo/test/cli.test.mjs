import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('prints usage when required arguments are missing', () => {
  const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--prd <path>/);
  assert.match(result.stderr, /--out <directory>/);
});

test('generates the complete editable demo deliverable', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'editable-demo-')), 'output');
  const result = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs', '--prd', 'fixtures/simple-prd.md', '--out', out
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  for (const name of ['index.html', 'prototype.manifest.json', 'prototype.patches.json', 'agent-comments.json', 'demo-summary.md', 'assumptions.md']) {
    assert.ok(readFileSync(join(out, name), 'utf8').length > 0, `${name} should exist`);
  }
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /让 Agent 修改/);
  assert.match(result.stdout, /index\.html/);
});
