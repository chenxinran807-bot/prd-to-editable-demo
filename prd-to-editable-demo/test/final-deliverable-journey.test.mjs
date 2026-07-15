import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStaticServer, resolveStaticFile, verifyFinalDeliverableJourneys, runBrowserE2E } from '../scripts/browser-e2e.mjs';
import { renderDemo } from '../src/render-demo.mjs';

const baseline = {
  actions: [
    { id: 'next', fromPageId: 'start', toPageId: 'done' },
    { id: 'back', fromPageId: 'done', toPageId: 'start' },
  ],
  coreJourneys: [{ id: 'round-trip', startPageId: 'start', actionIds: ['next', 'back'], expectedEndPageId: 'start' }],
};

function html({ next = '', script = '' } = {}) {
  return `<!doctype html><section data-page-id="start"><button data-action-id="next" data-target="done" ${next}>Next</button></section><section data-page-id="done" hidden><button data-action-id="back" data-target="start">Back</button></section>${script}`;
}

function fakeBrowserFactory(state = {}, source = html()) {
  return async () => ({
    async newPage() {
      const listeners = new Map(); let pages = []; let current;
      const emit = (name, value) => listeners.get(name)?.forEach(fn => fn(value));
      return {
        on(name, fn) { listeners.set(name, [...(listeners.get(name) || []), fn]); },
        off(name, fn) { listeners.set(name, (listeners.get(name) || []).filter(item => item !== fn)); },
        setDefaultTimeout() {},
        async goto(url) {
          state.urls = [...(state.urls || []), url];
          pages = state.virtualPages ? structuredClone(state.virtualPages) : [...source.matchAll(/<section[^>]*data-page-id="([^"]+)"([^>]*)>([\s\S]*?)<\/section>/g)].map(match => ({ id: match[1], visible: !/\bhidden\b/.test(match[2]), body: match[3] }));
          current = pages.find(page => page.visible)?.id;
          if (source.includes('throw new Error')) emit('pageerror', new Error('fixture boom'));
          if (source.includes('console.error')) emit('console', { type: () => 'error', text: () => 'console boom' });
          if (source.includes('fail-resource')) emit('requestfailed', { url: () => 'http://local.test/fail-resource.js', failure: () => ({ errorText: 'blocked' }) });
          if (source.includes('fail-favicon')) emit('requestfailed', { url: () => 'http://local.test/favicon.ico', failure: () => ({ errorText: 'missing' }) });
        },
        locator(selector) {
          if (selector === '#interaction-status') return { count: async () => state.feedback === undefined ? 0 : 1, isVisible: async () => state.feedback !== undefined, textContent: async () => state.feedback ?? '', getAttribute: async name => name === 'data-last-action' ? state.lastAction ?? null : null };
          if (selector.includes('.status-chip')) return { count: async () => state.chipState === undefined ? 0 : 1, textContent: async () => state.chipState ?? '', getAttribute: async name => name === 'data-state-change' ? state.chipMarker ?? null : null };
          const decode = value => value?.replace(/\\([0-9a-f]+) /gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));
          const pageMatch = selector.match(/data-page-id="((?:\\.|[^"])*)"/);
          const actionMatch = selector.match(/data-action-id="((?:\\.|[^"])*)"/);
          const pageId = decode(pageMatch?.[1]); const actionId = decode(actionMatch?.[1]);
          const matches = () => {
            if (!actionMatch) return pages.filter(page => page.id === pageId && (!selector.includes(':not([hidden])') || page.visible)).map(page => ({ ...page, attrs: page.stateChange ? `data-state-change="${page.stateChange}"` : '' }));
            const page = pages.find(item => item.id === (pageId || current) && item.visible);
            if (!page) return [];
            if (page.controls) return page.controls.filter(control => control.id === actionId).map(control => ({ attrs: control.attrs || '', target: control.target }));
            const regex = new RegExp(`<button([^>]*data-action-id="${actionId}"[^>]*)>`, 'g');
            return [...page.body.matchAll(regex)].map(match => ({ attrs: match[1], target: match[1].match(/data-target="([^"]+)"/)?.[1] }));
          };
          return {
            count: async () => matches().length,
            isVisible: async () => matches().length === 1 && !/\bhidden\b/.test(matches()[0]?.attrs || ''),
            isEnabled: async () => !/\bdisabled\b/.test(matches()[0]?.attrs || ''),
            getAttribute: async name => matches()[0]?.attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null,
            click: async () => {
              const item = matches()[0]; if (item?.target) { pages.forEach(page => page.visible = page.id === item.target); current = item.target; }
              const feedback = item?.attrs?.match(/data-visible-feedback="([^"]+)"/)?.[1]; const change = item?.attrs?.match(/data-state-change="([^"]+)"/)?.[1]; const id = item?.attrs?.match(/data-action-id="([^"]+)"/)?.[1];
              if (feedback && !state.noFeedback) { state.feedback = state.wrongFeedback ?? feedback; state.lastAction = state.wrongLastAction ?? id; }
              if (change && !state.noState) { const page = pages.find(page => page.id === item.target); if (page) page.stateChange = state.wrongState ?? change; state.chipState = state.wrongState ?? change; state.chipMarker = state.wrongState ?? change; }
              if (state.delayedFailure) {
                if (state.delayedFailure === 'request') emit('request', {});
                setTimeout(() => {
                  if (state.delayedFailure === 'console') emit('console', { type: () => 'error', text: () => 'delayed console' });
                  if (state.delayedFailure === 'page') emit('pageerror', new Error('delayed page'));
                  if (state.delayedFailure === 'request') emit('requestfailed', { url: () => 'http://local.test/delayed.js', failure: () => ({ errorText: 'late failure' }) });
                }, 2);
              }
            },
          };
        },
        async close() { state.pageClosed = true; if (state.rejectPageClose) throw new Error('page close failed'); },
      };
    },
    async close() { state.browserClosed = true; if (state.rejectBrowserClose) throw new Error('browser close failed'); },
  });
}

async function fixtureRun(markup, options = {}) {
  const state = options.state || {};
  return verifyFinalDeliverableJourneys({
    outputDir: '/fixed-deliverable', baseline: options.baseline || baseline,
    browserFactory: fakeBrowserFactory(state, markup),
    localUrlFactory: options.localUrlFactory || (() => ({ start: async () => 'http://local.test/index.html', close: async () => { state.serverClosed = true; } })),
    quietWindowMs: options.quietWindowMs ?? 5,
  });
}

test('passes a complete local core journey including a return action without publishing', async () => {
  const state = {};
  const result = await fixtureRun(html(), { state });
  assert.deepEqual(result.journeys, ['round-trip']);
  assert.equal(result.status, 'passed');
  assert.equal(result.mode, 'local');
  assert.equal(state.urls[0], 'http://local.test/index.html');
  assert.equal(state.browserClosed, true);
  assert.equal(state.pageClosed, true);
  assert.equal(state.serverClosed, true);
  assert.deepEqual(result.checks, ['round-trip:start:start', 'round-trip:next:done', 'round-trip:back:start']);
});

test('verifies visible feedback, last action, and target state outcomes after click', async () => {
  const outcomeBaseline = { actions: [{ id: 'next', fromPageId: 'start', toPageId: 'done', trigger: 'click', visibleFeedback: 'Saved', stateChange: 'complete' }], coreJourneys: [{ id: 'outcome', startPageId: 'start', actionIds: ['next'], expectedEndPageId: 'done' }] };
  const markup = html({ next: 'data-trigger="click" data-visible-feedback="Saved" data-state-change="complete"' });
  assert.equal((await fixtureRun(markup, { baseline: outcomeBaseline })).status, 'passed');
  for (const [state, pattern] of [[{ noFeedback: true }, /feedback/i], [{ wrongFeedback: 'Wrong' }, /feedback/i], [{ wrongLastAction: 'other' }, /last action/i], [{ noState: true }, /state change/i], [{ wrongState: 'wrong' }, /state change/i]]) await assert.rejects(() => fixtureRun(markup, { baseline: outcomeBaseline, state }), pattern);
});

for (const [name, transform, pattern] of [
  ['notice/static action', source => source.replace('data-target="done"', 'data-target="done" data-kind="notice"'), /round-trip.*next.*notice/i],
  ['missing action', source => source.replace('data-action-id="next"', 'data-action-id="other"'), /round-trip.*next.*missing/i],
  ['disabled action', source => source.replace('data-target="done"', 'data-target="done" disabled'), /round-trip.*next.*disabled/i],
  ['hidden action', source => source.replace('data-target="done"', 'data-target="done" hidden'), /round-trip.*next.*hidden/i],
  ['duplicate action', source => source.replace('</button></section>', '</button><button data-action-id="next" data-target="done">Again</button></section>'), /round-trip.*next.*duplicate/i],
  ['wrong target', source => source.replace('data-target="done"', 'data-target="start"'), /round-trip.*next.*done/i],
]) test(`fails ${name} with journey diagnostics`, async () => {
  await assert.rejects(() => fixtureRun(transform(html())), pattern);
});

test('fails JavaScript page errors and still cleans up browser resources', async () => {
  const state = {};
  await assert.rejects(() => fixtureRun(html({ script: '<script>throw new Error("fixture boom")</script>' }), { state }), /page error.*fixture boom/i);
  assert.equal(state.browserClosed, true);
  assert.equal(state.pageClosed, true);
  assert.equal(state.serverClosed, true);
});

test('fails console errors and failed core requests but documents favicon as benign', async () => {
  await assert.rejects(() => fixtureRun(html({ script: '<script>console.error("console boom")</script>' })), /console error.*console boom/i);
  await assert.rejects(() => fixtureRun(html({ script: '<script src="fail-resource.js"></script>' })), /failed request.*fail-resource/i);
  assert.equal((await fixtureRun(html({ script: '<link rel="icon" href="fail-favicon">' }))).status, 'passed');
});

for (const [kind, pattern] of [['console', /delayed console/i], ['page', /delayed page/i], ['request', /delayed\.js/i]]) {
  test(`waits for delayed ${kind} failures after an action`, async () => {
    await assert.rejects(() => fixtureRun(html(), { state: { delayedFailure: kind }, quietWindowMs: 10 }), pattern);
  });
}

test('supports explicit HTTPS URL mode without local setup', async () => {
  const result = await verifyFinalDeliverableJourneys({ url: 'https://delivery.test/demo', baseline, browserFactory: fakeBrowserFactory({}, html()) });
  assert.equal(result.mode, 'url');
});

test('does not mutate the baseline', async () => {
  const input = structuredClone(baseline); const before = structuredClone(input);
  await fixtureRun(html(), { baseline: input });
  assert.deepEqual(input, before);
});

test('closes local lifecycle on verification and listen/setup failures', async () => {
  const failed = {};
  await assert.rejects(() => fixtureRun(html({ next: 'disabled' }), { state: failed }), /disabled/i);
  assert.equal(failed.serverClosed, true);
  const created = { closed: false };
  await assert.rejects(() => fixtureRun(html(), { localUrlFactory: () => ({ start: async () => { throw new Error('listen failed'); }, close: async () => { created.closed = true; } }) }), /listen failed/);
  assert.equal(created.closed, true);
});

test('attempts every cleanup and preserves the primary verification error', async () => {
  const cleanupFailure = { rejectPageClose: true, rejectBrowserClose: true };
  await assert.rejects(() => fixtureRun(html(), { state: cleanupFailure }), /page close failed.*browser close failed/i);
  assert.equal(cleanupFailure.pageClosed, true);
  assert.equal(cleanupFailure.browserClosed, true);
  assert.equal(cleanupFailure.serverClosed, true);

  const primary = { rejectPageClose: true, rejectBrowserClose: true };
  await assert.rejects(() => fixtureRun(html({ next: 'disabled' }), { state: primary }), /disabled action control/i);
  assert.equal(primary.browserClosed, true);
  assert.equal(primary.serverClosed, true);
});

test('canonical static resolution serves directory indexes and rejects symlink escape', async () => {
  const root = await mkdtemp(join(tmpdir(), 'delivery-root-'));
  const outside = await mkdtemp(join(tmpdir(), 'delivery-secret-'));
  try {
    await mkdir(join(root, 'nested'));
    await writeFile(join(root, 'nested', 'index.html'), 'safe');
    await writeFile(join(outside, 'secret.txt'), 'must-not-leak');
    await symlink(join(outside, 'secret.txt'), join(root, 'secret-link'));
    assert.equal(await readFile(await resolveStaticFile(root, '/nested/'), 'utf8'), 'safe');
    await assert.rejects(() => resolveStaticFile(root, '/secret-link'), error => error.statusCode === 403 && /symlink/i.test(error.message));
    const server = createStaticServer(root);
    const response = { status: 200, body: '', writeHead(status) { this.status = status; return this; }, end(body = '') { this.body += body; this.done?.(); } };
    await new Promise(resolveResponse => { response.done = resolveResponse; server.emit('request', { url: '/secret-link' }, response); });
    assert.equal(response.status, 403);
    assert.equal(response.body, '');
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('escapes metacharacters in page and action IDs', async () => {
  const start = 'start"\\[x]'; const done = 'done]"\\'; const action = 'go"\\[]';
  const special = { actions: [{ id: action, fromPageId: start, toPageId: done }], coreJourneys: [{ id: 'special', startPageId: start, actionIds: [action], expectedEndPageId: done }] };
  const state = { virtualPages: [{ id: start, visible: true, controls: [{ id: action, target: done }] }, { id: done, visible: false, controls: [] }] };
  const result = await fixtureRun('', { baseline: special, state });
  assert.equal(result.status, 'passed');
});

test('rejects missing or duplicate start and missing final target pages', async () => {
  await assert.rejects(() => fixtureRun(html().replace('data-page-id="start"', 'data-page-id="other"')), /round-trip.*start.*start page/i);
  const duplicate = html().replace('</button></section>', '</button></section><section data-page-id="start">Duplicate</section>');
  await assert.rejects(() => fixtureRun(duplicate), /round-trip.*start.*uniquely visible/i);
  await assert.rejects(() => fixtureRun(html().replace('data-page-id="done"', 'data-page-id="gone"')), /round-trip.*next.*done/i);
  const wrongEnd = structuredClone(baseline); wrongEnd.coreJourneys[0].expectedEndPageId = 'done';
  await assert.rejects(() => fixtureRun(html(), { baseline: wrongEnd }), /round-trip.*start.*expected end page done/i);
});

test('preserves the legacy browser E2E export and entry path', async () => {
  assert.equal(typeof runBrowserE2E, 'function');
  assert.match(await readFile(new URL('../scripts/browser-e2e.mjs', import.meta.url), 'utf8'), /export async function runBrowserE2E/);
});

test('requires exactly one local directory or explicit valid HTTP URL', async () => {
  await assert.rejects(() => verifyFinalDeliverableJourneys({ baseline, browserFactory: fakeBrowserFactory() }), /exactly one/i);
  await assert.rejects(() => verifyFinalDeliverableJourneys({ outputDir: '.', url: 'https://example.test', baseline, browserFactory: fakeBrowserFactory() }), /exactly one/i);
  await assert.rejects(() => verifyFinalDeliverableJourneys({ url: 'file:///tmp/index.html', baseline, browserFactory: fakeBrowserFactory() }), /http\/https/i);
});

test('renderDemo emits stable data-action-id hooks', () => {
  const rendered = renderDemo({ id: 'x', product: { name: 'X' }, startPage: 'start', pages: [{ id: 'start', title: 'Start', state: 'default', elements: [{ key: 'go', type: 'button', text: 'Go', actionId: 'act-1', action: { type: 'navigate', target: 'start' } }] }] });
  assert.match(rendered, /data-action-id="act-1"/);
});
