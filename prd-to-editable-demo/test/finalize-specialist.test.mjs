import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finalizeSpecialistResult } from '../src/finalize-specialist.mjs';

test('preserves the specialist bundle and emits a unified editable delivery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'specialist-result-'));
  const source = join(root, 'source');
  const output = join(root, 'output');
  await mkdir(join(source, 'assets'), { recursive: true });
  await writeFile(join(source, 'index.html'), '<!doctype html><html><body><h1>高保真结果</h1></body></html>');
  await writeFile(join(source, 'assets', 'app.css'), '.app{display:grid}');
  const handoff = { routing: { selected: 'pm-kakaxi' }, requirements: { businessObjects: ['商品'] } };

  const result = await finalizeSpecialistResult({ sourceDir: source, outDir: output, handoff });

  assert.ok(result.files.includes('index.html'));
  assert.match(await readFile(join(output, 'index.html'), 'utf8'), /proto-edit-toggle/);
  assert.match(await readFile(join(output, 'index.original.html'), 'utf8'), /高保真结果/);
  assert.equal(await readFile(join(output, 'assets', 'app.css'), 'utf8'), '.app{display:grid}');
  const manifest = JSON.parse(await readFile(join(output, 'prototype.manifest.json'), 'utf8'));
  assert.equal(manifest.routing.selected, 'pm-kakaxi');
  assert.equal(manifest.routing.status, 'completed');
});
