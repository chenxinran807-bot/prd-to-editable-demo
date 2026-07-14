#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectCandidate } from '../src/candidate-selection.mjs';

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key?.startsWith('--') || !argv[index + 1]) throw new Error('用法: select-candidate --comparison <file> --choice <A|B|C|candidateId|assetId> --out <file>');
    result[key.slice(2)] = argv[index + 1];
  }
  return result;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args.comparison || !args.choice || !args.out) throw new Error('用法: select-candidate --comparison <file> --choice <value> --out <file>');
  const comparison = JSON.parse(await readFile(resolve(args.comparison), 'utf8'));
  const selected = selectCandidate(comparison, args.choice, { reason: args.reason });
  await writeFile(resolve(args.out), `${JSON.stringify(selected, null, 2)}\n`, 'utf8');
  process.stdout.write(`${resolve(args.out)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
