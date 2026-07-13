import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('parity contract covers every specialist route with preserved advantages', async () => {
  const parity = JSON.parse(await readFile(new URL('../references/capability-parity.json', import.meta.url), 'utf8'));
  const required = ['prd-generator', 'pm-kakaxi', 'vne', 'inspire', 'figma-flow', 'open-design'];
  assert.deepEqual(Object.keys(parity.specialists).sort(), required.sort());
  for (const [id, contract] of Object.entries(parity.specialists)) {
    assert.ok(contract.useWhen.length > 0, `${id} needs routing evidence`);
    assert.ok(contract.mustPreserve.length >= 3, `${id} needs preservation gates`);
    assert.equal(contract.deliveryPolicy, 'preserve-specialist-result');
  }
});
