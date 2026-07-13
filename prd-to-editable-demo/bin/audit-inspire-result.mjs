#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { auditNativeDesign } from '../src/native-design-audit.mjs';

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`未知参数: ${key}`);
    result[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}

async function readJson(path, fallback) {
  return path ? JSON.parse(await readFile(resolve(path), 'utf8')) : fallback;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error('缺少 --input <导出的 HTML 或结构化文件>');
  const output = resolve(args.out ?? 'native-design-report.json');
  const [source, requirements, references] = await Promise.all([
    readFile(resolve(args.input), 'utf8'),
    readJson(args.requirements, {}),
    readJson(args.references, {})
  ]);
  const report = auditNativeDesign(source, { requirements, references });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ status: report.status, report: output })}\n`);
  process.exitCode = report.status === 'passed' ? 0 : 2;
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
