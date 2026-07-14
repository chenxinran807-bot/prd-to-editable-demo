import test from 'node:test';
import assert from 'node:assert/strict';
import { runBenchmark } from '../scripts/run-benchmark.mjs';

test('benchmark covers ecommerce discovery, checkout, and after-sales flows', () => {
  const report = runBenchmark();
  assert.equal(report.cases.length, 7);
  assert.ok(report.cases.every(item => item.passed), JSON.stringify(report, null, 2));
  assert.equal(report.cases.find(item => item.name === 'strategy')?.route, 'direct');
  assert.equal(report.cases.find(item => item.name === 'scheduling')?.route, 'direct');
  assert.ok(report.cases.find(item => item.name === 'scheduling')?.businessObjects.includes('排班表'));
  assert.ok(report.cases.find(item => item.name === 'scheduling')?.states.includes('error'));
  assert.ok(report.cases.find(item => item.name === 'simple')?.editable);
  for (const name of ['commerce-discovery', 'commerce-checkout', 'commerce-after-sales']) {
    const item = report.cases.find(candidate => candidate.name === name);
    assert.equal(item?.route, 'direct');
    assert.ok(item?.businessObjects.length > 0);
    assert.equal(item?.candidateCount, 0);
    assert.equal(item?.editable, true);
    assert.equal(item?.evidenceClass, 'deterministic-direct');
  }
  assert.ok(report.cases.flatMap(item => item.businessObjects).every(term => !/(点击|运营人员|失败|发起)/.test(term)));
});
