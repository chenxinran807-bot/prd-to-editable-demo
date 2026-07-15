import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyFinalDeliverableJourneys } from '../scripts/browser-e2e.mjs';
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

function fakeBrowserFactory(state = {}) {
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
          const source = await (await fetch(url)).text();
          pages = [...source.matchAll(/<section[^>]*data-page-id="([^"]+)"([^>]*)>([\s\S]*?)<\/section>/g)].map(match => ({ id: match[1], hidden: /\bhidden\b/.test(match[2]), body: match[3] }));
          current = pages.find(page => !page.hidden)?.id;
          if (source.includes('throw new Error')) emit('pageerror', new Error('fixture boom'));
        },
        locator(selector) {
          const pageMatch = selector.match(/data-page-id="([^"]+)"/);
          const actionMatch = selector.match(/data-action-id="([^"]+)"/);
          const matches = () => {
            if (!actionMatch) return pages.filter(page => page.id === pageMatch?.[1] && (!selector.includes(':not([hidden])') || page.id === current));
            const page = pages.find(item => item.id === (pageMatch?.[1] || current) && item.id === current);
            if (!page) return [];
            const regex = new RegExp(`<button([^>]*data-action-id="${actionMatch[1]}"[^>]*)>`, 'g');
            return [...page.body.matchAll(regex)].map(match => ({ attrs: match[1], target: match[1].match(/data-target="([^"]+)"/)?.[1] }));
          };
          return {
            count: async () => matches().length,
            isVisible: async () => matches().length === 1 && !/\bhidden\b/.test(matches()[0]?.attrs || ''),
            isEnabled: async () => !/\bdisabled\b/.test(matches()[0]?.attrs || ''),
            getAttribute: async name => matches()[0]?.attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null,
            click: async () => { const item = matches()[0]; if (item?.target) current = item.target; },
          };
        },
        async close() { state.pageClosed = true; },
      };
    },
    async close() { state.browserClosed = true; },
  });
}

async function fixtureRun(markup, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'delivery-test-'));
  await writeFile(join(dir, 'index.html'), markup);
  try { return await verifyFinalDeliverableJourneys({ outputDir: dir, baseline, browserFactory: fakeBrowserFactory(options.state) }); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test('passes a complete local core journey including a return action without publishing', async () => {
  const state = {};
  const result = await fixtureRun(html(), { state });
  assert.deepEqual(result.journeys, ['round-trip']);
  assert.equal(result.status, 'passed');
  assert.equal(result.mode, 'local');
  assert.match(state.urls[0], /^http:\/\/127\.0\.0\.1:/);
  assert.equal(state.browserClosed, true);
  assert.equal(state.pageClosed, true);
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
