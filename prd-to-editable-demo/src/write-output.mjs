import { mkdir, rm, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { verifyDemo } from './verify-demo.mjs';

export async function writeOutput({ outDir, html, manifest, context }) {
  const output = resolve(outDir);
  const staging = `${output}.staging`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  const demoChecks = verifyDemo({ html, manifest, fidelity: context?.fidelity });
  const summary = `# ${manifest.product.name} 演示说明\n\n- 起始页面：${manifest.pages.find(page => page.id === manifest.startPage)?.title}\n- 页面数量：${manifest.pages.length}\n- 使用方式：预览模式体验流程；编辑模式点选元素直接修改。\n- 路由结果：${manifest.routing?.selected || 'local'}\n- 路由说明：${manifest.routing?.reason || '默认本地快速路径'}\n- 专业接管：${manifest.routing?.handoff || 'local-fast-path'}\n`;
  const assumptions = `# 推断与缺口\n\n## 推断\n${manifest.assumptions.map(item => `- ${item.statement}`).join('\n') || '- 无'}\n\n## 缺口\n${manifest.gaps.map(item => `- ${item.statement}`).join('\n') || '- 无'}\n`;
  const files = {
    'index.html': html,
    'prototype.manifest.json': JSON.stringify(manifest, null, 2),
    'prototype.patches.json': JSON.stringify({ schemaVersion: 1, manifestId: manifest.id, patches: {} }, null, 2),
    'agent-comments.json': JSON.stringify({ schemaVersion: 1, manifestId: manifest.id, comments: [] }, null, 2),
    'demo-summary.md': summary,
    'assumptions.md': assumptions
  };
  if (context) {
    if (!context.fidelity) throw new TypeError('v2 output requires a canonical fidelity result');
    const fidelity = context.fidelity;
    Object.assign(files, {
      'prd-source-map.json': JSON.stringify({ schemaVersion: 1, sourceUnits: context.ir.sourceUnits, sourceCoverage: context.ir.sourceCoverage }, null, 2),
      'requirements-ir.json': JSON.stringify(context.ir, null, 2),
      'page-flow-graph.json': JSON.stringify({ schemaVersion: 1, pages: context.ir.pages, regions: context.ir.regions, actions: context.ir.actions, coreJourneys: context.ir.coreJourneys }, null, 2),
      'visual-reference-manifest.json': JSON.stringify({ schemaVersion: 1, references: context.visualReferences }, null, 2),
      'confirmation-record.json': JSON.stringify({ schemaVersion: 1, confirmations: context.confirmations }, null, 2),
      'requirements-baseline.json': JSON.stringify(context.baseline, null, 2),
      'traceability-matrix.json': JSON.stringify({ schemaVersion: 1, ...fidelity }, null, 2),
      'fidelity-report.md': `# Fidelity report\n\nStatus: ${fidelity.status}\n\n## Fidelity checks\n${fidelity.checks.map(check => `- ${check.passed ? '[x]' : '[ ]'} ${check.name}${check.reviewRequired ? ' — subjective review required' : ''}`).join('\n')}\n\n## Demo structure checks\n${demoChecks.filter(check => !fidelity.checks.includes(check)).map(check => `- ${check.passed ? '[x]' : '[ ]'} ${check.name}`).join('\n')}\n`
    });
  }
  await Promise.all(Object.entries(files).map(([name, content]) => writeFile(`${staging}/${name}`, content)));
  await mkdir(dirname(output), { recursive: true });
  await rm(output, { recursive: true, force: true });
  await rename(staging, output);
  return { output, files: Object.keys(files) };
}
