import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export function runBenchmark() {
  const workspace = mkdtempSync(join(tmpdir(), 'prd-demo-benchmark-'));
  const definitions = [
    { name: 'simple', fixture: 'simple-prd.md', route: 'local', intent: '快速评审初版，优先速度' },
    { name: 'incomplete', fixture: 'incomplete-prd.md', route: 'local', intent: '快速评审初版，优先速度' },
    { name: 'scheduling', fixture: 'scheduling-prd.md', route: 'local', intent: '快速评审初版，优先速度', expectedStates: ['error'] },
    { name: 'strategy', fixture: 'strategy-prd.md', route: 'inspire', expectedStages: ['inspire'] },
    { name: 'commerce-discovery', fixture: 'commerce-discovery-prd.md', requirements: 'commerce-discovery-requirements.json', route: 'inspire', expectedScreens: ['商城推荐', '商品搜索', '商品详情'] },
    { name: 'commerce-checkout', fixture: 'commerce-checkout-prd.md', requirements: 'commerce-checkout-requirements.json', route: 'inspire', expectedScreens: ['规格选择', '确认订单', '支付结果'] },
    { name: 'commerce-after-sales', fixture: 'commerce-after-sales-prd.md', requirements: 'commerce-after-sales-requirements.json', route: 'inspire', expectedScreens: ['订单详情', '售后申请', '售后进度'] }
  ];
  try {
    const cases = definitions.map(definition => {
      const output = join(workspace, definition.name);
      const args = ['bin/prd-to-editable-demo.mjs', '--prd', `fixtures/${definition.fixture}`];
      if (definition.requirements) args.push('--requirements', `fixtures/${definition.requirements}`);
      if (definition.intent) args.push('--intent', definition.intent);
      args.push('--out', output);
      const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
      const local = definition.route === 'local';
      const artifact = local ? join(output, 'prototype.manifest.json') : join(output, 'specialist-handoff.json');
      const data = existsSync(artifact) ? JSON.parse(readFileSync(artifact, 'utf8')) : {};
      const html = local && existsSync(join(output, 'index.html')) ? readFileSync(join(output, 'index.html'), 'utf8') : '';
      const route = data.routing?.selected ?? (local ? 'local' : undefined);
      const businessObjects = data.requirements?.businessObjects ?? [];
      const screens = data.requirements?.screens ?? (data.pages ?? []).map(page => page.title);
      const states = [...new Set((data.pages ?? []).map(page => page.state))];
      const passed = result.status === (local ? 0 : 3)
        && route === definition.route
        && (definition.expectedStages ?? []).every((stage, index) => data.routing?.stages?.[index] === stage)
        && businessObjects.length > 0
        && (definition.expectedScreens ?? []).every((screen, index) => screens[index] === screen)
        && !screens.some(screen => /^(?:市场调研|竞品分析|方向判断|产品方案|功能首页|操作结果)$/u.test(screen))
        && (definition.expectedStates ?? []).every(state => states.includes(state))
        && (local ? /id="editor-panel"/.test(html) : !existsSync(join(output, 'index.html')));
      return { name: definition.name, route, passed, editable: local && /id="editor-panel"/.test(html), businessObjects, screens, states, exitCode: result.status };
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
