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

test('preflight matches a built-in Skill returned with only the name identity field', async () => {
  const fake = scriptedRunner([
    { stdout: JSON.stringify({ loggedIn: true, user: 'tester' }) },
    { stdout: JSON.stringify({ list: [{ source: 'built-in', name: 'tiktok-design-system' }] }) }
  ]);
  const client = createInspireClient({ run: fake.run });

  const result = await client.preflight('built-in:tiktok-design-system');
  assert.equal(result.designSkill.name, 'tiktok-design-system');
  assert.equal(result.reference.skillKey, 'tiktok-design-system');
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

test('preflight rejects the host orchestration Skill before calling Inspire', async () => {
  const fake = scriptedRunner([]);
  const client = createInspireClient({ run: fake.run });
  await assert.rejects(() => client.preflight('private:prd-to-editable-demo'), error => {
    assert.ok(error instanceof InspireClientError);
    assert.equal(error.kind, 'orchestration_skill_misrouted');
    return true;
  });
  assert.deepEqual(fake.calls, []);
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
    '--wait', '--report', 'json', '--fail-on-generation-error', '--json'
  ]);
});

test('generation adapter preserves JSON events while tolerating an appended human report', async () => {
  const fake = scriptedRunner([{ stdout: [
    JSON.stringify({ type: 'started', assetId: 'asset-current' }),
    JSON.stringify({ type: 'done', result: { status: 'success', assetId: 'asset-current', previewUrl: 'https://preview/current' } }),
    '# Inspire Prototype E2E Report',
    '- Preview: https://preview/current'
  ].join('\n') }]);
  const client = createInspireClient({ run: fake.run });
  const result = await client.generate({ prompt: '生成原型', designSkill: 'public:mobile@1' });
  assert.equal(result.assetId, 'asset-current');
  assert.equal(result.events.length, 2);
  assert.deepEqual(result.ignoredOutput, ['# Inspire Prototype E2E Report', '- Preview: https://preview/current']);
});

test('generation adapter accepts the current direct terminal report shape', async () => {
  const terminal = {
    assetId: 'asset-direct', status: 'success', previewUrl: 'https://preview/direct',
    skillTrace: { activatedSkills: [], openedSkills: [] },
    e2eReport: { assetId: 'asset-direct', status: 'success', previewUrl: 'https://preview/direct' }
  };
  const client = createInspireClient({ run: scriptedRunner([{ stdout: JSON.stringify(terminal) }]).run });
  const result = await client.generate({ prompt: '生成原型', designSkill: 'public:mobile@1' });
  assert.equal(result.assetId, 'asset-direct');
  assert.equal(result.previewUrl, 'https://preview/direct');
});

test('asset source falls back to the published dist artifact', async () => {
  const client = createInspireClient({
    run: scriptedRunner([]).run,
    fetchImpl: async url => ({
      ok: true,
      text: async () => `/* ${url} */ <button data-action="submit">提交</button>`
    })
  });
  const source = await client.assetSource({ distUrl: 'https://cdn.example/prototype.js' });
  assert.match(source, /data-action="submit"/u);
});

test('asset source fails closed when the published artifact cannot be read', async () => {
  const client = createInspireClient({
    run: scriptedRunner([]).run,
    fetchImpl: async () => ({ ok: false, status: 403 })
  });
  await assert.rejects(
    () => client.assetSource({ distUrl: 'https://cdn.example/prototype.js' }),
    error => error instanceof InspireClientError && error.kind === 'audit_source_unavailable'
  );
});

test('generation fails closed when the exact business Skill was not opened', async () => {
  const fake = scriptedRunner([{ stdout: JSON.stringify({
    type: 'done', status: 'success', assetId: 'asset-fallback',
    skillTrace: {
      selectedSkills: [{ source: 'private', skillKey: 'douyin-native', version: 3, packageHash: 'hash-3' }],
      activatedSkills: [],
      openedSkills: [{ source: 'built-in', skillKey: 'mobile-shell', version: 1 }]
    }
  }) }]);
  const client = createInspireClient({ run: fake.run });
  await assert.rejects(() => client.generate({
    prompt: '生成商城页面',
    designSkill: 'private:douyin-native@3',
    expectedDesignSkill: { source: 'private', skillKey: 'douyin-native', version: 3, packageHash: 'hash-3' }
  }), error => {
    assert.ok(error instanceof InspireClientError);
    assert.equal(error.kind, 'design_skill_not_opened');
    assert.equal(error.details.assetId, 'asset-fallback');
    return true;
  });
});

test('generation accepts only the exact opened business Skill package', async () => {
  const fake = scriptedRunner([{ stdout: JSON.stringify({
    type: 'done', status: 'success', assetId: 'asset-native',
    skillTrace: {
      activatedSkills: [{ source: 'private', skillKey: 'douyin-native', version: 3, packageHash: 'hash-3' }],
      openedSkills: [{ source: 'private', skillKey: 'douyin-native', version: 3, packageHash: 'hash-3' }]
    }
  }) }]);
  const client = createInspireClient({ run: fake.run });
  const result = await client.generate({
    prompt: '生成商城页面',
    designSkill: 'private:douyin-native@3',
    expectedDesignSkill: { source: 'private', skillKey: 'douyin-native', version: 3, packageHash: 'hash-3' }
  });
  assert.equal(result.assetId, 'asset-native');
});

test('generation matches the real Inspire trace name/ref fields to the visible skillKey', async () => {
  const exact = { source: 'private', name: 'douyin-native', ref: 'douyin-native', version: '3', packageHash: 'hash-3' };
  const fake = scriptedRunner([{ stdout: JSON.stringify({
    type: 'done', status: 'success', assetId: 'asset-real-trace',
    skillTrace: { activatedSkills: [exact], openedSkills: [exact] }
  }) }]);
  const client = createInspireClient({ run: fake.run });
  const result = await client.generate({
    prompt: '生成商城页面', designSkill: 'private:douyin-native@3',
    expectedDesignSkill: { source: 'private', skillKey: 'douyin-native', version: 3, packageHash: 'hash-3' }
  });
  assert.equal(result.assetId, 'asset-real-trace');
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
