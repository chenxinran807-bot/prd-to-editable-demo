import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parsePrd } from '../src/parse-prd.mjs';
import { renderDemo } from '../src/render-demo.mjs';
import { writeOutput } from '../src/write-output.mjs';
import { finalizeSpecialistResult } from '../src/finalize-specialist.mjs';

const require = createRequire(import.meta.url);

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
  await finalizeSpecialistResult({ sourceDir: specialistSource, outDir: specialistOutput, handoff: { routing: { selected: 'pm-kakaxi' }, requirements: { title: '高保真结果' } } });
  const server = createServer(async (request, response) => {
    const file = request.url === '/specialist' ? join(specialistOutput, 'index.html') : join(output, 'index.html');
    if (!['/', '/index.html', '/specialist'].includes(request.url)) { response.writeHead(404).end(); return; }
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

    await page.goto(`http://127.0.0.1:${server.address().port}/specialist`);
    const specialistButton = page.getByRole('button', { name: '专业按钮' });
    assert.equal(await specialistButton.evaluate(element => getComputedStyle(element).color), 'rgb(220, 0, 0)');
    await page.locator('#proto-edit-toggle').click();
    await specialistButton.click();
    await page.locator('#proto-edit-text').fill('已编辑专业按钮');
    await page.locator('#proto-edit-text').press('Tab');
    assert.equal(await page.getByRole('button', { name: '已编辑专业按钮' }).textContent(), '已编辑专业按钮');
    await page.reload();
    assert.equal(await page.getByRole('button', { name: '已编辑专业按钮' }).textContent(), '已编辑专业按钮');
    await page.locator('#proto-edit-toggle').click();
    const dynamicButton = page.getByRole('button', { name: '动态专业按钮' });
    await dynamicButton.click();
    assert.match(await page.locator('#proto-selected-key').textContent(), /^specialist\./);
    return { passed: true, checks: ['navigation', 'edit', 'undo', 'redo', 'agent-comment', 'patch-export', 'comment-export', 'reload-persistence', 'specialist-style-preservation', 'specialist-direct-edit', 'specialist-reload-persistence', 'specialist-dynamic-dom'] };
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runBrowserE2E().then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
