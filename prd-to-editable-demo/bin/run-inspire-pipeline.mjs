#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createInspireClient } from '../src/inspire-client.mjs';
import { buildInspirePlan } from '../src/inspire-plan.mjs';
import { acceptCandidate, addCandidate, markVerified, startLineage } from '../src/inspire-lineage.mjs';
import { auditNativeDesign } from '../src/native-design-audit.mjs';

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`未知参数: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${key} 缺少值`);
    result[key.slice(2)] = value;
    index += 1;
  }
  return result;
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function extractAuditableSource(asset) {
  for (const key of ['markup', 'html', 'source', 'content']) {
    if (typeof asset?.[key] === 'string' && asset[key].trim()) return asset[key];
  }
  return null;
}

function reportWithoutSource() {
  return {
    status: 'failed',
    failures: [{
      rule: 'audit-source-available',
      message: 'Inspire 资产接口未返回可审查的结构或导出源码，候选版本不能自动晋升。',
      evidence: []
    }],
    checks: [{ rule: 'audit-source-available', status: 'failed' }],
    subjectiveReview: {
      status: 'required',
      reason: '请在 Inspire 中完成视觉评审，并在可获得导出结构后重新执行确定性审查。'
    }
  };
}

function nextDocument({ delivery, generation, report }) {
  const promoted = delivery.currentAssetId === generation.assetId;
  return [
    '# 下一步',
    '',
    `- Inspire 预览：${generation.previewUrl ?? '未返回'}`,
    `- Inspire 收纳箱：${generation.inboxDeepLink ?? '未返回'}`,
    `- 当前候选资产：${generation.assetId}`,
    `- 自动晋升：${promoted ? '是（确定性规则通过）' : '否（保留上一已接受版本）'}`,
    `- 确定性审查：${report.status}`,
    '- 仍需在 Inspire 中进行主观视觉验收：品牌原生感、视觉层级、素材质量和业务语义。',
    '- 手动精修直接在 Inspire 中完成；后续 Agent 修改请使用当前已接受 assetId 作为 --ref。',
    ''
  ].join('\n');
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args.handoff || !args['design-skill'] || !args.out) {
    throw new Error('用法: run-inspire-pipeline --handoff <file> --design-skill <source:key@version> [--ref <assetId>] --out <dir>');
  }
  const output = resolve(args.out);
  const handoffPath = resolve(args.handoff);
  const handoffSource = await readFile(handoffPath, 'utf8');
  const handoff = JSON.parse(handoffSource);
  await mkdir(output, { recursive: true });

  const designSkill = args['design-skill'];
  const client = createInspireClient({ command: process.env.INSPIRE_PROTOTYPE_BIN || 'inspire-prototype' });
  const preflight = await client.preflight(designSkill);
  const plan = buildInspirePlan({
    route: handoff.routing,
    requirements: handoff.requirements,
    inputs: handoff.inputs,
    designSkill,
    parentAssetId: args.ref ?? null
  });
  const generation = await client.generate({ ...plan, name: handoff.requirements?.title });
  const asset = await client.asset(generation.assetId);
  const auditableSource = extractAuditableSource(asset);
  const references = JSON.parse(await readFile(new URL('../inspire-business-skill/references.json', import.meta.url), 'utf8'));
  const report = auditableSource
    ? auditNativeDesign(auditableSource, { requirements: handoff.auditRequirements ?? {}, references })
    : reportWithoutSource();

  let delivery = startLineage({
    prdSha256: createHash('sha256').update(handoffSource).digest('hex'),
    designSkill,
    currentAssetId: args.ref ?? null
  });
  delivery = addCandidate(delivery, { ...generation, parentAssetId: args.ref ?? null });
  if (report.status === 'passed') {
    delivery = markVerified(delivery, generation.assetId, { status: 'passed', report: 'native-design-report.json' });
    delivery = acceptCandidate(delivery, generation.assetId);
  }

  await Promise.all([
    writeFile(resolve(output, 'specialist-handoff.json'), json(handoff), 'utf8'),
    writeFile(resolve(output, 'inspire-plan.json'), json({ ...plan, preflight }), 'utf8'),
    writeFile(resolve(output, 'inspire-delivery.json'), json(delivery), 'utf8'),
    writeFile(resolve(output, 'native-design-report.json'), json(report), 'utf8'),
    writeFile(resolve(output, 'NEXT.md'), nextDocument({ delivery, generation, report }), 'utf8')
  ]);

  process.stdout.write(json({
    status: report.status === 'passed' ? 'candidate-promoted' : 'candidate-needs-review',
    assetId: generation.assetId,
    previewUrl: generation.previewUrl ?? null,
    inboxDeepLink: generation.inboxDeepLink ?? null,
    delivery: resolve(output, 'inspire-delivery.json'),
    handoff: basename(handoffPath)
  }));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
