import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parsePrd } from '../src/parse-prd.mjs';
import { renderDemo } from '../src/render-demo.mjs';
import { writeOutput } from '../src/write-output.mjs';
import { finalizeSpecialistResult } from '../src/finalize-specialist.mjs';
import { verifySpecialistRender } from '../src/verify-specialist-render.mjs';

const require = createRequire(import.meta.url);

function deliveryError(journey, action, page, message) {
  return new Error(`Journey ${journey}${action ? ` action ${action}` : ''}${page ? ` page ${page}` : ''}: ${message}`);
}

async function listen(server) {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolveListen(); });
  });
}

async function closeServer(server) {
  if (!server?.listening) return;
  server.closeAllConnections?.();
  await new Promise(resolveClose => server.close(resolveClose));
}

function localServer(outputDir) {
  const root = resolve(outputDir);
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const requested = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (relative(root, requested).startsWith('..')) { response.writeHead(403).end(); return; }
      const body = await readFile(requested);
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
      response.setHeader('content-type', types[extname(requested)] || 'application/octet-stream');
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
}

async function launchDeliveryBrowser(browserFactory) {
  if (browserFactory) return browserFactory();
  try {
    const { chromium } = require('playwright');
    return chromium.launch({ headless: true });
  } catch {
    throw new Error('Final deliverable verification requires Playwright. Install it or provide browserFactory.');
  }
}

/** Verify the frozen baseline's core journeys against the final delivered entry. */
export async function verifyFinalDeliverableJourneys({ outputDir, url, baseline, browserFactory } = {}) {
  if (Boolean(outputDir) === Boolean(url)) throw new TypeError('Provide exactly one of outputDir or url');
  if (!baseline || !Array.isArray(baseline.coreJourneys) || !Array.isArray(baseline.actions)) throw new TypeError('A baseline with actions and coreJourneys is required');
  let server;
  let entryUrl;
  const mode = outputDir ? 'local' : 'url';
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new TypeError('Delivery URL must use HTTP/HTTPS'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new TypeError('Delivery URL must use HTTP/HTTPS');
    entryUrl = parsed.href;
  } else {
    server = localServer(outputDir);
    await listen(server);
    entryUrl = `http://127.0.0.1:${server.address().port}/index.html`;
  }
  let browser;
  let page;
  const runtimeFailures = [];
  const handlers = {
    pageerror: error => runtimeFailures.push(`page error: ${error?.message || error}`),
    console: message => { if (message.type?.() === 'error') runtimeFailures.push(`console error: ${message.text?.() || message}`); },
    requestfailed: request => {
      const failedUrl = request.url?.() || '';
      if (!/\/favicon\.ico(?:$|\?)/.test(failedUrl)) runtimeFailures.push(`failed request: ${failedUrl} ${request.failure?.()?.errorText || ''}`.trim());
    },
  };
  try {
    browser = await launchDeliveryBrowser(browserFactory);
    page = await browser.newPage();
    page.setDefaultTimeout?.(5000);
    for (const [event, handler] of Object.entries(handlers)) page.on?.(event, handler);
    const actionById = new Map(baseline.actions.map(action => [action.id, action]));
    const checks = [];
    for (const journey of baseline.coreJourneys) {
      let activeActionId = null;
      let currentPageId = journey.startPageId;
      try {
      runtimeFailures.length = 0;
      await page.goto(entryUrl, { waitUntil: 'networkidle' });
      if (runtimeFailures.length) throw deliveryError(journey.id, null, journey.startPageId, runtimeFailures.join('; '));
      const start = page.locator(`[data-page-id="${journey.startPageId}"]:not([hidden])`);
      if (await start.count() !== 1 || !await start.isVisible()) throw deliveryError(journey.id, null, journey.startPageId, 'start page is not uniquely visible');
      checks.push(`${journey.id}:start:${currentPageId}`);
      for (const actionId of journey.actionIds) {
        activeActionId = actionId;
        const action = actionById.get(actionId);
        if (!action) throw deliveryError(journey.id, actionId, currentPageId, 'missing baseline action');
        const control = page.locator(`[data-page-id="${currentPageId}"]:not([hidden]) [data-action-id="${actionId}"]`);
        const count = await control.count();
        if (count === 0) throw deliveryError(journey.id, actionId, currentPageId, 'missing action control');
        if (count !== 1) throw deliveryError(journey.id, actionId, currentPageId, `duplicate action controls (${count})`);
        if (!await control.isVisible()) throw deliveryError(journey.id, actionId, currentPageId, 'hidden action control');
        if (!await control.isEnabled()) throw deliveryError(journey.id, actionId, currentPageId, 'disabled action control');
        const kind = await control.getAttribute?.('data-kind');
        if (kind === 'notice' || kind === 'static') throw deliveryError(journey.id, actionId, currentPageId, `${kind} action control is not interactive`);
        await control.click();
        if (runtimeFailures.length) throw deliveryError(journey.id, actionId, currentPageId, runtimeFailures.join('; '));
        const target = page.locator(`[data-page-id="${action.toPageId}"]:not([hidden])`);
        if (await target.count() !== 1 || !await target.isVisible()) throw deliveryError(journey.id, actionId, action.toPageId, 'expected target page is not uniquely visible');
        const previous = page.locator(`[data-page-id="${currentPageId}"]:not([hidden])`);
        if (currentPageId !== action.toPageId && await previous.count() !== 0) throw deliveryError(journey.id, actionId, currentPageId, 'previous page remains visible');
        currentPageId = action.toPageId;
        checks.push(`${journey.id}:${actionId}:${currentPageId}`);
      }
      if (currentPageId !== journey.expectedEndPageId) throw deliveryError(journey.id, null, currentPageId, `expected end page ${journey.expectedEndPageId}`);
      } catch (error) {
        if (String(error?.message).startsWith(`Journey ${journey.id}`)) throw error;
        throw deliveryError(journey.id, activeActionId, currentPageId, error?.message || String(error));
      }
    }
    return { status: 'passed', mode, journeys: baseline.coreJourneys.map(({ id }) => id), checks };
  } finally {
    if (page) {
      for (const [event, handler] of Object.entries(handlers)) page.off?.(event, handler);
      await page.close?.();
    }
    await browser?.close?.();
    await closeServer(server);
  }
}

async function readDownload(download) {
  return JSON.parse(await readFile(await download.path(), 'utf8'));
}

export async function runBrowserE2E() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    throw new Error('Browser E2E requires Playwright. Install it or expose it through NODE_PATH.');
  }
  const work = await mkdtemp(join(tmpdir(), 'prd-demo-browser-'));
  const output = join(work, 'output');
  const source = await readFile(new URL('../fixtures/simple-prd.md', import.meta.url), 'utf8');
  const manifest = parsePrd(source);
  manifest.routing = { selected: 'local', reason: 'browser-e2e', handoff: 'local-fast-path' };
  await writeOutput({ outDir: output, html: renderDemo(manifest), manifest });
  const specialistSource = join(work, 'specialist-source');
  const specialistOutput = join(work, 'specialist-output');
  await mkdir(specialistSource, { recursive: true });
  await writeFile(join(specialistSource, 'index.html'), '<!doctype html><html><head><style>.specialist{color:rgb(220,0,0)}</style></head><body><button class="specialist">专业按钮</button><div id="app"></div><script>setTimeout(()=>{document.querySelector("#app").innerHTML="<button>动态专业按钮</button>"},100)</script></body></html>');
  const criteria = ['visual evidence priority', 'generation gating', 'structured demo context', 'facts, inferences and gaps'];
  await finalizeSpecialistResult({ sourceDir: specialistSource, outDir: specialistOutput, handoff: {
    routing: { selected: 'pm-kakaxi' }, requirements: { title: '高保真结果' },
    specialistEvidence: criteria.map(criterion => ({ criterion, evidence: `browser fixture: ${criterion}` }))
  } });
  const specialistQuality = await verifySpecialistRender({ deliveryDir: specialistOutput, waitMs: 180 });
  assert.equal(specialistQuality.status, 'completed');
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const file = pathname === '/specialist' ? join(specialistOutput, 'index.html') : pathname === '/specialist-original' ? join(specialistOutput, 'index.original.html') : join(output, 'index.html');
    if (!['/', '/index.html', '/specialist', '/specialist-original'].includes(pathname)) { response.writeHead(404).end(); return; }
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(await readFile(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await assert.doesNotReject(() => page.waitForSelector('[data-page-id="pending-list"]:not([hidden])'));

    await page.locator('#review-scenario').selectOption('empty-state');
    assert.equal(await page.locator('#current-page-label').textContent(), '暂无内容');
    await page.locator('#review-scenario').selectOption('pending-list');

    await page.getByRole('button', { name: '去审核' }).click();
    assert.equal(await page.locator('#current-page-label').textContent(), '审核确认');

    await page.getByRole('button', { name: '编辑', exact: true }).click();
    const title = page.locator('[data-proto-key="review.title"]');
    await title.click();
    await page.locator('#edit-text').fill('确认审核内容');
    await page.locator('#edit-text').press('Tab');
    assert.equal(await title.textContent(), '确认审核内容');

    await page.locator('#undo-edit').click();
    assert.equal(await title.textContent(), '审核确认');
    await page.locator('#redo-edit').click();
    assert.equal(await title.textContent(), '确认审核内容');

    await page.locator('#agent-request').fill('增加审核失败后的重新提交入口');
    await page.locator('#agent-submit').click();
    assert.equal(await page.locator('#agent-status').textContent(), '修改任务已保存');

    const patchDownload = page.waitForEvent('download');
    await page.locator('#export-patches').click();
    const patches = await readDownload(await patchDownload);
    assert.equal(patches.patches['review.title'].text, '确认审核内容');

    const commentDownload = page.waitForEvent('download');
    await page.locator('#export-comments').click();
    const comments = await readDownload(await commentDownload);
    assert.equal(comments.comments[0].protoKey, 'review.title');
    assert.match(comments.comments[0].request, /重新提交/);

    await page.reload();
    assert.equal(await page.locator('[data-proto-key="review.title"]').textContent(), '确认审核内容');

    await page.goto(`http://127.0.0.1:${server.address().port}/specialist-original`);
    await page.waitForTimeout(180);
    const originalPixels = await page.screenshot();
    await page.goto(`http://127.0.0.1:${server.address().port}/specialist`);
    await page.waitForTimeout(180);
    assert.equal(await page.locator('#proto-edit-ui').isHidden(), true);
    assert.deepEqual(await page.screenshot(), originalPixels);
    await page.goto(`http://127.0.0.1:${server.address().port}/specialist?edit=1`);
    const specialistButton = page.getByRole('button', { name: '专业按钮', exact: true });
    assert.equal(await specialistButton.evaluate(element => getComputedStyle(element).color), 'rgb(220, 0, 0)');
    await page.locator('#proto-edit-toggle').click();
    await specialistButton.click();
    await page.locator('#proto-edit-text').fill('已编辑专业按钮');
    await page.locator('#proto-edit-text').press('Tab');
    assert.equal(await page.getByRole('button', { name: '已编辑专业按钮', exact: true }).textContent(), '已编辑专业按钮');
    await page.reload();
    assert.equal(await page.getByRole('button', { name: '已编辑专业按钮', exact: true }).textContent(), '已编辑专业按钮');
    await page.locator('#proto-edit-toggle').click();
    const dynamicButton = page.getByRole('button', { name: '动态专业按钮' });
    await dynamicButton.click();
    assert.match(await page.locator('#proto-selected-key').textContent(), /^specialist\./);
    return { passed: true, checks: ['scenario-switch', 'navigation', 'edit', 'undo', 'redo', 'agent-comment', 'patch-export', 'comment-export', 'reload-persistence', 'specialist-default-ui-hidden', 'specialist-pixel-preservation', 'specialist-style-preservation', 'specialist-direct-edit', 'specialist-reload-persistence', 'specialist-dynamic-dom', 'specialist-quality-completed-after-render-verification'] };
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const delivery = process.argv.includes('--verify-delivery');
  const operation = delivery
    ? async () => {
        const baselinePath = process.env.DELIVERY_BASELINE || process.argv.find(value => value.startsWith('--baseline='))?.slice(11) || 'execution-baseline.json';
        const baseline = JSON.parse(await readFile(resolve(baselinePath), 'utf8'));
        const suppliedUrl = process.env.DELIVERY_URL;
        const suppliedOutput = process.env.DELIVERY_OUTPUT_DIR || process.argv.find(value => value.startsWith('--output-dir='))?.slice(13) || 'output';
        return verifyFinalDeliverableJourneys({ ...(suppliedUrl ? { url: suppliedUrl } : { outputDir: suppliedOutput }), baseline });
      }
    : runBrowserE2E;
  operation().then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
