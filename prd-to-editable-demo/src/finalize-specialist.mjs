import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { adaptSpecialistHtml } from './adapt-specialist.mjs';

async function listFiles(root, prefix = '') {
  const entries = await readdir(`${root}/${prefix}`, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(root, relative)); else files.push(relative);
  }
  return files;
}

export async function finalizeSpecialistResult({ sourceDir, outDir, handoff }) {
  const source = resolve(sourceDir);
  const output = resolve(outDir);
  if (source === output || output.startsWith(`${source}/`)) throw new Error('output must be outside the specialist source directory');
  const staging = `${output}.staging`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  await cp(source, staging, { recursive: true });
  const sourceFiles = await listFiles(source);
  const sourceBundleExact = (await Promise.all(sourceFiles.map(async file => {
    const [before, copied] = await Promise.all([readFile(`${source}/${file}`), readFile(`${staging}/${file}`)]);
    return before.equals(copied);
  }))).every(Boolean);
  const original = await readFile(`${staging}/index.html`, 'utf8');
  const specialist = handoff.routing?.selected ?? 'specialist';
  const manifestId = `${specialist}-${basename(source)}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  const parity = JSON.parse(await readFile(new URL('../references/capability-parity.json', import.meta.url), 'utf8'));
  const criteria = parity.specialists[specialist]?.mustPreserve ?? [];
  const evidence = new Map((handoff.specialistEvidence ?? []).map(item => [item.criterion, item.evidence]));
  const missing = criteria.length ? criteria.filter(criterion => typeof evidence.get(criterion) !== 'string' || !evidence.get(criterion).trim()) : ['unrecognized specialist baseline'];
  const status = 'review-required';
  const manifest = {
    schemaVersion: 1, id: manifestId,
    product: { name: handoff.requirements?.title ?? '专业原型', goal: handoff.requirements?.goal ?? '完成专业原型评审' },
    requirements: handoff.requirements ?? {},
    routing: { ...handoff.routing, selected: specialist, status, handoff: `${status}-by-${specialist}` },
    specialistArtifact: { editable: 'index.html', original: 'index.original.html', preservation: 'source bundle copied without replacement' }
  };
  await writeFile(`${staging}/index.original.html`, original);
  await writeFile(`${staging}/index.html`, adaptSpecialistHtml(original, { manifestId, specialist }));
  await writeFile(`${staging}/prototype.manifest.json`, JSON.stringify(manifest, null, 2));
  await writeFile(`${staging}/prototype.patches.json`, JSON.stringify({ schemaVersion: 1, manifestId, patches: {} }, null, 2));
  await writeFile(`${staging}/agent-comments.json`, JSON.stringify({ schemaVersion: 1, manifestId, comments: [] }, null, 2));
  const qualityReport = {
    schemaVersion: 1, specialist, status,
    preservation: { sourceBundleExact, originalHtmlExact: original === await readFile(`${staging}/index.original.html`, 'utf8'), editableLayerInjected: true },
    specialistBaseline: {
      criteria,
      verified: criteria.filter(criterion => !missing.includes(criterion)).map(criterion => ({ criterion, evidence: evidence.get(criterion) })),
      missing
    },
    renderPreservation: { status: 'pending', reason: 'run verify-specialist after finalization' }
  };
  await writeFile(`${staging}/quality-report.json`, JSON.stringify(qualityReport, null, 2));
  await writeFile(`${staging}/demo-summary.md`, `# 专业原型统一交付\n\n- 专业能力：${specialist}\n- 验收状态：${status}\n- 演示版本：index.html（默认不显示编辑工具，保持专业原型视觉）\n- 编辑入口：在地址后添加 \`?edit=1\`，或按 Alt+Shift+E\n- 原始版本：index.original.html\n- 处理原则：保留专业产物与素材，只注入按需启用的编辑和反馈层。\n- 专业基线证据：quality-report.json\n`);
  await rm(output, { recursive: true, force: true });
  await rename(staging, output);
  return { output, files: await listFiles(output) };
}
