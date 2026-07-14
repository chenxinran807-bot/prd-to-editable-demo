import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanProductionTree } from '../scripts/check-evaluation-leakage.mjs';

test('detects experiment vocabulary in production paths but excludes fixtures and reports', () => {
  const root = mkdtempSync(join(tmpdir(), 'leakage-'));
  for (const dir of ['src', 'bin', 'references', 'fixtures', 'docs']) mkdirSync(join(root, dir));
  writeFileSync(join(root, 'src', 'matcher.mjs'), 'const forbidden = "case-only-entry";');
  writeFileSync(join(root, 'fixtures', 'case.md'), 'case-only-entry');
  writeFileSync(join(root, 'docs', 'report.md'), 'case-only-entry');
  const result = scanProductionTree(root, { forbiddenTerms: ['case-only-entry'] });
  assert.equal(result.status, 'failed');
  assert.equal(result.matches.length, 1);
  assert.match(result.matches[0].file, /src\/matcher\.mjs$/);
});

test('passes domain-neutral production code', () => {
  const root = mkdtempSync(join(tmpdir(), 'leakage-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'contract.mjs'), 'export const invariant = "observable-feedback";');
  assert.equal(scanProductionTree(root, { forbiddenTerms: ['case-only-entry'] }).status, 'passed');
});
