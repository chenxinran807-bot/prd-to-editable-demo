import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export function runBenchmark() {
  const workspace = mkdtempSync(join(tmpdir(), 'prd-demo-benchmark-'));
  const definitions = [
    { name: 'simple', fixture: 'simple-prd.md', route: 'local' },
    { name: 'incomplete', fixture: 'incomplete-prd.md', route: 'local' },
    { name: 'scheduling', fixture: 'scheduling-prd.md', route: 'local', expectedStates: ['error'] },
    { name: 'strategy', fixture: 'strategy-prd.md', route: 'inspire', expectedStages: ['prd-generator', 'inspire'] }
  ];
  try {
    const cases = definitions.map(definition => {
      const output = join(workspace, definition.name);
      const result = spawnSync(process.execPath, [
        'bin/prd-to-editable-demo.mjs', '--prd', `fixtures/${definition.fixture}`, '--out', output
      ], { cwd: ROOT, encoding: 'utf8' });
      const local = definition.route === 'local';
      const artifact = local ? join(output, 'prototype.manifest.json') : join(output, 'specialist-handoff.json');
      const data = existsSync(artifact) ? JSON.parse(readFileSync(artifact, 'utf8')) : {};
      const html = local && existsSync(join(output, 'index.html')) ? readFileSync(join(output, 'index.html'), 'utf8') : '';
      const route = data.routing?.selected ?? (local ? 'local' : undefined);
      const businessObjects = data.requirements?.businessObjects ?? [];
      const states = [...new Set((data.pages ?? []).map(page => page.state))];
      const passed = result.status === (local ? 0 : 3)
        && route === definition.route
        && (definition.expectedStages ?? []).every((stage, index) => data.routing?.stages?.[index] === stage)
        && businessObjects.length > 0
        && (definition.expectedStates ?? []).every(state => states.includes(state))
        && (local ? /id="editor-panel"/.test(html) : !existsSync(join(output, 'index.html')));
      return { name: definition.name, route, passed, editable: local && /id="editor-panel"/.test(html), businessObjects, states, exitCode: result.status };
    });
    return { generatedAt: new Date().toISOString(), passed: cases.every(item => item.passed), cases };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = runBenchmark();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.passed ? 0 : 1;
}
