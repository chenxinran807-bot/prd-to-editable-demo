import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('capability contract describes the standalone core and Inspire without peer-Skill dependencies', async () => {
  const parity = JSON.parse(await readFile(new URL('../references/capability-parity.json', import.meta.url), 'utf8'));
  const required = ['semantic-understanding', 'interaction-design', 'visual-quality', 'editable-runtime', 'inspire'];
  assert.deepEqual(Object.keys(parity.capabilities).sort(), required.sort());
  assert.doesNotMatch(JSON.stringify(parity), /prd-generator|pm-kakaxi-skills|figma-flow|open-design|"vne"/);
  for (const [id, contract] of Object.entries(parity.capabilities)) {
    assert.ok(contract.useWhen.length > 0, `${id} needs routing evidence`);
    assert.ok(contract.mustPreserve.length >= 3, `${id} needs preservation gates`);
    assert.match(contract.deliveryPolicy, /standalone-core|professional-container/);
  }
});
