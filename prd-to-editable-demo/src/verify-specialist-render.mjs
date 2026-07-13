import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export async function verifySpecialistRender({ deliveryDir, waitMs = 300, viewport = { width: 390, height: 844 } }) {
  const root = resolve(deliveryDir);
  let chromium;
  try { ({ chromium } = require('playwright')); } catch {
    throw new Error('verify-specialist requires Playwright; expose it through NODE_PATH or install it in the Agent runtime');
  }
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
      const file = pathname === '/original' ? `${root}/index.original.html` : `${root}/index.html`;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/original`); await page.waitForTimeout(waitMs);
    const original = await page.screenshot();
    await page.goto(base); await page.waitForTimeout(waitMs);
    const editable = await page.screenshot();
    const editorHiddenByDefault = await page.locator('#proto-edit-ui').isHidden();
    await page.goto(`${base}/?edit=1`);
    const editorVisibleOnDemand = await page.locator('#proto-edit-ui').isVisible();
    const pixelIdentical = original.equals(editable);
    const qualityPath = `${root}/quality-report.json`;
    const manifestPath = `${root}/prototype.manifest.json`;
    const quality = JSON.parse(await readFile(qualityPath, 'utf8'));
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const renderPreservation = {
      status: pixelIdentical && editorHiddenByDefault && editorVisibleOnDemand ? 'verified' : 'failed',
      viewport, waitMs, pixelIdentical, editorHiddenByDefault, editorVisibleOnDemand,
      originalSha256: createHash('sha256').update(original).digest('hex'),
      editableDefaultSha256: createHash('sha256').update(editable).digest('hex')
    };
    const complete = quality.specialistBaseline.missing.length === 0 && renderPreservation.status === 'verified';
    quality.renderPreservation = renderPreservation;
    quality.status = complete ? 'completed' : 'review-required';
    manifest.routing.status = quality.status;
    manifest.routing.handoff = `${quality.status}-by-${quality.specialist}`;
    await writeFile(qualityPath, `${JSON.stringify(quality, null, 2)}\n`);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return quality;
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise(done => server.close(done));
  }
}
