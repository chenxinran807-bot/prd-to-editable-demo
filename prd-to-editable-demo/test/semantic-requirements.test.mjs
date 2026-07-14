import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSemanticRequirements } from '../src/semantic-requirements.mjs';
import { analyzeRequirements } from '../src/parse-prd.mjs';

const source = `# 冷链月台预约
承运商在到仓前预约月台和时间窗。调度员可以批准或驳回预约；批准后生成入仓凭证，驳回后承运商可以修改并重新提交。
`;

test('accepts evidence-grounded semantic IR without relying on a product dictionary', () => {
  const result = validateSemanticRequirements({
    schemaVersion: 1,
    extractionMode: 'model-semantic',
    confidence: 'high',
    title: '冷链月台预约', actor: '承运商', goal: '预约入仓时间',
    businessObjects: ['月台', '时间窗', '入仓凭证'],
    userActions: ['预约', '批准', '驳回', '重新提交'],
    states: ['待审批', '已批准', '已驳回'],
    screens: ['预约申请', '调度审批', '入仓凭证'],
    transitions: [
      { from: '预约申请', action: '提交预约', to: '调度审批', evidence: '调度员可以批准或驳回预约' },
      { from: '调度审批', action: '批准', to: '入仓凭证', evidence: '批准后生成入仓凭证' }
    ],
    evidence: [
      { kind: 'actor', term: '承运商', quote: '承运商在到仓前预约月台和时间窗' },
      { kind: 'business-object', term: '月台', quote: '预约月台和时间窗' },
      { kind: 'business-object', term: '时间窗', quote: '预约月台和时间窗' },
      { kind: 'business-object', term: '入仓凭证', quote: '批准后生成入仓凭证' },
      { kind: 'user-action', term: '预约', quote: '预约月台和时间窗' },
      { kind: 'user-action', term: '批准', quote: '调度员可以批准或驳回预约' },
      { kind: 'user-action', term: '驳回', quote: '调度员可以批准或驳回预约' },
      { kind: 'user-action', term: '重新提交', quote: '修改并重新提交' }
    ],
    assumptions: [], gaps: ['状态名称由交互语义归纳，PRD 未提供界面名称']
  }, source);

  assert.equal(result.extractionMode, 'model-semantic');
  assert.deepEqual(result.businessObjects, ['月台', '时间窗', '入仓凭证']);
});

test('rejects semantic claims whose evidence is not present in the PRD', () => {
  assert.throws(() => validateSemanticRequirements({
    schemaVersion: 1, extractionMode: 'model-semantic', confidence: 'high',
    title: '冷链月台预约', actor: '仓库管理员', goal: '自动收费',
    businessObjects: ['账单'], userActions: ['支付'], states: [], screens: [], transitions: [],
    evidence: [{ kind: 'business-object', term: '账单', quote: '系统自动生成收费账单' }],
    assumptions: [], gaps: []
  }, source), /evidence quote is not present/);
});

test('labels deterministic parsing as a low-confidence fallback', () => {
  const result = analyzeRequirements(source);
  assert.equal(result.extractionMode, 'heuristic-fallback');
  assert.equal(result.confidence, 'low');
  assert.ok(result.gaps.some(item => /模型语义抽取/.test(item)));
});
