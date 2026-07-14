#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCTION_PATHS = ['src', 'bin', 'SKILL.md', 'references'];

function filesUnder(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap(name => filesUnder(resolve(path, name)));
}

export function scanProductionTree(root, { forbiddenTerms = [] } = {}) {
  const normalizedTerms = forbiddenTerms.map(term => String(term).trim()).filter(Boolean);
  const matches = [];
  for (const file of PRODUCTION_PATHS.flatMap(path => filesUnder(resolve(root, path)))) {
    const content = readFileSync(file, 'utf8');
    for (const term of normalizedTerms) {
      const index = content.indexOf(term);
      if (index >= 0) matches.push({ file: relative(root, file), term, index });
    }
  }
  return { status: matches.length ? 'failed' : 'passed', scannedPaths: PRODUCTION_PATHS, matches };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? '.');
  const forbiddenTerms = process.argv.slice(3);
  const report = scanProductionTree(root, { forbiddenTerms });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === 'passed' ? 0 : 1;
}
