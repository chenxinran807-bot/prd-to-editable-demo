#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, parse, relative, resolve } from 'node:path';
import { analyzeRequirements, parsePrd } from '../src/parse-prd.mjs';
import { validateSemanticRequirements } from '../src/semantic-requirements.mjs';
import { executionBaselineToModel, semanticRequirementsToModel } from '../src/semantic-to-model.mjs';
import { selectRoute } from '../src/select-route.mjs';
import { renderDemo } from '../src/render-demo.mjs';
import { writeOutput } from '../src/write-output.mjs';
import { validateRequirementsIrV2 } from '../src/requirements-ir-v2.mjs';
import { buildClarificationTurn, applyClarifications } from '../src/clarification.mjs';
import { findVisualReferenceConflicts, validateVisualReferences } from '../src/visual-references.mjs';
import { compileExecutionBaseline } from '../src/execution-baseline.mjs';
import { verifyFidelity } from '../src/fidelity-verifier.mjs';
import { publishDirectory } from '../src/publish-directory.mjs';

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
    else if (token === '--requirements-v2') options.requirementsV2 = argv[++index];
    else if (token === '--confirmations') options.confirmations = argv[++index];
    else if (token === '--visual-references') options.visualReferences = argv[++index];
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!options.prd || !options.out) {
    process.stderr.write('Usage: prd-to-editable-demo --prd <path> --out <directory> [--requirements <semantic-ir.json>] [--requirements-v2 <requirements-ir-v2.json>] [--confirmations <answers.json>] [--visual-references <references.json>] [--asset <path>] [--intent <text>] [--url <url>]\n');
    return 2;
  }
  const inputPaths = [options.prd, options.requirements, options.requirementsV2, options.confirmations, options.visualReferences]
    .filter(Boolean).map(path => realpathSync(resolve(path)));
  const requestedOutput = resolve(options.out);
  const canonicalizePotentialPath = path => {
    const unresolved = [];
    let cursor = path;
    while (true) {
      try { return resolve(realpathSync(cursor), ...unresolved.reverse()); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const parent = dirname(cursor);
        if (parent === cursor) throw error;
        unresolved.push(basename(cursor)); cursor = parent;
      }
    }
  };
  const output = canonicalizePotentialPath(requestedOutput);
  const packageRoot = realpathSync(process.cwd());
  const isAncestor = (ancestor, child) => { const value = relative(ancestor, child); return value === '' || (!value.startsWith('..') && !value.startsWith('/')); };
  if (output === parse(output).root || isAncestor(output, packageRoot) || inputPaths.some(input => isAncestor(output, input))) {
    throw new Error(`Unsafe output path: ${output} must not be a filesystem root, package directory, input file, or input ancestor`);
  }
  const source = await readFile(resolve(options.prd), 'utf8');
  const readJson = async (path, label) => {
    const resolved = resolve(path);
    let text;
    try { text = await readFile(resolved, 'utf8'); } catch (error) { throw new Error(`Cannot read ${label} at ${resolved}: ${error.message}`); }
    try { return JSON.parse(text); } catch (error) { throw new Error(`Cannot parse ${label} at ${resolved}: ${error.message}`); }
  };
  let v2Context = null;
  if (options.requirementsV2) {
    let ir = validateRequirementsIrV2(await readJson(options.requirementsV2, 'requirements v2'), source);
    const ensureArray = (value, label) => {
      if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
      return value;
    };
    const confirmations = ensureArray(options.confirmations ? await readJson(options.confirmations, 'confirmations') : [], 'confirmations');
    ir = applyClarifications(ir, confirmations);
    ir = validateRequirementsIrV2(ir, source);
    const blockingClarifications = ir.blockers.filter(blocker => blocker.priority === 'P0' || blocker.priority === 'P1');
    const turn = buildClarificationTurn(blockingClarifications);
    if (turn) {
      await publishDirectory(output, dir => writeFile(`${dir}/clarification-required.json`, `${JSON.stringify({
          schemaVersion: 1, status: 'clarification-required', turn, remaining: ir.blockers.length,
          resumeCommand: 'prd-to-editable-demo --requirements-v2 <requirements-ir-v2.json> --confirmations <answers.json>'
        }, null, 2)}\n`));
      process.stderr.write(`Requirements clarification required: ${turn.theme} (${turn.questions.length} questions, ${ir.blockers.length} remaining)\n`);
      return 5;
    }
    const visualInput = ensureArray(options.visualReferences ? await readJson(options.visualReferences, 'visual references') : [], 'visual references');
    const visualConflicts = findVisualReferenceConflicts(visualInput);
    if (visualConflicts.length) {
      const questions = visualConflicts.slice(0, 3).map((conflict, index) => ({
        id: `visual-conflict-${index + 1}`, theme: 'visual-reference-conflict', priority: 'P0',
        question: `Which reference should control exact ${conflict.property} on page ${conflict.pageId}${conflict.regionId ? `, region ${conflict.regionId}` : ''}?`,
        impact: `Two exact references control ${conflict.property} in the same visible scope`,
        recommendation: 'choose one exact source or lower fidelity',
        options: conflict.referenceIds.map(id => `Keep ${id} exact`), conflict,
      }));
      await publishDirectory(output, dir => writeFile(`${dir}/clarification-required.json`, `${JSON.stringify({
        schemaVersion: 1, status: 'clarification-required', turn: { theme: 'visual-reference-conflict', questions },
        remaining: visualConflicts.length, resumeCommand: 'Update the visual reference manifest to resolve conflicts, then rerun the same --visual-references command.'
      }, null, 2)}\n`));
      return 5;
    }
    let visualReferences = validateVisualReferences(visualInput, {
      pageIds: ir.pages.map(({ id }) => id), regions: ir.regions.map(({ id, pageId }) => ({ id, pageId }))
    });
    const visualBase = options.visualReferences ? dirname(resolve(options.visualReferences)) : process.cwd();
    visualReferences = await Promise.all(visualReferences.map(async reference => {
      const asset = resolve(visualBase, reference.asset); await readFile(asset); return { ...reference, asset };
    }));
    const baseline = compileExecutionBaseline(ir, visualReferences);
    v2Context = { ir, baseline, visualReferences, confirmations };
  }
  const requirementsPath = options.requirements ? resolve(options.requirements) : null;
  const requirements = v2Context ? v2Context.ir : requirementsPath
    ? validateSemanticRequirements(JSON.parse(await readFile(requirementsPath, 'utf8')), source)
    : analyzeRequirements(source);
  const route = selectRoute({ intent: v2Context?.visualReferences.length ? '高保真视觉参考，专业交付' : options.intent, assets: [...options.assets, ...(v2Context?.visualReferences.map(reference => reference.asset) ?? [])], source, url: options.url });
  if (route.deliveryMode === 'professional' && !v2Context) {
    const missing = ['screens', 'transitions'].filter(field => !Array.isArray(requirements[field]) || requirements[field].length === 0);
    if (missing.length) {
      await publishDirectory(output, dir => writeFile(`${dir}/requirements-blocker.json`, `${JSON.stringify({
        schemaVersion: 1,
        status: 'semantic-requirements-required',
        extractionMode: requirements.extractionMode,
        missing,
        action: '宿主 Agent 必须根据完整 PRD 生成带原文证据的 model-semantic 结构后重新运行',
        resumeCommand: 'prd-to-editable-demo --requirements <semantic-requirements.json>'
      }, null, 2)}\n`));
      process.stderr.write(`专业模式缺少语义结构：${missing.join('、')}；已生成 requirements-blocker.json\n`);
      return 4;
    }
  }
  if (route.id !== 'local') {
    const parity = JSON.parse(await readFile(new URL('../references/capability-parity.json', import.meta.url), 'utf8'));
    const specialistBaseline = parity.capabilities.inspire;
    const stages = route.stages ?? [route.id];
    const specialistPlan = Object.entries(parity.capabilities).map(([id, baseline]) => ({ id, baseline }));
    const stageCriteria = [...new Set(specialistPlan.flatMap(stage => stage.baseline?.mustPreserve ?? []))];
    const handoff = {
      schemaVersion: 1,
      routing: { selected: route.id, stages, reason: route.reason, handoff: stages.map(id => `use-${id}-skill`).join('-then-'), status: 'required' },
      requirements,
      executionBaseline: v2Context?.baseline,
      visualReferences: v2Context?.visualReferences,
      inputs: { prd: resolve(options.prd), semanticRequirements: requirementsPath, requirementsV2: options.requirementsV2 ? resolve(options.requirementsV2) : null, assets: [...new Set([...options.assets.map(asset => resolve(asset)), ...(v2Context?.visualReferences.map(reference => reference.asset) ?? [])])], referenceUrl: options.url ?? null },
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
    await publishDirectory(output, dir => Promise.all([
      writeFile(`${dir}/specialist-handoff.json`, JSON.stringify(handoff, null, 2)),
      writeFile(`${dir}/specialist-evidence.template.json`, `${JSON.stringify({ specialistEvidence: stageCriteria.map(criterion => ({ criterion, evidence: '' })) }, null, 2)}\n`),
      writeFile(`${dir}/NEXT.md`, `# 专业能力接管\n\n- 执行链：${stages.join(' → ')}\n- 最终交付 Skill：${route.id}\n- 原因：${route.reason}\n- 输入契约：specialist-handoff.json\n- 验收证据模板：specialist-evidence.template.json\n\n统一入口必须按顺序执行计划：前一阶段输出作为后一阶段的需求上下文；不得把 PRD 章节机械生成页面。专业结果完成后填写每项证据，再执行 finalize-specialist 与 verify-specialist；缺少任一步时保持 review-required。\n`)
    ]));
    process.stderr.write(`需要执行 ${stages.join(' → ')}，已生成交接包：${route.reason}\n`);
    return 3;
  }
  const parsed = parsePrd(source);
  const manifest = v2Context ? executionBaselineToModel(v2Context.baseline, parsed.product)
    : requirementsPath ? semanticRequirementsToModel(requirements) : parsed;
  if (v2Context) {
    manifest.requirements = v2Context.ir;
    manifest.assumptions = [];
    manifest.gaps = [];
  }
  manifest.delivery = { mode: route.deliveryMode, formal: false };
  manifest.routing = { selected: route.id, reason: route.reason, handoff: route.id === 'local' ? 'local-fast-path' : `use-${route.id}-skill` };
  if (route.id !== 'local') manifest.assumptions.push({ id: 'route-fallback', statement: `专业路径 ${route.id} 尚未接入，使用本地生成`, source: 'router' });
  const html = renderDemo(manifest);
  if (v2Context) {
    const verified = verifyFidelity({ baseline: v2Context.baseline, model: manifest });
    const reviewRequired = verified.checks.some(check => check.reviewRequired);
    const pageByRegion = new Map(v2Context.ir.regions.map(region => [region.id, region.pageId]));
    v2Context.fidelity = {
      ...verified,
      status: reviewRequired ? 'review-required' : verified.status,
      traceability: verified.traceability.map(item => ({
        ...item,
        sourceIds: item.kind === 'requirement' ? v2Context.ir.requirements.find(requirement => requirement.id === item.id)?.sourceIds ?? [] : [],
        targetIds: item.kind === 'requirement' ? v2Context.ir.requirements.find(requirement => requirement.id === item.id)?.targetIds ?? [] : [],
        regions: item.kind === 'requirement' ? (v2Context.ir.requirements.find(requirement => requirement.id === item.id)?.targetIds ?? []).filter(id => pageByRegion.has(id)) : []
      }))
    };
  }
  const result = await writeOutput({ outDir: output, html, manifest, context: v2Context });
  process.stdout.write(`${result.output}/index.html\n`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1;
  });
}
