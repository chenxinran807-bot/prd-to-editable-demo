import { mkdir, rm, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { verifyDemo } from './verify-demo.mjs';

export async function writeOutput({ outDir, html, manifest }) {
  const output = resolve(outDir);
  const staging = `${output}.staging`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  verifyDemo({ html, manifest });
  const summary = `# ${manifest.product.name} 演示说明\n\n- 起始页面：${manifest.pages.find(page => page.id === manifest.startPage)?.title}\n- 页面数量：${manifest.pages.length}\n- 使用方式：预览模式体验流程；编辑模式点选元素直接修改。\n- 路由结果：${manifest.routing?.selected || 'local'}\n- 路由说明：${manifest.routing?.reason || '默认本地快速路径'}\n- 专业接管：${manifest.routing?.handoff || 'local-fast-path'}\n`;
  const assumptions = `# 推断与缺口\n\n## 推断\n${manifest.assumptions.map(item => `- ${item.statement}`).join('\n') || '- 无'}\n\n## 缺口\n${manifest.gaps.map(item => `- ${item.statement}`).join('\n') || '- 无'}\n`;
  const files = {
    'index.html': html,
    'prototype.manifest.json': JSON.stringify(manifest, null, 2),
    'demo-context.json': JSON.stringify(manifest.demoContext ?? {}, null, 2),
    'design-profile.json': JSON.stringify(manifest.designCore ?? {}, null, 2),
    'prototype.patches.json': JSON.stringify({ schemaVersion: 1, manifestId: manifest.id, patches: {} }, null, 2),
    'agent-comments.json': JSON.stringify({ schemaVersion: 1, manifestId: manifest.id, comments: [] }, null, 2),
    'demo-summary.md': summary,
    'assumptions.md': assumptions
  };
  await Promise.all(Object.entries(files).map(([name, content]) => writeFile(`${staging}/${name}`, content)));
  await mkdir(dirname(output), { recursive: true });
  await rm(output, { recursive: true, force: true });
  await rename(staging, output);
  return { output, files: Object.keys(files) };
}
