import test from 'node:test';
import assert from 'node:assert/strict';
import { createInspireClient, InspireClientError } from '../src/inspire-client.mjs';

function scriptedRunner(responses, calls = []) {
  return {
    calls,
    run: async (command, args) => {
      calls.push({ command, args });
      const next = responses.shift();
      if (!next) throw new Error('unexpected CLI call');
      return { code: 0, stderr: '', ...next };
    }
  };
}

test('preflight checks identity and the exact visible design Skill version', async () => {
  const fake = scriptedRunner([
    { stdout: JSON.stringify({ userId: 'u1', name: '测试用户' }) },
    { stdout: JSON.stringify({ list: [
      { source: 'workspace', skillKey: 'douyin-mall-native-design', version: 1, name: '商城设计' },
      { source: 'public', skillKey: 'other', version: 3 }
    ] }) }
  ]);
  const client = createInspireClient({ run: fake.run });
  const result = await client.preflight('workspace:douyin-mall-native-design@1');

  assert.deepEqual(fake.calls.map(call => call.args), [['whoami', '--json'], ['skills', 'visible', '--json']]);
  assert.equal(result.identity.userId, 'u1');
  assert.equal(result.designSkill.skillKey, 'douyin-mall-native-design');
  assert.equal(result.designSkill.version, 1);
});

test('preflight rejects an invisible or mismatched pinned Skill', async () => {
  const fake = scriptedRunner([
    { stdout: JSON.stringify({ userId: 'u1' }) },
    { stdout: JSON.stringify({ list: [{ source: 'workspace', skillKey: 'douyin-mall-native-design', version: 2 }] }) }
  ]);
  const client = createInspireClient({ run: fake.run });
  await assert.rejects(() => client.preflight('workspace:douyin-mall-native-design@1'), error => {
    assert.ok(error instanceof InspireClientError);
    assert.equal(error.kind, 'design_skill_not_visible');
    return true;
  });
});

test('generation uses structured argv and parses the final done event', async () => {
  const fake = scriptedRunner([{ stdout: [
    JSON.stringify({ type: 'started', assetId: 'asset-123', inboxDeepLink: 'https://inspire/inbox' }),
    JSON.stringify({ type: 'progress', message: 'building' }),
    JSON.stringify({ type: 'done', status: 'success', assetId: 'asset-123', previewUrl: 'https://inspire/preview', captures: ['capture.png'], inboxDeepLink: 'https://inspire/inbox' })
  ].join('\n') }]);
  const client = createInspireClient({ run: fake.run });
  const result = await client.generate({
    prompt: '生成商城页面', designSkill: 'workspace:douyin-mall-native-design@1', outputType: 'html',
    files: ['/tmp/screen one.png', '/tmp/icon.svg'], parentAssetId: 'asset-parent', name: '商城原型'
  });

  assert.equal(result.status, 'success');
  assert.equal(result.assetId, 'asset-123');
  assert.equal(result.previewUrl, 'https://inspire/preview');
  assert.equal(fake.calls[0].command, 'inspire-prototype');
  assert.deepEqual(fake.calls[0].args, [
    'generate', 'prototype', '--prompt', '生成商城页面', '--name', '商城原型',
    '--ref', 'asset-parent', '--skill', 'workspace:douyin-mall-native-design@1',
    '--file', '/tmp/screen one.png', '--file', '/tmp/icon.svg', '--type', 'html',
    '--wait', '--report', 'both', '--fail-on-generation-error', '--json'
  ]);
});

test('generation rejects malformed output and non-success terminal states', async () => {
  const malformed = createInspireClient({ run: async () => ({ code: 0, stdout: 'not-json', stderr: '' }) });
  await assert.rejects(() => malformed.generate({ prompt: 'x', designSkill: 'workspace:test@1', files: [] }), /malformed NDJSON/);

  const failed = createInspireClient({ run: async () => ({
    code: 0, stderr: '', stdout: JSON.stringify({ type: 'done', status: 'error', assetId: 'bad' })
  }) });
  await assert.rejects(() => failed.generate({ prompt: 'x', designSkill: 'workspace:test@1', files: [] }), error => {
    assert.equal(error.kind, 'generation_failed'); return true;
  });
});

test('CLI failures preserve a safe error kind without leaking stderr in the message', async () => {
  const client = createInspireClient({ run: async () => ({ code: 4, stdout: '', stderr: 'secret upstream detail' }) });
  await assert.rejects(() => client.whoami(), error => {
    assert.equal(error.kind, 'cli_failed');
    assert.doesNotMatch(error.message, /secret upstream detail/);
    return true;
  });
});
