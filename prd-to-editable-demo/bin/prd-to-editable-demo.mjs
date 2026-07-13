#!/usr/bin/env node
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { analyzeRequirements, parsePrd } from '../src/parse-prd.mjs';
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
    const output = resolve(options.out);
    const parity = JSON.parse(await readFile(new URL('../references/capability-parity.json', import.meta.url), 'utf8'));
    const specialistBaseline = parity.specialists[route.id];
    const stages = route.stages ?? [route.id];
    const specialistPlan = stages.map(id => ({ id, baseline: parity.specialists[id] }));
    const stageCriteria = [...new Set(specialistPlan.flatMap(stage => stage.baseline?.mustPreserve ?? []))];
    const handoff = {
      schemaVersion: 1,
      routing: { selected: route.id, stages, reason: route.reason, handoff: stages.map(id => `use-${id}-skill`).join('-then-'), status: 'required' },
      requirements: analyzeRequirements(source),
      inputs: { prd: resolve(options.prd), assets: options.assets.map(asset => resolve(asset)), referenceUrl: options.url ?? null },
      specialistPlan,
      specialistBaseline,
      acceptance: [
        '保持 PRD 业务对象和动作',
        '主流程可从入口走到结果',
        '推断与事实分离',
        '交付物可继续编辑',
        ...stageCriteria
      ]
    };
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    await writeFile(`${output}/specialist-handoff.json`, JSON.stringify(handoff, null, 2));
    await writeFile(`${output}/specialist-evidence.template.json`, `${JSON.stringify({
      specialistEvidence: stageCriteria.map(criterion => ({ criterion, evidence: '' }))
    }, null, 2)}\n`);
    await writeFile(`${output}/NEXT.md`, `# 专业能力接管\n\n- 执行链：${stages.join(' → ')}\n- 最终交付 Skill：${route.id}\n- 原因：${route.reason}\n- 输入契约：specialist-handoff.json\n- 验收证据模板：specialist-evidence.template.json\n\n统一入口必须按顺序执行计划：前一阶段输出作为后一阶段的需求上下文；不得把 PRD 章节机械生成页面。专业结果完成后填写每项证据，再执行 finalize-specialist 与 verify-specialist；缺少任一步时保持 review-required。\n`);
    process.stderr.write(`需要执行 ${stages.join(' → ')}，已生成交接包：${route.reason}\n`);
    return 3;
  }
  const manifest = parsePrd(source);
  manifest.routing = { selected: route.id, reason: route.reason, handoff: route.id === 'local' ? 'local-fast-path' : `use-${route.id}-skill` };
  if (route.id !== 'local') manifest.assumptions.push({ id: 'route-fallback', statement: `专业路径 ${route.id} 尚未接入，使用本地生成`, source: 'router' });
  const html = renderDemo(manifest);
  const result = await writeOutput({ outDir: options.out, html, manifest });
  process.stdout.write(`${result.output}/index.html\n`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1;
  });
}
