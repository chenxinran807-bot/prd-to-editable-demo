import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('runs Inspire as the final container and promotes a verified candidate', () => {
  const root = mkdtempSync(join(tmpdir(), 'inspire-pipeline-'));
  const fake = join(root, 'fake-inspire.mjs');
  const handoffPath = join(root, 'handoff.json');
  const output = join(root, 'delivery');
  writeFileSync(fake, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'whoami') console.log(JSON.stringify({ userId: 'tester' }));
else if (args[0] === 'skills') console.log(JSON.stringify({ list: [{ source: 'workspace', skillKey: 'douyin-native', version: 1 }] }));
else if (args[0] === 'generate') {
  console.log(JSON.stringify({ type: 'started', assetId: 'asset-123' }));
  console.log(JSON.stringify({ type: 'done', status: 'success', assetId: 'asset-123', previewUrl: 'https://inspire.test/preview/asset-123', inboxDeepLink: 'inspire://inbox/asset-123' }));
} else if (args[0] === 'asset') console.log(JSON.stringify({
  assetId: args[1],
  markup: '<header data-component="top-bar">商品详情</header><button data-action="add-to-cart"><img src="icons/cart.svg" alt="加入购物车">加入购物车</button><section data-state="success"><img src="icons/check.svg" alt="成功">已加入购物车</section>'
}));
else process.exit(3);
`);
  chmodSync(fake, 0o755);
  writeFileSync(handoffPath, JSON.stringify({
    routing: { selected: 'inspire', stages: ['prd-generator', 'inspire'], finalContainer: 'inspire' },
    requirements: { title: '商品详情', actor: '消费者', goal: '完成购物', userActions: ['加入购物车'], states: ['成功'] },
    auditRequirements: { actions: ['add-to-cart'], components: ['top-bar'], states: ['success'], touchLabels: ['加入购物车'] },
    inputs: { assets: [] }
  }));

  const stdout = execFileSync(process.execPath, [
    'bin/run-inspire-pipeline.mjs', '--handoff', handoffPath,
    '--design-skill', 'workspace:douyin-native@1', '--out', output
  ], { cwd: new URL('..', import.meta.url), env: { ...process.env, INSPIRE_PROTOTYPE_BIN: fake }, encoding: 'utf8' });

  for (const file of ['specialist-handoff.json', 'inspire-plan.json', 'inspire-delivery.json', 'native-design-report.json', 'NEXT.md']) {
    assert.ok(existsSync(join(output, file)), `missing ${file}`);
  }
  assert.equal(existsSync(join(output, 'index.html')), false);
  const delivery = JSON.parse(readFileSync(join(output, 'inspire-delivery.json'), 'utf8'));
  assert.equal(delivery.currentAssetId, 'asset-123');
  assert.equal(delivery.versions[0].acceptanceStatus, 'accepted');
  assert.match(stdout, /https:\/\/inspire\.test\/preview\/asset-123/);
  assert.match(stdout, /inspire:\/\/inbox\/asset-123/);
});

test('iterate mode keeps the accepted parent when deterministic audit fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'inspire-pipeline-fail-'));
  const fake = join(root, 'fake-inspire.mjs');
  const handoffPath = join(root, 'handoff.json');
  const output = join(root, 'delivery');
  writeFileSync(fake, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'whoami') console.log(JSON.stringify({ userId: 'tester' }));
else if (args[0] === 'skills') console.log(JSON.stringify({ list: [{ source: 'workspace', skillKey: 'douyin-native', version: 1 }] }));
else if (args[0] === 'generate') console.log(JSON.stringify({ type: 'done', status: 'success', assetId: 'asset-bad', previewUrl: 'https://inspire.test/bad', inboxDeepLink: 'inspire://inbox/bad' }));
else if (args[0] === 'asset') console.log(JSON.stringify({ assetId: args[1], markup: '<button>🛒 加购</button>' }));
`);
  chmodSync(fake, 0o755);
  writeFileSync(handoffPath, JSON.stringify({
    routing: { selected: 'inspire', stages: ['inspire'], finalContainer: 'inspire' },
    requirements: { title: '购物车' }, auditRequirements: {}, inputs: { assets: [] }
  }));
  execFileSync(process.execPath, [
    'bin/run-inspire-pipeline.mjs', '--handoff', handoffPath,
    '--design-skill', 'workspace:douyin-native@1', '--ref', 'asset-good', '--out', output
  ], { cwd: new URL('..', import.meta.url), env: { ...process.env, INSPIRE_PROTOTYPE_BIN: fake }, encoding: 'utf8' });
  const delivery = JSON.parse(readFileSync(join(output, 'inspire-delivery.json'), 'utf8'));
  assert.equal(delivery.currentAssetId, 'asset-good');
  assert.equal(delivery.versions[0].acceptanceStatus, 'candidate');
  assert.equal(delivery.versions[0].qualityStatus, 'pending');
});
