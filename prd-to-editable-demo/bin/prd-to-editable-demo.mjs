#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parsePrd } from '../src/parse-prd.mjs';
import { selectRoute } from '../src/select-route.mjs';
import { renderDemo } from '../src/render-demo.mjs';
import { writeOutput } from '../src/write-output.mjs';

export function parseArgs(argv) {
  const options = { assets: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--asset') options.assets.push(argv[++index]);
    else if (token === '--prd') options.prd = argv[++index];
    else if (token === '--out') options.out = argv[++index];
    else if (token === '--intent') options.intent = argv[++index];
    else if (token === '--url') options.url = argv[++index];
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!options.prd || !options.out) {
    process.stderr.write('Usage: prd-to-editable-demo --prd <path> --out <directory> [--asset <path>] [--intent <text>] [--url <url>]\n');
    return 2;
  }
  const source = await readFile(resolve(options.prd), 'utf8');
  const route = selectRoute({ intent: options.intent, assets: options.assets, source, url: options.url });
  if (route.id !== 'local') {
    process.stderr.write(`MVP 暂未接入 ${route.id}，已降级到本地快速生成：${route.reason}\n`);
  }
  const manifest = parsePrd(source);
  manifest.routing = { selected: route.id, reason: route.reason, handoff: route.id === 'local' ? 'local-fast-path' : `use-${route.id}-skill` };
  if (route.id !== 'local') manifest.assumptions.push({ id: 'route-fallback', statement: `专业路径 ${route.id} 尚未接入，使用本地生成`, source: 'router' });
  const html = renderDemo(manifest);
  const result = await writeOutput({ outDir: options.out, html, manifest });
  process.stdout.write(`${result.output}/index.html\n`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1;
  });
}
