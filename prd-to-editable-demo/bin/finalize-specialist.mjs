#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { finalizeSpecialistResult } from '../src/finalize-specialist.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--source') options.source = argv[++index];
    else if (argv[index] === '--handoff') options.handoff = argv[++index];
    else if (argv[index] === '--evidence') options.evidence = argv[++index];
    else if (argv[index] === '--out') options.out = argv[++index];
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!options.source || !options.handoff || !options.out) {
    process.stderr.write('Usage: finalize-specialist --source <specialist-directory> --handoff <specialist-handoff.json> [--evidence <specialist-evidence.json>] --out <output-directory>\n');
    return 2;
  }
  const handoff = JSON.parse(await readFile(resolve(options.handoff), 'utf8'));
  if (options.evidence) {
    const evidence = JSON.parse(await readFile(resolve(options.evidence), 'utf8'));
    handoff.specialistEvidence = Array.isArray(evidence) ? evidence : evidence.specialistEvidence;
  }
  const result = await finalizeSpecialistResult({ sourceDir: options.source, outDir: options.out, handoff });
  process.stdout.write(`${result.output}/index.html\n`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1;
  });
}
