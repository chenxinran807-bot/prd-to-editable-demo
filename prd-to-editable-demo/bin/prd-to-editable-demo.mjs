#!/usr/bin/env node
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { analyzeRequirements, parsePrd } from '../src/parse-prd.mjs';
import { validateSemanticRequirements } from '../src/semantic-requirements.mjs';
import { semanticRequirementsToModel } from '../src/semantic-to-model.mjs';
import { compileAcceptanceContract } from '../src/acceptance-contract.mjs';
import { selectRoute } from '../src/select-route.mjs';
import { renderDemo } from '../src/render-demo.mjs';
import { writeOutput } from '../src/write-output.mjs';
import { createInspireClient } from '../src/inspire-client.mjs';
import { runProfessionalWorkflow } from '../src/professional-workflow.mjs';

export function parseArgs(argv) {
  const options = { assets: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--asset') options.assets.push(argv[++index]);
    else if (token === '--prd') options.prd = argv[++index];
    else if (token === '--out') options.out = argv[++index];
    else if (token === '--intent') options.intent = argv[++index];
    else if (token === '--url') options.url = argv[++index];
    else if (token === '--requirements') options.requirements = argv[++index];
    else if (token === '--design-skill') options.designSkill = argv[++index];
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!options.prd || !options.out) {
    process.stderr.write('Usage: prd-to-editable-demo --prd <path> --out <directory> [--requirements <semantic-ir.json>] [--asset <path>] [--intent <text>] [--url <url>] [--design-skill <source:key@version>]\n');
    return 2;
  }
  const source = await readFile(resolve(options.prd), 'utf8');
  const requirementsPath = options.requirements ? resolve(options.requirements) : null;
  const requirements = requirementsPath
    ? validateSemanticRequirements(JSON.parse(await readFile(requirementsPath, 'utf8')), source)
    : analyzeRequirements(source);
  const route = selectRoute({ intent: options.intent, assets: options.assets, source, url: options.url });
  const auditRequirements = compileAcceptanceContract(requirements);
  if (route.deliveryMode === 'professional') {
    const missing = ['screens', 'transitions'].filter(field => !Array.isArray(requirements[field]) || requirements[field].length === 0);
    if (missing.length) {
      const output = resolve(options.out);
      await rm(output, { recursive: true, force: true });
      await mkdir(output, { recursive: true });
      await writeFile(`${output}/requirements-blocker.json`, `${JSON.stringify({
        schemaVersion: 1,
        status: 'semantic-requirements-required',
        extractionMode: requirements.extractionMode,
        missing,
        action: '宿主 Agent 必须根据完整 PRD 生成带原文证据的 model-semantic 结构后重新运行',
        resumeCommand: 'prd-to-editable-demo --requirements <semantic-requirements.json>'
      }, null, 2)}\n`);
      process.stderr.write(`专业模式缺少语义结构：${missing.join('、')}；已生成 requirements-blocker.json\n`);
      return 4;
    }
  }
  if (route.id !== 'local') {
    const output = resolve(options.out);
    const parity = JSON.parse(await readFile(new URL('../references/capability-parity.json', import.meta.url), 'utf8'));
    const specialistBaseline = parity.capabilities.inspire;
    const stages = route.stages ?? [route.id];
    const specialistPlan = Object.entries(parity.capabilities).map(([id, baseline]) => ({ id, baseline }));
    const stageCriteria = [...new Set(specialistPlan.flatMap(stage => stage.baseline?.mustPreserve ?? []))];
    const handoff = {
      schemaVersion: 1,
      routing: { selected: route.id, stages, reason: route.reason, handoff: stages.map(id => `use-${id}-skill`).join('-then-'), status: 'required' },
      requirements,
      auditRequirements,
      inputs: { prd: resolve(options.prd), semanticRequirements: requirementsPath, assets: options.assets.map(asset => resolve(asset)), referenceUrl: options.url ?? null, sourceBytes: Buffer.byteLength(source, 'utf8') },
      qualityAssurance: { mode: route.deliveryMode, finalContainer: 'inspire', silentDowngradeAllowed: false, readiness: 'preflight-required' },
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
    const registry = JSON.parse(await readFile(new URL('../references/design-skill-registry.json', import.meta.url), 'utf8'));
    const privateAllowlist = Object.entries(registry)
      .filter(([, metadata]) => metadata.privateAutoUse === 'owner-approved')
      .map(([identity]) => identity);
    const client = createInspireClient({ command: process.env.INSPIRE_PROTOTYPE_BIN || 'inspire-prototype' });
    const visibleSkills = await client.visibleSkills();
    const workflow = await runProfessionalWorkflow({
      requirements,
      auditRequirements,
      inputs: {
        assets: options.assets.map(asset => ({ path: resolve(asset), role: 'solution' })),
        referenceUrl: options.url ?? null,
        prdSource: source
      },
      visibleSkills,
      selectedDesignSkill: options.designSkill ?? null,
      registry,
      privateAllowlist,
      client,
      references: JSON.parse(await readFile(new URL('../inspire-business-skill/references.json', import.meta.url), 'utf8'))
    });
    await writeFile(`${output}/candidate-comparison.json`, `${JSON.stringify(workflow, null, 2)}\n`);
    if (workflow.status === 'selection-required') {
      await writeFile(`${output}/design-skill-selection.json`, `${JSON.stringify(workflow, null, 2)}\n`);
      process.stderr.write('多个业务设计 Skill 匹配度接近，需要用户选择。\n');
      return 5;
    }
    if (workflow.status !== 'comparison-ready') {
      await writeFile(`${output}/generation-blocker.json`, `${JSON.stringify(workflow, null, 2)}\n`);
      process.stderr.write('有效 Inspire 候选少于两个，已保留失败证据。\n');
      return 6;
    }
    await writeFile(`${output}/NEXT.md`, '# 选择候选\n\n请预览 candidate-comparison.json 中的候选，并显式选择一个作为后续迭代父版本。\n');
    process.stdout.write(`${JSON.stringify({ status: workflow.status, candidates: workflow.candidates.map(({ candidateBrief, assetId, previewUrl, inboxDeepLink }) => ({ id: candidateBrief.id, label: candidateBrief.label, assetId, previewUrl, inboxDeepLink })) })}\n`);
    return 0;
  }
  const manifest = requirementsPath ? semanticRequirementsToModel(requirements) : parsePrd(source);
  manifest.delivery = { mode: route.deliveryMode, formal: false };
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
