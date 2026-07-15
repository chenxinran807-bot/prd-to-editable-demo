import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClarificationTurn, applyClarifications } from '../src/clarification.mjs';

const blocker = (id, theme, priority, requirementId = `req-${id}`, extra = {}) => ({
  id, theme, priority, requirementId, question: `Question ${id}?`, ...extra,
});

test('returns null for an empty clarification queue', () => {
  assert.equal(buildClarificationTurn([]), null);
});

test('shows at most three questions from only the highest-ranked theme', () => {
  const blockers = [
    blocker('a', 'scope', 'P1', 'r1', { options: ['One'], impact: 'Changes scope', source: { sourceIds: ['s1'] } }),
    blocker('b', 'flow', 'P0'), blocker('c', 'scope', 'P1'), blocker('d', 'scope', 'P1'),
    blocker('e', 'scope', 'P1'),
  ];
  assert.deepEqual(buildClarificationTurn(blockers), {
    theme: 'flow',
    questions: [{ id: 'b', theme: 'flow', priority: 'P0', requirementId: 'req-b', question: 'Question b?' }],
  });

  const turn = buildClarificationTurn(blockers.filter(({ id }) => id !== 'b'));
  assert.equal(turn.theme, 'scope');
  assert.deepEqual(turn.questions.map(({ id }) => id), ['a', 'c', 'd']);
  assert.deepEqual(turn.questions[0].source, { sourceIds: ['s1'] });
  assert.equal(turn.questions[0].impact, 'Changes scope');
  assert.ok(!('unrelated' in turn));
});

test('orders by priority while preserving source order within a priority', () => {
  const turn = buildClarificationTurn([
    blocker('p2', 'scope', 'P2'), blocker('p1-a', 'scope', 'P1'),
    blocker('p0-a', 'scope', 'P0'), blocker('p1-b', 'scope', 'P1'), blocker('p0-b', 'scope', 'P0'),
  ]);
  assert.deepEqual(turn.questions.map(({ id }) => id), ['p0-a', 'p0-b', 'p1-a']);
});

test('rejects invalid and duplicate blockers', () => {
  for (const bad of [
    [blocker('', 'scope', 'P0')], [blocker('a', '', 'P0')], [blocker('a', 'scope', 'urgent')],
    [blocker('a', 'scope', 'P0', 'r', { question: '' })],
    [blocker('a', 'scope', 'P0', 'r', { options: 'yes' })],
  ]) assert.throws(() => buildClarificationTurn(bad), TypeError);
  assert.throws(() => buildClarificationTurn([blocker('a', 'x', 'P0'), blocker('a', 'y', 'P1')]), /duplicate/i);
});

test('applies answers immutably, removes only answered blockers, and confirms their requirements', () => {
  const ir = {
    requirements: [
      { id: 'r1', certainty: 'missing', sourceIds: ['s1'], evidence: [{ sourceId: 's1' }] },
      { id: 'r2', certainty: 'explicit', sourceIds: ['s2'] },
    ],
    blockers: [blocker('a', 'scope', 'P0', 'r1'), blocker('b', 'flow', 'P1', 'r2')],
    metadata: { keep: true },
  };
  const before = structuredClone(ir);
  const result = applyClarifications(ir, [{ blockerId: 'a', answer: 'Use one workspace', answeredAt: '2026-07-15T01:00:00Z' }]);
  assert.deepEqual(ir, before);
  assert.deepEqual(result.blockers.map(({ id }) => id), ['b']);
  assert.equal(result.requirements[0].certainty, 'confirmed');
  assert.deepEqual(result.requirements[0].sourceIds, ['s1']);
  assert.deepEqual(result.requirements[0].evidence, [{ sourceId: 's1' }]);
  assert.deepEqual(result.requirements[0].confirmations, [
    { blockerId: 'a', answer: 'Use one workspace', answeredAt: '2026-07-15T01:00:00Z' },
  ]);
  assert.deepEqual(result.requirements[1], ir.requirements[1]);
  assert.deepEqual(result.metadata, { keep: true });
});

test('validates malformed, duplicate, and unknown answers', () => {
  const ir = { requirements: [{ id: 'r1' }], blockers: [blocker('a', 'scope', 'P0', 'r1')] };
  for (const answer of [
    { blockerId: '', answer: 'x', answeredAt: 'now' },
    { blockerId: 'a', answer: '', answeredAt: 'now' },
    { blockerId: 'a', answer: 'x', answeredAt: '' },
  ]) assert.throws(() => applyClarifications(ir, [answer]), TypeError);
  assert.throws(() => applyClarifications(ir, [{ blockerId: 'unknown', answer: 'x', answeredAt: 'now' }]), /unknown/i);
  assert.throws(() => applyClarifications(ir, [
    { blockerId: 'a', answer: 'x', answeredAt: 'now' },
    { blockerId: 'a', answer: 'y', answeredAt: 'later' },
  ]), /duplicate/i);
});

test('does not confirm a requirement until every linked blocker is resolved', () => {
  const ir = {
    requirements: [{ id: 'r1', certainty: 'missing' }],
    blockers: [blocker('a', 'scope', 'P0', 'r1'), blocker('b', 'scope', 'P1', 'r1')],
  };
  const partial = applyClarifications(ir, [{ blockerId: 'a', answer: 'A', answeredAt: 't1' }]);
  assert.equal(partial.requirements[0].certainty, 'missing');
  assert.deepEqual(partial.requirements[0].confirmations, [{ blockerId: 'a', answer: 'A', answeredAt: 't1' }]);
  const complete = applyClarifications(partial, [{ blockerId: 'b', answer: 'B', answeredAt: 't2' }]);
  assert.equal(complete.requirements[0].certainty, 'confirmed');
  assert.deepEqual(complete.requirements[0].confirmations.map(({ blockerId }) => blockerId), ['a', 'b']);
});

test('preserves prior confirmations and appends new ones in answer order', () => {
  const ir = {
    requirements: [{ id: 'r1', certainty: 'missing', confirmations: [{ blockerId: 'old', answer: 'Old', answeredAt: 't0' }] }],
    blockers: [blocker('a', 'scope', 'P0', 'r1'), blocker('b', 'scope', 'P0', 'r1')],
  };
  const result = applyClarifications(ir, [
    { blockerId: 'b', answer: 'B', answeredAt: 't2' },
    { blockerId: 'a', answer: 'A', answeredAt: 't1' },
  ]);
  assert.deepEqual(result.requirements[0].confirmations.map(({ blockerId }) => blockerId), ['old', 'b', 'a']);
});
