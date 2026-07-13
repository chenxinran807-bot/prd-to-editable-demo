import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePatch, updateHistory, undoHistory, redoHistory, migratePatches } from '../src/patches.mjs';

test('sanitizes editable fields and allowed styles', () => {
  assert.deepEqual(sanitizePatch({
    text: '确认提交', hidden: true, disabled: false,
    style: { color: '#fff', backgroundColor: '#2563eb', cssText: 'display:none' },
    action: { type: 'navigate', target: 'success' }
  }), {
    text: '确认提交', hidden: true, disabled: false,
    style: { color: '#fff', backgroundColor: '#2563eb' },
    action: { type: 'navigate', target: 'success' }
  });
});

test('undo and redo traverse immutable patch snapshots', () => {
  let history = updateHistory({ snapshots: [{}], index: 0 }, { 'home.cta': { text: '开始' } });
  history = updateHistory(history, { 'home.cta': { text: '继续' } });
  history = undoHistory(history);
  assert.equal(history.snapshots[history.index]['home.cta'].text, '开始');
  history = redoHistory(history);
  assert.equal(history.snapshots[history.index]['home.cta'].text, '继续');
});

test('migrates exact stable keys and preserves unmatched conflicts', () => {
  const result = migratePatches({
    'home.cta': { text: '继续' },
    'removed.cta': { hidden: true }
  }, { pages: [{ elements: [{ key: 'home.cta' }] }] });
  assert.deepEqual(Object.keys(result.applied), ['home.cta']);
  assert.deepEqual(Object.keys(result.conflicts), ['removed.cta']);
});
