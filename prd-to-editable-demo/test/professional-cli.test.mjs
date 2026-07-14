import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('explicit Inspire export remains available as an optional path', () => {
  const root = mkdtempSync(join(tmpdir(), 'professional-public-cli-'));
  const fake = join(root, 'fake-inspire.mjs');
  const counter = join(root, 'counter.txt');
  const out = join(root, 'out');
  writeFileSync(counter, '0');
  writeFileSync(fake, `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const skill = { source: 'private', name: 'douyin-mall-independent-app-prototype-guidance', version: 5, packageHash: '39719f13e0a42cef48778772490ae3aefeedfe637ea9464752b8ba1b61973cbf', category: 'design-system' };
if (args[0] === 'whoami') console.log(JSON.stringify({ userId: 'tester' }));
else if (args[0] === 'skills') console.log(JSON.stringify({ list: [skill] }));
else if (args[0] === 'generate') {
  const next = Number(readFileSync(process.env.FAKE_COUNTER, 'utf8')) + 1;
  writeFileSync(process.env.FAKE_COUNTER, String(next));
  writeFileSync(process.env.FAKE_COUNTER + '.prompt-' + next, args[args.indexOf('--prompt') + 1]);
  console.log(JSON.stringify({ type: 'done', status: 'success', assetId: 'asset-' + next, previewUrl: 'https://preview/' + next, inboxDeepLink: 'inspire://inbox/' + next, skillTrace: { activatedSkills: [skill], openedSkills: [skill] } }));
} else if (args[0] === 'asset') console.log(JSON.stringify({ assetId: args[1], markup: '<main data-editable="image icon position size text color visibility state navigation"><button data-action="选择规格">选择规格</button><button data-action="立即购买">立即购买</button><button data-action="选择地址">选择地址</button><button data-action="选择优惠券">选择优惠券</button><button data-action="提交订单">提交订单</button><button data-action="重新支付">重新支付</button><section>规格选择 确认订单 支付结果 库存不足 提交中 支付成功 支付失败</section></main>' }));
else process.exit(4);
`);
  chmodSync(fake, 0o755);

  const result = spawnSync(process.execPath, [
    'bin/prd-to-editable-demo.mjs',
    '--prd', 'fixtures/commerce-checkout-prd.md',
    '--requirements', 'fixtures/commerce-checkout-requirements.json',
    '--intent', '在 Inspire 编辑并发布',
    '--out', out
  ], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
    env: { ...process.env, INSPIRE_PROTOTYPE_BIN: fake, FAKE_COUNTER: counter }
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(out, 'index.html')), false);
  const comparison = JSON.parse(readFileSync(join(out, 'candidate-comparison.json'), 'utf8'));
  assert.equal(comparison.status, 'comparison-ready');
  assert.equal(comparison.candidates.length, 3);
  assert.deepEqual(comparison.candidates.map(item => item.assetId), ['asset-1', 'asset-2', 'asset-3']);
  assert.ok(comparison.candidates.every(item => item.previewUrl));
  for (const index of [1, 2, 3]) {
    assert.match(readFileSync(`${counter}.prompt-${index}`, 'utf8'), /消费者在商品详情选择颜色和尺码规格/);
  }
});
