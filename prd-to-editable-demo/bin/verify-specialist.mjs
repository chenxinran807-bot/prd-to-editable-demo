#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifySpecialistRender } from '../src/verify-specialist-render.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--delivery') options.delivery = argv[++index];
    else if (argv[index] === '--wait') options.waitMs = Number(argv[++index]);
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!options.delivery) {
    process.stderr.write('Usage: verify-specialist --delivery <unified-delivery-directory> [--wait <milliseconds>]\n');
    return 2;
  }
  const result = await verifySpecialistRender({ deliveryDir: options.delivery, waitMs: options.waitMs });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.renderPreservation.status === 'verified' ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1;
  });
}
