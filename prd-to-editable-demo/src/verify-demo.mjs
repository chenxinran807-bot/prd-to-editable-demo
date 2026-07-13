import { validateModel } from './validate-model.mjs';

export function verifyDemo({ html, manifest }) {
  validateModel(manifest);
  const checks = [
    ['doctype', /<!doctype html>/i],
    ['embedded manifest', /id="prototype-manifest"/],
    ['stable element keys', /data-proto-key="/],
    ['preview control', /data-mode="preview"/],
    ['edit control', /data-mode="edit"/],
    ['editor panel', /id="editor-panel"/],
    ['patch persistence', /localStorage/],
    ['Agent comments', /id="agent-submit"/]
  ];
  for (const [name, pattern] of checks) {
    if (!pattern.test(html)) throw new Error(`quality check failed: ${name}`);
  }
  return checks.map(([name]) => ({ name, passed: true }));
}
