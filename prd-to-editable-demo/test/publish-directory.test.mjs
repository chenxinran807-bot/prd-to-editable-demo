import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as fs from 'node:fs/promises';
import { publishDirectory } from '../src/publish-directory.mjs';

test('preserves the old deliverable when writing the candidate fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'publish-fail-')); const out = join(root, 'out');
  await mkdir(out); await writeFile(join(out, 'index.html'), 'old');
  await assert.rejects(publishDirectory(out, async dir => { await writeFile(join(dir, 'index.html'), 'new'); throw new Error('write failed'); }));
  assert.equal(await readFile(join(out, 'index.html'), 'utf8'), 'old');
});

test('rolls back the old deliverable when final rename fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'publish-rename-')); const out = join(root, 'out');
  await mkdir(out); await writeFile(join(out, 'index.html'), 'old');
  let renames = 0;
  const operations = { ...fs, rename: async (...args) => { renames++; if (renames === 2) throw new Error('rename failed'); return fs.rename(...args); } };
  await assert.rejects(publishDirectory(out, dir => writeFile(join(dir, 'index.html'), 'new'), { fs: operations }));
  assert.equal(await readFile(join(out, 'index.html'), 'utf8'), 'old');
});

test('success replaces stale files and concurrent calls use separate candidates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'publish-success-')); const out = join(root, 'out');
  await mkdir(out); await writeFile(join(out, 'stale.txt'), 'stale');
  const seen = [];
  await Promise.all([1, 2].map(number => publishDirectory(join(root, `out-${number}`), async dir => { seen.push(dir); await writeFile(join(dir, 'index.html'), String(number)); })));
  assert.notEqual(seen[0], seen[1]);
  await publishDirectory(out, dir => writeFile(join(dir, 'index.html'), 'fresh'));
  await assert.rejects(readFile(join(out, 'stale.txt'), 'utf8'));
  assert.equal(await readFile(join(out, 'index.html'), 'utf8'), 'fresh');
});

test('concurrent publication to the same output leaves one complete candidate and no swap debris', async () => {
  const root = await mkdtemp(join(tmpdir(), 'publish-race-')); const out = join(root, 'out');
  let release; const gate = new Promise(resolve => { release = resolve; }); let ready = 0;
  const publish = marker => publishDirectory(out, async dir => {
    await writeFile(join(dir, 'index.html'), marker);
    await writeFile(join(dir, 'manifest.json'), marker);
    ready++; if (ready === 2) release(); await gate;
  });
  const results = await Promise.allSettled([publish('one'), publish('two')]);
  assert.ok(results.some(result => result.status === 'fulfilled'));
  const index = await readFile(join(out, 'index.html'), 'utf8');
  assert.equal(await readFile(join(out, 'manifest.json'), 'utf8'), index);
  assert.ok(['one', 'two'].includes(index));
  assert.equal((await readdir(root)).some(name => /\.(?:candidate|backup)-/.test(name)), false);
});
