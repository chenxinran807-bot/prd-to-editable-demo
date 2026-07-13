# Hybrid Inspire Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `prd-to-editable-demo` into an external Agent orchestrator that always delivers professional prototypes through Inspire and a versioned Douyin Mall native-design business Skill.

**Architecture:** The installed Agent Skill owns PRD understanding, route selection, Inspire CLI orchestration, version lineage and quality gates. Inspire owns the final prototype asset and manual editing. A separate `douyin-mall-native-design` source package owns design tokens, component rules, approved references, formal icons and negative constraints; its official upload package and attestation must be produced by `inspire-prototype-skill-generator`.

**Tech Stack:** Node.js ESM, Node test runner, Inspire Prototype CLI 0.1.10+, JSON/Markdown contracts, HTML prototype validation, Playwright for browser QA.

---

## File structure

- `prd-to-editable-demo/src/inspire-plan.mjs`: convert route and requirements into an executable Inspire plan.
- `prd-to-editable-demo/src/inspire-client.mjs`: isolated wrapper around official CLI commands and NDJSON parsing.
- `prd-to-editable-demo/src/inspire-lineage.mjs`: validate and update accepted asset/version lineage.
- `prd-to-editable-demo/src/native-design-audit.mjs`: audit Emoji, icon provenance, forbidden visual patterns and required component evidence.
- `prd-to-editable-demo/bin/run-inspire-pipeline.mjs`: public CLI for preflight, generation, iteration and report writing.
- `prd-to-editable-demo/schemas/inspire-delivery.schema.json`: delivery and lineage contract.
- `prd-to-editable-demo/inspire-business-skill/`: source material for the Inspire business Skill; not a hand-authored upload ZIP.
- `prd-to-editable-demo/test/`: unit, CLI and adversarial tests for the new boundaries.

### Task 1: Make Inspire the professional-path delivery contract

**Files:**
- Modify: `prd-to-editable-demo/src/select-route.mjs`
- Modify: `prd-to-editable-demo/bin/prd-to-editable-demo.mjs`
- Create: `prd-to-editable-demo/src/inspire-plan.mjs`
- Test: `prd-to-editable-demo/test/inspire-plan.test.mjs`
- Modify: `prd-to-editable-demo/test/select-route.test.mjs`

- [ ] **Step 1: Write the failing routing and plan tests**

```js
test('professional paths end in Inspire while preserving specialist stages', () => {
  const route = selectRoute({ source: `${'## 状态\n失败后重试\n'.repeat(8)}![界面](screen.png)` });
  assert.deepEqual(route.stages, ['prd-generator', 'pm-kakaxi', 'inspire']);
  assert.equal(route.id, 'inspire');
});

test('builds a reproducible Inspire generation plan', () => {
  const plan = buildInspirePlan({ route, requirements, inputs, designSkill: 'workspace:douyin-mall-native-design@1' });
  assert.equal(plan.command, 'generate prototype');
  assert.equal(plan.outputType, 'html');
  assert.equal(plan.designSkill, 'workspace:douyin-mall-native-design@1');
  assert.match(plan.prompt, /Emoji 数量必须为 0/);
});
```

- [ ] **Step 2: Run the tests and verify the intended failure**

Run: `cd prd-to-editable-demo && node --test test/inspire-plan.test.mjs test/select-route.test.mjs`

Expected: FAIL because `buildInspirePlan` is missing and current routes do not append Inspire.

- [ ] **Step 3: Implement the plan builder and terminal-stage routing**

```js
export function buildInspirePlan({ route, requirements, inputs, designSkill, parentAssetId = null }) {
  if (!designSkill) throw new Error('Inspire business design Skill is required for professional delivery');
  return {
    schemaVersion: 1,
    command: 'generate prototype',
    mode: parentAssetId ? 'iterate' : 'create',
    parentAssetId,
    designSkill,
    outputType: 'html',
    files: inputs.assets,
    prompt: renderInspirePrompt({ requirements, stages: route.stages, noEmoji: true })
  };
}
```

Every non-local professional route must preserve its specialist stages and append exactly one terminal `inspire` stage. Explicit engineering-only delivery may retain `vne` as a separate export after the accepted Inspire asset, but cannot replace the prototype container.

- [ ] **Step 4: Run route and plan tests**

Run: `cd prd-to-editable-demo && node --test test/inspire-plan.test.mjs test/select-route.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prd-to-editable-demo/src/inspire-plan.mjs prd-to-editable-demo/src/select-route.mjs prd-to-editable-demo/bin/prd-to-editable-demo.mjs prd-to-editable-demo/test/inspire-plan.test.mjs prd-to-editable-demo/test/select-route.test.mjs
git commit -m "feat: make Inspire the professional prototype container"
```

### Task 2: Add a safe official Inspire CLI adapter

**Files:**
- Create: `prd-to-editable-demo/src/inspire-client.mjs`
- Create: `prd-to-editable-demo/test/inspire-client.test.mjs`

- [ ] **Step 1: Write failing adapter tests with an injected process runner**

```js
test('preflight checks identity and the exact visible design Skill version', async () => {
  const calls = [];
  const client = createInspireClient({ run: fakeRun(calls) });
  const result = await client.preflight('workspace:douyin-mall-native-design@1');
  assert.deepEqual(calls.map(call => call.args.slice(0, 2)), [['whoami', '--json'], ['skills', 'visible']]);
  assert.equal(result.designSkill.key, 'douyin-mall-native-design');
});

test('generation uses only structured argv and parses the final done event', async () => {
  const result = await client.generate(plan);
  assert.equal(result.status, 'success');
  assert.equal(result.assetId, 'asset-123');
  assert.ok(result.previewUrl);
});
```

- [ ] **Step 2: Verify failure**

Run: `cd prd-to-editable-demo && node --test test/inspire-client.test.mjs`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement preflight and generation without shell interpolation**

Use `spawn('inspire-prototype', args, { shell: false })`. Implement only these methods:

```js
client.whoami();
client.visibleSkills();
client.preflight(designSkillRef);
client.generate(plan); // --wait --report both --fail-on-generation-error --json
client.asset(assetId);
```

Reject missing login, invisible Skill, mismatched pinned version, malformed NDJSON, missing `assetId`, and non-success terminal status with typed errors.

- [ ] **Step 4: Run adapter tests**

Run: `cd prd-to-editable-demo && node --test test/inspire-client.test.mjs`

Expected: PASS with no real network calls.

- [ ] **Step 5: Commit**

```bash
git add prd-to-editable-demo/src/inspire-client.mjs prd-to-editable-demo/test/inspire-client.test.mjs
git commit -m "feat: add official Inspire CLI adapter"
```

### Task 3: Persist accepted Inspire asset lineage

**Files:**
- Create: `prd-to-editable-demo/schemas/inspire-delivery.schema.json`
- Create: `prd-to-editable-demo/src/inspire-lineage.mjs`
- Create: `prd-to-editable-demo/test/inspire-lineage.test.mjs`

- [ ] **Step 1: Write failing lineage tests**

```js
test('does not promote an unverified child asset', () => {
  const lineage = startLineage({ prdSha256: 'abc', designSkill: 'workspace:douyin-mall-native-design@1' });
  const candidate = addCandidate(lineage, { assetId: 'child', parentAssetId: 'accepted', status: 'success' });
  assert.throws(() => acceptCandidate(candidate, 'child'), /quality verification/);
});

test('promotes only a verified candidate and retains its parent', () => {
  const accepted = acceptCandidate(markVerified(lineage, 'child', quality), 'child');
  assert.equal(accepted.currentAssetId, 'child');
  assert.equal(accepted.versions[0].parentAssetId, 'accepted');
});
```

- [ ] **Step 2: Verify failure**

Run: `cd prd-to-editable-demo && node --test test/inspire-lineage.test.mjs`

Expected: FAIL because lineage functions and schema are missing.

- [ ] **Step 3: Implement immutable lineage transitions**

The schema must require `prdSha256`, `designSkill`, `currentAssetId`, and version entries containing `assetId`, `parentAssetId`, `status`, `previewUrl`, `inboxDeepLink`, `qualityStatus`, and timestamps. `acceptCandidate` must reject missing/failed quality evidence.

- [ ] **Step 4: Run lineage tests**

Run: `cd prd-to-editable-demo && node --test test/inspire-lineage.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prd-to-editable-demo/schemas/inspire-delivery.schema.json prd-to-editable-demo/src/inspire-lineage.mjs prd-to-editable-demo/test/inspire-lineage.test.mjs
git commit -m "feat: track accepted Inspire prototype lineage"
```

### Task 4: Build the Douyin Mall native-design source library

**Files:**
- Create: `prd-to-editable-demo/inspire-business-skill/SKILL.md`
- Create: `prd-to-editable-demo/inspire-business-skill/design-tokens.json`
- Create: `prd-to-editable-demo/inspire-business-skill/components.md`
- Create: `prd-to-editable-demo/inspire-business-skill/negative-rules.md`
- Create: `prd-to-editable-demo/inspire-business-skill/references.json`
- Create: `prd-to-editable-demo/inspire-business-skill/icons/*.svg`
- Create: `prd-to-editable-demo/test/business-design-source.test.mjs`

- [ ] **Step 1: Write failing source-quality tests**

```js
test('business design source has no Emoji and every icon has provenance', async () => {
  const source = await loadBusinessDesignSource();
  assert.equal(findEmoji(source.text).length, 0);
  assert.ok(source.icons.length >= 12);
  assert.ok(source.icons.every(icon => icon.provenance && icon.license));
});

test('covers the required native mobile component families', async () => {
  const source = await loadBusinessDesignSource();
  for (const family of ['top-bar','bottom-nav','product-card','primary-button','dialog','bottom-sheet','state-feedback']) {
    assert.ok(source.components.has(family));
  }
});
```

- [ ] **Step 2: Verify failure**

Run: `cd prd-to-editable-demo && node --test test/business-design-source.test.mjs`

Expected: FAIL because the source library is missing.

- [ ] **Step 3: Add tokens, component rules and negative constraints**

Use the accepted independent-app screenshots already stored in `/Users/bytedance/Documents/prd-demo/work/prototype-skill-benchmark/assets/` as reference evidence. Define explicit typography, spacing, radius, surface, overlay and interaction tokens. Negative rules must reject Emoji, generic purple gradients, desktop sidebars, fake device frames inside the prototype, invented brand marks and text characters used as icons.

- [ ] **Step 4: Add formal SVG icon sources with provenance**

Each SVG file must have a matching `references.json` entry with `id`, `file`, `source`, `license`, `role`, and `acceptedAt`. Do not trace or extract proprietary icons from screenshots. Use business-provided files when available; otherwise use a licensed neutral icon set and mark the remaining brand-specific icon gap as blocking for workspace publication.

- [ ] **Step 5: Run source-quality tests**

Run: `cd prd-to-editable-demo && node --test test/business-design-source.test.mjs`

Expected: PASS for structure and Emoji rules. Publication remains blocked if any required brand-specific icon has `status: missing`.

- [ ] **Step 6: Commit**

```bash
git add prd-to-editable-demo/inspire-business-skill prd-to-editable-demo/test/business-design-source.test.mjs
git commit -m "feat: add Douyin Mall native design source library"
```

### Task 5: Add adversarial native-design auditing

**Files:**
- Create: `prd-to-editable-demo/src/native-design-audit.mjs`
- Create: `prd-to-editable-demo/bin/audit-inspire-result.mjs`
- Create: `prd-to-editable-demo/test/native-design-audit.test.mjs`

- [ ] **Step 1: Write failing audit tests**

```js
test('rejects Emoji and text glyph icons', () => {
  const report = auditNativeDesign('<button>🛒 加购</button><span class="icon">★</span>');
  assert.equal(report.status, 'failed');
  assert.deepEqual(report.failures.map(x => x.rule), ['no-emoji', 'no-text-glyph-icons']);
});

test('requires PRD actions, mobile components and icon provenance', () => {
  const report = auditNativeDesign(validHtml, { requirements, references });
  assert.equal(report.status, 'passed');
});
```

- [ ] **Step 2: Verify failure**

Run: `cd prd-to-editable-demo && node --test test/native-design-audit.test.mjs`

Expected: FAIL because the audit module is missing.

- [ ] **Step 3: Implement deterministic audits**

Audit source and exported prototype for: Unicode Emoji, glyph icons, unapproved external assets, generic purple gradients, desktop navigation patterns, fake phone frames, missing required actions, missing state coverage, missing touch labels and missing icon provenance. Emit `native-design-report.json`; never auto-pass subjective visual quality.

- [ ] **Step 4: Run audit tests**

Run: `cd prd-to-editable-demo && node --test test/native-design-audit.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prd-to-editable-demo/src/native-design-audit.mjs prd-to-editable-demo/bin/audit-inspire-result.mjs prd-to-editable-demo/test/native-design-audit.test.mjs
git commit -m "feat: add adversarial native design audit"
```

### Task 6: Add the public Inspire pipeline command

**Files:**
- Create: `prd-to-editable-demo/bin/run-inspire-pipeline.mjs`
- Modify: `prd-to-editable-demo/package.json`
- Create: `prd-to-editable-demo/test/inspire-pipeline.test.mjs`
- Modify: `prd-to-editable-demo/SKILL.md`
- Modify: `README.md`

- [ ] **Step 1: Write a failing CLI integration test with a fake Inspire binary**

The fake binary must return a valid identity, a pinned visible Skill, and NDJSON `started`/`done` events. Assert the command writes:

```text
specialist-handoff.json
inspire-plan.json
inspire-delivery.json
native-design-report.json
NEXT.md
```

and never writes a competing professional `index.html`.

- [ ] **Step 2: Verify failure**

Run: `cd prd-to-editable-demo && node --test test/inspire-pipeline.test.mjs`

Expected: FAIL because the command is missing.

- [ ] **Step 3: Implement create and iterate modes**

```text
run-inspire-pipeline --handoff <file> --design-skill <source:key@version> --out <dir>
run-inspire-pipeline --handoff <file> --design-skill <source:key@version> --ref <assetId> --out <dir>
```

The command must preflight identity and visibility, execute generation, write lineage as `candidate`, run deterministic audits, and promote only passed results. It must print `previewUrl` and `inboxDeepLink` as the user-facing result.

- [ ] **Step 4: Run CLI tests and the full suite**

Run: `cd prd-to-editable-demo && npm test && npm run benchmark && npm run smoke`

Expected: all tests and benchmarks PASS.

- [ ] **Step 5: Commit**

```bash
git add prd-to-editable-demo/bin/run-inspire-pipeline.mjs prd-to-editable-demo/package.json prd-to-editable-demo/test/inspire-pipeline.test.mjs prd-to-editable-demo/SKILL.md README.md
git commit -m "feat: orchestrate final delivery through Inspire"
```

## Separate release plan required

Official package generation, private upload, real A/B generation, evidence attachment and workspace sharing form an independent deployment subsystem. They are intentionally excluded from this implementation plan because the required `inspire-prototype-skill-generator` is not installed in the current environment, and the official Inspire rules prohibit hand-authored attestations.

After Tasks 1–6 pass, create a second implementation plan from the installed generator's exact contract. That plan must cover package generation, provenance validation, `skills upload`, control/candidate generation, blind comparison against the valid 86/100 baseline, evidence attachment and version-pinned workspace sharing. Until that second plan passes, the business Skill source is locally validated but not described as installed or published.
